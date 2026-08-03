// 宿主外壳的两条框架能力：**系统页栈**（`presentation.subpages` + `aibox.navigation`）与
// **悬浮层**（`aibox.overlay`）。
//
// ⚠️ 这两个 hook 与音乐应用 `lib/subpages.js` / `lib/host.js` 的实现**逐条同源**。
// 正确的归宿是 `aibox/ui`（框架资产），不是每个应用各抄一份 —— 见交付报告里的框架待办。
// 在框架把它上架之前，这里保持与音乐那份**行为逐条一致**，免得两个应用对同一条能力有两种语义。

import { useCallback, useEffect, useRef, useState } from 'react'

type Bridge = Record<string, any> | undefined

const bridge = (): Bridge => (typeof window !== 'undefined' ? (window as any).aibox : undefined)

// MARK: - 系统页栈

function hostNavigation(): any {
  const api = bridge()
  return (api && api.navigation) || null
}

/**
 * 宿主桥在 `history.state` 上维护的深度标记（`AppletHostBridge` 包装了 pushState/popstate）。
 * 返回 null = 桥不在（或这条 history 记录不是桥写的）→ 调用方回落纯内存栈。
 */
export function historyDepth(): number | null {
  try {
    const state = window.history.state
    const marked = state ? Number(state.__aiboxDepth) : NaN
    return Number.isFinite(marked) ? Math.max(0, marked) : null
  } catch {
    return null
  }
}

/**
 * 进一层：先让宿主冻结**当前页**的像素，再由调用方渲染新路由。
 *
 * 顺序屏障是唯一的技术要点：`navigation.push()` 返回的是一个**已解决的** Promise，
 * `await` 它只让出一个微任务，不足以保证宿主已经处理完 `stateChanged`（= 冻结）。
 * 紧接着 `await getState()` 才是真屏障 —— 两条消息走同一个 reply handler、宿主按 FIFO
 * 在主线程处理，`getState` 的回包到达时 `stateChanged` 必然已处理完。
 */
async function hostPush(path: string, title?: string | null): Promise<boolean> {
  const nav = hostNavigation()
  if (!nav || typeof nav.push !== 'function') return false
  try {
    await nav.push(title ? { route: path, title } : { route: path })
  } catch {
    return false
  }
  if (typeof nav.getState === 'function') {
    try { await nav.getState() } catch { /* 屏障失败只影响观感 */ }
  }
  return true
}

function hostBack(): boolean {
  const nav = hostNavigation()
  if (nav && typeof nav.back === 'function') {
    try { nav.back().catch(() => {}) } catch { return false }
    return true
  }
  if (typeof window !== 'undefined' && window.history) { window.history.back(); return true }
  return false
}

function hostPopToRoot(): void {
  const nav = hostNavigation()
  if (nav && typeof nav.popToRoot === 'function') {
    try { nav.popToRoot().catch(() => {}) } catch { /* 桥拒绝：栈已在本地清空 */ }
    return
  }
  const depth = historyDepth()
  if (typeof window !== 'undefined' && window.history && depth) window.history.go(-depth)
}

