import type { Ledger } from './ledger.js'
import type { QuoteService } from './quotes.js'
import type { FinanceStore } from './store.js'
import type { AlertStore } from './alerts.js'

export type Market = 'ashare' | 'hk' | 'us' | 'fund'
export type Currency = 'CNY' | 'RMB' | 'HKD' | 'USD' | 'EUR' | 'GBP' | 'JPY' | string
export type QuoteSource = 'automatic' | 'tencent' | 'sina'
export type Trend = 'up' | 'down' | 'flat'
export type Translate = (key: string, ...args: Array<string | number>) => string

export interface FinSymbol {
  market: Market
  code: string
  exchange: string | null
}

export interface Quote {
  symbol: string
  name: string
  market: Market
  currency: Currency
  kind?: string
  price: number
  prevClose: number
  open?: number
  high?: number
  low?: number
  change?: number
  changePct?: number
  volume?: number
  amount?: number | null
  turnover?: number | null
  pe?: number | null
  pb?: number | null
  marketCap?: number | null
  amplitude?: number | null
  bids?: PriceLevel[]
  asks?: PriceLevel[]
  time?: string
  isEstimate?: boolean
  navDate?: string
  timestamp?: number
  source?: string
}

export interface PriceLevel {
  price: number
  volume: number
}

export interface Candle {
  timestamp?: number
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount?: number
}

export interface QuoteEntry {
  quote: Quote
  at: number
}
export type QuoteMap = Record<string, Quote | null>
export type QuoteSnapshot = Record<string, QuoteEntry>
export type FXMap = Record<string, number>

export interface WatchGroup {
  id: string
  name: string
  sortOrder: number
  isDefault: boolean
}

export interface WatchItem {
  id: string
  instrumentSymbol: string
  groupID: string | null
  sortOrder: number
  addedAt: number
}

export interface InstrumentMeta {
  name: string
  market: Market | null
  currency?: Currency | null
  kind?: string
  updatedAt: number
}

export interface FinanceSettings {
  upIsRed: boolean
  autoRefresh: boolean
  refreshInterval: number
  quoteSource: QuoteSource
  industryAutoRefresh: boolean
  notifyAlerts: boolean
}

export type AlertCondition = 'above' | 'below' | 'up_pct' | 'down_pct'
export interface PriceAlert {
  id: string
  instrumentSymbol: string
  name: string
  conditionRaw: AlertCondition
  targetPrice: number
  enabled: boolean
  note: string
  createdAt: number
  lastFiredAt: number | null
}

export interface IndustrySnapshot<T = unknown> {
  payload: T
  at: number
}

export interface Account {
  id: string
  name: string
  currency: Currency
  initialCashMinor: number
  cashMinor: number
  isRealCopy: boolean
  note: string
  colorHex: string
  sortOrder: number
  isArchived: boolean
  createdAt: number
}

export interface Position {
  id?: string
  accountID: string
  instrumentSymbol: string
  name: string
  marketRaw: Market | null
  currency: Currency
  quantity: number
  avgCost: number
  realizedPnlMinor: number
  updatedAt: number
}

export type TradeSide = 'buy' | 'sell'
export interface TradeOrder {
  id?: string
  accountID: string
  instrumentSymbol: string
  name: string
  sideRaw: TradeSide
  quantity: number
  price: number
  grossMinor: number
  feeMinor: number
  currency: Currency
  fxRate: number
  tradedAt: number
  note: string
  source: string
}

export type CashFlowKind = 'deposit' | 'withdrawal' | 'dividend' | 'interest' | 'tax' | 'fee' | 'adjustment'
export interface CashFlow {
  id?: string
  accountID: string
  kindRaw: CashFlowKind
  amountMinor: number
  currency: Currency
  occurredAt: number
  note: string
  source: string
}

export interface AccountSnapshot {
  id?: string
  accountID: string
  date: number
  totalValueMinor: number
  cashMinor?: number
  marketValueMinor?: number
  totalPnlMinor?: number
}

export interface LedgerState {
  accounts: Account[]
  positions: Position[]
  orders: TradeOrder[]
  cashFlows: CashFlow[]
  snapshots: AccountSnapshot[]
}

export interface PositionValuation {
  position: Position
  priced: boolean
  marketValueMinor: number
  costMinor: number
  unrealizedMinor: number
  unrealizedPct: number
  dayMinor: number
  missingQuote: boolean
  missingFX: boolean
}

export interface AccountValuation {
  account: Account
  rows: PositionValuation[]
  cashMinor: number
  marketValueMinor: number
  costMinor: number
  unrealizedMinor: number
  dayMinor: number
  realizedMinor: number
  totalMinor: number
  externalCashFlowMinor: number
  totalPnlMinor: number
  returnRate: number
  missingQuotes: string[]
  missingFX: string[]
  isComplete: boolean
}

export interface PerformanceResult {
  closed: number
  wins: number
  winRate: number
  hasEnoughData: boolean
  totalReturn: number
  annualized: number
  maxDrawdown: number
  volatility: number
  sharpe: number
}

export interface AllocationRow {
  market: string
  marketValueMinor: number
  ratio: number
}

export interface SearchItem {
  symbol: string
  code: string
  name: string
  market: Market
  currency?: Currency
  kind?: string
  exchange?: string | null
  price?: number
  changePct?: number
}

export type CandlePeriod = 'day' | 'week' | 'month' | '5m' | '15m' | '30m' | '60m'

export interface DetailRoute {
  name: 'detail'
  canonical: string
  symbol: FinSymbol
  title: string
}

export interface InstrumentPanelRoute {
  canonical: string
  symbol: FinSymbol
  name: string
}

export interface AISession {
  identity: string
  symbolName?: string
}

export interface FinanceActions {
  navigate: (route: DetailRoute) => void
  back: () => void
  refresh: (force: boolean) => Promise<void>
  openDetail: (canonical: string) => void
  openSearch: () => void
  openAccounts: () => void
  openCashFlow: () => void
  openHistory: () => void
  openGroups: () => void
  openTrade: (canonical: string, symbol: FinSymbol, name: string) => void
  openAlert: (canonical: string, symbol: FinSymbol, name: string) => void
  openStrategy: (canonical: string, symbol: FinSymbol, name: string) => void
  selectAccount: (accountID: string) => void
  toggleWatch: (canonical: string, name?: string) => Promise<unknown>
  removeWatch: (canonical: string) => Promise<unknown>
  askAI: (input: { identity: string; seed: string }) => Promise<void>
  askAboutSymbol: (canonical: string, name: string, quote: Quote | null) => void
}

export interface FinanceContext {
  t: Translate
  locale: string
  store: FinanceStore
  ledger: Ledger
  quotes: QuoteService
  alerts: AlertStore
  settings: FinanceSettings
  accountID: string | null
  valuation: AccountValuation | null
  perf: PerformanceResult | null
  hasAI: boolean
  refreshing: boolean
  quoteVersion: number | null
  actions: FinanceActions
}
