import type { ReactNode } from 'react'

export const NEWS_TOPICS = [
  'top',
  'world',
  'china',
  'tech',
  'business',
  'science',
  'culture',
  'sports',
  'health',
  'general',
] as const
export type NewsTopic = (typeof NEWS_TOPICS)[number]
export type FeedKind = 'rss' | 'atom' | 'rsshub' | 'api'
export type OpenMode = 'auto' | 'reader' | 'web'
export type BrowserMode = 'system' | 'inApp' | 'external'

export interface NewsFeed {
  id: string
  title: string
  endpoint: string
  kind: FeedKind
  topic: NewsTopic
  enabled: boolean
  isBuiltin: boolean
  sortOrder: number
  lastFetched: number
}
export type FeedReference = Pick<NewsFeed, 'id' | 'title' | 'endpoint' | 'kind' | 'topic'>

export interface NewsArticle {
  id: string
  title: string
  url: string
  summary: string
  contentHTML: string | null
  author: string
  sourceID: string
  sourceName: string
  topic: NewsTopic
  imageURL: string | null
  publishedAt: number
  fetchedAt: number
  clusterID: string | null
}

export interface SavedArticle {
  id: string
  url: string
  title: string
  summary: string
  sourceName: string
  topic: NewsTopic
  imageURL: string
  author: string
  publishedAt: number
  savedAt: number
  fullText: string
}

export interface ReadHistoryEntry {
  articleKey: string
  readAt: number
  title: string
  url: string
  sourceName: string
  imageURL: string
  topic: NewsTopic
  publishedAt: number
}

export interface NewsSettings {
  openMode: OpenMode
  collapseClusters: boolean
  showRefreshStatus: boolean
  hideRead: boolean
  autoRefresh: boolean
  backgroundRefresh: boolean
  pauseInLowPower: boolean
  clustering: boolean
  prefetch: boolean
  prefetchCount: number
  timelineLimit: number
  cacheLimitMB: number
  rsshubInstance: string
  newsAPIKey: string
  searchLanguage: string
}

export interface ContentIndexEntry {
  bytes: number
  accessedAt: number
}

export interface TimelineSnapshot {
  articles: NewsArticle[]
  savedAt: number
}

export type FetchFailure =
  | 'configuration'
  | 'permission'
  | 'blocked'
  | 'invalidURL'
  | 'timeout'
  | 'network'
  | 'http'
  | 'responseTooLarge'
  | 'circuitOpen'
  | 'decoding'
  | 'cancelled'
  | 'unknown'

export interface FeedFetchResult {
  articles: NewsArticle[]
  failure: FetchFailure | null
  httpStatus: number | null
}

export type SourceRefreshStatus = 'failed' | 'success' | 'empty'
export type BlockedReason = 'permission' | 'blocked' | 'offline'
export interface SourceRefreshState {
  id: string
  sourceName: string
  status: SourceRefreshStatus
  itemCount: number
  duration: number
  refreshedAt: number
  failure: FetchFailure | null
  httpStatus: number | null
}

export interface RefreshReport {
  startedAt: number
  finishedAt: number
  fetchedArticleCount: number
  timelineArticleCount: number
  duplicateCount: number
  clusteredArticleCount: number
  sourceStates: SourceRefreshState[]
  fetchDuration: number
  processingDuration: number
  enrichmentDuration: number | null
}

export interface TimelineItem {
  id: string
  lead: NewsArticle
  related: NewsArticle[]
}

export type Translate = (key: string, ...args: Array<string | number>) => string
export type Unsubscribe = () => void

export type NewsRoute =
  | { name: 'settings' }
  | { name: 'addSource' }
  | { name: 'diagnostics' }
  | { name: 'cluster'; title: string; articles: NewsArticle[] }
  | { name: 'source'; feed: NewsFeed }

export interface AISession {
  identity: string
  seed: string | null
}

export interface AddFeedInput {
  title: string
  endpoint: string
  kind: FeedKind
  topic: NewsTopic
  explicitKind?: boolean
}

export interface NewsActions {
  navigate: (route: NewsRoute) => void
  back: () => void
  refresh: (force: boolean) => Promise<NewsArticle[]>
  setVisibleArticles: (articles: NewsArticle[]) => void
  fetchSource: (feed: FeedReference) => Promise<NewsArticle[]>
  openArticle: (article: NewsArticle) => Promise<boolean>
  openCluster: (item: TimelineItem) => void
  toggleSaved: (article: NewsArticle) => Promise<void>
  unsave: (id: string) => Promise<void>
  toggleRead: (article: NewsArticle) => Promise<void>
  removeHistory: (key: string) => Promise<void>
  analyze: (article: NewsArticle) => void
  askAI: (seed: string | null) => void
  listenFrom: (article: NewsArticle, sequence: NewsArticle[]) => void
  saveToKnowledgeBase: (article: NewsArticle) => Promise<void>
  updateSettings: (patch: Partial<NewsSettings>) => Promise<void>
  clearContentCache: () => Promise<void>
  addFeed: (input: AddFeedInput) => Promise<NewsFeed>
  removeFeed: (id: string) => Promise<void>
  setFeedEnabled: (id: string, enabled: boolean) => Promise<void>
  moveFeed: (id: string, direction: number) => Promise<void>
}

// 组件共享的领域上下文；模型类采用 type-only import，避免运行时循环依赖。
export interface NewsContext {
  t: Translate
  locale: import('./i18n/index.js').SupportedLocale
  now: number
  store: import('./lib/store.js').NewsStore
  agg: import('./lib/aggregator.js').NewsAggregator
  broadcast: import('./lib/broadcast.js').BroadcastController
  settings: NewsSettings
  storeVersion: number
  readVersion: number
  readKeys: Set<string>
  savedKeys: Set<string>
  query: string
  searchRendered: boolean
  hasAI: boolean
  hasTTS: boolean
  hasKnowledgeCapture: boolean
  speakingId: string | null
  actions: NewsActions
}

export interface ComponentWithChildren {
  children: ReactNode
}
