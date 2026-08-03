// 两个录音来源的统一读写层。
//
// ## 为什么是两个来源，而不是一个
// 容器把这件事切成了两半，谁都不能单独顶替另一个（规格 §17.2）：
//
// | | 宿主录音库 `aibox.voiceMemos.*` | 应用内录音 `aibox.audio.*` |
// |---|---|---|
// | 起录 | 会**拉起宿主全屏录音页盖住小应用**（effect: presentation） | 无界面，页面自己画 |
// | 实时电平 | ❌ `recordStatus` 只回 `{isRecording,isPaused,elapsed}` | ✅ 120 个样本、20 Hz，已归一 |
// | 音频字节 | ❌ 够不到（不在 FileBox，也没有导出工具） | ✅ applet 资源 URL，可 `<audio>`/`decodeAudioData` |
// | 精确播放位置 | ❌ 只有 play/stop/seek，读不到当前位置 | ✅ `<audio>.currentTime` |
// | 转写 | ✅ Apple 语音识别 | ❌ **没有任何路径**（`memo_import` 只收沙箱绝对路径或工件 ref，
// |   |   |   applet 资源句柄两者都不是） |
// | AI（摘要/待办/章节/问答/整理） | ✅ 宿主工具 | 经转写才有意义，故同上 |
//
// 所以列表是**合并视图**、行上带来源角标，能力按来源分档渲染入口 ——
// 这正是容器纪律「能力缺席时不渲染入口」的直接后果，不是设计上的取巧。

import { normalizeError } from '@aibox/applet-sdk'
import { hashText, snippetOf } from './format'
import type {
  ActionItem, Chapter, LocalClip, Memo, MemoArtifacts, MemoTranscript, SummaryTemplate,
} from './types'

const api = () => (typeof window !== 'undefined' ? window.aibox : undefined)

export const capabilities = {
  get library() { return Boolean(api()?.voiceMemos) },
  get recorder() { return Boolean(api()?.audio) },
  get ai() { return Boolean(api()?.ai) },
  get share() { return Boolean(api()?.share) },
  get shareFile() { return typeof api()?.share?.file === 'function' },
  get clipboard() { return Boolean(api()?.clipboard) },
  get ui() { return Boolean(api()?.ui) },
  get haptics() { return Boolean(api()?.haptics) },
}

export interface CallResult {
  ok: boolean
  text: string
  json: unknown
  error: string | null
}

/**
 * 调一个 `aibox.voiceMemos.<method>`。统一回 `{ok, text, json, error}`：
 * 多数 memo 工具把 JSON 直接放进 `text`，不走 `details`。失败不抛，让 UI 靠 `error` 分类空态。
 */
export async function memoCall(method: string, args: Record<string, unknown> = {}): Promise<CallResult> {
  const bridge = api()
  const namespace = bridge?.voiceMemos as unknown as Record<string, (input: unknown) => Promise<aibox.ToolEnvelope>> | undefined
  if (!namespace || typeof namespace[method] !== 'function') {
    return { ok: false, text: '', json: null, error: 'aibox/voicememos-unavailable' }
  }
  try {
    const raw = await namespace[method](args)
    const text = String(raw?.text ?? '')
    const ok = !(raw?.ok === false || raw?.isError === true)
    return { ok, text, json: parseJSON(text), error: ok ? null : text }
  } catch (error) {
    return { ok: false, text: '', json: null, error: normalizeError(error).message }
  }
}

