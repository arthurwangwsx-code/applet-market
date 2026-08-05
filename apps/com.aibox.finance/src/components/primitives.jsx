// 页面通用零件：空态 / 分段 / chip / 下拉菜单 / 底部面板 / 左滑删除 / 下拉刷新 / 数字输入。
//
// 弹层刻意自绘（不用 antd-mobile 的 Popup / ActionSheet / Toast）——运行时已知
// `Toast.show` 渲染为空，同族命令式弹层风险相同；自绘的 fixed 覆盖层在 WebView 里行为确定。

import React from 'react'
import Icon from './Icon.js'
import { C, RADIUS, SPACE } from './theme.js'

export function Spinner({ size = 16, color = 'currentColor' }) {
  return (
    <svg className="fin-spin" viewBox="0 0 24 24" width={size} height={size} style={{ display: 'block', color }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.22" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyState({ icon, text, actionLabel, onAction, padding = 48 }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      padding: `${padding}px 32px`, textAlign: 'center',
    }}
    >
      {icon ? <Icon name={icon} size={34} color={C.muted} /> : null}
      <span style={{ fontSize: 15, color: C.muted, lineHeight: 1.4 }}>{text}</span>
      {actionLabel ? (
        <button type="button" className="fin-btn fin-press" onClick={onAction} style={{ color: C.brand, fontSize: 15 }}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

/** 卡壳：标题 13pt muted（+ 可选副标题）+ surface 内容块。 */
export function Card({ title, subtitle, trailing, children, padding = SPACE.s3, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {(title || trailing) ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {title ? <span style={{ fontSize: 13, color: C.muted }}>{title}</span> : null}
          {subtitle ? <span style={{ fontSize: 12, color: C.muted }}>{subtitle}</span> : null}
          <span style={{ flex: '1 1 auto' }} />
          {trailing}
        </div>
      ) : null}
      <div style={{ background: C.surface, borderRadius: RADIUS.card, padding }}>{children}</div>
    </div>
  )
}

/** 标签 / 值的一格（指标网格、stat 行共用）。 */
export function Stat({ label, value, color, valueSize = 15, align = 'flex-start' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: align, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
      <span className="fin-mono" style={{ fontSize: valueSize, fontWeight: 500, color: color || C.ink }}>{value}</span>
    </div>
  )
}

/**
 * chip：12pt（选中 semibold）。两套配色——
 * 行业页用 brand 字 + brand 12% 底；自选分组条用 ink 字 + surface 底 + muted 25% 描边。
 */
export function Chip({ label, selected, onClick, variant = 'brand' }) {
  const brandStyle = selected
    ? { color: C.brand, background: 'color-mix(in srgb, var(--fin-brand) 12%, transparent)', border: '0' }
    : { color: C.muted, background: C.surface, border: '0' }
  const plainStyle = selected
    ? { color: C.ink, background: C.surface, border: '0' }
    : { color: C.muted, background: 'transparent', border: '1px solid color-mix(in srgb, var(--fin-muted) 25%, transparent)' }
  const skin = variant === 'brand' ? brandStyle : plainStyle
  return (
    <button
      type="button"
      className="fin-btn fin-press"
      onClick={onClick}
      style={{
        flex: '0 0 auto',
        padding: variant === 'brand' ? '5px 10px' : '7px 12px',
        borderRadius: RADIUS.pill,
        fontSize: 12,
        fontWeight: selected ? 600 : 400,
        whiteSpace: 'nowrap',
        ...skin,
      }}
    >
      {label}
    </button>
  )
}

/** 横向 chip 条（指数条、分组条、行业 toggle 共用的滚动容器）。 */
export function ChipRow({ children, padding = SPACE.s4, gap = SPACE.s2, style }) {
  return (
    <div className="fin-hscroll" style={{ display: 'flex', gap, padding: `0 ${padding}px`, ...style }}>
      {children}
    </div>
  )
}

/** 分段控件（行业页的板块/资金/龙虎）。 */
export function Segmented({ items, value, onChange }) {
  return (
    <div style={{
      display: 'flex', background: 'color-mix(in srgb, var(--fin-muted) 12%, transparent)',
      borderRadius: 9, padding: 2, gap: 2,
    }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="fin-btn fin-press"
          onClick={() => onChange(item.id)}
          style={{
            flex: '1 1 0', textAlign: 'center', padding: '6px 4px', borderRadius: 7, fontSize: 13,
            fontWeight: value === item.id ? 600 : 400,
            color: C.ink,
            background: value === item.id ? C.surface : 'transparent',
            boxShadow: value === item.id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/** 下拉菜单（详情页的周期/复权/指标；自选页的排序）。 */
export function Menu({ icon, label, items, value, onSelect, align = 'left', trailing }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)
  React.useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flex: '0 0 auto' }}>
      <button
        type="button"
        className="fin-btn fin-press"
        onClick={() => setOpen((current) => !current)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.ink }}
      >
        {icon ? <Icon name={icon} size={12} color={C.muted} /> : null}
        <span>{label}</span>
        {trailing === undefined ? <Icon name="chevron.down" size={10} color={C.muted} /> : trailing}
      </button>
      {open ? (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 30, minWidth: 132,
          background: C.surface, borderRadius: 12, padding: 4,
          boxShadow: '0 8px 28px rgba(0,0,0,0.22)', border: `0.5px solid ${C.line}`,
        }}
        >
          {items.map((item) => (
            item.divider ? (
              <div key={item.id} style={{ height: 0.5, background: C.line, margin: '4px 8px' }} />
            ) : (
              <button
                key={item.id}
                type="button"
                className="fin-btn fin-press"
                disabled={item.disabled}
                onClick={() => { setOpen(false); onSelect(item.id) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '9px 10px', borderRadius: 8, fontSize: 14,
                  color: item.disabled ? C.muted : C.ink,
                  opacity: item.disabled ? 0.5 : 1,
                }}
              >
                <span style={{ flex: '1 1 auto' }}>{item.label}</span>
                {value === item.id ? <Icon name="checkmark.circle.fill" size={14} color={C.brand} /> : null}
              </button>
            )
          ))}
        </div>
      ) : null}
    </div>
  )
}

