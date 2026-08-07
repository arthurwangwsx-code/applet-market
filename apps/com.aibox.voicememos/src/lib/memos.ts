// 录音数据层。**2.0.0 起只有一条线。**
//
// ## 1.x 为什么必须同时用两条线，2.0.0 为什么不用了
// 1.x 的 `aibox.audio.*`（应用内录音）拿得到音频字节、实时电平和精确播放位置，
// 唯独**没有任何转写路径**；而转写是这个应用全部 AI 价值的输入（摘要 / 待办 / 章节 / 问答
// 无一例外以 transcript 为输入）。于是它只能同时挂着宿主录音库 `aibox.voiceMemos.*`
// 那条线——代价是列表变成合并视图、每个入口都要按来源分档、而且整个应用的命脉握在
// 一个可以被解链的宿主模块手里。
//
// 宿主补上 `aibox.audio.transcribe` 之后，那个理由整条消失：
//
// | | 1.x（两条线） | 2.0.0（一条线） |
// |---|---|---|
// | 录音 | `aibox.audio` | `aibox.audio` |
// | 实时电平 | `aibox.audio.recordStatus` | 同左 |
// | 音频字节 / 播放位置 | `aibox.audio` 句柄 + `<audio>` | 同左 |
// | **转写** | ❌ 只能走 `voiceMemos.transcribe` | ✅ `aibox.audio.transcribe`（句柄进，文本+分段出） |
// | AI（摘要/待办/章节/问答） | 一半走宿主 memo_* 工具 | 全部 `aibox.ai.generate` + 本地模板 |
// | 数据 | 一半在宿主库里 | 全部在 `aibox.db` / `aibox.storage` / applet 资源域 |
//
// 结果：**本应用不再依赖任何宿主模块**。`aibox.audio` / `aibox.ai` / `aibox.db` 都是平台能力，
// 不随任何模块存废。manifest 里的 `voiceMemos` 声明也随之删除——声明一个不用的能力，
// 只会让用户在授权时看见一条解释不了的请求。
//
// ⚠️ 老用户在宿主录音库里的数据**原地不动**，本应用不读也不删它。
//    2.0.0 是一次干净的切线，不是数据迁移。
import { normalizeError, queryAll } from '@aibox/applet-sdk'
import { hashText, snippetOf } from './format.js'
import type { LocalClip, Memo, MemoArtifacts, SummaryTemplate, TranscriptSegment } from './types.js'

const api = () => (typeof window !== 'undefined' ? window.aibox : undefined)

