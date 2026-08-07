// 自绘外壳：宿主不渲染 tabBar / toolbar 时（card / sheet / drawer 呈现面）的降级件。
// 宿主渲染时这些一概不出现——底栏顶栏用原生控件才跟系统的滚动收起、安全区、深浅色一致。

import React from 'react'
import Icon from './Icon.js'
import { C, RADIUS, SPACE, fade } from './theme.js'

interface NavBarProps {
  title: React.ReactNode
  onBack?: () => void
  backLabel?: string
  trailing?: React.ReactNode
}

export function NavBar({ title, onBack, backLabel, trailing }: NavBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.s2,
        flex: '0 0 auto',
        padding: `${SPACE.s2}px ${SPACE.s3}px`,
        borderBottom: `1px solid ${C.line}`,
        background: C.bg,
        paddingTop: 'calc(8px + env(safe-area-inset-top))',
      }}
    >
      <div style={{ minWidth: 44 }}>
        {onBack ? (
          <button type="button" className="lg-btn" onClick={onBack} aria-label={backLabel}>
            <Icon name="chevron.backward" size={17} color={C.brand} />
          </button>
        ) : null}
      </div>
      <span className="lg-clamp-1" style={{ flex: '1 1 auto', textAlign: 'center', fontSize: 17, fontWeight: 500 }}>
        {title}
      </span>
      <div style={{ minWidth: 44, display: 'flex', justifyContent: 'flex-end', gap: SPACE.s3 }}>{trailing}</div>
    </div>
  )
}

export function ToolbarButton({
  icon,
  label,
  onClick,
  tint,
}: {
  icon: string
  label: string
  onClick: () => void
  tint?: string
}) {
  return (
    <button type="button" className="lg-btn" onClick={onClick} aria-label={label}>
      <Icon name={icon} size={17} color={tint ?? C.brand} />
    </button>
  )
}

export function TabBar<T extends string>({
  items,
  selected,
  onSelect,
}: {
  items: Array<{ id: T; title: string; icon: string; selectedIcon?: string }>
  selected: T
  onSelect: (id: T) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flex: '0 0 auto',
        borderTop: `1px solid ${C.line}`,
        background: C.bg,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.map((item) => {
        const active = item.id === selected
        return (
          <button
            key={item.id}
            type="button"
            className="lg-btn"
            onClick={() => onSelect(item.id)}
            style={{
              flex: '1 1 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '7px 2px 5px',
              color: active ? C.brand : C.muted,
            }}
          >
            <Icon name={active ? (item.selectedIcon ?? item.icon) : item.icon} size={21} />
            <span style={{ fontSize: 10 }}>{item.title}</span>
          </button>
        )
      })}
    </div>
  )
}

/** 底部悬浮 FAB：Capsule，高 52，brand 实底。 */
export function FAB({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        flex: '0 0 auto',
        padding: `8px ${SPACE.s4}px`,
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        className="lg-btn"
        onClick={onClick}
        style={{
          pointerEvents: 'auto',
          height: 52,
          borderRadius: 26,
          background: C.brand,
          color: C.onAccent,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: `0 ${SPACE.s5}px`,
          fontSize: 15,
          fontWeight: 500,
          boxShadow: '0 3px 8px rgba(0, 0, 0, 0.18)',
        }}
      >
        <Icon name="plus" size={18} color={C.onAccent} />
        <span>{label}</span>
      </button>
    </div>
  )
}

/** 顶部只读横幅：canMutate == false 时常驻。 */
export function ReadOnlyBanner({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: SPACE.s2,
        flex: '0 0 auto',
        background: fade(C.expense, 10),
        borderBottom: `1px solid ${C.line}`,
        padding: `${SPACE.s2}px ${SPACE.s4}px`,
      }}
    >
      <Icon name="externaldrive.badge.exclamationmark" size={16} color={C.expense} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{title}</span>
        <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.35 }}>{body}</span>
      </div>
    </div>
  )
}

/** 删除撤销条：ink 底、高 48。原生**没有自动消失定时器**，这里照抄。 */
export function UndoBar({
  message,
  actionLabel,
  onUndo,
  bottomOffset = 0,
}: {
  message: string
  actionLabel: string
  onUndo: () => void | Promise<void>
  bottomOffset?: number
}) {
  return (
    <div
      className="lg-undo"
      style={{
        bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))`,
        padding: `0 ${SPACE.s4}px`,
      }}
    >
      <div
        style={{
          height: 48,
          borderRadius: RADIUS.field,
          background: C.ink,
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${SPACE.s4}px`,
          gap: SPACE.s3,
        }}
      >
        <span style={{ flex: '1 1 auto', fontSize: 14, color: C.bg }}>{message}</span>
        <button
          type="button"
          className="lg-btn"
          onClick={onUndo}
          style={{ fontSize: 14, fontWeight: 500, color: C.bg }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

/** 搜索框（宿主没渲染 toolbar.search 时的降级件）。 */
export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div style={{ padding: `${SPACE.s2}px ${SPACE.s4}px 0`, flex: '0 0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.s2,
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 10,
          padding: '8px 10px',
        }}
      >
        <Icon name="line.3.horizontal.decrease.circle" size={14} color={C.muted} />
        <input
          className="lg-field"
          style={{ fontSize: 15 }}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button type="button" className="lg-btn" onClick={() => onChange('')}>
            <Icon name="xmark.circle.fill" size={14} color={C.muted} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
