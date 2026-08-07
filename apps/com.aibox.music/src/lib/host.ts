// 宿主桥接口：**共享部分转发给 `@aibox/applet-sdk`**（2026-08-05 迁移）。
// 分叉的代价不是重复代码，是同一件事有好几个答案；语义现在由 SDK 统一裁定
// （confirm 不可用回 false、openURL 一律超时封顶、图片走 applet:// 不走 data:）。
// 本文件只留这个应用**自己的**东西：领域投影与外壳编排。

import { available, bridge, events, registerAction as registerSDKAction, system, ui } from '@aibox/applet-sdk'
import type { ActionHandler, ActionName, JSONValue } from '@aibox/applet-sdk'
import type { MusicCallResult, MusicMethod } from './types.js'

export function hasNamespace(name: string, method?: string): boolean {
  return available(name, method)
}

export const capabilities = {
  get music() {
    return hasNamespace('music', 'status')
  },
  get haptics() {
    return hasNamespace('haptics', 'impact')
  },
  get share() {
    return hasNamespace('share', 'text')
  },
  get openURL() {
    return hasNamespace('open', 'url')
  },
  get ui() {
    return hasNamespace('ui', 'confirm')
  },
  get tabs() {
    return hasNamespace('tabs', 'getState')
  },
  get toolbar() {
    return hasNamespace('toolbar', 'on')
  },
  get net() {
    return hasNamespace('net', 'fetch')
  },
  get storage() {
    return hasNamespace('storage', 'get')
  },
  get overlay() {
    return hasNamespace('overlay', 'getState')
  },
  get listGestures() {
    return hasNamespace('list', 'configure')
  },
}

// MARK: - music（19 个宿主工具的一等投影）

/**
 * 调一个 `aibox.music.<method>`。统一回 `{ ok, text, json, error }`：
 * - `text` 是工具的原始文本（多数音乐工具把 JSON 直接放在 text 里，不走 details）；
 * - `json` 是 text 能解析成 JSON 时的对象/数组，否则 null；
 * - 失败不抛，`ok:false` + `error` 文本（UI 靠它反推「未授权 / 无订阅 / 真的空」）。
 */
type CallableNamespace = Record<string, ((args: Record<string, unknown>) => Promise<unknown>) | undefined>
type ToolEnvelope = {
  ok?: boolean
  isError?: boolean
  text?: unknown
  details?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function music<T = unknown>(
  method: MusicMethod,
  args: Record<string, unknown> = {},
): Promise<MusicCallResult<T>> {
  const api = bridge()
  const namespace = api?.music as unknown as CallableNamespace | undefined
  const invoke = namespace?.[method]
  if (typeof invoke !== 'function') {
    return { ok: false, text: '', json: null, error: 'aibox/music-unavailable' }
  }
  try {
    const value = await invoke(args)
    const raw: ToolEnvelope = isRecord(value) ? value : {}
    const text = String(raw.text || '')
    const ok = !(raw.ok === false || raw.isError === true)
    return { ok, text, json: parseJSON<T>(text), details: raw.details, error: ok ? null : text }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, text: '', json: null, error: message }
  }
}

export function parseJSON<T = unknown>(text: unknown): T | null {
  const trimmed = String(text || '').trim()
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null
  try {
    return JSON.parse(trimmed) as T
  } catch (error) {
    return null
  }
}

/**
 * 从工具的失败文案反推 Apple Music 可用性——容器没有 `music.availability()`（缺口⑨），
 * 「未授权 / 无订阅 / 真的空」三种空态在原生是分开的，这里只能按文案归类。
 */
export function classifyMusicError(
  text: unknown,
): 'none' | 'denied' | 'noSubscription' | 'cancelled' | 'notFound' | 'error' {
  const value = String(text || '').toLowerCase()
  if (!value) return 'none'
  if (value.includes('not authorized') || value.includes('access not granted') || value.includes('authorization'))
    return 'denied'
  if (value.includes('subscription')) return 'noSubscription'
  if (value.includes('cancelled')) return 'cancelled'
  if (value.includes('not found')) return 'notFound'
  return 'error'
}

// MARK: - 触感

export const haptics = {
  impact(style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' = 'light') {
    fireAndForget('haptics', 'impact', { style })
  },
  selection() {
    fireAndForget('haptics', 'selection', {})
  },
  notify(type: 'success' | 'warning' | 'error' = 'success') {
    fireAndForget('haptics', 'notify', { type })
  },
}

