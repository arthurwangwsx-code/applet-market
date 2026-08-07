// NewsAggregator 的移植：TTL + 单飞 + 并发 fan-out + 首个非空来源立即发版 + 去重 + 截断 + 报告 +
// 落盘 + 正文预取 + 异步聚类（代际号校验）。
//
// 与原生的两点差异（README 有记）：
//  · 「低电量」在 Web 侧只能读 navigator.getBattery()（WebKit 不实现）→ pauseInLowPower 恒不触发；
//  · 「后台刷新」没有对应的 Web 能力 → 设置项保留但只影响回前台时是否补刷。

import { fetchFeed, fetchNewsAPI } from './providers.js'
import { dedupe } from './dedup.js'
import { normalizeURL } from './text.js'
import { cluster } from './cluster.js'
import { extract } from './extractor.js'
import { FAILURE, PAGE_MAX_BYTES, httpGet } from './host.js'
import type { NewsStore } from './store.js'
import type {
  FetchFailure,
  FeedReference,
  NewsArticle,
  NewsSettings,
  RefreshReport,
  SourceRefreshState,
  Unsubscribe,
} from '../types.js'

export const FOREGROUND_TTL_MS = 300 * 1000
export const SNAPSHOT_THROTTLE_MS = 15 * 1000
/** 一次 fan-out 的并发上限：桥是串行 postMessage，开太多只会互相排队并拖长首屏。 */
const FETCH_CONCURRENCY = 6

export class NewsAggregator {
  store: NewsStore
  timeline: NewsArticle[]
  timelineRevision: number
  lastUpdated: number | null
  lastReport: RefreshReport | null
  isRefreshing: boolean
  inflight: Promise<NewsArticle[]> | null
  generation: number
  lastPersistAt: number
  pendingPersist: boolean
  listeners: Set<(revision: number) => void>

  constructor(store: NewsStore) {
    this.store = store
    this.timeline = []
    this.timelineRevision = 0
    this.lastUpdated = null
    this.lastReport = null
    this.isRefreshing = false
    this.inflight = null
    this.generation = 0
    this.lastPersistAt = 0
    this.pendingPersist = false
    this.listeners = new Set()
  }

