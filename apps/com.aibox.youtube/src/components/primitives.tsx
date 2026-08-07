// 通用小件。刻意不引 antd-mobile 的重组件：这些都只有几十行，
// 自己写能精确控制高度（虚拟列表要求行高可预测）与配色（跟随系统深浅色）。

import React from 'react'
import { C, RADIUS, SPACE } from './theme.js'

interface SegmentItem {
  id: string
  label: string
}

interface SegmentedProps {
  items: SegmentItem[]
  value: string
  onChange: (id: string) => void
}

/** 分段控件（首页的推荐/热门/排行）。 */
export function Segmented({ items, value, onChange }: SegmentedProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: SPACE.s2,
        padding: `${SPACE.s2}px ${SPACE.s4}px`,
        overflowX: 'auto',
        background: C.bg,
      }}
    >
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

export function Spinner({ label = '加载中' }: { label?: string }) {
  return <div style={{ padding: SPACE.s6, textAlign: 'center', color: C.faint, fontSize: 13 }}>{label}…</div>
}

/**
 * 空态。**必须区分「没有内容」和「出错了」**——两者混为一谈时，用户看到「暂无内容」
 * 而实际是网络挂了，会以为是 B 站没数据。
 */
interface EmptyStateProps {
  title: string
  detail?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, detail, actionLabel, onAction }: EmptyStateProps) {
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
            border: 'none',
            padding: `8px ${SPACE.s5}px`,
            borderRadius: RADIUS.lg,
            background: C.brand,
            color: '#fff',
            fontSize: 14,
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

/** 主按钮。 */
interface PrimaryButtonProps {
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  block?: boolean
}

export function PrimaryButton({ children, onClick, disabled = false, block = true }: PrimaryButtonProps) {
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
export function StatItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 15, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{label}</div>
    </div>
  )
}

/**
 * 设置开关行。
 *
 * 自己写而不是用 antd-mobile 的 Switch：这一行要同时承载标题、说明和开关，
 * 而说明文字是这些开关能不能被正确理解的关键（「后台播放」和「画中画」的区别
 * 光看标题是说不清的）。
 */
interface SettingSwitchProps {
  title: string
  detail?: string
  value: boolean
  onChange: (value: boolean) => void
}

export function SettingSwitch({ title, detail, value, onChange }: SettingSwitchProps) {
  return (
    <div
      className="yt-press"
      onClick={() => onChange(!value)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: SPACE.s3,
        padding: `${SPACE.s3}px ${SPACE.s4}px`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, color: C.text }}>{title}</div>
        {detail ? <div style={{ fontSize: 12, color: C.faint, marginTop: 3, lineHeight: 1.5 }}>{detail}</div> : null}
      </div>
      {/* 自绘开关：36×22，与系统 UISwitch 的观感接近，且不依赖组件库主题 */}
      <div
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          flexShrink: 0,
          marginTop: 2,
          background: value ? C.brand : 'rgba(120,120,128,0.32)',
          transition: 'background 180ms',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: value ? 20 : 2,
            width: 22,
            height: 22,
            borderRadius: 11,
            background: '#fff',
            transition: 'left 180ms',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </div>
    </div>
  )
}

/** 分组标题。 */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: `${SPACE.s4}px ${SPACE.s4}px ${SPACE.s2}px`,
        fontSize: 13,
        fontWeight: 600,
        color: C.sub,
      }}
    >
      {children}
    </div>
  )
}
