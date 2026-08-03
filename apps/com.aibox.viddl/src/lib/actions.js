// 对外提供的三个 AI 动作（inspect / fetch / library）。
//
// 全部是 `viddl_*` 宿主工具的**薄转发**——这个应用的价值在 UI（画质选择、资料库、进度），
// 不在重新实现解析。转发层只做两件宿主工具没做的事：
//   ① 把 `viddl_inspect` 的结构化 `details` 提上来（工具本来就产了，只是模型侧看的是文本）；
//   ② 从 `viddl_download` 的文本里认领 jobId，让调用方拿到一个能继续追踪的句柄。

import { callTool, parseJobLines } from './host.js'

export const uiHooks = { refresh: null }

/** 从工具文本里认领一个 jobId。锚点与 `viddl_jobs` 的渲染逐字对应，认不出就回 undefined（不猜）。 */
export function extractJobId(text) {
  if (!text) return undefined
  const anchored = String(text).match(/\[job:\s*([^\]]+)\]/)
  if (anchored) return anchored[1].trim()
  const labelled = String(text).match(/\bjobId[:\s]+([0-9a-fA-F-]{8,})/)
  return labelled ? labelled[1] : undefined
}

export async function inspectVideo({ url }) {
  if (!url) return { ok: false, error: 'url is required', text: '需要一个视频页面或直链地址。' }
  const result = await callTool('viddl_inspect', { url })
  if (!result.ok) {
    return { ok: false, error: result.error || result.text, text: result.text || '解析失败。' }
  }
  const details = result.details && result.details.type === 'video_inspect' ? result.details : null
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

export async function fetchVideo({ url, formatId, audioOnly }) {
  if (!url) return { ok: false, error: 'url is required', text: '需要一个视频页面或直链地址。' }
  const args = { url }
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
export function resetLibraryGate() { libraryDenied = false }
export function isLibraryDenied() { return libraryDenied }

export async function libraryAction({ action, jobId } = {}) {
  const verb = action || 'list'
  if (libraryDenied) {
    return { ok: false, action: verb, denied: true, jobs: [], text: '视频下载工具未授权。' }
  }
  const args = { action: verb }
  if (jobId) args.jobId = jobId
  const result = await callTool('viddl_jobs', args)
  if (uiHooks.refresh) uiHooks.refresh()
  if (!result.ok) {
    const message = String(result.error || result.text || '')
    if (message.includes('aibox/denied') || message.includes('not granted')) libraryDenied = true
    return { ok: false, action: verb, denied: libraryDenied, error: result.error || result.text, jobs: [], text: result.text || '操作失败。' }
  }
  return { ok: true, action: verb, jobs: parseJobLines(result.text), text: result.text }
}

export function registerActions() {
  const api = typeof window !== 'undefined' ? window.aibox : undefined
  if (!api || !api.action || typeof api.action.register !== 'function') return
  api.action.register('inspect', inspectVideo)
  api.action.register('fetch', fetchVideo)
  api.action.register('library', libraryAction)
}
