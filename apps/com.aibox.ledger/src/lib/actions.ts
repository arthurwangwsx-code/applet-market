// AI 工具面（对应原生 8 个 `ledger_*` 工具，§8.4）。
//
// 三条纪律：
//  1. **无 UI 也能跑**：只依赖 store 与 lib/ 里的纯函数，不碰任何 React 状态；
//  2. **同一条写路径**：全部走 store.mutate → WAL，绝不绕过去直接写库；
//     写完必须看 `store.lastMutationSucceeded`，失败返回明确的「未保存」错误文本；
//  3. **金额第一步就转整数分**：AI 给的是浮点主单位，进系统立刻 majorNumberToMinor。

import { KIND } from './store.js'
import { majorNumberToMinor, money } from './money.js'
import { normalizeCurrencyCode } from './currencies.js'
import { dayStart, isoDay, monthKeyOf, monthTitle, parseISODay, DAY_MS } from './dates.js'
import { buckets, filterTransactions, periodRange } from './queries.js'
import { budgetPayload } from './reporting.js'
import { deleteEntry, findByIdempotencyKey, recordEntry, recordTransfer, updateEntry } from './entries.js'
import { createAccount, createProject, upsertBudget } from './entities.js'
import { isNoneToken, resolveAccount, resolveCategory, resolveMember, resolveProject } from './resolve.js'
import type { BucketDimension, BucketLabels, BucketMetric, QueryFilter, SplitMode, TransactionPatch } from '../types.js'
import type { LedgerStore } from './store.js'
import type { QueryPeriod } from './queries.js'

export interface LedgerActionArgs {
  [key: string]: unknown
  action?: unknown
  type?: unknown
  transaction_id?: unknown
  amount?: unknown
  note?: unknown
  merchant?: unknown
  tags?: unknown
  reimbursable?: unknown
  date?: unknown
  refund_of?: unknown
  category?: unknown
  account?: unknown
  currency?: unknown
  project?: unknown
  request_id?: unknown
  to_account?: unknown
  to_amount?: unknown
  batch_id?: unknown
  payer?: unknown
  split_mode?: unknown
  split_with?: unknown
  split_values?: unknown
  source_fingerprint?: unknown
  date_from?: unknown
  date_to?: unknown
  period?: unknown
  limit?: unknown
  tag?: unknown
  keyword?: unknown
  min_amount?: unknown
  max_amount?: unknown
  dimension?: unknown
  metric?: unknown
  compare_previous?: unknown
  top_n?: unknown
  month?: unknown
  carryover?: unknown
}

/** 写失败时给模型的统一错误文本（对应原生 `persistenceFailure()`）。 */
export const PERSISTENCE_FAILURE =
  'The ledger change was NOT saved — the database is read-only or the write failed. ' +
  'No success should be assumed. Ask the user to retry after the ledger becomes writable.'

export const actionFail = (text: string) => ({ ok: false as const, text })
export const actionDone = (text: string, extra: Record<string, unknown> = {}) => ({ ok: true as const, text, ...extra })

const fail = actionFail
const done = actionDone

// MARK: - 参数归一

const ACTION_SYNONYMS: Record<string, string> = {
  edit: 'update',
  change: 'update',
  modify: 'update',
  set: 'update',
  remove: 'delete',
  del: 'delete',
  cancel: 'delete',
  trash: 'delete',
  create: 'add',
  record: 'add',
  new: 'add',
  log: 'add',
  insert: 'add',
}

function normalizeRecordAction(raw: unknown, args: LedgerActionArgs): 'add' | 'update' | 'delete' {
  const text = String(raw ?? '')
    .trim()
    .toLowerCase()
  const mapped = ACTION_SYNONYMS[text] ?? text
  if (mapped === 'add' || mapped === 'update' || mapped === 'delete') return mapped
  // 乱填或缺失：有 transaction_id 且无 amount → update，否则 add。**绝不臆测 delete**。
  if (args.transaction_id && (args.amount === undefined || args.amount === null)) return 'update'
  return 'add'
}

