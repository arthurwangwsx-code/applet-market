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
  reason: 'ok' | 'noBridge' | 'noEngine' | 'noResolver'
  resolve: boolean
  dash: boolean
  error?: string
}

interface VideoAvailabilitySnapshot {
  available?: boolean
  resolve?: boolean
  dash?: boolean
}

/** 把宿主发现面折叠成这款应用真正需要的能力：能播且能解析 B 站页面。 */
export function classifyVideoReadiness(
  snapshot: VideoAvailabilitySnapshot | null,
  methods: { play: boolean; resolve: boolean },
): VideoReadiness {
  if (!snapshot) return { ok: false, reason: 'noBridge', resolve: false, dash: false }
  const available = snapshot.available === true && methods.play
  const resolve = snapshot.resolve === true && methods.resolve
  if (!available) return { ok: false, reason: 'noEngine', resolve, dash: snapshot.dash === true }
  if (!resolve) return { ok: false, reason: 'noResolver', resolve: false, dash: snapshot.dash === true }
  return { ok: true, reason: 'ok', resolve: true, dash: snapshot.dash === true }
}

/** 将桥的技术错误变成用户能执行的恢复动作，同时保留未知错误原文用于诊断。 */
export function playbackErrorMessage(error: unknown): string {
  const raw = errorMessage(error)
  if (/aibox\/(not-granted|denied)/.test(raw)) {
    return '还没有允许视频能力。点右上角「⋯」→「应用详情」→「能力」，允许视频能力后重试。'
  }
  if (/aibox\/unavailable.*(extractor|解析)|no media extractor|没有视频解析能力/i.test(raw)) {
    return '当前 AiBox 构建没有媒体解析模块，无法解析 B 站视频。请更新并重新安装 AiBox 本体。'
  }
  if (raw.startsWith('aibox/resolve-failed:')) {
    return `B 站视频解析失败：${raw.slice('aibox/resolve-failed:'.length).trim()}`
  }
  return raw
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
