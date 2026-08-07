/**
 * 触摸手势原语：横扫分页（`useSwipePager`）与轴锁拖拽（`useDragGesture`）。
 *
 * ## 这个文件为什么存在
 *
 * 2026-08-06 实测：市场里两个应用各自手搓了横扫/滑动手势，**两个都把 `touchcancel` 处理错了，
 * 而且错法相反**——
 *
 *  · 资讯 `Pager.jsx`：`onTouchCancel={onTouchEnd}`，于是 cancel 走完阈值判定并 settle，
 *    **提交了一次用户没打算做的翻页**；
 *  · 理财 `primitives.jsx` 的 `SwipeRow` / `PullRefresh`：**根本没接 cancel**，
 *    `active` 永不复位、`startX` 停在旧值，行卡在半开位，下一次无关触摸接着上一次的基准继续拖。
 *
 * 根因不是粗心，是**缺少可供性**：SDK 没有任何分页 / 拖拽原语，想做只能手搓；而 `touchcancel`
 * 在纯 Web 环境几乎不会触发（只有原生识别器抢走触摸时才发），**在浏览器里写、在浏览器里测，
 * 永远测不出来**。谁写都会漏。
 *
 * 所以本文件的唯一职责，是把下面这条契约写死在一个地方：
 *
 *   **`touchcancel` = 放弃（abort）：复位状态、回弹、绝不提交，且永远不与 `touchend` 共用处理器。**
 *
 * ## 为什么核心是「无 React」的工厂函数
 *
 * `createDragGesture` / `createSwipePager` 不 import react，返回的就是四个普通函数。
 * 这不是洁癖，是**让上面那条契约可被证明**：Node 里没有 DOM 也没有渲染器，但可以把这四个函数
 * 挂到真的 `EventTarget` 上、`dispatchEvent` 一个真的合成 `touchcancel` 进去，断言「abort 分支
 * 跑到了且没有翻页」。React 那层只是把同一批函数摊成 JSX 属性——测的和用的是同一份代码。
 * 证据见 `packages/aibox-sdk/tests/gestures.test.mjs`。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// 0. 结构化事件类型
// ---------------------------------------------------------------------------
// 故意不写 `React.TouchEvent` 也不写 DOM `TouchEvent`：核心要能同时接住
// ① React 合成事件、② 真实 DOM 事件、③ 测试里 `new Event()` 派生的合成事件。
// 三者的交集就是下面这点结构，用结构化类型把它们统一起来。

/** 一根手指。只用得到坐标。 */
export interface TouchPointLike {
  readonly clientX: number
  readonly clientY: number
}

/** 触摸事件。`touches` 是「当前还在屏幕上的手指」，`touchend`/`touchcancel` 时可能为空。 */
export interface TouchEventLike {
  readonly touches: ArrayLike<TouchPointLike>
  readonly cancelable?: boolean
  preventDefault?(): void
}

/** 一次拖拽的采样。`dx`/`dy` 是相对**手势起点**的位移，不是相对上一帧。 */
export interface DragSample {
  readonly dx: number
  readonly dy: number
  /** 方向锁是否已经落在主轴上。`onDrag` / `onEnd` 里恒为 true。 */
  readonly locked: boolean
}

/** 挂到元素上的四个处理器。**`onTouchCancel` 永远是独立的一个函数**，见文件头契约。 */
export interface DragGestureHandlers {
  onTouchStart(event: TouchEventLike): void
  onTouchMove(event: TouchEventLike): void
  onTouchEnd(event?: TouchEventLike): void
  onTouchCancel(event?: TouchEventLike): void
}

export type DragAxis = 'x' | 'y'

