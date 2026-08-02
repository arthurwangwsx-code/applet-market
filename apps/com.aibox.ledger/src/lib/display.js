// 展示口径（§6.2「正负号与颜色」是最容易做错的一节，集中在这里，别在页面里各写一遍）。
//
// | 场景 | 文本 | 颜色 |
// |---|---|---|
// | 明细行 · 收入 | `+¥xx` | incomeColor 绿 |
// | 明细行 · **支出** | `−¥xx` | **ink（正文色），不是红色** |
// | 明细行 · 校准 | 带符号金额 | muted |
// | 明细行 · 转账两腿 | 无符号金额 | muted |
// | 账户余额 | 负数带 `−` | 负数 expenseColor |
// | 净资产 | **恒带符号** | onAccent |
// | AA 成员净额 | `+` 债权 / `−` 债务 | 绿 / 红 / 0 用 muted |

import { KIND, signedAmountMinor } from './store.js'
import { money } from './money.js'
import { dayHeaderDate, dayStart, DAY_MS } from './dates.js'

export const COLOR_TOKEN = { ink: 'ink', muted: 'muted', income: 'income', expense: 'expense' }

/** 明细行右侧金额。返回 `{ text, tone }`，tone 由页面映射到 CSS 变量。 */
export function entryAmount(txn) {
  switch (txn.kind) {
    case KIND.income:
      return { text: money(txn.amountMinor, txn.currency, { signed: true }), tone: COLOR_TOKEN.income }
    case KIND.expense:
      // 明细行的支出金额是 ink 正文色，**不是红色**。
      return { text: money(-txn.amountMinor, txn.currency), tone: COLOR_TOKEN.ink }
    case KIND.adjustment:
      return { text: money(signedAmountMinor(txn), txn.currency, { signed: true }), tone: COLOR_TOKEN.muted }
    default:
      return { text: money(txn.amountMinor, txn.currency), tone: COLOR_TOKEN.muted }
  }
}

/** 行图标：分类图标/色优先，缺省按 kind 兜底。 */
export function entryGlyph(store, txn) {
  const category = txn.categoryID ? store.category(txn.categoryID) : null
  if (category) return { icon: category.systemImage || 'tag', color: category.colorHex || '#68665E' }
  switch (txn.kind) {
    case KIND.transferOut:
    case KIND.transferIn: return { icon: 'arrow.left.arrow.right', color: '#3A83D0' }
    case KIND.adjustment: return { icon: 'equal.circle', color: '#3A83D0' }
    case KIND.income: return { icon: 'arrow.down.left', color: '#2A9D63' }
    default: return { icon: 'arrow.up.right', color: '#D9534F' }
  }
}

/** kind 兜底名（没有商家也没有分类时用）。 */
export function kindFallbackTitle(store, txn, t) {
  switch (txn.kind) {
    case KIND.transferOut:
    case KIND.transferIn: {
      const own = store.account(txn.accountID)
      const peer = txn.transferPeerID ? store.transaction(txn.transferPeerID) : null
      const other = peer ? store.account(peer.accountID) : null
      const a = own ? own.name : '—'
      const b = other ? other.name : '—'
      return txn.kind === KIND.transferOut ? `${a} → ${b}` : `${b} → ${a}`
    }
    case KIND.adjustment: return t('x.balanceAdjustment')
    case KIND.income: return t('x.income')
    default: return t('x.expense')
  }
}

/** 主标题：商家 → 分类名 → kind 兜底。 */
export function entryTitle(store, txn, t) {
  if (txn.merchant && txn.merchant.trim().length > 0) return txn.merchant.trim()
  if (txn.categoryID) {
    const category = store.category(txn.categoryID)
    if (category) return category.name
  }
  return kindFallbackTitle(store, txn, t)
}

/** 副标题：`[有商家时的分类名, 账户名, 非空备注]` 用 ` · ` 拼接。 */
export function entrySubtitle(store, txn) {
  const parts = []
  const hasMerchant = !!(txn.merchant && txn.merchant.trim().length > 0)
  if (hasMerchant && txn.categoryID) {
    const category = store.category(txn.categoryID)
    if (category) parts.push(category.name)
  }
  const account = store.account(txn.accountID)
  if (account) parts.push(account.name)
  if (txn.note && txn.note.trim().length > 0) parts.push(txn.note.trim())
  return parts.join(' · ')
}

/** 分类展示路径，缺省用 kind 兜底名（下钻列表、账户详情、最近删除都用这个）。 */
export function entryPathTitle(store, txn, t) {
  if (txn.categoryID) {
    const path = store.categoryPath(txn.categoryID)
    if (path) return path
  }
  return kindFallbackTitle(store, txn, t)
}

/** 外币行的第二行：有汇率 → `≈ ±{基准币}`；无汇率 → 「缺汇率」。 */
export function entryConversion(store, txn, t) {
  if (txn.currency === store.baseCode) return null
  if (!store.hasUsableRate(txn.currency)) return { text: t('tx.rateNeeded'), tone: COLOR_TOKEN.expense }
  const base = store.reportingBaseMinor(txn)
  const signed = txn.kind === KIND.income ? base : (txn.kind === KIND.expense ? -base : base)
  return { text: `≈ ${money(signed, store.baseCode, { signed: txn.kind === KIND.income })}`, tone: COLOR_TOKEN.muted }
}

/** 日期表头：今天 / 昨天 / 本地化 `MMMd EEE`。 */
export function dayHeaderTitle(day, locale, t, now = Date.now()) {
  const today = dayStart(now)
  if (day === today) return t('tx.today')
  if (day === today - DAY_MS) return t('tx.yesterday')
  return dayHeaderDate(day, locale)
}

/** 当日支出合计（仅 > 0 时显示）：含非基准币支出时前面加 `≈`。 */
export function dayExpenseTotal(store, rows) {
  let total = 0
  let approximate = false
  for (const txn of rows) {
    if (txn.kind !== KIND.expense) continue
    total += store.reportingBaseMinor(txn)
    if (txn.currency !== store.baseCode) approximate = true
  }
  if (total <= 0) return null
  return `${approximate ? '≈ ' : ''}${money(-total, store.baseCode)}`
}
