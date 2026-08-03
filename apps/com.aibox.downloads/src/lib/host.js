// 宿主桥的薄封装。三条纪律与其它应用同源：
//  1. **先探测再使用**——宿主没装 / 没授权时 `window.aibox.download` 根本不存在，入口整块不渲染；
//  2. 调用不抛到 UI 层，失败回落成可判定的返回值；
//  3. 没有 aibox（普通浏览器预览）时退化成一份内存实现，页面仍能跑通全部交互。
//
// 第 3 条对下载这条线尤其重要：真正的传输永远在宿主侧，浏览器里根本没有等价物。
// 所以内存实现**假装**在下载（定时推进 fraction），只为让布局、空态、按钮态在无宿主时也能验。

const bridge = () => (typeof window !== 'undefined' ? window.aibox : undefined)

export function hasNamespace(name, method) {
  const api = bridge()
  if (!api || !api[name]) return false
  return method ? typeof api[name][method] === 'function' : true
}

export const capabilities = {
  get download() { return hasNamespace('download', 'enqueue') },
  get clipboard() { return hasNamespace('clipboard', 'read') },
  get share() { return hasNamespace('share', 'file') },
  get openURL() { return hasNamespace('open', 'url') },
  get haptics() { return hasNamespace('haptics', 'impact') },
  get toolbar() { return hasNamespace('toolbar', 'getState') },
  get tabs() { return hasNamespace('tabs', 'getState') },
  get ui() { return hasNamespace('ui', 'confirm') },
}

// ---------------------------------------------------------------- 无宿主兜底

let fakeSeq = 0
const fakeTasks = []
let fakeTimer = null

function tickFakes() {
  let live = false
  for (const t of fakeTasks) {
    if (t.state !== 'running') continue
    live = true
    t.bytesReceived = Math.min(t.totalBytes, t.bytesReceived + 180_000)
    t.fraction = t.bytesReceived / t.totalBytes
    t.speed = 180_000
    if (t.bytesReceived >= t.totalBytes) {
      t.state = 'completed'
      t.fraction = 1
      t.outputPath = `/Preview/Downloads/${t.filename}`
    }
  }
  if (!live && fakeTimer) { clearInterval(fakeTimer); fakeTimer = null }
  notifyFakeListeners()
}

const fakeListeners = new Set()
function notifyFakeListeners() { for (const fn of fakeListeners) fn() }

const memory = {
  enqueue({ url, filename }) {
    fakeSeq += 1
    const task = {
      taskId: `preview-${fakeSeq}`,
      url,
      filename: filename || url.split('/').pop() || 'download',
      state: 'running',
      bytesReceived: 0,
      totalBytes: 3_000_000,
      fraction: 0,
      artifactRef: `download://preview-${fakeSeq}`,
    }
    fakeTasks.unshift(task)
    if (!fakeTimer) fakeTimer = setInterval(tickFakes, 400)
    return { taskId: task.taskId, artifactRef: task.artifactRef }
  },
  list() { return fakeTasks.map((t) => ({ ...t })) },
  control(action, taskId) {
    const apply = (t) => {
      if (action === 'pause' && (t.state === 'running' || t.state === 'queued')) t.state = 'paused'
      else if (action === 'resume' && (t.state === 'paused' || t.state === 'failed')) t.state = 'running'
      else if (action === 'cancel' && !['completed', 'failed', 'cancelled'].includes(t.state)) t.state = 'cancelled'
    }
    if (action === 'clearFinished' || (action === 'remove' && !taskId)) {
      const keep = fakeTasks.filter((t) => (action === 'clearFinished'
        ? !['completed', 'failed', 'cancelled'].includes(t.state)
        : false))
      fakeTasks.length = 0
      fakeTasks.push(...keep)
    } else if (taskId) {
      const index = fakeTasks.findIndex((t) => t.taskId === taskId)
      if (index < 0) return false
      if (action === 'remove') fakeTasks.splice(index, 1)
      else apply(fakeTasks[index])
    } else {
      fakeTasks.forEach(apply)
    }
    if (fakeTasks.some((t) => t.state === 'running') && !fakeTimer) fakeTimer = setInterval(tickFakes, 400)
    notifyFakeListeners()
    return true
  },
}

