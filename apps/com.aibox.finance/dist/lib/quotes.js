// 行情服务：TTL 缓存 + 故障切换 + 数据可信状态机（规格 §2.5 / §2.6 / §8.8 / §8.9）。
//
// 失败语义是这一层的灵魂（§15 第 8 条）：
//   **全部拉取失败时保留旧缓存和旧 lastUpdated**，只加一行「刷新失败」——
//   绝不能把旧内容伪装成刚刷新过。
import * as tencent from './providers/tencent.js';
import * as sina from './providers/sina.js';
import * as fund from './providers/fund.js';
import { canonicalOf, resolveSymbol } from './symbol.js';
/** 内存 TTL = clamp(refreshInterval, 10, 60) 秒；`force` 旁路。 */
export function quoteTTL(refreshInterval) {
    return Math.max(10, Math.min(60, refreshInterval || 30)) * 1000;
}
const KLINE_TTL_MS = 120000;
const KLINE_MAX_ENTRIES = 40;
const FX_TTL_MS = 3600000;
export class QuoteService {
    cache;
    klineCache;
    fx;
    fxAt;
    refreshing;
    lastUpdated;
    lastFailed;
    lastPartial;
    missingSymbols;
    source;
    refreshInterval;
    listeners;
    constructor() {
        this.cache = new Map(); // canonical → { quote, at }
        this.klineCache = new Map(); // key → { rows, at }
        this.fx = null;
        this.fxAt = 0;
        this.refreshing = false;
        this.lastUpdated = null;
        this.lastFailed = false;
        this.lastPartial = false;
        this.missingSymbols = [];
        this.source = 'automatic';
        this.refreshInterval = 30;
        this.listeners = new Set();
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    emit() {
        for (const listener of this.listeners)
            listener();
    }
    quote(canonical) {
        const entry = this.cache.get(canonical);
        return entry ? entry.quote : null;
    }
    /** 全部缓存的快照（写盘用，带 `at` 时间戳）。 */
    snapshot() {
        const out = {};
        for (const [canonical, entry] of this.cache)
            out[canonical] = entry;
        return out;
    }
    /** canonical → quote 的扁平字典（估值与上下文构造用）。 */
    quoteMap() {
        const out = {};
        for (const [canonical, entry] of this.cache)
            out[canonical] = entry.quote;
        return out;
    }
    /** 从磁盘快照 hydrate（进页秒显，避免价格闪 0）。 */
    hydrate(rows, lastUpdated) {
        if (rows && typeof rows === 'object') {
            for (const canonical of Object.keys(rows)) {
                const entry = rows[canonical];
                if (entry && entry.quote)
                    this.cache.set(canonical, entry);
            }
        }
        if (lastUpdated)
            this.lastUpdated = lastUpdated;
        this.emit();
    }
    isFresh(canonical, now, force) {
        if (force)
            return false;
        const entry = this.cache.get(canonical);
        if (!entry)
            return false;
        return now - entry.at < quoteTTL(this.refreshInterval);
    }
    /**
     * 批量刷新。返回 `{ quotes, missing, failed }`。
     * 并发保护由调用方（页面）做——这里只保证同 key 网络请求合并（见 http.coalesce）。
     */
    async refresh(canonicals, { force = false } = {}) {
        const now = Date.now();
        const unique = [...new Set(canonicals.filter(Boolean))];
        if (unique.length === 0)
            return { quotes: {}, missing: [], failed: false };
        const stale = unique.filter((canonical) => !this.isFresh(canonical, now, force));
        if (stale.length === 0) {
            const cached = {};
            for (const canonical of unique)
                cached[canonical] = this.quote(canonical);
            return { quotes: cached, missing: [], failed: false, fromCache: true };
        }
        const symbols = stale
            .map((canonical) => ({ canonical, symbol: resolveSymbol(canonical) }))
            .filter((row) => row.symbol !== null);
        const funds = symbols.filter((row) => row.symbol.market === 'fund');
        const listed = symbols.filter((row) => row.symbol.market !== 'fund');
        const collected = {};
        const tasks = [];
        if (funds.length > 0) {
            tasks.push(fund
                .fetchEstimates(funds.map((row) => row.symbol.code))
                .then((rows) => {
                Object.assign(collected, rows);
            })
                .catch(() => { }));
        }
        if (listed.length > 0) {
            tasks.push(this.fetchListed(listed.map((row) => row.symbol))
                .then((rows) => {
                Object.assign(collected, rows);
            })
                .catch(() => { }));
        }
        await Promise.all(tasks);
        const at = Date.now();
        for (const canonical of Object.keys(collected)) {
            const quote = collected[canonical];
            if (quote)
                this.cache.set(canonical, { quote, at });
        }
        const missing = stale.filter((canonical) => !collected[canonical]);
        const failed = Object.keys(collected).length === 0;
        // 全失败：保留旧 lastUpdated 与旧缓存，只打失败标。
        if (!failed)
            this.lastUpdated = at;
        this.lastFailed = failed;
        this.lastPartial = !failed && missing.length > 0;
        this.missingSymbols = missing;
        this.emit();
        const quotes = {};
        for (const canonical of unique)
            quotes[canonical] = this.quote(canonical);
        return { quotes, missing, failed };
    }
    /**
     * 故障切换（§8.8）：`automatic` 先打腾讯 → 把**没拿到的代码**再打新浪补齐；
     * `tencent` / `sina` 固定单源。
     */
    async fetchListed(symbols) {
        if (this.source === 'sina')
            return sina.fetchQuotes(symbols);
        const primary = await tencent.fetchQuotes(symbols);
        if (this.source === 'tencent')
            return primary;
        const missing = symbols.filter((symbol) => !primary[canonicalOf(symbol)]);
        if (missing.length === 0)
            return primary;
        const fallback = await sina.fetchQuotes(missing);
        return { ...primary, ...fallback };
    }
    /** K 线：会话内 TTL 120s，key = 代码#周期#复权#根数；**条目超 40 整表清空**（不做 LRU）。 */
    async candles(symbol, period, adjust, count, { force = false } = {}) {
        const key = `${symbol.market}:${symbol.code}#${period}#${adjust}#${count}`;
        const entry = this.klineCache.get(key);
        const now = Date.now();
        if (!force && entry && now - entry.at < KLINE_TTL_MS)
            return entry.rows;
        let rows = [];
        if (symbol.market === 'fund') {
            rows = await fund.fetchNavHistory(symbol.code, count);
        }
        else if (period === 'day' || period === 'week' || period === 'month') {
            rows = await tencent.fetchDailyCandles(symbol, period, adjust, count);
        }
        else {
            rows = await tencent.fetchMinuteCandles(symbol, period, count);
        }
        if (rows.length > 0) {
            if (this.klineCache.size >= KLINE_MAX_ENTRIES)
                this.klineCache.clear();
            this.klineCache.set(key, { rows, at: now });
        }
        return rows;
    }
    /** 汇率：TTL 1 小时。拿不到返回 null——**绝不用 1 兜底**。 */
    async exchangeRates({ force = false } = {}) {
        const now = Date.now();
        if (!force && this.fx && now - this.fxAt < FX_TTL_MS)
            return this.fx;
        const rows = await sina.fetchFX();
        if (rows) {
            this.fx = rows;
            this.fxAt = now;
        }
        return this.fx;
    }
}
export function resolveDataState({ failed, lastUpdated, refreshing, missingCount, ttlMs, now, }) {
    // 显式判 null/undefined：`lastUpdated === 0`（epoch）也是「有过数据」，
    // 用真值判断会把它误当成从未刷新过。
    const hasStamp = lastUpdated !== null && lastUpdated !== undefined;
    if (failed)
        return hasStamp ? 'failedWithCache' : 'failedWithoutData';
    if (!hasStamp)
        return refreshing ? 'loading' : 'unavailable';
    if (missingCount > 0)
        return 'partial';
    return now - lastUpdated > ttlMs ? 'cached' : 'fresh';
}
export function showsCachedBadge(state) {
    return state === 'cached' || state === 'failedWithCache';
}
