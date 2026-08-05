// 流水写操作（UI 与 AI action 共用同一份；**都必须走 store.mutate → WAL**，不允许绕过去直接写库）。
//
// 铁律（§10）：
//  1. `amountMinor` 恒正，方向靠 kind；唯一例外是校准的 `signedAdjustment`。
//  2. 转账 = 两笔互指的配对流水，删除/恢复/永久删除必须两腿一起。
//  3. 流水币种恒等于所属账户币种。
//  4. 保存成功与否以 `store.lastMutationSucceeded` 为准。
import { KIND, newID, normalizeTags } from './store.js';
import { dayStart, monthKeyOf } from './dates.js';
/** 幂等命中：同键已存在（未软删）就直接返回那条，不重复落账。 */
export function findByIdempotencyKey(store, key) {
    if (!key)
        return null;
    return store.allTransactions().find((row) => row.idempotencyKey === key) ?? null;
}
function accountCurrency(store, accountID) {
    const account = store.account(accountID);
    return account ? account.currency : store.baseCode;
}
/**
 * 记一笔收支。`input` 用主单位以外的一切都已归一好（amountMinor 是整数分）。
 * 返回 `{ ok, transaction, reason }`。
 */
export async function recordEntry(store, input) {
    const existing = findByIdempotencyKey(store, input.idempotencyKey);
    if (existing)
        return { ok: true, transaction: existing, duplicate: true };
    const accountID = input.accountID ?? (store.defaultAccount() ? store.defaultAccount().id : null);
    if (!accountID)
        return { ok: false, reason: 'noAccount' };
    const currency = accountCurrency(store, accountID);
    if (!store.hasUsableRate(currency))
        return { ok: false, reason: 'rateNeeded', currency };
    const txn = store.makeTransaction({ ...input, accountID, currency });
    store.applyPostingSnapshot(txn);
    const ok = await store.mutate((draft) => { draft.putTx(txn); });
    return ok ? { ok: true, transaction: txn } : { ok: false, reason: 'persistence' };
}
/**
 * 转账：两笔互指的配对流水，一次 mutate 落地。
 * 同月落在同一个月份文档里 = 一次原子写；跨月由 WAL 兜底。
 */
