// `finance_*` 工具的执行侧（规格 §13.4）。声明真值在 lib/tool-defs.js。
//
// **必须能在无 UI 状态下工作**：行情抓取、解析、估值、指标全在 lib/ 的纯函数里，
// UI 与 action 共用同一份——所以这里只做「参数归一 → 调 lib → 组织 JSON 结果」。
//
// 解析纪律（做错会让 AI 记错账户 / 查错标的）：
//  · 账户名对不上 → **返回候选清单**，绝不静默落主账户；
//  · 标的多条命中 → 返回前 8 个候选 `"名字 [代码]"` 让模型挑；名称类输入必须先 strict 判空再走搜索。

import { formatPercent, formatPrice, isoDate } from './format.js'
import { boll, kdj, macd, sma } from './indicators.js'
import { rebalance as proposeRebalance, backtest, dcaPlan } from './strategy.js'
import { fxMapFor } from './portfolio.js'
import { canonicalOf, decimalsFor, parseStrict, parseSymbol, resolveSymbol, secid } from './symbol.js'
import * as tencent from './providers/tencent.js'
import * as fundProvider from './providers/fund.js'
import * as eastmoney from './providers/eastmoney.js'
import * as push2 from './providers/push2.js'
import * as sina from './providers/sina.js'
import { registerAction } from './host.js'
import { createWriteHandlers } from './tools-write.js'
import { TOOL_DEFS } from './tool-defs.js'
import type { ActionInput, ActionName, JSONValue } from '@aibox/applet-sdk'
import type { AlertStore } from './alerts.js'
import type { AccountResolution, Ledger } from './ledger.js'
import type { QuoteService } from './quotes.js'
import type { FinanceStore } from './store.js'
import type { Account, AccountValuation, FinSymbol, Market, Quote, SearchItem } from './types.js'

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.round(number)))
}

/** 联合搜索：股票/场内基金走腾讯联想，场外基金走本地目录。按 canonical 去重。 */
async function searchAll(query: string, market?: Market): Promise<SearchItem[]> {
  const [listed, funds] = await Promise.all([tencent.search(query), fundProvider.search(query, 20)])
  const seen = new Set<string>()
  const out: SearchItem[] = []
  for (const row of [...listed, ...funds]) {
    if (seen.has(row.symbol)) continue
    if (market && row.market !== market) continue
    seen.add(row.symbol)
    out.push(row)
  }
  return out
}

/**
 * 标的解析。写路径用 `strict: true`：多条命中时返回候选让模型挑，绝不猜。
 * `"Tesla"` 这种全字母名称先被 parseStrict 判空 → 走搜索，不会造出假代码 usTESLA。
 */
export type InstrumentResolution =
  | { ok: true; symbol: FinSymbol; canonical: string; name?: string }
  | { ok: false; error: string; candidates?: string[] }

async function resolveInstrument(
  input: unknown,
  { strict = false }: { strict?: boolean } = {},
): Promise<InstrumentResolution> {
  const text = String(input || '').trim()
  if (!text) return { ok: false, error: 'symbol is required' }
  const exact = parseStrict(text)
  if (exact) return { ok: true, symbol: exact, canonical: canonicalOf(exact) }

  const hits = await searchAll(text)
  const byCode = hits.filter((row) => row.symbol.toLowerCase() === text.toLowerCase() || row.code === text)
  const codeHit = byCode.length === 1 ? byCode[0] : undefined
  if (codeHit) {
    const symbol = resolveSymbol(codeHit.symbol)
    if (symbol) return { ok: true, symbol, canonical: codeHit.symbol, name: codeHit.name }
  }
  const byName = hits.filter((row) => row.name === text)
  const nameHit = byName.length === 1 ? byName[0] : undefined
  if (nameHit) {
    const symbol = resolveSymbol(nameHit.symbol)
    if (symbol) return { ok: true, symbol, canonical: nameHit.symbol, name: nameHit.name }
  }
  const onlyHit = hits.length === 1 ? hits[0] : undefined
  if (onlyHit) {
    const symbol = resolveSymbol(onlyHit.symbol)
    if (symbol) return { ok: true, symbol, canonical: onlyHit.symbol, name: onlyHit.name }
  }
  if (hits.length === 0) {
    const loose = parseSymbol(text)
    if (loose) return { ok: true, symbol: loose, canonical: canonicalOf(loose) }
    return { ok: false, error: `No instrument matched "${text}".` }
  }
  if (!strict) {
    const firstHit = hits[0]
    const symbol = firstHit ? resolveSymbol(firstHit.symbol) : null
    if (firstHit && symbol) return { ok: true, symbol, canonical: firstHit.symbol, name: firstHit.name }
  }
  return {
    ok: false,
    error: `"${text}" matched several instruments — ask the user which one, then call again with its code.`,
    candidates: hits.slice(0, 8).map((row) => `${row.name} [${row.symbol}]`),
  }
}