/**
 * 方向锁模式。
 *
 * · `'axis'`（默认）：位移达到 `lockSlop` 后按 `|dx|` vs `|dy|` 判主轴，判成副轴则**整串放弃**
 *   （不再回调、`touchend` 也不提交）。**锁定前绝不 `preventDefault`**，否则页面滚不动。
 * · `'none'`：不判方向，`touchstart` 即视为锁定。给「只看主轴、不与横向竞争」的场景用
 *   （下拉刷新就是：它本来就只读 `dy`，加方向锁会改变既有观感）。
 */
export type DragLockMode = 'axis' | 'none'

export interface DragGestureOptions {
  /** 主轴。 */
  axis: DragAxis
  /** 方向锁模式，默认 `'axis'`。 */
  lock?: DragLockMode
  /** 方向锁阈值（px），默认 6。`lock: 'none'` 时无意义。 */
  lockSlop?: number
  /** 锁定成功后是否 `preventDefault`，默认 true。 */
  preventDefaultWhenLocked?: boolean
  /**
   * 只认单指，默认 true。
   *
   * 不加这条时，第二根手指落下会再发一次 `touchstart`，把手势的起点**重置成新坐标**，
   * 于是内容瞬移一段。资讯的分页器本来就有这条守卫，这里把它升成所有手势的默认。
   */
  singleTouchOnly?: boolean
  /** 手势能否开始（例：下拉刷新要求 `scrollTop === 0`；分页器要求不在切页动画中）。 */
  canStart?(): boolean
  /** 手势开始（尚未判方向）。用来抓基准值，例如「当前偏移量」。 */
  onStart?(): void
  /** 锁定成功后每次移动。 */
  onDrag?(sample: DragSample): void
  /** 手指正常抬起。**这是唯一允许提交的回调。** 方向锁落在副轴时不会触发。 */
  onEnd?(sample: DragSample): void
  /**
   * 触摸被抢走（`touchcancel`）：原生手势接管了这串触摸。
   *
   * 语义是**放弃**——回到手势开始前的样子。这里不该做任何「提交」：用户的意图是那个
   * 原生手势，不是你这个手势。
   */
  onCancel?(sample: DragSample): void
}

/** 手势核心：四个处理器 + 两个只读探针。 */
export interface DragGestureCore extends DragGestureHandlers {
  /** 手势是否正在进行。 */
  isActive(): boolean
  /** 方向锁是否已落在主轴上。 */
  isLocked(): boolean
}

// ---------------------------------------------------------------------------
// 1. 轴锁拖拽核心（无 React）
// ---------------------------------------------------------------------------

/**
 * 造一个轴锁拖拽手势。返回的四个处理器可以直接摊进 JSX，也可以 `addEventListener` 挂到真元素上。
 */
