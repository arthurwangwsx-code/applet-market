// 账户余额、净资产、余额校准（§4.4）。
import { DAY_MS, dayStart } from './dates.js';
import { KIND, newID, signedAmountMinor } from './store.js';
/** 估值型账户（investment）走快照，其余从流水派生。 */
export function derivesBalanceFromFlow(account) {
    return account.kind !== 'investment';
}
/**
 * 单账户余额：
 *   cutoff = dayStart(asOf) + 24h                      // 含当天
 *   投资账户 → cutoff 前最近一条快照，没有则 initialBalanceMinor
 *   其它     → initialBalanceMinor + Σ(未软删、occurredOn < cutoff 的 signedAmountMinor)
 */
export function balanceMinor(store, account, asOf = Date.now()) {
    const cutoff = dayStart(asOf) + DAY_MS;
    if (!derivesBalanceFromFlow(account)) {
        const rows = store.snapshots
            .filter((row) => row.accountID === account.id && row.date < cutoff)
            .sort((a, b) => b.date - a.date);
        return rows[0]?.balanceMinor ?? account.initialBalanceMinor;
    }
    let total = account.initialBalanceMinor;
    for (const txn of store.allTransactions()) {
        if (txn.accountID !== account.id)
            continue;
        if (txn.occurredOn >= cutoff)
            continue;
        total += signedAmountMinor(txn);
    }
    return total;
}
/** 整页共用的一份余额快照：`{accountID: minor}`。 */
export function balancesByAccount(store, asOf = Date.now()) {
    const cutoff = dayStart(asOf) + DAY_MS;
    const out = {};
    for (const account of store.accounts) {
        out[account.id] = derivesBalanceFromFlow(account) ? account.initialBalanceMinor : null;
    }
    for (const txn of store.allTransactions()) {
        if (txn.occurredOn >= cutoff)
            continue;
        if (!txn.accountID)
            continue;
        if (out[txn.accountID] === undefined || out[txn.accountID] === null)
            continue;
        out[txn.accountID] = (out[txn.accountID] ?? 0) + signedAmountMinor(txn);
    }
    for (const account of store.accounts) {
        if (out[account.id] !== null)
            continue;
        out[account.id] = balanceMinor(store, account, asOf);
    }
    return out;
}
/**
 * 净资产口径：只统计 `includeInNetWorth` 的未归档账户，余额换算基准币后：
 *   净资产 = 全部求和；资产 = 只加正数；负债 = 负数取绝对值求和。
 */
export function netWorth(store, balances) {
    let net = 0;
    let assets = 0;
    let liabilities = 0;
    for (const account of store.accounts) {
        if (account.isArchived || !account.includeInNetWorth)
            continue;
        const base = store.toBaseMinor(balances[account.id] ?? 0, account.currency);
        net += base;
        if (base > 0)
            assets += base;
        else
            liabilities += -base;
    }
    return { net, assets, liabilities };
}
/**
 * 余额校准（MOZE 式）：
 *  - 流水账户：落一笔可见、可审计、可撤销的 `.adjustment` 校准流水 + 一条 `calibration` 快照
 *  - 估值账户：只写一条 `manual` 快照，不产生流水
 * 两者都在**同一次 mutate** 里落地。
 */
export async function setBalance(store, account, targetMinor, now = Date.now()) {
    if (!derivesBalanceFromFlow(account)) {
        const snapshot = {
            id: newID(),
            accountID: account.id,
            date: dayStart(now),
            balanceMinor: Math.round(targetMinor),
            source: 'manual',
        };
        const ok = await store.mutate((draft) => {
            draft.table('snapshots').push(snapshot);
        });
        return ok ? { ok: true, delta: 0 } : { ok: false, reason: 'persistence' };
    }
    const current = balanceMinor(store, account, now);
    const delta = Math.round(targetMinor) - current;
    if (delta === 0)
        return { ok: true, delta: 0, noop: true };
    const txn = store.makeTransaction({
        kind: KIND.adjustment,
        amountMinor: Math.abs(delta),
        signedAdjustment: delta,
        accountID: account.id,
        currency: account.currency,
        occurredOn: now,
        source: 'manual',
    });
    store.applyPostingSnapshot(txn);
    const snapshot = {
        id: newID(),
        accountID: account.id,
        date: dayStart(now),
        balanceMinor: Math.round(targetMinor),
        source: 'calibration',
    };
    const ok = await store.mutate((draft) => {
        draft.putTx(txn);
        draft.table('snapshots').push(snapshot);
    });
    return ok ? { ok: true, delta } : { ok: false, reason: 'persistence' };
}
