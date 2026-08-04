import { bridge } from './bridge';
import { AiboxError } from './errors';
/** 宿主 `query` 的单页硬上限。写死在这里是为了让分页步长与它一致——取小了白多跑几趟桥。 */
const PAGE = 500;
function requireDB() {
    const host = bridge();
    if (!host?.db || typeof host.db.query !== 'function') {
        throw new AiboxError('aibox/unavailable', 'aibox/unavailable: aibox.db is not available in this build.');
    }
    return host.db;
}
/** `aibox.db` 在不在。用它决定要不要渲染依赖持久化的入口。 */
export function databaseAvailable() {
    const host = bridge();
    return !!host?.db && typeof host.db.query === 'function';
}
/**
 * 取回一个 collection 的**全部**文档（自动分页到表尾）。
 *
 * 与裸 `query({ limit: N })` 的区别只有一条，但它是决定性的：**这里不会悄悄少给你数据。**
 *
 * ```ts
 * const words = await queryAll<WordEntry>('vocabItems')             // 全部，无论多少条
 * const august = await queryAll<Tx>('tx', {                          // 带筛选同样分页
 *   where: { date: { $gte: '2026-08-01', $lt: '2026-09-01' } },
 * })
 * ```
 *
 * **不吞异常**：桥报错就抛出去。调用方接住后应当切降级态并告诉用户，
 * 而不是 `catch { return [] }` —— 那会把「读失败」渲染成「你没有任何数据」，
 * 用户据此新建一条，就真的覆盖掉了。
 */
export async function queryAll(collection, options = {}) {
    const db = requireDB();
    const out = [];
    const { where, sortBy, descending, max } = options;
    for (let offset = 0;; offset += PAGE) {
        const request = { collection, limit: PAGE, offset };
        if (where)
            request.where = where;
        if (sortBy)
            request.sortBy = sortBy;
        if (descending !== undefined)
            request.descending = descending;
        const page = await db.query(request);
        const rows = Array.isArray(page) ? page : [];
        out.push(...rows);
        if (max !== undefined && out.length >= max)
            return out.slice(0, max);
        // 短页 = 到底了。**不能用 `rows.length === 0` 当终止条件**：那样每次都要多跑一趟空查询，
        // 而且当总数恰好是 PAGE 的整数倍时也一样要多跑一趟。
        if (rows.length < PAGE)
            break;
    }
    return out;
}
/**
 * 按 `_id` 批量删除。
 *
 * **不是便利方法。** 宿主每次单条 `remove` 都是一整趟「读全表 → 改 → 原子写全表」，
 * 所以 `for (const row of stale) await remove(row._id)` 删 200 条 = **200 趟全表 IO**，
 * 且中途失败会停在删了一半的状态。这里是一趟 `removeWhere`。
 *
 * 空数组是 no-op（返回 0），不会退化成「删掉整张表」——宿主侧的空 `where` 也会硬拒。
 */
export async function removeMany(collection, ids) {
    const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))];
    if (unique.length === 0)
        return 0;
    const db = requireDB();
    if (typeof db.removeWhere !== 'function') {
        // 老宿主没有 removeWhere：退回逐条删，慢但正确。
        let removed = 0;
        for (const id of unique) {
            if (await db.remove({ collection, id }))
                removed += 1;
        }
        return removed;
    }
    // 生成的类型对返回值是 `Promise<unknown>`（descriptor 的 resultSummary 是散文，不是机器类型），
    // 故在这里收口成 number 而不是把 unknown 漏给每个调用方。
    const removed = await db.removeWhere({ collection, where: { _id: { $in: unique } } });
    return typeof removed === 'number' ? removed : unique.length;
}
