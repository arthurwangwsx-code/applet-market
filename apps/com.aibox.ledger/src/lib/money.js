// 金额格式化与主单位↔分互转（§6.1）。
//
// 三条纪律：
//  1. 存储与运算一律**整数分**，浮点只允许出现在最终显示格式化这一步；
//  2. 负号一律用 U+2212「−」，不是 ASCII 连字符；
//  3. 所有金额文本用等宽数字（CSS `font-variant-numeric: tabular-nums`）。

import { currencyDecimals, currencySymbol } from './currencies.js'
import { evaluateMinor } from './expression.js'

export const MINUS = '−'

function groupInteger(text) {
  let out = ''
  let count = 0
  for (let i = text.length - 1; i >= 0; i -= 1) {
    out = text[i] + out
    count += 1
    if (count % 3 === 0 && i > 0) out = `,${out}`
  }
  return out
}

/**
 * `money(1234_56, 'CNY')` → `"¥1,234.56"`；`signed` 为真时正数补 `+`。
 * `decimals` 显式给时覆盖币种目录（0 位币不输出小数部分）。
 */
export function money(minor, currency, { signed = false, grouping = true, decimals } = {}) {
  const value = Math.round(Number(minor) || 0)
  const symbol = currencySymbol(currency)
  const digits = decimals === undefined || decimals === null ? currencyDecimals(currency) : decimals
  const negative = value < 0
  const abs = Math.abs(value)
  const whole = Math.trunc(abs / 100)
  const cents = abs % 100
  const wholeText = grouping ? groupInteger(String(whole)) : String(whole)
  let body = wholeText
  if (digits > 0) {
    const fraction = String(cents).padStart(2, '0').slice(0, Math.min(2, digits))
    body = `${wholeText}.${digits > 2 ? fraction.padEnd(digits, '0') : fraction}`
  }
  const sign = negative ? MINUS : (signed ? '+' : '')
  return `${sign}${symbol}${body}`
}

/** 紧凑金额：≥1,000,000 → `¥1.2M`；≥1,000 → `¥12.3k`；否则整数化。 */
export function moneyCompact(minor, currency) {
  const value = Math.round(Number(minor) || 0)
  const symbol = currencySymbol(currency)
  const negative = value < 0
  const major = Math.abs(value) / 100
  const sign = negative ? MINUS : ''
  if (major >= 1000000) return `${sign}${symbol}${(major / 1000000).toFixed(1)}M`
  if (major >= 1000) return `${sign}${symbol}${(major / 1000).toFixed(1)}k`
  return `${sign}${symbol}${Math.round(major)}`
}

/** `"1234.56"`——**取绝对值、丢符号、无千分位**；用于 CSV 导出与输入框预填。 */
export function plainMajor(minor) {
  const abs = Math.abs(Math.round(Number(minor) || 0))
  return `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** 主单位串 → 分：先去空白/千分位/常见货币符号，再走定点解析。失败返回 null。 */
export function parseMajorToMinor(text) {
  const cleaned = String(text ?? '')
    .replace(/[\s ]/g, '')
    .replace(/,/g, '')
    .replace(/[¥$€£₩₫₹₱฿]/g, '')
  if (cleaned.length === 0) return null
  try {
    return evaluateMinor(cleaned)
  } catch (error) {
    return null
  }
}

/**
 * JS number 主单位（AI/CSV 传进来的 12.5）→ 分。
 *
 * ⚠️ **不要写 `Math.round(value * 100)`**：`1.005 * 100 === 100.49999999999999`，
 * 会把 1.005 记成 1.00。这里先把数字打成十进制字面量，再走与计算器完全同一套的
 * 精确有理数解析——「AI 给的浮点」和「用户敲的表达式」共用一条精度路径。
 */
export function majorNumberToMinor(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  const text = String(number)
  // 指数记法（1e+21 这种天文数字）超出记账量级，退回朴素路径而不是解析失败。
  if (text.includes('e') || text.includes('E')) {
    const scaled = number * 100
    return scaled < 0 ? -Math.round(-scaled) : Math.round(scaled)
  }
  try {
    return evaluateMinor(text)
  } catch (error) {
    return 0
  }
}
