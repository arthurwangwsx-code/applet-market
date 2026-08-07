// 三个数据源 Provider 的移植：RSS/Atom（原样 GET）、RSSHub（实例基址 + 路由 + limit）、
// NewsAPI（NewsData.io JSON）。统一返回 `{ articles, failure, httpStatus }`，失败不抛。

import { FAILURE, FEED_MAX_BYTES, httpGet } from './host.js'
import { parseFeed } from './feedParser.js'
import { plain, stableKey } from './text.js'
import { parseDate } from './dates.js'

import type { FeedFetchResult, FeedReference, NewsArticle, NewsFeed, NewsSettings, NewsTopic } from '../types.js'

export const RSSHUB_DEFAULT_INSTANCE = 'https://rsshub.app'
export const FEED_LIMIT = 40
export const API_LIMIT = 20

const success = (articles: NewsArticle[]): FeedFetchResult => ({ articles, failure: null, httpStatus: null })
const failed = (failure: FeedFetchResult['failure'], httpStatus: number | null = null): FeedFetchResult => ({
  articles: [],
  failure,
  httpStatus,
})

function refOf(feed: FeedReference) {
  return { sourceID: feed.id, sourceName: feed.title, topic: feed.topic }
}

/** 原生 RSS / Atom：完整 URL 原样 GET，一次 40 条。 */
export async function fetchRSS(
  feed: FeedReference,
  { now = Date.now(), limit = FEED_LIMIT }: { now?: number; limit?: number } = {},
): Promise<FeedFetchResult> {
  const response = await httpGet(feed.endpoint, { maxBytes: FEED_MAX_BYTES })
  if (!response.ok) return failed(response.failure || FAILURE.unknown, response.httpStatus)
  return success(parseFeed(response.body, refOf(feed), now).slice(0, limit))
}

function trimTrailingSlash(text: string) {
  let out = String(text || '')
  while (out.endsWith('/')) out = out.slice(0, -1)
  return out
}

/** RSSHub：`trimSlash(instance) + route + ("?"|"&") + limit=40`。 */
export async function fetchRSSHub(
  feed: FeedReference,
  { instance, now = Date.now(), limit = FEED_LIMIT }: { instance?: string; now?: number; limit?: number } = {},
): Promise<FeedFetchResult> {
  const base = trimTrailingSlash(instance || RSSHUB_DEFAULT_INSTANCE)
  const route = feed.endpoint.startsWith('/') ? feed.endpoint : `/${feed.endpoint}`
  const separator = feed.endpoint.includes('?') ? '&' : '?'
  const url = `${base}${route}${separator}limit=${limit}`
  const response = await httpGet(url, { maxBytes: FEED_MAX_BYTES })
  if (!response.ok) return failed(response.failure || FAILURE.unknown, response.httpStatus)
  return success(parseFeed(response.body, refOf(feed), now).slice(0, limit))
}

/** NewsData.io 分类 → 本地主题。 */
export function mapAPITopic(category: unknown): NewsTopic {
  switch (String(category || '').toLowerCase()) {
    case 'world':
      return 'world'
    case 'politics':
    case 'top':
      return 'top'
    case 'technology':
      return 'tech'
    case 'business':
      return 'business'
    case 'science':
    case 'environment':
      return 'science'
    case 'sports':
      return 'sports'
    case 'health':
    case 'food':
      return 'health'
    case 'entertainment':
      return 'culture'
    default:
      return 'top'
  }
}

/** News API（NewsData.io latest）：apiKey + 关键词 + 语言，一次 20 条。 */
export async function fetchNewsAPI(
  feed: Pick<NewsFeed, 'endpoint'>,
  {
    apiKey,
    language = 'zh',
    now = Date.now(),
    limit = API_LIMIT,
  }: { apiKey?: string; language?: string; now?: number; limit?: number } = {},
): Promise<FeedFetchResult> {
  const key = String(apiKey || '').trim()
  if (!key) return failed(FAILURE.configuration)

  const params = new URLSearchParams()
  params.set('apikey', key)
  const query = String(feed.endpoint || '').trim()
  if (query) params.set('q', query)
  if (language) params.set('language', language)
  const url = `https://newsdata.io/api/1/latest?${params.toString()}`

  const response = await httpGet(url, { maxBytes: FEED_MAX_BYTES })
  if (!response.ok) return failed(response.failure || FAILURE.unknown, response.httpStatus)

  let payload: unknown
  try {
    payload = JSON.parse(response.body)
  } catch (error) {
    return failed(FAILURE.decoding)
  }
  if (!payload || typeof payload !== 'object' || !('results' in payload) || !Array.isArray(payload.results))
    return failed(FAILURE.decoding)

  const articles: NewsArticle[] = []
  for (const row of payload.results.slice(0, limit)) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const title = String(item.title || '').trim()
    const link = String(item.link || '')
    if (!title || !link) continue
    const description = String(item.description || item.content || '')
    const src = String(item.source_id || item.source_name || 'news api')
    const category = Array.isArray(item.category) ? item.category[0] : 'top'
    const parsed = parseDate(String(item.pubDate || ''))
    const guid = String(item.article_id || '')
    const author = Array.isArray(item.creator) ? String(item.creator[0] || '') : ''
    articles.push({
      id: stableKey(link, guid, title),
      title,
      url: link,
      summary: plain(description).slice(0, 400),
      contentHTML: null,
      author,
      sourceID: `api:${src}`,
      sourceName: src,
      topic: mapAPITopic(category),
      imageURL: typeof item.image_url === 'string' ? item.image_url : null,
      publishedAt: parsed ? parsed.getTime() : now,
      fetchedAt: now,
      clusterID: null,
    })
  }
  return success(articles)
}

/** 按 kind 分发。`settings` 提供 RSSHub 实例、API Key 与检索语言。 */
export async function fetchFeed(
  feed: FeedReference,
  settings: NewsSettings,
  now = Date.now(),
): Promise<FeedFetchResult> {
  switch (feed.kind) {
    case 'rsshub':
      return fetchRSSHub(feed, { instance: settings.rsshubInstance, now })
    case 'api':
      return fetchNewsAPI(feed, { apiKey: settings.newsAPIKey, language: settings.searchLanguage, now })
    case 'rss':
    case 'atom':
    default:
      return fetchRSS(feed, { now })
  }
}
