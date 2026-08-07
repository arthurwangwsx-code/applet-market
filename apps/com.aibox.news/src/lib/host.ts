// 宿主桥接口：**共享部分转发给 `@aibox/applet-sdk`**（2026-08-05 迁移）。
// 保留本应用自己的东西：httpGet 的单飞闸 / 软超时 / maxBytes 是**领域策略**（RSS 源千奇百怪），
// 不是桥胶水，不进 SDK。

import { bridge, events, system, intelligence } from '@aibox/applet-sdk'
import type { FetchFailure } from '../types.js'

// MARK: - net（原生代理）

export const FAILURE = {
  configuration: 'configuration',
  /** 用户没给（或拒了）网络授权。**必须与 configuration 分开**：它有明确的用户可执行修法。 */
  permission: 'permission',
  /** 域名不在 manifest 的 networkAllowed 里 —— 是应用的声明缺口，用户改不了。 */
  blocked: 'blocked',
  invalidURL: 'invalidURL',
  timeout: 'timeout',
  network: 'network',
  http: 'http',
  responseTooLarge: 'responseTooLarge',
  circuitOpen: 'circuitOpen',
  decoding: 'decoding',
  cancelled: 'cancelled',
  unknown: 'unknown',
} as const satisfies Record<FetchFailure, FetchFailure>

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AiBox/1.0'
export const HTTP_TIMEOUT_MS = 8000
/** feed 抓取的响应体上限。桥默认 200KB，全文 RSS 很容易超；显式放宽到 1MB。 */
export const FEED_MAX_BYTES = 1000 * 1000
/** 整页抓取（正文抽取）的上限：抽完只留 8000 字符，不必把整页都搬过桥。 */
export const PAGE_MAX_BYTES = 512 * 1000

function classifyError(message: unknown): FetchFailure {
  const text = String(message || '').toLowerCase()
  // 桥的两条 `aibox/denied` 语义完全不同，**不能都记成「缺少配置」**：
  // 「用户拒绝网络」用户自己能改，「不在 networkAllowed 里」只有改 manifest 能修。
  if (text.includes('declined network access')) return FAILURE.permission
  if (text.includes('networkallowed')) return FAILURE.blocked
  if (text.includes('aibox/denied')) return FAILURE.permission
  if (text.includes('timed out') || text.includes('timeout')) return FAILURE.timeout
  if (text.includes('cancel')) return FAILURE.cancelled
  if (text.includes('invalid') || text.includes('non-http')) return FAILURE.invalidURL
  if (text.includes('too large')) return FAILURE.responseTooLarge
  if (
    text.includes('offline') ||
    text.includes('network') ||
    text.includes('connection') ||
    text.includes('host') ||
    text.includes('internet')
  )
    return FAILURE.network
  return FAILURE.unknown
}

/**
 * 首次外联的**单飞闸**。
 *
 * 宿主对 `net` 的授权是「每个 applet 每会话弹一次」，但它的会话记忆是在 `await authorizer` **之后**
 * 才写的 —— 同一时刻并发的 N 个 `net.fetch` 会**全部**抢在记忆写入前越过判重，于是用户被弹 N 次
 * （实测：`FETCH_CONCURRENCY = 6` 的首刷 → 6 个「允许访问？」叠在一起）。用户随手点一次「不允许」，
 * 那个 false 就会盖掉其他人的 true 并锁住整个会话，之后连弹窗都不再出现 —— 这正是真机「永远没有新闻」
 * 的成因。
 *
 * 应用侧的对策：**第一次外联只放一个请求过去**，其余请求排在它后面；等它落地（授权已被宿主记住）
 * 再全量并发。代价只有首刷的一个 RTT，换来的是「只弹一次」。
 */
let netGate: Promise<void> | null = null
/** 闸门的硬上限：桥自己最多跑 30s；再久一定是宿主侧卡死，不能让整个应用陪着一起停。 */
const NET_GATE_MAX_WAIT_MS = 30000

/**
 * @param {() => { call: Promise<unknown>, raced: Promise<unknown> }} attempt
 *   `call` = 桥的原始 promise（闸门的放行信号）；`raced` = 叠了页面侧软超时的结果。
 */
type NetAttempt = { call: Promise<unknown>; raced: Promise<unknown> }
function throughNetGate(attempt: () => NetAttempt): Promise<unknown> {
  if (netGate === null) {
    const { call, raced } = attempt()
    // 放闸只认「桥真的回话」（＝用户已经答复了授权弹窗），**不认页面侧软超时**——
    // 否则 8s 一到就放闸，弹窗还举在屏幕上，后面 5 个请求照样各弹一次。
    netGate = Promise.race([
      call.then(
        () => {},
        () => {},
      ),
      new Promise<void>((resolve) => {
        setTimeout(resolve, NET_GATE_MAX_WAIT_MS)
      }),
    ])
    return raced
  }
  const next = () => attempt().raced
  return netGate.then(next, next)
}

/**
 * GET 一个 URL，返回 `{ ok, body, status, truncated, failure, httpStatus }`。
 *
 * · 8 秒软超时：桥不接受 per-request timeout，故用 Promise.race 在页面侧封顶
 *   （原生请求本身会继续跑到 30s，但页面不再等它）。
 * · `maxBytes` 是新版桥的可选项。`handleNet` 对 options **不做未知键校验**（只挑自己认识的键读），
 *   所以新 option 在老宿主被忽略、未知 option 在新宿主也被忽略，两个方向都安全，不需要探测。
 *   不传时桥按 200KB 截断。
 * · **老宿主判据 = 响应里有没有 `truncated` 字段**（不是读它的值）。老宿主既不认 `maxBytes`
 *   也不回 `truncated`，且它对 >200KB 的多字节正文是**按字节切断** → UTF-8 解码失败 → 回空串。
 *   所以在老宿主上「200 + 空 body」几乎必然是被截爆了，这里升级成 `responseTooLarge`：
 *   诊断页会显示「响应过大」而不是把这个源静静记成「暂无内容」。
 *   新宿主按字符边界截断并回 `truncated:true`，空 body 就照实是空 body（＝原生的「空来源」语义）。
 */
