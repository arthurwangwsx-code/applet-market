// 页面通用零件：空态、分组/行、底部动作面板、左滑删除、下拉刷新、增量渲染。
// 弹层刻意自绘（不用 antd-mobile 的 Popup/ActionSheet/Toast）—— 运行时已知 `Toast.show` 渲染为空，
// 同族命令式弹层风险相同；自绘的 fixed 覆盖层在 WebView 里行为确定，也更好对齐本包的设计令牌。
//
// **触摸手势一律走 SDK**（`useDragGesture` / `useSwipePager` / `useLongPress`），
// 本文件不再出现任何 `onTouch*`。理由见 SDK `react/gestures.ts` 文件头：`touchcancel`
// 只有原生手势抢走触摸时才发，浏览器里测不出来，手搓必漏——2026-08-06 实测本应用与理财
// 各自手搓、各自写错，错法还相反。

import React from 'react'
import { createPortal } from 'react-dom'
import { useDragGesture } from '@aibox/applet-sdk/react'
import Icon from './Icon.js'
import { C, SPACE } from './theme.js'

export function Spinner({ size = 16, color = 'currentColor' }) {
  return (
    <svg className="news-spin" viewBox="0 0 24 24" width={size} height={size} style={{ display: 'block', color }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.22" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyState({ icon, text }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      padding: '60px 32px', textAlign: 'center',
    }}
    >
      <Icon name={icon} size={34} color={C.muted} />
      <span style={{ fontSize: 15, color: C.muted, lineHeight: 1.4 }}>{text}</span>
    </div>
  )
}

export function SectionHeader({ children }) {
  return (
    <div style={{
      padding: `${SPACE.s5}px ${SPACE.s4}px 6px`,
      fontSize: 13,
      color: C.muted,
      textTransform: 'none',
    }}
    >
      {children}
    </div>
  )
}

export function SectionFooter({ children }) {
  return (
    <div style={{ padding: `6px ${SPACE.s4}px ${SPACE.s3}px`, fontSize: 12, color: C.muted, lineHeight: 1.4 }}>
      {children}
    </div>
  )
}

export function Card({ children, style }) {
  return (
    <div style={{
      background: C.surface,
      borderRadius: 12,
      margin: `0 ${SPACE.s4}px`,
      overflow: 'hidden',
      ...style,
    }}
    >
      {children}
    </div>
  )
}

/** 设置/列表里的一行：左图标 + 标题（+副标题）+ 右侧内容/箭头。 */
export function Row({ icon, iconColor, title, subtitle, detail, accessory, onClick, danger, last }) {
  const Element = onClick ? 'button' : 'div'
  return (
    <Element
      className={onClick ? 'news-btn news-press' : undefined}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%',
        padding: `11px ${SPACE.s4}px`, minHeight: 44,
        borderBottom: last ? 'none' : `0.5px solid ${C.line}`,
        background: 'transparent',
      }}
    >
      {icon ? <Icon name={icon} size={17} color={iconColor || C.muted} /> : null}
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, color: danger ? C.danger : C.ink }}>{title}</span>
        {subtitle ? (
          <span className="news-clamp-1" style={{ fontSize: 12, color: C.muted }}>{subtitle}</span>
        ) : null}
      </div>
      {detail !== undefined && detail !== null ? (
        <span className="news-mono" style={{ fontSize: 15, color: C.muted, flex: '0 0 auto' }}>{detail}</span>
      ) : null}
      {accessory}
      {onClick && accessory === undefined ? <Icon name="chevron.right" size={13} color={C.muted} /> : null}
    </Element>
  )
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="news-btn news-press"
      onClick={(event) => { event.stopPropagation(); if (!disabled) onChange(!checked) }}
      style={{
        width: 46, height: 28, borderRadius: 14, flex: '0 0 auto', padding: 2,
        opacity: disabled ? 0.45 : 1,
        background: checked ? C.brand : 'color-mix(in srgb, var(--news-line) 90%, transparent)',
        transition: 'background 180ms ease',
      }}
    >
      <span style={{
        display: 'block', width: 24, height: 24, borderRadius: 12, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
        transform: `translateX(${checked ? 18 : 0}px)`,
        transition: 'transform 180ms ease',
      }}
      />
    </button>
  )
}

// MARK: - 底部动作面板