export function createDragGesture(options: DragGestureOptions): DragGestureCore {
  const lockMode: DragLockMode = options.lock ?? 'axis'
  const slop = options.lockSlop ?? 6
  const preventWhenLocked = options.preventDefaultWhenLocked ?? true
  const singleTouch = options.singleTouchOnly ?? true

  let active = false
  let locked = false
  let resolved = false
  let startX = 0
  let startY = 0
  let dx = 0
  let dy = 0

  /** 复位到「没有手势」。abort 与正常结束都要走它——状态复位从来不是可选项。 */
  function reset(): void {
    active = false
    locked = false
    resolved = false
    startX = 0
    startY = 0
    dx = 0
    dy = 0
  }

  function sample(): DragSample {
    return { dx, dy, locked }
  }

  function onTouchStart(event: TouchEventLike): void {
    if (singleTouch && event.touches.length !== 1) return
    if (options.canStart && !options.canStart()) return
    const touch = event.touches[0]
    if (!touch) return
    active = true
    locked = lockMode === 'none'
    resolved = lockMode === 'none'
    startX = touch.clientX
    startY = touch.clientY
    dx = 0
    dy = 0
    options.onStart?.()
  }

  function onTouchMove(event: TouchEventLike): void {
    if (!active) return
    const touch = event.touches[0]
    if (!touch) return
    dx = touch.clientX - startX
    dy = touch.clientY - startY

    if (!resolved) {
      // 还没够 slop：**什么都不做，尤其不能 preventDefault**——这时候还分不清用户是想横扫
      // 还是想滚列表，抢下来就是把滚动废掉。
      if (Math.abs(dx) < slop && Math.abs(dy) < slop) return
      resolved = true
      locked = options.axis === 'x' ? Math.abs(dx) > Math.abs(dy) : Math.abs(dy) > Math.abs(dx)
    }
    if (!locked) return

    // 与迁移前两个应用一致：只有 `cancelable` 为真才抢——非 passive 监听下它才是 true，
    // 对 passive 监听调 `preventDefault` 只会换来一条控制台告警，什么也拦不住。
    if (preventWhenLocked && event.cancelable) event.preventDefault?.()
    options.onDrag?.(sample())
  }

  function onTouchEnd(): void {
    if (!active) return
    const finished = sample()
    const wasLocked = locked
    reset()
    // 方向锁落在副轴：这串触摸从来不属于本手势，自然也没有什么可提交的。
    if (wasLocked) options.onEnd?.(finished)
  }

  // ⚠️ **这个函数永远不能换成 `onTouchEnd`。** 它是本文件存在的理由：
  // `touchcancel` 的语义是「这串触摸已经不属于页面了」，正确响应是回到手势开始前的样子。
  // 复用 end 会在阈值够时提交一次用户没打算做的操作（资讯原来的 bug）；
  // 干脆不接则会让 `active` 永远停在 true（理财原来的 bug）。两条都由这里堵死。
  //
  // 顺序刻意是「先 reset 再回调」：即便调用方的 onCancel 抛了，状态机也已经是干净的——
  // 「状态永不复位」比「少一次回弹动画」严重得多。
  function onTouchCancel(): void {
    if (!active) return
    const aborted = sample()
    reset()
    options.onCancel?.(aborted)
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    isActive: () => active,
    isLocked: () => locked,
  }
}

// ---------------------------------------------------------------------------
// 1.5 长按 / 点击（无 React）
// ---------------------------------------------------------------------------
// 和横扫是同一族问题：手指走过一段就不该再算「点了这一行」，触摸被抢走就该整串作废。
// 单独列出来是因为它不产生位移，套不进 `createDragGesture`。

export interface LongPressOptions {
  onLongPress(): void
  /** 轻点。触摸设备走 `touchend`，鼠标 / 辅助技术走 `click`。 */
  onTap?(): void
  /** 长按判定时长 ms，默认 480。 */
  delayMs?: number
  /** 手指走过多少 px 就不再算点击，默认 8。 */
  moveSlop?: number
  /** 定时器。测试可注入手动时钟。 */
  timers?: {
    set(run: () => void, ms: number): unknown
    clear(handle: unknown): void
  }
}

export interface LongPressHandlers {
  onTouchStart(event: TouchEventLike): void
  onTouchMove(event: TouchEventLike): void
  onTouchEnd(event?: TouchEventLike): void
  onTouchCancel(event?: TouchEventLike): void
  onContextMenu(event: { preventDefault?(): void }): void
  onClick(event?: unknown): void
}

export interface LongPressCore extends LongPressHandlers {
  /** 卸载时调用：把还没触发的长按计时器掐掉。 */
  dispose(): void
}

