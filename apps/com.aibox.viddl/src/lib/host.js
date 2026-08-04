// 桥接口：**全部转发给 `@aibox/applet-sdk`**，本文件不再有任何自己的实现。
//
// 2026-08-04 迁移：这里原本是 148 行私有胶水，是全市场 8 份分叉之一。分叉的代价不是重复代码，
// 是**同一件事有好几个答案**——四份对「confirm 不可用回什么」给了三个答案，AI 写新应用时
// 检索到哪份就继承哪份。现在语义由 SDK 统一裁定（见 sdk/src/ui.ts、system.ts 的文件头）。
//
// 保留这一层薄转发而不是让各处直接 import SDK：调用点一个都不用改，迁移的 diff 只有本文件，
// 出问题时回滚面也只有本文件。等真机验过一轮之后，再把调用点逐步指向 SDK 并删掉本文件。

import { available, bridge, events, system, intelligence } from '@aibox/applet-sdk'

export { parseJobLines } from './jobs.js'

export function hasNamespace(name, method) {
  return available(name, method)
}

export const capabilities = {
  get tools() { return available('tools', 'call') },
  get download() { return available('download', 'list') },
  get clipboard() { return available('clipboard', 'read') },
  get share() { return available('share', 'file') },
  get haptics() { return available('haptics', 'impact') },
}

export const toolAllowed = intelligence.toolAllowed

/** 调一个宿主工具。回 `{ok, text, details?}`——形状与迁移前一致，调用点零改。 */
export async function callTool(name, args) {
  const result = await intelligence.callTool(name, args || {})
  return result.ok ? result : { ok: false, error: result.text, text: result.text }
}

export const queue = {
  /** 视频轨道与 HLS 离线包都在这里。 */
  async list() {
    const api = bridge()
    if (!capabilities.download) return []
    try {
      const items = await api.download.list({})
      return Array.isArray(items) ? items : []
    } catch { return [] }
  },
  async subscribe() {
    const api = bridge()
    if (!capabilities.download) return false
    try { await api.download.subscribe({}); return true } catch { return false }
  },
  async unsubscribe() {
    const api = bridge()
    if (!capabilities.download) return false
    try { await api.download.unsubscribe({}); return true } catch { return false }
  },
}

export const onEvent = events.on
/** 外壳命名空间自带的回调（tabs/toolbar），与 `aibox.events` 是两套机制，别混。 */
export const onNamespaceEvent = events.shellOn

export const readClipboard = system.readClipboard

export function tap(style) {
  const api = bridge()
  if (!capabilities.haptics) return
  try { api.haptics.impact({ style: style || 'light' }) } catch { /* 触感失败无所谓 */ }
}