export function Sheet({ visible, onClose, children }) {
  const [mounted, setMounted] = React.useState(visible)
  React.useEffect(() => {
    if (visible) { setMounted(true); return undefined }
    const timer = window.setTimeout(() => setMounted(false), 200)
    return () => window.clearTimeout(timer)
  }, [visible])
  if (!mounted) return null
  // 必须 portal 到 body：分页器轨道带 transform，会给 position:fixed 后代造出新的包含块，
  // 面板留在原位就会跟着轨道被平移 / 裁掉。
  const node = (
    <div
      className="news-sheet-backdrop"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          background: C.surface,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'transform 200ms ease',
          maxHeight: '82dvh',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
  return typeof document !== 'undefined' && document.body ? createPortal(node, document.body) : node
}

/** 长按菜单 / 选项列表。actions = [{ key, label, icon, danger, onSelect }] */
export function ActionSheet({ visible, title, actions, cancelLabel, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {title ? (
        <div style={{
          padding: `${SPACE.s4}px ${SPACE.s4}px ${SPACE.s2}px`, fontSize: 13, color: C.muted,
          borderBottom: `0.5px solid ${C.line}`,
        }}
        >
          <span className="news-clamp-2">{title}</span>
        </div>
      ) : null}
      {actions.map((action, i) => (
        <button
          key={action.key}
          type="button"
          className="news-btn news-press"
          onClick={() => { onClose(); action.onSelect() }}
          style={{
            display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%',
            padding: `14px ${SPACE.s4}px`,
            borderBottom: i === actions.length - 1 ? 'none' : `0.5px solid ${C.line}`,
            color: action.danger ? C.danger : C.ink,
            fontSize: 16,
          }}
        >
          <Icon name={action.icon} size={18} />
          <span>{action.label}</span>
        </button>
      ))}
      {cancelLabel ? (
        <button
          type="button"
          className="news-btn news-press"
          onClick={onClose}
          style={{
            display: 'block', width: '100%', padding: `14px ${SPACE.s4}px`, marginTop: 6,
            borderTop: `6px solid ${C.bg}`, color: C.brand, fontSize: 16, textAlign: 'center',
          }}
        >
          {cancelLabel}
        </button>
      ) : null}
    </Sheet>
  )
}

// MARK: - 左滑删除

export function SwipeRow({ children, actionLabel, onAction, disabled }) {
  const [offset, setOffset] = React.useState(0)
  const [animating, setAnimating] = React.useState(false)
  // 手势起点的基准偏移与实时偏移都放 ref：处理器身份稳定，读到的永远是最新值而不是闭包快照。
  const base = React.useRef(0)
  const live = React.useRef(0)
  const WIDTH = 88

  const settle = React.useCallback((value) => {
    live.current = value
    setAnimating(true)
    setOffset(value)
    window.setTimeout(() => setAnimating(false), 200)
  }, [])

  // 横向轴锁 + 6px slop + 锁定后才 preventDefault，与迁移前逐条一致；
  // `touchcancel` 由 SDK 定死成「弹回原位、不提交」，这里不需要（也不该）再写一遍。
  const { handlers } = useDragGesture({
    axis: 'x',
    onStart: () => { base.current = live.current },
    onDrag: ({ dx }) => {
      const next = Math.max(-WIDTH, Math.min(0, base.current + dx))
      live.current = next
      setOffset(next)
    },
    onEnd: () => settle(live.current < -WIDTH / 2 ? -WIDTH : 0),
    onCancel: () => settle(0),
  })

  if (disabled) return children

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <button
        type="button"
        className="news-btn news-press"
        onClick={() => { settle(0); onAction() }}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: WIDTH,
          background: C.danger, color: '#fff', fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {actionLabel}
      </button>
      <div
        {...handlers}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: animating ? 'transform 200ms ease' : 'none',
          background: C.surface,
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// MARK: - 下拉刷新

export function PullRefresh({ onRefresh, refreshing, children, scrollRef }) {
  const [pull, setPull] = React.useState(0)
  const live = React.useRef(0)
  const THRESHOLD = 64

  // `lock: 'none'`：下拉刷新本来就只读 dy、不与横向竞争，也不抢事件（`preventDefault` 关掉）。
  // 迁移前这里没有方向锁，保持一致——加锁会改掉既有观感，而这不是本次要改的东西。
  const { handlers, dragging } = useDragGesture({
    axis: 'y',
    lock: 'none',
    preventDefaultWhenLocked: false,
    canStart: () => Boolean(scrollRef.current) && scrollRef.current.scrollTop <= 0 && !refreshing,
    onDrag: ({ dy }) => {
      const next = dy <= 0 ? 0 : Math.min(96, dy * 0.5)
      live.current = next
      setPull(next)
    },
    onEnd: () => {
      if (live.current >= THRESHOLD) onRefresh()
      live.current = 0
      setPull(0)
    },
    // 放弃：收起下拉区，**绝不触发刷新**（用户并没有完成这次下拉，那一下属于别的手势）。
    onCancel: () => { live.current = 0; setPull(0) },
  })

  return (
    <div ref={scrollRef} className="news-scroll" {...handlers}>
      <div style={{
        height: refreshing ? 40 : pull,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: dragging ? 'none' : 'height 200ms ease',
        overflow: 'hidden', color: C.muted,
      }}
      >
        {refreshing || pull > 8 ? <Spinner size={18} color={C.brand} /> : null}
      </div>
      {children}
    </div>
  )
}

// MARK: - 增量渲染

/**
 * 一次性全量渲染 300 行 DOM 会明显掉帧；这里按 step 增量挂载（**不是分页**：数据仍是全量，
 * 滚到底自动补渲染，与原生「一次性全量渲染」的可见行为一致）。
 */
export function useIncremental(items, step = 30) {
  const [limit, setLimit] = React.useState(step)
  const sentinel = React.useRef(null)
  React.useEffect(() => { setLimit(step) }, [items, step])
  React.useEffect(() => {
    const node = sentinel.current
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setLimit((current) => (current >= items.length ? current : current + step))
      }
    }, { rootMargin: '400px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [items.length, step])
  return { visible: items.slice(0, limit), sentinel, hasMore: limit < items.length }
}