export function quoteJSON(quote: Quote | null | undefined, canonical: string) {
  if (!quote) return { symbol: canonical, available: false, note: 'No quote available; nothing is guessed.' }
  const decimals = decimalsFor(quote.market)
  return {
    symbol: quote.symbol,
    name: quote.name,
    market: quote.market,
    currency: quote.currency,
    price: Number(formatPrice(quote.price, decimals)),
    prevClose: quote.prevClose,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    change: quote.change,
    changePct: quote.changePct,
    volume: quote.volume,
    amount: quote.amount,
    turnover: quote.turnover,
    pe: quote.pe,
    pb: quote.pb,
    marketCapYi: quote.marketCap,
    amplitude: quote.amplitude,
    quoteTime: quote.time,
    isEstimate: quote.isEstimate,
    source: quote.source,
  }
}

/**
 * 创建全部 handler。`deps` = { store, ledger, quotes, alerts, refreshAll }。
 * 每个 handler 返回 JSON 可序列化对象；失败返回 `{ ok:false, error }` 而不是抛。
 */
export interface ToolDependencies {
  store: FinanceStore
  ledger: Ledger
  quotes: QuoteService
  alerts: AlertStore
  refreshAll?: (options?: { force?: boolean }) => Promise<unknown>
}

export type ToolAccountResolution =
  | { ok: true; account: Account }
  | { ok: false; error: string; accounts: Array<{ id: string; name: string; currency: string }> }

