// 虚拟长列表 —— **`aibox/ui` 的同接口本地兜底**。
//
// 为什么不直接 `import { VirtualList } from 'aibox/ui'`：该资产在
// `WebAssets/applet-runtime/src/aibox-ui/` 里已经存在，但**说明符还没进
// `AppletImportRules.bareWhitelist`（Swift 侧）与 market 的 `BARE_IMPORT_ALLOWLIST`**，
// 现在写裸 import 会转译期被拒 / validate 报错 → 整个模块白屏。
// 所以这里实现一份 props 完全对齐的兜底；等 `aibox/ui` 上架后，把本文件换成
// `export { VirtualList } from 'aibox/ui'` 即可，调用方一行不用改。
//
// 与框架版的差异：不接 §3.1 的原生手势层（宿主还没有），`onVisibleRowsChange` 照常回调；
// 滚动位置恢复用 sessionStorage，键前缀与框架版一致。

import React from 'react'

const RESTORE_PREFIX = 'aibox.vlist:'

function defaultKeyExtractor(item, index) {
  if (item && typeof item === 'object') {
    if (item.id !== undefined && item.id !== null) return String(item.id)
    if (item.key !== undefined && item.key !== null) return String(item.key)
  }
  return String(index)
}

/** 量化到 0.5px —— 消除浮点抖动导致的「高度变了」误判（否则会无限重渲）。 */
function quantize(value) {
  return Math.round(value * 2) / 2
}

function indexAtOffset(offsets, count, y) {
  if (count <= 0) return 0
  let lo = 0
  let hi = count - 1
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid] <= y) { ans = mid; lo = mid + 1 } else { hi = mid - 1 }
  }
  return ans
}

export function VirtualList({
  items,
  renderRow,
  keyExtractor,
  estimatedRowHeight = 64,
  overscan = 6,
  overscanPx = 240,
  header = null,
  footer = null,
  empty = null,
  onEndReached,
  endReachedThreshold = 400,
  onVisibleRowsChange,
  onScroll,
  restoreKey,
  className,
  style,
  rowStyle,
}) {
  const list = Array.isArray(items) ? items : []
  const count = list.length
  const estimate = estimatedRowHeight > 0 ? estimatedRowHeight : 64

  const scrollRef = React.useRef(null)
  const measured = React.useRef(null)
  if (measured.current === null) measured.current = new Map()
  const endArmed = React.useRef(true)
  const [viewport, setViewport] = React.useState({ top: 0, height: 0 })
  const [, forceRender] = React.useReducer((n) => n + 1, 0)

  const keyOf = React.useRef(keyExtractor || defaultKeyExtractor)

  // 偏移表：measured 里有实测就用实测，否则用估算。
  const { offsets, total } = React.useMemo(() => {
    const rows = new Float64Array(count)
    let running = 0
    for (let i = 0; i < count; i += 1) {
      rows[i] = running
      running += measured.current.get(keyOf.current(list[i], i)) || estimate
    }
    return { offsets: rows, total: running }
    // measured 的变化通过 forceRender 触发重算，故此处不进依赖表。
  }, [list, count, estimate]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = Math.max(0, indexAtOffset(offsets, count, viewport.top - overscanPx) - overscan)
  const endOffset = viewport.top + viewport.height + overscanPx
  let end = start
  while (end < count && offsets[end] < endOffset) end += 1
  end = Math.min(count, end + overscan)

  const onScrollEvent = React.useCallback((event) => {
    const node = event.currentTarget
    setViewport({ top: node.scrollTop, height: node.clientHeight })
    if (onScroll) onScroll(event)
    if (restoreKey) {
      try { window.sessionStorage.setItem(RESTORE_PREFIX + restoreKey, String(node.scrollTop)) } catch (error) { /* 配额满不影响列表 */ }
    }
    if (onEndReached) {
      const remaining = node.scrollHeight - node.scrollTop - node.clientHeight
      if (remaining < endReachedThreshold) {
        if (endArmed.current) { endArmed.current = false; onEndReached() }
      } else {
        endArmed.current = true
      }
    }
  }, [onScroll, onEndReached, endReachedThreshold, restoreKey])

  React.useLayoutEffect(() => {
    const node = scrollRef.current
    if (!node) return
    setViewport({ top: node.scrollTop, height: node.clientHeight })
  }, [])

  // 滚动位置恢复（等首屏行挂载完再还原）。
  React.useEffect(() => {
    if (!restoreKey) return undefined
    const node = scrollRef.current
    if (!node) return undefined
    let raw = null
    try { raw = window.sessionStorage.getItem(RESTORE_PREFIX + restoreKey) } catch (error) { raw = null }
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) return undefined
    const timer = window.setTimeout(() => { node.scrollTop = value }, 0)
    return () => window.clearTimeout(timer)
  }, [restoreKey])

  // 实测回填：只观测在窗口内的行；离开窗口显式 unobserve
  // ——ResizeObserver 对目标是**强引用**，不解绑就是持续泄漏。
  const observer = React.useRef(null)
  const observed = React.useRef(null)
  if (observed.current === null) observed.current = new Map()

  React.useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined
    observer.current = new ResizeObserver((entries) => {
      let changed = false
      for (const entry of entries) {
        const key = observed.current.get(entry.target)
        if (!key) continue
        const height = quantize(entry.contentRect.height + 0)
        if (height > 0 && measured.current.get(key) !== height) {
          measured.current.set(key, height)
          changed = true
        }
      }
      if (changed) forceRender()
    })
    return () => {
      observer.current.disconnect()
      observed.current.clear()
    }
  }, [])

  const attachRow = React.useCallback((key) => (node) => {
    const ro = observer.current
    if (!node) return
    const height = quantize(node.getBoundingClientRect().height)
    if (height > 0 && measured.current.get(key) !== height) {
      measured.current.set(key, height)
      forceRender()
    }
    if (ro && !observed.current.has(node)) {
      observed.current.set(node, key)
      ro.observe(node)
    }
  }, [])

  // 上报可见行（框架版在这里喂原生手势层；兜底版只透出给调用方）。
  const reported = React.useRef('')
  React.useEffect(() => {
    if (!onVisibleRowsChange) return
    const rows = []
    for (let i = start; i < end; i += 1) {
      const key = keyOf.current(list[i], i)
      rows.push({ id: key, index: i, top: offsets[i], height: measured.current.get(key) || estimate })
    }
    const signature = `${start}-${end}-${count}`
    if (signature === reported.current) return
    reported.current = signature
    onVisibleRowsChange(rows)
  }, [start, end, count, list, offsets, estimate, onVisibleRowsChange])

  if (count === 0 && empty) {
    return (
      <div ref={scrollRef} className={className} style={style} onScroll={onScrollEvent}>
        {header}
        {empty}
        {footer}
      </div>
    )
  }

  const slice = []
  for (let i = start; i < end; i += 1) {
    const key = keyOf.current(list[i], i)
    slice.push(
      <div
        key={key}
        ref={attachRow(key)}
        style={{ position: 'absolute', top: offsets[i], left: 0, right: 0, ...rowStyle }}
      >
        {renderRow(list[i], i)}
      </div>,
    )
  }

  return (
    <div ref={scrollRef} className={className} style={style} onScroll={onScrollEvent}>
      {header}
      <div style={{ position: 'relative', height: total }}>{slice}</div>
      {footer}
    </div>
  )
}

export default VirtualList