const TYPE_SYNONYMS: Record<string, 'expense' | 'income' | 'transfer'> = {
  in: 'income',
  earn: 'income',
  salary: 'income',
  receive: 'income',
  revenue: 'income',
  收入: 'income',
  move: 'transfer',
  xfer: 'transfer',
  转账: 'transfer',
  out: 'expense',
  spend: 'expense',
  支出: 'expense',
}

function normalizeType(raw: unknown): 'expense' | 'income' | 'transfer' {
  const text = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (text === 'expense' || text === 'income' || text === 'transfer') return text
  return TYPE_SYNONYMS[text] ?? 'expense'
}

/** 日期：`YYYY-MM-DD` 或「昨天 / 3天前 / yesterday」等自然语言；默认今天。 */
export function parseFlexibleDate(raw: unknown, now = Date.now()): number {
  const text = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (text.length === 0) return dayStart(now)
  const iso = parseISODay(text)
  if (iso !== null) return iso
  if (['today', '今天', '今日'].includes(text)) return dayStart(now)
  if (['yesterday', '昨天', '昨日'].includes(text)) return dayStart(now) - DAY_MS
  if (['tomorrow', '明天'].includes(text)) return dayStart(now) + DAY_MS
  const zh = /^(\d+)\s*天前$/.exec(text)
  if (zh) return dayStart(now) - Number(zh[1]) * DAY_MS
  const en = /^(\d+)\s*days?\s*ago$/.exec(text)
  if (en) return dayStart(now) - Number(en[1]) * DAY_MS
  return dayStart(now)
}

/** 解析失败/歧义时**回一份候选清单**让模型自愈重试，而不是硬报错。 */
export function actionCandidatesText(label: string, candidates: readonly string[]): string {
  if (!candidates || candidates.length === 0) return `No ${label} matched. Ask the user which one to use.`
  return `Ambiguous ${label}. Candidates: ${candidates.join(' | ')}. Ask the user which one, then retry.`
}

const candidatesText = actionCandidatesText

function windowFor(args: LedgerActionArgs, now: number): { from: number | null; to: number | null } {
  if (args.date_from || args.date_to) {
    return {
      from: args.date_from ? parseISODay(String(args.date_from)) : null,
      to: args.date_to ? parseISODay(String(args.date_to)) : null,
    }
  }
  return periodRange(normalizePeriod(args.period), now)
}

function describeTransaction(store: LedgerStore, txn: import('../types.js').LedgerTransaction): string {
  const account = store.account(txn.accountID)
  const sign = txn.kind === KIND.income ? '+' : txn.kind === KIND.expense ? '-' : ''
  const parts = [
    isoDay(txn.occurredOn),
    `${sign}${money(txn.amountMinor, txn.currency)}`,
    txn.merchant ?? '',
    txn.categoryID ? store.categoryPath(txn.categoryID) : '',
    account ? account.name : '',
    txn.note ?? '',
  ].filter((piece) => String(piece).length > 0)
  return `${parts.join(' · ')} [id: ${txn.id}]`
}

// MARK: - ① ledger_record

