// 天天基金 / 东方财富（场外基金）—— 规格 §8.3。UTF-8，无需 GBK 解码。
//
// 全量目录约 15k 条、数 MB：**必须显式放宽 `maxBytes`**，并检查 `truncated`
// ——升级前默认 200KB 会静默腰斩，把半截目录当成全量是最坑人的失败模式。
import { CATALOG_TIMEOUT_MS, coalesce, getJSON, getText, runPool } from '../http.js';
const EM_REFERER = { Referer: 'https://fundf10.eastmoney.com' };
/**
 * 实时估值（JSONP `jsonpgz({...});`）。
 * `price = gsz(有则) 否则 dwjz`；`prevClose = dwjz`；`isEstimate = gsz 非空`。
 */
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export async function fetchEstimate(code) {
    const url = `https://fundgz.1234567.com.cn/js/${code}.js`;
    const result = await getText(url, { headers: { Referer: 'https://fund.eastmoney.com/' } });
    if (!result.ok)
        return null;
    const match = /jsonpgz\(([\s\S]*)\)\s*;?/.exec(String(result.body));
    if (!match)
        return null;
    const body = match[1];
    if (body === undefined)
        return null;
    let row;
    try {
        const parsed = JSON.parse(body);
        if (!isRecord(parsed))
            return null;
        row = parsed;
    }
    catch (error) {
        return null;
    }
    const nav = Number(row.dwjz);
    const estimate = row.gsz === undefined || row.gsz === null || row.gsz === '' ? null : Number(row.gsz);
    const price = estimate !== null && Number.isFinite(estimate) && estimate > 0 ? estimate : nav;
    if (!Number.isFinite(price) || price <= 0)
        return null;
    return {
        symbol: `fund${code}`,
        market: 'fund',
        name: String(row.name || ''),
        price,
        prevClose: Number.isFinite(nav) ? nav : 0,
        open: 0,
        high: 0,
        low: 0,
        change: Number.isFinite(nav) && estimate !== null ? estimate - nav : 0,
        changePct: Number(row.gszzl) || 0,
        volume: 0,
        amount: null,
        bids: [],
        asks: [],
        time: String(row.gztime || ''),
        navDate: String(row.jzrq || ''),
        currency: 'CNY',
        isEstimate: estimate !== null && Number.isFinite(estimate),
        source: 'eastmoney',
    };
}
/** 一只一个请求，**并发窗口固定 4**（规格 §8.8）。 */
export async function fetchEstimates(codes) {
    const rows = await runPool(codes, 4, (code) => fetchEstimate(code));
    const out = {};
    for (const row of rows)
        if (row)
            out[row.symbol] = row;
    return out;
}
let catalog = null;
let catalogTruncated = false;
let catalogPromise = null;
export function catalogState() {
    return { loaded: catalog !== null, count: catalog ? catalog.length : 0, truncated: catalogTruncated };
}
/**
 * 一次性拉取后常驻内存，之后本地过滤。
 * `truncated` 为真时**如实记录**——半截目录会让搜索静默漏结果。
 */
export async function loadCatalog() {
    if (catalog)
        return catalog;
    if (catalogPromise)
        return catalogPromise;
    catalogPromise = (async () => {
        const result = await getText('https://fund.eastmoney.com/js/fundcode_search.js', {
            headers: { Referer: 'https://fund.eastmoney.com/' },
            maxBytes: 8 * 1024 * 1024,
            timeoutMs: CATALOG_TIMEOUT_MS,
        });
        if (!result.ok) {
            catalogPromise = null;
            return [];
        }
        catalogTruncated = !!result.truncated;
        const text = String(result.body);
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start < 0 || end <= start) {
            catalogPromise = null;
            return [];
        }
        try {
            const rows = JSON.parse(text.slice(start, end + 1));
            if (!Array.isArray(rows)) {
                catalogPromise = null;
                return [];
            }
            catalog = rows
                .filter((row) => Array.isArray(row) && row.length >= 3)
                .map((row) => ({
                code: String(row[0]),
                pinyin: String(row[1] || ''),
                name: String(row[2] || ''),
                kind: String(row[3] || ''),
            }));
            return catalog;
        }
        catch (error) {
            catalogPromise = null;
            return [];
        }
    })();
    return catalogPromise;
}
/** 本地过滤：`code.startsWith(q)` 或 `name` 含 q（小写），取前 20。 */
export async function search(query, limit = 20) {
    const text = String(query || '').trim();
    if (!text)
        return [];
    const rows = await loadCatalog();
    const lower = text.toLowerCase();
    const out = [];
    for (const row of rows) {
        if (row.code.startsWith(text) || row.name.toLowerCase().includes(lower)) {
            out.push({ market: 'fund', code: row.code, exchange: null, name: row.name, symbol: `fund${row.code}` });
            if (out.length >= limit)
                break;
        }
    }
    return out;
}
export async function fetchNavHistory(code, count = 160) {
    const size = Math.max(1, Math.min(365, count));
    const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=${size}`;
    const result = await coalesce(`fund:nav:${code}:${size}`, () => getJSON(url, { headers: EM_REFERER }));
    if (!result.ok)
        return [];
    const list = result.body && result.body.Data && result.body.Data.LSJZList;
    if (!Array.isArray(list))
        return [];
    const rows = [];
    for (const row of list) {
        const nav = Number(row.DWJZ);
        if (!Number.isFinite(nav) || nav <= 0)
            continue;
        rows.push({ date: String(row.FSRQ || ''), open: nav, close: nav, high: nav, low: nav, volume: 0 });
    }
    return rows.reverse();
}
