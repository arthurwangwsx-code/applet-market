#!/usr/bin/env node
// 金额运算与指标算法的可运行自测。**不进发布包**（release 只打 src/）。
//
//   node apps/com.aibox.finance/tests/selftest.mjs
//
// 覆盖规格里最容易做错的几条：手续费不进成本价 / 卖出手续费吃进已实现盈亏 /
// 总盈亏扣净外部资金流 / 缺行情缺汇率按 0 计并打标 / MACD hist ×2 / KDJ 的 low>0 / BOLL 总体标准差。

import assert from 'node:assert/strict'

import { boll, ema, kdj, macd, sma, stdDevPopulation, stdDevSample } from '../src/lib/indicators.js'
import { grossMinorOf, parseNumberInput, roundHalfAway, toMinor } from '../src/lib/money.js'
import {
  applyBuy, applyCashFlow, applySell, diagnose, fxMapFor, fxRate, performance, valueAccount, valuePosition, winRateOf,
} from '../src/lib/portfolio.js'
import { backtest, dcaPlan } from '../src/lib/strategy.js'
import { formatCompact, formatMinor, formatPercent, formatPrice, trendKey } from '../src/lib/format.js'
import { canonicalOf, parseStrict, parseSymbol } from '../src/lib/symbol.js'
import { shouldFire } from '../src/lib/alerts.js'
import { resolveDataState, showsCachedBadge } from '../src/lib/quotes.js'

let passed = 0
let failed = 0
const near = (a, b, epsilon = 1e-6) => Math.abs(a - b) <= epsilon

