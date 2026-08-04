import type { JSONObject } from './json';
/** `aibox.db` 在不在。用它决定要不要渲染依赖持久化的入口。 */
export declare function databaseAvailable(): boolean;
export interface QueryAllOptions {
    /** 与 `query` 同义的筛选子句，支持 `$gte` / `$in` 等算子。 */
    where?: JSONObject;
    sortBy?: string;
    descending?: boolean;
    /**
     * 安全阀：最多取多少条。**默认不设**——不设时取到真正的表尾。
     * 设了它就等于接受「可能没取全」，所以调用方要么不设，要么自己处理截断。
     */
    max?: number;
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
export declare function queryAll<T extends object = JSONObject>(collection: string, options?: QueryAllOptions): Promise<(T & {
    _id: string;
})[]>;
/**
 * 按 `_id` 批量删除。
 *
 * **不是便利方法。** 宿主每次单条 `remove` 都是一整趟「读全表 → 改 → 原子写全表」，
 * 所以 `for (const row of stale) await remove(row._id)` 删 200 条 = **200 趟全表 IO**，
 * 且中途失败会停在删了一半的状态。这里是一趟 `removeWhere`。
 *
 * 空数组是 no-op（返回 0），不会退化成「删掉整张表」——宿主侧的空 `where` 也会硬拒。
 */
export declare function removeMany(collection: string, ids: readonly string[]): Promise<number>;
//# sourceMappingURL=db.d.ts.map