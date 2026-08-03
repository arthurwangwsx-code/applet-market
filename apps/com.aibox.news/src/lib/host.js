// 宿主桥的薄封装。三条纪律：
//  1. 每个能力都**先探测再使用**——宿主没装/没授权时 window.aibox.<ns> 根本不存在，
//     入口要整块不渲染，而不是点了没反应；
//  2. 所有调用都不抛到 UI 层，失败回落成一个可判定的返回值；
//  3. 没有 aibox 时（例如在普通浏览器里预览）退化成内存实现，页面仍能跑。

const bridge = () => (typeof window !== 'undefined' ? window.aibox : undefined)

// MARK: - 能力探测

export function hasNamespace(name, method) {
  const api = bridge()
  if (!api || !api[name]) return false
  return method ? typeof api[name][method] === 'function' : true
}

export const capabilities = {
  get tabs() { return hasNamespace('tabs', 'getState') },
  get toolbar() { return hasNamespace('toolbar', 'on') },
  get browser() { return hasNamespace('browser', 'open') },
  get tts() { return hasNamespace('tts', 'speak') },
  get ai() { return hasNamespace('ai', 'generate') },
  get tools() { return hasNamespace('tools', 'call') },
  get openURL() { return hasNamespace('open', 'url') },
  get net() { return hasNamespace('net', 'fetch') },
}

// MARK: - storage（KV）

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
  async list() {
    const api = bridge()
    if (!api || !api.storage) return [...memoryStore.keys()]
    try {
      const keys = await api.storage.list()
      return Array.isArray(keys) ? keys : []
    } catch (error) {
      return []
    }
  },
}

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
}

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AiBox/1.0'
export const HTTP_TIMEOUT_MS = 8000
/** feed 抓取的响应体上限。桥默认 200KB，全文 RSS 很容易超；显式放宽到 1MB。 */
export const FEED_MAX_BYTES = 1000 * 1000
/** 整页抓取（正文抽取）的上限：抽完只留 8000 字符，不必把整页都搬过桥。 */
export const PAGE_MAX_BYTES = 512 * 1000

function classifyError(message) {
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
  if (text.includes('offline') || text.includes('network') || text.includes('connection')
      || text.includes('host') || text.includes('internet')) return FAILURE.network
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
let netGate = null
/** 闸门的硬上限：桥自己最多跑 30s；再久一定是宿主侧卡死，不能让整个应用陪着一起停。 */
const NET_GATE_MAX_WAIT_MS = 30000

/**
 * @param {() => { call: Promise<any>, raced: Promise<any> }} attempt
 *   `call` = 桥的原始 promise（闸门的放行信号）；`raced` = 叠了页面侧软超时的结果。
 */
function throughNetGate(attempt) {
  if (netGate === null) {
    const { call, raced } = attempt()
    // 放闸只认「桥真的回话」（＝用户已经答复了授权弹窗），**不认页面侧软超时**——
    // 否则 8s 一到就放闸，弹窗还举在屏幕上，后面 5 个请求照样各弹一次。
    netGate = Promise.race([
      call.then(() => {}, () => {}),
      new Promise((resolve) => { setTimeout(resolve, NET_GATE_MAX_WAIT_MS) }),
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
export async function httpGet(url, { timeoutMs = HTTP_TIMEOUT_MS, maxBytes } = {}) {
  const api = bridge()
  if (!api || !api.net || typeof api.net.fetch !== 'function') {
    return { ok: false, failure: FAILURE.configuration }
  }
  if (!/^https?:\/\//i.test(String(url || ''))) {
    return { ok: false, failure: FAILURE.invalidURL }
  }

  const options = { method: 'GET', headers: { 'User-Agent': USER_AGENT } }
  if (maxBytes) options.maxBytes = maxBytes

  // 软超时在**拿到闸门之后**才起算：排队等首次授权的请求，不该被自己的排队时间判成超时。
  const attempt = () => {
    const call = api.net.fetch(url, options)
    let timer = null
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ __timeout: true }), timeoutMs)
    })
    const clear = () => { if (timer) clearTimeout(timer) }
    const raced = Promise.race([call, timeout]).then(
      (value) => { clear(); return value },
      (error) => { clear(); throw error },
    )
    return { call, raced }
  }

  try {
    const response = await throughNetGate(attempt)
    if (response && response.__timeout) return { ok: false, failure: FAILURE.timeout }
    const status = Number((response && response.status) || 0)
    if (status < 200 || status >= 300) {
      return { ok: false, failure: FAILURE.http, httpStatus: status }
    }
    const body = String((response && response.body) || '')
    const legacyBridge = !(response && typeof response === 'object' && 'truncated' in response)
    if (legacyBridge && body === '') {
      return { ok: false, failure: FAILURE.responseTooLarge, httpStatus: status, legacyBridge }
    }
    return {
      ok: true,
      status,
      body,
      truncated: !!(response && response.truncated),
      legacyBridge,
    }
  } catch (error) {
    return { ok: false, failure: classifyError(error && error.message) }
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
export function imageURL(url, widthPoints) {
  const raw = String(url || '')
  if (!/^https?:\/\//i.test(raw) || !bridge()) return raw
  let encoded
  try {
    const bytes = new TextEncoder().encode(raw)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
    encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch (error) {
    return raw
  }
  const width = Number(widthPoints) > 0 ? `?w=${Math.round(Number(widthPoints))}` : ''
  return `applet://localhost/image/${encoded}${width}`
}

// MARK: - browser（打开文章）

export async function browserAvailability() {
  const api = bridge()
  if (!api || !api.browser) return { modes: [], reader: false }
  try {
    if (typeof api.browser.availability !== 'function') {
      return { modes: ['inApp'], reader: typeof api.browser.openArticle === 'function' }
    }
    const info = await api.browser.availability()
    return {
      modes: Array.isArray(info && info.modes) ? info.modes : [],
      reader: !!(info && info.reader),
    }
  } catch (error) {
    return { modes: [], reader: false }
  }
}

/**
 * 打开类调用的封顶时长。
 *
 * `browser.*` 是动作型能力，桥会**先弹一次授权**再执行 —— 只要那个弹窗没人回答，
 * `api.browser.openArticle()` 的 promise 就**永远不 settle**（实测：无头下等 4s 仍是 pending，
 * 弹窗当时正举在另一个界面上）。原来的写法直接 `await` 它，于是点一篇文章的表现就是
 * 「点了没反应」，连降级链都轮不到跑。这里给它封顶：超时按失败处理并让 UI 说出来。
 */
const OPEN_TIMEOUT_MS = 12000
const TIMED_OUT = Symbol('timeout')

function withTimeout(promise, ms) {
  let timer = null
  const clear = () => { if (timer) clearTimeout(timer) }
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), ms) })
  return Promise.race([promise, timeout]).then(
    (value) => { clear(); return value },
    (error) => { clear(); throw error },
  )
}