function check(label, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ✓ ${label}`)
  } catch (error) {
    failed += 1
    console.log(`  ✗ ${label}\n      ${error.message.split('\n')[0]}`)
  }
}

function group(title) {
  console.log(`\n${title}`)
}

// ────────────────────────────────────────────────────────────────
group('money —— 分单位与舍入')

check('四舍五入远离 0（−0.5 → −1，0.5 → 1）', () => {
  assert.equal(roundHalfAway(0.5), 1)
  assert.equal(roundHalfAway(-0.5), -1)
  assert.equal(roundHalfAway(2.4), 2)
})

check('元 → 分：1712.35 → 171235（无浮点尾巴）', () => {
  assert.equal(toMinor(1712.35), 171235)
  assert.equal(toMinor(0.145), 15)
  assert.equal(toMinor(Number.NaN), 0)
})

check('grossMinor = qty × price × 100', () => {
  assert.equal(grossMinorOf(100, 17.235), 172350)
  assert.throws(() => grossMinorOf(0, 10))
  assert.throws(() => grossMinorOf(10, -1))
})

check('宽松数字解析剥掉分组符号', () => {
  assert.equal(parseNumberInput('1,234.56'), 1234.56)
  assert.equal(parseNumberInput('  12 '), 12)
  assert.equal(parseNumberInput('abc'), null)
})

// ────────────────────────────────────────────────────────────────
group('symbol —— 两级解析')

check('parseStrict 不认全字母（Tesla → null）', () => {
  assert.equal(parseStrict('Tesla'), null)
  assert.equal(canonicalOf(parseSymbol('Tesla')), 'usTESLA')  // 宽松才兜底
})

check('A 股交易所按首位推断', () => {
  assert.equal(canonicalOf(parseStrict('600519')), 'sh600519')
  assert.equal(canonicalOf(parseStrict('000001')), 'sz000001')
  assert.equal(canonicalOf(parseStrict('430047')), 'bj430047')
})

check('港股补 0 到 5 位；基金前缀', () => {
  assert.equal(parseStrict('700'), null)                       // 3 位数字不认
  assert.equal(canonicalOf(parseStrict('0700')), 'hk00700')
  assert.equal(canonicalOf(parseStrict('00700')), 'hk00700')
  assert.equal(canonicalOf(parseStrict('of161725')), 'fund161725')
  assert.equal(canonicalOf(parseStrict('fund161725')), 'fund161725')
})

// ────────────────────────────────────────────────────────────────
group('买入 —— §10.1（手续费不进成本价）')

const account0 = {
  id: 'a1', name: 'test', currency: 'CNY', initialCashMinor: 100000000, cashMinor: 100000000,
  isArchived: false,
}

check('买入扣款 = 成本 + 手续费；avgCost 只由 qty×price 决定', () => {
  const result = applyBuy({
    account: account0, position: null, symbol: 'sh600519', name: '贵州茅台', market: 'ashare',
    currency: 'CNY', quantity: 100, price: 1700, fxRate: 1, feeMinor: 500,
  })
  assert.equal(result.order.grossMinor, 17000000)          // 100 × 1700 × 100
  assert.equal(result.debitMinor, 17000500)                // 成本 + 5.00 手续费
  assert.equal(result.account.cashMinor, 100000000 - 17000500)
  assert.equal(result.position.avgCost, 1700)              // **手续费没有摊进成本价**
  assert.equal(result.position.quantity, 100)
})

check('加仓摊薄成本 = (旧量×旧均价 + 新量×新价)/总量', () => {
  const first = applyBuy({
    account: account0, position: null, symbol: 'sh600519', currency: 'CNY',
    quantity: 100, price: 1700, fxRate: 1, feeMinor: 0,
  })
  const second = applyBuy({
    account: first.account, position: first.position, symbol: 'sh600519', currency: 'CNY',
    quantity: 100, price: 1900, fxRate: 1, feeMinor: 9999,
  })
  assert.equal(second.position.quantity, 200)
  assert.ok(near(second.position.avgCost, 1800))           // 手续费 99.99 完全不影响
})

check('现金不足报 insufficientCash', () => {
  assert.throws(
    () => applyBuy({
      account: { ...account0, cashMinor: 1000 }, position: null, symbol: 'sh600519',
      currency: 'CNY', quantity: 100, price: 1700, fxRate: 1, feeMinor: 0,
    }),
    (error) => error.code === 'insufficientCash',
  )
})

check('跨币种买入按成交汇率折算（1 USD = 7.2 CNY）', () => {
  const result = applyBuy({
    account: account0, position: null, symbol: 'usAAPL', currency: 'USD',
    quantity: 10, price: 200, fxRate: 7.2, feeMinor: 100,
  })
  assert.equal(result.order.grossMinor, 200000)            // 标的币分
  assert.equal(result.debitMinor, 1440000 + 100)           // 账户币分 = 200000 × 7.2
})

// ────────────────────────────────────────────────────────────────
group('卖出 —— §10.2（手续费吃进已实现盈亏）')

check('已实现盈亏 = 净收入 − 成本基，手续费计入亏损侧', () => {
  const bought = applyBuy({
    account: account0, position: null, symbol: 'sh600519', currency: 'CNY',
    quantity: 100, price: 1700, fxRate: 1, feeMinor: 0,
  })
  const sold = applySell({
    account: bought.account, position: bought.position,
    quantity: 100, price: 1800, fxRate: 1, feeMinor: 500,
  })
  // 毛收入 18,000,000 分；净收入 17,999,500；成本基 17,000,000 → 已实现 999,500（= 1万 − 5元）
  assert.equal(sold.proceedsMinor, 17999500)
  assert.equal(sold.realizedDeltaMinor, 999500)
  assert.equal(sold.position.realizedPnlMinor, 999500)
})

check('清仓不删行：quantity 归 0，avgCost 与已实现盈亏留档', () => {
  const bought = applyBuy({
    account: account0, position: null, symbol: 'sh600519', currency: 'CNY',
    quantity: 100, price: 1700, fxRate: 1, feeMinor: 0,
  })
  const sold = applySell({
    account: bought.account, position: bought.position, quantity: 100, price: 1600, fxRate: 1, feeMinor: 0,
  })
  assert.equal(sold.position.quantity, 0)
  assert.equal(sold.position.avgCost, 1700)                 // avgCost 不变
  assert.equal(sold.position.realizedPnlMinor, -1000000)    // 亏 1 万元
})

check('手续费高于毛收入 → invalidFee；卖超持仓 → insufficientPosition', () => {
  const position = { instrumentSymbol: 'sh600519', quantity: 10, avgCost: 100, currency: 'CNY', realizedPnlMinor: 0 }
  assert.throws(
    () => applySell({ account: account0, position, quantity: 10, price: 100, fxRate: 1, feeMinor: 999999999 }),
    (error) => error.code === 'invalidFee',
  )
  assert.throws(
    () => applySell({ account: account0, position, quantity: 100, price: 100, fxRate: 1, feeMinor: 0 }),
    (error) => error.code === 'insufficientPosition',
  )
})

// ────────────────────────────────────────────────────────────────
group('汇率 —— §10.3（绝不用 1 兜底）')

check('fxMap 以账户币为基；账户币缺报价 → 空表', () => {
  const map = fxMapFor('HKD', { USD: 7.2, HKD: 0.92, EUR: 7.8 })
  assert.ok(near(map.USD, 7.2 / 0.92))
  assert.ok(near(map.CNY, 1 / 0.92))
  assert.deepEqual(fxMapFor('HKD', { USD: 7.2 }), {})       // 账户币缺 → 什么都估不了
})

check('查不到汇率返回 null，不是 1', () => {
  assert.equal(fxRate('USD', 'CNY', {}), null)
  assert.equal(fxRate('CNY', 'CNY', {}), 1)                 // 同币种才是 1
})

// ────────────────────────────────────────────────────────────────
group('估值 —— §10.4 / §10.5')

const position = {
  id: 'p1', accountID: 'a1', instrumentSymbol: 'sh600519', name: '贵州茅台', marketRaw: 'ashare',
  currency: 'CNY', quantity: 100, avgCost: 1700, realizedPnlMinor: 0,
}

check('缺行情按 0 计并打 missingQuote', () => {
  const row = valuePosition(position, null, 1)
  assert.equal(row.marketValueMinor, 0)
  assert.equal(row.costMinor, 0)
  assert.equal(row.missingQuote, true)
})

check('缺汇率按 0 计并打 missingFX（不是按 1 折算）', () => {
  const row = valuePosition(position, { price: 1800, prevClose: 1750 }, null)
  assert.equal(row.marketValueMinor, 0)
  assert.equal(row.missingFX, true)
})

check('正常估值：市值 / 成本 / 浮盈 / 今日', () => {
  const row = valuePosition(position, { price: 1800, prevClose: 1750 }, 1)
  assert.equal(row.marketValueMinor, 18000000)
  assert.equal(row.costMinor, 17000000)
  assert.equal(row.unrealizedMinor, 1000000)
  assert.ok(near(row.unrealizedPct, (1000000 / 17000000) * 100))
  assert.equal(row.dayMinor, 500000)                        // 100 × (1800−1750) × 100
})

check('总盈亏扣净外部资金流（追加入金不算收益）', () => {
  const valuation = valueAccount({
    account: { id: 'a1', currency: 'CNY', initialCashMinor: 100000000, cashMinor: 133000000 },
    positions: [position],
    quotes: { sh600519: { price: 1800, prevClose: 1750 } },
    fxToCNY: { CNY: 1 },
    cashFlows: [
      { kindRaw: 'deposit', amountMinor: 50000000 },        // 入金 50 万
      { kindRaw: 'dividend', amountMinor: 100000 },         // 分红算收益，不扣
    ],
  })
  assert.equal(valuation.marketValueMinor, 18000000)
  assert.equal(valuation.totalMinor, 151000000)             // 现金 133 万 + 市值 18 万
  assert.equal(valuation.externalCashFlowMinor, 50000000)
  assert.equal(valuation.totalPnlMinor, 1000000)            // 151万 − 100万 − 50万 = 1 万
  assert.equal(valuation.isComplete, true)
})

check('任一持仓缺行情 → isComplete=false + 缺失清单', () => {
  const valuation = valueAccount({
    account: { id: 'a1', currency: 'CNY', initialCashMinor: 100000000, cashMinor: 100000000 },
    positions: [position, { ...position, id: 'p2', instrumentSymbol: 'usAAPL', currency: 'USD' }],
    quotes: { sh600519: { price: 1800, prevClose: 1750 } },
    fxToCNY: { CNY: 1 },
    cashFlows: [],
  })
  assert.equal(valuation.isComplete, false)
  assert.deepEqual(valuation.missingQuotes, ['usAAPL'])
  assert.deepEqual(valuation.missingFX, ['USD'])
})

check('已实现盈亏累加**含 quantity=0 的历史行**', () => {
  const valuation = valueAccount({
    account: { id: 'a1', currency: 'CNY', initialCashMinor: 100000000, cashMinor: 100000000 },
    positions: [{ ...position, quantity: 0, realizedPnlMinor: 777 }],
    quotes: {},
    fxToCNY: { CNY: 1 },
    cashFlows: [],
  })
  assert.equal(valuation.realizedMinor, 777)
  assert.equal(valuation.rows.length, 0)                    // 但不进持仓列表
})

check('现金流：出金取负号，透支被拒', () => {
  const out = applyCashFlow({ account: { ...account0 }, kind: 'withdrawal', amountMinor: 100 })
  assert.equal(out.flow.amountMinor, -100)
  assert.equal(out.account.cashMinor, 100000000 - 100)
  assert.throws(
    () => applyCashFlow({ account: { ...account0, cashMinor: 50 }, kind: 'withdrawal', amountMinor: 100 }),
    (error) => error.code === 'insufficientCash',
  )
})

// ────────────────────────────────────────────────────────────────
group('绩效与诊断 —— §10.8 / §10.10')

check('胜率按回放时点的摊薄成本判定', () => {
  const result = winRateOf([
    { instrumentSymbol: 'X', sideRaw: 'buy', quantity: 100, price: 10, tradedAt: 1 },
    { instrumentSymbol: 'X', sideRaw: 'buy', quantity: 100, price: 20, tradedAt: 2 },
    { instrumentSymbol: 'X', sideRaw: 'sell', quantity: 100, price: 16, tradedAt: 3 },  // > 均价 15 → 胜
    { instrumentSymbol: 'X', sideRaw: 'sell', quantity: 100, price: 14, tradedAt: 4 },  // < 均价 15 → 负
  ])
  assert.equal(result.closed, 2)
  assert.equal(result.wins, 1)
  assert.equal(result.winRate, 50)
})

check('快照 < 2 时回撤/波动/夏普全 0 且 hasEnoughData=false', () => {
  const perf = performance({ orders: [], snapshots: [{ date: 0, totalValueMinor: 100 }] })
  assert.equal(perf.hasEnoughData, false)
  assert.equal(perf.maxDrawdown, 0)
})

check('绩效年化与最大回撤', () => {
  const day = 86400000
  const perf = performance({
    orders: [],
    snapshots: [
      { date: 0, totalValueMinor: 10000000 },
      { date: 100 * day, totalValueMinor: 9000000 },
      { date: 365 * day, totalValueMinor: 11000000 },
    ],
  })
  assert.equal(perf.hasEnoughData, true)
  assert.ok(near(perf.totalReturn, 10))
  assert.ok(near(perf.annualized, 10, 1e-9))                // 恰好 365 天 → 年化 = 总收益
  assert.ok(near(perf.maxDrawdown, 10))                     // 从 10 万跌到 9 万
})

check('诊断：单一持仓过重 + 现金过低 各扣分', () => {
  const valuation = {
    account: { id: 'a1', currency: 'CNY' },
    rows: [
      { position: { instrumentSymbol: 'A', marketRaw: 'ashare' }, marketValueMinor: 9000, unrealizedPct: 5 },
      { position: { instrumentSymbol: 'B', marketRaw: 'ashare' }, marketValueMinor: 1000, unrealizedPct: -30 },
    ],
    marketValueMinor: 10000,
    cashMinor: 100,
    totalMinor: 10100,
    isComplete: true,
  }
  const result = diagnose({ valuation, perf: { hasEnoughData: false, maxDrawdown: 0 } })
  // highConcentration(20) + fewPositions(15) + singleMarket(10) + lowCash(5) + deepLoser(15) = 65
  assert.deepEqual(result.flags.sort(), ['deepLoser', 'fewPositions', 'highConcentration', 'lowCash', 'singleMarket'])
  assert.equal(result.score, 35)
  assert.ok(near(result.hhi, 0.9 ** 2 + 0.1 ** 2))
  assert.equal(result.detractor.position.instrumentSymbol, 'B')
})

// ────────────────────────────────────────────────────────────────
group('指标 —— §7.3')

const closes = [10, 11, 12, 11, 10, 9, 10, 11, 12, 13, 14, 13, 12, 11, 10, 11, 12, 13, 14, 15,
  16, 15, 14, 13, 12, 13, 14, 15, 16, 17]

check('MA 暖机期输出 null，之后是简单均值', () => {
  const line = sma([1, 2, 3, 4, 5], 3)
  assert.equal(line[0], null)
  assert.equal(line[1], null)
  assert.ok(near(line[2], 2))
  assert.ok(near(line[4], 4))
})

check('EMA：out[0]=v[0]，k=2/(n+1)，全长无 null', () => {
  const line = ema([10, 20, 30], 2)   // k = 2/3
  assert.equal(line[0], 10)
  assert.ok(near(line[1], 20 * (2 / 3) + 10 * (1 / 3)))
  assert.ok(line.every((value) => value !== null))
})

check('MACD：DIF=EMA12−EMA26，DEA=EMA(DIF,9)，**hist=(DIF−DEA)×2**', () => {
  const result = macd(closes)
  const fast = ema(closes, 12)
  const slow = ema(closes, 26)
  const dif = closes.map((_, i) => fast[i] - slow[i])
  const dea = ema(dif, 9)
  const last = closes.length - 1
  assert.ok(near(result.dif[last], dif[last]))
  assert.ok(near(result.dea[last], dea[last]))
  assert.ok(near(result.hist[last], (dif[last] - dea[last]) * 2))
  // 若误写成 ×1，柱高会差整整一倍：显式钉住这一条。
  assert.ok(!near(result.hist[last], dif[last] - dea[last]) || near(dif[last], dea[last]))
})

check('KDJ：prevK/prevD 初值 50，J=3K−2D', () => {
  const candles = closes.map((close) => ({ close, high: close + 0.5, low: close - 0.5 }))
  const result = kdj(candles)
  const first = candles[0]
  const rsv0 = ((first.close - first.low) / (first.high - first.low)) * 100   // = 50
  assert.ok(near(result.k[0], (rsv0 + 50 * 2) / 3))
  assert.ok(near(result.d[0], (result.k[0] + 50 * 2) / 3))
  assert.ok(near(result.j[0], 3 * result.k[0] - 2 * result.d[0]))
})

check('KDJ 的 Ln 只在 low > 0 的样本里取（0 不能拉低区间）', () => {
  // 中间一根是脏数据（low=0）。若朴素地取 min 会把 Ln 拉到 0，RSV 直接飙到 ~92；
  // 正确口径下 Ln 仍是 10，RSV = (11−10)/(12−10)×100 = 50。
  const dirty = [
    { close: 11, high: 12, low: 10 },
    { close: 11, high: 12, low: 0 },
    { close: 11, high: 12, low: 10 },
  ]
  const clean = dirty.map((row) => ({ ...row, low: 10 }))
  const dirtyK = kdj(dirty).k
  const cleanK = kdj(clean).k
  assert.ok(dirtyK.every((value, index) => near(value, cleanK[index])))
  assert.ok(near(dirtyK[1], (50 + 50 * 2) / 3))   // RSV=50，prevK=50
})

check('BOLL：mid=MA20，sd 用**总体**标准差（除以 n）', () => {
  const result = boll(closes, 20, 2)
  assert.equal(result.mid[18], null)                        // 暖机期
  const window = closes.slice(0, 20)
  const mean = window.reduce((sum, value) => sum + value, 0) / 20
  const sd = Math.sqrt(window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 20)
  assert.ok(near(result.mid[19], mean))
  assert.ok(near(result.upper[19], mean + 2 * sd))
  assert.ok(near(result.lower[19], mean - 2 * sd))
  // 样本口径（除以 19）会大一点——确认没写错成它。
  assert.ok(!near(sd, stdDevSample(window)))
  assert.ok(near(sd, stdDevPopulation(window)))
})

// ────────────────────────────────────────────────────────────────
group('回测与定投 —— §10.11 / §10.12')

const candles = closes.map((close, index) => ({
  date: `2026-01-${String(index + 1).padStart(2, '0')}`, open: close, close, high: close + 1, low: close - 1, volume: 100,
}))

check('K 线不足 20 根返回 null', () => {
  assert.equal(backtest(candles.slice(0, 19), 'buyhold'), null)
})

check('buyhold 收益 = 末价/首价 − 1', () => {
  const result = backtest(candles, 'buyhold')
  assert.ok(near(result.totalReturn, ((17 - 10) / 10) * 100))
  assert.ok(near(result.buyHoldReturn, result.totalReturn))
})

check('maCross 有交易记录，且曲线首点恒为 1', () => {
  const result = backtest(candles, 'macross')
  assert.equal(result.curve[0].value, 1)
  assert.ok(result.trades >= 0)
  assert.ok(result.winRate >= 0 && result.winRate <= 100)
})

check('定投：摊薄成本 = 累计投入 / 累计份额', () => {
  const plan = dcaPlan(candles, { amount: 1000, frequency: 'weekly' })   // step = 5
  assert.equal(plan.periods, 6)
  assert.equal(plan.invested, 6000)
  assert.ok(near(plan.avgCost, plan.invested / plan.shares))
  assert.ok(near(plan.finalValue, plan.shares * 17))
  assert.ok(near(plan.lumpSumReturn, ((17 - 10) / 10) * 100))
})

check('K 线数不足一期 → null', () => {
  assert.equal(dcaPlan(candles.slice(0, 3), { amount: 1000, frequency: 'weekly' }), null)
})

// ────────────────────────────────────────────────────────────────
group('格式与状态机 —— §11 / §2.6')

check('大数字缩写用「万/亿」（英文界面也一样）', () => {
  assert.equal(formatCompact(123400000), '1.23亿')
  assert.equal(formatCompact(12340), '1.23万')
  assert.equal(formatCompact(999), '999')
})

check('价格无千分位；金额有千分位', () => {
  assert.equal(formatPrice(1712.3456, 2), '1712.35')
  assert.equal(formatPrice(1.23456, 4), '1.2346')
  assert.equal(formatMinor(123456, 'CNY'), '¥1,234.56')
  assert.equal(formatMinor(-123456, 'USD'), '-$1,234.56')
  assert.equal(formatMinor(123456, 'CNY', { signed: true }), '+¥1,234.56')
})

check('百分比补正号；0 用中性 flat', () => {
  assert.equal(formatPercent(2.345), '+2.35%')
  assert.equal(formatPercent(-1.08), '-1.08%')
  assert.equal(trendKey(0), 'flat')
  assert.equal(trendKey(0.01), 'up')
  assert.equal(trendKey(null), 'flat')
})

check('数据状态机：全失败且从无数据 → failedWithoutData；有缓存 → failedWithCache', () => {
  const ttl = 30000
  assert.equal(resolveDataState({ failed: true, lastUpdated: null, ttlMs: ttl, now: 0, missingCount: 0 }), 'failedWithoutData')
  assert.equal(resolveDataState({ failed: true, lastUpdated: 1, ttlMs: ttl, now: 2, missingCount: 0 }), 'failedWithCache')
  assert.equal(resolveDataState({ failed: false, lastUpdated: null, refreshing: true, ttlMs: ttl, now: 0, missingCount: 0 }), 'loading')
  assert.equal(resolveDataState({ failed: false, lastUpdated: 100, ttlMs: ttl, now: 200, missingCount: 2 }), 'partial')
  assert.equal(resolveDataState({ failed: false, lastUpdated: 0, ttlMs: ttl, now: 999999, missingCount: 0 }), 'cached')
  assert.equal(resolveDataState({ failed: false, lastUpdated: 100, ttlMs: ttl, now: 200, missingCount: 0 }), 'fresh')
  assert.equal(showsCachedBadge('failedWithCache'), true)
  assert.equal(showsCachedBadge('fresh'), false)
})

check('到价提醒：穿越即触发，4 小时冷却内不重复', () => {
  const alert = { enabled: true, conditionRaw: 'above', targetPrice: 100, lastFiredAt: null }
  assert.equal(shouldFire(alert, { price: 101 }, 1000), true)
  assert.equal(shouldFire(alert, { price: 99 }, 1000), false)
  assert.equal(shouldFire({ ...alert, lastFiredAt: 1000 }, { price: 101 }, 1000 + 3600 * 1000), false)
  assert.equal(shouldFire({ ...alert, lastFiredAt: 1000 }, { price: 101 }, 1000 + 5 * 3600 * 1000), true)
  // 百分比档比的是 changePct 而不是价格
  assert.equal(shouldFire({ ...alert, conditionRaw: 'down_pct', targetPrice: -5 }, { price: 1, changePct: -6 }, 0), true)
})

// ────────────────────────────────────────────────────────────────
console.log(`\n${failed === 0 ? '✓' : '✗'} ${passed} 通过，${failed} 失败`)
process.exit(failed === 0 ? 0 : 1)
