// 通用零件：spinner / 空态 / 分组行 / 分段控件 / 封面 / 虚拟列表 / 底部面板 / 长按 / 左滑删除 / 胶囊提示。
//
// 弹层刻意自绘或走 `aibox.ui.*` 原生弹层：运行时已知 antd-mobile 的 `Toast.show` 渲染为空，
// 同族命令式弹层风险相同。

import React from 'react'
import Icon from './Icon.js'
import { C, SPACE } from './theme.js'
import { artworkDataURL, sizedArtworkURL } from '../lib/artwork.js'

export function Spinner({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg className="mu-spin" viewBox="0 0 24 24" width={size} height={size} style={{ display: 'block', color }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.22" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
  color = C.muted,
  top = 60,
}: {
  icon?: string
  title?: React.ReactNode
  hint?: React.ReactNode
  action?: React.ReactNode
  color?: string
  top?: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: `${top}px 32px 40px`,
        textAlign: 'center',
        color,
      }}
    >
      {icon ? <Icon name={icon} size={34} color={color} /> : null}
      {title ? <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span> : null}
      {hint ? <span style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.85 }}>{hint}</span> : null}
      {action}
    </div>
  )
}

export function SectionHeader({ children, trailing }: { children?: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: `${SPACE.s5}px ${SPACE.s4}px 6px`,
        gap: SPACE.s3,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>{children}</span>
      {trailing}
    </div>
  )
}

export function ListHeader({ children, trailing }: { children?: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${SPACE.s4}px ${SPACE.s4}px 6px`,
        gap: SPACE.s3,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{children}</span>
      {trailing}
    </div>
  )
}

export function Card({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 14,
        margin: `0 ${SPACE.s4}px`,
        overflow: 'hidden',
        border: `0.5px solid ${C.line}`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** 设置/列表里的一行。行高 56（设置卡片）或自适应。 */
export function Row({
  leading,
  title,
  subtitle,
  detail,
  accessory,
  onClick,
  danger,
  last,
  minHeight = 56,
  disabled,
}: {
  leading?: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  detail?: React.ReactNode
  accessory?: React.ReactNode
  onClick?: () => void
  danger?: boolean
  last?: boolean
  minHeight?: number
  disabled?: boolean
}) {
  const Element = onClick ? 'button' : 'div'
  return (
    <Element
      className={onClick ? 'mu-btn mu-press' : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.s3,
        width: '100%',
        padding: `8px ${SPACE.s4}px`,
        minHeight,
        borderBottom: last ? 'none' : `0.5px solid ${C.line}`,
        background: 'transparent',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {leading}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto' }}>
        <span className="mu-clamp-1" style={{ fontSize: 16, color: danger ? C.danger : C.ink }}>
          {title}
        </span>
        {subtitle ? (
          <span className="mu-clamp-1" style={{ fontSize: 12, color: C.muted }}>
            {subtitle}
          </span>
        ) : null}
      </div>
      {detail !== undefined && detail !== null ? (
        <span className="mu-mono" style={{ fontSize: 15, color: C.muted, flex: '0 0 auto' }}>
          {detail}
        </span>
      ) : null}
      {accessory}
    </Element>
  )
}

export function Chevron() {
  return <Icon name="chevron.right" size={13} color={C.muted} />
}

/** 44×44 accent 15% 圆角 8 图标底（资料库「本设备」那三行用）。 */
export function IconTile({
  name,
  size = 44,
  radius = 8,
  iconSize = 17,
  tint = C.accent,
}: {
  name: string
  size?: number
  radius?: number
  iconSize?: number
  tint?: string
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flex: '0 0 auto',
        background: `color-mix(in srgb, ${tint} 15%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={name} size={iconSize} color={tint} />
    </div>
  )
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  style,
}: {
  items: Array<{ id: T; title: React.ReactNode }>
  value: T
  onChange: (value: T) => void
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        background: `color-mix(in srgb, ${C.muted} 12%, transparent)`,
        borderRadius: 9,
        padding: 2,
        gap: 2,
        ...style,
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="mu-btn mu-press"
          onClick={() => onChange(item.id)}
          style={{
            flex: '1 1 0',
            textAlign: 'center',
            padding: '6px 4px',
            borderRadius: 7,
            fontSize: 13,
            fontWeight: value === item.id ? 600 : 400,
            background: value === item.id ? C.surface : 'transparent',
            color: value === item.id ? C.ink : C.muted,
          }}
        >
          {item.title}
        </button>
      ))}
    </div>
  )
}