export interface HttpGetResult {
  ok: boolean
  body: string
  status: number
  truncated: boolean
  legacyBridge: boolean
  failure: FetchFailure | null
  httpStatus: number | null
}

const failedHTTP = (failure: FetchFailure, httpStatus: number | null = null, legacyBridge = false): HttpGetResult => ({
  ok: false,
  body: '',
  status: httpStatus ?? 0,
  truncated: false,
  legacyBridge,
  failure,
  httpStatus,
})

export async function httpGet(
  url: string,
  { timeoutMs = HTTP_TIMEOUT_MS, maxBytes }: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<HttpGetResult> {
  const api = bridge()
  if (!api || !api.net || typeof api.net.fetch !== 'function') {
    return failedHTTP(FAILURE.configuration)
  }
  if (!/^https?:\/\//i.test(String(url || ''))) {
    return failedHTTP(FAILURE.invalidURL)
  }

  const options: aibox.net.FetchOptions = { method: 'GET', headers: { 'User-Agent': USER_AGENT } }
  if (maxBytes) options.maxBytes = maxBytes

  // 软超时在**拿到闸门之后**才起算：排队等首次授权的请求，不该被自己的排队时间判成超时。
  const attempt = () => {
    const call = api.net.fetch(url, options)
    let timer: ReturnType<typeof setTimeout> | null = null
    const timeout = new Promise<{ __timeout: true }>((resolve) => {
      timer = setTimeout(() => resolve({ __timeout: true }), timeoutMs)
    })
    const clear = () => {
      if (timer) clearTimeout(timer)
    }
    const raced = Promise.race([call, timeout]).then(
      (value) => {
        clear()
        return value
      },
      (error) => {
        clear()
        throw error
      },
    )
    return { call, raced }
  }

  try {
    const response = await throughNetGate(attempt)
    if (response && typeof response === 'object' && '__timeout' in response) return failedHTTP(FAILURE.timeout)
    const result = response as Partial<aibox.net.FetchResponse> | null
    const status = Number((result && result.status) || 0)
    if (status < 200 || status >= 300) {
      return failedHTTP(FAILURE.http, status)
    }
    const body = String((result && result.body) || '')
    const legacyBridge = !(result && typeof result === 'object' && 'truncated' in result)
    if (legacyBridge && body === '') {
      return failedHTTP(FAILURE.responseTooLarge, status, legacyBridge)
    }
    return {
      ok: true,
      status,
      body,
      truncated: !!result?.truncated,
      legacyBridge,
      failure: null,
      httpStatus: null,
    }
  } catch (error) {
    return failedHTTP(classifyError(error instanceof Error ? error.message : error))
  }
}

// MARK: - 图片（applet:// 字节通道）

/**
 * 远端图片地址 → `applet://localhost/image/<base64url(原始URL)>?w=<CSS 点>`。
 *
 * secure 模式的 CSP 是 `img-src applet: data: blob:` —— 裸 `<img src="https://…">` **一定是空白**，
 * 控制台只会刷一串 Failed to load。宿主为此专门开了这条字节通道（还顺带复用两级图片缓存与降采样），
 * 缩略图必须走它。域名判定与 `net.fetch` 同一套白名单：不在 networkAllowed 里会回 403（不是静默空白），
 * 由 `<img onError>` 落到占位图。
 *
 * `w` 收的是 **CSS 点**，由宿主自己乘屏幕倍率 —— 页面侧不许再乘 devicePixelRatio。
 * 拿不到桥时（普通浏览器里预览）原样返回。
 */
export function imageURL(url: string | null | undefined, widthPoints: number) {
  const raw = String(url || '')
  if (!/^https?:\/\//i.test(raw) || !bridge()) return raw
  let encoded
  try {
    const bytes = new TextEncoder().encode(raw)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
    encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch (error) {
    return raw
  }
  const width = Number(widthPoints) > 0 ? `?w=${Math.round(Number(widthPoints))}` : ''
  return `applet://localhost/image/${encoded}${width}`
}

// MARK: - browser（打开文章）

export const browserAvailability = system.browserAvailability

export const openArticle = system.openArticle

export const openURL = system.openURL

// MARK: - tts

export const speak = system.speak

export const stopSpeaking = system.stopSpeaking

// MARK: - ai

export const aiAvailability = intelligence.aiAvailability

export const aiGenerate = intelligence.aiGenerate

// MARK: - tools（长尾工具网关；知识库入库用）

/**
 * 某个宿主工具「现在能不能调」。
 *
 * ⚠️ 别用 `tools.describe` 探：它在工具不可用时**reject**，而容器会把每一次 reject 写进 console.error。
 * 于是一次纯粹的能力探测在每轮验收里都留下一条
 * `aibox/denied: tool 'vault_create' is not granted to this applet`——功能上完全正确（下面 catch 了、
 * 菜单项也正确地不出现），但它长得跟真故障一模一样，把无头验收的信噪比拖下去。
 *
 * `aibox.access.explain` 是容器为这件事准备的**只读**入口：它永远 resolve，回
 * `{ allowed, code, failedGate, remedies }`，不产生错误日志。老宿主没有 access 面时回落到旧探法。
 */
export const findTool = intelligence.findTool

export const callTool = intelligence.callTool

// MARK: - 事件总线

export const onEvent = events.on

export const onNamespaceEvent = events.shellOn