export async function actionRecord(store: LedgerStore, args: LedgerActionArgs, locale: string) {
  const action = normalizeRecordAction(args.action, args)

  if (action === 'delete') {
    if (!args.transaction_id) return fail('delete needs transaction_id.')
    const result = await deleteEntry(store, String(args.transaction_id))
    if (!result.ok) return fail(result.reason === 'notFound' ? 'No entry with that id.' : PERSISTENCE_FAILURE)
    return done(`Deleted entry [id: ${args.transaction_id}].`, { id: args.transaction_id, deleted: true })
  }

  if (action === 'update') {
    if (!args.transaction_id) return fail('update needs transaction_id.')
    const current = store.transaction(String(args.transaction_id))
    if (!current) return fail('No entry with that id.')
    const patch: TransactionPatch = {}
    if (args.amount !== undefined && args.amount !== null) patch.amountMinor = majorNumberToMinor(Number(args.amount))
    if (args.note !== undefined) patch.note = String(args.note)
    if (args.merchant !== undefined) patch.merchant = String(args.merchant)
    if (args.tags !== undefined) patch.tags = Array.isArray(args.tags) ? args.tags : []
    if (args.reimbursable !== undefined) patch.reimbursable = !!args.reimbursable
    if (args.date !== undefined) patch.occurredOn = parseFlexibleDate(args.date)
    if (args.refund_of !== undefined) patch.refundOfID = isNoneToken(args.refund_of) ? null : String(args.refund_of)
    if (args.category) {
      const kind = current.kind === KIND.income ? 'income' : 'expense'
      const resolved = resolveCategory(store, args.category, kind)
      if (!resolved.found) return fail(candidatesText('category', resolved.candidates))
      patch.categoryID = resolved.value.id
    }
    if (args.account) {
      const resolved = resolveAccount(store, args.account, args.currency ? String(args.currency) : null)
      if (!resolved.found) return fail(candidatesText('account', resolved.candidates))
      patch.accountID = resolved.value.id
    }
    if (args.project !== undefined) {
      if (isNoneToken(args.project)) patch.projectID = null
      else {
        const resolved = resolveProject(store, args.project)
        if (!resolved.found) return fail(candidatesText('project', resolved.candidates))
        patch.projectID = resolved.value.id
      }
    }
    const result = await updateEntry(store, current.id, patch)
    if (!result.ok || !result.transaction) {
      if (result.reason === 'rateNeeded')
        return fail(`No exchange rate configured for ${result.currency}. Set it first with ledger_currency.`)
      return fail(PERSISTENCE_FAILURE)
    }
    return done(`Updated. ${describeTransaction(store, result.transaction)}`, { id: result.transaction.id })
  }

  // add
  const requestID = args.request_id ? String(args.request_id) : null
  if (requestID) {
    const existing = findByIdempotencyKey(store, requestID)
    if (existing)
      return done(`Already recorded (idempotent retry). ${describeTransaction(store, existing)}`, {
        id: existing.id,
        duplicate: true,
      })
  }
  const amount = Number(args.amount)
  if (!Number.isFinite(amount) || amount <= 0) return fail('add needs a positive amount.')
  const amountMinor = majorNumberToMinor(amount)
  const type = normalizeType(args.type)
  const occurredOn = parseFlexibleDate(args.date)

  if (type === 'transfer') {
    const from = resolveAccount(store, args.account ?? '', args.currency ? String(args.currency) : null)
    const to = resolveAccount(store, args.to_account ?? '')
    if (!from.found) return fail(candidatesText('source account', from.candidates))
    if (!to.found) return fail(candidatesText('destination account', to.candidates))
    if (!store.hasUsableRate(from.value.currency) || !store.hasUsableRate(to.value.currency)) {
      return fail('Set exchange rates for both currencies before transferring. Nothing was written.')
    }
    const result = await recordTransfer(store, {
      fromAccountID: from.value.id,
      toAccountID: to.value.id,
      amountMinor,
      toAmountMinor:
        args.to_amount !== undefined && args.to_amount !== null ? majorNumberToMinor(Number(args.to_amount)) : null,
      occurredOn,
      note: args.note ? String(args.note) : '',
      merchant: args.merchant ? String(args.merchant) : null,
      tags: Array.isArray(args.tags) ? args.tags : [],
      source: 'ai',
      idempotencyKey: requestID,
      batchID: args.batch_id ? String(args.batch_id) : null,
    })
    if (!result.ok || !result.transaction || !result.peer)
      return fail(result.reason === 'persistence' ? PERSISTENCE_FAILURE : `Transfer failed: ${result.reason}.`)
    return done(
      `Transferred ${money(amountMinor, from.value.currency)} ${from.value.name} → ${to.value.name}. [id: ${result.transaction.id}]`,
      { id: result.transaction.id, peerID: result.peer.id },
    )
  }

  const kind = type === 'income' ? KIND.income : KIND.expense
  let accountID = null
  if (args.account) {
    const resolved = resolveAccount(store, args.account, args.currency ? String(args.currency) : null)
    if (!resolved.found) return fail(candidatesText('account', resolved.candidates))
    accountID = resolved.value.id
  } else if (args.currency) {
    // 给了币种但没点名账户 → 路由到同币种账户；没有就自动建一个现金账户。
    const code = normalizeCurrencyCode(args.currency)
    if (!store.hasUsableRate(code)) {
      return fail(
        `Currency ${code} has no configured exchange rate, so the entry was NOT recorded. Add it with ledger_currency first.`,
      )
    }
    const same = store.activeAccounts().filter((row) => row.currency === code)
    if (same[0]) accountID = same[0].id
    else {
      const created = await createAccount(store, { name: `Cash (${code})`, kind: 'cash', currency: code })
      if (!created.ok || !created.account) return fail(PERSISTENCE_FAILURE)
      accountID = created.account.id
    }
  }

  let categoryID = null
  if (args.category) {
    const resolved = resolveCategory(store, args.category, kind === KIND.income ? 'income' : 'expense')
    if (!resolved.found) return fail(candidatesText('category', resolved.candidates))
    categoryID = resolved.value.id
  }

  // **AI 记账缺省不归任何项目**（哪怕存在当前激活项目）——只有 UI 手动记账才默认归入当前项目。
  let projectID = null
  if (args.project && !isNoneToken(args.project)) {
    const resolved = resolveProject(store, args.project)
    if (resolved.found) projectID = resolved.value.id
    else {
      const created = await createProject(store, { name: String(args.project) })
      if (!created.ok || !created.project) return fail(PERSISTENCE_FAILURE)
      projectID = created.project.id
    }
  }

  let payerMemberID = null
  let split: import('../types.js').TransactionSplit | null = null
  if (projectID && args.payer) {
    const resolved = resolveMember(store, projectID, args.payer)
    if (resolved.found) payerMemberID = resolved.value.id
  }
  if (projectID && args.split_mode) {
    const members = store.projectMembers(projectID)
    const names =
      Array.isArray(args.split_with) && args.split_with.length > 0 ? args.split_with : members.map((row) => row.name)
    const ids: string[] = []
    for (const name of names) {
      const resolved = resolveMember(store, projectID, name)
      if (resolved.found) ids.push(resolved.value.id)
    }
    if (ids.length > 0) {
      // 付款人排到首位 → 零头落在付款人身上。
      const ordered = payerMemberID ? [payerMemberID, ...ids.filter((id) => id !== payerMemberID)] : ids
      const values = Array.isArray(args.split_values) ? args.split_values : []
      split = {
        mode: normalizeSplitMode(args.split_mode),
        shares: ordered.map((id) => {
          const position = ids.indexOf(id)
          return { memberID: id, value: Number(values[position] ?? 0) }
        }),
      }
    }
  }

  const result = await recordEntry(store, {
    kind,
    amountMinor,
    accountID,
    categoryID,
    projectID,
    payerMemberID,
    split,
    occurredOn,
    merchant: args.merchant ? String(args.merchant) : null,
    note: args.note ? String(args.note) : '',
    tags: Array.isArray(args.tags) ? args.tags : [],
    reimbursable: !!args.reimbursable,
    refundOfID: args.refund_of && !isNoneToken(args.refund_of) ? String(args.refund_of) : null,
    source: 'ai',
    idempotencyKey: requestID,
    batchID: args.batch_id ? String(args.batch_id) : null,
    sourceFingerprint: args.source_fingerprint ? String(args.source_fingerprint) : null,
  })
  if (!result.ok || !result.transaction) {
    if (result.reason === 'rateNeeded')
      return fail(`No exchange rate configured for ${result.currency}. Nothing was written.`)
    if (result.reason === 'noAccount')
      return fail('There is no account to record into. Create one with ledger_account first.')
    return fail(PERSISTENCE_FAILURE)
  }
  const account = store.account(result.transaction.accountID)
  return done(
    `Recorded ${type} ${money(amountMinor, result.transaction.currency)} on ${isoDay(occurredOn)}` +
      `${categoryID ? ` · ${store.categoryPath(categoryID)}` : ''}${account ? ` · ${account.name}` : ''} ` +
      `[id: ${result.transaction.id}]`,
    { id: result.transaction.id, amountMinor, currency: result.transaction.currency },
  )
}

