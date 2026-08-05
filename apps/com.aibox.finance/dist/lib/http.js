// HTTP 层：`aibox.net.fetch` 的薄封装 + GBK/GB18030 解码 + 同 key 并发合并。
//
// **为什么必须走 base64**：腾讯 / 新浪的行情响应是 GBK。`responseType:'text'` 会按 UTF-8 解，
// 失败时返回**空字符串**（不是乱码，是什么都没有）——所以 GBK 端点一律 `responseType:'base64'`
// 再在 Web 侧用 `TextDecoder('gb18030')` 解，合同见
// docs/capabilities/applet/framework-capabilities.md §3.35。
//
// 请求头是能透传的（这是「网络必须经原生中转」的红利：浏览器 fetch 设不了 Referer）。
// 所有失败一律回落成可判定的返回值，**不抛到 UI 层**（规格 §8.9）。
const bridge = () => (typeof window !== 'undefined' ? window.aibox : undefined);
export const FAILURE = {
    configuration: 'configuration',
    invalidURL: 'invalidURL',
    timeout: 'timeout',
    network: 'network',
    http: 'http',
    decoding: 'decoding',
    unknown: 'unknown',
};
export const DEFAULT_TIMEOUT_MS = 8000;
export const CATALOG_TIMEOUT_MS = 12000;
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
function classify(message) {
    const text = String(message || '').toLowerCase();
    if (text.includes('aibox/denied'))
        return FAILURE.configuration;
    if (text.includes('timed out') || text.includes('timeout'))
        return FAILURE.timeout;
    if (text.includes('invalid') || text.includes('non-http'))
        return FAILURE.invalidURL;
    if (text.includes('offline') || text.includes('network') || text.includes('connection')
        || text.includes('host') || text.includes('internet'))
        return FAILURE.network;
    return FAILURE.unknown;
}
/**
 * 基础请求。`responseType` 默认 `'text'`；GBK 端点传 `'base64'`。
 * 返回 `{ ok, status, body, contentType, truncated, failure }`。
 */
export async function request(url, options = {}) {
    const api = bridge();
    if (!api || !api.net || typeof api.net.fetch !== 'function') {
        return { ok: false, failure: FAILURE.configuration };
    }
    if (!/^https?:\/\//i.test(String(url || ''))) {
        return { ok: false, failure: FAILURE.invalidURL };
    }
    const { headers = {}, responseType = 'text', maxBytes, timeoutMs = DEFAULT_TIMEOUT_MS, method = 'GET', body, } = options;
    let timer = null;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ __timeout: true }), timeoutMs);
    });
    try {
        const payload = { method, headers: { 'User-Agent': USER_AGENT, ...headers }, responseType };
        if (maxBytes)
            payload.maxBytes = maxBytes;
        if (body !== undefined)
            payload.body = body;
        const response = await Promise.race([api.net.fetch(url, payload), timeout]);
        if (response && response.__timeout)
            return { ok: false, failure: FAILURE.timeout };
        const status = Number((response && response.status) || 0);
        if (status < 200 || status >= 300)
            return { ok: false, failure: FAILURE.http, status };
        return {
            ok: true,
            status,
            body: response ? response.body : null,
            contentType: response ? response.contentType : null,
            truncated: !!(response && response.truncated),
        };
    }
    catch (error) {
        return { ok: false, failure: classify(error && error.message) };
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
/** UTF-8 文本端点（东财 datacenter / 天天基金 / 新浪快讯）。 */
export async function getText(url, options = {}) {
    const result = await request(url, { ...options, responseType: 'text' });
    if (!result.ok)
        return result;
    return { ...result, body: String(result.body || '') };
}
/** JSON 端点。解析失败按 decoding 失败回报，不抛。 */
export async function getJSON(url, options = {}) {
    const result = await request(url, { ...options, responseType: 'json' });
    if (!result.ok)
        return result;
    if (result.body && typeof result.body === 'object')
        return result;
    try {
        return { ...result, body: JSON.parse(String(result.body || '')) };
    }
    catch (error) {
        return { ok: false, failure: FAILURE.decoding };
    }
}
/**
 * GBK/GB18030 端点（腾讯行情、腾讯联想、新浪行情、新浪汇率）。
 * 必须走 base64 —— 见文件头注释。
 */
export async function getGBK(url, options = {}) {
    const result = await request(url, {
        ...options,
        responseType: 'base64',
        maxBytes: options.maxBytes || 4 * 1024 * 1024,
    });
    if (!result.ok)
        return result;
    const text = decodeGBK(result.body);
    if (text === null)
        return { ok: false, failure: FAILURE.decoding };
    return { ...result, body: text };
}
/** base64 → GB18030 文本。解不出来返回 null（调用方按失败处理，不伪造数据）。 */
export function decodeGBK(base64) {
    try {
        const binary = atob(String(base64 || ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1)
            bytes[i] = binary.charCodeAt(i);
        return new TextDecoder('gb18030').decode(bytes);
    }
    catch (error) {
        return null;
    }
}
// —— 同 key 并发合并（规格 §8.8）——
//
// 同一批代码在两个页面同时刷新时，key 相同的请求共享同一次网络调用。
// 这不是缓存，是**去重**：TTL 缓存在 quotes.js 里，这里只防「同一瞬间打两次」。
const inflight = new Map();
export function coalesce(key, factory) {
    if (inflight.has(key))
        return inflight.get(key);
    const promise = Promise.resolve()
        .then(factory)
        .finally(() => { inflight.delete(key); });
    inflight.set(key, promise);
    return promise;
}
/** 固定并发窗口跑一批任务（基金估值固定 4）。 */
export async function runPool(items, width, worker) {
    const out = new Array(items.length);
    let cursor = 0;
    const runners = new Array(Math.max(1, Math.min(width, items.length))).fill(0).map(async () => {
        for (;;) {
            const index = cursor;
            cursor += 1;
            if (index >= items.length)
                return;
            out[index] = await worker(items[index], index);
        }
    });
    await Promise.all(runners);
    return out;
}
/** JSON 式 `\uXXXX` 反转义（腾讯联想的名称字段必须过这一道，否则中文全乱）。 */
export function unescapeUnicode(text) {
    return String(text || '').replace(/\\u([0-9a-fA-F]{4})/g, (whole, hex) => String.fromCharCode(parseInt(hex, 16)));
}
/** 缺失值：东财 clist 用字符串 `"-"` 表示无数据，要当 0 / 空串。 */
export function num(value, fallback = 0) {
    if (value === null || value === undefined || value === '-' || value === '')
        return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
export function str(value, fallback = '') {
    if (value === null || value === undefined || value === '-')
        return fallback;
    return String(value);
}