/** 造一个长按 / 点击手势。 */
export function createLongPress(options: LongPressOptions): LongPressCore {
  const delay = options.delayMs ?? 480
  const slop = options.moveSlop ?? 8
  const timers = options.timers ?? {
    set: (run: () => void, ms: number) => setTimeout(run, ms),
    clear: (handle: unknown) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>)
    },
  }

  let handle: unknown = null
  let active = false
  let fired = false
  let moved = false
  let touched = false
  let x = 0
  let y = 0

  function clearTimer(): void {
    if (handle !== null) {
      timers.clear(handle)
      handle = null
    }
  }

  return {
    onTouchStart(event: TouchEventLike): void {
      const touch = event.touches[0]
      if (!touch) return
      x = touch.clientX
      y = touch.clientY
      active = true
      fired = false
      moved = false
      touched = true
      clearTimer()
      handle = timers.set(() => {
        handle = null
        fired = true
        options.onLongPress()
      }, delay)
    },
    onTouchMove(event: TouchEventLike): void {
      if (!active) return
      const touch = event.touches[0]
      if (!touch) return
      // 手指走过 slop 就**不再是一次点击**：滚列表 / 横扫切页时手指恰好落在某一行上，
      // 松手时不能把它当成「点开这一项」。只清长按计时器是不够的，必须记住 moved。
      if (Math.abs(touch.clientX - x) > slop || Math.abs(touch.clientY - y) > slop) {
        moved = true
        clearTimer()
      }
    },
    onTouchEnd(): void {
      if (!active) return
      active = false
      clearTimer()
      if (!fired && !moved) options.onTap?.()
    },
    // 触摸被原生手势抢走：整串作废。**不能只清计时器**——那样虽然碰巧不会发 tap
    //（cancel 之后不会再来 touchend），但状态没复位，靠的是运气而不是契约。
    onTouchCancel(): void {
      active = false
      fired = false
      moved = false
      clearTimer()
    },
    onContextMenu(event: { preventDefault?(): void }): void {
      event.preventDefault?.()
    },
    onClick(): void {
      // 触摸设备上 tap 已由 `touchend` 处理（iOS 随后还会补一个合成 click，必须吞掉）；
      // 没有发生过触摸时才把 click 当成点击 —— 服务鼠标与辅助技术。
      if (touched) return
      options.onTap?.()
    },
    dispose: clearTimer,
  }
}

// ---------------------------------------------------------------------------
// 2. 横扫分页核心（无 React）
// ---------------------------------------------------------------------------

/** 分页器对外可见的视觉状态。 */
export interface SwipePagerView {
  /** 当前位移（px）。手指拖动中是实时位移，切页动画中是目标位移，静止时为 0。 */
  offset: number
  /** 是否在切页 / 回弹动画中。 */
  animating: boolean
  /** 是否有手指正在横向拖动。 */
  dragging: boolean
}

export type SwipeThreshold = number | ((width: number) => number)

/** 默认翻页阈值：`max(48, 容器宽 × 0.22)`。与迁移前两个应用手搓的那份逐字一致。 */
export function defaultSwipeThreshold(width: number): number {
  return Math.max(48, width * 0.22)
}

export interface SwipePagerCoreOptions {
  /** 总页数（读取式：受控方随时可能改）。 */
  count(): number
  /** 当前页码。 */
  index(): number
  /** 容器宽度（px）。阈值与切页位移都按它算。 */
  width(): number
  /** 真正翻页。**只有正常抬手过阈值、或 `slideTo` 才会走到这里。** */
  commit(next: number): void
  /** 视觉状态变了。 */
  render(view: SwipePagerView): void
  /** 翻页阈值，默认 `defaultSwipeThreshold`。 */
  threshold?: SwipeThreshold
  /** 首 / 末页橡皮筋阻尼系数，默认 0.28（滑出去只走 28%，不会露出空白屏）。 */
  rubberBand?: number
  /** 切页动画时长 ms，默认 220。 */
  durationMs?: number
  /** 方向锁阈值 px，默认 6。 */
  lockSlop?: number
  /** 定时器。测试注入手动时钟，生产走 `setTimeout`。 */
  schedule?(run: () => void, ms: number): void
}

export interface SwipePagerCore extends DragGestureHandlers {
  /** 程序化切页（chip / 分段控件点一下）。越界与「切到当前页」都是空操作。 */
  slideTo(next: number): void
  view(): SwipePagerView
  isActive(): boolean
  isAnimating(): boolean
}

