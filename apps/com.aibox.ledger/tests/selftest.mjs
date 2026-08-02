#!/usr/bin/env node
// com.aibox.ledger 自测：金额精度、表达式求值、事务性写入（WAL）、聚合、AA 口径、AI 工具。
// 直接 import 应用的 lib/（纯 ESM、无裸依赖），跑的就是上线的那份代码。
//
//   node apps/com.aibox.ledger/tests/selftest.mjs
//
// 不在 src/ 里 —— 校验与发布都只打包 src/，测试永远不会进包。

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')

let passed = 0
let failed = 0
const failures = []

function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) { passed += 1; return }
  failed += 1
  failures.push(`${name}\n    期望 ${e}\n    实际 ${a}`)
}

function throws(name, fn, code) {
  try {
    fn()
    failed += 1
    failures.push(`${name}\n    期望抛 ${code}，但没抛`)
  } catch (error) {
    if (error.code === code) passed += 1
    else { failed += 1; failures.push(`${name}\n    期望 ${code}，实际 ${error.code ?? error.message}`) }
  }
}

// ——————————————————————————————————————————————————————————————
// 假的 aibox.db：内存实现 + 可注入的写失败，用来验「写失败 → 回滚 → 只读」与 WAL 重放。
// ——————————————————————————————————————————————————————————————
function installFakeHost() {
  let collections = new Map()
  const state = { failNextWrites: 0, writeLog: [], reset() { collections = new Map() } }
  const rowsOf = (name) => {
    if (!collections.has(name)) collections.set(name, [])
    return collections.get(name)
  }
  globalThis.window = {
    aibox: {
      db: {
        async insert({ collection, document }) {
          if (state.failNextWrites > 0) { state.failNextWrites -= 1; throw new Error('aibox/io-error: disk full') }
          const rows = rowsOf(collection)
          const id = document._id
          const index = rows.findIndex((row) => row._id === id)
          const stored = JSON.parse(JSON.stringify(document))
          if (index >= 0) rows[index] = stored
          else rows.push(stored)
          state.writeLog.push(`insert:${collection}/${id}`)
          return stored
        },
        async remove({ collection, id }) {
          if (state.failNextWrites > 0) { state.failNextWrites -= 1; throw new Error('aibox/io-error: disk full') }
          const rows = rowsOf(collection)
          const before = rows.length
          const next = rows.filter((row) => row._id !== id)
          collections.set(collection, next)
          state.writeLog.push(`remove:${collection}/${id}`)
          return next.length !== before
        },
        async query({ collection, limit = 100, offset = 0 }) {
          const rows = rowsOf(collection)
          return JSON.parse(JSON.stringify(rows.slice(offset, offset + Math.min(500, limit))))
        },
      },
    },
  }
  globalThis.localStorage = {
    _map: new Map(),
    getItem(key) { return this._map.has(key) ? this._map.get(key) : null },
    setItem(key, value) { this._map.set(key, String(value)) },
  }
  return { collections, state }
}

const host = installFakeHost()

const expr = await import(`${SRC}/lib/expression.js`)
const moneyLib = await import(`${SRC}/lib/money.js`)
const { LedgerStore, KIND, countsInFlow, signedAmountMinor } = await import(`${SRC}/lib/store.js`)
const entries = await import(`${SRC}/lib/entries.js`)
const entities = await import(`${SRC}/lib/entities.js`)
const balancesLib = await import(`${SRC}/lib/balances.js`)
const reporting = await import(`${SRC}/lib/reporting.js`)
const queries = await import(`${SRC}/lib/queries.js`)
const splitLib = await import(`${SRC}/lib/split.js`)
const csv = await import(`${SRC}/lib/csv.js`)
const dates = await import(`${SRC}/lib/dates.js`)
const actions = await import(`${SRC}/lib/actions.js`)
const actionsEntities = await import(`${SRC}/lib/actions-entities.js`)

/** 每个测试段都从一个**干净的库**开始（真实宿主里每个 applet 有自己的隔离库）。 */
async function freshStore(locale) {
  host.state.reset()
  const fresh = new LedgerStore()
  await fresh.open(locale)
  return fresh
}

// ============================================================
console.log('\n▸ 1. 表达式求值（规格 §4.1 的样例逐条当测试用例）')
// ============================================================
check('12+8*2 → minor', expr.evaluateMinor('12+8*2'), 2800)
check('12+8*2 → display', expr.displayValue('12+8*2'), '28')
check('28+16.5 → minor', expr.evaluateMinor('28+16.5'), 4450)
check('28+16.5 → display', expr.displayValue('28+16.5'), '44.5')
check('(1+2)*3 → minor', expr.evaluateMinor('(1+2)*3'), 900)
check('(1+2)*3 → display', expr.displayValue('(1+2)*3'), '9')
check('1,5 → minor（逗号即小数点）', expr.evaluateMinor('1,5'), 150)
check('1,5 → display', expr.displayValue('1,5'), '1.5')
check('10/3 → minor', expr.evaluateMinor('10/3'), 333)
check('10/3 → display', expr.displayValue('10/3'), '3.33')
throws('10/0 → divisionByZero', () => expr.evaluateMinor('10/0'), 'divisionByZero')
throws('1+ → missingOperand', () => expr.evaluateMinor('1+'), 'missingOperand')
throws('空串 → empty', () => expr.evaluateMinor('   '), 'empty')
throws('(1+2 → mismatchedParenthesis', () => expr.evaluateMinor('(1+2'), 'mismatchedParenthesis')
throws('1+2) → mismatchedParenthesis', () => expr.evaluateMinor('1+2)'), 'mismatchedParenthesis')
throws('1.2.3 → invalidToken', () => expr.evaluateMinor('1.2.3'), 'invalidToken')