/**
 * 封面。
 * **布局红线**：`.fill` 的图必须被有具体尺寸的容器裁住（`overflow:hidden` + 明确宽高 +
 * `object-fit:cover`），绝不能让图撑开父级——原生历史 bug「Now Playing 控件不显示」的真根因
 * 就是封面溢出把两侧控件挤出屏幕。
 *
 * 取图路径：远程 URL → `aibox.net.fetch(base64)` → data URL（secure 模式 CSP 拦掉远程 <img>）。
 */
export function Artwork({
  url,
  size,
  radius = 8,
  iconSize,
  tint = C.accent,
  background,
  className,
  shadow,
  style,
}: {
  url?: string | null
  size: number | string
  radius?: number
  iconSize?: number
  tint?: string
  background?: string
  className?: string
  shadow?: string
  style?: React.CSSProperties
}) {
  const [dataURL, setDataURL] = React.useState<string | null>(null)
  // size 允许传 '100%'（大封面按容器铺满）；此时取图尺寸用固定 600，占位图标必须显式给 iconSize。
  const numeric = typeof size === 'number' ? size : null
  const target = url
    ? sizedArtworkURL(url, numeric ? Math.min(600, Math.max(120, Math.round(numeric * 2))) : 600)
    : null
  React.useEffect(() => {
    let cancelled = false
    setDataURL(null)
    if (!target) return undefined
    artworkDataURL(target).then((value) => {
      if (!cancelled) setDataURL(value)
    })
    return () => {
      cancelled = true
    }
  }, [target])

  const glyph = iconSize || (numeric ? Math.max(12, Math.round(numeric * 0.32)) : 40)
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        minWidth: numeric || 0,
        borderRadius: radius,
        overflow: 'hidden',
        flex: '0 0 auto',
        background: background || `color-mix(in srgb, ${tint} 12%, transparent)`,
        boxShadow: shadow,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="music.note" size={glyph} color={`color-mix(in srgb, ${tint} 50%, transparent)`} />
      </div>
      {dataURL ? (
        <img
          src={dataURL}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : null}
    </div>
  )
}

// 虚拟列表由框架提供（`aibox/ui`，随运行时资产内置，不是 npm 包）。这里曾有一份 ~55 行的同接口
// 兜底，注释写着「宿主哪天把 aibox/ui 放进白名单就整体替换」—— 白名单早就放开了
// （`AppletImportRules.bareWhitelist` 与 market 的 `BARE_IMPORT_ALLOWLIST` 两侧都有），
// 只是没有任何机制把应用拉回来。框架版还多两样本地版给不了的：动态行高实测回填 + 把可见行矩形
// 喂给原生手势层（§3.1）。
//
// 接口差异（换过来时调用方要改的两处）：`itemHeight` → `estimatedRowHeight`、`renderItem` → `renderRow`。
export { VirtualList } from 'aibox/ui'

