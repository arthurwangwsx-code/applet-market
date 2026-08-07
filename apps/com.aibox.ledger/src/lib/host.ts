// 宿主桥接口：**共享部分全部转发给 `@aibox/applet-sdk`**（2026-08-05 迁移，理由同 finance）。
// 语义分歧由 SDK 统一裁定：confirm 不可用回 false（不是 null）、openURL 一律超时封顶。

import { available, bridge, events, intelligence, ui } from '@aibox/applet-sdk'
import type { JSONValue } from '@aibox/applet-sdk'

export function hasNamespace(name: string, method?: string): boolean {
  return available(name, method)
}

export const capabilities = {
  get db() {
    return hasNamespace('db', 'query')
  },
  get tabs() {
    return hasNamespace('tabs', 'getState')
  },
  get toolbar() {
    return hasNamespace('toolbar', 'on')
  },
  get menu() {
    return hasNamespace('menu', 'update')
  },
  get navigation() {
    return hasNamespace('navigation', 'setTitle')
  },
  get scene() {
    return hasNamespace('scene', 'getState')
  },
  get ai() {
    return hasNamespace('ai', 'generate')
  },
  get net() {
    return hasNamespace('net', 'fetch')
  },
  get ui() {
    return hasNamespace('ui', 'confirm')
  },
  get picker() {
    return hasNamespace('picker', 'file')
  },
  get resource() {
    return hasNamespace('resource', 'readText')
  },
  get shareFile() {
    return hasNamespace('share', 'file')
  },
  get shareText() {
    return hasNamespace('share', 'text')
  },
  get haptics() {
    return hasNamespace('haptics', 'impact')
  },
  get vision() {
    return hasNamespace('vision', 'recognizeText')
  },
}

// MARK: - storage（轻量偏好；不承载账本主数据）

const memoryStore = new Map<string, JSONValue>()

export const storage = {
  async get(key: string): Promise<JSONValue | null> {
    const api = bridge()
    if (!api || !api.storage) return memoryStore.get(key) ?? null
    try {
      const value = await api.storage.get(key)
      return value === undefined ? null : value
    } catch (error) {
      return null
    }
  },
  async set(key: string, value: JSONValue): Promise<boolean> {
    const api = bridge()
    if (!api || !api.storage) {
      memoryStore.set(key, value)
      return true
    }
    try {
      await api.storage.set(key, value)
      return true
    } catch (error) {
      return false
    }
  },
}

// MARK: - net（原生代理，无 CORS 问题）

/** GET → `{ ok, status, body }`；软超时由调用方给（桥不接受 per-request timeout）。 */
export async function httpGetJSON(
  url: string,
  { timeoutMs = 12000 }: { timeoutMs?: number } = {},
): Promise<{
  ok: boolean
  status?: number
  body?: unknown
}> {
  const api = bridge()
  if (!api || !api.net || typeof api.net.fetch !== 'function') return { ok: false }
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<{ __timeout: true }>((resolve) => {
    timer = setTimeout(() => resolve({ __timeout: true }), timeoutMs)
  })
  try {
    const response = await Promise.race([api.net.fetch(url, { method: 'GET', responseType: 'json' }), timeout])
    if (!response || '__timeout' in response) return { ok: false }
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

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    return null
  }
}

// MARK: - ui（原生对话框；缺席时由调用方走自绘弹层）

/** 语义已统一：问不出来 = 没确认（false）。破坏性操作的默认答案必须是「不做」。 */
export async function nativeConfirm(input: {
  title?: string
  message?: string
  confirmTitle?: string
  destructive?: boolean
}): Promise<boolean> {
  return ui.confirm({
    title: input.title,
    message: input.message,
    actions: input.confirmTitle
      ? [
          { id: 'cancel', title: 'Cancel', role: 'cancel' },
          { id: 'confirm', title: input.confirmTitle, role: input.destructive ? 'destructive' : 'default' },
        ]
      : undefined,
  })
}

export const nativeAlert = ui.alert

/** 原生 action sheet（长按菜单）。返回选中的 id；不可用返回 undefined。 */
export const nativeActionSheet = ui.actionSheet

// MARK: - picker / resource（CSV 导入）

/**
 * 选一张图并**端上**识别其中的文字。返回 `{ ok, text, empty }`。
 *
 * 两段都在设备里完成：`picker.photo` 把用户选的图收进本应用的私有资源区，
 * `vision.recognizeText` 用系统 Vision 框架读它。**图片不上传、也不进模型** ——
 * 这正是原生记账那个「本地识别（图不上传）」开关的语义，只是这条路上没有另一个会上传的选项。
 *
 * 失败一律回可判定的 reason，不抛到 UI 层。
 */
export async function scanImageText() {
  const api = bridge()
  if (!api || !api.picker || typeof api.picker.photo !== 'function') {
    return { ok: false, reason: 'unavailable' }
  }
  if (!api.vision || typeof api.vision.recognizeText !== 'function') {
    return { ok: false, reason: 'noVision' }
  }
  let handle
  try {
    const picked = await api.picker.photo({ limit: 1 })
    if (!picked || picked.cancelled) return { ok: false, reason: 'cancelled' }
    const item = (picked.items ?? [])[0]
    if (!item || !item.handle) return { ok: false, reason: 'cancelled' }
    handle = item.handle
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
  try {
    const res = await api.vision.recognizeText({ handle, languages: ['zh-Hans', 'en'] })
    const text = String((res && res.text) || '')
    // 「没认出文字」是正常结果（拍糊、纯图），不是错误 —— 让调用方能说人话而不是报错。
    return { ok: true, text, empty: text.trim().length === 0 }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}

/** 弹系统文档选择器读一个文本文件。返回 `{ ok, text, name }`。 */
export async function pickTextFile(
  types: string[],
): Promise<{ ok: true; text: string; name: string } | { ok: false; reason: string }> {
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
    return { ok: false, reason: errorMessage(error) }
  }
}

// MARK: - share（CSV 导出）

/**
 * 导出一个带文件名的文件。优先 `aibox.share.file`（合同见 app-shell-and-market.md §3.5）；
 * 宿主还没实现时降级到 `aibox.share.text`（接收方拿到的是一段文字而不是文件，调用方要告知用户）。
 * 返回 `'file' | 'text' | false`。
 */
export async function shareFile(input: {
  filename: string
  content: string
  mimeType?: string
}): Promise<'file' | 'text' | false> {
  const api = bridge()
  if (!api?.share) return false
  try {
    if (typeof api.share.file === 'function') {
      await api.share.file(input)
      return 'file'
    }
    if (typeof api.share.text === 'function') {
      await api.share.text({ text: input.content })
      return 'text'
    }
  } catch (error) {
    return false
  }
  return false
}

// MARK: - ai

export const aiAvailability = intelligence.aiAvailability

export const aiGenerate = intelligence.aiGenerate

// MARK: - 事件总线 / 外壳

export const onEvent = events.on

export function onNamespaceEvent<T>(namespace: string, event: string, handler: (payload: T) => void): () => void {
  return events.shellOn(namespace, event, (payload) => handler(payload as T))
}

export function bridgeAPI() {
  return bridge()
}

/** 轻微触感（有就用，没有就算了）。 */
export function tapFeedback() {
  const api = bridge()
  if (api && api.haptics && typeof api.haptics.impact === 'function') {
    try {
      api.haptics.impact({ style: 'light' })
    } catch (error) {
      /* 无所谓 */
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