/**
 * 造一个横扫分页器。
 *
 * 只负责**手势 → 页码**这段状态机；三屏轨道怎么画、CSS 类名叫什么由调用方决定
 * （`useSwipePager` 会给出配套的 `trackStyle`）。
 */
export function createSwipePager(options: SwipePagerCoreOptions): SwipePagerCore {
  const rubber = options.rubberBand ?? 0.28
  const duration = options.durationMs ?? 220
  const schedule =
    options.schedule ??
    ((run: () => void, ms: number) => {
      setTimeout(run, ms)
    })

  let offset = 0
  let animating = false
  let dragging = false
  /** 动画结束时要提交的页码。动画期间被打断的话它就是「还没落地的那一页」。 */
  let pending: number | null = null
  /** 手势开始那一刻的容器宽度：阈值按它算，避免动画中途宽度变化让阈值跳。 */
  let gestureWidth = 1

  function publish(): void {
    options.render({ offset, animating, dragging })
  }

  function thresholdFor(width: number): number {
    const value = options.threshold ?? defaultSwipeThreshold
    return typeof value === 'function' ? value(width) : value
  }

  /**
   * 收尾动画。
   *
   * `next === 当前页` 是**回弹分支**：只把位移动画回 0，不 `commit`。
   * 放弃（`touchcancel`）走的正是这条——所以「abort 不翻页」不是靠调用方自觉，
   * 是靠它压根没有别的分支可走。
   */
  function settle(next: number, direction: number): void {
    if (next === options.index()) {
      animating = true
      offset = 0
      publish()
      schedule(() => {
        animating = false
        publish()
      }, duration)
      return
    }
    pending = next
    animating = true
    offset = -direction * (options.width() || 1)
    publish()
    schedule(() => {
      animating = false
      offset = 0
      const target = pending
      pending = null
      publish()
      if (target !== null) options.commit(target)
    }, duration)
  }

  const gesture = createDragGesture({
    axis: 'x',
    lockSlop: options.lockSlop ?? 6,
    canStart: () => !animating,
    onStart: () => {
      gestureWidth = options.width() || 1
    },
    onDrag: ({ dx }) => {
      const index = options.index()
      const count = options.count()
      // 首 / 末页做橡皮筋阻尼，避免滑出空白屏。
      const atStart = index === 0 && dx > 0
      const atEnd = index === count - 1 && dx < 0
      offset = atStart || atEnd ? dx * rubber : dx
      dragging = true
      publish()
    },
    onEnd: () => {
      const index = options.index()
      const count = options.count()
      const threshold = thresholdFor(gestureWidth)
      dragging = false
      let next = index
      if (offset <= -threshold && index < count - 1) next = index + 1
      else if (offset >= threshold && index > 0) next = index - 1
      settle(next, next > index ? 1 : next < index ? -1 : 0)
    },
    // 放弃：回弹到本页。`settle(当前页, 0)` 走的就是上面那条回弹分支——不 commit。
    onCancel: ({ locked }) => {
      dragging = false
      if (locked) settle(options.index(), 0)
      else publish()
    },
  })

  return {
    onTouchStart: gesture.onTouchStart,
    onTouchMove: gesture.onTouchMove,
    onTouchEnd: gesture.onTouchEnd,
    onTouchCancel: gesture.onTouchCancel,
    slideTo(next: number): void {
      const index = options.index()
      if (next === index || next < 0 || next >= options.count()) return
      settle(next, next > index ? 1 : -1)
    },
    view: () => ({ offset, animating, dragging }),
    isActive: () => gesture.isActive(),
    isAnimating: () => animating,
  }
}

// ---------------------------------------------------------------------------
// 3. React 绑定
// ---------------------------------------------------------------------------