console.log('  · 全角运算符预归一')
check('12−4 (U+2212)', expr.evaluateMinor('12−4'), 800)
check('3×4', expr.evaluateMinor('3×4'), 1200)
check('12÷4', expr.evaluateMinor('12÷4'), 300)
check('1，5（全角逗号）', expr.evaluateMinor('1，5'), 150)

console.log('  · 精确有理数：定点/浮点实现会在这里翻车')
check('10/3*3 恒等于 10（无中间舍入漂移）', expr.evaluateMinor('10/3*3'), 1000)
check('0.1+0.2 = 0.30（浮点会给 0.30000000000000004）', expr.evaluateMinor('0.1+0.2'), 30)
check('1/3+1/3+1/3 = 1', expr.evaluateMinor('1/3+1/3+1/3'), 100)
check('0.005 四舍五入到分（half away from zero）', expr.evaluateMinor('0.005'), 1)
check('-0.005 负向也 half away from zero', expr.evaluateMinor('-0.005'), -1)
check('大额不失精度 99999999.99', expr.evaluateMinor('99999999.99'), 9999999999)
check('一元负号 -5', expr.evaluateMinor('-5'), -500)
check('嵌套括号 ((2+3)*(4-1))/3', expr.evaluateMinor('((2+3)*(4-1))/3'), 500)
check('displayValue 丢负号（有意复刻的原生怪癖）', expr.displayValue('-5'), '5')

console.log('  · 计算器键盘输入规则')
check('空串只允许负号', expr.appendOperator('', '+'), '')
check('空串接受负号', expr.appendOperator('', '−'), '−')
check('末尾运算符被替换而非追加', expr.appendOperator('12+', '×'), '12×')
check('小数点：token 已有则忽略', expr.appendDot('1.5'), '1.5')
check('小数点：token 为空补 0.', expr.appendDot('12+'), '12+0.')
check('数字：小数位 ≥2 忽略', expr.appendDigit('1.23', '4'), '1.23')
check('数字：token 为 "0" 时替换（禁止 07）', expr.appendDigit('0', '7'), '7')
check('数字：0. 之后可继续', expr.appendDigit('0.', '7'), '0.7')
check('currentToken 按运算符切分', expr.currentToken('12+8*2'), '2')
check('currentToken 括号也切分', expr.currentToken('(1+2'), '2')

// ============================================================
console.log('\n▸ 2. 金额格式化（§6.1 / §6.2）')
// ============================================================
check('money 千分位 + 2 位小数', moneyLib.money(123456, 'CNY'), '¥1,234.56')
check('money 负号用 U+2212', moneyLib.money(-123456, 'CNY'), '−¥1,234.56')
check('money signed 正数补 +', moneyLib.money(123456, 'CNY', { signed: true }), '+¥1,234.56')
check('JPY 是 0 位币（不输出小数部分）', moneyLib.money(123400, 'JPY'), '¥1,234')
check('未知币种符号回退 "{CODE} "', moneyLib.money(100, 'XYZ'), 'XYZ 1.00')
check('moneyCompact ≥1k', moneyLib.moneyCompact(1234567, 'CNY'), '¥12.3k')
check('moneyCompact ≥1M', moneyLib.moneyCompact(123456789, 'CNY'), '¥1.2M')
check('moneyCompact <1k', moneyLib.moneyCompact(12345, 'CNY'), '¥123')
check('plainMajor 取绝对值丢符号', moneyLib.plainMajor(-123456), '1234.56')
check('parseMajorToMinor 去符号与千分位', moneyLib.parseMajorToMinor('¥1,234.56'), 123456)
check('majorNumberToMinor 12.5', moneyLib.majorNumberToMinor(12.5), 1250)
check('majorNumberToMinor 浮点噪声 8.15', moneyLib.majorNumberToMinor(8.15), 815)
check('majorNumberToMinor 1.005', moneyLib.majorNumberToMinor(1.005), 101)

