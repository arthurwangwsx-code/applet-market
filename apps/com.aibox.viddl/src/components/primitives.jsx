// 页面通用零件：卡片、空态、chip、按钮、进度条、底部 sheet。
//
// 弹层刻意自绘（不用 antd-mobile 的 Popup/Toast）——运行时已知 `Toast.show` 渲染为空，
// 同族命令式弹层风险相同；自绘的 fixed 覆盖层在 WebView 里行为确定。

import React from 'react'
import Icon from './Icon.js'
import { C, RADIUS, SPACE } from './theme.js'

export function Card({ children, padding = SPACE.s4, style }) {
  return (
    <div style={{
      background: C.surface,
      borderRadius: RADIUS.card,
      border: `1px solid ${C.line}`,
      padding,
      overflow: 'hidden',
      ...style,
    }}>{children}</div>
  )
}

export function SectionHeader({ children, trailing }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: `0 4px ${SPACE.s2}px` }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {children}
      </span>
      <div style={{ flex: '1 1 auto' }} />
      {trailing}
    </div>
  )
}

export function EmptyState({ icon, title, hint, action }) {
  return (
    <div style={{ textAlign: 'center', padding: `${SPACE.s6 * 2}px ${SPACE.s5}px`, color: C.muted }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: SPACE.s3, opacity: 0.55 }}>
        <Icon name={icon} size={44} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: SPACE.s2 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, maxWidth: 300, margin: '0 auto' }}>{hint}</div>
      {action ? <div style={{ marginTop: SPACE.s4 }}>{action}</div> : null}
    </div>
  )
}

export function Button({ children, onClick, kind = 'plain', disabled, icon, block, style }) {
  const tone = {
    primary: { background: C.brand, color: C.onAccent, border: 'none' },
    danger: { background: 'transparent', color: C.failed, border: `1px solid ${C.line}` },
    plain: { background: 'transparent', color: C.ink, border: `1px solid ${C.line}` },
  }[kind]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: block ? 'flex' : 'inline-flex',
        width: block ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 40,
        padding: `0 ${SPACE.s4}px`,
        borderRadius: RADIUS.control,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 15,
        fontWeight: 500,
        ...tone,
        ...style,
      }}
    >
      {icon ? <Icon name={icon} size={17} /> : null}
      {children}
    </button>
  )
}

/** 圆角小按钮（行内动作）。触区 ≥ 36×36：低于这个数在真机上就是「图标点不动」。 */
export function IconButton({ name, onClick, color, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 18,
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: color || C.muted, padding: 0,
      }}
    >
      <Icon name={name} size={20} />
    </button>
  )
}

export function Chip({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: RADIUS.chip,
        border: `1px solid ${active ? 'transparent' : C.line}`,
        background: active ? C.brand : 'transparent',
        color: active ? C.onAccent : C.muted,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >{children}</button>
  )
}

/** 进度条。`fraction == null` 时画成不确定态（半宽条纹）——不要假装 0%。 */
export function ProgressBar({ fraction, color }) {
  const determinate = typeof fraction === 'number' && Number.isFinite(fraction)
  return (
    <div style={{ height: 4, borderRadius: 2, background: C.track, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: determinate ? `${Math.max(0, Math.min(1, fraction)) * 100}%` : '35%',
        background: color || C.running,
        borderRadius: 2,
        transition: determinate ? 'width 220ms linear' : 'none',
        opacity: determinate ? 1 : 0.6,
      }} />
    </div>
  )
}

/** 底部 sheet。宿主的原生 sheet 呈现是**整个 applet 的容器形态**，不能用来开一个内部面板。 */
export function Sheet({ open, title, onClose, children, footer }) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.42)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '86vh',
          overflowY: 'auto',
          background: C.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: `${SPACE.s4}px ${SPACE.s4}px calc(${SPACE.s5}px + env(safe-area-inset-bottom))`,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: SPACE.s3 }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>{title}</span>
          <div style={{ flex: '1 1 auto' }} />
          <IconButton name="xmark" onClick={onClose} label="关闭" />
        </div>
        {children}
        {footer ? <div style={{ marginTop: SPACE.s4 }}>{footer}</div> : null}
      </div>
    </div>
  )
}

/** 一行文字提示条（替代 Toast——运行时已知 antd-mobile 的 Toast.show 渲染为空）。 */
export function Notice({ text, tone = 'info', onDismiss }) {
  if (!text) return null
  const color = tone === 'error' ? C.failed : tone === 'success' ? C.done : C.brand
  return (
    <div
      onClick={onDismiss}
      style={{
        margin: `0 ${SPACE.s4}px ${SPACE.s3}px`,
        padding: `${SPACE.s2}px ${SPACE.s3}px`,
        borderRadius: RADIUS.control,
        border: `1px solid ${color}`,
        color,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >{text}</div>
  )
}
