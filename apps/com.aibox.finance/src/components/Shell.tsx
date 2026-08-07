// 自绘外壳：宿主提供 `scene.tabBar` / `scene.toolbar` 时**整块不渲染**，只在宿主没接时兜底。
// 顶栏左侧「退出」按钮是原生规格里的 `chevron.backward` 圆形毛玻璃 + accent。

import React from 'react'
import Icon from './Icon.js'
import { C, SPACE } from './theme.js'

export function NavBar({
  title,
  onBack,
  backLabel,
  trailing,
}: {
  title: React.ReactNode
  onBack?: () => void
  backLabel: string
  trailing?: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        flex: '0 0 auto',
        paddingTop: 'env(safe-area-inset-top)',
        background: C.blur,
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: `0.5px solid ${C.line}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, height: 44, padding: `0 ${SPACE.s3}px` }}>
        {onBack ? (
          <button
            type="button"
            aria-label={backLabel}
            className="fin-btn fin-press"
            onClick={onBack}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'color-mix(in srgb, var(--fin-muted) 14%, transparent)',
              color: C.brand,
            }}
          >
            <Icon name="chevron.backward" size={15} weight="semibold" />
          </button>
        ) : (
          <span style={{ width: 4 }} />
        )}
        <span className="fin-clamp-1" style={{ flex: '1 1 auto', fontSize: 17, fontWeight: 600, textAlign: 'center' }}>
          {title}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.s3,
            flex: '0 0 auto',
            minWidth: 30,
            justifyContent: 'flex-end',
          }}
        >
          {trailing}
        </div>
      </div>
    </div>
  )
}

export function ToolbarButton({
  icon,
  label,
  onClick,
  color,
}: {
  icon: string
  label: string
  onClick: () => void
  color?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="fin-btn fin-press"
      onClick={onClick}
      style={{ color: color || C.brand, display: 'flex', alignItems: 'center' }}
    >
      <Icon name={icon} size={17} weight="semibold" />
    </button>
  )
}

/** 悬浮胶囊底栏（对齐宿主 `PluginGlassTabBar` 的 glass 形态）。 */
export interface TabBarItem<T extends string> {
  id: T
  title: React.ReactNode
  icon: string
  selectedIcon?: string
}

export function TabBar<T extends string>({
  items,
  selected,
  onSelect,
}: {
  items: Array<TabBarItem<T>>
  selected: T
  onSelect: (value: T) => void
}) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        flex: '0 0 auto',
        zIndex: 20,
        padding: `6px ${SPACE.s4}px calc(env(safe-area-inset-bottom) + 6px)`,
        background: C.blur,
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderTop: `0.5px solid ${C.line}`,
      }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        {items.map((item) => {
          const active = item.id === selected
          return (
            <button
              key={item.id}
              type="button"
              className="fin-btn fin-press"
              onClick={() => onSelect(item.id)}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: '1 1 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '4px 0',
                color: active ? C.brand : C.muted,
              }}
            >
              <Icon name={active && item.selectedIcon ? item.selectedIcon : item.icon} size={22} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{item.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 顶部常驻搜索框（宿主 `toolbar.search` 未渲染时的降级件）。 */
export function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
  trailing,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  trailing?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `8px ${SPACE.s4}px`, flex: '0 0 auto' }}>
      <div
        style={{
          flex: '1 1 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'color-mix(in srgb, var(--fin-muted) 14%, transparent)',
          borderRadius: 10,
          padding: '7px 10px',
        }}
      >
        <Icon name="magnifyingglass" size={15} color={C.muted} />
        <input
          className="fin-field"
          style={{ fontSize: 15 }}
          value={value}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button type="button" className="fin-btn fin-press" onClick={() => onChange('')} style={{ color: C.muted }}>
            <Icon name="xmark.circle.fill" size={15} />
          </button>
        ) : null}
      </div>
      {trailing}
    </div>
  )
}

/**
 * 全局横幅：持久化存储不健康时顶部插一条红条。
 * 此时所有写操作会被拒绝并返回错误——横幅是唯一的可见解释，别省。
 */
export function StorageBanner({ text }: { text: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: '0 0 auto',
        padding: `8px ${SPACE.s4}px`,
        background: 'color-mix(in srgb, var(--fin-danger) 10%, transparent)',
        color: C.danger,
      }}
    >
      <Icon name="externaldrive.badge.exclamationmark" size={14} />
      <span style={{ fontSize: 12, lineHeight: 1.35 }}>{text}</span>
    </div>
  )
}