// ============================================================
console.log('\n▸ 3. 首启种子（§4.8 完整清单）')
// ============================================================
const store = await freshStore('zh-Hans')
check('持久层状态 ready', store.state, 'ready')
check('可写', store.canMutate, true)
check('支出一级分类 10 个', store.rootCategories('expense').length, 10)
check('支出二级分类 34 个', store.categories.filter((r) => r.kind === 'expense' && r.parentID).length, 34)
check('收入分类 7 个（全一级）', store.rootCategories('income').length, 7)
check('默认账户 4 个', store.accounts.length, 4)
check('币种表种入基准币 CNY', store.baseCode, 'CNY')
check('餐饮有 6 个子类', store.childCategories(store.rootCategories('expense')[0].id).length, 6)
check('二级继承父色', store.childCategories(store.rootCategories('expense')[0].id)[0].colorHex, '#E8863C')
check('中文种子按 locale 物化', store.rootCategories('expense')[0].name, '餐饮')
check('展示路径「父 / 子」',
  store.categoryPath(store.childCategories(store.rootCategories('expense')[0].id)[0].id), '餐饮 / 早餐')

const cash = store.accounts.find((a) => a.name === '现金')
const bank = store.accounts.find((a) => a.name === '银行卡')
const food = store.rootCategories('expense')[0]
const breakfast = store.childCategories(food.id)[0]
const salary = store.rootCategories('income')[0]

// 重开一次：验证种子不回灌
const reopened = new LedgerStore()
await reopened.open('zh-Hans')
check('重开后分类不回灌（仍 51 条）', reopened.categories.length, 51)

// ============================================================
console.log('\n▸ 4. 流水与余额（§4.4 / §10 铁律）')
// ============================================================
await entities.updateAccount(store, cash.id, {})   // no-op，验证 mutate 空操作也算成功
check('空 mutate 也报成功', store.lastMutationSucceeded, true)

const r1 = await entries.recordEntry(store, {
  kind: KIND.expense, amountMinor: expr.evaluateMinor('28+16.5'),
  accountID: cash.id, categoryID: breakfast.id, calculationExpression: '28+16.5',
})
check('记一笔成功', r1.ok, true)
check('金额恒正', r1.transaction.amountMinor, 4450)
check('原始表达式被保留', r1.transaction.calculationExpression, '28+16.5')
check('入账时冻结基准币金额', r1.transaction.baseAmountMinorAtPosting, 4450)
check('支出的有符号金额为负', signedAmountMinor(r1.transaction), -4450)
check('支出计入收支报表', countsInFlow(r1.transaction), true)

const r2 = await entries.recordEntry(store, {
  kind: KIND.income, amountMinor: 800000, accountID: bank.id, categoryID: salary.id,
})
check('收入落账', r2.ok, true)
check('现金余额 = -44.50', balancesLib.balanceMinor(store, store.account(cash.id)), -4450)
check('银行卡余额 = 8000.00', balancesLib.balanceMinor(store, store.account(bank.id)), 800000)

console.log('  · 转账两腿')
const t1 = await entries.recordTransfer(store, {
  fromAccountID: bank.id, toAccountID: cash.id, amountMinor: 100000,
})
check('转账成功', t1.ok, true)
check('两腿互指', [t1.transaction.transferPeerID === t1.peer.id, t1.peer.transferPeerID === t1.transaction.id], [true, true])
check('转出腿 kind', t1.transaction.kind, KIND.transferOut)
check('转入腿 kind', t1.peer.kind, KIND.transferIn)
check('转账不计入收支报表', [countsInFlow(t1.transaction), countsInFlow(t1.peer)], [false, false])
check('转账后现金 = -44.50 + 1000', balancesLib.balanceMinor(store, store.account(cash.id)), 95550)
check('转账后银行卡 = 8000 - 1000', balancesLib.balanceMinor(store, store.account(bank.id)), 700000)

console.log('  · 净资产（§4.4）')
const balances = balancesLib.balancesByAccount(store)
const worth = balancesLib.netWorth(store, balances)
check('净资产 = 全部求和', worth.net, 95550 + 700000)
check('资产 = 只加正数', worth.assets, 95550 + 700000)
check('负债 = 0', worth.liabilities, 0)

console.log('  · 信用账户欠款用负余额表达')
const credit = await entities.createAccount(store, {
  name: '信用卡', kind: 'credit', currency: 'CNY', initialBalanceMinor: 150000, creditLimitMinor: 2000000,
})
check('credit 的正初始余额被取负', credit.account.initialBalanceMinor, -150000)
const worth2 = balancesLib.netWorth(store, balancesLib.balancesByAccount(store))
check('负债计入', worth2.liabilities, 150000)
check('净资产被欠款拉低', worth2.net, 95550 + 700000 - 150000)

console.log('  · 余额校准（§4.4 MOZE 式）')
const before = balancesLib.balanceMinor(store, store.account(cash.id))
const adjusted = await balancesLib.setBalance(store, store.account(cash.id), 100000)
check('校准成功', adjusted.ok, true)
check('delta = 目标 − 当前', adjusted.delta, 100000 - before)
check('校准后余额精确命中', balancesLib.balanceMinor(store, store.account(cash.id)), 100000)
const adjustment = store.allTransactions().find((t) => t.kind === KIND.adjustment)
check('校准流水金额恒正', adjustment.amountMinor > 0, true)
check('校准用独立的有符号增量', adjustment.signedAdjustment, adjusted.delta)
check('校准不计入收支报表', countsInFlow(adjustment), false)
check('同时落了一条 calibration 快照', store.snapshots.some((s) => s.source === 'calibration'), true)
check('校准是幂等的（再校准同值 → noop）',
  (await balancesLib.setBalance(store, store.account(cash.id), 100000)).noop, true)