/** 底部面板（自绘；宿主 sheet surface 不参与，纯页面内覆盖层）。 */
export function Sheet({
  open,
  onClose,
  title,
  leading,
  trailing,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  leading?: React.ReactNode
  trailing?: React.ReactNode
  children?: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="mu-sheet-backdrop" onClick={onClose} role="presentation">
      <div className="mu-sheet" onClick={(event) => event.stopPropagation()} role="presentation">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.s3,
            padding: `12px ${SPACE.s4}px`,
            borderBottom: `0.5px solid ${C.line}`,
            background: C.bg,
            flex: '0 0 auto',
          }}
        >
          <div style={{ minWidth: 60 }}>{leading}</div>
          <span style={{ flex: '1 1 auto', textAlign: 'center', fontSize: 17, fontWeight: 600 }}>{title}</span>
          <div style={{ minWidth: 60, display: 'flex', justifyContent: 'flex-end' }}>
            {trailing || (
              <button
                type="button"
                className="mu-btn mu-press"
                onClick={onClose}
                style={{ color: C.accent, fontSize: 16 }}
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="mu-scroll" style={{ flex: '1 1 auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/** 长按（500ms）不触发 click；移动超过 10px 视为滚动，取消长按。 */
export function useLongPress(onLongPress: () => void, { delay = 500 }: { delay?: number } = {}) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const origin = React.useRef<{ x: number; y: number } | null>(null)
  const fired = React.useRef(false)

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }
  // 返回 { bind, consumed } 而不是把 consumedClick 混在事件处理器里——
  // 后者会被 `{...press}` 原样铺到 DOM 节点上，React 会告警「无法识别的属性」。
  return {
    bind: {
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        fired.current = false
        origin.current = { x: event.clientX, y: event.clientY }
        clear()
        timer.current = setTimeout(() => {
          fired.current = true
          onLongPress()
        }, delay)
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        if (!origin.current) return
        const dx = Math.abs(event.clientX - origin.current.x)
        const dy = Math.abs(event.clientY - origin.current.y)
        if (dx > 10 || dy > 10) clear()
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
    },
    consumed: () => fired.current,
  }
}

/** 左滑露出一个操作（删除 / 移除）。手势本身即明确意图，不再二次确认。 */
export function SwipeRow({
  children,
  actionLabel,
  onAction,
  danger = true,
}: {
  children?: React.ReactNode
  actionLabel: React.ReactNode
  onAction: () => void
  danger?: boolean
}) {
  const [offset, setOffset] = React.useState(0)
  const start = React.useRef<{ x: number; base: number } | null>(null)
  const width = 84
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <button
        type="button"
        className="mu-btn mu-press"
        onClick={() => {
          setOffset(0)
          onAction()
        }}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width,
          background: danger ? C.danger : C.muted,
          color: '#fff',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {actionLabel}
      </button>
      <div
        onPointerDown={(event) => {
          start.current = { x: event.clientX, base: offset }
        }}
        onPointerMove={(event) => {
          if (!start.current) return
          const delta = event.clientX - start.current.x
          const next = Math.max(-width, Math.min(0, start.current.base + delta))
          setOffset(next)
        }}
        onPointerUp={() => {
          if (!start.current) return
          setOffset(offset < -width / 2 ? -width : 0)
          start.current = null
        }}
        onPointerCancel={() => {
          start.current = null
          setOffset(0)
        }}
        style={{
          transform: `translateX(${offset}px)`,
          transition: start.current ? 'none' : 'transform 0.18s ease-out',
          background: C.bg,
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Now Playing 的「暂无歌词」胶囊提示（自绘：宿主 Toast.show 渲染为空）。 */
export function ToastCapsule({ message }: { message?: React.ReactNode }) {
  if (!message) return null
  return (
    <div
      className="mu-fade-in"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 120,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <span
        style={{
          padding: '12px 20px',
          borderRadius: 999,
          fontSize: 15,
          fontWeight: 500,
          color: '#fff',
          background: 'rgba(60,60,60,0.72)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
        }}
      >
        {message}
      </span>
    </div>
  )
}

/** 下拉刷新（自绘；宿主未提供原生 refresh control）。 */
export function PullToRefresh({
  onRefresh,
  refreshing,
  children,
  className = 'mu-scroll',
  style,
}: {
  onRefresh: () => void | Promise<void>
  refreshing: boolean
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const [pull, setPull] = React.useState(0)
  const start = React.useRef<number | null>(null)
  const ref = React.useRef<HTMLDivElement | null>(null)
  return (
    <div
      ref={ref}
      className={className}
      style={style}
      onPointerDown={(event) => {
        if (ref.current && ref.current.scrollTop <= 0) start.current = event.clientY
      }}
      onPointerMove={(event) => {
        if (start.current === null) return
        const delta = event.clientY - start.current
        if (delta > 0) setPull(Math.min(90, delta * 0.5))
      }}
      onPointerUp={() => {
        if (pull > 46 && !refreshing) onRefresh()
        start.current = null
        setPull(0)
      }}
      onPointerCancel={() => {
        start.current = null
        setPull(0)
      }}
    >
      <div
        style={{
          height: refreshing ? 44 : pull,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: start.current ? 'none' : 'height 0.2s ease-out',
          overflow: 'hidden',
        }}
      >
        {refreshing || pull > 10 ? <Spinner size={18} color={C.muted} /> : null}
      </div>
      {children}
    </div>
  )
}
