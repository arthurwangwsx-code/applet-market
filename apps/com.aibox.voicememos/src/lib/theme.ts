// 设计令牌 —— 对齐 `AiBoxKit/Sources/AiBoxPluginUI/Theme.swift`（规格头部）。
// 深浅两套都必须能看：宿主会把有效颜色方案传下来，别只测一种。
//
// accent 跟随用户全局主题色；**录音模块的品牌色 tint = #FF6B35(浅) / #FF9F5B(深)**，
// 但它只用于聊天卡片、启动器瓦片、设置入口徽章 —— **不当装饰色**，页面主色仍是 accent。
// 拿不到用户色板时 accent 用系统蓝兜底。

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
  accent: '#0A7AFF',
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
  accent: '#4E9BFF',
  onAccent: '#FFFFFF',
  green: '#43C487',
  orange: '#F2A93B',
  red: '#FF6B5F',
}

export function palette(dark: boolean): Palette {
  return dark ? DARK : LIGHT
}

/** 录音模块品牌色。只用于模块徽章，禁止当页面装饰色。 */
export function brandTint(dark: boolean): string {
  return dark ? '#FF9F5B' : '#FF6B35'
}

/** 收藏星专用色（`favorite`）。禁止当装饰色。 */
export function favouriteTint(dark: boolean): string {
  return dark ? '#F4C54B' : '#B77900'
}

/** 说话人配色板（固定 6 色，按 colorIndex 取模）。 */
export function speakerPalette(dark: boolean): string[] {
  return dark
    ? ['#4E9BFF', '#F2A93B', '#C186F5', '#3FC7C1', '#FF7EB6', '#8E8CF5']
    : ['#0A7AFF', '#B56B00', '#8E4EC6', '#0E8C86', '#C2407A', '#5B57C6']
}

/** `rgba()` 化任意 hex —— 用于 `底 accent 12%` 这类令牌。 */
export function alpha(color: string, value: number): string {
  if (color.startsWith('rgba')) return color
  const hex = color.replace('#', '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${value})`
}