// ============================================================
console.log('\n▸ 5. 事务性写入：WAL（转账两腿绝不只写一腿）')
// ============================================================
console.log('  · 注入写失败，验证「余额变了但流水没落库」不可能发生')
const beforeCash = balancesLib.balanceMinor(store, store.account(cash.id))
const beforeBank = balancesLib.balanceMinor(store, store.account(bank.id))
const txCountBefore = store.allTransactions().length
host.state.failNextWrites = 1                      // 第一次写就炸（WAL pending 都写不进去）
const doomed = await entries.recordTransfer(store, {
  fromAccountID: bank.id, toAccountID: cash.id, amountMinor: 50000,
})
check('写失败显式返回失败', doomed.ok, false)
check('lastMutationSucceeded = false', store.lastMutationSucceeded, false)
check('持久层切只读', store.state, 'readOnly')
check('内存原样回滚：流水数不变', store.allTransactions().length, txCountBefore)
check('内存原样回滚：现金余额不变', balancesLib.balanceMinor(store, store.account(cash.id)), beforeCash)
check('内存原样回滚：银行卡余额不变', balancesLib.balanceMinor(store, store.account(bank.id)), beforeBank)
check('只读态下不可写', store.canMutate, false)
const blocked = await entries.recordEntry(store, { kind: KIND.expense, amountMinor: 100, accountID: cash.id })
check('只读态的写被阻止', blocked.ok, false)
check('只读态没有偷偷落库', store.allTransactions().length, txCountBefore)

console.log('  · WAL 重放：批次写到一半崩溃 → 重开后收敛到完成态')
// 直接构造一个「pending 存在、ops 只落了一半」的现场。
store.state = 'ready'
const walStore = await freshStore('zh-Hans')
const walCash = walStore.accounts.find((a) => a.name === '现金')
const walBank = walStore.accounts.find((a) => a.name === '银行卡')
// 让「写完 WAL + 第一条 op」之后就炸（第 3 次写失败）。
host.state.failNextWrites = 0
const monthKey = dates.monthKeyOf(Date.now())
const legOutID = 'wal-out'
const legInID = 'wal-in'
const legOut = walStore.makeTransaction({
  id: legOutID, kind: KIND.transferOut, amountMinor: 30000, accountID: walBank.id,
  currency: 'CNY', transferPeerID: legInID,
})
const legIn = walStore.makeTransaction({
  id: legInID, kind: KIND.transferIn, amountMinor: 30000, accountID: walCash.id,
  currency: 'CNY', transferPeerID: legOutID,
})
walStore.applyPostingSnapshot(legOut)
walStore.applyPostingSnapshot(legIn)
// ① 写 WAL pending（含两腿）
await window.aibox.db.insert({
  collection: 'wal',
  document: { _id: 'pending', ops: [{ c: 'tx', id: `m${monthKey}`, rows: [legOut, legIn] }], at: new Date().toISOString() },
})
// ② 崩溃：tx 文档一个字节都没落
const crashed = new LedgerStore()
await crashed.open('zh-Hans')
check('重放后两腿都在', crashed.allTransactions().filter((t) => t.id === legOutID || t.id === legInID).length, 2)
check('重放后 WAL pending 已清', (await window.aibox.db.query({ collection: 'wal', limit: 10 })).length, 0)
check('重放后余额一致（转出腿）', balancesLib.balanceMinor(crashed, crashed.account(walBank.id)) < 0, true)

// ============================================================
console.log('\n▸ 6. 多币种（§4.2）：缺汇率一律按 0，绝不 1:1 伪造')
// ============================================================
const fx = await freshStore('en')
const fxCash = fx.accounts[0]
await entities.addCurrency(fx, 'USD')             // 不带汇率
check('新币种默认 rateConfigured = false', fx.currencyRow('USD').rateConfigured, false)
check('缺汇率 → toBaseMinor 归 0（不伪造）', fx.toBaseMinor(10000, 'USD'), 0)
check('hasUsableRate = false', fx.hasUsableRate('USD'), false)
const usdAccount = await entities.createAccount(fx, { name: 'US Cash', kind: 'cash', currency: 'USD' })
const rejected = await entries.recordEntry(fx, {
  kind: KIND.expense, amountMinor: 10000, accountID: usdAccount.account.id,
})
check('缺汇率时拒绝落账', [rejected.ok, rejected.reason], [false, 'rateNeeded'])
await entities.setRate(fx, 'USD', 7.2)
check('手动设定后标 manual', fx.currencyRow('USD').manualRate, true)
check('换算生效 $100 → ¥720', fx.toBaseMinor(10000, 'USD'), 72000)
const usdEntry = await entries.recordEntry(fx, {
  kind: KIND.expense, amountMinor: 10000, accountID: usdAccount.account.id,
})
check('有汇率后可落账', usdEntry.ok, true)
check('入账冻结基准币金额', usdEntry.transaction.baseAmountMinorAtPosting, 72000)
await entities.setRate(fx, 'USD', 6.0)            // 汇率变了
check('刷新汇率不让历史报表漂移（仍按入账口径）', fx.reportingBaseMinor(fx.transaction(usdEntry.transaction.id)), 72000)
check('在线刷新不覆盖手动锁定的币',
  (await entities.applyFetchedRates(fx, { USD: 0.14 })).changed, false)

