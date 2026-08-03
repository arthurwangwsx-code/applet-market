// 宿主桥的薄封装。
//
// ## 这个应用为什么走 `aibox.tools` 而不是自己解析
//
// 来源解析（B 站 / YouTube / HLS / 通用页嗅探）是**领域逻辑**：五个站点适配器、两千多行 Swift、
// 带 WBI 签名与动态页嗅探。它不可能、也不应该迁进 JS。判据（问一「换主语还成立吗」）说：
// 「把一个网页地址变成可下载的媒体清单」是通用的，但**站点适配本身是领域的**。
// 所以正确形态是：契约通用（`VideoInfo`/`VideoFormat` 已在 Tier 0），实现留原生，本应用**遥控**它。
//
// 于是本应用有两条桥：
//   · `aibox.tools` → `viddl_inspect` / `viddl_download` / `viddl_jobs`（解析、下载、job 状态机）
//   · `aibox.download` → 只用来读**统一队列**里属于视频的那部分（含 HLS 那一半）
//
// 第二条不是冗余：`viddl_jobs list` 回的是给模型看的文本，而队列里的字节数、速度、ETA
// 是结构化的。两者同源（同一个引擎），各取所长。

const bridge = () => (typeof window !== 'undefined' ? window.aibox : undefined)

export function hasNamespace(name, method) {
  const api = bridge()
  if (!api || !api[name]) return false
  return method ? typeof api[name][method] === 'function' : true
}

export const capabilities = {
  get tools() { return hasNamespace('tools', 'call') },
  get download() { return hasNamespace('download', 'list') },
  get clipboard() { return hasNamespace('clipboard', 'read') },
  get share() { return hasNamespace('share', 'file') },
  get haptics() { return hasNamespace('haptics', 'impact') },
}

/** 宿主工具是否已授予本应用。用 `access.explain` 而不是 `tools.describe`——后者在工具不可用时
 *  reject，会在每一轮验收日志里留下一条假故障。 */
export async function toolAllowed(name) {
  const api = bridge()
  if (api && api.access && typeof api.access.explain === 'function') {
    try {
      const verdict = await api.access.explain({ tool: name })
      return !!(verdict && verdict.allowed)
    } catch (error) { return false }
  }
  return capabilities.tools
}

/** 调一个宿主工具。回 `{ok, text, details?}`；`details` 是工具的结构化卡片负载（如果它有）。 */
export async function callTool(name, args) {
  const api = bridge()
  if (!capabilities.tools) return { ok: false, error: 'tools gateway unavailable' }
  try {
    const result = await api.tools.call({ name, arguments: args || {} })
    return result && typeof result === 'object' ? result : { ok: false }
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) }
  }
}

// ---------------------------------------------------------------- 统一队列（结构化进度）

export const queue = {
  /** 视频轨道与 HLS 离线包都在这里——补充源已把 HLS 那一半并进来了。 */
  async list() {
    const api = bridge()
    if (!capabilities.download) return []
    try {
      const items = await api.download.list({})
      return Array.isArray(items) ? items : []
    } catch (error) { return [] }
  },
  async subscribe() {
    const api = bridge()
    if (!capabilities.download) return false
    try { await api.download.subscribe({}); return true } catch (error) { return false }
  },
  async unsubscribe() {
    const api = bridge()
    if (!capabilities.download) return false
    try { await api.download.unsubscribe({}); return true } catch (error) { return false }
  },
}

export function onEvent(name, handler) {
  const api = bridge()
  if (!api || !api.events || typeof api.events.on !== 'function') return () => {}
  const off = api.events.on(name, handler)
  return typeof off === 'function' ? off : () => api.events.off(name, handler)
}

export function onNamespaceEvent(namespace, event, handler) {
  const api = bridge()
  if (!api || !api[namespace] || typeof api[namespace].on !== 'function') return () => {}
  return api[namespace].on(event, handler)
}

export async function readClipboard() {
  const api = bridge()
  if (!capabilities.clipboard) return ''
  try {
    const text = await api.clipboard.read({})
    return typeof text === 'string' ? text : (text && text.text) || ''
  } catch (error) { return '' }
}

export function tap(style) {
  const api = bridge()
  if (!capabilities.haptics) return
  try { api.haptics.impact({ style: style || 'light' }) } catch (error) { /* 触感失败无所谓 */ }
}

// ---------------------------------------------------------------- viddl_jobs 文本解析
//
// `viddl_jobs list` 是给模型看的文本，一行一条，形如：
//   `• 标题 — downloading · 42% · source: bilibili.com  [job: <uuid>]`
//   `• 标题 — completed → file.mp4 · source: youtube.com  [job: <uuid>]`
// 宿主没有给它定结构化卡片负载（那是宿主侧的事，不该由一个小应用去推动改协议）。
//
// 解析纪律：**认不出的行整条丢掉，绝不猜**。`[job: …]` 是唯一的强锚点——没有它就不是一条任务行，
// 猜一行的代价是用户看到一条根本不存在的下载。进度/速度这些「猜错了也只是难看」的字段，
// 真值另有来源（`aibox.download.list()` 的结构化队列），不靠这里。

export function parseJobLines(text) {
  if (!text || typeof text !== 'string') return []
  const out = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const anchor = line.match(/\[job:\s*([^\]]+)\]\s*$/)
    if (!anchor) continue
    const body = line.slice(0, anchor.index).replace(/^[•\-\s]+/, '').trim()
    const dash = body.indexOf(' — ')
    const title = (dash >= 0 ? body.slice(0, dash) : body).trim()
    const tail = dash >= 0 ? body.slice(dash + 3) : ''
    const segments = tail.split('·').map((s) => s.trim())
    const stateSegment = segments[0] || ''
    const state = (stateSegment.split(/[\s→]/)[0] || '').trim()
    const percent = tail.match(/(\d{1,3})%/)
    const output = tail.match(/→\s*([^·]+)/)
    const source = tail.match(/source:\s*([^·]+)/)
    out.push({
      jobId: anchor[1].trim(),
      state: state || 'unknown',
      fraction: percent ? Number(percent[1]) / 100 : undefined,
      title: title || anchor[1].trim(),
      outputName: output ? output[1].trim() : undefined,
      source: source ? source[1].trim() : undefined,
    })
  }
  return out
}
