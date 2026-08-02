#!/usr/bin/env node
// 端到端冒烟：用**假的 `window.aibox` 桥**跑通「GBK 响应 → 解码 → 解析 → 工具结果」整条链，
// 不碰真实网络。**不进发布包**（release 只打 src/）。
//
//   node apps/com.aibox.finance/tests/tools-smoke.mjs
//
// 重点验证：
//  · `responseType:'base64'` + `TextDecoder('gb18030')` 真能拿出中文名（不是空串、不是乱码）；
//  · 腾讯字段下标与「A 股成交额单位是万元」这条单位坑；
//  · finance_trade → finance_portfolio 的账目闭环（现金、成本、浮盈）；
//  · 解析纪律：账户名对不上返回候选，绝不静默落主账户。

import assert from 'node:assert/strict'

let passed = 0
let failed = 0
const check = (label, fn) => fn().then(() => { passed += 1; console.log(`  ✓ ${label}`) })
  .catch((error) => { failed += 1; console.log(`  ✗ ${label}\n      ${String(error.message).split('\n')[0]}`) })

// ── 假桥 ─────────────────────────────────────────────────────────────────────

/** 腾讯实时行情一行。索引对齐 lib/providers/tencent.js 的字段表。 */
function tencentLine() {
  const fields = new Array(56).fill('0')
  fields[0] = '1'
  fields[1] = '贵州茅台'
  fields[2] = '600519'
  fields[3] = '1712.35'      // 现价
  fields[4] = '1700.00'      // 昨收
  fields[5] = '1705.00'      // 开盘
  fields[6] = '31000'        // 成交量
  for (let i = 0; i < 5; i += 1) {
    fields[9 + i * 2] = String(1712 - i)          // 买一~买五价
    fields[10 + i * 2] = String(100 + i)          // 量
    fields[19 + i * 2] = String(1713 + i)         // 卖一~卖五价
    fields[20 + i * 2] = String(200 + i)
  }
  fields[30] = '20260803150001'
  fields[31] = '12.35'       // 涨跌额
  fields[32] = '0.73'        // 涨跌幅 %
  fields[33] = '1725.00'     // 最高
  fields[34] = '1698.00'     // 最低
  fields[37] = '53000'       // 成交额：A 股单位是**万元** → 应解析成 5.3 亿元
  fields[38] = '0.25'        // 换手率
  fields[39] = '28.6'        // 市盈率
  fields[44] = '1.59'        // 振幅
  fields[46] = '21500'       // 总市值（亿）
  fields[48] = '8.4'         // 市净率
  return `v_sh600519="${fields.join('~')}";`
}

/** UTF-8 字符串 → GBK 字节 → base64。用查表覆盖测试里出现的中文。 */
const GBK = { 贵: [0xb9, 0xf3], 州: [0xd6, 0xdd], 茅: [0xc3, 0xa9], 台: [0xcc, 0xa8] }
function toGBKBase64(text) {
  const bytes = []
  for (const char of text) {
    if (GBK[char]) bytes.push(...GBK[char])
    else if (char.charCodeAt(0) < 128) bytes.push(char.charCodeAt(0))
    else throw new Error(`测试用 GBK 表缺字：${char}`)
  }
  return Buffer.from(bytes).toString('base64')
}

const storage = new Map()
const calls = []

globalThis.window = {
  __aiboxEnvironment: { locale: 'zh-Hans' },
  aibox: {
    storage: {
      async get(key) { return storage.has(key) ? storage.get(key) : null },
      async set(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))); return true },
      async remove(key) { storage.delete(key); return true },
    },
    net: null,
  },
}
window.aibox.net = {
  async fetch(url, options = {}) {
    calls.push({ url, headers: options.headers, responseType: options.responseType })
    if (url.startsWith('https://qt.gtimg.cn/q=')) {
      assert.equal(options.responseType, 'base64', 'GBK 端点必须用 base64，否则拿到空串')
      assert.equal(options.headers.Referer, 'https://gu.qq.com', '腾讯必须带 Referer')
      return { status: 200, body: toGBKBase64(tencentLine()), contentType: 'text/html', truncated: false }
    }
    if (url.startsWith('https://hq.sinajs.cn/list=fx_')) {
      assert.equal(options.headers.Referer, 'https://finance.sina.com.cn', '新浪必须带 Referer，否则 403')
      const body = [
        'var hq_str_fx_susdcny="00:00:00,7.20,7.19,7.21,...";',
        'var hq_str_fx_sjpycny="00:00:00,4.60,4.59,4.61,...";',   // 100 日元报价 → 应 ÷100
      ].join('\n')
      return { status: 200, body: Buffer.from(body, 'ascii').toString('base64'), truncated: false }
    }
    return { status: 404, body: '', truncated: false }
  },
}
// 页面里用的是 atob；node 22 已内建，这里只做兜底。
if (typeof globalThis.atob !== 'function') {
  globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary')
}