console.log('  · 切换基准币重算交叉汇率')
await entities.setBaseCurrency(fx, 'USD')
check('基准币已切换', fx.baseCode, 'USD')
check('原基准币 CNY 的汇率取倒数', Math.abs(fx.currencyRow('CNY').rateToBase - 1 / 6) < 1e-9, true)
check('历史快照跨基准换算', fx.reportingBaseMinor(fx.transaction(usdEntry.transaction.id)), 12000)

// ============================================================
console.log('\n▸ 7. 报表与预算（§4.3）')
// ============================================================
const rep = await freshStore('en')
const repAccount = rep.accounts[0]
const repFood = rep.rootCategories('expense')[0]
const repChild = rep.childCategories(repFood.id)[0]
const repTransport = rep.rootCategories('expense')[1]
const thisMonth = dates.monthKeyOf(Date.now())
const lastMonth = dates.addMonths(thisMonth, -1)

await entries.recordEntry(rep, { kind: KIND.expense, amountMinor: 10000, accountID: repAccount.id, categoryID: repFood.id })
await entries.recordEntry(rep, { kind: KIND.expense, amountMinor: 5000, accountID: repAccount.id, categoryID: repChild.id })
await entries.recordEntry(rep, { kind: KIND.expense, amountMinor: 3000, accountID: repAccount.id, categoryID: repTransport.id })
await entries.recordEntry(rep, { kind: KIND.income, amountMinor: 200000, accountID: repAccount.id })
await entries.recordTransfer(rep, { fromAccountID: repAccount.id, toAccountID: rep.accounts[1].id, amountMinor: 1000 })

const flow = reporting.monthlyFlow(rep, thisMonth)
check('月度支出（转账不计）', flow.expense, 18000)
check('月度收入', flow.income, 200000)
check('结余 = 收入 − 支出', flow.net, 182000)
check('二级分类归并到父类', reporting.spentMinor(rep, thisMonth, repFood.id), 15000)

const bucketRows = queries.buckets(rep, reporting.monthFlowTransactions(rep, thisMonth), 'byCategory', 'expense', 'en')
check('分类桶按 |金额| 降序', bucketRows.map((b) => b.amountMinor), [15000, 3000])
check('桶带分类色', bucketRows[0].colorHex, repFood.colorHex)
const dayRows = queries.buckets(rep, reporting.monthFlowTransactions(rep, thisMonth), 'byDay', 'expense', 'en')
check('时间维度按 key 升序', dayRows.length >= 1, true)

console.log('  · 预算结转（结转开关挂在上个月那一行）')
await entities.upsertBudget(rep, lastMonth, repFood.id, 100000, true)   // 上月额度 1000，开结转
await entities.upsertBudget(rep, thisMonth, repFood.id, 50000, false)   // 本月额度 500
const payload = reporting.budgetPayload(rep, thisMonth)
check('本月有效额度 = 500 + 上月未花完 1000', payload.lines[0].limitMinor, 150000)
check('结转金额被标注', payload.lines[0].carriedMinor, 100000)
check('没有显式总预算时总额 = 各分类之和', payload.totalLimitMinor, 150000)
check('已花 = 该分类含子类', payload.lines[0].spentMinor, 15000)
check('剩余可为负也照实算', payload.remainingMinor, 150000 - 18000)

await entities.upsertBudget(rep, thisMonth, null, 300000, false)
check('有显式总预算就用它', reporting.budgetPayload(rep, thisMonth).totalLimitMinor, 300000)
await entities.upsertBudget(rep, thisMonth, null, 0, false)
check('limit ≤ 0 = 删除该预算行', reporting.budgetPayload(rep, thisMonth).hasExplicitTotal, false)

console.log('  · 超支不产生负结转')
// 上月记一笔 200 的交通支出，额度只给 0.01 → 必然超支
await entries.recordEntry(rep, {
  kind: KIND.expense, amountMinor: 20000, accountID: repAccount.id, categoryID: repTransport.id,
  occurredOn: dates.monthStart(lastMonth) + 5 * dates.DAY_MS,
})
await entities.upsertBudget(rep, lastMonth, repTransport.id, 1, true)
await entities.upsertBudget(rep, thisMonth, repTransport.id, 20000, false)
const transportLine = reporting.budgetPayload(rep, thisMonth).lines.find((l) => l.categoryID === repTransport.id)
check('超支时 carried = 0（不是负数）', transportLine.carriedMinor, 0)
check('lines 按额度从大到小', reporting.budgetPayload(rep, thisMonth).lines.map((l) => l.limitMinor), [150000, 20000])

