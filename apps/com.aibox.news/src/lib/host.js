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

function classifyError(message) {
  const text = String(message || '').toLowerCase()
  if (text.includes('aibox/denied')) return FAILURE.configuration
  if (text.includes('timed out') || text.includes('timeout')) return FAILURE.timeout
  if (text.includes('cancel')) return FAILURE.cancelled
  if (text.includes('invalid') || text.includes('non-http')) return FAILURE.invalidURL
  if (text.includes('too large')) return FAILURE.responseTooLarge
  if (text.includes('offline') || text.includes('network') || text.includes('connection')
      || text.includes('host') || text.includes('internet')) return FAILURE.network
  return FAILURE.unknown
}

/**
 * GET 一个 URL，返回 `{ ok, body, status, failure, httpStatus }`。
 * 8 秒软超时：桥不接受 per-request timeout，故用 Promise.race 在页面侧封顶
 * （原生请求本身会继续跑到 30s，但页面不再等它）。
 */
export async function httpGet(url, { timeoutMs = HTTP_TIMEOUT_MS } = {}) {
  const api = bridge()
  if (!api || !api.net || typeof api.net.fetch !== 'function') {
    return { ok: false, failure: FAILURE.configuration }
  }
  if (!/^https?:\/\//i.test(String(url || ''))) {
    return { ok: false, failure: FAILURE.invalidURL }
  }

  let timer = null
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ __timeout: true }), timeoutMs)
  })
  try {
    const response = await Promise.race([
      api.net.fetch(url, { method: 'GET', headers: { 'User-Agent': USER_AGENT } }),
      timeout,
    ])
    if (response && response.__timeout) return { ok: false, failure: FAILURE.timeout }
    const status = Number((response && response.status) || 0)
    if (status < 200 || status >= 300) {
      return { ok: false, failure: FAILURE.http, httpStatus: status }
    }
    return { ok: true, status, body: String((response && response.body) || '') }
  } catch (error) {
    return { ok: false, failure: classifyError(error && error.message) }
  } finally {
    if (timer) clearTimeout(timer)
  }
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

export async function openArticle(payload) {
  const api = bridge()
  if (api && api.browser && typeof api.browser.openArticle === 'function') {
    try {
      await api.browser.openArticle(payload)
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
      await api.browser.open({ url, mode })
      return true
    } catch (error) {
      /* 落到 open.url */
    }
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