export async function openArticle(payload) {
  const api = bridge()
  if (api && api.browser && typeof api.browser.openArticle === 'function') {
    try {
      // 超时**不再往下级联**：降级链上的每一跳都是动作型能力，会再弹一次授权，
      // 用户等来的就是一串弹窗。迟迟不回话时如实回 false，由调用方提示。
      if (await withTimeout(api.browser.openArticle(payload), OPEN_TIMEOUT_MS) === TIMED_OUT) return false
      return true
    } catch (error) {
      /* 落到下面的降级链 */
    }
  }
  return openURL(payload.url, 'inApp')
}

export async function openURL(url, mode = 'inApp') {
  const api = bridge()
  if (api && api.browser && typeof api.browser.open === 'function') {
    try {
      if (await withTimeout(api.browser.open({ url, mode }), OPEN_TIMEOUT_MS) === TIMED_OUT) return false
      return true
    } catch (error) {
      /* 落到 open.url */
    }
  }
  if (api && api.open && typeof api.open.url === 'function') {
    try {
      return await withTimeout(api.open.url({ url }), OPEN_TIMEOUT_MS) !== TIMED_OUT
    } catch (error) {
      return false
    }
  }
  return false
}

// MARK: - tts

export async function speak(text, lang) {
  const api = bridge()
  if (!api || !api.tts || typeof api.tts.speak !== 'function') return false
  try {
    const ok = await api.tts.speak({ text, lang })
    return ok !== false
  } catch (error) {
    return false
  }
}

export async function stopSpeaking() {
  const api = bridge()
  if (!api || !api.tts || typeof api.tts.stop !== 'function') return false
  try {
    await api.tts.stop({})
    return true
  } catch (error) {
    return false
  }
}

// MARK: - ai

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

export async function aiGenerate(input) {
  const api = bridge()
  if (!api || !api.ai || typeof api.ai.generate !== 'function') throw new Error('aibox/ai-unavailable')
  return api.ai.generate(input)
}

// MARK: - tools（长尾工具网关；知识库入库用）

export async function findTool(name) {
  const api = bridge()
  if (!api || !api.tools || typeof api.tools.describe !== 'function') return false
  try {
    await api.tools.describe({ name })
    return true
  } catch (error) {
    return false
  }
}

export async function callTool(name, args) {
  const api = bridge()
  if (!api || !api.tools || typeof api.tools.call !== 'function') return { ok: false }
  try {
    const result = await api.tools.call({ name, arguments: args })
    return result && typeof result === 'object' ? result : { ok: false }
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) }
  }
}

// MARK: - 事件总线

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