// ── 装配 ─────────────────────────────────────────────────────────────────────

const { FinanceStore } = await import('../src/lib/store.js')
const { Ledger } = await import('../src/lib/ledger.js')
const { QuoteService } = await import('../src/lib/quotes.js')
const { AlertStore } = await import('../src/lib/alerts.js')
const { createToolHandlers } = await import('../src/lib/tools.js')
const { decodeGBK } = await import('../src/lib/http.js')

const store = new FinanceStore()
const ledger = new Ledger()
const quotes = new QuoteService()
const alerts = new AlertStore(store)
await store.load()
await ledger.load()
const tools = createToolHandlers({ store, ledger, quotes, alerts })

console.log('\nGBK 解码链路')

await check('base64 → gb18030 拿到的是中文，不是空串也不是乱码', async () => {
  assert.equal(decodeGBK(toGBKBase64('贵州茅台')), '贵州茅台')
})

await check('finance_quote：字段下标正确，A 股成交额按万元 ×10000', async () => {
  const result = await tools.finance_quote({ symbol: 'sh600519' })
  assert.equal(result.ok, true)
  const quote = result.quotes[0]
  assert.equal(quote.name, '贵州茅台')
  assert.equal(quote.price, 1712.35)
  assert.equal(quote.prevClose, 1700)
  assert.equal(quote.high, 1725)
  assert.equal(quote.low, 1698)
  assert.equal(quote.changePct, 0.73)
  assert.equal(quote.amount, 530000000)          // 53000 万元 = 5.3 亿元
  assert.equal(quote.pe, 28.6)
  assert.equal(quote.pb, 8.4)
  assert.equal(quote.marketCapYi, 21500)
  assert.equal(quote.quoteTime, '20260803150001')   // Provider 原始串直出，不格式化
})

await check('五档只对 A 股解析，且价格 > 0 才收', async () => {
  const quote = quotes.quote('sh600519')
  assert.equal(quote.bids.length, 5)
  assert.equal(quote.asks.length, 5)
  assert.equal(quote.bids[0].price, 1712)
  assert.equal(quote.asks[0].price, 1713)
})

await check('汇率：JPY 报价 ÷100 归一，USD 原样', async () => {
  const fx = await quotes.exchangeRates({ force: true })
  assert.equal(fx.USD, 7.2)
  assert.ok(Math.abs(fx.JPY - 0.046) < 1e-9)
})

console.log('\n账目闭环')

await check('finance_trade 买入 → finance_portfolio 现金与市值对得上', async () => {
  const account = ledger.primaryAccount()
  const before = account.cashMinor
  const trade = await tools.finance_trade({ action: 'buy', symbol: 'sh600519', quantity: 100, price: 1700, fee: 5 })
  assert.equal(trade.ok, true, trade.error)
  const portfolio = await tools.finance_portfolio({})
  assert.equal(portfolio.ok, true)
  assert.equal(portfolio.cashMinor, before - 17000000 - 500)
  assert.equal(portfolio.holdings.length, 1)
  assert.equal(portfolio.holdings[0].avgCost, 1700)              // 手续费不进成本价
  assert.equal(portfolio.holdings[0].marketValueMinor, 17123500) // 100 × 1712.35 × 100
  assert.equal(portfolio.holdings[0].unrealizedMinor, 123500)
  assert.equal(portfolio.isComplete, true)
})

