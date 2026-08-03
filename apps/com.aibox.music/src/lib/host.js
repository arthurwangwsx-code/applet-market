// 宿主桥的薄封装。三条纪律与资讯应用一致：
//  1. 先探测再使用——能力缺席时入口整块不渲染，不留「点了没反应」的按钮；
//  2. 调用不抛到 UI 层，一律回落成可判定的返回值；
//  3. 没有 window.aibox 时（普通浏览器里预览）退化成内存实现，页面仍能跑。
//
// ⚠️ 架构裁决：播放一律遥控宿主引擎 `aibox.music.*`，**禁止** `aibox.media` 自持引擎——
// 那条路不写锁屏 NowPlaying、不注册 remote command，WebView 一挂起队列就停摆。
// 见 docs/capabilities/applet/framework-capabilities.md §3.6。

const bridge = () => (typeof window !== 'undefined' ? window.aibox : undefined)

export function hasNamespace(name, method) {
  const api = bridge()
  if (!api || !api[name]) return false
  return method ? typeof api[name][method] === 'function' : true
}

export const capabilities = {
  get music() { return hasNamespace('music', 'status') },
  get haptics() { return hasNamespace('haptics', 'impact') },
  get share() { return hasNamespace('share', 'text') },
  get openURL() { return hasNamespace('open', 'url') },
  get ui() { return hasNamespace('ui', 'confirm') },
  get tabs() { return hasNamespace('tabs', 'getState') },
  get toolbar() { return hasNamespace('toolbar', 'on') },
  get net() { return hasNamespace('net', 'fetch') },
  get storage() { return hasNamespace('storage', 'get') },
  get overlay() { return hasNamespace('overlay', 'getState') },
  get listGestures() { return hasNamespace('list', 'configure') },
}

// MARK: - music（19 个宿主工具的一等投影）

/**
 * 调一个 `aibox.music.<method>`。统一回 `{ ok, text, json, error }`：
 * - `text` 是工具的原始文本（多数音乐工具把 JSON 直接放在 text 里，不走 details）；
 * - `json` 是 text 能解析成 JSON 时的对象/数组，否则 null；
 * - 失败不抛，`ok:false` + `error` 文本（UI 靠它反推「未授权 / 无订阅 / 真的空」）。
 */
export async function music(method, args = {}) {
  const api = bridge()
  if (!api || !api.music || typeof api.music[method] !== 'function') {
    return { ok: false, text: '', json: null, error: 'aibox/music-unavailable' }
  }
  try {
    const raw = await api.music[method](args)
    const text = String((raw && raw.text) || '')
    const ok = !(raw && (raw.ok === false || raw.isError === true))
    return { ok, text, json: parseJSON(text), details: raw && raw.details, error: ok ? null : text }
  } catch (error) {
    return { ok: false, text: '', json: null, error: String((error && error.message) || error) }
  }
}

export function parseJSON(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null
  try {
    return JSON.parse(trimmed)
  } catch (error) {
    return null
  }
}

/**
 * 从工具的失败文案反推 Apple Music 可用性——容器没有 `music.availability()`（缺口⑨），
 * 「未授权 / 无订阅 / 真的空」三种空态在原生是分开的，这里只能按文案归类。
 */
export function classifyMusicError(text) {
  const value = String(text || '').toLowerCase()
  if (!value) return 'none'
  if (value.includes('not authorized') || value.includes('access not granted')
      || value.includes('authorization')) return 'denied'
  if (value.includes('subscription')) return 'noSubscription'
  if (value.includes('cancelled')) return 'cancelled'
  if (value.includes('not found')) return 'notFound'
  return 'error'
}

// MARK: - 触感

export const haptics = {
  impact(style = 'light') { fireAndForget('haptics', 'impact', { style }) },
  selection() { fireAndForget('haptics', 'selection', {}) },
  notify(type = 'success') { fireAndForget('haptics', 'notify', { type }) },
}

