// 持久层：`aibox.db.*` + 自建写前日志（WAL）。
//
// —— 为什么要自己做 WAL ——
// 实测宿主的 `aibox.db`（`AppletDocumentDatabase.swift`）**没有事务语义**：
// 它是「每个 collection 一个 JSON 文件」，`insert/update/remove` 各自做一次
// 「整表读 → 改 → 原子写文件」。**单次调用是原子的，跨调用不是**。
// 而记账有两处绝不允许写一半（§10）：
//   ① 转账 = 两笔互指的流水；② AA 结算 = 结算记录 + 关联流水。
//
// —— 结构 ——
// collection `tables` ：小表各一个文档 `{_id:'accounts', rows:[…]}`，写一次 = 重写这张小表；
// collection `tx`     ：流水**按月分片** `{_id:'m202608', rows:[…]}`。同月的转账两腿落在同一个
//                       文档里 → 天然一次原子写；跨月/跨表才需要 WAL。分片同时把 CSV 导入
//                       从「每行一次整表重写」压成「每月一次」。
// collection `wal`    ：`{_id:'pending', ops:[…]}`。
//
// —— 协议 ——
// 1. 先把整批变更写进 `wal/pending`（一次原子写）；
// 2. 逐个落地 ops；
// 3. 全部成功后删掉 pending。
// 启动时若发现 pending → **重放**（不是回滚）：每个 op 都是「按 _id 整文档 put / del」，
// 幂等，重放一定收敛到批次完成后的状态。任何一步抛错都向上冒泡 → 上层切只读态。
const TABLES = 'tables';
const TX = 'tx';
const WAL = 'wal';
const PENDING_ID = 'pending';
const PAGE = 500;
function api() {
    const root = typeof window !== 'undefined' ? window.aibox : undefined;
    return root && root.db && typeof root.db.query === 'function' ? root.db : null;
}
export function databaseAvailable() {
    return api() !== null;
}
export const txDocID = (monthKey) => `m${monthKey}`;
// MARK: - 底层调用（**不吞异常**）
async function queryAll(collection) {
    const db = api();
    if (!db)
        throw new Error('aibox/db-unavailable');
    const out = [];
    for (let offset = 0;; offset += PAGE) {
        const page = await db.query({ collection, limit: PAGE, offset });
        const rows = Array.isArray(page) ? page : [];
        out.push(...rows);
        if (rows.length < PAGE)
            break;
    }
    return out;
}
async function put(collection, id, rows) {
    const db = api();
    if (!db)
        throw new Error('aibox/db-unavailable');
    await db.insert({ collection, document: { _id: id, rows } });
}
async function drop(collection, id) {
    const db = api();
    if (!db)
        throw new Error('aibox/db-unavailable');
    await db.remove({ collection, id });
}
// MARK: - 启动
/** 读回全部数据：`{ tables: {name: rows}, tx: {monthKey: rows} }`。抛错交给上层切降级态。 */
export async function loadAll() {
    await replayPendingWAL();
    const tables = {};
    for (const doc of await queryAll(TABLES)) {
        if (doc && typeof doc._id === 'string')
            tables[doc._id] = Array.isArray(doc.rows) ? doc.rows : [];
    }
    const tx = {};
    for (const doc of await queryAll(TX)) {
        if (doc && typeof doc._id === 'string' && doc._id.startsWith('m')) {
            tx[Number(doc._id.slice(1))] = Array.isArray(doc.rows) ? doc.rows : [];
        }
    }
    return { tables, tx };
}
/** 若上次写到一半崩了，把 pending 批次重放完再删。 */
async function replayPendingWAL() {
    const rows = await queryAll(WAL);
    const pending = rows.find((row) => row && row._id === PENDING_ID);
    if (!pending || !Array.isArray(pending.ops) || pending.ops.length === 0) {
        if (pending)
            await drop(WAL, PENDING_ID);
        return;
    }
    await applyOps(pending.ops);
    await drop(WAL, PENDING_ID);
}
async function applyOps(ops) {
    for (const op of ops) {
        if (!op || typeof op.c !== 'string' || typeof op.id !== 'string')
            continue;
        if (op.del)
            await drop(op.c, op.id);
        else
            await put(op.c, op.id, Array.isArray(op.rows) ? op.rows : []);
    }
}
// MARK: - 写
/**
 * 原子提交一批变更。`ops` 形如
 *   `{ c: 'tables', id: 'accounts', rows: [...] }`（整表 put）
 *   `{ c: 'tx', id: 'm202608', rows: [...] }`
 *   `{ c: 'tx', id: 'm202607', del: true }`（该月已空）
 *
 * 单条 op 时跳过 WAL（宿主单次写本身就是原子的），省两次桥调用。
 * 任何一步失败都向上抛 —— 调用方必须切只读态并告知用户，**绝不能吞掉后照常刷新 UI**。
 */
export async function commit(ops) {
    const batch = (ops ?? []).filter((op) => op && typeof op.c === 'string' && typeof op.id === 'string');
    if (batch.length === 0)
        return;
    if (batch.length === 1) {
        await applyOps(batch);
        return;
    }
    const db = api();
    if (!db)
        throw new Error('aibox/db-unavailable');
    await db.insert({
        collection: WAL,
        document: { _id: PENDING_ID, ops: batch, at: new Date().toISOString() },
    });
    await applyOps(batch);
    await drop(WAL, PENDING_ID);
}
