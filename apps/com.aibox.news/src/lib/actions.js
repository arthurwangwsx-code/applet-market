// 对外提供的 AI 工具 —— 对应原生 NewsPluginKit 的 4 个 AgentTool：
//   news_search / news_read / news_source / news_save
//
// 机制：manifest 的 `actions[]` 声明（headless + visibility 含 agent）→ 宿主投影成**延迟工具**
// （不进常驻 tools 数组，AI 经 tool_search / describe / call 发现与调用）→ 回到本页面执行。
//
// 纪律：处理函数**只依赖 lib/ 的纯逻辑与 session 单例**，不碰任何 React 状态 ——
// 无头 WebView 里没有界面，任何对组件挂载的依赖都会让 AI 调用直接失败。
// 每个函数先 `await whenReady()`，保证磁盘数据已装载。

import { getSession, whenReady } from './session.js'
import { fetchRSS, fetchRSSHub } from './providers.js'
import { resolveContent } from './reading.js'
import { normalizeURL, stableKey } from './text.js'
import { shortStamp } from './format.js'
import { TOPICS, FEED_KINDS } from './catalog.js'

export const READ_EXCERPT_LIMIT = 6000
const SEARCH_DEFAULT_LIMIT = 15
const SAVED_LIST_LIMIT = 30

function normalizeTopic(raw) {
  const value = String(raw || '').trim().toLowerCase()
  return TOPICS.includes(value) ? value : null
}

function normalizeKind(raw) {
  const value = String(raw || '').trim().toLowerCase()
  return FEED_KINDS.includes(value) ? value : null
}

/** 结果里的一篇文章（对齐原生 NewsArticleLite 的字段集）。 */
function lite(article) {
  return {
    id: article.id,
    title: article.title,
    url: article.url,
    source: article.sourceName || '',
    topic: article.topic || 'top',
    image: article.imageURL || '',
    time: article.publishedAt ? shortStamp(article.publishedAt) : '',
    summary: article.summary || '',
  }
}

/** 按 clusterID 归并成事件组（保序，组内按时间倒序，lead 取最新）。 */
function clusterGroups(articles) {
  const order = []
  const buckets = new Map()
  for (const article of articles) {
    const key = article.clusterID || article.id
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key) }
    buckets.get(key).push(article)
  }
  return order.map((key) => {
    const members = [...buckets.get(key)].sort((a, b) => b.publishedAt - a.publishedAt)
    return { lead: lite(members[0]), others: members.slice(1).map(lite) }
  })
}

// MARK: - news_search

export async function search(input = {}) {
  const { agg } = await whenReady()
  const query = String(input.query || '')
  const topic = normalizeTopic(input.topic)
  const useClusters = input.cluster === true
  const limit = Math.min(Math.max(Number(input.limit) || SEARCH_DEFAULT_LIMIT, 1), 30)

  // 时间线空则先刷一遍（TTL 内会直接返回缓存）。
  if (agg.timeline.length === 0) await agg.refresh({ force: false })

  const results = await agg.search({ query, topic, limit })
  if (results.length === 0) {
    return {
      ok: true,
      query,
      count: 0,
      items: [],
      text: 'No news found. Pull to refresh sources, add subscriptions with the source action, or try another query.',
    }
  }

  const header = query ? `News for "${query}":` : 'Latest headlines:'
  if (useClusters) {
    const groups = clusterGroups(results).slice(0, limit)
    const lines = [header, ...groups.map((group) => {
      const extra = group.others.length > 0 ? ` (+${group.others.length} more reports)` : ''
      return `• [${group.lead.source} · ${group.lead.time}] ${group.lead.title}${extra}\n  ${group.lead.url}`
    })]
    return { ok: true, query, count: groups.length, items: results.map(lite), clusters: groups, text: lines.join('\n') }
  }

  const lines = [header, ...results.map((article) => (
    `• [${article.sourceName} · ${shortStamp(article.publishedAt)}] ${article.title}\n  ${article.url}`
  ))]
  return { ok: true, query, count: results.length, items: results.map(lite), text: lines.join('\n') }
}

