// 新浪（fallback + 汇率）—— 规格 §8.2。
//
// **必须带 `Referer: https://finance.sina.com.cn`**，否则 403。响应是 GBK。
//
// 两个最容易翻车的点：
//  · **三个市场的字段序完全不同**（A股/港股/美股各一套下标表），照抄别推理；
//  · 新浪**不回代码**——响应行与请求代码按**顺序 zip 配对**，顺序错就全错。
import { getGBK } from '../http.js';
import { canonicalOf, currencyOf, sinaQuoteCode } from '../symbol.js';
const REFERER = { Referer: 'https://finance.sina.com.cn' };
function num(parts, index) {
    const raw = parts[index];
    if (raw === undefined || raw === '')
        return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}
function parseAShare(parts, symbol) {
    if (parts.length <= 31)
        return null;
    const price = num(parts, 3);
    const prevClose = num(parts, 2) || 0;
    if (price === null)
        return null;
    const change = price - prevClose;
    return {
        symbol: canonicalOf(symbol),
        market: 'ashare',
        name: parts[0] || '',
        price,
        prevClose,
        open: num(parts, 1) || 0,
        high: num(parts, 4) || 0,
        low: num(parts, 5) || 0,
        change,
        changePct: prevClose > 0 ? (change / prevClose) * 100 : 0,
        volume: num(parts, 8) || 0,
        amount: num(parts, 9),
        time: `${parts[30] || ''} ${parts[31] || ''}`.trim(),
        bids: [],
        asks: [],
        currency: 'CNY',
        isEstimate: false,
        source: 'sina',
    };
}
function parseHK(parts, symbol) {
    if (parts.length <= 8)
        return null;
    const price = num(parts, 6);
    if (price === null)
        return null;
    return {
        symbol: canonicalOf(symbol),
        market: 'hk',
        name: parts[1] || '',
        price,
        prevClose: num(parts, 3) || 0,
        open: num(parts, 2) || 0,
        high: num(parts, 4) || 0,
        low: num(parts, 5) || 0,
        change: num(parts, 7) || 0,
        changePct: num(parts, 8) || 0,
        volume: 0,
        amount: null,
        time: `${parts[17] || ''} ${parts[18] || ''}`.trim(),
        bids: [],
        asks: [],
        currency: 'HKD',
        isEstimate: false,
        source: 'sina',
    };
}
function parseUS(parts, symbol) {
    if (parts.length <= 7)
        return null;
    const price = num(parts, 1);
    if (price === null)
        return null;
    return {
        symbol: canonicalOf(symbol),
        market: 'us',
        name: parts[0] || '',
        price,
        prevClose: num(parts, 26) || 0,
        open: num(parts, 5) || 0,
        high: num(parts, 6) || 0,
        low: num(parts, 7) || 0,
        change: num(parts, 4) || 0,
        changePct: num(parts, 2) || 0,
        volume: num(parts, 10) || 0,
        amount: null,
        time: parts[3] || '',
        bids: [],
        asks: [],
        currency: 'USD',
        isEstimate: false,
        source: 'sina',
    };
}
/** 批量实时行情（fallback 用）。拿不到的代码直接缺席。 */
export async function fetchQuotes(symbols) {
    const usable = symbols
        .map((symbol) => ({ symbol, code: sinaQuoteCode(symbol) }))
        .filter((row) => typeof row.code === 'string' && row.code.length > 0);
    if (usable.length === 0)
        return {};
    const url = `https://hq.sinajs.cn/list=${usable.map((row) => row.code).join(',')}`;
    const result = await getGBK(url, { headers: REFERER });
    if (!result.ok)
        return {};
    const lines = String(result.body)
        .split('\n')
        .filter((line) => line.includes('="'));
    const out = {};
    // 按顺序 zip：新浪不回代码，位置就是身份。
    for (let i = 0; i < usable.length && i < lines.length; i += 1) {
        const line = lines[i];
        if (line === undefined)
            continue;
        const match = /="([^"]*)"/.exec(line);
        if (!match || !match[1])
            continue;
        const parts = match[1].split(',');
        const row = usable[i];
        if (!row)
            continue;
        const { symbol } = row;
        const quote = symbol.market === 'ashare'
            ? parseAShare(parts, symbol)
            : symbol.market === 'hk'
                ? parseHK(parts, symbol)
                : symbol.market === 'us'
                    ? parseUS(parts, symbol)
                    : null;
        if (quote) {
            quote.currency = currencyOf(symbol);
            out[quote.symbol] = quote;
        }
    }
    return out;
}
/**
 * 汇率。语义：`fxToCNY["USD"] = 1 美元 = ? 人民币`。
 * **JPY 报价是 100 日元兑 CNY，要 ÷100 归一。**
 */
export async function fetchFX() {
    const url = 'https://hq.sinajs.cn/list=fx_susdcny,fx_shkdcny,fx_seurcny,fx_sgbpcny,fx_sjpycny';
    const result = await getGBK(url, { headers: REFERER });
    if (!result.ok)
        return null;
    const out = {};
    for (const line of String(result.body).split('\n')) {
        const keyMatch = /fx_s([a-z]{6})/.exec(line);
        const bodyMatch = /="([^"]*)"/.exec(line);
        if (!keyMatch || !bodyMatch)
            continue;
        const pair = keyMatch[1];
        const body = bodyMatch[1];
        if (!pair || body === undefined)
            continue;
        const foreign = pair.slice(0, 3).toUpperCase();
        // 值 = 主体里第一个 > 0 的数值当中间价。
        let mid = null;
        for (const part of body.split(',')) {
            const value = Number(part);
            if (Number.isFinite(value) && value > 0) {
                mid = value;
                break;
            }
        }
        if (mid === null)
            continue;
        out[foreign] = foreign === 'JPY' ? mid / 100 : mid;
    }
    return Object.keys(out).length > 0 ? out : null;
}
export async function fetchNewsFeed(limit = 20) {
    const url = `https://zhibo.sina.com.cn/api/zhibo/feed?page=1&page_size=${Math.max(1, Math.min(25, limit))}&zhibo_id=152&tag_id=0&type=0&_=0`;
    const { getJSON } = await import('../http.js');
    const result = await getJSON(url);
    if (!result.ok)
        return [];
    const list = result.body &&
        result.body.result &&
        result.body.result.data &&
        result.body.result.data.feed &&
        result.body.result.data.feed.list;
    if (!Array.isArray(list))
        return [];
    return list
        .map((row) => ({
        id: String(row.id || ''),
        time: String(row.create_time || '').slice(0, 16),
        text: String(row.rich_text || '').trim(),
    }))
        .filter((row) => row.text);
}
