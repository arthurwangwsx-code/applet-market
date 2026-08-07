import { bridge } from './bridge'
import type { JSONObject } from './json'
import { AiboxError } from './errors'

/**
 * `aibox.db` 的类型化封装 —— 存在的理由是**一个已经复制了两遍的静默截断 bug**。
 *
 * ## 它修的那个 bug
 *
 * 宿主的 `query` 有 `limit ≤ 500` 的硬上限，超出**不报错**，直接 `min(500, limit)`：
 *
 * ```swift
 * let end = min(rows.count, start + min(Self.maxQueryLimit, max(1, limit)))
 * ```
 *
 * 于是「一次拿全表」的自然写法 `query({ collection, limit: 2000 })` 会在第 501 条起悄悄丢数据，
 * 而返回值与「这张表真的只有 500 条」完全不可区分。`com.aibox.wordstudy` 与
 * `com.aibox.voicememos` 各写了一份这样的 `readAll`（逐字节几乎相同）——
 * 生词本超过 500 个词之后，用户会看到它**停止增长**，没有任何报错。
 *
 * 正确写法是分页到短页为止（`com.aibox.ledger` 独立写对了一份）。把它收进 SDK，
 * 是为了让第三个应用不必再答对一次同样的题。
 *
 * ## 为什么不是「把宿主上限提高」
 *
 * 上限是**桥载荷**的闸，不是数据库的闸：一次回 20,000 条文档要整个序列化成 JSON 过桥。
 * 真正该消失的是「为了算个总数/汇总而拉全表」这类需求，而那已经由 `count()` 与
 * `aggregate()` 覆盖。所以上限保留，分页由 SDK 兜住。
 */

type DB = NonNullable<ReturnType<typeof bridge>>['db']

/** 宿主 `query` 的单页硬上限。写死在这里是为了让分页步长与它一致——取小了白多跑几趟桥。 */
const PAGE = 500

function requireDB(): NonNullable<DB> {
  const host = bridge()
  if (!host?.db || typeof host.db.query !== 'function') {
    throw new AiboxError('aibox/unavailable', 'aibox/unavailable: aibox.db is not available in this build.')
  }
  return host.db as NonNullable<DB>
}

/** `aibox.db` 在不在。用它决定要不要渲染依赖持久化的入口。 */
export function databaseAvailable(): boolean {
  const host = bridge()
  return !!host?.db && typeof host.db.query === 'function'
}

export interface QueryAllOptions {
  /** 与 `query` 同义的筛选子句，支持 `$gte` / `$in` 等算子。 */
  where?: JSONObject
  sortBy?: string
  descending?: boolean
  /**
   * 安全阀：最多取多少条。**默认不设**——不设时取到真正的表尾。
   * 设了它就等于接受「可能没取全」，所以调用方要么不设，要么自己处理截断。
   */
  max?: number
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
export async function queryAll<T extends object = JSONObject>(
  collection: string,
  options: QueryAllOptions = {},
): Promise<(T & { _id: string })[]> {
  const db = requireDB()
  const out: (T & { _id: string })[] = []
  const { where, sortBy, descending, max } = options
  for (let offset = 0; ; offset += PAGE) {
    const request: Record<string, unknown> = { collection, limit: PAGE, offset }
    if (where) request.where = where
    if (sortBy) request.sortBy = sortBy
    if (descending !== undefined) request.descending = descending
    const page = await db.query(request as Parameters<NonNullable<DB>['query']>[0])
    const rows = Array.isArray(page) ? (page as (T & { _id: string })[]) : []
    out.push(...rows)
    if (max !== undefined && out.length >= max) return out.slice(0, max)
    // 短页 = 到底了。**不能用 `rows.length === 0` 当终止条件**：那样每次都要多跑一趟空查询，
    // 而且当总数恰好是 PAGE 的整数倍时也一样要多跑一趟。
    if (rows.length < PAGE) break
  }
  return out
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
export async function removeMany(collection: string, ids: readonly string[]): Promise<number> {
  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))]
  if (unique.length === 0) return 0
  const db = requireDB()
  if (typeof db.removeWhere !== 'function') {
    // 老宿主没有 removeWhere：退回逐条删，慢但正确。
    let removed = 0
    for (const id of unique) {
      if (await db.remove({ collection, id })) removed += 1
    }
    return removed
  }
  // 生成的类型对返回值是 `Promise<unknown>`（descriptor 的 resultSummary 是散文，不是机器类型），
  // 故在这里收口成 number 而不是把 unknown 漏给每个调用方。
  const removed = await db.removeWhere({ collection, where: { _id: { $in: unique } } })
  return typeof removed === 'number' ? removed : unique.length
}