function fireAndForget(namespace, method, args) {
  const api = bridge()
  if (!api || !api[namespace] || typeof api[namespace][method] !== 'function') return
  try {
    const result = api[namespace][method](args)
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch (error) { /* 触感失败无所谓 */ }
}

// MARK: - 原生弹层（antd-mobile 的 Toast.show 在本宿主渲染为空，命令式弹层一律走原生或自绘）

/** 二次确认。返回 true 表示用户点了确认键。宿主没有 ui 能力时保守返回 false（不误删）。 */
export async function confirm({ title, message, confirmTitle, cancelTitle, destructive = false }) {
  const api = bridge()
  if (!api || !api.ui || typeof api.ui.confirm !== 'function') return false
  try {
    const result = await api.ui.confirm({
      title,
      message,
      actions: [
        { id: 'cancel', title: cancelTitle, role: 'cancel' },
        { id: 'confirm', title: confirmTitle, role: destructive ? 'destructive' : 'default' },
      ],
    })
    return !!result && result.actionId === 'confirm' && !result.cancelled
  } catch (error) {
    return false
  }
}

/** 原生 action sheet（长按菜单）。actions = [{id,title,role}]，返回被点中的 id 或 null。 */
export async function actionSheet({ title, message, actions }) {
  const api = bridge()
  if (!api || !api.ui || typeof api.ui.actionSheet !== 'function') return null
  try {
    const result = await api.ui.actionSheet({ title, message, actions })
    if (!result || result.cancelled) return null
    return result.actionId || null
  } catch (error) {
    return null
  }
}

export async function prompt({ title, message, placeholder, defaultValue }) {
  const api = bridge()
  if (!api || !api.ui || typeof api.ui.prompt !== 'function') return null
  try {
    const result = await api.ui.prompt({ title, message, placeholder, defaultValue })
    if (!result || result.cancelled) return null
    return typeof result.value === 'string' ? result.value : null
  } catch (error) {
    return null
  }
}

// MARK: - 分享 / 打开链接

export async function shareText(text, url) {
  const api = bridge()
  if (!api || !api.share || typeof api.share.text !== 'function') return false
  try {
    await api.share.text({ text, url })
    return true
  } catch (error) {
    return false
  }
}

export async function openURL(url) {
  const api = bridge()
  if (api && api.browser && typeof api.browser.open === 'function') {
    try {
      await api.browser.open({ url, mode: 'system' })
      return true
    } catch (error) { /* 落到 open.url */ }
  }
  if (api && api.open && typeof api.open.url === 'function') {
    try {
      await api.open.url({ url })
      return true
    } catch (error) {
      return false
    }
  }
  return false
}

// MARK: - storage

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
}

// MARK: - net（只用于取封面字节）

/**
 * 取远程封面并转成 `data:` URL。
 * 为什么不能直接 `<img src="https://…">`：secure 模式的 CSP 是
 * `img-src applet: data: blob:`，远程 URL 会被整条拦掉（资讯应用也踩过，见其 imageBlocked 文案）。
 * 走原生代理拿 base64 → data URL，既过 CSP，也让 canvas 取色不被跨域污染。
 */
export async function fetchImageDataURL(url, { maxBytes = 400000 } = {}) {
  const api = bridge()
  if (!api || !api.net || typeof api.net.fetch !== 'function') return null
  if (!/^https?:\/\//i.test(String(url || ''))) return null
  try {
    const response = await api.net.fetch(url, { method: 'GET', responseType: 'base64', maxBytes })
    const status = Number((response && response.status) || 0)
    const body = String((response && response.body) || '')
    if (status < 200 || status >= 300 || !body) return null
    const mime = String((response && response.contentType) || 'image/jpeg').split(';')[0].trim()
    return `data:${mime || 'image/jpeg'};base64,${body}`
  } catch (error) {
    return null
  }
}

// MARK: - 事件与动作

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

/** 注册一个对外动作（AI / 自动化 / 快捷指令可调用）。处理器必须返回 JSON 可序列化值。 */
export function registerAction(name, handler) {
  const api = bridge()
  if (!api || !api.action || typeof api.action.register !== 'function') return
  try {
    api.action.register(name, handler)
  } catch (error) { /* 宿主没开放动作注册：静默 */ }
}

// MARK: - tabs / toolbar / navigation

export const tabs = {
  async getState() {
    const api = bridge()
    if (!api || !api.tabs || typeof api.tabs.getState !== 'function') return null
    try {
      return await api.tabs.getState()
    } catch (error) {
      return null
    }
  },
  select(id) { fireAndForget('tabs', 'select', { id }) },
  update(items) { fireAndForget('tabs', 'update', { items }) },
}

export const toolbar = {
  async getState() {
    const api = bridge()
    if (!api || !api.toolbar || typeof api.toolbar.getState !== 'function') return null
    try {
      return await api.toolbar.getState()
    } catch (error) {
      return null
    }
  },
  update(items) { fireAndForget('toolbar', 'update', { items }) },
  setSearch(patch) { fireAndForget('toolbar', 'setSearch', patch) },
}

/**
 * 悬浮层（`aibox.overlay`，合同 app-shell-and-market.md §2.5）。
 *
 * 迷你播放条**不再自绘**：宿主把它和底栏叠进同一个 `safeAreaInset`，自下而上是
 * 底栏 → bar → button，于是「被底栏压住」在结构上就不可能发生，而不是靠这里算 padding。
 * 宿主没画（card/sheet/drawer 形态、声明越界）时 `getState().rendered === false`，
 * 页面据此把 `<MiniBar>` 放回内容流——降级路径必须一直留着。
 */
export const overlay = {
  async getState() {
    const api = bridge()
    if (!api || !api.overlay || typeof api.overlay.getState !== 'function') return null
    try {
      return await api.overlay.getState()
    } catch (error) {
      return null
    }
  },
  update(items) { fireAndForget('overlay', 'update', { items }) },
  reset() { fireAndForget('overlay', 'reset', {}) },
}

export function setNavigationTitle(title) {
  const api = bridge()
  if (!api || !api.navigation || typeof api.navigation.setTitle !== 'function') return
  try {
    const result = api.navigation.setTitle(title)
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch (error) { /* 忽略 */ }
}
