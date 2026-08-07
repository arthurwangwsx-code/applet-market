// 宿主桥接口：**共享部分转发给 `@aibox/applet-sdk`**（2026-08-05 迁移）。
// 分叉的代价不是重复代码，是同一件事有好几个答案；语义现在由 SDK 统一裁定
// （confirm 不可用回 false、openURL 一律超时封顶、图片走 applet:// 不走 data:）。
// 本文件只留这个应用**自己的**东西：领域投影与外壳编排。

import { bridge, system } from '@aibox/applet-sdk'
import type { JSONValue, ResolvedVideo } from '@aibox/applet-sdk'

import { imageURL as uiImageURL } from 'aibox/ui'
import type { AppletRequestError, PlaybackSettings, VideoCapabilities, VideoProgress } from './types.js'
import { errorMessage } from './types.js'

const PERMISSION_HINT =
  '需要先允许这个小应用联网：在 App 的能力中心里打开它的网络权限，' +
  '然后回到这里重试。（从市场安装的小应用默认不带任何授权。）'

type NetMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'
type NetResponseType = 'text' | 'base64' | 'json'

interface FetchOptions {
  method?: NetMethod
  headers?: Record<string, string>
  body?: string
  responseType?: NetResponseType
  maxBytes?: number
}

interface VideoStageResult {
  rendered: boolean
  available: boolean
  aspect?: string
  backgroundAudio?: boolean
  pictureInPicture?: boolean
  gestureControls?: boolean
}

function isPermissionError(message: string): boolean {
  return /aibox\/(not-granted|denied|not-visible)/.test(String(message || ''))
}

/** 「发了就不管」的桥调用：桥回的是 Promise，能力不可用时是 reject 而不是 throw。 */
function fireAndForget(thunk: () => unknown): void {
  try {
    const result = thunk()
    if (result instanceof Promise) result.catch(() => {})
  } catch {
    /* 连命名空间都不在 */
  }
}

// —— 网络 ——————————————————————————————————————————————

export async function fetchJSON<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const api = bridge()
  if (!api?.net?.fetch) throw new Error('宿主没有开放网络能力')
  const { method = 'GET', headers = {}, body, responseType = 'json', maxBytes = 2 * 1024 * 1024 } = options
  let res: Awaited<ReturnType<typeof api.net.fetch>>
  try {
    const payload: FetchOptions = { method, headers, responseType, maxBytes }
    if (body !== undefined) payload.body = body
    res = await api.net.fetch(url, payload)
  } catch (cause) {
    const raw = errorMessage(cause)
    if (isPermissionError(raw)) {
      const denied: AppletRequestError = new Error(PERMISSION_HINT)
      denied.permission = true
      throw denied
    }
    const err: AppletRequestError = new Error(raw)
    err.retryable = true
    throw err
  }
  // InnerTube 的响应有 450KB+，默认 200KB 会**静默截断**成解不出来的半截 JSON。
  // 这条判定不能省：截断与「服务器就返回这么多」在 body 上看不出区别。
  if (res?.truncated) throw new Error('响应过大被截断（请提高 maxBytes）')
  if (typeof res?.status === 'number' && (res.status < 200 || res.status >= 300)) {
    const err: AppletRequestError = new Error(`HTTP ${res.status}`)
    err.retryable = res.status >= 500 || res.status === 429
    throw err
  }
  return res.body as T
}

// —— 图片 ——————————————————————————————————————————————

/** 缩略图必须走这条：secure CSP 会把裸 https 的 `<img>` 拦成空白。 */
export function imageURL(url: string, width?: number): string {
  if (!url) return ''
  return uiImageURL(url, width ? { width } : undefined)
}

// —— 视频：解析 + 播放 ——————————————————————————————

/**
 * 宿主这个构建能干什么。三条独立：
 *  · `available` 有播放引擎
 *  · `resolve`   有解析栈（没有就整个应用没意义，页面要明说）
 *  · `dash`      能播分离流（没有就只剩低清；YouTube 的高清全是 dash）
 */
