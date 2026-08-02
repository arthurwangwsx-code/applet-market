// 筛选与聚合（§4.3）。**UI 报表页与 AI 的 ledger_stats 共用这一份实现** ——
// 模型说的数和界面显示的数永远同源。

import { KIND, countsInFlow } from './store.js'
import { DAY_MS, dayStart, isoDay, monthKeyOf, monthTitle, shortDate } from './dates.js'

/**
 * 筛选。默认 `includeNonFlow = false` —— 没有显式指定 kind 时**自动剔除转账两腿与校准**。
 * 日期区间：`dateFrom` 含当天 00:00，`dateTo` **含当天**（内部转成次日 00:00 的开区间）。
 */
export function filterTransactions(store, filter = {}) {
  const kinds = filter.kinds ? new Set(filter.kinds) : null
  const from = filter.dateFrom !== undefined && filter.dateFrom !== null ? dayStart(filter.dateFrom) : null
  const to = filter.dateTo !== undefined && filter.dateTo !== null ? dayStart(filter.dateTo) + DAY_MS : null
  const includeNonFlow = filter.includeNonFlow === true || !!kinds
  const tag = filter.tag ? String(filter.tag).toLowerCase() : null

  return store.allTransactions().filter((txn) => {
    if (kinds && !kinds.has(txn.kind)) return false
    if (!includeNonFlow && !countsInFlow(txn)) return false
    if (from !== null && txn.occurredOn < from) return false
    if (to !== null && txn.occurredOn >= to) return false
    if (filter.accountID && txn.accountID !== filter.accountID) return false
    if (filter.projectID !== undefined && filter.projectID !== null && txn.projectID !== filter.projectID) return false
    if (filter.categoryID) {
      const root = store.rootCategoryID(txn.categoryID)
      if (txn.categoryID !== filter.categoryID && root !== filter.categoryID) return false
    }
    if (tag && !(txn.tags ?? []).some((row) => String(row).toLowerCase() === tag)) return false
    if (filter.reimbursable !== undefined && filter.reimbursable !== null
      && !!txn.reimbursable !== !!filter.reimbursable) return false
    if (filter.minAmountMinor !== undefined && filter.minAmountMinor !== null
      && txn.amountMinor < filter.minAmountMinor) return false
    if (filter.maxAmountMinor !== undefined && filter.maxAmountMinor !== null
      && txn.amountMinor > filter.maxAmountMinor) return false
    if (filter.keyword) {
      const needle = String(filter.keyword).trim().toLowerCase()
      if (needle.length > 0) {
        const haystack = [txn.merchant ?? '', txn.note ?? '', ...(txn.tags ?? [])].join(' ').toLowerCase()
        if (!haystack.includes(needle)) return false
      }
    }
    return true
  })
}

/**
 * 明细页的搜索匹配（§2.1 ⑤）：去空白小写后子串 contains，任一命中即算。
 * 覆盖 note / merchant / 任一 tag / **账户名** / **分类展示路径** / **项目名**。
 */
export function matchesSearch(store, txn, query) {
  const needle = String(query ?? '').trim().toLowerCase()
  if (needle.length === 0) return true
  const account = store.account(txn.accountID)
  const project = txn.projectID ? store.project(txn.projectID) : null
  const fields = [
    txn.note ?? '',
    txn.merchant ?? '',
    ...(txn.tags ?? []),
    account ? account.name : '',
    txn.categoryID ? store.categoryPath(txn.categoryID) : '',
    project ? project.name : '',
  ]
  return fields.some((field) => String(field).toLowerCase().includes(needle))
}

export const UNCATEGORIZED_KEY = '__uncat__'
export const UNTAGGED_KEY = '__untagged__'
export const NO_PROJECT_KEY = '__noproject__'

/**
 * 聚合成桶。
 * `metric`：`expense` 只留支出 / `income` 只留收入 / `net` 留 countsInFlow（收入 +、支出 −）。
 * 排序：`byDay` / `byMonth` 按 key **升序**（时间正序，给趋势图用）；其余按 **|金额| 降序**。
 * ⚠️ `byTag`：一笔多标签会给每个标签都加全额（**有意重复计数**）。
 */