export function parseJSON(text: string): unknown {
  const trimmed = String(text ?? '').trim()
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

// —— 宿主录音库 ——

interface RawMemo {
  id?: string
  title?: string
  duration?: number
  createdAt?: number
  isFavourite?: boolean
  hasTranscript?: boolean
  hasAudio?: boolean
  isAudioProtected?: boolean
  folder?: string
}

export async function listLibrary(input: { query?: string; favOnly?: boolean } = {}): Promise<Memo[]> {
  const args: Record<string, unknown> = {}
  if (input.query) args.query = input.query
  if (input.favOnly) args.favOnly = true
  const result = await memoCall('list', args)
  if (!Array.isArray(result.json)) return []
  return (result.json as RawMemo[]).map(toMemo)
}

function toMemo(raw: RawMemo): Memo {
  return {
    id: String(raw.id ?? ''),
    source: 'library',
    title: String(raw.title ?? ''),
    duration: Number(raw.duration ?? 0),
    // 宿主给的是 unix **秒**，本地统一用毫秒。
    createdAt: Number(raw.createdAt ?? 0) * 1000,
    isFavourite: Boolean(raw.isFavourite),
    hasTranscript: Boolean(raw.hasTranscript),
    hasAudio: raw.hasAudio !== false,
    isAudioProtected: Boolean(raw.isAudioProtected),
    folder: raw.folder,
  }
}

export async function fetchTranscript(id: string): Promise<MemoTranscript | null> {
  const result = await memoCall('transcript', { id })
  const json = result.json as Record<string, unknown> | null
  if (!json) return null
  return {
    status: (String(json.status ?? 'none') as MemoTranscript['status']) ?? 'none',
    fullText: String(json.fullText ?? ''),
    locale: String(json.locale ?? ''),
    isEdited: Boolean(json.isEdited),
    segmentCount: Number(json.segmentCount ?? 0),
  }
}

export async function startTranscription(id: string, locale?: string): Promise<CallResult> {
  return memoCall('transcribe', locale ? { id, locale } : { id })
}

export async function renameMemo(id: string, title: string): Promise<CallResult> {
  return memoCall('rename', { id, title })
}

/** ⚠️ 宿主的 `memo_delete` 是**永久删除**（删音频 + 删记录），语义比 UI 的「移到最近删除」危险得多。 */
export async function deleteMemo(id: string): Promise<CallResult> {
  return memoCall('delete', { id })
}

export async function toggleFavourite(id: string): Promise<CallResult> {
  return memoCall('favourite', { id })
}

export async function playMemo(id: string): Promise<CallResult> {
  return memoCall('play', { id })
}

export async function stopPlayback(): Promise<CallResult> {
  return memoCall('stop', {})
}

export async function seekMemo(input: { seconds?: number; percentage?: number }): Promise<CallResult> {
  return memoCall('seek', input as Record<string, unknown>)
}

/** 宿主的 AI 工具：待办 / 章节 / 问答 / 整理。摘要在本地做（要模板参数，宿主工具没有）。 */
export async function fetchActionItems(id: string, force = false): Promise<ActionItem[]> {
  const result = await memoCall('actionItems', force ? { id, force: true } : { id })
  if (!Array.isArray(result.json)) return []
  return (result.json as Record<string, unknown>[]).map((raw, index) => ({
    id: String(raw.id ?? `item-${index}`),
    text: String(raw.text ?? ''),
    kind: (String(raw.kind ?? 'task') as ActionItem['kind']) ?? 'task',
    isDone: Boolean(raw.isDone),
    owner: raw.owner ? String(raw.owner) : undefined,
    dueHint: raw.dueHint ? String(raw.dueHint) : undefined,
    sourceTime: typeof raw.sourceTime === 'number' ? raw.sourceTime : undefined,
  })).filter((item) => item.text)
}

export async function fetchChapters(id: string, force = false): Promise<Chapter[]> {
  const result = await memoCall('chapters', force ? { id, force: true } : { id })
  if (!Array.isArray(result.json)) return []
  return (result.json as Record<string, unknown>[])
    .map((raw) => ({ title: String(raw.title ?? ''), start: Number(raw.start ?? 0) }))
    .filter((chapter) => chapter.title)
}

export async function askMemo(id: string, question: string): Promise<CallResult> {
  return memoCall('ask', { id, question })
}

/** ⚠️ **破坏性**：直接改写宿主的 `fullText` 并置 `isEdited`，随后全部 AI 产物作废。 */
export async function cleanTranscript(id: string): Promise<CallResult> {
  return memoCall('cleanTranscript', { id })
}

/** 宿主录音（会拉起全屏录音页盖在小应用上）。 */
export async function hostRecordStart(title?: string): Promise<CallResult> {
  return memoCall('recordStart', title ? { title } : {})
}

export async function hostRecordControl(action: 'pause' | 'resume' | 'stop'): Promise<CallResult> {
  return memoCall('recordControl', { action })
}

export async function hostRecordStatus(): Promise<{ isRecording: boolean; isPaused: boolean; elapsed: number; title: string }> {
  const result = await memoCall('recordStatus', {})
  const json = (result.json ?? {}) as Record<string, unknown>
  return {
    isRecording: Boolean(json.isRecording),
    isPaused: Boolean(json.isPaused),
    elapsed: Number(json.elapsed ?? 0),
    title: String(json.title ?? ''),
  }
}

// —— 应用内录音 ——

export interface RecorderAvailability {
  available: boolean
  reason: string
  background: boolean
}

export async function recorderAvailability(): Promise<RecorderAvailability> {
  const bridge = api()
  if (!bridge?.audio) return { available: false, reason: 'unavailable', background: false }
  try {
    const value = await bridge.audio.availability()
    return {
      available: value.available,
      reason: value.reason ?? '',
      background: value.supportsBackgroundRecording,
    }
  } catch (error) {
    return { available: false, reason: normalizeError(error).message, background: false }
  }
}

export async function recordStart(input: { sampleRate: number; bitrate: number }): Promise<{ started: boolean; error: string }> {
  const bridge = api()
  if (!bridge?.audio) return { started: false, error: 'aibox/unavailable' }
  try {
    // 格式恒为 AAC/m4a、**单声道**（规格 §9.1）。
    const result = await bridge.audio.recordStart({
      format: 'm4a',
      sampleRate: input.sampleRate,
      bitrate: input.bitrate,
      channels: 1,
    })
    return { started: result.started, error: '' }
  } catch (error) {
    return { started: false, error: normalizeError(error).message }
  }
}

export async function recordPause(): Promise<void> { await safeAudio((audio) => audio.recordPause()) }
export async function recordResume(): Promise<void> { await safeAudio((audio) => audio.recordResume()) }
export async function recordCancel(): Promise<void> { await safeAudio((audio) => audio.recordCancel()) }

async function safeAudio<T>(run: (audio: typeof aibox.audio) => Promise<T>): Promise<T | null> {
  const bridge = api()
  if (!bridge?.audio) return null
  try {
    return await run(bridge.audio)
  } catch {
    return null
  }
}

export interface RecorderStatus {
  recording: boolean
  paused: boolean
  interrupted: boolean
  elapsedMs: number
  levels: number[]
}

export async function recordStatus(): Promise<RecorderStatus> {
  const bridge = api()
  const empty: RecorderStatus = { recording: false, paused: false, interrupted: false, elapsedMs: 0, levels: [] }
  if (!bridge?.audio) return empty
  try {
    const value = await bridge.audio.recordStatus()
    return {
      recording: value.recording,
      paused: value.paused,
      interrupted: value.interrupted,
      elapsedMs: value.elapsedMs,
      levels: Array.isArray(value.levels) ? value.levels : [],
    }
  } catch {
    return empty
  }
}

export interface StoppedClip {
  discarded: boolean
  durationMs: number
  handle: string
  url: string
  byteCount: number
  interrupted: boolean
}

/** 停录定稿。**时长 ≤ 0.5s 直接丢弃、不落库、不提示**（与原生 §9.5 同语义，底座已经做了这一刀）。 */
export async function recordStop(): Promise<StoppedClip | null> {
  const bridge = api()
  if (!bridge?.audio) return null
  try {
    const value = await bridge.audio.recordStop()
    if (value.discarded || !value.handle || !value.url) {
      return { discarded: true, durationMs: value.durationMs ?? 0, handle: '', url: '', byteCount: 0, interrupted: false }
    }
    return {
      discarded: false,
      durationMs: value.durationMs ?? 0,
      handle: value.handle,
      url: value.url,
      byteCount: value.byteCount ?? value.size ?? 0,
      interrupted: Boolean(value.interrupted),
    }
  } catch {
    return null
  }
}

// —— applet 侧持久化（本机剪辑 + AI 衍生产物 + 设置） ——

const COLLECTIONS = { clips: 'localClips', artifacts: 'memoArtifacts' }

type Doc = Record<string, unknown> & { _id?: string }

function db(): typeof aibox.db | undefined {
  const bridge = api()
  return bridge?.db && typeof bridge.db.query === 'function' ? bridge.db : undefined
}

const memoryStore = new Map<string, Map<string, Doc>>()

function bucket(collection: string): Map<string, Doc> {
  let value = memoryStore.get(collection)
  if (!value) {
    value = new Map()
    memoryStore.set(collection, value)
  }
  return value
}

async function readAll<T>(collection: string): Promise<(T & { _id: string })[]> {
  const store = db()
  if (!store) return [...bucket(collection).values()] as (T & { _id: string })[]
  try {
    const rows = await store.query({ collection, limit: 2000 })
    return Array.isArray(rows) ? (rows as (T & { _id: string })[]) : []
  } catch {
    return []
  }
}

async function write(collection: string, document: object): Promise<void> {
  const store = db()
  const doc = document as unknown as Doc
  if (!store) {
    const id = String(doc._id ?? newID())
    bucket(collection).set(id, { ...doc, _id: id })
    return
  }
  try {
    await store.insert({ collection, document: doc })
  } catch {
    /* 落盘失败不抛到 UI：页面拿到的是刚写进 state 的那份，下次启动才丢 */
  }
}

async function erase(collection: string, id: string): Promise<void> {
  const store = db()
  if (!store) {
    bucket(collection).delete(id)
    return
  }
  try {
    await store.remove({ collection, id })
  } catch {
    /* 同上 */
  }
}

/**
 * 触感（规格 §3）：**起录成功**与**按下停止**各给一次 medium；
 * 权限被拒的早退路径**不给**触感 —— 那一下会让"没起录成功"感觉像成功了。
 */
export async function haptic(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
  const bridge = api()
  if (!bridge?.haptics) return
  try {
    await bridge.haptics.impact({ style })
  } catch {
    /* 模拟器上没有触感 */
  }
}

export function newID(): string {
  const c = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function listClips(): Promise<LocalClip[]> {
  const rows = await readAll<LocalClip & { _id: string }>(COLLECTIONS.clips)
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveClip(clip: LocalClip): Promise<void> {
  const rows = await readAll<LocalClip & { _id: string }>(COLLECTIONS.clips)
  const previous = rows.find((row) => row.id === clip.id)
  await write(COLLECTIONS.clips, { ...clip, _id: previous?._id ?? newID() })
}

export async function deleteClip(id: string): Promise<void> {
  const rows = await readAll<LocalClip & { _id: string }>(COLLECTIONS.clips)
  const hit = rows.find((row) => row.id === id)
  if (!hit) return
  await erase(COLLECTIONS.clips, hit._id)
  // 音频本体也要删掉，否则 applet 资源域会一路涨到配额上限。
  const bridge = api()
  if (bridge?.resource && hit.handle) {
    try {
      await bridge.resource.remove(hit.handle)
    } catch {
      /* 句柄已经不在了 */
    }
  }
}

export function emptyArtifacts(memoID: string): MemoArtifacts {
  return {
    memoID,
    summaryText: '',
    summaryPoints: [],
    summaryTemplate: 'general',
    summaryStatus: 'none',
    correctionTurns: [],
    correctionStatus: 'none',
    correctionMode: 'auto',
    correctionSpeakers: [],
    translationText: '',
    translationLang: 'en',
    translationBilingual: false,
    translationStatus: 'none',
    chapters: [],
    actionItems: [],
    sourceHash: '',
    updatedAt: 0,
  }
}

export async function loadArtifacts(memoID: string, transcript: string): Promise<MemoArtifacts> {
  const rows = await readAll<MemoArtifacts & { _id: string }>(COLLECTIONS.artifacts)
  const found = rows.find((row) => row.memoID === memoID)
  if (!found) return emptyArtifacts(memoID)
  const hash = hashText(transcript)
  if (found.sourceHash && hash && found.sourceHash !== hash) {
    // `ready` 只会变 `stale`，`none` 不变 —— 这就是「自动补空、不覆盖」的机制（规格 §19.11）。
    return {
      ...found,
      summaryStatus: found.summaryStatus === 'ready' ? 'stale' : found.summaryStatus,
      correctionStatus: found.correctionStatus === 'ready' ? 'stale' : found.correctionStatus,
      translationStatus: found.translationStatus === 'ready' ? 'stale' : found.translationStatus,
    }
  }
  // 冷启动自愈：卡在 `generating` 的一律复位成 `none`，否则详情页永远显示「…中」且无法重试。
  return {
    ...found,
    summaryStatus: found.summaryStatus === 'generating' ? 'none' : found.summaryStatus,
    correctionStatus: found.correctionStatus === 'generating' ? 'none' : found.correctionStatus,
    translationStatus: found.translationStatus === 'generating' ? 'none' : found.translationStatus,
  }
}

export async function saveArtifacts(artifacts: MemoArtifacts): Promise<void> {
  const rows = await readAll<MemoArtifacts & { _id: string }>(COLLECTIONS.artifacts)
  const previous = rows.find((row) => row.memoID === artifacts.memoID)
  await write(COLLECTIONS.artifacts, { ...artifacts, updatedAt: Date.now(), _id: previous?._id ?? newID() })
}

export async function loadSetting<T>(key: string, fallback: T): Promise<T> {
  const bridge = api()
  if (!bridge?.storage) return fallback
  try {
    const value = await bridge.storage.get(key)
    return (value ?? fallback) as T
  } catch {
    return fallback
  }
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const bridge = api()
  if (!bridge?.storage) return
  try {
    await bridge.storage.set(key, value as aibox.JSONValue)
  } catch {
    /* 存不下就用内存里的那份 */
  }
}

// —— 合并视图 ——

export function clipToMemo(clip: LocalClip): Memo {
  return {
    id: clip.id,
    source: 'local',
    title: clip.title,
    duration: clip.durationMs / 1000,
    createdAt: clip.createdAt,
    isFavourite: clip.isFavourite,
    // 本机剪辑**没有转写路径**：容器里没有任何工具能转写一个 applet 私有资源。
    hasTranscript: false,
    hasAudio: true,
    isAudioProtected: false,
    url: clip.url,
    handle: clip.handle,
  }
}

/** 给列表行算摘录（标题命中时不出摘录，与原生一致）。 */
export function withSnippet(memo: Memo, query: string, transcript: string): Memo {
  if (!query) return memo
  if (memo.title.toLowerCase().includes(query.toLowerCase())) return memo
  const snippet = snippetOf(transcript, query)
  return snippet ? { ...memo, snippet } : memo
}

export type { SummaryTemplate }