/** 顶栏标题。宿主画了顶栏时**页面不要自绘**，标题由这里写进宿主的标题栈。 */
export function setNavigationTitle(title: string): void {
  const nav = hostNavigation()
  if (!nav || typeof nav.setTitle !== 'function') return
  try {
    const result = nav.setTitle(title)
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch { /* 标题是装饰 */ }
}

/**
 * 路由栈 + 宿主页栈的镜像。
 *
 * 不接的后果不是「返回没有动画」，而是「返回手势是错的」：`history.pushState` 从未发生 →
 * 宿主看到的 `webDepth` 恒为 0 → 认为在根路由 → 最左缘左滑**直接退出整个小应用**。
 */
export function useSubpageStack<Route>(options: {
  pathFor: (route: Route) => string
  titleFor: (route: Route) => string
}): {
  stack: Route[]
  route: Route | null
  push: (route: Route) => void
  back: () => void
  reset: () => void
} {
  const configRef = useRef(options)
  configRef.current = options

  const [stack, setStack] = useState<Route[]>([])

  // 所有返回路径（系统手势、宿主顶栏返回键、页面自己的返回键、popToRoot）最后都落到 popstate。
  // 这里**对齐到深度**而不是「弹一层」——popToRoot 会一次退多层。
  useEffect(() => {
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

  const push = useCallback((route: Route) => {
    const { pathFor, titleFor } = configRef.current
    // 渲染新路由必须等屏障回来，否则冻结的是新页面的像素。
    void hostPush(pathFor(route), titleFor(route)).then(() => setStack((rows) => [...rows, route]))
  }, [])

  const back = useCallback(() => {
    // **不乐观更新**：返回要么由宿主的原生 pop 驱动、要么由 WebKit 的 back-forward 手势驱动，
    // 两条路最后都落到 popstate。抢先 setState 会让宿主的转场演给一个空页面看。
    const depth = historyDepth()
    if (depth !== null && depth > 0 && hostBack()) return
    setStack((rows) => rows.slice(0, -1))
  }, [])

  const reset = useCallback(() => {
    const depth = historyDepth()
    if (depth) hostPopToRoot()
    setStack((rows) => (rows.length === 0 ? rows : []))
  }, [])

  return { stack, route: stack.length > 0 ? stack[stack.length - 1] : null, push, back, reset }
}

// MARK: - 悬浮层（`aibox.overlay`）

export interface OverlayItemPatch {
  title?: string | null
  subtitle?: string | null
  progress?: number | null
  active?: boolean | null
  enabled?: boolean | null
  hidden?: boolean | null
  controls?: Record<string, { active?: boolean | null; enabled?: boolean | null; hidden?: boolean | null }>
}

/**
 * 悬浮层：**常驻控制层**（录音键、播放条），宿主把它和底栏叠进同一个 `safeAreaInset`，
 * 自下而上是 底栏 → bar → button，并从可见区里扣掉自己的高度。
 *
 * `rendered === false`（card/sheet/drawer 形态、声明越界、宿主太老）时业务**必须**把控件
 * 放回自己的内容流 —— 这条降级路径永远不能删。
 */
export function useOverlay(onInvoke: (event: { id: string; controlId?: string }) => void): {
  rendered: boolean
  update: (items: Record<string, OverlayItemPatch>) => void
} {
  const [rendered, setRendered] = useState(false)
  const handler = useRef(onInvoke)
  handler.current = onInvoke

  useEffect(() => {
    const api = bridge()
    const overlay = api && api.overlay
    if (!overlay || typeof overlay.getState !== 'function') return undefined
    let cancelled = false
    const offs: Array<() => void> = []

    overlay.getState()
      .then((state: any) => { if (!cancelled) setRendered(!!(state && state.rendered)) })
      .catch(() => undefined)

    if (typeof overlay.on === 'function') {
      try {
        offs.push(overlay.on('invoke', (event: any) => handler.current(event || {})))
      } catch { /* 宿主未实现事件订阅 */ }
      try {
        // `rendered` 会**在挂载之后翻转**（形态切换、控制器重建都会重发 changed）。
        // 只判断启动那一刻，自绘控件就会永远缺席或永远多一份。
        offs.push(overlay.on('changed', (state: any) => {
          if (!cancelled) setRendered(!!(state && state.rendered))
        }))
      } catch { /* 同上 */ }
    }

    return () => {
      cancelled = true
      offs.forEach((off) => { try { if (typeof off === 'function') off() } catch { /* 忽略 */ } })
    }
  }, [])

  const update = useCallback((items: Record<string, OverlayItemPatch>) => {
    const api = bridge()
    const overlay = api && api.overlay
    if (!overlay || typeof overlay.update !== 'function') return
    try {
      const result = overlay.update({ items })
      if (result && typeof result.catch === 'function') result.catch(() => {})
    } catch { /* 展示态更新失败不该影响业务 */ }
  }, [])

  return { rendered, update }
}
