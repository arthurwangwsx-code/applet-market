// 持久化与自选（规格 §9.3 的 FinInstrument / FinWatchGroup / FinWatchItem + 设置）。
//
// **事务口径**：容器给的是 per-applet KV，没有 SQL 事务。这里的做法是
// 「纯函数算出新状态 → **单 key 一次写入**」——KV 的单键写入是原子的，
// 所以「余额变更 + 流水写入」要么全成要么全不成（账目在同一个 key 里）。
// 见 lib/ledger.js。存储不健康时所有写操作被拒并返回错误（§1 全局横幅）。

import { storage } from './host.js'
import { resolveSymbol } from './symbol.js'

export const KEYS = {
  watch: 'finance.watch.v1',
  settings: 'finance.settings.v1',
  quotes: 'finance.quotes.v1',
  recent: 'finance.recentSearches',
  alerts: 'finance.alerts.v1',
  industry: 'finance.industry.v1',
}

export const RECENT_LIMIT = 12
const QUOTE_SNAPSHOT_LIMIT = 200      // 磁盘快照只留最近 200 条行情
const QUOTE_WRITE_THROTTLE_MS = 20000

/** 首启种子 4 组（规格 §9.3）。 */
export const SEED_GROUPS = [
  { id: 'group.ashare', name: 'group.ashare', sortOrder: 0, isDefault: true },
  { id: 'group.hk', name: 'group.hk', sortOrder: 1, isDefault: false },
  { id: 'group.us', name: 'group.us', sortOrder: 2, isDefault: false },
  { id: 'group.fund', name: 'group.fund', sortOrder: 3, isDefault: false },
]

export const DEFAULT_SETTINGS = {
  upIsRed: true,                 // 默认红涨绿跌
  autoRefresh: true,
  refreshInterval: 30,
  quoteSource: 'automatic',      // automatic | tencent | sina
  industryAutoRefresh: false,    // 默认**关**
  notifyAlerts: false,
}

/** 热门段的 8 个策展种子（固定，海外 IP 也稳）。 */
export const HOT_SEEDS = [
  { symbol: 'sh600519', name: '贵州茅台' },
  { symbol: 'sz300750', name: '宁德时代' },
  { symbol: 'sz002594', name: '比亚迪' },
  { symbol: 'hk00700', name: '腾讯控股' },
  { symbol: 'hk09988', name: '阿里巴巴' },
  { symbol: 'usAAPL', name: 'Apple' },
  { symbol: 'usNVDA', name: 'NVIDIA' },
  { symbol: 'usTSLA', name: 'Tesla' },
]

