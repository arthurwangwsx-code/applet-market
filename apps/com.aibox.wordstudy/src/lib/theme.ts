// 设计令牌 —— 对齐 `AiBoxKit/Sources/AiBoxPluginUI/Theme.swift`（规格头部）。
// 深浅两套都必须能看：宿主会把有效颜色方案传下来，别只测一种。
//
// accent 跟随用户全局主题色，本模块**没有自己的品牌色**（与资讯的 brand=#E8552D 不同）。
// 拿不到用户色板时用启动格 tint `#2D6AE0 / #4E88FF` 兜底。

export const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32 } as const
export const RADIUS = { card: 16, field: 14, pill: 999 } as const

export interface Palette {
  ink: string
  muted: string
  line: string
  bg: string
  surface: string
  accent: string
  onAccent: string
  green: string
  orange: string
  red: string
}

const LIGHT: Palette = {
  ink: '#1B1A16',
  muted: '#68665E',
  line: 'rgba(0,0,0,0.08)',
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  accent: '#2D6AE0',
  onAccent: '#FFFFFF',
  green: '#248A5A',
  orange: '#B56B00',
  red: '#D92D20',
}

const DARK: Palette = {
  ink: '#EDEBE3',
  muted: '#A6A498',
  line: 'rgba(255,255,255,0.14)',
  bg: '#000000',
  surface: '#1C1C1E',
  accent: '#4E88FF',
  onAccent: '#FFFFFF',
  green: '#43C487',
  orange: '#F2A93B',
  red: '#FF6B5F',
}

export function palette(dark: boolean): Palette {
  return dark ? DARK : LIGHT
}

/** `rgba()` 化任意 hex —— 用于 `底 accent 12%` 这类令牌。 */
export function alpha(color: string, value: number): string {
  if (color.startsWith('rgba')) return color
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${value})`
}