export const capabilities = {
  get recorder() {
    return Boolean(api()?.audio)
  },
  /** 转写出口是否存在。**注意它只说"方法在"，不说"此刻能转"** —— 后者要问 transcribeAvailability()。 */
  get transcribe() {
    return typeof api()?.audio?.transcribe === 'function'
  },
  get ai() {
    return Boolean(api()?.ai)
  },
  get share() {
    return Boolean(api()?.share)
  },
  get shareFile() {
    return typeof api()?.share?.file === 'function'
  },
  get clipboard() {
    return Boolean(api()?.clipboard)
  },
  get ui() {
    return Boolean(api()?.ui)
  },
  get haptics() {
    return Boolean(api()?.haptics)
  },
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

export async function recordStart(input: {
  sampleRate: number
  bitrate: number
}): Promise<{ started: boolean; error: string }> {
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

export async function recordPause(): Promise<void> {
  await safeAudio((audio) => audio.recordPause())
}
export async function recordResume(): Promise<void> {
  await safeAudio((audio) => audio.recordResume())
}
export async function recordCancel(): Promise<void> {
  await safeAudio((audio) => audio.recordCancel())
}

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
      return {
        discarded: true,
        durationMs: value.durationMs ?? 0,
        handle: '',
        url: '',
        byteCount: 0,
        interrupted: false,
      }
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

// —— 转写（2.0.0 新线：`aibox.audio.transcribe`） ——

export interface TranscribeAvailability {
  /** 此刻真的能转。`needsModelDownload` 一档为 false，但入口**仍应显示**（见 state）。 */
  available: boolean
  /** available | needs-model-download | not-authorized | unsupported-locale | unsupported-os | engine-missing */
  state: string
  locale: string
  /** 宿主这个构建里到底有没有转写引擎。false = 装的是不带 MediaProcessing 的壳。 */
  engine: boolean
}

/**
 * 探一下能不能转写。**不弹框、不转写**，挂载时调一次即可。
 *
 * 为什么值得单独探：`needs-model-download` 与 `engine-missing` 的正确 UI 完全相反——前者
 * 该照常显示按钮（第一次点会下模型），后者该把整个转写区隐藏掉并说明原因。把两者混成一个
 * 布尔，就必然出现「点了没反应」的按钮。
 */
export async function transcribeAvailability(locale?: string): Promise<TranscribeAvailability> {
  const bridge = api()
  if (typeof bridge?.audio?.transcribeAvailability !== 'function') {
    // 宿主太老，连方法都没有。这是 2.0.0 唯一需要探测宿主版本的地方。
    return { available: false, state: 'host-too-old', locale: locale ?? '', engine: false }
  }
  try {
    const value = await bridge.audio.transcribeAvailability(locale ? { locale } : {})
    return {
      available: Boolean(value.available),
      state: String(value.state ?? ''),
      locale: String(value.locale ?? locale ?? ''),
      engine: Boolean(value.engine),
    }
  } catch (error) {
    return { available: false, state: normalizeError(error).message, locale: locale ?? '', engine: false }
  }
}

export interface TranscribeOutcome {
  ok: boolean
  text: string
  locale: string
  segments: TranscriptSegment[]
  /** 失败时的稳定错误码（`aibox/...`），供 UI 分类兜底。 */
  error: string
}

/**
 * 把一段**本应用自己的**录音转成文字。
 *
 * 输入是资源句柄，不是路径——applet 没有路径，宿主在自己那一侧把句柄解析成沙箱 URL。
 * 长录音是分钟级重活，宿主侧每个 applet 同时只允许一条（撞上回 `aibox/busy`），
 * 所以调用方**不要**并发提交一批。
 */
export async function transcribeClip(handle: string, locale?: string): Promise<TranscribeOutcome> {
  const bridge = api()
  const empty = { ok: false, text: '', locale: locale ?? '', segments: [] as TranscriptSegment[] }
  if (typeof bridge?.audio?.transcribe !== 'function') {
    return { ...empty, error: 'aibox/unavailable: host-too-old' }
  }
  if (!handle) return { ...empty, error: 'aibox/invalid-args: missing handle' }
  try {
    const value = await bridge.audio.transcribe(locale ? { handle, locale } : { handle })
    const segments = Array.isArray(value.segments)
      ? (value.segments as Record<string, unknown>[])
          .map((raw) => ({
            text: String(raw.text ?? ''),
            start: Number(raw.start ?? 0),
            duration: Number(raw.duration ?? 0),
            end: Number(raw.end ?? 0),
          }))
          .filter((segment) => segment.text)
      : []
    return {
      ok: true,
      text: String(value.text ?? ''),
      locale: String(value.locale ?? locale ?? ''),
      segments,
      error: '',
    }
  } catch (error) {
    return { ...empty, error: normalizeError(error).message }
  }
}

/** 设置里的 `auto | zh_CN | en_US` → 宿主要的 BCP-47（`zh_CN` → `zh-CN`）；auto 回 undefined 用设备语言。 */
export function localeTag(preference: 'auto' | 'zh_CN' | 'en_US'): string | undefined {
  if (preference === 'auto') return undefined
  return preference.replace('_', '-')
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

/**
 * 读回一个 collection 的全部文档。
 *
 * **曾经这里写的是 `store.query({ collection, limit: 2000 })`，而宿主单次上限是 500 且超出不报错**
 * （`min(500, limit)`）——录音超过 500 条之后列表就停止增长，且与「真的只有 500 条」不可区分。
 * 改用 SDK 的 `queryAll`（分页到表尾）。同一份错误实现在 `com.aibox.wordstudy` 里也有一份，
 * 故修在 SDK 而不是各修各的。
 */
async function readAll<T extends object>(collection: string): Promise<(T & { _id: string })[]> {
  if (!db()) return [...bucket(collection).values()] as unknown as (T & { _id: string })[]
  try {
    return await queryAll<T>(collection)
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

// —— 视图模型 ——

export function clipToMemo(clip: LocalClip): Memo {
  return {
    id: clip.id,
    title: clip.title,
    duration: clip.durationMs / 1000,
    createdAt: clip.createdAt,
    isFavourite: clip.isFavourite,
    // 2.0.0：转写就长在剪辑自己身上（`aibox.audio.transcribe` 的产物直接存进 `aibox.db`）。
    hasTranscript: Boolean(clip.transcriptText),
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
