// 通用小件。刻意不引 antd-mobile 的重组件：这些都只有几十行，
// 自己写能精确控制高度（虚拟列表要求行高可预测）与配色（跟随系统深浅色）。

import React from 'react'
import { C, RADIUS, SPACE } from './theme.js'

/** 分段控件（首页的推荐/热门/排行）。 */
export function Segmented({ items, value, onChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: SPACE.s2,
      padding: `${SPACE.s2}px ${SPACE.s4}px`,
      overflowX: 'auto',
      background: C.bg,
    }}>
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            style={{
              flexShrink: 0,
              border: 'none',
              padding: `6px ${SPACE.s3}px`,
              borderRadius: RADIUS.lg,
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              background: active ? C.brand : C.surface,
              color: active ? '#fff' : C.sub,
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function Spinner({ label = '加载中' }) {
  return (
    <div style={{ padding: SPACE.s6, textAlign: 'center', color: C.faint, fontSize: 13 }}>
      {label}…
    </div>
  )
}

/**
 * 空态。**必须区分「没有内容」和「出错了」**——两者混为一谈时，用户看到「暂无内容」
 * 而实际是网络挂了，会以为是 B 站没数据。
 */
export function EmptyState({ title, detail, actionLabel, onAction }) {
  return (
    <div style={{ padding: `${SPACE.s6}px ${SPACE.s5}px`, textAlign: 'center' }}>
      <div style={{ fontSize: 15, color: C.text, marginBottom: SPACE.s2 }}>{title}</div>
      {detail ? (
        <div style={{ fontSize: 13, color: C.faint, lineHeight: 1.5, marginBottom: SPACE.s4 }}>{detail}</div>
      ) : null}
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            border: 'none', padding: `8px ${SPACE.s5}px`, borderRadius: RADIUS.lg,
            background: C.brand, color: '#fff', fontSize: 14,
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

/** 主按钮。 */
export function PrimaryButton({ children, onClick, disabled, block = true }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: block ? 'block' : 'inline-block',
        width: block ? '100%' : undefined,
        border: 'none',
        padding: `11px ${SPACE.s5}px`,
        borderRadius: RADIUS.md,
        background: disabled ? C.surface : C.brand,
        color: disabled ? C.faint : '#fff',
        fontSize: 15,
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  )
}

/** 统计数字块（详情页的点赞/投币/收藏）。 */
export function StatItem({ label, value }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 15, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{label}</div>
    </div>
  )
}
