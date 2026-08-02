// AA 分摊、成员净额与结算（§4.6）。金额一律**基准币分**。

import { KIND, newID } from './store.js'
import { dayStart } from './dates.js'

export const SPLIT_MODES = ['equal', 'exact', 'shares', 'percent']

/**
 * 分摊求解：返回 `[{memberID, amountMinor}]`，**Σ 恒等于 total**。
 * 零头加到**份额数组第一位**；调用方总把付款人排到首位 → 付款人吃零头。
 */
export function resolveSplit(split, totalMinor) {
  const shares = (split && Array.isArray(split.shares)) ? split.shares : []
  if (shares.length === 0) return []
  const total = Math.round(totalMinor)
  const mode = split.mode ?? 'equal'
  const out = shares.map((share) => ({ memberID: share.memberID, amountMinor: 0 }))

  if (mode === 'equal') {
    const each = Math.trunc(total / shares.length)
    for (const row of out) row.amountMinor = each
  } else if (mode === 'exact') {
    shares.forEach((share, index) => {
      const value = Number(share.value) || 0
      out[index].amountMinor = value < 0 ? -Math.round(-value * 100) : Math.round(value * 100)
    })
  } else if (mode === 'shares') {
    const weights = shares.map((share) => Math.max(0, Number(share.value) || 0))
    const sum = weights.reduce((acc, value) => acc + value, 0)
    if (sum > 0) weights.forEach((weight, index) => { out[index].amountMinor = Math.round(total * weight / sum) })
  } else if (mode === 'percent') {
    shares.forEach((share, index) => {
      const percent = Math.max(0, Number(share.value) || 0)
      out[index].amountMinor = Math.round(total * percent / 100)
    })
  }

  const assigned = out.reduce((acc, row) => acc + row.amountMinor, 0)
  out[0].amountMinor += total - assigned
  return out
}

/** 项目里的「我」（没有则 null）。 */
export function meMember(store, projectID) {
  return store.projectMembers(projectID).find((row) => row.isMe) ?? null
}

/**
 * 成员净额（基准币分，全体加总恒为 0）：
 *   付款人先垫付全额 → 每个分摊人扣自己应担 → 未分摊则全归付款人自担（净 0）
 *   再叠加已记录的结算：net[from] += 金额；net[to] -= 金额
 * `>0` = 别人欠 TA；`<0` = TA 欠别人。
 */
export function memberBalances(store, projectID) {
  const members = store.projectMembers(projectID)
  const net = {}
  for (const member of members) net[member.id] = 0
  const me = members.find((row) => row.isMe)

  for (const txn of store.allTransactions()) {
    if (txn.projectID !== projectID || txn.kind !== KIND.expense) continue
    const base = store.reportingBaseMinor(txn)
    const payerID = txn.payerMemberID ?? (me ? me.id : null)
    if (!payerID || net[payerID] === undefined) continue
    net[payerID] += base
    const resolved = txn.split ? resolveSplit(txn.split, base) : []
    if (resolved.length > 0) {
      for (const row of resolved) {
        if (net[row.memberID] === undefined) continue
        net[row.memberID] -= row.amountMinor
      }
    } else {
      net[payerID] -= base
    }
  }

  for (const settlement of store.projectSettlements(projectID)) {
    if (net[settlement.fromMemberID] !== undefined) net[settlement.fromMemberID] += settlement.amountBaseMinor
    if (net[settlement.toMemberID] !== undefined) net[settlement.toMemberID] -= settlement.amountBaseMinor
  }
  return net
}