export async function capabilities(): Promise<VideoCapabilities> {
  const api = bridge()
  // `aibox.video` 命名空间整个不在 = 宿主 App 太旧（没有这条桥）。与「桥在但引擎缺席」
  // 排查方向完全相反，所以用 `reason` 区分，别合成一个布尔。
  if (!api?.video?.availability) {
    return {
      available: false,
      resolve: false,
      dash: false,
      stage: false,
      embeddedPlayer: false,
      reason: 'noBridge',
    }
  }
  try {
    const res = await api.video.availability()
    return {
      available: !!res?.available,
      resolve: !!res?.resolve,
      dash: !!res?.dash,
      // 这次执行能不能开舞台（无头执行恒 false）。
      stage: !!res?.stage,
      // 这个**构建**里有没有内嵌播放器实现。
      embeddedPlayer: 'embeddedPlayer' in res && !!res.embeddedPlayer,
      reason: res?.available ? 'ok' : 'noEngine',
    }
  } catch {
    return {
      available: false,
      resolve: false,
      dash: false,
      stage: false,
      embeddedPlayer: false,
      reason: 'noBridge',
    }
  }
}

/**
 * 打开页面顶部的原生视频区。
 *
 * **必须先开舞台再 play**：舞台开着时播放内嵌在这块区域，页面保持竖屏、内容在下面滚；
 * 没开舞台就 play 会接管整屏并转横屏 —— 对一个「边看边翻清晰度/相似视频」的页面是错的。
 */
export async function openStage(settings: PlaybackSettings): Promise<VideoStageResult> {
  const api = bridge()
  if (!api?.video?.stage) return { rendered: false, available: false }
  try {
    // 参数来自**用户偏好**（「我的 → 播放设置」），不写死 ——
    // 「只想听」和「边做别的边看」是两种诉求，写死必然让一半人被迫接受另一半的行为。
    return await api.video.stage({
      aspect: '16:9',
      backgroundAudio: settings?.backgroundAudio !== false,
      pictureInPicture: settings?.pictureInPicture !== false,
      gestureControls: settings?.gestureControls !== false,
    })
  } catch {
    return { rendered: false, available: false }
  }
}

/** 收起视频区。**不停止播放** —— 用户可能正想让它转画中画或后台听声。 */
export async function closeStage(): Promise<void> {
  fireAndForget(() => bridge()?.video?.dismissStage?.())
}

/** 解析一个视频页，回可播格式。 */
export async function resolve(url: string): Promise<ResolvedVideo> {
  const api = bridge()
  if (!api?.video?.resolve) throw new Error('这个版本没有媒体解析能力')
  return api.video.resolve({ url })
}

/**
 * 播放。**必须传 sourceURL + formatID**，不能拿 resolve 回的裸 url 去播——
 * 那条会丢掉取流请求头与分轨信息（宿主刻意不把它们透给页面）。
 */
export async function play({
  sourceURL,
  formatID,
  resumeFrom = 0,
}: {
  sourceURL: string
  formatID: string
  resumeFrom?: number
}): Promise<{ playing: boolean }> {
  const api = bridge()
  if (!api?.video?.play) throw new Error('宿主没有视频播放能力')
  // **不传 presentation**：舞台开着时宿主自动内嵌。显式传 'immersive' 会强行接管整屏并转横屏，
  // 那正是舞台要解决的问题。
  return api.video.play({ sourceURL, formatID, resumeFrom })
}

export function onVideoProgress(handler: (snapshot: VideoProgress) => void): () => void {
  const api = bridge()
  if (!api?.video?.subscribe || !api?.events?.on) return () => {}
  let off = () => {}
  try {
    off = api.events.on<VideoProgress>('video.progress', handler) || (() => {})
  } catch {
    return () => {}
  }
  fireAndForget(() => api.video.subscribe())
  return () => {
    fireAndForget(() => api.video.unsubscribe?.())
    try {
      off()
    } catch {
      /* 已退订 */
    }
  }
}

// —— 存储与交互 ——————————————————————————————————

export async function loadPref<T>(key: string, fallback: T): Promise<T> {
  const api = bridge()
  if (!api?.storage?.get) return fallback
  try {
    const value = await api.storage.get(key)
    return value == null ? fallback : (value as T)
  } catch {
    return fallback
  }
}

export async function savePref(key: string, value: unknown): Promise<void> {
  try {
    await bridge()?.storage?.set?.(key, value as JSONValue)
  } catch {
    /* 偏好存不住不影响主流程 */
  }
}

export function haptic(kind: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' = 'light'): void {
  fireAndForget(() => bridge()?.haptics?.impact?.({ style: kind }))
}

export function toast(message: string): void {
  fireAndForget(() => bridge()?.toast?.show?.({ message }))
}

export const copyText = system.copyText

export async function share(text: string, url?: string): Promise<boolean> {
  const api = bridge()
  if (!api?.share?.text) return false
  try {
    return await api.share.text(url ? { text, url } : { text })
  } catch {
    return false
  }
}

/** 本应用没做的页面（频道、评论）交给宿主浏览器，而不是留死路。 */
export const openInBrowser = system.openInBrowser
