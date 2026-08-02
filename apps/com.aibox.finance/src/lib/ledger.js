// 模拟账本（规格 §9.3 的 FinAccount / FinPosition / FinTradeOrder / FinCashFlow / FinAccountSnapshot）。
//
// **事务**：整本账（账户 + 持仓 + 成交 + 流水 + 快照）住在**同一个 KV key** 里。
// 一次买入/卖出/现金流是「用 portfolio.js 的纯函数算出新账本 → 一次 `storage.set`」，
// 所以余额变更与流水写入同生共死；写失败就整体回滚（内存状态也一并还原）。
//
// 清仓不删持仓行：quantity 归 0、累计已实现盈亏留档，再买入自动复活；
// 列表按 `quantity > 0` 过滤（§15 第 9 条）。

import { storage } from './host.js'
import { MoneyError } from './money.js'
import {
  allocation, applyBuy, applyCashFlow, applySell, diagnose, fxMapFor, fxRate, performance, valueAccount,
} from './portfolio.js'
import { snapshotFor, startOfDay } from './strategy.js'
import { newID } from './store.js'

export const LEDGER_KEY = 'finance.ledger.v1'

/** 首启种子 1 个账户：CNY，初始 100_000_000 分 = ¥1,000,000.00。 */
export function seedAccount() {
  return {
    id: newID('a'),
    name: 'account.default.name',
    currency: 'CNY',
    initialCashMinor: 100000000,
    cashMinor: 100000000,
    isRealCopy: false,
    note: '',
    colorHex: '34C759',
    sortOrder: 0,
    isArchived: false,
    createdAt: Date.now(),
  }
}