export interface UseDragGestureResult {
  /** 摊进 JSX：`<div {...handlers} />`。 */
  handlers: DragGestureHandlers
  /** 是否有手指正在拖（已锁定到主轴）。用来在拖动中关掉 CSS transition。 */
  dragging: boolean
}

/**
 * 轴锁拖拽的 React 绑定。左滑露出操作、下拉刷新这类「拖到哪儿松手看结果」的手势用它。
 *
 * 回调走 ref 转发，所以 `handlers` 身份稳定、不会因为父组件重渲染而重建手势。
 * 只有 `axis` / `lock` / `lockSlop` / `preventDefaultWhenLocked` / `singleTouchOnly`
 * 这几个**结构性**选项变化时才重建（它们在实践中都是字面量）。
 */
export function useDragGesture(options: DragGestureOptions): UseDragGestureResult {
  const latest = useRef(options)
  latest.current = options
  const [dragging, setDragging] = useState(false)

  const { axis, lock, lockSlop, preventDefaultWhenLocked, singleTouchOnly } = options

  const core = useMemo(
    () =>
      createDragGesture({
        axis,
        lock,
        lockSlop,
        preventDefaultWhenLocked,
        singleTouchOnly,
        canStart: () => latest.current.canStart?.() ?? true,
        onStart: () => latest.current.onStart?.(),
        onDrag: (s) => {
          setDragging(true)
          latest.current.onDrag?.(s)
        },
        onEnd: (s) => {
          setDragging(false)
          latest.current.onEnd?.(s)
        },
        onCancel: (s) => {
          setDragging(false)
          latest.current.onCancel?.(s)
        },
      }),
    [axis, lock, lockSlop, preventDefaultWhenLocked, singleTouchOnly],
  )

  const handlers = useMemo<DragGestureHandlers>(
    () => ({
      onTouchStart: core.onTouchStart,
      onTouchMove: core.onTouchMove,
      onTouchEnd: core.onTouchEnd,
      onTouchCancel: core.onTouchCancel,
    }),
    [core],
  )

  return { handlers, dragging }
}

/**
 * 长按 + 轻点。摊进 JSX：`<div {...press} />`。
 *
 * ```jsx
 * const press = useLongPress({ onLongPress: () => setMenu(true), onTap: () => open(item) })
 * ```
 *
 * 比手搓多的两条：`touchcancel` 是显式作废（不是「碰巧不会发 tap」），
 * 以及卸载时掐掉还没触发的计时器（否则长按会在组件没了之后才回调）。
 */
export function useLongPress(options: LongPressOptions): LongPressHandlers {
  const latest = useRef(options)
  latest.current = options

  const { delayMs, moveSlop } = options

  const core = useMemo(
    () =>
      createLongPress({
        delayMs,
        moveSlop,
        onLongPress: () => latest.current.onLongPress(),
        onTap: () => latest.current.onTap?.(),
      }),
    [delayMs, moveSlop],
  )

  useEffect(() => () => core.dispose(), [core])

  return useMemo<LongPressHandlers>(
    () => ({
      onTouchStart: core.onTouchStart,
      onTouchMove: core.onTouchMove,
      onTouchEnd: core.onTouchEnd,
      onTouchCancel: core.onTouchCancel,
      onContextMenu: core.onContextMenu,
      onClick: core.onClick,
    }),
    [core],
  )
}

export interface UseSwipePagerOptions {
  /** 总页数。 */
  count: number
  /** **受控**：外部持有页码。给了这个就应当同时给 `onIndexChange`。 */
  index?: number
  /** **非受控**：初始页码，默认 0。 */
  defaultIndex?: number
  /** 翻页落地时回调。受控用法里由它写回外部 state。 */
  onIndexChange?(index: number): void
  /** 翻页阈值，默认 `max(48, 容器宽 × 0.22)`。 */
  threshold?: SwipeThreshold
  /** 首 / 末页橡皮筋阻尼，默认 0.28。 */
  rubberBand?: number
  /** 切页动画时长 ms，默认 220。 */
  durationMs?: number
  /** 方向锁阈值 px，默认 6。 */
  lockSlop?: number
}