let counter = 0
export function newID(prefix) {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

export class FinanceStore {
  constructor() {
    this.groups = SEED_GROUPS.map((row) => ({ ...row }))
    this.items = []               // { id, instrumentSymbol, groupID, sortOrder, addedAt }
    this.instruments = {}         // canonical → { name, market, currency, kind, updatedAt }
    this.settings = { ...DEFAULT_SETTINGS }
    this.recent = []
    this.alerts = []
    this.version = 0
    this.storageHealthy = true
    this.listeners = new Set()
    this.lastQuoteWriteAt = 0
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
    const [watch, settings, recent, alerts] = await Promise.all([
      storage.get(KEYS.watch), storage.get(KEYS.settings), storage.get(KEYS.recent), storage.get(KEYS.alerts),
    ])
    if (watch && typeof watch === 'object') {
      if (Array.isArray(watch.groups) && watch.groups.length > 0) this.groups = watch.groups
      if (Array.isArray(watch.items)) this.items = watch.items
      if (watch.instruments && typeof watch.instruments === 'object') this.instruments = watch.instruments
    }
    if (settings && typeof settings === 'object') this.settings = { ...DEFAULT_SETTINGS, ...settings }
    if (Array.isArray(recent)) this.recent = recent.slice(0, RECENT_LIMIT)
    if (Array.isArray(alerts)) this.alerts = alerts
    this.bump()
  }

  async persistWatch() {
    const ok = await storage.set(KEYS.watch, {
      groups: this.groups, items: this.items, instruments: this.instruments,
    })
    this.storageHealthy = ok
    if (!ok) this.bump()
    return ok
  }

  async updateSettings(patch) {
    this.settings = { ...this.settings, ...patch }
    this.bump()
    const ok = await storage.set(KEYS.settings, this.settings)
    this.storageHealthy = ok
    return ok
  }

  // —— 自选 ——

  /** 当前可见（按分组过滤后的）自选，含排序。 */
  itemsInGroup(groupID) {
    const rows = groupID ? this.items.filter((row) => row.groupID === groupID) : this.items.slice()
    return rows.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  isWatched(canonical) {
    return this.items.some((row) => row.instrumentSymbol === canonical)
  }

  instrumentName(canonical) {
    const meta = this.instruments[canonical]
    return meta && meta.name ? meta.name : canonical
  }

  /** 回写标的名字到本地元数据（拉到行情后调用）。 */
  noteInstrument(canonical, { name, market, currency, kind }) {
    const current = this.instruments[canonical] || {}
    if (name && current.name === name && current.market === market) return
    this.instruments[canonical] = {
      ...current,
      name: name || current.name || canonical,
      market: market || current.market || null,
      currency: currency || current.currency || null,
      kind: kind || current.kind || 'stock',
      updatedAt: Date.now(),
    }
    this.persistWatch()
  }

  /**
   * 加自选：优先落到**与标的市场同名的种子分组**（`group.<market>`），找不到落默认组；
   * `sortOrder = 全局 max + 1`；同 symbol **幂等**（已存在直接返回）。
   */
  async addWatch(canonical, { name, groupID } = {}) {
    if (!this.storageHealthy) return { ok: false, error: 'storageUnavailable' }
    if (this.isWatched(canonical)) return { ok: true, existed: true }
    const symbol = resolveSymbol(canonical)
    const preferred = groupID
      || (symbol && this.groups.find((row) => row.id === `group.${symbol.market}`)?.id)
      || (this.groups.find((row) => row.isDefault) || this.groups[0] || {}).id
      || null
    const maxOrder = this.items.reduce((max, row) => Math.max(max, row.sortOrder), -1)
    this.items = [...this.items, {
      id: newID('w'),
      instrumentSymbol: canonical,
      groupID: preferred,
      sortOrder: maxOrder + 1,
      addedAt: Date.now(),
    }]
    if (name) {
      this.instruments[canonical] = {
        ...(this.instruments[canonical] || {}),
        name,
        market: symbol ? symbol.market : null,
        updatedAt: Date.now(),
      }
    }
    this.bump()
    const ok = await this.persistWatch()
    return ok ? { ok: true } : { ok: false, error: 'storageUnavailable' }
  }

  async removeWatch(canonical) {
    if (!this.storageHealthy) return { ok: false, error: 'storageUnavailable' }
    this.items = this.items.filter((row) => row.instrumentSymbol !== canonical)
    this.bump()
    await this.persistWatch()
    return { ok: true }
  }

  /** 拖拽重排：只在手动排序 + 编辑态下由 UI 调用。 */
  async reorderWatch(canonicals) {
    const order = new Map(canonicals.map((canonical, index) => [canonical, index]))
    this.items = this.items.map((row) => (
      order.has(row.instrumentSymbol) ? { ...row, sortOrder: order.get(row.instrumentSymbol) } : row
    ))
    this.bump()
    await this.persistWatch()
  }

  async moveWatch(canonical, groupID) {
    this.items = this.items.map((row) => (
      row.instrumentSymbol === canonical ? { ...row, groupID } : row
    ))
    this.bump()
    await this.persistWatch()
    return { ok: true }
  }

  // —— 分组 ——

  async createGroup(name) {
    if (!name) return { ok: false, error: 'invalidName' }
    if (this.groups.some((row) => row.name === name)) return { ok: false, error: 'duplicate' }
    const sortOrder = this.groups.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1
    this.groups = [...this.groups, { id: newID('g'), name, sortOrder, isDefault: false }]
    this.bump()
    await this.persistWatch()
    return { ok: true }
  }

  async renameGroup(id, name) {
    this.groups = this.groups.map((row) => (row.id === id ? { ...row, name } : row))
    this.bump()
    await this.persistWatch()
    return { ok: true }
  }

  /** 删组：组内条目落回默认组（不连坐删自选）。 */
  async deleteGroup(id) {
    const fallback = (this.groups.find((row) => row.isDefault && row.id !== id) || this.groups.find((row) => row.id !== id) || {}).id || null
    this.groups = this.groups.filter((row) => row.id !== id)
    this.items = this.items.map((row) => (row.groupID === id ? { ...row, groupID: fallback } : row))
    this.bump()
    await this.persistWatch()
    return { ok: true }
  }

  // —— 历史搜索 ——
  //
  // **打开详情时才记入**（不是敲键或点加自选时）；上限 12，去重置顶。

  async noteRecent(canonical) {
    this.recent = [canonical, ...this.recent.filter((row) => row !== canonical)].slice(0, RECENT_LIMIT)
    this.bump()
    await storage.set(KEYS.recent, this.recent)
  }

  async clearRecent() {
    this.recent = []
    this.bump()
    await storage.set(KEYS.recent, [])
  }

  // —— 行情磁盘快照（节流 20s，退出时强制写，只留最近 200 条）——

  async persistQuotes(snapshot, lastUpdated, { force = false } = {}) {
    const now = Date.now()
    if (!force && now - this.lastQuoteWriteAt < QUOTE_WRITE_THROTTLE_MS) return false
    this.lastQuoteWriteAt = now
    const entries = Object.entries(snapshot)
      .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
      .slice(0, QUOTE_SNAPSHOT_LIMIT)
    const rows = {}
    for (const [canonical, entry] of entries) rows[canonical] = entry
    return storage.set(KEYS.quotes, { rows, lastUpdated })
  }

  async loadQuotes() {
    const saved = await storage.get(KEYS.quotes)
    if (!saved || typeof saved !== 'object') return null
    return { rows: saved.rows || {}, lastUpdated: saved.lastUpdated || null }
  }

  // —— 行业页磁盘快照（stale-while-revalidate 的「先显缓存」半程）——

  async persistIndustry(segment, payload) {
    const saved = (await storage.get(KEYS.industry)) || {}
    saved[segment] = { payload, at: Date.now() }
    return storage.set(KEYS.industry, saved)
  }

  async loadIndustry(segment) {
    const saved = await storage.get(KEYS.industry)
    if (!saved || !saved[segment]) return null
    return saved[segment]
  }
}