// ============================================================
console.log('\n▸ 8. AA 分摊与结算（§4.6）：Σ 恒等，净额加总恒为 0')
// ============================================================
const aa = await freshStore('en')
const aaAccount = aa.accounts[0]
const trip = await entities.createProject(aa, { name: 'Kyoto', isActive: true })
const me = await entities.addMember(aa, trip.project.id, { name: 'Me', isMe: true })
const bob = await entities.addMember(aa, trip.project.id, { name: 'Bob' })
const carol = await entities.addMember(aa, trip.project.id, { name: 'Carol' })

check('分摊零头落在数组第一位（100 三等分）',
  splitLib.resolveSplit({ mode: 'equal', shares: [{ memberID: 'a' }, { memberID: 'b' }, { memberID: 'c' }] }, 10000)
    .map((r) => r.amountMinor), [3334, 3333, 3333])
check('Σ 恒等于总额',
  splitLib.resolveSplit({ mode: 'equal', shares: [{ memberID: 'a' }, { memberID: 'b' }, { memberID: 'c' }] }, 10000)
    .reduce((s, r) => s + r.amountMinor, 0), 10000)
check('percent 模式',
  splitLib.resolveSplit({ mode: 'percent', shares: [{ memberID: 'a', value: 70 }, { memberID: 'b', value: 30 }] }, 10000)
    .map((r) => r.amountMinor), [7000, 3000])
check('shares 权重 2:1',
  splitLib.resolveSplit({ mode: 'shares', shares: [{ memberID: 'a', value: 2 }, { memberID: 'b', value: 1 }] }, 9000)
    .map((r) => r.amountMinor), [6000, 3000])
check('exact 模式：零头（total − Σ）进第一位',
  splitLib.resolveSplit({ mode: 'exact', shares: [{ memberID: 'a', value: 30 }, { memberID: 'b', value: 30 }] }, 10000)
    .map((r) => r.amountMinor), [7000, 3000])

// 我垫付 300，三人均摊
await entries.recordEntry(aa, {
  kind: KIND.expense, amountMinor: 30000, accountID: aaAccount.id, projectID: trip.project.id,
  payerMemberID: me.member.id,
  split: { mode: 'equal', shares: [{ memberID: me.member.id }, { memberID: bob.member.id }, { memberID: carol.member.id }] },
})
const net = splitLib.memberBalances(aa, trip.project.id)
check('付款人是债权人', net[me.member.id], 20000)
check('其余人是债务人', [net[bob.member.id], net[carol.member.id]], [-10000, -10000])
check('净额加总恒为 0', Object.values(net).reduce((a, b) => a + b, 0), 0)

const plan = splitLib.settlementPlan(aa, trip.project.id)
check('最少笔数方案（2 笔）', plan.length, 2)
check('方案金额加总 = 债权额', plan.reduce((s, r) => s + r.amountMinor, 0), 20000)

const settled = await splitLib.recordSettlement(aa, trip.project.id, bob.member.id, me.member.id, 10000)
check('结算落库', settled.ok, true)
check('涉及「我」时自动生成真实流水', settled.transaction !== null, true)
check('结算流水是收入（我收钱）', settled.transaction.kind, KIND.income)
check('结算流水刻意不挂 projectID（防重复计入）', settled.transaction.projectID, null)
check('结算记录关联到流水', settled.settlement.linkedTransactionID, settled.transaction.id)
const net2 = splitLib.memberBalances(aa, trip.project.id)
check('结算后 Bob 归零', net2[bob.member.id], 0)
check('结算后我只剩 Carol 的 100', net2[me.member.id], 10000)
check('结算后净额仍加总为 0', Object.values(net2).reduce((a, b) => a + b, 0), 0)

const bobBefore = aa.projectMembers(trip.project.id).length
await entities.removeMember(aa, carol.member.id)
check('删成员后人数 -1', aa.projectMembers(trip.project.id).length, bobBefore - 1)
check('删成员后净额仍加总为 0',
  Object.values(splitLib.memberBalances(aa, trip.project.id)).reduce((a, b) => a + b, 0), 0)

// ============================================================
console.log('\n▸ 9. 软删 / 恢复 / 最近删除（§2.11）')
// ============================================================
const del = await freshStore('en')
const delAccount = del.accounts[0]
const one = await entries.recordEntry(del, { kind: KIND.expense, amountMinor: 1000, accountID: delAccount.id })
const pair = await entries.recordTransfer(del, {
  fromAccountID: delAccount.id, toAccountID: del.accounts[1].id, amountMinor: 2000,
})
await entries.deleteEntry(del, one.transaction.id)
check('软删后不在正常列表里', del.allTransactions().some((t) => t.id === one.transaction.id), false)
check('软删后仍在库里（tombstone）',
  del.allTransactionsIncludingDeleted().find((t) => t.id === one.transaction.id).deletedAt !== null, true)
await entries.deleteEntry(del, pair.transaction.id)
check('转账两腿一起软删',
  del.allTransactionsIncludingDeleted().filter((t) => t.transferPeerID && t.deletedAt).length, 2)