  subscribe(listener: (revision: number) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit() {
    this.timelineRevision += 1
    for (const listener of [...this.listeners]) listener(this.timelineRevision)
  }

  /** 启动 hydrate：先显磁盘快照秒开，再由调用方按 TTL 决定是否刷新。 */
  async hydrate() {
    const snapshot = await this.store.loadSnapshot()
    if (snapshot && snapshot.articles.length > 0) {
      this.timeline = snapshot.articles
      this.lastUpdated = snapshot.savedAt || null
      this.emit()
    }
  }

  /** 单飞 + TTL。force=true 越过 TTL（下拉刷新）。 */
  async refresh({ force = false }: { force?: boolean } = {}): Promise<NewsArticle[]> {
    if (this.inflight) return this.inflight
    if (!force && this.lastUpdated && Date.now() - this.lastUpdated < FOREGROUND_TTL_MS) {
      return this.timeline
    }
    this.inflight = this.run()
    try {
      return await this.inflight
    } finally {
      this.inflight = null
    }
  }

  async run() {
    const generation = ++this.generation
    const startedAt = Date.now()
    this.isRefreshing = true
    this.emit()

    const feeds = this.store.enabledFeeds
    const settings = this.store.settings
    const sourceStates: SourceRefreshState[] = []
    const collected: NewsArticle[] = []
    let publishedEarly = false

    const fetchStart = Date.now()
    await mapWithConcurrency(feeds, FETCH_CONCURRENCY, async (feed) => {
      const began = Date.now()
      let result: Awaited<ReturnType<typeof fetchFeed>>
      try {
        result = await fetchFeed(feed, settings, Date.now())
      } catch (error) {
        result = { articles: [], failure: 'unknown', httpStatus: null }
      }
      const duration = (Date.now() - began) / 1000
      const status = result.failure ? 'failed' : result.articles.length > 0 ? 'success' : 'empty'
      sourceStates.push({
        id: feed.id,
        sourceName: feed.title,
        status,
        itemCount: result.articles.length,
        duration,
        refreshedAt: Date.now(),
        failure: result.failure || null,
        httpStatus: result.httpStatus === undefined ? null : result.httpStatus,
      })
      if (result.articles.length > 0) {
        collected.push(...result.articles)
        this.store.markFeedFetched(feed.id)
        // 首个非空来源一到就先发布一版，不等最慢的源。
        if (!publishedEarly && generation === this.generation) {
          publishedEarly = true
          this.publish(this.compose(collected, settings).articles, { touchTimestamp: false })
        }
      }
    })
    const fetchDuration = (Date.now() - fetchStart) / 1000

    if (generation !== this.generation) return this.timeline

    // 一条都没抓到 → 保留旧时间线与旧 lastUpdated（不把旧内容伪装成刚刷新）。
    if (collected.length === 0) {
      this.isRefreshing = false
      this.lastReport = {
        startedAt,
        finishedAt: Date.now(),
        fetchedArticleCount: 0,
        timelineArticleCount: this.timeline.length,
        duplicateCount: 0,
        clusteredArticleCount: 0,
        sourceStates: sortStates(sourceStates),
        fetchDuration,
        processingDuration: 0,
        enrichmentDuration: null,
      }
      this.emit()
      return this.timeline
    }

    const processStart = Date.now()
    const composed = this.compose(collected, settings)
    this.publish(composed.articles, { touchTimestamp: true })
    const processingDuration = (Date.now() - processStart) / 1000

    this.isRefreshing = false
    this.lastReport = {
      startedAt,
      finishedAt: Date.now(),
      fetchedArticleCount: collected.length,
      timelineArticleCount: composed.articles.length,
      duplicateCount: composed.duplicateCount,
      clusteredArticleCount: 0,
      sourceStates: sortStates(sourceStates),
      fetchDuration,
      processingDuration,
      enrichmentDuration: null,
    }
    this.emit()

    await this.persistNow()
    // 预取正文与聚类都不阻塞可见时间线。
    this.prefetchBodies(composed.articles, settings, generation)
    this.enrich(composed.articles, settings, generation)
    return this.timeline
  }

  /** 去重 → 按发布时间倒序 → 截断到上限。 */
  compose(collected: NewsArticle[], settings: NewsSettings) {
    const { articles, removed } = dedupe(collected)
    articles.sort((a, b) => b.publishedAt - a.publishedAt)
    return { articles: articles.slice(0, settings.timelineLimit), duplicateCount: removed }
  }

  publish(articles: NewsArticle[], { touchTimestamp }: { touchTimestamp: boolean }) {
    this.timeline = articles
    if (touchTimestamp) this.lastUpdated = Date.now()
    this.emit()
    this.schedulePersist()
  }

  /** 异步聚类：完成后整体替换，用代际号校验避免过期结果覆盖新的。 */
  async enrich(articles: NewsArticle[], settings: NewsSettings, generation: number) {
    if (!settings.clustering || articles.length <= 1) return
    const began = Date.now()
    await Promise.resolve()
    const { articles: clustered, clusteredCount } = cluster(articles)
    if (generation !== this.generation) return
    this.timeline = clustered
    this.emit()
    if (this.lastReport) {
      this.lastReport = {
        ...this.lastReport,
        finishedAt: Date.now(),
        clusteredArticleCount: clusteredCount,
        enrichmentDuration: (Date.now() - began) / 1000,
      }
    }
    this.emit()
    await this.persistNow()
  }

  /** 刷新后取 top-N 未缓存文章预取正文；feed 自带正文优先，不足 200 字符则抓页抽取。 */
  async prefetchBodies(articles: NewsArticle[], settings: NewsSettings, generation: number) {
    if (!settings.prefetch || settings.prefetchCount <= 0) return
    const targets = articles.slice(0, settings.prefetchCount)
    for (const article of targets) {
      if (generation !== this.generation) return
      if (!article.url) continue
      const cached = await this.store.readContent(article.url)
      if (cached) continue
      let text = article.contentHTML ? extract(article.contentHTML) : ''
      if (text.length < 200) {
        const page = await httpGet(article.url, { maxBytes: PAGE_MAX_BYTES })
        if (page.ok) text = extract(page.body)
      }
      if (text) await this.store.writeContent(article.url, text)
    }
  }

  // MARK: 快照落盘（写节流 15s；刷新完成/退出时强制写）

  schedulePersist() {
    const now = Date.now()
    if (now - this.lastPersistAt >= SNAPSHOT_THROTTLE_MS) {
      this.persistNow()
      return
    }
    if (this.pendingPersist) return
    this.pendingPersist = true
    setTimeout(
      () => {
        this.pendingPersist = false
        this.persistNow()
      },
      SNAPSHOT_THROTTLE_MS - (now - this.lastPersistAt),
    )
  }

  async persistNow() {
    this.lastPersistAt = Date.now()
    if (this.timeline.length === 0) return
    await this.store.persistSnapshot(this.timeline)
  }

  // MARK: 检索（news_search 工具用；与 UI 的投影过滤**刻意不同**——原生这里不匹配 author）

  /**
   * 时间线检索。时间线为空时退回磁盘快照；有 query 且配了 News API Key 时并入全网检索结果再去重。
   * @returns {Promise<Array>} 按发布时间倒序、截到 limit 的文章
   */
  async search({
    query = '',
    topic = null,
    limit = 15,
  }: {
    query?: string
    topic?: string | null
    limit?: number
  } = {}): Promise<NewsArticle[]> {
    const q = String(query || '')
      .trim()
      .toLowerCase()
    let pool = this.timeline
    if (pool.length === 0) {
      const snapshot = await this.store.loadSnapshot()
      pool = snapshot ? snapshot.articles : []
    }

    const settings = this.store.settings
    const apiKey = String(settings.newsAPIKey || '').trim()
    if (q && apiKey) {
      const hits = await fetchNewsAPI({ endpoint: query }, { apiKey, language: settings.searchLanguage, limit })
      if (hits.articles.length > 0) pool = dedupe([...hits.articles, ...pool]).articles
    }

    let filtered = pool
    if (topic) filtered = filtered.filter((article) => article.topic === topic)
    if (q) {
      filtered = filtered.filter(
        (article) =>
          (article.title || '').toLowerCase().includes(q) ||
          (article.summary || '').toLowerCase().includes(q) ||
          (article.sourceName || '').toLowerCase().includes(q),
      )
    }
    return [...filtered].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, limit)
  }