export interface SwipePagerBinding {
  /** 当前页码（受控时等于传进来的 `index`）。 */
  index: number
  offset: number
  animating: boolean
  dragging: boolean
  /** 摊到滚动容器上：`<div {...pager.containerProps} />`。含量宽用的 `ref`。 */
  containerProps: DragGestureHandlers & { ref(node: HTMLElement | null): void }
  /**
   * 三屏轨道的行内样式（轨道宽 300%、每屏 `calc(100% / 3)`）。
   * 布局用**自身百分比**而不是写死 33.3333%：后者每屏差出的亚像素会随页码累积成可见错位。
   */
  trackStyle: { transform: string; transition: string }
  /** 程序化切页。chip / 分段控件点击走它，才能和横扫共用同一条动画。 */
  slideTo(next: number): void
}

/**
 * 横扫分页（对应原生 `TabView(.page)`）。
 *
 * 受控：
 * ```jsx
 * const pager = useSwipePager({ count: 3, index, onIndexChange: setIndex })
 * ```
 * 非受控：
 * ```jsx
 * const pager = useSwipePager({ count: 3, defaultIndex: 0 })
 * ```
 * 两种用法下 `pager.index` 都是权威页码，照着它渲染 `index - 1 / index / index + 1` 三屏即可。
 *
 * **不要再自己接 `onTouchStart` / `onTouchCancel`**——`containerProps` 里那四个处理器已经把
 * 方向锁与「cancel = 放弃」定死了，再挂一层就又是两份实现。
 */
export function useSwipePager(options: UseSwipePagerOptions): SwipePagerBinding {
  const controlled = options.index !== undefined
  const [internalIndex, setInternalIndex] = useState(options.defaultIndex ?? 0)
  const index = controlled ? (options.index as number) : internalIndex

  const [view, setView] = useState<SwipePagerView>({ offset: 0, animating: false, dragging: false })
  const nodeRef = useRef<HTMLElement | null>(null)

  const latest = useRef({ ...options, controlled, index })
  latest.current = { ...options, controlled, index }

  const { rubberBand, durationMs, lockSlop } = options

  const core = useMemo(
    () =>
      createSwipePager({
        count: () => latest.current.count,
        index: () => latest.current.index,
        width: () => nodeRef.current?.clientWidth || 1,
        commit: (next) => {
          if (!latest.current.controlled) setInternalIndex(next)
          latest.current.onIndexChange?.(next)
        },
        render: setView,
        // 恒是函数，身份稳定：调用方传字面量还是内联箭头都不会让核心重建。
        threshold: (width) => {
          const value = latest.current.threshold ?? defaultSwipeThreshold
          return typeof value === 'function' ? value(width) : value
        },
        rubberBand,
        durationMs,
        lockSlop,
      }),
    [rubberBand, durationMs, lockSlop],
  )

  const ref = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node
  }, [])

  const containerProps = useMemo(
    () => ({
      ref,
      onTouchStart: core.onTouchStart,
      onTouchMove: core.onTouchMove,
      onTouchEnd: core.onTouchEnd,
      onTouchCancel: core.onTouchCancel,
    }),
    [core, ref],
  )

  const duration = durationMs ?? 220
  const trackStyle = useMemo(
    () => ({
      transform: `translate3d(calc(-100% / 3 + ${view.offset}px), 0, 0)`,
      transition: view.animating ? `transform ${duration}ms cubic-bezier(0.42, 0, 0.58, 1)` : 'none',
    }),
    [view.offset, view.animating, duration],
  )

  return {
    index,
    offset: view.offset,
    animating: view.animating,
    dragging: view.dragging,
    containerProps,
    trackStyle,
    slideTo: core.slideTo,
  }
}
