// 领域类型 —— 对齐 VoiceMemosDomain 的值类型（规格 §14）。日期一律存 epoch 毫秒。

/** 一条录音来自哪里。两个来源的能力档位不同，UI 必须按来源分档渲染入口。 */
export type MemoSource =
  /** 宿主录音库（`aibox.voiceMemos.*`）—— 有转写与全部 AI 能力，但拿不到音频字节与播放位置。 */
  | 'library'
  /** 应用内录音（`aibox.audio.*`）—— 有音频字节、精确播放与波形，但**没有转写路径**。 */
  | 'local'

export type TranscriptStatus = 'none' | 'pending' | 'inProgress' | 'completed' | 'failed'

/** 列表行 / 详情页共用的录音视图模型。 */
export interface Memo {
  id: string
  source: MemoSource
  title: string
  /** 秒。 */
  duration: number
  createdAt: number
  isFavourite: boolean
  hasTranscript: boolean
  hasAudio: boolean
  isAudioProtected: boolean
  folder?: string
  /** 仅 `local`：applet 资源 URL，可直接 `<audio src>`。 */
  url?: string
  /** 仅 `local`：applet 资源句柄。 */
  handle?: string
  /** 搜索命中时的行内摘录。 */
  snippet?: string
}

export interface MemoTranscript {
  status: TranscriptStatus
  fullText: string
  locale: string
  isEdited: boolean
  segmentCount: number
}

/** 摘要模板（规格 §4.8 的 6 个）。 */
export type SummaryTemplate = 'general' | 'meeting' | 'interview' | 'oneOnOne' | 'lecture' | 'podcast'

export type ActionItemKind = 'task' | 'decision' | 'commitment'

export interface ActionItem {
  id: string
  text: string
  kind: ActionItemKind
  isDone: boolean
  owner?: string
  dueHint?: string
  /** 整秒。 */
  sourceTime?: number
}

export interface Chapter {
  title: string
  /** 整秒。 */
  start: number
}

/** 校正后的一段发言。 */
export interface CorrectionTurn {
  speaker: string
  colorIndex: number
  text: string
}

/** 说话人模式（规格 §4.9）。 */
export type SpeakerMode = 'none' | 'auto' | 'named'

/** AI 产物的生成状态。`ready` 只会变 `stale`，`none` 不变 —— 这就是「自动补空、不覆盖」的机制。 */
export type ArtifactStatus = 'none' | 'generating' | 'ready' | 'stale' | 'failed'

/** 每条录音的 applet 侧衍生数据（宿主没有工具投影的那几样，见规格 §17.2 缺口⑫）。 */
export interface MemoArtifacts {
  memoID: string
  summaryText: string
  summaryPoints: string[]
  summaryTemplate: SummaryTemplate
  summaryStatus: ArtifactStatus
  correctionTurns: CorrectionTurn[]
  correctionStatus: ArtifactStatus
  correctionMode: SpeakerMode
  correctionSpeakers: string[]
  translationText: string
  translationLang: string
  translationBilingual: boolean
  translationStatus: ArtifactStatus
  chapters: Chapter[]
  actionItems: ActionItem[]
  /** 生成这批产物时用的转写全文哈希 —— 转写变了就把 `ready` 降成 `stale`。 */
  sourceHash: string
  updatedAt: number
}

/** 应用内录音的元数据（落 `aibox.db`，音频落 applet 资源域）。 */
export interface LocalClip {
  id: string
  title: string
  createdAt: number
  durationMs: number
  handle: string
  url: string
  byteCount: number
  isFavourite: boolean
  isTrashed: boolean
  trashedAt: number | null
  interrupted: boolean
}

/** 应用设置（可实现的子集，见 §设置页）。 */
export interface Settings {
  transcribeLocale: 'auto' | 'zh_CN' | 'en_US'
  autoTranscribe: boolean
  autoSummarize: boolean
  defaultTemplate: SummaryTemplate
  quality: 'high' | 'medium' | 'low'
}

export const DEFAULT_SETTINGS: Settings = {
  transcribeLocale: 'auto',
  autoTranscribe: false,
  autoSummarize: false,
  defaultTemplate: 'general',
  quality: 'high',
}

/** 录音质量 → AAC 参数（规格 §9.1，逐条对齐）。声道恒为单声道。 */
export const QUALITY_PRESET: Record<Settings['quality'], { sampleRate: number; bitrate: number }> = {
  high: { sampleRate: 44_100, bitrate: 128_000 },
  medium: { sampleRate: 32_000, bitrate: 96_000 },
  low: { sampleRate: 22_050, bitrate: 64_000 },
}

/** 筛选器（规格 §2.3 的 5 段）。 */
export interface MemoFilter {
  duration: 'any' | 'under1m' | '1to5m' | 'over5m'
  date: 'all' | 'today' | 'week' | 'month' | 'year'
  sort: 'newest' | 'oldest' | 'longest' | 'shortest' | 'name'
  favOnly: boolean
  withTranscript: boolean
  source: 'all' | MemoSource
}

export const DEFAULT_FILTER: MemoFilter = {
  duration: 'any',
  date: 'all',
  sort: 'newest',
  favOnly: false,
  withTranscript: false,
  source: 'all',
}

/** `isActive` = 任一收窄条件生效（**排序不算**）—— 决定筛选图标是否填充。 */
export function filterIsActive(filter: MemoFilter): boolean {
  return filter.duration !== 'any'
    || filter.date !== 'all'
    || filter.favOnly
    || filter.withTranscript
    || filter.source !== 'all'
}