  /** 按稳定键找一篇（时间线优先，退磁盘快照）。 */
  async article(id: string): Promise<NewsArticle | null> {
    const hit = this.timeline.find((article) => article.id === id)
    if (hit) return hit
    const snapshot = await this.store.loadSnapshot()
    return snapshot ? snapshot.articles.find((article) => article.id === id) || null : null
  }

  /** 按 URL 找一篇（归一后比较；时间线优先，退磁盘快照）。 */
  async articleByURL(url: string): Promise<NewsArticle | null> {
    const normalized = normalizeURL(url)
    const match = (rows: NewsArticle[]) => rows.find((article) => normalizeURL(article.url) === normalized)
    const hit = match(this.timeline)
    if (hit) return hit
    const snapshot = await this.store.loadSnapshot()
    return snapshot ? match(snapshot.articles) || null : null
  }

  // MARK: 诊断辅助

  get successfulSourceCount() {
    if (this.lastReport) return this.lastReport.sourceStates.filter((row) => row.status === 'success').length
    return new Set(this.timeline.map((article) => article.sourceID).filter(Boolean)).size
  }

  get unsuccessfulSourceCount() {
    if (!this.lastReport) return 0
    return this.lastReport.sourceStates.filter((row) => row.status !== 'success').length
  }

  /**
   * 本轮刷新的**整体阻断原因**，供状态条与空态如实说明「为什么没有新闻」。
   *
   * 只在**一个来源都没成功**时才成立 —— 部分源失败是既有的「部分来源需要检查」态，不该升级成
   * 「没有网络权限」。返回：
   *  · `'permission'` 用户没授权网络（宿主回 `aibox/denied: user declined…`）——用户自己能修；
   *  · `'blocked'`    域名不在 manifest 的 networkAllowed 里 —— 应用的声明缺口；
   *  · `'offline'`    全部超时 / 连不上 —— 网络本身的问题；
   *  · `null`         没有整体性阻断（照旧走原来的四态）。
   */
  get blockedReason(): import('../types.js').BlockedReason | null {
    const report = this.lastReport
    if (!report) return null
    const states = report.sourceStates
    if (states.length === 0) return null
    if (states.some((row) => row.status === 'success')) return null
    const failures = states.map((row) => row.failure)
    if (failures.some((row) => row === FAILURE.permission)) return 'permission'
    if (failures.some((row) => row === FAILURE.blocked)) return 'blocked'
    if (failures.every((row) => row === FAILURE.network || row === FAILURE.timeout)) return 'offline'
    return null
  }
}

function sortStates(states: SourceRefreshState[]) {
  return [...states].sort((a, b) => String(a.sourceName).localeCompare(String(b.sourceName)))
}

/** 有界并发的 map（Promise.all 会把 48 个源一次全丢给串行的桥）。 */
async function mapWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0
  const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      const item = items[index]
      if (item !== undefined) await worker(item, index)
    }
  })
  await Promise.all(runners)
}

/** 单源下钻：实时拉取，不进主时间线、不缓存，一次 40 条。 */
export async function fetchSingleSource(
  feed: FeedReference,
  settings: NewsSettings,
): Promise<{ articles: NewsArticle[]; failure: FetchFailure | null }> {
  const result = await fetchFeed(feed, settings, Date.now())
  const sorted = [...result.articles].sort((a, b) => b.publishedAt - a.publishedAt)
  return { articles: sorted, failure: result.failure }
}