export function createToolHandlers(deps: ToolDependencies) {
  const { store, ledger, quotes, alerts } = deps

  /** 账户解析：对不上返回候选清单。 */
  const account = (name?: unknown): ToolAccountResolution => {
    const result = ledger.resolveAccount(name)
    if (result.ok && result.account) return { ok: true, account: result.account }
    if (result.ok) return { ok: false, error: 'No paper account exists yet.', accounts: [] }
    return {
      ok: false,
      error:
        result.error === 'noAccount'
          ? 'No paper account exists yet.'
          : `Account "${name}" did not match. Ask the user which account, then call again.`,
      accounts: result.candidates,
    }
  }

  const valuationFor = async (
    accountID: string,
    { force = false }: { force?: boolean } = {},
  ): Promise<AccountValuation | null> => {
    const positions = ledger.openPositionsOf(accountID)
    const symbols = positions.map((row) => row.instrumentSymbol)
    if (symbols.length > 0) await quotes.refresh(symbols, { force })
    await quotes.exchangeRates({ force })
    return ledger.valuation(accountID, quotes.quoteMap(), quotes.fx)
  }

  const readHandlers = {
    async finance_quote(args: ActionInput<'finance_quote'>) {
      const inputs =
        Array.isArray(args.symbols) && args.symbols.length > 0 ? args.symbols : args.symbol ? [args.symbol] : []
      if (inputs.length === 0) return { ok: false, error: 'Provide symbols[] or symbol.' }
      const resolved = []
      for (const input of inputs.slice(0, 20)) {
        const row = await resolveInstrument(input)
        if (row.ok) resolved.push(row)
      }
      if (resolved.length === 0) return { ok: false, error: 'No symbol could be resolved.' }
      const result = await quotes.refresh(
        resolved.map((row) => row.canonical),
        { force: !!args.force },
      )
      for (const row of resolved) {
        const quote = result.quotes[row.canonical]
        if (quote) store.noteInstrument(row.canonical, quote)
      }
      return {
        ok: true,
        quotes: resolved.map((row) => quoteJSON(result.quotes[row.canonical], row.canonical)),
        missing: result.missing,
        refreshFailed: result.failed,
      }
    },
    async finance_search(args: ActionInput<'finance_search'>) {
      const query = String(args.query || '').trim()
      if (!query) return { ok: false, error: 'query is required.' }
      const hits = await searchAll(query, args.market)
      const limit = clamp(args.limit, 1, 15, 15)
      const catalog = fundProvider.catalogState()
      const notes = []
      if (hits.length === 0) notes.push('No match. The stock search endpoint may be unreachable from this network.')
      // 目录被 maxBytes 截断时**必须说出来**：半截目录会让基金搜索静默漏结果。
      if (catalog.truncated) notes.push('The fund catalog response was truncated, so fund results may be incomplete.')
      return {
        ok: true,
        results: hits
          .slice(0, limit)
          .map((row) => ({ symbol: row.symbol, name: row.name, market: row.market, code: row.code })),
        note: notes.length > 0 ? notes.join(' ') : undefined,
      }
    },
    async finance_chart(args: ActionInput<'finance_chart'>) {
      const resolved = await resolveInstrument(args.symbol)
      if (!resolved.ok) return resolved
      const period = args.period || 'day'
      const adjust = args.adjust === 'hfq' ? 'hfq' : 'qfq'
      const count = clamp(args.count, 1, 800, 120)
      const rows = await quotes.candles(resolved.symbol, period, adjust, count, { force: false })
      if (rows.length === 0) return { ok: false, error: 'No candles available for this symbol/period.' }

      const closes = rows.map((row) => row.close)
      const last = rows.at(-1)
      const first = rows[0]
      if (!first || !last) return { ok: false, error: 'No candles available for this symbol/period.' }
      const summary = {
        symbol: resolved.canonical,
        period,
        adjust,
        candles: rows.length,
        from: first.date,
        to: last.date,
        windowChangePct: first.close > 0 ? ((last.close - first.close) / first.close) * 100 : 0,
        latest: {
          date: last.date,
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
          volume: last.volume,
        },
        ma5: sma(closes, 5).pop(),
        ma10: sma(closes, 10).pop(),
        ma20: sma(closes, 20).pop(),
      }
      const wanted = Array.isArray(args.indicators) ? args.indicators : []
      const indicators: Record<string, JSONValue> = {}
      if (wanted.includes('macd')) {
        const result = macd(closes)
        indicators.macd = {
          dif: result.dif.at(-1) ?? null,
          dea: result.dea.at(-1) ?? null,
          hist: result.hist.at(-1) ?? null,
        }
      }
      if (wanted.includes('kdj')) {
        const result = kdj(rows)
        indicators.kdj = { k: result.k.at(-1) ?? null, d: result.d.at(-1) ?? null, j: result.j.at(-1) ?? null }
      }
      if (wanted.includes('boll')) {
        const result = boll(closes, 20, 2)
        indicators.boll = {
          mid: result.mid.at(-1) ?? null,
          upper: result.upper.at(-1) ?? null,
          lower: result.lower.at(-1) ?? null,
        }
      }
      return { ok: true, summary, indicators, series: rows.slice(-60) }
    },
    async finance_portfolio(args: ActionInput<'finance_portfolio'>) {
      const resolved = account(args.account)
      if (!resolved.ok) return resolved
      if (args.action === 'history') {
        const limit = clamp(args.limit, 1, 100, 20)
        return {
          ok: true,
          account: resolved.account.name,
          trades: ledger.ordersOf(resolved.account.id, limit).map((row) => ({
            side: row.sideRaw,
            symbol: row.instrumentSymbol,
            name: row.name,
            quantity: row.quantity,
            price: row.price,
            currency: row.currency,
            feeMinor: row.feeMinor,
            fxRate: row.fxRate,
            tradedAt: isoDate(row.tradedAt),
          })),
        }
      }
      const valuation = await valuationFor(resolved.account.id)
      if (!valuation) return { ok: false, error: 'Account not found.' }
      // 顺带写今日快照（估值不完整时 writeSnapshot 自己会拒绝）。
      await ledger.writeSnapshot(valuation)
      return {
        ok: true,
        account: resolved.account.name,
        currency: resolved.account.currency,
        totalMinor: valuation.totalMinor,
        cashMinor: valuation.cashMinor,
        marketValueMinor: valuation.marketValueMinor,
        unrealizedMinor: valuation.unrealizedMinor,
        realizedMinor: valuation.realizedMinor,
        dayMinor: valuation.dayMinor,
        totalPnlMinor: valuation.totalPnlMinor,
        returnRate: valuation.returnRate,
        isComplete: valuation.isComplete,
        missingQuotes: valuation.missingQuotes,
        missingFX: valuation.missingFX,
        holdings: valuation.rows.map((row) => ({
          symbol: row.position.instrumentSymbol,
          name: row.position.name,
          quantity: row.position.quantity,
          avgCost: row.position.avgCost,
          currency: row.position.currency,
          priced: row.priced,
          marketValueMinor: row.marketValueMinor,
          unrealizedMinor: row.unrealizedMinor,
          unrealizedPct: row.unrealizedPct,
          dayMinor: row.dayMinor,
        })),
      }
    },
    async finance_financials(args: ActionInput<'finance_financials'>) {
      const resolved = await resolveInstrument(args.symbol)
      if (!resolved.ok) return resolved
      const rows = await eastmoney.fetchFinancials(resolved.symbol)
      await quotes.refresh([resolved.canonical], { force: false })
      const quote = quotes.quote(resolved.canonical)
      if (rows.length === 0) {
        return {
          ok: false,
          error: 'No financial report is available for this instrument (banks and insurers often have none).',
        }
      }
      return {
        ok: true,
        symbol: resolved.canonical,
        periods: rows,
        pe: quote ? quote.pe : null,
        pb: quote ? quote.pb : null,
      }
    },
    async finance_dividend(args: ActionInput<'finance_dividend'>) {
      const resolved = await resolveInstrument(args.symbol)
      if (!resolved.ok) return resolved
      if (resolved.symbol.market !== 'ashare') return { ok: false, error: 'Dividends are A-shares only.' }
      const rows = await eastmoney.fetchDividends(resolved.symbol)
      return { ok: true, symbol: resolved.canonical, dividends: rows }
    },
    async finance_fundflow(args: ActionInput<'finance_fundflow'>) {
      const resolved = await resolveInstrument(args.symbol)
      if (!resolved.ok) return resolved
      if (resolved.symbol.market !== 'ashare') return { ok: false, error: 'Fund flow is A-shares only.' }
      const days = clamp(args.days, 1, 60, 10)
      const rows = await push2.fetchFundFlow(secid(resolved.symbol), days)
      if (rows.length === 0)
        return { ok: false, error: 'No fund-flow data; this endpoint needs a mainland-China network connection.' }
      return { ok: true, symbol: resolved.canonical, days: rows.slice(-days) }
    },
    async finance_perf(args: ActionInput<'finance_perf'>) {
      const resolved = account(args.account)
      if (!resolved.ok) return resolved
      const valuation = await valuationFor(resolved.account.id, { force: true })
      if (!valuation) return { ok: false, error: 'Account not found.' }
      await ledger.writeSnapshot(valuation)
      const perf = ledger.performance(resolved.account.id)
      return { ok: true, account: resolved.account.name, isComplete: valuation.isComplete, ...perf }
    },
    async finance_diagnose(args: ActionInput<'finance_diagnose'>) {
      const resolved = account(args.account)
      if (!resolved.ok) return resolved
      const valuation = await valuationFor(resolved.account.id)
      if (!valuation) return { ok: false, error: 'Account not found.' }
      if (!valuation.isComplete) {
        return {
          ok: false,
          error: 'Diagnosis is paused until all quotes and exchange rates are available.',
          missingQuotes: valuation.missingQuotes,
          missingFX: valuation.missingFX,
        }
      }
      const perf = ledger.performance(resolved.account.id)
      const diagnosis = ledger.diagnose(valuation, perf)
      return {
        ok: true,
        account: resolved.account.name,
        score: diagnosis.score,
        cashPct: diagnosis.cashPct,
        hhi: diagnosis.hhi,
        topWeight: diagnosis.topWeight,
        flags: diagnosis.flags,
        topContributor: diagnosis.contributor ? diagnosis.contributor.position.name : null,
        topDetractor: diagnosis.detractor ? diagnosis.detractor.position.name : null,
      }
    },
    async finance_sector(args: ActionInput<'finance_sector'>) {
      const limit = clamp(args.limit, 1, 40, 12)
      if (args.action === 'constituents') {
        if (!args.code) return { ok: false, error: 'code (BKxxxx) is required for constituents.' }
        const rows = await push2.fetchConstituents(args.code, limit)
        return rows.length > 0 ? { ok: true, constituents: rows } : { ok: false, error: CHINA_NETWORK }
      }
      const kind = args.action === 'concept' ? 'concept' : 'industry'
      const rows = await push2.fetchSectors({ kind, sort: args.sort === 'moneyflow' ? 'moneyflow' : 'change', limit })
      return rows.length > 0 ? { ok: true, kind, sectors: rows } : { ok: false, error: CHINA_NETWORK }
    },
    async finance_moneyrank(args: ActionInput<'finance_moneyrank'>) {
      const rows = await push2.fetchMoneyRank({
        inflow: args.direction !== 'outflow',
        limit: clamp(args.limit, 1, 30, 12),
      })
      return rows.length > 0 ? { ok: true, rows } : { ok: false, error: CHINA_NETWORK }
    },
    async finance_dragon(args: ActionInput<'finance_dragon'>) {
      const rows = await eastmoney.fetchDragonBoard(clamp(args.limit, 1, 30, 12))
      return rows.length > 0
        ? { ok: true, tradeDate: rows[0]?.tradeDate, rows }
        : { ok: false, error: 'No Dragon-Tiger data available.' }
    },
    async finance_sentiment() {
      const breadth = await push2.fetchBreadth(Date.now())
      return breadth ? { ok: true, ...breadth } : { ok: false, error: CHINA_NETWORK }
    },
    async finance_screener(args: ActionInput<'finance_screener'>) {
      const universe = await push2.fetchScreenerUniverse(400)
      if (universe.length === 0) return { ok: false, error: CHINA_NETWORK }
      let rows = universe
      if (Number.isFinite(Number(args.peMin))) rows = rows.filter((row) => row.pe >= Number(args.peMin))
      if (Number.isFinite(Number(args.peMax))) rows = rows.filter((row) => row.pe > 0 && row.pe <= Number(args.peMax))
      if (Number.isFinite(Number(args.pbMax))) rows = rows.filter((row) => row.pb > 0 && row.pb <= Number(args.pbMax))
      if (Number.isFinite(Number(args.changeMin))) rows = rows.filter((row) => row.changePct >= Number(args.changeMin))
      if (Number.isFinite(Number(args.changeMax))) rows = rows.filter((row) => row.changePct <= Number(args.changeMax))
      if (Number.isFinite(Number(args.mktcapMinYi)))
        rows = rows.filter((row) => row.marketCapYi >= Number(args.mktcapMinYi))
      if (args.industry) rows = rows.filter((row) => row.industry.includes(String(args.industry)))
      const field = {
        change: 'changePct',
        moneyflow: 'mainNet',
        turnover: 'turnover',
        pe: 'pe',
        marketcap: 'marketCapYi',
      }[args.sortBy || 'change'] as 'changePct' | 'mainNet' | 'turnover' | 'pe' | 'marketCapYi'
      const ascending = args.order ? args.order === 'asc' : args.sortBy === 'pe'
      rows = rows.slice().sort((a, b) => (ascending ? a[field] - b[field] : b[field] - a[field]))
      return { ok: true, rows: rows.slice(0, clamp(args.limit, 1, 25, 12)) }
    },
    async finance_backtest(args: ActionInput<'finance_backtest'>) {
      const resolved = await resolveInstrument(args.symbol)
      if (!resolved.ok) return resolved
      const count = clamp(args.count, 30, 800, 250)
      const rows = await quotes.candles(resolved.symbol, 'day', 'qfq', count, { force: false })
      const result = backtest(rows, args.strategy === 'macross' ? 'macross' : 'buyhold')
      if (!result) return { ok: false, error: 'Not enough history to backtest (need at least 20 candles).' }
      const { curve, ...metrics } = result
      return {
        ok: true,
        symbol: resolved.canonical,
        ...metrics,
        disclaimer: 'Historical simulation; not indicative of future results.',
      }
    },
    async finance_plan(args: ActionInput<'finance_plan'>) {
      const resolved = await resolveInstrument(args.symbol)
      if (!resolved.ok) return resolved
      const count = clamp(args.count, 60, 800, 500)
      const rows = await quotes.candles(resolved.symbol, 'day', 'qfq', count, { force: false })
      const result = dcaPlan(rows, {
        amount: Number(args.amount) > 0 ? Number(args.amount) : 1000,
        frequency: args.frequency === 'weekly' ? 'weekly' : 'monthly',
      })
      if (!result) return { ok: false, error: 'Not enough history to simulate a plan.' }
      const { curve, ...metrics } = result
      return {
        ok: true,
        symbol: resolved.canonical,
        ...metrics,
        disclaimer: 'Historical simulation; not indicative of future results.',
      }
    },
    async finance_news(args: ActionInput<'finance_news'>) {
      const limit = clamp(args.limit, 1, 25, 10)
      if (args.action === 'stock') {
        const resolved = await resolveInstrument(args.symbol)
        if (!resolved.ok) return resolved
        const rows = await eastmoney.fetchAnnouncements(resolved.symbol, limit)
        return rows.length > 0
          ? { ok: true, announcements: rows }
          : { ok: false, error: 'No announcements (A-shares only).' }
      }
      if (args.action === 'forecast') {
        const rows = await eastmoney.fetchForecasts(limit)
        return rows.length > 0
          ? { ok: true, forecasts: rows }
          : { ok: false, error: 'No earnings pre-announcements available.' }
      }
      const rows = await sina.fetchNewsFeed(limit)
      return rows.length > 0 ? { ok: true, newsflash: rows } : { ok: false, error: 'Newsflash feed unavailable.' }
    },
    async finance_compare(args: ActionInput<'finance_compare'>) {
      const items = Array.isArray(args.items) ? args.items : []
      if (items.length === 0) return { ok: false, error: 'items[] is required.' }
      if (args.type === 'accounts') {
        const out = []
        for (const name of items.slice(0, 8)) {
          const resolved = account(name)
          if (!resolved.ok) return resolved
          const valuation = await valuationFor(resolved.account.id)
          if (!valuation) return { ok: false, error: 'Account not found.' }
          out.push({
            account: resolved.account.name,
            currency: resolved.account.currency,
            totalMinor: valuation.totalMinor,
            totalPnlMinor: valuation.totalPnlMinor,
            returnRate: valuation.returnRate,
            isComplete: valuation.isComplete,
          })
        }
        return { ok: true, accounts: out }
      }
      const resolved = []
      for (const item of items.slice(0, 8)) {
        const row = await resolveInstrument(item)
        if (!row.ok) return row
        resolved.push(row)
      }
      await quotes.refresh(
        resolved.map((row) => row.canonical),
        { force: false },
      )
      return { ok: true, instruments: resolved.map((row) => quoteJSON(quotes.quote(row.canonical), row.canonical)) }
    },
    async finance_rebalance(args: ActionInput<'finance_rebalance'>) {
      const resolved = account(args.account)
      if (!resolved.ok) return resolved
      const targets = Array.isArray(args.targets) ? args.targets : []
      if (targets.length === 0) return { ok: false, error: 'targets[] is required.' }
      const normalized: Array<{ symbol: string; weight: number }> = []
      for (const target of targets) {
        const row = await resolveInstrument(target.symbol, { strict: true })
        if (!row.ok) return row
        normalized.push({ symbol: row.canonical, weight: Number(target.weight) })
      }
      const valuation = await valuationFor(resolved.account.id)
      if (!valuation) return { ok: false, error: 'Account not found.' }
      const proposals = proposeRebalance({
        valuation,
        targets: normalized,
        quotes: quotes.quoteMap(),
        fxMap: fxMapFor(resolved.account.currency, quotes.fx),
      })
      return {
        ok: true,
        account: resolved.account.name,
        isComplete: valuation.isComplete,
        proposals,
        note: 'Proposal only — nothing was ordered.',
      }
    },
  }

  return { ...readHandlers, ...createWriteHandlers(deps, { account, resolveInstrument, quoteJSON }) }
}

const CHINA_NETWORK = 'No data. This Eastmoney endpoint only responds from a mainland-China network connection.'

/** 把 handler 注册到宿主。返回实际注册成功的工具名（宿主没有 action 能力时是空数组）。 */
export function registerTools(deps: ToolDependencies): ActionName[] {
  const handlers = createToolHandlers(deps)
  const registered: ActionName[] = []
  for (const def of TOOL_DEFS) {
    const handler = handlers[def.name] as ((args: unknown) => unknown) | undefined
    if (!handler) continue
    const ok = registerAction(def.name, async (args) => {
      try {
        return (await handler(args || {})) as JSONValue
      } catch (error) {
        // action 永不抛到桥：抛出去模型只会看到一句无信息的失败。
        return { ok: false, error: String(error instanceof Error ? error.message : error) }
      }
    })
    if (ok) registered.push(def.name)
  }
  return registered
}
