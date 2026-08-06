// 左右横扫分页（对应原生 `TabView(.page)`）：资讯页的主题分页与收藏页的两个子 Tab 共用。
// 只挂载「上一页 / 当前页 / 下一页」三屏，切页动画 easeInOut 0.22s，与 chip / 分段控件双向联动。

import React from 'react'

const DURATION = 220
const LOCK_SLOP = 6

const Pager = React.forwardRef(function Pager({ count, index, onIndex, renderPage, style }, ref) {
  const hostRef = React.useRef(null)
  const [drag, setDrag] = React.useState(0)
  const [animating, setAnimating] = React.useState(false)
  const gesture = React.useRef({ active: false, startX: 0, startY: 0, lock: null, width: 1 })
  const commitRef = React.useRef(null)

  const settle = React.useCallback((nextIndex, direction) => {
    const width = hostRef.current ? hostRef.current.clientWidth : 1
    if (nextIndex === index) {
      setAnimating(true)
      setDrag(0)
      window.setTimeout(() => setAnimating(false), DURATION)
      return
    }
    commitRef.current = nextIndex
    setAnimating(true)
    setDrag(-direction * width)
    window.setTimeout(() => {
      setAnimating(false)
      setDrag(0)
      const target = commitRef.current
      commitRef.current = null
      if (target !== null) onIndex(target)
    }, DURATION)
  }, [index, onIndex])

  React.useImperativeHandle(ref, () => ({
    slideTo(nextIndex) {
      if (nextIndex === index || nextIndex < 0 || nextIndex >= count) return
      settle(nextIndex, nextIndex > index ? 1 : -1)
    },
  }), [count, index, settle])

  const onTouchStart = (event) => {
    if (animating || event.touches.length !== 1) return
    const touch = event.touches[0]
    gesture.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      lock: null,
      width: hostRef.current ? hostRef.current.clientWidth : 1,
    }
  }

  const onTouchMove = (event) => {
    const state = gesture.current
    if (!state.active) return
    const touch = event.touches[0]
    const dx = touch.clientX - state.startX
    const dy = touch.clientY - state.startY
    if (state.lock === null) {
      if (Math.abs(dx) < LOCK_SLOP && Math.abs(dy) < LOCK_SLOP) return
      state.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (state.lock !== 'h') return
    if (event.cancelable) event.preventDefault()
    // 首/末页做橡皮筋阻尼，避免滑出空白屏。
    const atStart = index === 0 && dx > 0
    const atEnd = index === count - 1 && dx < 0
    setDrag(atStart || atEnd ? dx * 0.28 : dx)
  }

  const onTouchEnd = () => {
    const state = gesture.current
    if (!state.active) return
    state.active = false
    if (state.lock !== 'h') return
    const threshold = Math.max(48, state.width * 0.22)
    let next = index
    if (drag <= -threshold && index < count - 1) next = index + 1
    else if (drag >= threshold && index > 0) next = index - 1
    settle(next, next > index ? 1 : (next < index ? -1 : 0))
  }

  // 触摸被原生手势抢走（宿主的退出手势、页栈返回、系统接管…）。
  // **必须回弹放弃，不能复用 `onTouchEnd`**：`touchcancel` 的语义是「这串触摸已经不属于页面了」，
  // 用户的意图是那个原生手势，不是翻页；当成 end 处理会在阈值够时**直接提交一次用户没打算做的翻页**。
  // 纯 Web 环境几乎触发不到 touchcancel（只有原生识别器抢触摸才发），所以这条极易漏——
  // 2026-08-06 排查时本文件与理财的 `primitives.jsx` 两处手搓分页**都**错了，错法还相反
  //（这边是 cancel 当提交，那边是根本没接、状态永不复位）。
  const onTouchCancel = () => {
    const state = gesture.current
    if (!state.active) return
    const wasHorizontal = state.lock === 'h'
    state.active = false
    state.lock = null
    // `settle(index, 0)` 走的是「目标页 === 当前页」那条分支：动画回弹到本页，不提交。
    if (wasHorizontal) settle(index, 0)
  }

  // translate 的百分比按**自身**尺寸算 —— 轨道是宿主的 300%，故一屏 = 100%/3，
  // 与 `.news-pager-slot` 的 `calc(100% / 3)` 精确同宽（写死 33.3333% 会差出亚像素并累积）。
  const offset = `calc(-100% / 3 + ${drag}px)`
  return (
    <div
      ref={hostRef}
      style={{ overflow: 'hidden', flex: '1 1 auto', minHeight: 0, display: 'flex', ...style }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <div
        className="news-pager-track"
        style={{
          transform: `translate3d(${offset}, 0, 0)`,
          transition: animating ? `transform ${DURATION}ms cubic-bezier(0.42, 0, 0.58, 1)` : 'none',
        }}
      >
        <div className="news-pager-slot">{index - 1 >= 0 ? renderPage(index - 1) : null}</div>
        <div className="news-pager-slot">{renderPage(index)}</div>
        <div className="news-pager-slot">{index + 1 < count ? renderPage(index + 1) : null}</div>
      </div>
    </div>
  )
})

export default Pager