// MARK: - 底部面板

export function Sheet({ visible, onClose, children, maxHeight = '86dvh' }) {
  const [mounted, setMounted] = React.useState(visible)
  React.useEffect(() => {
    if (visible) { setMounted(true); return undefined }
    const timer = window.setTimeout(() => setMounted(false), 200)
    return () => window.clearTimeout(timer)
  }, [visible])
  if (!mounted) return null
  return (
    <div
      className="fin-sheet-backdrop"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%', background: C.bg,
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'transform 200ms ease',
          maxHeight,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px', flex: '0 0 auto' }}>
          <span style={{ width: 36, height: 5, borderRadius: 3, background: 'color-mix(in srgb, var(--fin-muted) 40%, transparent)' }} />
        </div>
        {children}
      </div>
    </div>
  )
}

export function SheetHeader({ title, onClose, closeLabel, trailing }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: `4px ${SPACE.s4}px 10px`,
      borderBottom: `0.5px solid ${C.line}`, flex: '0 0 auto',
    }}
    >
      <span style={{ fontSize: 17, fontWeight: 500, flex: '1 1 auto' }}>{title}</span>
      {trailing}
      {onClose ? (
        <button type="button" className="fin-btn fin-press" onClick={onClose} style={{ color: C.brand, fontSize: 15 }}>
          {closeLabel}
        </button>
      ) : null}
    </div>
  )
}

// MARK: - 数字输入
//
// `inputMode="decimal"` 让 iOS 弹小数键盘（对齐原生的 decimalPad）。

