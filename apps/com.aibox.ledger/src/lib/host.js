// 宿主桥接口：**共享部分全部转发给 `@aibox/applet-sdk`**（2026-08-05 迁移，理由同 finance）。
// 语义分歧由 SDK 统一裁定：confirm 不可用回 false（不是 null）、openURL 一律超时封顶。

import { available, bridge, events, system, intelligence, ui } from '@aibox/applet-sdk'


export function hasNamespace(name, method) {
  return available(name, method)
}

export const capabilities = {
  get db() { return hasNamespace('db', 'query') },
  get tabs() { return hasNamespace('tabs', 'getState') },
  get toolbar() { return hasNamespace('toolbar', 'on') },
  get menu() { return hasNamespace('menu', 'update') },
  get navigation() { return hasNamespace('navigation', 'setTitle') },
  get scene() { return hasNamespace('scene', 'getState') },
  get ai() { return hasNamespace('ai', 'generate') },
  get net() { return hasNamespace('net', 'fetch') },
  get ui() { return hasNamespace('ui', 'confirm') },
  get picker() { return hasNamespace('picker', 'file') },
  get resource() { return hasNamespace('resource', 'readText') },
  get shareFile() { return hasNamespace('share', 'file') },
  get shareText() { return hasNamespace('share', 'text') },
  get haptics() { return hasNamespace('haptics', 'impact') },
}

// MARK: - storage（轻量偏好；不承载账本主数据）

const memoryStore = new Map()

export const storage = {
  async get(key) {
    const api = bridge()
    if (!api || !api.storage) return memoryStore.has(key) ? memoryStore.get(key) : null
    try {
      const value = await api.storage.get(key)
      return value === undefined ? null : value
    } catch (error) { return null }
  },
  async set(key, value) {
    const api = bridge()
    if (!api || !api.storage) { memoryStore.set(key, value); return true }
    try { await api.storage.set(key, value); return true } catch (error) { return false }
  },
}

// MARK: - net（原生代理，无 CORS 问题）

/** GET → `{ ok, status, body }`；软超时由调用方给（桥不接受 per-request timeout）。 */
export async function httpGetJSON(url, { timeoutMs = 12000 } = {}) {
  const api = bridge()
  if (!api || !api.net || typeof api.net.fetch !== 'function') return { ok: false }
  let timer = null
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ __timeout: true }), timeoutMs) })
  try {
    const response = await Promise.race([
      api.net.fetch(url, { method: 'GET', responseType: 'json' }),
      timeout,
    ])
    if (!response || response.__timeout) return { ok: false }
    const status = Number(response.status || 0)
    if (status < 200 || status >= 300) return { ok: false, status }
    const body = typeof response.body === 'string' ? safeParse(response.body) : response.body
    return { ok: !!body, status, body }
  } catch (error) {
    return { ok: false }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function safeParse(text) {
  try { return JSON.parse(text) } catch (error) { return null }
}

// MARK: - ui（原生对话框；缺席时由调用方走自绘弹层）

/** 语义已统一：问不出来 = 没确认（false）。破坏性操作的默认答案必须是「不做」。 */
export const nativeConfirm = ui.confirm

export const nativeAlert = ui.alert

/** 原生 action sheet（长按菜单）。返回选中的 id；不可用返回 undefined。 */
export const nativeActionSheet = ui.actionSheet

// MARK: - picker / resource（CSV 导入）

/** 弹系统文档选择器读一个文本文件。返回 `{ ok, text, name }`。 */
export async function pickTextFile(types) {
  const api = bridge()
  if (!api || !api.picker || typeof api.picker.file !== 'function') return { ok: false, reason: 'unavailable' }
  try {
    const picked = await api.picker.file({ types, multiple: false })
    if (!picked || picked.cancelled) return { ok: false, reason: 'cancelled' }
    const item = (picked.items ?? [])[0]
    if (!item) return { ok: false, reason: 'cancelled' }
    if (!api.resource || typeof api.resource.readText !== 'function') return { ok: false, reason: 'unavailable' }
    const text = await api.resource.readText(item.handle)
    return { ok: true, text: String(text ?? ''), name: item.name ?? '' }
  } catch (error) {
    return { ok: false, reason: String((error && error.message) || error) }
  }
}

// MARK: - share（CSV 导出）

/**
 * 导出一个带文件名的文件。优先 `aibox.share.file`（合同见 app-shell-and-market.md §3.5）；
 * 宿主还没实现时降级到 `aibox.share.text`（接收方拿到的是一段文字而不是文件，调用方要告知用户）。
 * 返回 `'file' | 'text' | false`。
 */
export const shareFile = system.shareFile

// MARK: - ai

export const aiAvailability = intelligence.aiAvailability

export const aiGenerate = intelligence.aiGenerate

// MARK: - 事件总线 / 外壳

export const onEvent = events.on

export const onNamespaceEvent = events.shellOn

export function bridgeAPI() {
  return bridge()
}

/** 轻微触感（有就用，没有就算了）。 */
export function tapFeedback() {
  const api = bridge()
  if (api && api.haptics && typeof api.haptics.impact === 'function') {
    try { api.haptics.impact({ style: 'light' }) } catch (error) { /* 无所谓 */ }
  }
}