check('最近删除里转账只出现一次', entries.recentlyDeleted(del).length, 2)
await entries.restoreEntry(del, pair.transaction.id)
check('恢复也是两腿一起',
  del.allTransactions().filter((t) => t.transferPeerID).length, 2)
await entries.purgeEntry(del, pair.transaction.id)
check('永久删除两腿一起', del.allTransactionsIncludingDeleted().filter((t) => t.transferPeerID).length, 0)

// ============================================================
console.log('\n▸ 10. CSV 往返（§2.10）：导出 → 导入幂等')
// ============================================================
const text = csv.exportCSV(rep)
check('CRLF 换行', text.includes('\r\n'), true)
check('22 列表头', text.split('\r\n')[0].split(',').length, 22)
check('表头顺序固定', text.split('\r\n')[0], csv.CSV_COLUMNS.join(','))

const importer = new LedgerStore()
await importer.open('en')
const draft = csv.parseImport(text, importer)
check('解析零问题', draft.problems.length, 0)
check('有效行数 = 导出流水数', draft.rows.length, rep.allTransactions().length)
const imported = await csv.performImport(importer, draft.rows)
check('全部导入', imported.imported, draft.rows.length)
check('无失败', imported.failed, 0)
const reimported = await csv.performImport(importer, csv.parseImport(text, importer).rows)
check('二次导入全部按重复跳过（幂等）', reimported.skipped, draft.rows.length)
check('二次导入零新增', reimported.imported, 0)
check('转账互指在导入后被还原',
  importer.allTransactions().filter((t) => t.transferPeerID
    && importer.transaction(t.transferPeerID)).length, 2)

const badColumns = csv.parseImport('a,b,c\n1,2,3\n', importer)
check('列数不符时明确报错', badColumns.problems[0].message.includes('do not match'), true)
check('RFC 4180 转义往返', csv.parseCSV('a,"b,""c""",d\r\n')[0], ['a', 'b,"c"', 'd'])

// ============================================================
console.log('\n▸ 11. AI 工具面（§8.4）：与 UI 同一条写路径')
// ============================================================
const ai = await freshStore('zh-Hans')
const rec = await actions.actionRecord(ai, { amount: 12.5, category: '早餐', account: '现金', note: '豆浆油条' }, 'zh-Hans')
check('ledger_record 成功', rec.ok, true)
check('浮点金额第一步转整数分', ai.transaction(rec.id).amountMinor, 1250)
check('AI 记账 source = ai', ai.transaction(rec.id).source, 'ai')
check('分类名解析命中二级', ai.categoryPath(ai.transaction(rec.id).categoryID), '餐饮 / 早餐')

const dup = await actions.actionRecord(ai, { amount: 30, request_id: 'req-1', account: '现金' }, 'zh-Hans')
const dup2 = await actions.actionRecord(ai, { amount: 30, request_id: 'req-1', account: '现金' }, 'zh-Hans')
check('幂等键同键只落一次', dup2.duplicate, true)
check('幂等重试返回同一条', dup2.id, dup.id)

await entities.createProject(ai, { name: '出差', isActive: true })
const noProject = await actions.actionRecord(ai, { amount: 20, account: '现金' }, 'zh-Hans')
check('AI 记账缺省不归任何项目（即使有当前项目）', ai.transaction(noProject.id).projectID, null)

const ambiguous = await actions.actionRecord(ai, { amount: 10, account: '钱包' }, 'zh-Hans')
check('账户歧义回候选清单而不是硬报错', ambiguous.ok, false)
check('候选清单可读', ambiguous.text.includes('Candidates'), true)

const kindWord = await actions.actionRecord(ai, { amount: 10, account: '银行卡' }, 'zh-Hans')
check('种类词「银行卡」解析到 debit（不被「钱包」吞掉）',
  ai.account(ai.transaction(kindWord.id).accountID).kind, 'debit')

const q = await actions.actionQuery(ai, { period: 'this_month', limit: 5 }, 'zh-Hans')
check('ledger_query 返回条数', q.count >= 4, true)
check('返回文本带 [id:] 便于后续 update', q.text.includes('[id:'), true)
const st = await actions.actionStats(ai, { dimension: 'by_category', metric: 'expense' }, 'zh-Hans', {})
check('ledger_stats 与 UI 共用 buckets', Array.isArray(st.buckets), true)
const bg = await actions.actionBudget(ai, { action: 'set', limit: 500, category: '餐饮' }, 'zh-Hans')
check('ledger_budget set 成功', bg.ok, true)
check('ledger_budget status 反映刚设的额度',
  (await actions.actionBudget(ai, { action: 'status' }, 'zh-Hans')).payload.totalLimitMinor, 50000)