// MARK: - news_read

export async function read(input = {}) {
  const { agg, store } = await whenReady()
  let url = String(input.url || '').trim()
  const id = String(input.id || '').trim()
  if (!url && id) {
    const hit = await agg.article(id)
    if (hit) url = hit.url
  }
  if (!url) {
    return { ok: false, error: 'Set "url" to an article link (or "id" from a search result).' }
  }

  const article = await agg.articleByURL(url)
    || (await agg.article(stableKey(url, '', ''))) // 归一 URL 的稳定键也试一次
  const source = article || { url, title: url, summary: '', contentHTML: null, sourceName: '', topic: 'top', publishedAt: 0, imageURL: null, id: '' }
  const text = await resolveContent(source, store, { allowNetwork: true })
  const excerpt = String(text || '').slice(0, READ_EXCERPT_LIMIT)

  const head = article ? `${article.title} — ${article.sourceName}\n\n` : ''
  return {
    ok: true,
    article: article ? lite(article) : { id: '', title: url, url, source: '', topic: 'top', image: '', time: '', summary: '' },
    excerpt,
    text: head + (excerpt || '(No extractable text — open the original article.)'),
  }
}

// MARK: - news_source

export async function source(input = {}) {
  const { store } = await whenReady()
  const action = String(input.action || 'list').toLowerCase()

  if (action === 'add') {
    const endpoint = String(input.url || '').trim()
    if (!endpoint) {
      return { ok: false, error: 'Set "url" to an RSS URL or an RSSHub route like "/zhihu/hotlist".' }
    }
    // 显式 kind 优先；没给就按「/ 开头 = rsshub」推断（与原生 news_source 一致）。
    const explicit = normalizeKind(input.kind)
    const kind = explicit || (endpoint.startsWith('/') ? 'rsshub' : 'rss')
    const topic = normalizeTopic(input.topic) || 'top'
    const title = String(input.title || '').trim() || endpoint
    const feed = await store.addFeed({ title, endpoint, kind, topic, explicitKind: true })
    return { ok: true, action, feeds: feedList(store), text: `Subscribed: ${feed.title} [${kind}].` }
  }

  if (action === 'remove') {
    const selector = String(input.title || input.url || '').trim()
    if (!selector) return { ok: false, error: 'Set "title" or "url" of the source to remove.' }
    const match = store.feeds.find((feed) => feed.title === selector || feed.endpoint === selector)
    if (!match) return { ok: false, error: `No matching subscription for "${selector}".` }
    await store.removeFeed(match.id)
    return { ok: true, action, feeds: feedList(store), text: `Removed subscription: ${match.title}.` }
  }

  if (action === 'test') {
    const endpoint = String(input.url || '').trim()
    if (!endpoint) return { ok: false, error: 'Set "url" (RSS URL or RSSHub route) to test.' }
    const kind = endpoint.startsWith('/') ? 'rsshub' : 'rss'
    const probe = { id: 'test', title: 'test', endpoint, kind, topic: 'top' }
    const result = kind === 'rsshub'
      ? await fetchRSSHub(probe, { instance: store.settings.rsshubInstance, limit: 5 })
      : await fetchRSS(probe, { limit: 5 })
    if (result.articles.length === 0) {
      return {
        ok: false,
        action,
        error: `Test failed — no articles from ${endpoint}. Check the URL/route, the RSSHub instance, `
          + 'or whether the host is inside this applet\'s network allowlist.',
      }
    }
    return {
      ok: true,
      action,
      count: result.articles.length,
      sample: result.articles[0].title,
      text: `OK — ${result.articles.length}+ articles from ${endpoint}. e.g. ${result.articles[0].title}`,
    }
  }

  const feeds = feedList(store)
  const lines = [`Subscriptions (${feeds.length}):`, ...feeds.map(
    (feed) => `• ${feed.title} [${feed.kind}/${feed.topic}] ${feed.enabled ? 'on' : 'off'}`,
  )]
  return { ok: true, action: 'list', feeds, text: lines.join('\n') }
}

