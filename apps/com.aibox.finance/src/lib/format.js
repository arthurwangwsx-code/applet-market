// 数字 / 涨跌 / 货币格式（规格 §11）。
//
// 两条刻意的反直觉规则，别"修"：
//  · **大数字缩写在英文界面也是「万/亿」**，不会变 K/M/B（原生源码显式标了 i18n:ignore）；
//  · **涨跌幅为 0 用中性灰**，不是红也不是绿。

import { decimalsFor } from './symbol.js'

export const CURRENCY_SYMBOL = {
  CNY: '¥', RMB: '¥', HKD: 'HK$', USD: '$', EUR: '€', GBP: '£', JPY: 'JP¥',
}

export function currencySymbol(code) {
  return CURRENCY_SYMBOL[code] || `${code} `
}

/** 价格：`%.{d}f`，d 钳到 0..4，**无千分位**。 */
export function formatPrice(value, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const digits = Math.max(0, Math.min(4, decimals))
  return value.toFixed(digits)
}

export function formatPriceFor(value, market) {
  return formatPrice(value, decimalsFor(market))
}

/** 涨跌额：价格格式 + 正数补 `+`。 */
export function formatChange(value, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const text = formatPrice(Math.abs(value), decimals)
  if (value > 0) return `+${text}`
  if (value < 0) return `-${text}`
  return text
}

/** 百分比：signed 且 > 0 时补 `+`；固定 2 位。 */
export function formatPercent(value, signed = true) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const sign = signed && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/** 份额：整数 `%.0f`；含小数 `%.4f` 去尾零去尾点。 */
export function formatQuantity(value) {
  if (!Number.isFinite(value)) return '—'
  if (Number.isInteger(value)) return value.toFixed(0)
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

/** 大数字缩写：|v| ≥ 1e8 → `%.2f亿`；≥ 1e4 → `%.2f万`；否则 `%.0f`。中英文都是「万/亿」。 */
export function formatCompact(value) {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(value / 1e4).toFixed(2)}万`
  return value.toFixed(0)
}

/** 带货币符号的大数字（compactCNY 的通用形态）。 */
export function formatCompactCurrency(value, currency = 'CNY') {
  if (!Number.isFinite(value)) return '—'
  const sign = value < 0 ? '-' : ''
  return `${sign}${currencySymbol(currency)}${formatCompact(Math.abs(value))}`
}

/** 千分位只加在整数部分，小数部分原样。 */
export function groupInteger(text) {
  const [whole, fraction] = String(text).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

/** 金额（分）：`符号 + 货币符号 + 千分位("%.2f" of 绝对值)`。 */
export function formatMinor(minor, currency = 'CNY', { signed = false } = {}) {
  const value = (Number(minor) || 0) / 100
  const sign = value < 0 ? '-' : (signed && value > 0 ? '+' : '')
  return `${sign}${currencySymbol(currency)}${groupInteger(Math.abs(value).toFixed(2))}`
}

/** 成交量 → 手（÷100）。五档盘口与新浪 A 股成交量都用它。 */
export function toLots(volume) {
  if (!Number.isFinite(volume)) return '—'
  return formatCompact(volume / 100)
}

// —— 涨跌语义 ——

export const UP_RED = { up: '#E64340', down: '#0FA968' }
export const UP_RED_DARK = { up: '#FF5B57', down: '#30D158' }

/**
 * 涨跌色。`upIsRed` 默认 true（红涨绿跌）；**changePct === 0 一律返回 null**
 * ——调用方据此落到中性 muted 灰。
 */
export function trendKey(value) {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}

export function trendColor(value, upIsRed = true) {
  const key = trendKey(value)
  if (key === 'flat') return 'var(--fin-muted)'
  const rising = key === 'up'
  return (rising === upIsRed) ? 'var(--fin-red)' : 'var(--fin-green)'
}

/** 半透明底（自选行的涨跌 pill 用 13%）。 */
export function trendTint(value, upIsRed = true, alpha = 0.13) {
  const key = trendKey(value)
  if (key === 'flat') return `color-mix(in srgb, var(--fin-muted) ${alpha * 100}%, transparent)`
  const rising = key === 'up'
  const token = (rising === upIsRed) ? 'var(--fin-red)' : 'var(--fin-green)'
  return `color-mix(in srgb, ${token} ${alpha * 100}%, transparent)`
}

// —— 时间 ——

/** 固定 `yyyy-MM-dd`，**不随界面语言变**（工具文本与端点参数都用它）。 */
export function isoDate(timestamp) {
  const date = new Date(timestamp)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 上海时区的 yyyyMMdd（涨跌停池 date 参数专用）。 */
export function shanghaiYMD(timestamp) {
  const date = new Date(timestamp || Date.now())
  const shanghai = new Date(date.getTime() + (date.getTimezoneOffset() + 480) * 60000)
  const pad = (value) => String(value).padStart(2, '0')
  return `${shanghai.getFullYear()}${pad(shanghai.getMonth() + 1)}${pad(shanghai.getDate())}`
}

/**
 * 自选页页脚时间戳：**medium 日期 + short 时间 + 时区缩写**。
 * 刻意带日期与时区——避免把昨天的快照当今天看。
 */
export function formatStamp(timestamp, locale) {
  if (!timestamp) return '—'
  const tag = locale === 'zh-Hans' ? 'zh-CN' : 'en-US'
  try {
    const text = new Intl.DateTimeFormat(tag, {
      dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short',
    }).format(new Date(timestamp))
    return text
  } catch (error) {
    return new Date(timestamp).toISOString()
  }
}

/** 行业页页脚：当天 `HH:mm`，隔日 `MM-dd HH:mm`。 */
export function formatShortStamp(timestamp, now) {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  const today = new Date(now || Date.now())
  const pad = (value) => String(value).padStart(2, '0')
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  return sameDay ? time : `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`
}
