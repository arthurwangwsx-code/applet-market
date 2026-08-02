// 宿主桥的薄封装。三条纪律（与资讯包一致）：
//  1. 每个能力**先探测再使用**——宿主没装/没授权时 `window.aibox.<ns>` 根本不存在，
//     入口要整块不渲染，而不是点了没反应；
//  2. 调用不抛到 UI 层，失败回落成可判定的返回值；
//  3. 没有 aibox 时（普通浏览器预览、Node 自测）退化成内存实现，页面仍能跑。
//
// **例外：`db` 的失败必须抛出**——记账是财务数据，写失败绝不能被吞掉后照常刷新 UI
// （§4.7 可靠性契约）。所以 db 相关调用不在这里兜底，见 lib/db.js。

const bridge = () => (typeof window !== 'undefined' ? window.aibox : undefined)

export function hasNamespace(name, method) {
  const api = bridge()
  if (!api || !api[name]) return false
  return method ? typeof api[name][method] === 'function' : true
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

export async function nativeConfirm({ title, message, confirmTitle, destructive }) {
  const api = bridge()
  if (!api || !api.ui || typeof api.ui.confirm !== 'function') return null
  try {
    const result = await api.ui.confirm({
      title,
      message,
      actions: [
        { id: 'confirm', title: confirmTitle, role: destructive ? 'destructive' : 'default' },
        { id: 'cancel', title: '', role: 'cancel' },
      ],
    })
    return !!(result && result.actionId === 'confirm' && !result.cancelled)
  } catch (error) { return null }
}

export async function nativeAlert({ title, message }) {
  const api = bridge()
  if (!api || !api.ui || typeof api.ui.alert !== 'function') return false
  try { await api.ui.alert({ title, message }); return true } catch (error) { return false }
}

/** 原生 action sheet（长按菜单）。返回选中的 id；不可用返回 undefined。 */
export async function nativeActionSheet({ title, message, actions }) {
  const api = bridge()
  if (!api || !api.ui || typeof api.ui.actionSheet !== 'function') return undefined
  try {
    const result = await api.ui.actionSheet({ title, message, actions })
    if (!result || result.cancelled) return null
    return result.actionId ?? null
  } catch (error) { return undefined }
}

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
export async function shareFile({ filename, content, mimeType }) {
  const api = bridge()
  if (api && api.share && typeof api.share.file === 'function') {
    try { await api.share.file({ filename, content, mimeType }); return 'file' } catch (error) { /* 降级 */ }
  }
  if (api && api.share && typeof api.share.text === 'function') {
    try { await api.share.text({ text: content, title: filename }); return 'text' } catch (error) { return false }
  }
  return false
}

// MARK: - ai

export async function aiAvailability() {
  const api = bridge()
  if (!api || !api.ai || typeof api.ai.availability !== 'function') return { available: false }
  try {
    const info = await api.ai.availability()
    return info && typeof info === 'object' ? info : { available: false }
  } catch (error) { return { available: false } }
}

export async function aiGenerate(input) {
  const api = bridge()
  if (!api || !api.ai || typeof api.ai.generate !== 'function') throw new Error('aibox/ai-unavailable')
  return api.ai.generate(input)
}

// MARK: - 事件总线 / 外壳

export function onEvent(name, handler) {
  const api = bridge()
  if (!api || !api.events || typeof api.events.on !== 'function') return () => {}
  return api.events.on(name, handler)
}

export function onNamespaceEvent(namespace, event, handler) {
  const api = bridge()
  if (!api || !api[namespace] || typeof api[namespace].on !== 'function') return () => {}
  return api[namespace].on(event, handler)
}

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