export function Field({ label, value, onChange, placeholder, suffix, numeric = true, autoFocus }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: '11px 0', minHeight: 44,
      borderBottom: `0.5px solid ${C.line}`,
    }}
    >
      <span style={{ fontSize: 15, color: C.ink, flex: '0 0 auto', minWidth: 76 }}>{label}</span>
      <input
        className="fin-field"
        style={{ textAlign: 'right' }}
        inputMode={numeric ? 'decimal' : 'text'}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {suffix ? <span style={{ fontSize: 13, color: C.muted, flex: '0 0 auto' }}>{suffix}</span> : null}
    </label>
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
      className="fin-btn fin-press"
      onClick={(event) => { event.stopPropagation(); if (!disabled) onChange(!checked) }}
      style={{
        width: 46, height: 28, borderRadius: 14, flex: '0 0 auto', padding: 2,
        opacity: disabled ? 0.45 : 1,
        background: checked ? C.green : 'color-mix(in srgb, var(--fin-muted) 32%, transparent)',
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

/** 设置/列表里的一行。 */
export function Row({ icon, title, subtitle, detail, detailColor, accessory, onClick, danger, last }) {
  const Element = onClick ? 'button' : 'div'
  return (
    <Element
      className={onClick ? 'fin-btn fin-press' : undefined}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%',
        padding: '11px 0', minHeight: 44,
        borderBottom: last ? 'none' : `0.5px solid ${C.line}`,
        background: 'transparent',
      }}
    >
      {icon ? <Icon name={icon} size={17} color={C.muted} /> : null}
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, color: danger ? C.danger : C.ink }}>{title}</span>
        {subtitle ? <span className="fin-clamp-1" style={{ fontSize: 12, color: C.muted }}>{subtitle}</span> : null}
      </div>
      {detail !== undefined && detail !== null ? (
        <span className="fin-mono" style={{ fontSize: 15, color: detailColor || C.muted, flex: '0 0 auto' }}>{detail}</span>
      ) : null}
      {accessory}
      {onClick && accessory === undefined ? <Icon name="chevron.right" size={13} color={C.muted} /> : null}
    </Element>
  )
}

// MARK: - 左滑删除（自选行始终可用）

export function SwipeRow({ children, actionLabel, onAction, disabled }) {
  const [offset, setOffset] = React.useState(0)
  const [animating, setAnimating] = React.useState(false)
  const state = React.useRef({ active: false, startX: 0, startY: 0, base: 0, lock: null })
  const WIDTH = 82

  if (disabled) return children

  const settle = (value) => {
    setAnimating(true)
    setOffset(value)
    window.setTimeout(() => setAnimating(false), 200)
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <button
        type="button"
        className="fin-btn fin-press"
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
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: animating ? 'transform 200ms ease' : 'none',
          background: C.bg,
          position: 'relative',
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0]
          state.current = { active: true, startX: touch.clientX, startY: touch.clientY, base: offset, lock: null }
        }}
        onTouchMove={(event) => {
          if (!state.current.active) return
          const touch = event.touches[0]
          const dx = touch.clientX - state.current.startX
          const dy = touch.clientY - state.current.startY
          if (state.current.lock === null) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
            state.current.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
          }
          if (state.current.lock !== 'h') return
          if (event.cancelable) event.preventDefault()
          setOffset(Math.max(-WIDTH, Math.min(0, state.current.base + dx)))
        }}
        onTouchEnd={() => {
          if (!state.current.active) return
          state.current.active = false
          if (state.current.lock !== 'h') return
          settle(offset < -WIDTH / 2 ? -WIDTH : 0)
        }}
      >
        {children}
      </div>
    </div>
  )
}

// MARK: - 下拉刷新

export function PullRefresh({ onRefresh, refreshing, children, scrollRef, style }) {
  const [pull, setPull] = React.useState(0)
  const state = React.useRef({ active: false, startY: 0 })
  const THRESHOLD = 64

  return (
    <div
      ref={scrollRef}
      className="fin-scroll"
      style={style}
      onTouchStart={(event) => {
        const node = scrollRef.current
        if (!node || node.scrollTop > 0 || refreshing) return
        state.current = { active: true, startY: event.touches[0].clientY }
      }}
      onTouchMove={(event) => {
        if (!state.current.active) return
        const dy = event.touches[0].clientY - state.current.startY
        if (dy <= 0) { setPull(0); return }
        setPull(Math.min(96, dy * 0.5))
      }}
      onTouchEnd={() => {
        if (!state.current.active) return
        state.current.active = false
        if (pull >= THRESHOLD) onRefresh()
        setPull(0)
      }}
    >
      <div style={{
        height: refreshing ? 40 : pull,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: state.current.active ? 'none' : 'height 200ms ease',
        overflow: 'hidden', color: C.muted,
      }}
      >
        {refreshing || pull > 8 ? <Spinner size={18} color={C.brand} /> : null}
      </div>
      {children}
    </div>
  )
}