export class Ledger {
  constructor() {
    this.accounts = []
    this.positions = []
    this.orders = []
    this.cashFlows = []
    this.snapshots = []
    this.storageHealthy = true
    this.version = 0
    this.listeners = new Set()
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  bump() {
    this.version += 1
    for (const listener of this.listeners) listener()
  }

  async load() {
    const saved = await storage.get(LEDGER_KEY)
    if (saved && typeof saved === 'object' && Array.isArray(saved.accounts) && saved.accounts.length > 0) {
      this.accounts = saved.accounts
      this.positions = saved.positions || []
      this.orders = saved.orders || []
      this.cashFlows = saved.cashFlows || []
      this.snapshots = saved.snapshots || []
    } else {
      this.accounts = [seedAccount()]
      await this.commit(this.state())
    }
    this.bump()
  }

  state() {
    return {
      accounts: this.accounts,
      positions: this.positions,
      orders: this.orders,
      cashFlows: this.cashFlows,
      snapshots: this.snapshots,
    }
  }

  /** 原子提交：一次 KV 写入。失败时**不改内存状态**，调用方拿到 false 即整体回滚。 */
  async commit(next) {
    const ok = await storage.set(LEDGER_KEY, next)
    this.storageHealthy = ok
    if (!ok) { this.bump(); return false }
    this.accounts = next.accounts
    this.positions = next.positions
    this.orders = next.orders
    this.cashFlows = next.cashFlows
    this.snapshots = next.snapshots
    this.bump()
    return true
  }

  // —— 账户解析（§13.4 解析纪律：**绝不静默落主账户**）——

  /** 主账户 = 第一个未归档。 */
  primaryAccount() {
    return this.accounts.find((row) => !row.isArchived) || null
  }

  accountByID(id) {
    return this.accounts.find((row) => row.id === id) || null
  }

  /**
   * 层层放宽：精确名 → 币种词 → 模糊子串 → 币种收窄。
   * 对不上时返回 `{ ok:false, candidates }` 让调用方（AI）挑，**不静默落主账户**。
   */
  resolveAccount(query) {
    const active = this.accounts.filter((row) => !row.isArchived)
    if (active.length === 0) return { ok: false, error: 'noAccount', candidates: [] }
    const text = String(query || '').trim()
    if (!text) return { ok: true, account: this.primaryAccount() }

    const byID = active.find((row) => row.id === text)
    if (byID) return { ok: true, account: byID }
    const exact = active.filter((row) => row.name === text)
    if (exact.length === 1) return { ok: true, account: exact[0] }

    const lower = text.toLowerCase()
    const currency = CURRENCY_WORDS.find((row) => row.words.some((word) => lower.includes(word)))
    if (currency) {
      const matched = active.filter((row) => row.currency === currency.code)
      if (matched.length === 1) return { ok: true, account: matched[0] }
      if (matched.length > 1) {
        return { ok: false, error: 'ambiguous', candidates: matched.map(describeAccount) }
      }
    }

    const fuzzy = active.filter((row) => row.name.toLowerCase().includes(lower))
    if (fuzzy.length === 1) return { ok: true, account: fuzzy[0] }
    if (fuzzy.length > 1) return { ok: false, error: 'ambiguous', candidates: fuzzy.map(describeAccount) }
    return { ok: false, error: 'notFound', candidates: active.map(describeAccount) }
  }

  positionsOf(accountID) {
    return this.positions.filter((row) => row.accountID === accountID)
  }

  openPositionsOf(accountID) {
    return this.positionsOf(accountID).filter((row) => row.quantity > 0)
  }

  ordersOf(accountID, limit = 20) {
    return this.orders
      .filter((row) => row.accountID === accountID)
      .sort((a, b) => b.tradedAt - a.tradedAt)
      .slice(0, limit)
  }

  cashFlowsOf(accountID, limit) {
    const rows = this.cashFlows
      .filter((row) => row.accountID === accountID)
      .sort((a, b) => b.occurredAt - a.occurredAt)
    return limit ? rows.slice(0, limit) : rows
  }

  snapshotsOf(accountID) {
    return this.snapshots.filter((row) => row.accountID === accountID).sort((a, b) => a.date - b.date)
  }

  // —— 交易 ——

  async buy({ accountID, symbol, name, market, currency, quantity, price, fxRate: rate, feeMinor, note, source }) {
    if (!this.storageHealthy) return { ok: false, error: 'storageUnavailable' }
    const account = this.accountByID(accountID)
    const position = this.positions.find((row) => row.accountID === accountID && row.instrumentSymbol === symbol) || null
    let result
    try {
      result = applyBuy({
        account, position, symbol, name, market, currency, quantity, price, fxRate: rate, feeMinor, note, source,
      })
    } catch (error) {
      return { ok: false, error: error instanceof MoneyError ? error.code : 'unknown', detail: error.detail }
    }
    const nextPosition = position
      ? { ...result.position }
      : { ...result.position, id: newID('p'), realizedPnlMinor: 0 }
    const next = {
      ...this.state(),
      accounts: this.accounts.map((row) => (row.id === accountID ? result.account : row)),
      positions: position
        ? this.positions.map((row) => (row.id === position.id ? nextPosition : row))
        : [...this.positions, nextPosition],
      orders: [...this.orders, { ...result.order, id: newID('o') }],
    }
    const ok = await this.commit(next)
    return ok ? { ok: true, order: result.order, debitMinor: result.debitMinor } : { ok: false, error: 'storageUnavailable' }
  }

  async sell({ accountID, symbol, quantity, price, fxRate: rate, feeMinor, note, source }) {
    if (!this.storageHealthy) return { ok: false, error: 'storageUnavailable' }
    const account = this.accountByID(accountID)
    const position = this.positions.find((row) => row.accountID === accountID && row.instrumentSymbol === symbol) || null
    let result
    try {
      result = applySell({ account, position, quantity, price, fxRate: rate, feeMinor, note, source })
    } catch (error) {
      return { ok: false, error: error instanceof MoneyError ? error.code : 'unknown', detail: error.detail }
    }
    const next = {
      ...this.state(),
      accounts: this.accounts.map((row) => (row.id === accountID ? result.account : row)),
      positions: this.positions.map((row) => (row.id === position.id ? result.position : row)),
      orders: [...this.orders, { ...result.order, id: newID('o') }],
    }
    const ok = await this.commit(next)
    return ok
      ? { ok: true, order: result.order, proceedsMinor: result.proceedsMinor, realizedDeltaMinor: result.realizedDeltaMinor }
      : { ok: false, error: 'storageUnavailable' }
  }

  async addCashFlow({ accountID, kind, amountMinor, note, source }) {
    if (!this.storageHealthy) return { ok: false, error: 'storageUnavailable' }
    const account = this.accountByID(accountID)
    let result
    try {
      result = applyCashFlow({ account, kind, amountMinor, note, source })
    } catch (error) {
      return { ok: false, error: error instanceof MoneyError ? error.code : 'unknown' }
    }
    const next = {
      ...this.state(),
      accounts: this.accounts.map((row) => (row.id === accountID ? result.account : row)),
      cashFlows: [...this.cashFlows, { ...result.flow, id: newID('c') }],
    }
    const ok = await this.commit(next)
    return ok ? { ok: true, flow: result.flow } : { ok: false, error: 'storageUnavailable' }
  }

  // —— 账户生命周期 ——

  async createAccount({ name, currency = 'CNY', initialCashMinor = 100000000, note = '', isRealCopy = false }) {
    if (!this.storageHealthy) return { ok: false, error: 'storageUnavailable' }
    const account = {
      id: newID('a'),
      name: String(name || '').trim() || 'account.default.name',
      currency,
      initialCashMinor: Math.max(0, Math.trunc(initialCashMinor)),
      cashMinor: Math.max(0, Math.trunc(initialCashMinor)),
      isRealCopy,
      note,
      colorHex: '34C759',
      sortOrder: this.accounts.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1,
      isArchived: false,
      createdAt: Date.now(),
    }
    const ok = await this.commit({ ...this.state(), accounts: [...this.accounts, account] })
    return ok ? { ok: true, account } : { ok: false, error: 'storageUnavailable' }
  }

  async updateAccount(id, patch) {
    if (!this.storageHealthy) return { ok: false, error: 'storageUnavailable' }
    const ok = await this.commit({
      ...this.state(),
      accounts: this.accounts.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    })
    return ok ? { ok: true } : { ok: false, error: 'storageUnavailable' }
  }

  /** 复制账户：只复制身份与初始资金，不复制持仓与成交（原生同）。 */
  async copyAccount(id, name) {
    const source = this.accountByID(id)
    if (!source) return { ok: false, error: 'notFound' }
    return this.createAccount({
      name: name || `${source.name} 2`,
      currency: source.currency,
      initialCashMinor: source.initialCashMinor,
      note: source.note,
      isRealCopy: source.isRealCopy,
    })
  }

  /** 重置：现金回初始，清空该账户的持仓/成交/流水/快照。 */
  async resetAccount(id) {
    const account = this.accountByID(id)
    if (!account) return { ok: false, error: 'notFound' }
    const ok = await this.commit({
      accounts: this.accounts.map((row) => (row.id === id ? { ...row, cashMinor: row.initialCashMinor } : row)),
      positions: this.positions.filter((row) => row.accountID !== id),
      orders: this.orders.filter((row) => row.accountID !== id),
      cashFlows: this.cashFlows.filter((row) => row.accountID !== id),
      snapshots: this.snapshots.filter((row) => row.accountID !== id),
    })
    return ok ? { ok: true } : { ok: false, error: 'storageUnavailable' }
  }

  async deleteAccount(id) {
    if (this.accounts.length <= 1) return { ok: false, error: 'lastAccount' }
    const ok = await this.commit({
      accounts: this.accounts.filter((row) => row.id !== id),
      positions: this.positions.filter((row) => row.accountID !== id),
      orders: this.orders.filter((row) => row.accountID !== id),
      cashFlows: this.cashFlows.filter((row) => row.accountID !== id),
      snapshots: this.snapshots.filter((row) => row.accountID !== id),
    })
    return ok ? { ok: true } : { ok: false, error: 'storageUnavailable' }
  }

  // —— 估值 / 绩效 / 快照 ——

  valuation(accountID, quotes, fxToCNY) {
    const account = this.accountByID(accountID)
    if (!account) return null
    return valueAccount({
      account,
      positions: this.positionsOf(accountID),
      quotes,
      fxToCNY,
      cashFlows: this.cashFlowsOf(accountID),
    })
  }

  performance(accountID) {
    return performance({ orders: this.orders.filter((row) => row.accountID === accountID), snapshots: this.snapshotsOf(accountID) })
  }

  allocation(valuation) {
    return allocation(valuation.rows)
  }

  diagnose(valuation, perf) {
    return diagnose({ valuation, perf })
  }

  fxRateFor(fromCurrency, accountCurrency, fxToCNY) {
    return fxRate(fromCurrency, accountCurrency, fxMapFor(accountCurrency, fxToCNY))
  }

  /** §10.7：**仅当估值完整才写**快照；按天归一，同日覆盖。 */
  async writeSnapshot(valuation, when) {
    const row = snapshotFor(valuation, when)
    if (!row) return { ok: false, error: 'incomplete' }
    const date = startOfDay(when || Date.now())
    const existing = this.snapshots.find((entry) => entry.accountID === row.accountID && entry.date === date)
    const next = existing
      ? this.snapshots.map((entry) => (entry === existing ? { ...row, id: existing.id } : entry))
      : [...this.snapshots, { ...row, id: newID('s') }]
    const ok = await this.commit({ ...this.state(), snapshots: next })
    return ok ? { ok: true } : { ok: false, error: 'storageUnavailable' }
  }

  /** 账户归档 JSON（导出/导入用）。 */
  archiveFor(accountID) {
    const account = this.accountByID(accountID)
    if (!account) return null
    return {
      schema: 'finance.account.archive.v1',
      exportedAt: new Date().toISOString(),
      account,
      positions: this.positionsOf(accountID),
      orders: this.orders.filter((row) => row.accountID === accountID),
      cashFlows: this.cashFlows.filter((row) => row.accountID === accountID),
      snapshots: this.snapshotsOf(accountID),
    }
  }
}

const CURRENCY_WORDS = [
  { code: 'USD', words: ['美元', '美金', '美股', 'usd'] },
  { code: 'HKD', words: ['港币', '港元', '港股', 'hkd'] },
  { code: 'CNY', words: ['人民币', 'rmb', 'a股', '沪深', 'cny'] },
]

export function describeAccount(account) {
  return { id: account.id, name: account.name, currency: account.currency }
}