function feedList(store) {
  return store.feeds.map((feed) => ({
    title: feed.title,
    endpoint: feed.endpoint,
    kind: feed.kind,
    topic: feed.topic,
    enabled: feed.enabled,
  }))
}

// MARK: - news_save

export async function save(input = {}) {
  const { store, agg } = await whenReady()
  const action = String(input.action || 'list').toLowerCase()

  if (action === 'save') {
    const article = await resolveArticle(agg, input)
    if (!article) {
      return { ok: false, error: 'Article not found — search or read it first, then save by url/id.' }
    }
    await store.save(article)
    return { ok: true, action, articles: savedList(store), text: `Saved: ${article.title}` }
  }

  if (action === 'unsave') {
    let id = String(input.id || '').trim()
    if (!id) {
      const article = await resolveArticle(agg, input)
      if (article) id = article.id
    }
    if (!id || !store.savedKeys.has(id)) {
      return { ok: false, error: 'Set "id" or "url" of a saved article to remove.' }
    }
    await store.unsave(id)
    return { ok: true, action, articles: savedList(store), text: 'Removed from read-later.' }
  }

  const saved = savedList(store)
  if (saved.length === 0) return { ok: true, action: 'list', articles: [], text: 'Read-later list is empty.' }
  const lines = [`Saved articles (${saved.length}):`, ...saved.map(
    (row) => `• [${row.source}] ${row.title}\n  ${row.url}`,
  )]
  return { ok: true, action: 'list', articles: saved, text: lines.join('\n') }
}

function savedList(store) {
  return [...store.saved]
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, SAVED_LIST_LIMIT)
    .map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      source: row.sourceName || '',
      topic: row.topic || 'top',
      image: row.imageURL || '',
      time: row.publishedAt ? shortStamp(row.publishedAt) : '',
      summary: row.summary || '',
    }))
}

async function resolveArticle(agg, input) {
  const id = String(input.id || '').trim()
  if (id) {
    const hit = await agg.article(id)
    if (hit) return hit
  }
  const url = String(input.url || '').trim()
  if (url) {
    const hit = await agg.articleByURL(url)
    if (hit) return hit
    const byKey = await agg.article(stableKey(url, '', ''))
    if (byKey) return byKey
    // 收藏列表里已有的也算命中（AI 可能拿的是 news_save list 回来的条目）。
    const normalized = normalizeURL(url)
    const saved = agg.store.saved.find((row) => normalizeURL(row.url) === normalized)
    if (saved) {
      return {
        id: saved.id,
        title: saved.title,
        url: saved.url,
        summary: saved.summary,
        contentHTML: null,
        author: saved.author || '',
        sourceID: '',
        sourceName: saved.sourceName,
        topic: saved.topic,
        imageURL: saved.imageURL || null,
        publishedAt: saved.publishedAt,
        fetchedAt: saved.savedAt,
        clusterID: null,
      }
    }
  }
  return null
}

// MARK: - 注册

/**
 * 把动作注册到桥上。**在模块求值期调用**（不是 React 副作用）——
 * 无头执行时页面不会挂载任何组件，注册必须先于 React。
 */
export function registerActions() {
  const api = typeof window !== 'undefined' ? window.aibox : undefined
  if (!api || !api.action || typeof api.action.register !== 'function') return false
  api.action.register('search', search)
  api.action.register('read', read)
  api.action.register('source', source)
  api.action.register('save', save)
  api.action.register('toggleBroadcast', async () => {
    const session = await whenReady()
    if (session.broadcast.active) session.broadcast.stop({ userInitiated: true })
    else session.broadcast.start(session.visibleArticles)
    return { ok: true, active: session.broadcast.active }
  })
  return true
}

export { getSession, whenReady }
