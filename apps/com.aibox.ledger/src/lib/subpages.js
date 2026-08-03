// 子页导航 —— 把本应用的路由栈**镜像**成宿主的系统原生页栈。
//
// 用户的原话：「在小应用里面的页面导航栈，你要用系统的，这样我才能够完整地做滑返回到
// 上一个页面，而且能实时看到上一个页面。」这件事宿主已经做完了（真 `UINavigationController`
// + 冻结像素 + 活 WebView 住栈顶，见 docs/capabilities/applet/native-navigation.md），
// 应用侧要做的只有三件：
//
//   ① manifest 声明 `presentation.subpages: true` —— 这是这条能力的 opt-in 开关；
//   ② 进子页时先 `aibox.navigation.push()` **并等顺序屏障**，再渲染新路由；
//   ③ 返回一律经 `popstate` 回来，把自己的栈**对齐到 history 深度**。
//
// 不接 ②③ 的后果不是「返回没有动画」，而是「返回手势是错的」：`history.pushState`
// 从未发生 → 宿主看到的 `webDepth` 恒为 0 → 认为在根路由 → 最左缘左滑**直接退出整个
// 小应用**，用户的子页栈无声消失。这正是真机上被抱怨的那个形状。
//
// 降级（逐点与改造前一致）：宿主不在（浏览器里调试）、形态是 card/sheet/drawer、
// 或没声明 subpages 时，这里退化成纯内存栈 + 纯 Web History，功能不变。

import React from 'react'

function hostNavigation() {
  const api = (typeof window !== 'undefined' && window.aibox) || null
  return (api && api.navigation) || null
}

/**
 * 宿主桥在 `history.state` 上维护的深度标记（`AppletHostBridge` 包装了 pushState/popstate）。
 * 返回 null = 桥不在（或这条 history 记录不是桥写的）→ 调用方回落纯内存栈。
 */
export function historyDepth() {
  try {
    const state = window.history.state
    const marked = state ? Number(state.__aiboxDepth) : NaN
    return Number.isFinite(marked) ? Math.max(0, marked) : null
  } catch (error) {
    return null
  }
}

/**
 * 进一层：先让宿主冻结**当前页**的像素，再由调用方渲染新路由。
 *
 * 顺序屏障是这里唯一的技术要点：`navigation.push()` 是纯 JS，返回的是一个**已解决的**
 * Promise，`await` 它只让出一个微任务，不足以保证宿主已经处理完 `stateChanged`（= 冻结）。
 * 紧接着 `await getState()` 才是真屏障 —— 两条消息走同一个 reply handler、宿主按 FIFO
 * 在主线程处理，`getState` 的回包到达时 `stateChanged` 必然已处理完。
 *
 * 违反屏障是**观感退化而非功能损坏**：冻结下来的会是新页面的像素，于是拖动中露出的
 * 「上一页」看着像当前页；返回本身照常工作。
 */
async function hostPush(path, title) {
  const nav = hostNavigation()
  if (!nav || typeof nav.push !== 'function') return false
  try {
    await nav.push(title ? { route: path, title } : { route: path })
  } catch (error) {
    return false
  }
  if (typeof nav.getState === 'function') {
    try { await nav.getState() } catch (error) { /* 屏障失败只影响观感 */ }
  }
  return true
}

function hostBack() {
  const nav = hostNavigation()
  if (nav && typeof nav.back === 'function') {
    try { nav.back().catch(() => {}) } catch (error) { return false }
    return true
  }
  if (typeof window !== 'undefined' && window.history) { window.history.back(); return true }
  return false
}

function hostPopToRoot() {
  const nav = hostNavigation()
  if (nav && typeof nav.popToRoot === 'function') {
    try { nav.popToRoot().catch(() => {}) } catch (error) { /* 桥拒绝：栈已在本地清空 */ }
    return
  }
  const depth = historyDepth()
  if (typeof window !== 'undefined' && window.history && depth) window.history.go(-depth)
}

/** 宿主是否真的装了原生页栈。页面据此决定要不要自绘转场（本仓四个应用都不自绘）。 */
export async function subpageTransition() {
  const nav = hostNavigation()
  if (!nav || typeof nav.getState !== 'function') return 'web'
  try {
    const state = await nav.getState()
    return (state && state.transition) || 'web'
  } catch (error) {
    return 'web'
  }
}

/**
 * 路由栈 + 宿主页栈的镜像。
 *
 * - `pathFor(route)` → `#/...`，只用于宿主诊断与 `getState().url`，页面自己不读它；
 * - `titleFor(route)` → 顶栏标题；宿主会把它记进标题栈，返回时自动还原。
 */
export function useSubpageStack(options) {
  const configRef = React.useRef(options || {})
  configRef.current = options || {}

  const [stack, setStack] = React.useState([])

  // 所有返回路径（系统手势、宿主顶栏返回键、页面自己的返回键、popToRoot）最后都落到
  // popstate。这里**对齐到深度**而不是「弹一层」——popToRoot 会一次退多层。
  React.useEffect(() => {
    const onPopState = () => {
      const depth = historyDepth()
      setStack((rows) => {
        const target = depth === null ? rows.length - 1 : depth
        const clamped = Math.max(0, Math.min(rows.length, target))
        return clamped === rows.length ? rows : rows.slice(0, clamped)
      })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const push = React.useCallback((route) => {
    const { pathFor, titleFor } = configRef.current
    const path = pathFor ? pathFor(route) : `#/${(route && route.name) || 'page'}`
    const title = titleFor ? titleFor(route) : null
    // 渲染新路由必须等屏障回来，否则冻结的是新页面的像素（见 hostPush 注释）。
    hostPush(path, title).then(() => setStack((rows) => [...rows, route]))
  }, [])

  const back = React.useCallback(() => {
    // **不乐观更新**：返回要么由宿主的原生 pop 驱动、要么由 WebKit 的 back-forward 手势
    // 驱动，两条路最后都落到 popstate。抢先 setState 会让宿主的转场演给一个空页面看。
    const depth = historyDepth()
    if (depth !== null && depth > 0 && hostBack()) return
    setStack((rows) => rows.slice(0, -1))
  }, [])

  const reset = React.useCallback(() => {
    // 切 Tab 是「整条子页栈作废」，没有转场可言：乐观清空 + 通知宿主对账（幂等）。
    const depth = historyDepth()
    if (depth) hostPopToRoot()
    setStack((rows) => (rows.length === 0 ? rows : []))
  }, [])

  return {
    stack,
    route: stack.length > 0 ? stack[stack.length - 1] : null,
    push,
    back,
    reset,
  }
}
