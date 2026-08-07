/** YouTube 小应用自己的领域模型；不把不稳定的 InnerTube 原始响应泄漏到 UI。 */

export interface YouTubeLocale {
  hl?: string
  gl?: string
}

export interface VideoSummary {
  id: string
  title: string
  author: string
  cover: string
  durationLabel: string
  duration: number
  viewLabel: string
  published: string
  url: string
  /** 观看历史写入时间。搜索结果没有该字段。 */
  at?: number
}

export interface PlaybackSettings {
  backgroundAudio: boolean
  pictureInPicture: boolean
  gestureControls: boolean
}

export interface VideoRoute {
  video: VideoSummary
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

export interface VideoCapabilities {
  available: boolean
  resolve: boolean
  dash: boolean
  stage: boolean
  embeddedPlayer: boolean
  reason: 'ok' | 'noBridge' | 'noEngine'
}

export interface AppletRequestError extends Error {
  permission?: boolean
  retryable?: boolean
}

export type WatchProgress = Record<string, number>

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
