export type DownloadJobState =
  | 'queued'
  | 'running'
  | 'downloading'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'unknown'

export interface DownloadJob {
  jobId: string
  state: DownloadJobState | string
  fraction?: number
  title: string
  outputName?: string
  source?: string
}

export interface DownloadDetail {
  received: number
  total: number
  speed: number
  known: boolean
  artifactRef?: string
}

export interface DownloadQueueItem {
  artifactRef?: string
  bytesReceived: number
  groupId?: string
  speed?: number
  state: string
  taskId: string
  totalBytes?: number
}

export interface ToolCallResult<T = unknown> {
  ok: boolean
  text: string
  error?: string
  details?: T
}

export interface ToolBlockVerdict {
  ok: boolean
  reason?: string | null
  hint: string
}

export interface VideoFormat {
  id: string
  qualityLabel?: string
  codecs?: string
  filesizeText?: string
  needsMerge?: boolean
  container?: string
  proto?: string
}

export interface VideoInspection {
  title?: string
  uploader?: string
  durationText?: string
  thumbnailURL?: string
  extractor?: string
  subtitles?: string[]
}

export interface VideoInspectDetails extends VideoInspection {
  type: 'video_inspect'
  formats?: VideoFormat[]
}

export interface InspectResult {
  ok: boolean
  text: string
  error?: string
  video?: VideoInspection | null
  formats?: VideoFormat[]
}

export interface FetchRequest {
  url: string
  formatId?: string
  audioOnly?: boolean
}

export interface FetchResult {
  ok: boolean
  text: string
  error?: string
  jobId?: string
}

export type LibraryActionName = 'list' | 'status' | 'pause' | 'resume' | 'cancel' | 'retry' | 'play' | 'export'

export interface LibraryRequest {
  action?: LibraryActionName
  jobId?: string
}

export interface LibraryResult {
  ok: boolean
  action: string
  denied?: boolean
  jobs: DownloadJob[]
  text: string
  error?: string
}