// MARK: - ② ledger_query

export async function actionQuery(store: LedgerStore, args: LedgerActionArgs, locale: string) {
  const now = Date.now()
  const range = windowFor(args, now)
  const filter: QueryFilter = { dateFrom: range.from, dateTo: range.to }
  if (args.type) {
    const type = normalizeType(args.type)
    filter.kinds =
      type === 'transfer' ? [KIND.transferOut, KIND.transferIn] : type === 'income' ? [KIND.income] : [KIND.expense]
  }
  if (args.category) {
    const resolved = resolveCategory(store, args.category, args.type === 'income' ? 'income' : 'expense')
    if (!resolved.found) return fail(candidatesText('category', resolved.candidates))
    filter.categoryID = resolved.value.id
  }
  if (args.account) {
    const resolved = resolveAccount(store, args.account)
    if (!resolved.found) return fail(candidatesText('account', resolved.candidates))
    filter.accountID = resolved.value.id
  }
  if (args.project) {
    const resolved = resolveProject(store, args.project)
    if (!resolved.found) return fail(candidatesText('project', resolved.candidates))
    filter.projectID = resolved.value.id
  }
  if (args.tag) filter.tag = String(args.tag)
  if (args.keyword) filter.keyword = String(args.keyword)
  if (args.reimbursable !== undefined) filter.reimbursable = !!args.reimbursable
  if (args.min_amount !== undefined && args.min_amount !== null)
    filter.minAmountMinor = majorNumberToMinor(Number(args.min_amount))
  if (args.max_amount !== undefined && args.max_amount !== null)
    filter.maxAmountMinor = majorNumberToMinor(Number(args.max_amount))

  const limit = Math.min(100, Math.max(1, Number(args.limit) || 20))
  const rows = filterTransactions(store, filter)
  if (rows.length === 0) return done('No matching ledger entries.', { count: 0, entries: [] })
  const shown = rows.slice(0, limit)
  const expenseTotal = rows
    .filter((txn) => txn.kind === KIND.expense)
    .reduce((total, txn) => total + store.reportingBaseMinor(txn), 0)
  const lines = shown.map((txn) => describeTransaction(store, txn))
  return done(
    `${rows.length} matching entries (showing ${shown.length}). Expense total ${money(expenseTotal, store.baseCode)} ` +
      `(in base currency ${store.baseCode}).\n${lines.join('\n')}`,
    {
      count: rows.length,
      totalExpenseMinor: expenseTotal,
      baseCurrency: store.baseCode,
      entries: shown.map((txn) => ({
        id: txn.id,
        kind: txn.kind,
        amountMinor: txn.amountMinor,
        currency: txn.currency,
        date: isoDay(txn.occurredOn),
        merchant: txn.merchant,
        note: txn.note,
        category: txn.categoryID ? store.categoryPath(txn.categoryID) : null,
      })),
    },
  )
}

