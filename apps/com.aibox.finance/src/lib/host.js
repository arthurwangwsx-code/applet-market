// 宿主桥的薄封装。三条纪律（与资讯包一致）：
//  1. 每个能力**先探测再使用**——宿主没装/没授权时 `window.aibox.<ns>` 根本不存在，
//     入口要整块不渲染，而不是留一个点了没反应的按钮；
//  2. 所有调用都不抛到 UI 层，失败回落成可判定的返回值；
//  3. 没有 aibox 时（普通浏览器预览、node 自测）退化成内存实现，页面仍能跑。

const bridge = () => (typeof window !== 'undefined' ? window.aibox : undefined)

export function hasNamespace(name, method) {
  const api = bridge()
  if (!api || !api[name]) return false
  return method ? typeof api[name][method] === 'function' : true
}

export const capabilities = {
  get tabs() { return hasNamespace('tabs', 'getState') },
  get toolbar() { return hasNamespace('toolbar', 'on') },
  get net() { return hasNamespace('net', 'fetch') },
  get ai() { return hasNamespace('ai', 'generate') },
  get chat() { return hasNamespace('chat', 'open') },
  get notifications() { return hasNamespace('notifications', 'schedule') },
  get share() { return hasNamespace('share', 'file') },
  get action() { return hasNamespace('action', 'register') },
  get haptics() { return hasNamespace('haptics', 'impact') },
}

// —— storage（per-applet KV）——

const memoryStore = new Map()

export const storage = {
  async get(key) {
    const api = bridge()
    if (!api || !api.storage) return memoryStore.has(key) ? memoryStore.get(key) : null
    try {
      const value = await api.storage.get(key)
      return value === undefined ? null : value
    } catch (error) {
      return null
    }
  },
  async set(key, value) {
    const api = bridge()
    if (!api || !api.storage) { memoryStore.set(key, value); return true }
    try {
      await api.storage.set(key, value)
      return true
    } catch (error) {
      return false
    }
  },
  async remove(key) {
    const api = bridge()
    if (!api || !api.storage) { memoryStore.delete(key); return true }
    try {
      await api.storage.remove(key)
      return true
    } catch (error) {
      return false
    }
  },
}

// —— 事件总线 ——

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

// —— AI ——

export async function aiAvailability() {
  const api = bridge()
  if (!api || !api.ai || typeof api.ai.availability !== 'function') return { available: false }
  try {
    const info = await api.ai.availability()
    return info && typeof info === 'object' ? info : { available: false }
  } catch (error) {
    return { available: false }
  }
}

/** 降级路径：没有停靠会话时跳聊天页开一个带种子的会话（原生自己就有这条降级）。 */
export async function openChat({ prompt, categoryKey, autoSend = true, identity }) {
  const api = bridge()
  if (api && api.chat && typeof api.chat.open === 'function') {
    try {
      await api.chat.open({ prompt, categoryKey, autoSend, identity })
      return true
    } catch (error) { /* 落到 ai.generate */ }
  }
  return false
}

export async function aiGenerate(input) {
  const api = bridge()
  if (!api || !api.ai || typeof api.ai.generate !== 'function') throw new Error('aibox/ai-unavailable')
  return api.ai.generate(input)
}

// —— 本地通知（到价提醒）——
//
// 容器只有 `schedule`，**没有后台唤醒**——所以到价检查照原生做法放在「前台刷新时」，
// UI 文案如实说明「App 活跃时生效」，不假装能后台盯盘。

export async function scheduleNotification({ title, body, afterMinutes = 0 }) {
  const api = bridge()
  if (!api || !api.notifications || typeof api.notifications.schedule !== 'function') return false
  try {
    await api.notifications.schedule({ title, body, afterMinutes })
    return true
  } catch (error) {
    return false
  }
}

// —— 文件导出（账户归档）——

export async function shareFile({ filename, content, mimeType }) {
  const api = bridge()
  if (!api || !api.share || typeof api.share.file !== 'function') return false
  try {
    await api.share.file({ filename, content, mimeType })
    return true
  } catch (error) {
    return false
  }
}

export function impact(style = 'light') {
  const api = bridge()
  if (api && api.haptics && typeof api.haptics.impact === 'function') {
    try { api.haptics.impact({ style }) } catch (error) { /* 触觉是锦上添花 */ }
  }
}

/** 注册一个可被 AI / 自动化调用的 action（manifest.actions 里已静态声明的那些）。 */
export function registerAction(name, handler) {
  const api = bridge()
  if (!api || !api.action || typeof api.action.register !== 'function') return false
  try {
    api.action.register(name, handler)
    return true
  } catch (error) {
    return false
  }
}