const acc = await actionsEntities.actionAccount(ai, { action: 'list' }, 'zh-Hans')
check('ledger_account list 带净资产', acc.text.includes('Net worth'), true)
const cat = await actionsEntities.actionCategory(ai, { action: 'create', name: '宠物' }, 'zh-Hans')
check('ledger_category create', cat.ok, true)
const cur = await actionsEntities.actionCurrency(ai, { action: 'add', code: '马币' }, 'zh-Hans')
check('币种俗名归一成 ISO 码', ai.currencyRow('MYR') !== null, true)
check('无汇率时明确告知被排除在汇总外', cur.text.includes('EXCLUDED'), true)
const proj = await actionsEntities.actionProject(ai, { action: 'add_member', name: '出差', member: 'Ann' }, 'zh-Hans')
check('add_member 时自动补「我」',
  ai.projectMembers(ai.projects.find((p) => p.name === '出差').id).some((m) => m.isMe), true)

console.log('  · AI 工具在只读态必须显式说「没保存」')
ai.state = 'readOnly'
const readOnlyResult = await actions.actionRecord(ai, { amount: 99, account: '现金' }, 'zh-Hans')
check('只读态返回失败', readOnlyResult.ok, false)
check('错误文本明说 NOT saved', readOnlyResult.text.includes('NOT saved'), true)

// ============================================================
console.log('\n▸ 12. AI 工具在 headless（零 UI）下可用')
// ============================================================
// 模拟宿主把 manifest.actions[] 投影成延迟工具后回调页面：注册 → 直接调，全程不碰任何 React。
const registered = new Map()
window.aibox.action = { register: (name, handler) => registered.set(name, handler) }
const { registerLedgerActions, ACTION_HANDLERS } = await import(`${SRC}/lib/register-actions.js`)

host.state.reset()
const headless = new LedgerStore()     // **故意不 open()**：模拟冷启动被 AI 直接调用
registerLedgerActions(() => ({ store: headless, locale: 'zh-Hans', labels: {} }))

check('注册了 8 个 AI 工具', registered.size, 8)
check('工具名与 manifest.actions 对齐',
  [...registered.keys()].sort(),
  ['account', 'budget', 'category', 'currency', 'project', 'query', 'record', 'stats'])
check('未打开的库状态是 unopened', headless.state, 'unopened')

const headlessRecord = await registered.get('record')({ amount: 9.9, category: '早餐', account: '现金' })
check('冷启动调用会自动开库', headless.state, 'ready')
check('headless 记账成功', headlessRecord.ok, true)
check('headless 落库真的写进去了', headless.transaction(headlessRecord.id).amountMinor, 990)
check('headless 结果是 JSON 可序列化的',
  typeof JSON.parse(JSON.stringify(headlessRecord)).text, 'string')

const headlessStats = await registered.get('stats')({ dimension: 'by_category' })
check('headless 统计可用', headlessStats.ok, true)
const headlessAccount = await registered.get('account')({ action: 'list' })
check('headless 账户可用', headlessAccount.ok, true)
check('每个注册名都能在 ACTION_HANDLERS 里找到实现',
  Object.keys(ACTION_HANDLERS).sort(), [...registered.keys()].sort())

console.log('  · 处理器内部抛错也不会把宿主炸掉')
const guarded = await registered.get('record')({ amount: 'not-a-number' })
check('非法参数返回结构化失败而不是抛异常', guarded.ok, false)

// ============================================================
console.log('\n▸ 13. 日期口径（§6.4）')
// ============================================================
check('月键格式 YYYYMM', dates.monthKeyOf(new Date(2026, 6, 15)), 202607)
check('跨年月份加减', dates.addMonths(202601, -1), 202512)
check('月份天数', dates.daysInMonth(202602), 28)
check('闰年', dates.daysInMonth(202402), 29)
check('查过去月剩余天数 = 0', dates.daysRemainingInMonth(202001, Date.now()), 0)
check('查未来月剩余天数 = 整月', dates.daysRemainingInMonth(209901, Date.now()), 31)
check('剩余天数含今天',
  dates.daysRemainingInMonth(202607, new Date(2026, 6, 31, 12).getTime()), 1)
check('ISO 日用本地时区', dates.isoDay(new Date(2026, 6, 4, 23, 30).getTime()), '2026-07-04')
check('宽松解析取前 10 字符', dates.parseISODay('2026-07-04T10:00:00Z'), new Date(2026, 6, 4).getTime())
check('自然语言「昨天」',
  actions.parseFlexibleDate('昨天', new Date(2026, 6, 4, 10).getTime()), new Date(2026, 6, 3).getTime())
check('自然语言「3天前」',
  actions.parseFlexibleDate('3天前', new Date(2026, 6, 4, 10).getTime()), new Date(2026, 6, 1).getTime())
check('记账日归一到当天 00:00',
  del.allTransactionsIncludingDeleted()[0].occurredOn, dates.dayStart(del.allTransactionsIncludingDeleted()[0].occurredOn))

// ============================================================
console.log(`\n${'─'.repeat(60)}`)
if (failed === 0) {
  console.log(`✓ 全部通过：${passed} 条断言`)
  process.exit(0)
}
console.log(`✗ ${failed} 条失败 / ${passed + failed} 条断言\n`)
for (const line of failures) console.log(`  ✗ ${line}`)
process.exit(1)
