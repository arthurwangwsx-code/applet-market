// SF Symbol → 内联 SVG。WebView 里拿不到 SF Symbols，这里按本应用实际用到的符号名
// 手绘等价图形（几何近似），统一 24×24 viewBox、currentColor。
// 未收录的名字回落成中性圆点——**绝不渲染成空白**，否则按钮会变成一块不可见的可点区域。

import React from 'react'
import type { CSSProperties, SVGProps } from 'react'

const S: SVGProps<SVGPathElement> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}
const F: SVGProps<SVGPathElement> = { fill: 'currentColor', stroke: 'none' }

const I = {
  plus: ['M12 5.5v13M5.5 12h13'],
  xmark: ['M6.5 6.5l11 11M17.5 6.5l-11 11'],
  'chevron.right': ['M9.5 5.5L16 12l-6.5 6.5'],
  'chevron.down': ['M5.5 9.5L12 16l6.5-6.5'],
  pause: ['M9 5.5v13M15 5.5v13'],
  'pause.circle': ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M10 9v6M14 9v6'],
  play: [null, 'M8 5.5v13l11-6.5z'],
  'play.circle': ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M10 8.5l6 3.5-6 3.5z'],
  trash: ['M5.5 7h13M9.5 7V5.2h5V7M7.2 7l.8 12.3h8l.8-12.3M10.4 10v6.4M13.6 10v6.4'],
  'arrow.down.circle': ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M12 7.6v8.2M8.6 12.4L12 15.8l3.4-3.4'],
  'arrow.down.circle.fill': [
    null,
    'M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4m.9 4.4v6.1l2.1-2.1 1.3 1.3L12 17l-4.3-4.5 1.3-1.3 2.1 2.1V7.2z',
  ],
  'checkmark.circle': ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M8 12.3l2.7 2.7L16 9.6'],
  'checkmark.circle.fill': [
    null,
    'M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4m-1.4 13.4-3.4-3.4 1.3-1.3 2.1 2.1 5-5 1.3 1.3z',
  ],
  'exclamationmark.triangle': ['M12 4.4l8 14.2H4zM12 9.6v4.2M12 16.4v.1'],
  'square.and.arrow.up': ['M12 4.4v10M8.6 7.8L12 4.4l3.4 3.4M6 12.4v6.2h12v-6.2'],
  'doc.text': ['M7 3.6h6.6L18 8v12.4H7zM13.4 3.6V8H18M9.6 12h6.4M9.6 15.2h6.4'],
  'arrow.clockwise': ['M19 12a7 7 0 1 1-2.1-5M19 4.6V9.4h-4.8'],
  'doc.on.clipboard': ['M9.4 4.6h5.2M8 6.2h8v13.2H8zM10.4 3.2h3.2v2.6h-3.2z'],
  externaldrive: ['M4.5 9.6h15v7.2h-15zM6.6 9.6l1.6-3.2h7.6l1.6 3.2M7.6 13.2h.1M10.4 13.2h.1'],
  icloud: ['M8 17.4a3.8 3.8 0 0 1-.3-7.6 4.8 4.8 0 0 1 9.1-1.2A3.6 3.6 0 0 1 16.6 17.4z'],
  folder: ['M4.4 7.2h5l1.6 2h8.6v9.4H4.4z'],
  lock: ['M8 10.4V8.2a4 4 0 0 1 8 0v2.2M6.4 10.4h11.2v9H6.4z'],
  'arrow.down.to.line': ['M12 4v10M8.2 10.2L12 14l3.8-3.8M6 19h12'],
  film: ['M4.6 5.4h14.8v13.2H4.6zM8.4 5.4v13.2M15.6 5.4v13.2M4.6 12h14.8'],
  'film.fill': [
    null,
    'M4.6 5.4h14.8v13.2H4.6zm2 2v2h2v-2zm9 0v2h2v-2zm-9 4.6v2h2v-2zm9 0v2h2v-2zm-9 4.6v2h2v-2zm9 0v2h2v-2z',
  ],
  'play.rectangle': ['M3.8 6h16.4v12H3.8zM10.4 9.4l4.4 2.6-4.4 2.6z'],
  waveform: ['M4 11v2M7.6 8.2v7.6M11.2 5.6v12.8M14.8 8.2v7.6M18.4 11v2'],
  magnifyingglass: ['M11 4.4a6.6 6.6 0 1 1 0 13.2 6.6 6.6 0 0 1 0-13.2M15.8 15.8L20 20'],
  'square.and.arrow.down': ['M12 14.4V4.4M8.6 11l3.4 3.4L15.4 11M6 12.4v6.2h12v-6.2'],
  'exclamationmark.circle': ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M12 7.4v5.4M12 15.6v.1'],
  link: [
    'M10 14a4 4 0 0 1 0-5.6l2.4-2.4a4 4 0 1 1 5.6 5.6L16.8 12.8M14 10a4 4 0 0 1 0 5.6l-2.4 2.4a4 4 0 1 1-5.6-5.6l1.2-1.2',
  ],
}

export default function Icon({
  name,
  size = 20,
  color,
  style,
}: {
  name: string
  size?: number
  color?: string
  style?: CSSProperties
}) {
  const entry = I[name as keyof typeof I]
  const [stroke, fill] = entry || [null, 'M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8']
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: 'block', color, flex: '0 0 auto', ...style }}
    >
      {stroke ? <path d={stroke} {...S} /> : null}
      {fill ? <path d={fill} {...F} /> : null}
    </svg>
  )
}
