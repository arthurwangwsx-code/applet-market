// 对外提供的三个 AI 动作（inspect / fetch / library）。
//
// 全部是 `viddl_*` 宿主工具的**薄转发**——这个应用的价值在 UI（画质选择、资料库、进度），
// 不在重新实现解析。转发层只做两件宿主工具没做的事：
//   ① 把 `viddl_inspect` 的结构化 `details` 提上来（工具本来就产了，只是模型侧看的是文本）；
//   ② 从 `viddl_download` 的文本里认领 jobId，让调用方拿到一个能继续追踪的句柄。

import { callTool, parseJobLines, toolBlockReason } from './host.js'
import type { JSONValue } from '@aibox/applet-sdk'
import type {
  FetchRequest,
  FetchResult,
  InspectResult,
  LibraryRequest,
  LibraryResult,
  ToolBlockVerdict,
  VideoInspectDetails,
} from '../types.js'

export const uiHooks: { refresh: (() => void | Promise<void>) | null } = { refresh: null }

/** 从工具文本里认领一个 jobId。锚点与 `viddl_jobs` 的渲染逐字对应，认不出就回 undefined（不猜）。 */
export function extractJobId(text: string): string | undefined {
  if (!text) return undefined
  const anchored = String(text).match(/\[job:\s*([^\]]+)\]/)
  if (anchored) return anchored[1]?.trim()
  const labelled = String(text).match(/\bjobId[:\s]+([0-9a-fA-F-]{8,})/)
  return labelled ? labelled[1] : undefined
}

export async function inspectVideo({ url }: { url: string }): Promise<InspectResult> {
  if (!url) return { ok: false, error: 'url is required', text: '需要一个视频页面或直链地址。' }
  const result = await callTool('viddl_inspect', { url })
  if (!result.ok) {
    return { ok: false, error: result.error || result.text, text: result.text || '解析失败。' }
  }
  const candidate = result.details as Partial<VideoInspectDetails> | undefined
  const details = candidate?.type === 'video_inspect' ? candidate : null
  return {
    ok: true,
    video: details
      ? {
          title: details.title,
          uploader: details.uploader,
          durationText: details.durationText,
          thumbnailURL: details.thumbnailURL,
          extractor: details.extractor,
          subtitles: details.subtitles || [],
        }
      : null,
    formats: details ? details.formats || [] : [],
    text: result.text,
  }
}

export async function fetchVideo({ url, formatId, audioOnly }: FetchRequest): Promise<FetchResult> {
  if (!url) return { ok: false, error: 'url is required', text: '需要一个视频页面或直链地址。' }
  const args: Record<string, unknown> = { url }
  if (formatId) args.formatId = formatId
  if (audioOnly) args.audio_only = true
  const result = await callTool('viddl_download', args)
  if (uiHooks.refresh) uiHooks.refresh()
  if (!result.ok) {
    return { ok: false, error: result.error || result.text, text: result.text || '下载启动失败。' }
  }
  return {
    ok: true,
    jobId: extractJobId(result.text),
    text: result.text || '已开始下载。视频较大，可在资料库里查看进度。',
  }
}

/// 工具被拒（未授权 / 模块解链）之后就**别再问了**。
///
/// 资料库每 2.5s 轮询一次 `viddl_jobs`；不加这个闸，未授权时的表现是每 2.5s 往 console 打一条
/// `aibox/denied`——4 秒 20 条，把真正的错误全埋掉。这类「可选增强站在必需路径上」的形状
/// 是横向缺陷模式之一。一旦被拒就熄火，直到调用方显式 `resetLibraryGate()`（授权变化时）。
let libraryDenied = false
export function resetLibraryGate() {
  libraryDenied = false
  preflight = null
}
export function isLibraryDenied() {
  return libraryDenied
}

/// 首调之前先问网关，而不是「调一次、被拒、再熄火」。
///
/// 熔断闸只能拦住第二条之后：资料库挂载与首次刷新是并发的，两条请求都会抢在闸落下之前发出去，
/// 于是每次冷启动必然吐 2 条 `aibox/denied`。`access.explain` 是只读判定、不产生拒绝错误，
/// 问一次就能知道该不该发。**用同一个 promise 兜住并发首调**，否则 preflight 自己也会被调两次。
let preflight: Promise<ToolBlockVerdict> | null = null
async function libraryAllowed(): Promise<ToolBlockVerdict> {
  const pending =
    preflight ??
    toolBlockReason('viddl_jobs')
      .then((verdict) => {
        if (!verdict.ok) libraryDenied = true
        return verdict
      })
      .catch(() => ({ ok: true, hint: '' })) // 网关本身出错时不替它下结论，照旧走原来的「调了再说」
  preflight = pending
  return pending
}

export async function libraryAction({ action, jobId }: LibraryRequest = {}): Promise<LibraryResult> {
  const verb = action || 'list'
  if (libraryDenied) {
    return { ok: false, action: verb, denied: true, jobs: [], text: '视频下载工具未授权。' }
  }
  const verdict = await libraryAllowed()
  if (!verdict.ok) {
    return { ok: false, action: verb, denied: true, jobs: [], text: verdict.hint || '视频下载工具未授权。' }
  }
  const args: Record<string, unknown> = { action: verb }
  if (jobId) args.jobId = jobId
  const result = await callTool('viddl_jobs', args)
  if (uiHooks.refresh) uiHooks.refresh()
  if (!result.ok) {
    const message = String(result.error || result.text || '')
    if (message.includes('aibox/denied') || message.includes('not granted')) libraryDenied = true
    return {
      ok: false,
      action: verb,
      denied: libraryDenied,
      error: result.error || result.text,
      jobs: [],
      text: result.text || '操作失败。',
    }
  }
  return { ok: true, action: verb, jobs: parseJobLines(result.text), text: result.text }
}

export function registerActions() {
  const api = typeof window !== 'undefined' ? window.aibox : undefined
  if (!api || !api.action || typeof api.action.register !== 'function') return
  api.action.register('inspect', (input) => inspectVideo(input as { url: string }) as unknown as Promise<JSONValue>)
  api.action.register('fetch', (input) => fetchVideo(input as unknown as FetchRequest) as unknown as Promise<JSONValue>)
  api.action.register(
    'library',
    (input) => libraryAction((input ?? {}) as unknown as LibraryRequest) as unknown as Promise<JSONValue>,
  )
}
