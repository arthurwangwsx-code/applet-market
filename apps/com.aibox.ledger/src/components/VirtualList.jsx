// ⚠️ **临时件**：`aibox/ui` 的 `VirtualList`（framework-capabilities.md §3.2）由框架侧另一位
// agent 并行开发中，且 `aibox/ui` 目前**还不在市场校验的裸 import 白名单**里
// （`scripts/lib/market.mjs` 的 BARE_IMPORT_ALLOWLIST），现在 import 会被 validate.mjs 拒。
//
// 所以这里先按同一份接口写一个本地实现，等框架资产上线、白名单放开后，把本文件换成：
//
//     export { VirtualList } from 'aibox/ui'
//
// 调用方无需改动。接口对齐 §3.2：
//     items / estimatedRowHeight / renderRow / onVisibleRowsChange / restoreKey
//
// 实现要点：行高不定（按日分组的卡片高度差很大），所以测量后缓存，未测量的用估值；
// 只渲染视口 ± overscan 的行，其余用上下两块占位撑住滚动条。

import React from 'react'

const scrollMemory = new Map()

export function VirtualList({
  items,
  estimatedRowHeight = 96,
  renderRow,
  keyFor,
  onVisibleRowsChange,
  restoreKey,
  overscan = 6,
  gap = 0,
  style,
  header,
  footer,
}) {
  const containerRef = React.useRef(null)
  const heights = React.useRef(new Map())
  const [, forceRender] = React.useState(0)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [viewport, setViewport] = React.useState(0)

  const keyOf = React.useCallback(
    (item, index) => (keyFor ? keyFor(item, index) : (item && item.id) || index),
    [keyFor],
  )

  // 累积偏移表：offsets[i] = 第 i 行的顶部位置。
  const offsets = React.useMemo(() => {
    const table = new Array(items.length + 1)
    table[0] = 0
    for (let i = 0; i < items.length; i += 1) {
      const measured = heights.current.get(keyOf(items[i], i))
      table[i + 1] = table[i] + (measured ?? estimatedRowHeight) + gap
    }
    return table
    // heights 变化通过 forceRender 触发重算
  }, [items, estimatedRowHeight, gap, keyOf, scrollTop, viewport]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = offsets[items.length] ?? 0

  // 二分找首个可见行。
  const firstVisible = React.useMemo(() => {
    let low = 0
    let high = items.length - 1
    let found = 0
    while (low <= high) {
      const mid = (low + high) >> 1
      if (offsets[mid] <= scrollTop) { found = mid; low = mid + 1 } else high = mid - 1
    }
    return found
  }, [offsets, scrollTop, items.length])

  const lastVisible = React.useMemo(() => {
    let index = firstVisible
    while (index < items.length && offsets[index] < scrollTop + viewport) index += 1
    return index
  }, [offsets, firstVisible, scrollTop, viewport, items.length])

  const start = Math.max(0, firstVisible - overscan)
  const end = Math.min(items.length, lastVisible + overscan)

  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return undefined
    const measure = () => setViewport(element.clientHeight)
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer) observer.observe(element)
    return () => { if (observer) observer.disconnect() }
  }, [])

  // 滚动位置恢复（对应 §3.2 的 restoreKey）。
  React.useEffect(() => {
    const element = containerRef.current
    if (!element || !restoreKey) return undefined
    const saved = scrollMemory.get(restoreKey)
    if (saved) element.scrollTop = saved
    return () => { if (restoreKey) scrollMemory.set(restoreKey, element.scrollTop) }
  }, [restoreKey])

  React.useEffect(() => {
    if (!onVisibleRowsChange) return
    onVisibleRowsChange(items.slice(firstVisible, lastVisible))
  }, [items, firstVisible, lastVisible, onVisibleRowsChange])

  const measureRow = React.useCallback((key, element) => {
    if (!element) return
    const height = element.offsetHeight
    if (height > 0 && heights.current.get(key) !== height) {
      heights.current.set(key, height)
      forceRender((n) => n + 1)
    }
  }, [])

  const rows = []
  for (let index = start; index < end; index += 1) {
    const item = items[index]
    const key = keyOf(item, index)
    rows.push(
      <div key={key} ref={(element) => measureRow(key, element)} style={{ marginBottom: gap || undefined }}>
        {renderRow(item, index)}
      </div>,
    )
  }

  return (
    <div ref={containerRef} className="lg-scroll" style={style}>
      {header}
      <div style={{ height: offsets[start] ?? 0 }} />
      {rows}
      <div style={{ height: Math.max(0, total - (offsets[end] ?? total)) }} />
      {footer}
    </div>
  )
}

export default VirtualList
