// 原生行手势（`aibox.list.*`）的接线口 —— 给**非虚拟**列表用。
//
// 框架侧真正干活的是 `aibox/ui` 的 `useListGestures`（configure 一次身份、订阅 action、
// 给区域贴 `data-aibox-native-gestures` 让 WebKit 交出自己的长按 UI）。它期望调用方每帧喂
// 「可见行矩形」，而这件事在 `VirtualList` 里是自动的；音乐的几张列表行数有限、直接铺 DOM，
// 所以这里补上等价的**矩形上报**：扫容器里的 `[data-row-id]`，把视口内的那些交回框架。
//
// 三条踩过的纪律（`framework-capabilities.md` §3.1 与 hooks.js 的注释）：
//  1. `rect` = `getBoundingClientRect()` 原样 —— **不乘 devicePixelRatio、不加 scrollTop**，
//     动一次就是「菜单弹在错误的行上」。
//  2. 矩形 600ms 过期，所以要持续上报（滚动 rAF + 心跳），不是挂载时报一次。
//  3. `rendered === false` 时业务**必须**保留自绘的长按/滑动 —— 聊天内联卡、无头执行等形态
//     根本没有手势层，永远不能只有原生一条路。

import React from 'react'
import { useListGestures } from 'aibox/ui'

/** 矩形心跳周期（ms）。宿主侧 600ms 过期，取其一半留足余量，代价是每轮几十次 rect 读取。 */
const HEARTBEAT_MS = 280
/** 单次上报的行数上限（与桥 schema 的 maxItems 对齐）。 */
const MAX_ROWS = 120

/**
 * @param {string} regionId 手势区域 id（同一页面内唯一）。
 * @param {{
 *   contextMenu?: Array<{id:string,title:string,icon?:string,role?:string,tint?:string}>,
 *   leadingSwipe?: Array<object>, trailingSwipe?: Array<object>,
 *   rowOverrides?: (rowId: string) => object|null,
 *   onAction?: (event: {rowId: string, actionId: string, source: string}) => void,
 *   enabled?: boolean,
 * }} config
 * @returns {{ rendered: boolean, available: boolean, regionProps: object }}
 *   把 `regionProps` 铺到滚动容器上，把 `data-row-id` 铺到每一行上，就接完了。
 */
export function useRowGestures(regionId, config = {}) {
  const { rendered, available, onVisibleRowsChange } = useListGestures(regionId, config)
  const containerRef = React.useRef(null)
  // 上报函数每帧都被调用，用 ref 持有以免把 effect 拴在它身上反复重装监听。
  const reportRef = React.useRef(onVisibleRowsChange)
  reportRef.current = onVisibleRowsChange

  React.useEffect(() => {
    if (!rendered) return undefined
    let frame = 0
    const report = () => {
      frame = 0
      const node = containerRef.current
      if (!node) return
      const viewport = window.innerHeight || 0
      const rows = []
      const nodes = node.querySelectorAll('[data-row-id]')
      for (let i = 0; i < nodes.length && rows.length < MAX_ROWS; i += 1) {
        const element = nodes[i]
        const rect = element.getBoundingClientRect()
        // 只报视口内的行（上下各留 40pt 余量，滚动中提前登记，手指落下时已经在册）。
        if (rect.height <= 0 || rect.bottom < -40 || rect.top > viewport + 40) continue
        rows.push({ id: element.getAttribute('data-row-id'), rect: [rect.left, rect.top, rect.width, rect.height] })
      }
      reportRef.current(rows)
    }
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(report)
    }
    report()
    const timer = window.setInterval(report, HEARTBEAT_MS)
    // 滚动容器与 window 都听：`.mu-scroll` 自己滚时 window 不发 scroll。
    const node = containerRef.current
    if (node) node.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.clearInterval(timer)
      if (frame) window.cancelAnimationFrame(frame)
      if (node) node.removeEventListener('scroll', schedule)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [rendered, regionId])

  const regionProps = React.useMemo(() => ({
    ref: containerRef,
    'data-region-id': regionId,
  }), [regionId])

  return { rendered, available, regionProps }
}