await check('finance_trade 卖出：手续费吃进已实现盈亏', async () => {
  const trade = await tools.finance_trade({ action: 'sell', symbol: 'sh600519', quantity: 50, price: 1800, fee: 3 })
  assert.equal(trade.ok, true, trade.error)
  const portfolio = await tools.finance_portfolio({})
  // 毛收入 9,000,000 分；净 8,999,700；成本基 8,500,000 → 已实现 499,700
  assert.equal(portfolio.realizedMinor, 499700)
  assert.equal(portfolio.holdings[0].quantity, 50)
})

await check('卖超持仓被拒，且账本未被改动', async () => {
  const before = ledger.primaryAccount().cashMinor
  const trade = await tools.finance_trade({ action: 'sell', symbol: 'sh600519', quantity: 9999, price: 1800 })
  assert.equal(trade.ok, false)
  assert.equal(trade.error, 'insufficientPosition')
  assert.equal(ledger.primaryAccount().cashMinor, before)
})

console.log('\n解析纪律')

await check('账户名对不上 → 返回候选清单，绝不静默落主账户', async () => {
  const result = await tools.finance_portfolio({ account: '不存在的账户' })
  assert.equal(result.ok, false)
  assert.ok(Array.isArray(result.accounts) && result.accounts.length > 0)
  assert.ok(result.error.includes('did not match'))
})

await check('缺行情的持仓 → isComplete=false + 缺失清单，诊断拒绝出分', async () => {
  // 造一个查不到行情的标的（假桥对它返回 404）。
  await tools.finance_trade({ action: 'buy', symbol: 'sz000001', quantity: 10, price: 12 })
  const portfolio = await tools.finance_portfolio({})
  assert.equal(portfolio.isComplete, false)
  assert.deepEqual(portfolio.missingQuotes, ['sz000001'])
  const diagnosis = await tools.finance_diagnose({})
  assert.equal(diagnosis.ok, false)
  assert.ok(diagnosis.error.includes('paused'))
})

await check('finance_watch 幂等：同一 symbol 加两次只有一条', async () => {
  await tools.finance_watch({ action: 'add', symbol: 'sh600519' })
  await tools.finance_watch({ action: 'add', symbol: 'sh600519' })
  const list = await tools.finance_watch({ action: 'list' })
  assert.equal(list.items.filter((row) => row.symbol === 'sh600519').length, 1)
})

await check('finance_alert 同 symbol+condition 覆盖而不是新建', async () => {
  await tools.finance_alert({ action: 'set', symbol: 'sh600519', condition: 'above', price: 1800 })
  await tools.finance_alert({ action: 'set', symbol: 'sh600519', condition: 'above', price: 1900 })
  const list = await tools.finance_alert({ action: 'list' })
  const rows = list.alerts.filter((row) => row.symbol === 'sh600519' && row.condition === 'above')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].target, 1900)
})

console.log('\n工具声明')

const { TOOL_DEFS, CAPABILITY_NOTE } = await import('../src/lib/tool-defs.js')
const { manifestActions } = await import('../src/lib/tool-defs.js')

await check('每个声明都有可执行的 handler，且 schema 是合法 JSON', async () => {
  for (const def of TOOL_DEFS) {
    assert.equal(typeof tools[def.name], 'function', `${def.name} 缺 handler`)
    JSON.parse(def.input)
  }
})

await check('全部 headless + agent 可见；4 个写型 readOnly=false', async () => {
  const actions = manifestActions()
  assert.equal(actions.length, 23)
  for (const action of actions) {
    assert.equal(action.headless, true)
    assert.ok(action.visibility.includes('agent'))
    assert.ok(action.summary.endsWith(CAPABILITY_NOTE))
  }
  const writes = actions.filter((row) => row.readOnly === false).map((row) => row.name).sort()
  assert.deepEqual(writes, ['finance_account', 'finance_alert', 'finance_trade', 'finance_watch'])
  assert.equal(actions.find((row) => row.name === 'finance_trade').idempotent, false)
  assert.equal(actions.find((row) => row.name === 'finance_trade').destructive, false)
})

console.log(`\n${failed === 0 ? '✓' : '✗'} ${passed} 通过，${failed} 失败`)
process.exit(failed === 0 ? 0 : 1)