export async function recordTransfer(store, input) {
    const existing = findByIdempotencyKey(store, input.idempotencyKey);
    if (existing)
        return { ok: true, transaction: existing, duplicate: true };
    const fromAccount = store.account(input.fromAccountID);
    const toAccount = store.account(input.toAccountID);
    if (!fromAccount || !toAccount)
        return { ok: false, reason: 'noAccount' };
    if (fromAccount.id === toAccount.id)
        return { ok: false, reason: 'sameAccount' };
    if (!store.hasUsableRate(fromAccount.currency) || !store.hasUsableRate(toAccount.currency)) {
        return { ok: false, reason: 'rateNeeded' };
    }
    const outID = newID();
    const inID = newID();
    const outAmount = Math.abs(Math.round(input.amountMinor));
    const inAmount = input.toAmountMinor !== undefined && input.toAmountMinor !== null
        ? Math.abs(Math.round(input.toAmountMinor))
        : store.convertMinor(outAmount, fromAccount.currency, toAccount.currency);
    const shared = {
        occurredOn: input.occurredOn,
        createdAt: input.createdAt,
        note: input.note,
        merchant: input.merchant,
        tags: input.tags,
        projectID: input.projectID ?? null,
        source: input.source ?? 'manual',
        calculationExpression: input.calculationExpression ?? null,
        batchID: input.batchID ?? null,
    };
    const legOut = store.makeTransaction({
        ...shared, id: outID, kind: KIND.transferOut, amountMinor: outAmount,
        accountID: fromAccount.id, currency: fromAccount.currency, transferPeerID: inID,
        idempotencyKey: input.idempotencyKey ?? null,
    });
    const legIn = store.makeTransaction({
        ...shared, id: inID, kind: KIND.transferIn, amountMinor: inAmount,
        accountID: toAccount.id, currency: toAccount.currency, transferPeerID: outID,
    });
    store.applyPostingSnapshot(legOut);
    store.applyPostingSnapshot(legIn);
    const ok = await store.mutate((draft) => { draft.putTx(legOut); draft.putTx(legIn); });
    return ok ? { ok: true, transaction: legOut, peer: legIn } : { ok: false, reason: 'persistence' };
}
/** 需要重新锁定入账快照的「实质变更」。 */
function needsResnapshot(before, after) {
    return before.amountMinor !== after.amountMinor
        || before.currency !== after.currency
        || before.accountID !== after.accountID;
}
/** 编辑一笔（转账会顺着 transferPeerID 同步对手腿的日期/备注/项目）。 */
export async function updateEntry(store, id, patch) {
    const current = store.transaction(id);
    if (!current)
        return { ok: false, reason: 'notFound' };
    const next = { ...current };
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined)
            continue;
        next[key] = value;
    }
    if (patch.tags !== undefined)
        next.tags = normalizeTags(patch.tags);
    if (patch.occurredOn !== undefined)
        next.occurredOn = dayStart(patch.occurredOn);
    if (patch.accountID !== undefined)
        next.currency = accountCurrency(store, next.accountID);
    next.amountMinor = Math.abs(Math.round(next.amountMinor));
    if (next.kind !== KIND.adjustment)
        next.signedAdjustment = 0;
    if (!store.hasUsableRate(next.currency))
        return { ok: false, reason: 'rateNeeded', currency: next.currency };
    if (needsResnapshot(current, next))
        store.applyPostingSnapshot(next);
    const peerID = current.transferPeerID;
    const ok = await store.mutate((draft) => {
        draft.putTx(next);
        if (peerID) {
            const peer = draft.tx(peerID);
            if (peer) {
                const updated = { ...peer, occurredOn: next.occurredOn, note: next.note, projectID: next.projectID };
                if (patch.transferAmountMinor !== undefined) {
                    updated.amountMinor = Math.abs(Math.round(patch.transferAmountMinor));
                    store.applyPostingSnapshot(updated);
                }
                draft.putTx(updated);
            }
        }
    });
    return ok ? { ok: true, transaction: next } : { ok: false, reason: 'persistence' };
}
/** 软删（tombstone）。转账两腿一起。 */
export async function deleteEntry(store, id) {
    const current = store.transaction(id);
    if (!current)
        return { ok: false, reason: 'notFound' };
    const now = Date.now();
    const ok = await store.mutate((draft) => {
        draft.putTx({ ...current, deletedAt: now });
        if (current.transferPeerID) {
            const peer = draft.tx(current.transferPeerID);
            if (peer)
                draft.putTx({ ...peer, deletedAt: now });
        }
    });
    return ok ? { ok: true, transaction: current } : { ok: false, reason: 'persistence' };
}
/** 撤销删除。转账两腿一起。 */
export async function restoreEntry(store, id) {
    const key = store.txMonth.get(id);
    if (key === null || key === undefined)
        return { ok: false, reason: 'notFound' };
    const current = (store.months[key] ?? []).find((row) => row.id === id);
    if (!current)
        return { ok: false, reason: 'notFound' };
    const ok = await store.mutate((draft) => {
        draft.putTx({ ...current, deletedAt: null });
        if (current.transferPeerID) {
            const peer = draft.tx(current.transferPeerID);
            if (peer)
                draft.putTx({ ...peer, deletedAt: null });
        }
    });
    return ok ? { ok: true } : { ok: false, reason: 'persistence' };
}
/** 永久删除（物理移除）。转账两腿一起。 */
export async function purgeEntry(store, id) {
    const key = store.txMonth.get(id);
    if (key === null || key === undefined)
        return { ok: false, reason: 'notFound' };
    const current = (store.months[key] ?? []).find((row) => row.id === id);
    if (!current)
        return { ok: false, reason: 'notFound' };
    const ok = await store.mutate((draft) => {
        draft.dropTx(id);
        if (current.transferPeerID)
            draft.dropTx(current.transferPeerID);
    });
    return ok ? { ok: true } : { ok: false, reason: 'persistence' };
}
/** 最近删除列表：`deletedAt != nil`，按 deletedAt 倒序，上限 200，**转账两腿只展示一条**。 */
export function recentlyDeleted(store, limit = 200) {
    const rows = store.allTransactionsIncludingDeleted()
        .filter((row) => !!row.deletedAt)
        .sort((a, b) => b.deletedAt - a.deletedAt);
    const seen = new Set();
    const out = [];
    for (const row of rows) {
        // 以「两个 id 里字典序较小的那个」作为配对键去重。
        const key = row.transferPeerID
            ? [row.id, row.transferPeerID].sort()[0]
            : row.id;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(row);
        if (out.length >= limit)
            break;
    }
    return out;
}
/** 按日分组：日期倒序，组内按 createdAt 倒序。 */
export function groupByDay(transactions) {
    const map = new Map();
    for (const row of transactions) {
        const key = dayStart(row.occurredOn);
        if (!map.has(key))
            map.set(key, []);
        map.get(key).push(row);
    }
    return [...map.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([day, rows]) => ({ day, rows: rows.sort((a, b) => b.createdAt - a.createdAt) }));
}
export { monthKeyOf };