function fireAndForget(namespace: string, method: string, args: Record<string, unknown>): void {
  const api = bridge()
  const root = api as unknown as Record<string, CallableNamespace> | undefined
  const invoke = root?.[namespace]?.[method]
  if (typeof invoke !== 'function') return
  try {
    void invoke(args).catch(() => {})
  } catch (error) {
    /* 触感失败无所谓 */
  }
}

// MARK: - 原生弹层（antd-mobile 的 Toast.show 在本宿主渲染为空，命令式弹层一律走原生或自绘）

/** 二次确认。返回 true 表示用户点了确认键。宿主没有 ui 能力时保守返回 false（不误删）。 */
/** 语义已统一：问不出来 = 没确认。 */
export async function confirm(input: {
  title?: string
  message?: string
  confirmTitle?: string
  cancelTitle?: string
  destructive?: boolean
}): Promise<boolean> {
  return ui.confirm({
    title: input.title,
    message: input.message,
    actions: [
      { id: 'confirm', title: input.confirmTitle || 'OK', role: input.destructive ? 'destructive' : 'default' },
      { id: 'cancel', title: input.cancelTitle || 'Cancel', role: 'cancel' },
    ],
  })
}

/** 原生 action sheet（长按菜单）。actions = [{id,title,role}]，返回被点中的 id 或 null。 */
export const actionSheet = ui.actionSheet

export const prompt = ui.prompt

// MARK: - 分享 / 打开链接

export const shareText = system.shareText

export const openURL = system.openURL

// MARK: - storage

const memoryStore = new Map<string, unknown>()

export const storage = {
  async get<T = unknown>(key: string): Promise<T | null> {
    const api = bridge()
    if (!api || !api.storage) return memoryStore.has(key) ? (memoryStore.get(key) as T) : null
    try {
      const value = await api.storage.get(key)
      return value === undefined ? null : (value as T)
    } catch (error) {
      return null
    }
  },
  async set(key: string, value: unknown): Promise<boolean> {
    const api = bridge()
    if (!api || !api.storage) {
      memoryStore.set(key, value)
      return true
    }
    try {
      await api.storage.set(key, value as JSONValue)
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
export async function fetchImageDataURL(
  url: unknown,
  { maxBytes = 400000 }: { maxBytes?: number } = {},
): Promise<string | null> {
  const api = bridge()
  if (!api || !api.net || typeof api.net.fetch !== 'function') return null
  if (!/^https?:\/\//i.test(String(url || ''))) return null
  try {
    const response = await api.net.fetch(String(url), { method: 'GET', responseType: 'base64', maxBytes })
    const status = Number((response && response.status) || 0)
    const body = String((response && response.body) || '')
    if (status < 200 || status >= 300 || !body) return null
    const mime = (String((response && response.contentType) || 'image/jpeg').split(';')[0] ?? '').trim()
    return `data:${mime || 'image/jpeg'};base64,${body}`
  } catch (error) {
    return null
  }
}

// MARK: - 事件与动作

export const onEvent = events.on

/** 外壳命名空间自带回调，与 aibox.events 是两套机制。 */
export function onNamespaceEvent<T = Record<string, unknown>>(
  namespace: string,
  event: string,
  handler: (payload: T) => void,
): () => void {
  return events.shellOn(namespace, event, (payload) => handler(payload as T))
}

/** 注册一个对外动作（AI / 自动化 / 快捷指令可调用）。处理器必须返回 JSON 可序列化值。 */
export function registerAction<K extends ActionName>(name: K, handler: ActionHandler<K>): void {
  registerSDKAction(name, handler)
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
  select(id: string) {
    fireAndForget('tabs', 'select', { id })
  },
  update(items: unknown) {
    fireAndForget('tabs', 'update', { items })
  },
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
  update(items: unknown) {
    fireAndForget('toolbar', 'update', { items })
  },
  setSearch(patch: Record<string, unknown>) {
    fireAndForget('toolbar', 'setSearch', patch)
  },
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
  update(items: unknown) {
    fireAndForget('overlay', 'update', { items })
  },
  reset() {
    fireAndForget('overlay', 'reset', {})
  },
}

export function setNavigationTitle(title: string): void {
  const api = bridge()
  if (!api || !api.navigation || typeof api.navigation.setTitle !== 'function') return
  try {
    const result = api.navigation.setTitle(title)
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch (error) {
    /* 忽略 */
  }
}
