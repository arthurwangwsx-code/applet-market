export type DownloadState = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
export type DownloadFilterState = DownloadState | 'active' | 'finished'
export type DownloadControlAction = 'pause' | 'resume' | 'cancel' | 'remove' | 'clearFinished'
export type DownloadDestination = 'sandbox' | 'iCloud' | 'externalFiles' | 'vault'
export type DownloadPriority = 'high' | 'normal' | 'low'

export interface DownloadTask {
  taskId: string
  url: string
  filename: string
  state: DownloadState
  bytesReceived?: number
  totalBytes?: number
  fraction?: number
  speed?: number
  eta?: number
  artifactRef?: string
  outputPath?: string
  error?: string
}

export interface DownloadRequest {
  url: string
  filename?: string
  destination?: { kind: DownloadDestination; path: string }
  priority?: DownloadPriority
  groupId?: string
}

export interface AddDownloadsInput {
  urls: string | string[]
  filename?: string
  destination?: DownloadDestination
  folder?: string
  priority?: DownloadPriority
}

export interface AddDownloadsResult {
  ok: boolean
  error?: string
  count?: number
  tasks?: Array<Pick<DownloadTask, 'taskId' | 'url' | 'filename' | 'artifactRef'>>
  text: string
}

export interface NoticeState {
  tone: 'success' | 'error'
  text: string
}