export function buckets(store, transactions, dimension, metric, locale = 'en', labels = {}) {
  const map = new Map()
  const push = (key, label, amount, colorHex) => {
    let bucket = map.get(key)
    if (!bucket) {
      bucket = { key, label, amountMinor: 0, count: 0, colorHex: colorHex ?? null }
      map.set(key, bucket)
    }
    bucket.amountMinor += amount
    bucket.count += 1
    if (!bucket.colorHex && colorHex) bucket.colorHex = colorHex
  }

  for (const txn of transactions) {
    if (metric === 'expense' && txn.kind !== KIND.expense) continue
    if (metric === 'income' && txn.kind !== KIND.income) continue
    if (metric === 'net' && !countsInFlow(txn)) continue
    const base = store.reportingBaseMinor(txn)
    const amount = metric === 'net' ? (txn.kind === KIND.income ? base : -base) : base

    switch (dimension) {
      case 'byCategory': {
        const rootID = store.rootCategoryID(txn.categoryID)
        const category = rootID ? store.category(rootID) : null
        push(rootID ?? UNCATEGORIZED_KEY, category ? category.name : (labels.uncategorized ?? 'Uncategorized'),
          amount, category ? category.colorHex : null)
        break
      }
      case 'bySubcategory': {
        const category = txn.categoryID ? store.category(txn.categoryID) : null
        push(txn.categoryID ?? UNCATEGORIZED_KEY,
          category ? store.categoryPath(txn.categoryID) : (labels.uncategorized ?? 'Uncategorized'),
          amount, category ? category.colorHex : null)
        break
      }
      case 'byAccount': {
        const account = store.account(txn.accountID)
        push(txn.accountID ?? UNCATEGORIZED_KEY, account ? account.name : '—', amount, account ? account.colorHex : null)
        break
      }
      case 'byTag': {
        const tags = txn.tags ?? []
        if (tags.length === 0) push(UNTAGGED_KEY, labels.noTag ?? 'No tag', amount)
        else for (const tag of tags) push(`tag:${String(tag).toLowerCase()}`, String(tag), amount)
        break
      }
      case 'byDay':
        push(isoDay(txn.occurredOn), shortDate(txn.occurredOn, locale), amount)
        break
      case 'byMonth': {
        const key = monthKeyOf(txn.occurredOn)
        push(String(key), monthTitle(key, locale), amount)
        break
      }
      case 'byProject': {
        const project = txn.projectID ? store.project(txn.projectID) : null
        push(txn.projectID ?? NO_PROJECT_KEY, project ? project.name : (labels.noProject ?? 'No project'),
          amount, project ? project.colorHex : null)
        break
      }
      default:
        break
    }
  }

  const rows = [...map.values()]
  if (dimension === 'byDay' || dimension === 'byMonth') rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  else rows.sort((a, b) => Math.abs(b.amountMinor) - Math.abs(a.amountMinor))
  return rows
}

/** 期间语义（AI 工具的 `period`）。返回 `{from, to}`（含当天，ms）。 */
export function periodRange(period, now = Date.now()) {
  const today = dayStart(now)
  const date = new Date(today)
  switch (period) {
    case 'today': return { from: today, to: today }
    case 'this_week': {
      const weekday = (date.getDay() + 6) % 7 // 周一为一周之始
      return { from: today - weekday * DAY_MS, to: today }
    }
    case 'last_7_days': return { from: today - 6 * DAY_MS, to: today }
    case 'last_30_days': return { from: today - 29 * DAY_MS, to: today }
    case 'this_month': return { from: new Date(date.getFullYear(), date.getMonth(), 1).getTime(), to: today }
    case 'last_month': {
      const start = new Date(date.getFullYear(), date.getMonth() - 1, 1).getTime()
      const end = new Date(date.getFullYear(), date.getMonth(), 1).getTime() - DAY_MS
      return { from: start, to: end }
    }
    case 'this_year': return { from: new Date(date.getFullYear(), 0, 1).getTime(), to: today }
    case 'all': return { from: null, to: null }
    default: return { from: null, to: null }
  }
}
