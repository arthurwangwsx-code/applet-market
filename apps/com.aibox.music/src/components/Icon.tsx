// SF Symbol → 内联 SVG。WebView 里拿不到 SF Symbols，这里按原生用到的符号名手绘等价图形
// （几何近似，非像素级复刻），统一 24×24 视口、currentColor。

import React from 'react'

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} satisfies React.SVGProps<SVGGElement>
const SOLID = { fill: 'currentColor', stroke: 'none' } satisfies React.SVGProps<SVGGElement>

const SHAPES: Record<string, React.ReactNode> = {
  'music.note': (
    <g {...STROKE}>
      <path d="M9.4 17V6.4l7.6-1.6v10" />
      <circle cx="7.2" cy="17.4" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="15.6" r="2.2" fill="currentColor" stroke="none" />
    </g>
  ),
  'music.note.list': (
    <g {...STROKE}>
      <path d="M4 6.4h9M4 10.4h9M4 14.4h5.4" />
      <path d="M16.4 17V6.2l4-0.9v9.6" />
      <circle cx="14.9" cy="17.2" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="18.9" cy="16.3" r="1.7" fill="currentColor" stroke="none" />
    </g>
  ),
  'music.mic': (
    <g {...STROKE}>
      <rect x="9.4" y="2.8" width="5.2" height="10" rx="2.6" />
      <path d="M6.4 11.4a5.6 5.6 0 0 0 11.2 0M12 17v4.2M9 21.2h6" />
    </g>
  ),
  sparkles: (
    <g {...STROKE}>
      <path d="M11.4 3.4l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" />
      <path d="M18.4 14.2l0.8 2 2 0.8-2 0.8-0.8 2-0.8-2-2-0.8 2-0.8z" />
    </g>
  ),
  magnifyingglass: (
    <g {...STROKE}>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="M15.4 15.4l4.4 4.4" />
    </g>
  ),
  'play.circle': (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.2 8.6l6 3.4-6 3.4z" fill="currentColor" stroke="none" />
    </g>
  ),
  'play.circle.fill': (
    <g>
      <circle cx="12" cy="12" r="9.2" fill="currentColor" />
      <path d="M10.2 8.6l6 3.4-6 3.4z" fill="var(--mu-bg)" />
    </g>
  ),
  'list.bullet': (
    <g {...STROKE}>
      <path d="M8.4 6.4h11.2M8.4 12h11.2M8.4 17.6h11.2" />
      <circle cx="4.6" cy="6.4" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="17.6" r="1.3" fill="currentColor" stroke="none" />
    </g>
  ),
  'square.stack': (
    <g {...STROKE}>
      <rect x="7" y="3.6" width="13" height="13" rx="2.6" />
      <path d="M16.4 19.6H6.6a2.6 2.6 0 0 1-2.6-2.6V7.4" />
    </g>
  ),
  'square.stack.fill': (
    <g>
      <rect x="7" y="3.6" width="13" height="13" rx="2.6" fill="currentColor" />
      <path d="M16.4 19.6H6.6a2.6 2.6 0 0 1-2.6-2.6V7.4" {...STROKE} />
    </g>
  ),
  ellipsis: (
    <g fill="currentColor">
      <circle cx="5.4" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18.6" cy="12" r="1.7" />
    </g>
  ),
  'chevron.backward': (
    <g {...STROKE}>
      <path d="M14.6 4.8L7.4 12l7.2 7.2" />
    </g>
  ),
  'chevron.right': (
    <g {...STROKE}>
      <path d="M9.4 4.8L16.6 12l-7.2 7.2" />
    </g>
  ),
  'chevron.down': (
    <g {...STROKE}>
      <path d="M4.8 9.4L12 16.6l7.2-7.2" />
    </g>
  ),
  'chevron.up.chevron.down': (
    <g {...STROKE}>
      <path d="M8 10.2L12 6l4 4.2M8 13.8L12 18l4-4.2" />
    </g>
  ),
  checkmark: (
    <g {...STROKE}>
      <path d="M5 12.8l4.6 4.6L19 6.6" />
    </g>
  ),
  'play.fill': (
    <g {...SOLID}>
      <path d="M7 4.6l12.4 7.4L7 19.4z" />
    </g>
  ),
  'pause.fill': (
    <g {...SOLID}>
      <rect x="6.4" y="4.6" width="3.9" height="14.8" rx="1.2" />
      <rect x="13.7" y="4.6" width="3.9" height="14.8" rx="1.2" />
    </g>
  ),
  'backward.fill': (
    <g {...SOLID}>
      <path d="M11.6 12l8.4-6v12zM2.6 12L11 6v12z" />
    </g>
  ),
  'forward.fill': (
    <g {...SOLID}>
      <path d="M12.4 12L4 18V6zM21.4 12L13 18V6z" />
    </g>
  ),
  shuffle: (
    <g {...STROKE}>
      <path d="M3.4 6.4h3.4c1.6 0 2.6 0.8 3.6 2.2l3.4 5c1 1.4 2 2.2 3.6 2.2h3.2" />
      <path d="M3.4 17.8h3.4c1.6 0 2.6-0.8 3.6-2.2M14 8.6c1-1.4 2-2.2 3.6-2.2h3.2" />
      <path d="M18.4 3.6l2.8 2.8-2.8 2.8M18.4 13l2.8 2.8-2.8 2.8" />
    </g>
  ),
  repeat: (
    <g {...STROKE}>
      <path d="M4.4 11V9.4a3 3 0 0 1 3-3h11" />
      <path d="M15.6 3.4l3 3-3 3" />
      <path d="M19.6 13v1.6a3 3 0 0 1-3 3h-11" />
      <path d="M8.4 20.6l-3-3 3-3" />
    </g>
  ),
  'repeat.1': (
    <g {...STROKE}>
      <path d="M4.4 11V9.4a3 3 0 0 1 3-3h11" />
      <path d="M15.6 3.4l3 3-3 3" />
      <path d="M19.6 13v1.6a3 3 0 0 1-3 3h-11" />
      <path d="M8.4 20.6l-3-3 3-3" />
      <path d="M11.4 10.6l1.6-1v4.8" />
    </g>
  ),
  infinity: (
    <g {...STROKE}>
      <path d="M8.4 8.6a3.4 3.4 0 1 0 0 6.8c3.4 0 3.8-6.8 7.2-6.8a3.4 3.4 0 1 1 0 6.8c-3.4 0-3.8-6.8-7.2-6.8z" />
    </g>
  ),
  'moon.zzz.fill': (
    <g>
      <path d="M18.6 14.8A7.4 7.4 0 0 1 9 5.4a7.6 7.6 0 1 0 9.6 9.4z" fill="currentColor" />
      <path d="M14.6 3.4h4l-4 4h4" {...STROKE} strokeWidth="1.5" />
    </g>
  ),
  'slider.horizontal.3': (
    <g {...STROKE}>
      <path d="M3.4 7h17.2M3.4 12h17.2M3.4 17h17.2" />
      <circle cx="8.4" cy="7" r="2" fill="var(--mu-bg)" />
      <circle cx="15.4" cy="12" r="2" fill="var(--mu-bg)" />
      <circle cx="10.4" cy="17" r="2" fill="var(--mu-bg)" />
    </g>
  ),
  gearshape: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.4l1.2 2.2 2.5-0.5 0.6 2.5 2.3 1.1-1.2 2.2 1.2 2.2-2.3 1.1-0.6 2.5-2.5-0.5L12 20.6l-1.2-2.2-2.5 0.5-0.6-2.5-2.3-1.1 1.2-2.2-1.2-2.2 2.3-1.1 0.6-2.5 2.5 0.5z" />
    </g>
  ),
  'square.and.arrow.up': (
    <g {...STROKE}>
      <path d="M12 3.4v11M8.4 6.8L12 3.2l3.6 3.6" />
      <path d="M6.4 10.6H5a1.6 1.6 0 0 0-1.6 1.6v7a1.6 1.6 0 0 0 1.6 1.6h14a1.6 1.6 0 0 0 1.6-1.6v-7a1.6 1.6 0 0 0-1.6-1.6h-1.4" />
    </g>
  ),
  star: (
    <g {...STROKE}>
      <path d="M12 3.6l2.6 5.6 6 0.7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.9l6-0.7z" />
    </g>
  ),
  'star.fill': (
    <g {...SOLID}>
      <path d="M12 3.6l2.6 5.6 6 0.7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.9l6-0.7z" />
    </g>
  ),
  heart: (
    <g {...STROKE}>
      <path d="M12 19.8S3.8 14.6 3.8 9.4a4.6 4.6 0 0 1 8.2-2.8 4.6 4.6 0 0 1 8.2 2.8c0 5.2-8.2 10.4-8.2 10.4z" />
    </g>
  ),
  'heart.fill': (
    <g {...SOLID}>
      <path d="M12 19.8S3.8 14.6 3.8 9.4a4.6 4.6 0 0 1 8.2-2.8 4.6 4.6 0 0 1 8.2 2.8c0 5.2-8.2 10.4-8.2 10.4z" />
    </g>
  ),
  'text.append': (
    <g {...STROKE}>
      <path d="M3.4 6h13M3.4 11h13M3.4 16h7" />
      <path d="M17.6 13.4v6.2M14.5 16.5h6.2" />
    </g>
  ),
  waveform: (
    <g {...STROKE}>
      <path d="M3.4 10.4v3.2M7.4 6.6v10.8M11.4 3.6v16.8M15.4 7.6v8.8M19.4 10.4v3.2" />
    </g>
  ),
  'quote.bubble': (
    <g {...STROKE}>
      <path d="M4 6.6a2.6 2.6 0 0 1 2.6-2.6h10.8A2.6 2.6 0 0 1 20 6.6v7a2.6 2.6 0 0 1-2.6 2.6h-6.2L6.6 20v-3.8H6.6A2.6 2.6 0 0 1 4 13.6z" />
      <path d="M9 8.6c-1.2 0.4-1.6 1.4-1.6 2.6M14 8.6c-1.2 0.4-1.6 1.4-1.6 2.6" />
    </g>
  ),
  'quote.bubble.fill': (
    <g>
      <path
        d="M4 6.6a2.6 2.6 0 0 1 2.6-2.6h10.8A2.6 2.6 0 0 1 20 6.6v7a2.6 2.6 0 0 1-2.6 2.6h-6.2L6.6 20v-3.8A2.6 2.6 0 0 1 4 13.6z"
        fill="currentColor"
      />
    </g>
  ),
  'exclamationmark.triangle.fill': (
    <g>
      <path d="M12 3.6l9 15.6H3z" fill="currentColor" />
      <path d="M12 9.4v4.4M12 16.4v0.2" stroke="var(--mu-bg)" strokeWidth="1.9" strokeLinecap="round" fill="none" />
    </g>
  ),
  lock: (
    <g {...STROKE}>
      <rect x="5" y="10.4" width="14" height="9.6" rx="2.4" />
      <path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" />
    </g>
  ),
  'lock.fill': (
    <g>
      <rect x="5" y="10.4" width="14" height="9.6" rx="2.4" fill="currentColor" />
      <path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" {...STROKE} />
    </g>
  ),
  'chart.bar.fill': (
    <g {...SOLID}>
      <rect x="3.6" y="12.4" width="4.2" height="7.6" rx="1.2" />
      <rect x="9.9" y="7.6" width="4.2" height="12.4" rx="1.2" />
      <rect x="16.2" y="3.8" width="4.2" height="16.2" rx="1.2" />
    </g>
  ),
  'chart.bar.xaxis': (
    <g {...STROKE}>
      <path d="M4 6.6h9M4 11h13M4 15.4h6" />
      <path d="M3 19.6h18" />
    </g>
  ),
  'folder.fill': (
    <g {...SOLID}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.4h6a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </g>
  ),
  'arrow.up.forward.app': (
    <g {...STROKE}>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.4" />
      <path d="M9.4 14.6l5.4-5.4M10.4 9.2h4.4v4.4" />
    </g>
  ),
  'clock.arrow.circlepath': (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="7.4" />
      <path d="M12 7.8V12l2.8 1.8" />
    </g>
  ),
  'arrow.up.left': (
    <g {...STROKE}>
      <path d="M16.6 16.6L7.4 7.4M7.4 13.6V7.4h6.2" />
    </g>
  ),
  'externaldrive.badge.exclamationmark': (
    <g {...STROKE}>
      <rect x="3" y="7.4" width="18" height="9.2" rx="2.4" />
      <path d="M6.6 12h6" />
      <circle cx="17.6" cy="12" r="1" fill="currentColor" stroke="none" />
    </g>
  ),
  guitars: (
    <g {...STROKE}>
      <path d="M9 4.4l3.4 3.4M13.4 10a3.6 3.6 0 1 1-5 5c-1.4-1.4-0.4-2.6-1.6-3.8s-2.4-0.2-3.8-1.6a3.6 3.6 0 0 1 5-5c1.4 1.4 0.4 2.6 1.6 3.8s2.4 0.2 3.8 1.6z" />
      <path d="M14 9.4l5.6-5.6" />
    </g>
  ),
  'speaker.fill': (
    <g {...SOLID}>
      <path d="M4 9.4h3.4L12 5.4v13.2L7.4 14.6H4z" />
    </g>
  ),
  'speaker.wave.3.fill': (
    <g>
      <path d="M3 9.4h3.4L11 5.4v13.2L6.4 14.6H3z" {...SOLID} />
      <g {...STROKE}>
        <path d="M14 9.4a3.6 3.6 0 0 1 0 5.2M16.6 7a7 7 0 0 1 0 10M19.2 4.6a10.4 10.4 0 0 1 0 14.8" />
      </g>
    </g>
  ),
  'info.circle': (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11v5.4M12 7.8v0.2" />
    </g>
  ),
  'arrow.clockwise': (
    <g {...STROKE}>
      <path d="M19.4 12a7.4 7.4 0 1 1-2.4-5.4" />
      <path d="M19.6 3.4v4.2h-4.2" />
    </g>
  ),
  plus: (
    <g {...STROKE}>
      <path d="M12 4.6v14.8M4.6 12h14.8" />
    </g>
  ),
  xmark: (
    <g {...STROKE}>
      <path d="M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
    </g>
  ),
  'line.3.horizontal': (
    <g {...STROKE}>
      <path d="M4 7.4h16M4 12h16M4 16.6h16" />
    </g>
  ),
  photo: (
    <g {...STROKE}>
      <rect x="3.2" y="5" width="17.6" height="14" rx="2.6" />
      <path d="M6 16l4-4.4 3 3 2.6-2.6L19 16" />
    </g>
  ),
}

export interface IconProps {
  name: string
  size?: number
  color?: string
  style?: React.CSSProperties
  title?: string
}

export default function Icon({ name, size = 20, color = 'currentColor', style, title }: IconProps) {
  const shape = SHAPES[name] || SHAPES['music.note']
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-hidden={title ? undefined : 'true'}
      style={{ display: 'block', color, flex: '0 0 auto', ...style }}
    >
      {title ? <title>{title}</title> : null}
      {shape}
    </svg>
  )
}

export function hasIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(SHAPES, name)
}