// MARK: - ③ ledger_stats

const DIMENSION_MAP: Record<string, BucketDimension> = {
  by_category: 'byCategory',
  by_subcategory: 'bySubcategory',
  by_day: 'byDay',
  by_month: 'byMonth',
  by_account: 'byAccount',
  by_tag: 'byTag',
  by_project: 'byProject',
}

export async function actionStats(store: LedgerStore, args: LedgerActionArgs, locale: string, labels: BucketLabels) {
  const now = Date.now()
  const range = windowFor(args, now)
  const dimension = DIMENSION_MAP[String(args.dimension ?? 'by_category')] ?? 'byCategory'
  const metric: BucketMetric = args.metric === 'income' || args.metric === 'net' ? args.metric : 'expense'
  const filter: QueryFilter = { dateFrom: range.from, dateTo: range.to }
  if (args.project) {
    const resolved = resolveProject(store, args.project)
    if (!resolved.found) return fail(candidatesText('project', resolved.candidates))
    filter.projectID = resolved.value.id
  }
  const rows = filterTransactions(store, filter)
  const list = buckets(store, rows, dimension, metric, locale, labels)
  const total = list.reduce((sum, bucket) => sum + bucket.amountMinor, 0)

  let previousTotal: number | null = null
  if (args.compare_previous && range.from !== null && range.to !== null) {
    const span = range.to - range.from
    const previous = filterTransactions(store, {
      ...filter,
      dateFrom: range.from - span - DAY_MS,
      dateTo: range.from - DAY_MS,
    })
    previousTotal = buckets(store, previous, dimension, metric, locale, labels).reduce(
      (sum, bucket) => sum + bucket.amountMinor,
      0,
    )
  }

  const isTime = dimension === 'byDay' || dimension === 'byMonth'
  const capped = isTime ? list : list.slice(0, Math.min(50, Math.max(1, Number(args.top_n) || 50)))
  const head = capped
    .slice(0, 15)
    .map((bucket) => `${bucket.label}: ${money(bucket.amountMinor, store.baseCode)} (${bucket.count})`)
  return done(
    `${metric} by ${args.dimension ?? 'by_category'} — total ${money(total, store.baseCode)} ` +
      `(base currency ${store.baseCode}, historical posting rates)` +
      `${previousTotal !== null ? `; previous window ${money(previousTotal, store.baseCode)}` : ''}\n${head.join('\n')}`,
    { totalMinor: total, previousTotalMinor: previousTotal, baseCurrency: store.baseCode, buckets: capped },
  )
}