/** 贪心 min-cash-flow：最少笔数把所有净额归零。返回 `[{fromMemberID, toMemberID, amountMinor}]`。 */
export function settlementPlan(store, projectID) {
  const net = memberBalances(store, projectID)
  const creditors = Object.entries(net).filter(([, value]) => value > 0)
    .map(([id, value]) => ({ id, value })).sort((a, b) => b.value - a.value)
  const debtors = Object.entries(net).filter(([, value]) => value < 0)
    .map(([id, value]) => ({ id, value: -value })).sort((a, b) => b.value - a.value)

  const plan = []
  let ci = 0
  let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].value, debtors[di].value)
    if (amount > 0) plan.push({ fromMemberID: debtors[di].id, toMemberID: creditors[ci].id, amountMinor: amount })
    creditors[ci].value -= amount
    debtors[di].value -= amount
    if (creditors[ci].value <= 0) ci += 1
    if (debtors[di].value <= 0) di += 1
  }
  return plan
}

/**
 * 记一次结算。若 from/to 里有「我」→ **自动生成一笔真实流水**
 * （我收 = income、我付 = expense，换算到该账户币种，source='settlement'，
 * **刻意不挂 projectID** —— 否则会被对账逻辑重复计入），并用 linkedTransactionID 关联。
 * 结算记录与流水在同一次 mutate 里落地（WAL 保证不会只写一半）。
 */
export async function recordSettlement(store, projectID, fromMemberID, toMemberID, amountBaseMinor, options = {}) {
  const amount = Math.abs(Math.round(amountBaseMinor))
  if (amount <= 0) return { ok: false, reason: 'invalidAmount' }
  const from = store.member(fromMemberID)
  const to = store.member(toMemberID)
  if (!from || !to) return { ok: false, reason: 'notFound' }

  const now = Date.now()
  let linked = null
  if (from.isMe || to.isMe) {
    const account = options.account ?? store.defaultAccount()
    if (account) {
      const counterpart = from.isMe ? to : from
      const converted = store.convertMinor(amount, store.baseCode, account.currency)
      linked = store.makeTransaction({
        kind: from.isMe ? KIND.expense : KIND.income,
        amountMinor: converted,
        accountID: account.id,
        currency: account.currency,
        occurredOn: now,
        source: 'settlement',
        note: from.isMe
          ? `AA settlement to ${counterpart.name}`
          : `AA settlement from ${counterpart.name}`,
        projectID: null,
      })
      store.applyPostingSnapshot(linked)
    }
  }

  const settlement = {
    id: newID(),
    projectID,
    fromMemberID,
    toMemberID,
    amountBaseMinor: amount,
    occurredOn: dayStart(now),
    createdAt: now,
    linkedTransactionID: linked ? linked.id : null,
  }
  const ok = await store.mutate((draft) => {
    if (linked) draft.putTx(linked)
    draft.table('settlements').push(settlement)
  })
  return ok ? { ok: true, settlement, transaction: linked } : { ok: false, reason: 'persistence' }
}

/** 删除结算 → 连带软删关联流水。 */
export async function removeSettlement(store, id) {
  const settlement = store.settlements.find((row) => row.id === id)
  if (!settlement) return { ok: false, reason: 'notFound' }
  const now = Date.now()
  const ok = await store.mutate((draft) => {
    const rows = draft.table('settlements')
    const index = rows.findIndex((row) => row.id === id)
    if (index >= 0) rows.splice(index, 1)
    if (settlement.linkedTransactionID) {
      const linked = draft.tx(settlement.linkedTransactionID)
      if (linked) draft.putTx({ ...linked, deletedAt: now })
    }
    return true
  })
  return ok ? { ok: true } : { ok: false, reason: 'persistence' }
}

/** 项目已花（基准币，支出合计）。 */
export function projectSpentMinor(store, projectID) {
  let total = 0
  for (const txn of store.allTransactions()) {
    if (txn.projectID !== projectID || txn.kind !== KIND.expense) continue
    total += store.reportingBaseMinor(txn)
  }
  return total
}

export function projectIncomeMinor(store, projectID) {
  let total = 0
  for (const txn of store.allTransactions()) {
    if (txn.projectID !== projectID || txn.kind !== KIND.income) continue
    total += store.reportingBaseMinor(txn)
  }
  return total
}
