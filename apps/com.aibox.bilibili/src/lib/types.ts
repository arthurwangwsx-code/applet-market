/** Bilibili 小应用的稳定领域模型；接口原始字段只允许停留在 api.ts。 */

export interface VideoSummary {
  bvid: string
  aid: number
  cid: number
  title: string
  cover: string
  author: string
  mid: number
  duration: number
  play: number
  danmaku: number
  pubdate: number
}

export interface VideoPart {
  cid: number
  page: number
  title: string
  duration: number
}

export interface VideoDetail extends VideoSummary {
  desc: string
  like: number
  coin: number
  favorite: number
  share: number
  reply: number
  avatar: string
  pages: VideoPart[]
}

export interface BangumiSummary {
  title: string
  cover: string
  url: string
  desc: string
}

export interface UserSummary {
  mid: number
  name: string
  avatar: string
  fans: number
  videos: number
}

export interface SearchResult {
  videos: VideoSummary[]
  bangumi: BangumiSummary[]
  users: UserSummary[]
}

export interface AcceptedQuality {
  label: string
  qn: number
}

export interface PlayStream {
  url: string
  backup: string[]
  quality: number
  format: string
  duration: number
  accepted: AcceptedQuality[]
}

export interface PlaybackSettings {
  backgroundAudio: boolean
  pictureInPicture: boolean
  gestureControls: boolean
}

export interface UserProfile {
  mid: number
  name: string
  avatar: string
  level: number
  coins: number
}

export interface LoginQRCode {
  url: string
  key: string
}

export interface LoginPollResult {
  status: 'pending' | 'scanned' | 'expired' | 'ok'
  message: string
}

export interface VideoReadiness {
  ok: boolean
  reason: 'ok' | 'noBridge' | 'noEngine'
  resolve: boolean
  dash: boolean
  error?: string
}

export interface VideoProgress {
  currentTime: number
  duration: number
  mine: boolean
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'failed'
  queueCount: number
  queueIndex: number
  title?: string
  url?: string
  error?: string
}

export interface AppletRequestError extends Error {
  permission?: boolean
  retryable?: boolean
  code?: number
}

export interface VideoRoute {
  bvid: string
  title?: string
}

export type WatchProgress = Record<string, number>

export type SearchRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'video'; id: string; video: VideoSummary }
  | { kind: 'bangumi'; id: string; item: BangumiSummary }
  | { kind: 'user'; id: string; item: UserSummary }

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