// MARK: - ⑤ ledger_budget

export function parseMonthKey(raw: unknown, now = Date.now()): number {
  const text = String(raw ?? '').trim()
  if (text.length === 0) return monthKeyOf(now)
  const match = /^(\d{4})[-/]?(\d{2})$/.exec(text)
  if (!match) return monthKeyOf(now)
  return Number(match[1]) * 100 + Number(match[2])
}

export async function actionBudget(store: LedgerStore, args: LedgerActionArgs, locale: string) {
  const monthKey = parseMonthKey(args.month)
  const action = String(args.action ?? 'status').toLowerCase()

  if (action === 'set') {
    let categoryID = null
    if (args.category) {
      const resolved = resolveCategory(store, args.category, 'expense')
      if (!resolved.found) return fail(candidatesText('category', resolved.candidates))
      categoryID = store.rootCategoryID(resolved.value.id)
    }
    const limitMinor = majorNumberToMinor(Number(args.limit ?? 0))
    const result = await upsertBudget(store, monthKey, categoryID, limitMinor, !!args.carryover)
    if (!result.ok) return fail(PERSISTENCE_FAILURE)
    if (result.removed)
      return done(`Removed the budget for ${monthTitle(monthKey, locale)}${categoryID ? '' : ' (overall total)'}.`)
    return done(`Budget set: ${money(limitMinor, store.baseCode)} for ${monthTitle(monthKey, locale)}.`)
  }

  const payload = budgetPayload(store, monthKey)
  if (payload.totalLimitMinor === 0 && payload.lines.length === 0) {
    return done(`No budgets set for ${monthTitle(monthKey, locale)}.`, { payload })
  }
  const lines = payload.lines.map((line) => {
    const over = line.spentMinor > line.limitMinor ? ' ⚠ over' : ''
    const carried = line.carriedMinor > 0 ? ` (+${money(line.carriedMinor, store.baseCode)} carried)` : ''
    return `${line.name}: ${money(line.spentMinor, store.baseCode)} / ${money(line.limitMinor, store.baseCode)}${carried}${over}`
  })
  return done(
    `${monthTitle(monthKey, locale)} — limit ${money(payload.totalLimitMinor, store.baseCode)}, ` +
      `spent ${money(payload.totalSpentMinor, store.baseCode)}, remaining ${money(payload.remainingMinor, store.baseCode)}, ` +
      `${money(payload.dailyRemainingMinor, store.baseCode)}/day over ${payload.daysLeft} day(s) left.` +
      `${lines.length > 0 ? `\n${lines.join('\n')}` : ''}`,
    { payload },
  )
}

function normalizePeriod(value: unknown): QueryPeriod {
  const period = String(value ?? 'this_month')
  const allowed: readonly QueryPeriod[] = [
    'today',
    'this_week',
    'last_7_days',
    'last_30_days',
    'this_month',
    'last_month',
    'this_year',
    'all',
  ]
  return allowed.includes(period as QueryPeriod) ? (period as QueryPeriod) : 'this_month'
}

function normalizeSplitMode(value: unknown): SplitMode {
  return value === 'exact' || value === 'shares' || value === 'percent' ? value : 'equal'
}
