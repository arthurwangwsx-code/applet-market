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
import { toMinor } from './money.js'
import { rebalance as proposeRebalance, backtest, dcaPlan } from './strategy.js'
import { fxMapFor } from './portfolio.js'
import { canonicalOf, decimalsFor, parseStrict, parseSymbol, resolveSymbol, secid } from './symbol.js'
import * as tencent from './providers/tencent.js'
import * as fundProvider from './providers/fund.js'
import * as eastmoney from './providers/eastmoney.js'
import * as push2 from './providers/push2.js'
import * as sina from './providers/sina.js'
import { registerAction } from './host.js'
import { TOOL_DEFS } from './tool-defs.js'

const clamp = (value, min, max, fallback) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.round(number)))
}

/** 联合搜索：股票/场内基金走腾讯联想，场外基金走本地目录。按 canonical 去重。 */
async function searchAll(query, market) {
  const [listed, funds] = await Promise.all([tencent.search(query), fundProvider.search(query, 20)])
  const seen = new Set()
  const out = []
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
async function resolveInstrument(input, { strict = false } = {}) {
  const text = String(input || '').trim()
  if (!text) return { ok: false, error: 'symbol is required' }
  const exact = parseStrict(text)
  if (exact) return { ok: true, symbol: exact, canonical: canonicalOf(exact) }

  const hits = await searchAll(text)
  const byCode = hits.filter((row) => row.symbol.toLowerCase() === text.toLowerCase() || row.code === text)
  if (byCode.length === 1) return { ok: true, symbol: resolveSymbol(byCode[0].symbol), canonical: byCode[0].symbol, name: byCode[0].name }
  const byName = hits.filter((row) => row.name === text)
  if (byName.length === 1) return { ok: true, symbol: resolveSymbol(byName[0].symbol), canonical: byName[0].symbol, name: byName[0].name }
  if (hits.length === 1) return { ok: true, symbol: resolveSymbol(hits[0].symbol), canonical: hits[0].symbol, name: hits[0].name }
  if (hits.length === 0) {
    const loose = parseSymbol(text)
    if (loose) return { ok: true, symbol: loose, canonical: canonicalOf(loose) }
    return { ok: false, error: `No instrument matched "${text}".` }
  }
  if (!strict) {
    return { ok: true, symbol: resolveSymbol(hits[0].symbol), canonical: hits[0].symbol, name: hits[0].name }
  }
  return {
    ok: false,
    error: `"${text}" matched several instruments — ask the user which one, then call again with its code.`,
    candidates: hits.slice(0, 8).map((row) => `${row.name} [${row.symbol}]`),
  }
}

function quoteJSON(quote, canonical) {
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
export function createToolHandlers(deps) {
  const { store, ledger, quotes, alerts } = deps

  /** 账户解析：对不上返回候选清单。 */
  const account = (name) => {
    const result = ledger.resolveAccount(name)
    if (result.ok) return result
    return {
      ok: false,
      error: result.error === 'noAccount' ? 'No paper account exists yet.'
        : `Account "${name}" did not match. Ask the user which account, then call again.`,
      accounts: result.candidates,
    }
  }

  const valuationFor = async (accountID, { force = false } = {}) => {
    const positions = ledger.openPositionsOf(accountID)
    const symbols = positions.map((row) => row.instrumentSymbol)
    if (symbols.length > 0) await quotes.refresh(symbols, { force })
    await quotes.exchangeRates({ force })
    return ledger.valuation(accountID, quotes.quoteMap(), quotes.fx)
  }

  const handlers = {
    async finance_quote(args = {}) {
      const inputs = Array.isArray(args.symbols) && args.symbols.length > 0
        ? args.symbols
        : (args.symbol ? [args.symbol] : [])
      if (inputs.length === 0) return { ok: false, error: 'Provide symbols[] or symbol.' }
      const resolved = []
      for (const input of inputs.slice(0, 20)) {
        const row = await resolveInstrument(input)
        if (row.ok) resolved.push(row)
      }
      if (resolved.length === 0) return { ok: false, error: 'No symbol could be resolved.' }
      const result = await quotes.refresh(resolved.map((row) => row.canonical), { force: !!args.force })
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

    async finance_search(args = {}) {
      const query = String(args.query || '').trim()
      if (!query) return { ok: false, error: 'query is required.' }
      const hits = await searchAll(query, args.market)
      const limit = clamp(args.limit, 1, 15, 15)
      return {
        ok: true,
        results: hits.slice(0, limit).map((row) => ({ symbol: row.symbol, name: row.name, market: row.market, code: row.code })),
        note: hits.length === 0 ? 'No match. The stock search endpoint may be unreachable from this network.' : undefined,
      }
    },

    async finance_chart(args = {}) {
      const resolved = await resolveInstrument(args.symbol)
      if (!resolved.ok) return resolved
      const period = args.period || 'day'
      const adjust = args.adjust === 'hfq' ? 'hfq' : 'qfq'
      const count = clamp(args.count, 1, 800, 120)
      const rows = await quotes.candles(resolved.symbol, period, adjust, count, { force: false })
      if (rows.length === 0) return { ok: false, error: 'No candles available for this symbol/period.' }

      const closes = rows.map((row) => row.close)
      const last = rows[rows.length - 1]
      const first = rows[0]
      const summary = {
        symbol: resolved.canonical,
        period,
        adjust,
        candles: rows.length,
        from: first.date,
        to: last.date,
        windowChangePct: first.close > 0 ? ((last.close - first.close) / first.close) * 100 : 0,
        latest: { date: last.date, open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume },
        ma5: sma(closes, 5).pop(),
        ma10: sma(closes, 10).pop(),
        ma20: sma(closes, 20).pop(),
      }
      const wanted = Array.isArray(args.indicators) ? args.indicators : []
      const indicators = {}
      if (wanted.includes('macd')) {
        const result = macd(closes)
        indicators.macd = { dif: result.dif[result.dif.length - 1], dea: result.dea[result.dea.length - 1], hist: result.hist[result.hist.length - 1] }
      }
      if (wanted.includes('kdj')) {
        const result = kdj(rows)
        indicators.kdj = { k: result.k[result.k.length - 1], d: result.d[result.d.length - 1], j: result.j[result.j.length - 1] }
      }
      if (wanted.includes('boll')) {
        const result = boll(closes, 20, 2)
        indicators.boll = { mid: result.mid[result.mid.length - 1], upper: result.upper[result.upper.length - 1], lower: result.lower[result.lower.length - 1] }
      }
      return { ok: true, summary, indicators, series: rows.slice(-60) }
    },

    async finance_watch(args = {}) {
      const action = args.action || 'list'
      if (action === 'list') {
        const symbols = store.items.map((row) => row.instrumentSymbol)
        if (symbols.length > 0) await quotes.refresh(symbols, { force: false })
        return {
          ok: true,
          items: store.items.map((row) => ({
            symbol: row.instrumentSymbol,
            name: store.instrumentName(row.instrumentSymbol),
            group: (store.groups.find((g) => g.id === row.groupID) || {}).name || null,
            quote: quoteJSON(quotes.quote(row.instrumentSymbol), row.instrumentSymbol),
          })),
          groups: store.groups.map((row) => row.name),
        }
      }
      if (action === 'create_group') return store.createGroup(String(args.group || '').trim())
      if (action === 'delete_group') {
        const group = store.groups.find((row) => row.name === args.group)
        if (!group) return { ok: false, error: `No group named "${args.group}".`, groups: store.groups.map((row) => row.name) }
        return store.deleteGroup(group.id)
      }
      const resolved = await resolveInstrument(args.symbol, { strict: true })
      if (!resolved.ok) return resolved
      if (action === 'add') return store.addWatch(resolved.canonical, { name: resolved.name })
      if (action === 'remove') return store.removeWatch(resolved.canonical)
      if (action === 'move') {
        const group = store.groups.find((row) => row.name === args.group)
        if (!group) return { ok: false, error: `No group named "${args.group}".`, groups: store.groups.map((row) => row.name) }
        return store.moveWatch(resolved.canonical, group.id)
      }
      return { ok: false, error: `Unknown action "${action}".` }
    },

    async finance_portfolio(args = {}) {
      const resolved = account(args.account)
      if (!resolved.ok) return resolved
      if (args.action === 'history') {
        const limit = clamp(args.limit, 1, 100, 20)
        return {
          ok: true,
          account: resolved.account.name,
          trades: ledger.ordersOf(resolved.account.id, limit).map((row) => ({
            side: row.sideRaw, symbol: row.instrumentSymbol, name: row.name,
            quantity: row.quantity, price: row.price, currency: row.currency,
            feeMinor: row.feeMinor, fxRate: row.fxRate, tradedAt: isoDate(row.tradedAt),
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

    async finance_trade(args = {}) {
      const side = args.action
      if (side !== 'buy' && side !== 'sell') return { ok: false, error: 'action must be buy or sell.' }
      const resolvedAccount = account(args.account)
      if (!resolvedAccount.ok) return resolvedAccount
      const resolved = await resolveInstrument(args.symbol, { strict: true })
      if (!resolved.ok) return resolved

      await quotes.refresh([resolved.canonical], { force: false })
      await quotes.exchangeRates({ force: false })
      const quote = quotes.quote(resolved.canonical)
      const price = Number(args.price) > 0 ? Number(args.price) : (quote ? quote.price : null)
      if (!(price > 0)) return { ok: false, error: 'No price given and no quote available.' }

      const instrumentCurrency = quote ? quote.currency : 'CNY'
      const rate = ledger.fxRateFor(instrumentCurrency, resolvedAccount.account.currency, quotes.fx)
      if (!rate) {
        return { ok: false, error: `No ${instrumentCurrency}→${resolvedAccount.account.currency} exchange rate is available; the trade was not recorded.` }
      }
      const payload = {
        accountID: resolvedAccount.account.id,
        symbol: resolved.canonical,
        name: (quote && quote.name) || resolved.name || resolved.canonical,
        market: resolved.symbol.market,
        currency: instrumentCurrency,
        quantity: Number(args.quantity),
        price,
        fxRate: rate,
        feeMinor: Math.max(0, toMinor(Number(args.fee) || 0)),
        source: 'ai',
      }
      const result = side === 'buy' ? await ledger.buy(payload) : await ledger.sell(payload)
      if (!result.ok) return result
      return {
        ok: true,
        side,
        symbol: resolved.canonical,
        quantity: payload.quantity,
        price,
        currency: instrumentCurrency,
        fxRate: rate,
        account: resolvedAccount.account.name,
        note: 'Simulated only — no real order was placed.',
      }
    },

    async finance_account(args = {}) {
      const action = args.action || 'list'
      if (action === 'list') {
        return {
          ok: true,
          accounts: ledger.accounts
            .filter((row) => args.include_archived || !row.isArchived)
            .map((row) => ({
              name: row.name, currency: row.currency, cashMinor: row.cashMinor,
              initialCashMinor: row.initialCashMinor, isArchived: row.isArchived, isRealCopy: row.isRealCopy,
            })),
        }
      }
      if (action === 'create') {
        return ledger.createAccount({
          name: args.name,
          currency: args.currency || 'CNY',
          initialCashMinor: toMinor(Number(args.initial_cash) > 0 ? Number(args.initial_cash) : 1000000),
          note: args.note,
          isRealCopy: !!args.is_real_copy,
        })
      }
      if (action === 'copy') {
        const source = account(args.from_account || args.name)
        if (!source.ok) return source
        return ledger.copyAccount(source.account.id, args.name)
      }
      const resolved = account(args.name)
      if (!resolved.ok) return resolved
      if (action === 'rename') return ledger.updateAccount(resolved.account.id, { name: String(args.name || '').trim() })
      if (action === 'update') return ledger.updateAccount(resolved.account.id, { note: args.note, isRealCopy: !!args.is_real_copy })
      if (action === 'reset') return ledger.resetAccount(resolved.account.id)
      if (action === 'archive') return ledger.updateAccount(resolved.account.id, { isArchived: true })
      if (action === 'unarchive') return ledger.updateAccount(resolved.account.id, { isArchived: false })
      if (action === 'delete') return ledger.deleteAccount(resolved.account.id)
      if (action === 'cashflow') {
        const amount = Number(args.amount)
        if (!(amount > 0)) return { ok: false, error: 'amount must be > 0.' }
        return ledger.addCashFlow({
          accountID: resolved.account.id,
          kind: args.cashflow_type || 'deposit',
          amountMinor: toMinor(amount),
          note: args.note,
          source: 'ai',
        })
      }
      return { ok: false, error: `Unknown action "${action}".` }
    },

    async finance_alert(args = {}) {
      const action = args.action || 'list'
      if (action === 'list') {
        return {
          ok: true,
          alerts: alerts.all().map((row) => ({
            symbol: row.instrumentSymbol, name: row.name, condition: row.conditionRaw,
            target: row.targetPrice, enabled: row.enabled, note: row.note,
          })),
          note: 'Alerts fire while quotes refresh with the app open; there is no background monitoring in this container.',
        }
      }
      const resolved = await resolveInstrument(args.symbol, { strict: true })
      if (!resolved.ok) return resolved
      if (action === 'set') {
        return alerts.set({
          symbol: resolved.canonical,
          name: resolved.name || store.instrumentName(resolved.canonical),
          condition: args.condition || 'above',
          targetPrice: Number(args.price),
          note: args.note,
        })
      }
      const rows = alerts.forSymbol(resolved.canonical)
        .filter((row) => !args.condition || row.conditionRaw === args.condition)
      if (rows.length === 0) return { ok: false, error: 'No matching alert.' }
      for (const row of rows) {
        if (action === 'remove') await alerts.remove(row.id)
        else if (action === 'enable') await alerts.setEnabled(row.id, true)
        else if (action === 'disable') await alerts.setEnabled(row.id, false)
      }
      return { ok: true, affected: rows.length }
    },

    async finance_financials(args = {}) {
      const resolved = await resolveInstrument(args.symbol)
      if (!resolved.ok) return resolved
      const rows = await eastmoney.fetchFinancials(resolved.symbol)
      await quotes.refresh([resolved.canonical], { force: false })
      const quote = quotes.quote(resolved.canonical)
      if (rows.length === 0) {
        return { ok: false, error: 'No financial report is available for this instrument (banks and insurers often have none).' }
      }
      return { ok: true, symbol: resolved.canonical, periods: rows, pe: quote ? quote.pe : null, pb: quote ? quote.pb : null }
    },

    async finance_dividend(args = {}) {
      const resolved = await resolveInstrument(args.symbol)
      if (!resolved.ok) return resolved
      if (resolved.symbol.market !== 'ashare') return { ok: false, error: 'Dividends are A-shares only.' }
      const rows = await eastmoney.fetchDividends(resolved.symbol)
      return { ok: true, symbol: resolved.canonical, dividends: rows }
    },

    async finance_fundflow(args = {}) {
      const resolved = await resolveInstrument(args.symbol)
      if (!resolved.ok) return resolved
      if (resolved.symbol.market !== 'ashare') return { ok: false, error: 'Fund flow is A-shares only.' }
      const days = clamp(args.days, 1, 60, 10)
      const rows = await push2.fetchFundFlow(secid(resolved.symbol), days)
      if (rows.length === 0) return { ok: false, error: 'No fund-flow data; this endpoint needs a mainland-China network connection.' }
      return { ok: true, symbol: resolved.canonical, days: rows.slice(-days) }
    },

    async finance_perf(args = {}) {
      const resolved = account(args.account)
      if (!resolved.ok) return resolved
      const valuation = await valuationFor(resolved.account.id, { force: true })
      await ledger.writeSnapshot(valuation)
      const perf = ledger.performance(resolved.account.id)
      return { ok: true, account: resolved.account.name, isComplete: valuation.isComplete, ...perf }
    },

    async finance_diagnose(args = {}) {
      const resolved = account(args.account)
      if (!resolved.ok) return resolved
      const valuation = await valuationFor(resolved.account.id)
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

    async finance_sector(args = {}) {
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

    async finance_moneyrank(args = {}) {
      const rows = await push2.fetchMoneyRank({ inflow: args.direction !== 'outflow', limit: clamp(args.limit, 1, 30, 12) })
      return rows.length > 0 ? { ok: true, rows } : { ok: false, error: CHINA_NETWORK }
    },

    async finance_dragon(args = {}) {
      const rows = await eastmoney.fetchDragonBoard(clamp(args.limit, 1, 30, 12))
      return rows.length > 0 ? { ok: true, tradeDate: rows[0].tradeDate, rows } : { ok: false, error: 'No Dragon-Tiger data available.' }
    },

    async finance_sentiment() {
      const breadth = await push2.fetchBreadth(Date.now())
      return breadth ? { ok: true, ...breadth } : { ok: false, error: CHINA_NETWORK }
    },

    async finance_screener(args = {}) {
      const universe = await push2.fetchScreenerUniverse(400)
      if (universe.length === 0) return { ok: false, error: CHINA_NETWORK }
      let rows = universe
      if (Number.isFinite(Number(args.peMin))) rows = rows.filter((row) => row.pe >= Number(args.peMin))
      if (Number.isFinite(Number(args.peMax))) rows = rows.filter((row) => row.pe > 0 && row.pe <= Number(args.peMax))
      if (Number.isFinite(Number(args.pbMax))) rows = rows.filter((row) => row.pb > 0 && row.pb <= Number(args.pbMax))
      if (Number.isFinite(Number(args.changeMin))) rows = rows.filter((row) => row.changePct >= Number(args.changeMin))
      if (Number.isFinite(Number(args.changeMax))) rows = rows.filter((row) => row.changePct <= Number(args.changeMax))
      if (Number.isFinite(Number(args.mktcapMinYi))) rows = rows.filter((row) => row.marketCapYi >= Number(args.mktcapMinYi))
      if (args.industry) rows = rows.filter((row) => row.industry.includes(String(args.industry)))
      const field = { change: 'changePct', moneyflow: 'mainNet', turnover: 'turnover', pe: 'pe', marketcap: 'marketCapYi' }[args.sortBy || 'change']
      const ascending = args.order ? args.order === 'asc' : (args.sortBy === 'pe')
      rows = rows.slice().sort((a, b) => (ascending ? a[field] - b[field] : b[field] - a[field]))
      return { ok: true, rows: rows.slice(0, clamp(args.limit, 1, 25, 12)) }
    },

    async finance_backtest(args = {}) {
      const resolved = await resolveInstrument(args.symbol)
      if (!resolved.ok) return resolved
      const count = clamp(args.count, 30, 800, 250)
      const rows = await quotes.candles(resolved.symbol, 'day', 'qfq', count, { force: false })
      const result = backtest(rows, args.strategy === 'macross' ? 'macross' : 'buyhold')
      if (!result) return { ok: false, error: 'Not enough history to backtest (need at least 20 candles).' }
      const { curve, ...metrics } = result
      return { ok: true, symbol: resolved.canonical, ...metrics, disclaimer: 'Historical simulation; not indicative of future results.' }
    },

    async finance_plan(args = {}) {
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
      return { ok: true, symbol: resolved.canonical, ...metrics, disclaimer: 'Historical simulation; not indicative of future results.' }
    },

    async finance_news(args = {}) {
      const limit = clamp(args.limit, 1, 25, 10)
      if (args.action === 'stock') {
        const resolved = await resolveInstrument(args.symbol)
        if (!resolved.ok) return resolved
        const rows = await eastmoney.fetchAnnouncements(resolved.symbol, limit)
        return rows.length > 0 ? { ok: true, announcements: rows } : { ok: false, error: 'No announcements (A-shares only).' }
      }
      if (args.action === 'forecast') {
        const rows = await eastmoney.fetchForecasts(limit)
        return rows.length > 0 ? { ok: true, forecasts: rows } : { ok: false, error: 'No earnings pre-announcements available.' }
      }
      const rows = await sina.fetchNewsFeed(limit)
      return rows.length > 0 ? { ok: true, newsflash: rows } : { ok: false, error: 'Newsflash feed unavailable.' }
    },

    async finance_compare(args = {}) {
      const items = Array.isArray(args.items) ? args.items : []
      if (items.length === 0) return { ok: false, error: 'items[] is required.' }
      if (args.type === 'accounts') {
        const out = []
        for (const name of items.slice(0, 8)) {
          const resolved = account(name)
          if (!resolved.ok) return resolved
          const valuation = await valuationFor(resolved.account.id)
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
      await quotes.refresh(resolved.map((row) => row.canonical), { force: false })
      return { ok: true, instruments: resolved.map((row) => quoteJSON(quotes.quote(row.canonical), row.canonical)) }
    },

    async finance_rebalance(args = {}) {
      const resolved = account(args.account)
      if (!resolved.ok) return resolved
      const targets = Array.isArray(args.targets) ? args.targets : []
      if (targets.length === 0) return { ok: false, error: 'targets[] is required.' }
      const normalized = []
      for (const target of targets) {
        const row = await resolveInstrument(target.symbol, { strict: true })
        if (!row.ok) return row
        normalized.push({ symbol: row.canonical, weight: Number(target.weight) })
      }
      const valuation = await valuationFor(resolved.account.id)
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

  return handlers
}

const CHINA_NETWORK = 'No data. This Eastmoney endpoint only responds from a mainland-China network connection.'

/** 把 handler 注册到宿主。返回实际注册成功的工具名（宿主没有 action 能力时是空数组）。 */
export function registerTools(deps) {
  const handlers = createToolHandlers(deps)
  const registered = []
  for (const def of TOOL_DEFS) {
    const handler = handlers[def.name]
    if (!handler) continue
    const ok = registerAction(def.name, async (args) => {
      try {
        return await handler(args || {})
      } catch (error) {
        // action 永不抛到桥：抛出去模型只会看到一句无信息的失败。
        return { ok: false, error: String((error && error.message) || error) }
      }
    })
    if (ok) registered.push(def.name)
  }
  return registered
}