// ---------------------------------------------------------------- download 能力

export const downloads = {
  /** 入队一条。回 `{taskId, artifactRef}`，失败回 `{error}`（不抛）。 */
  async enqueue(request) {
    const api = bridge()
    if (!capabilities.download) return memory.enqueue(request)
    try {
      const result = await api.download.enqueue(request)
      return result || { error: 'empty response' }
    } catch (error) {
      return { error: String((error && error.message) || error) }
    }
  },
  /** 本应用的任务列表。永远只有自己的——归属由宿主自动绑定，页面说不出「看别人的」这句话。 */
  async list(filter) {
    const api = bridge()
    if (!capabilities.download) {
      const all = memory.list()
      if (!filter || !filter.state) return all
      return all.filter((t) => matchesState(filter.state, t.state))
    }
    try {
      const items = await api.download.list(filter || {})
      return Array.isArray(items) ? items : []
    } catch (error) {
      return []
    }
  },
  async control(action, taskId) {
    const api = bridge()
    if (!capabilities.download) return memory.control(action, taskId)
    try {
      if (taskId) {
        if (action === 'clearFinished') return false
        await api.download[action]({ taskId })
        return true
      }
      const bulk = { pause: 'pauseAll', resume: 'resumeAll', cancel: 'cancelAll', clearFinished: 'clearFinished' }[action]
      if (!bulk) return false
      await api.download[bulk]({})
      return true
    } catch (error) {
      return false
    }
  },
  /** 让宿主开始推 `download.progress` 事件。轮询是**兜底**，不是主路径。 */
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
  async openIn(taskId) {
    const api = bridge()
    if (!capabilities.download) return false
    try { return !!(await api.download.openIn({ taskId })) } catch (error) { return false }
  },
  async share(taskId) {
    const api = bridge()
    if (!capabilities.download) return false
    try { return !!(await api.download.share({ taskId })) } catch (error) { return false }
  },
  async availability() {
    const api = bridge()
    if (!capabilities.download) return { available: false, reason: 'preview' }
    try { return await api.download.availability({}) } catch (error) { return { available: false } }
  },
}

export function matchesState(filter, state) {
  if (filter === 'active') return ['queued', 'running', 'paused'].includes(state)
  if (filter === 'finished') return ['completed', 'failed', 'cancelled'].includes(state)
  return filter === state
}

// ---------------------------------------------------------------- 事件

/** 订阅一条宿主事件；回一个退订函数。无宿主时对接内存实现的变更通知。 */
export function onEvent(name, handler) {
  const api = bridge()
  if (!api || !api.events) {
    if (name === 'download.progress') {
      fakeListeners.add(handler)
      return () => fakeListeners.delete(handler)
    }
    return () => {}
  }
  const off = api.events.on(name, handler)
  return typeof off === 'function' ? off : () => api.events.off(name, handler)
}

// ---------------------------------------------------------------- 其它能力

export async function readClipboard() {
  const api = bridge()
  if (!capabilities.clipboard) return ''
  try {
    const text = await api.clipboard.read({})
    return typeof text === 'string' ? text : (text && text.text) || ''
  } catch (error) {
    return ''
  }
}

export function tap(style) {
  const api = bridge()
  if (!capabilities.haptics) return
  try { api.haptics.impact({ style: style || 'light' }) } catch (error) { /* 触感失败无所谓 */ }
}

export async function confirm(options) {
  const api = bridge()
  if (!capabilities.ui) return true
  try {
    const result = await api.ui.confirm(options)
    return !!result && result.actionId !== 'cancel' && !result.cancelled
  } catch (error) {
    return false
  }
}

export const storage = {
  async get(key, fallback) {
    const api = bridge()
    if (!api || !api.storage) return fallback
    try {
      const value = await api.storage.get(key)
      return value === undefined || value === null ? fallback : value
    } catch (error) { return fallback }
  },
  async set(key, value) {
    const api = bridge()
    if (!api || !api.storage) return false
    try { await api.storage.set(key, value); return true } catch (error) { return false }
  },
}
