// FinSymbol —— 标的标识（规格 §9.2）。纯函数，无宿主依赖，可在 node 下直接跑自测。
//
// canonical 形态：A股 `sh600519` / 港股 `hk00700` / 美股 `usAAPL` / 基金 `fund161725`。
// 两级解析是刻意的：`parseStrict` 只认明确写法，`parse` 才对全字母兜底成美股 ticker。
// 关键坑：`"Tesla"` 全字母，宽松 parse 会造出永远查不到的假代码 `usTESLA`——
// 所以名字类输入必须先 strict 判空再走搜索。
export const MARKETS = ['ashare', 'hk', 'us', 'fund'];
export const MARKET_CURRENCY = {
    ashare: 'CNY',
    hk: 'HKD',
    us: 'USD',
    fund: 'CNY',
};
/** 价格小数位：基金 4 位，其余 2 位。 */
export function decimalsFor(market) {
    return market === 'fund' ? 4 : 2;
}
function makeSymbol(market, code, exchange) {
    return { market, code, exchange: exchange || null };
}
/** A 股交易所推断：6/9→sh，0/2/3→sz，4/8→bj，其余 sh。 */
export function exchangeForAShare(code) {
    const head = String(code).charAt(0);
    if (head === '6' || head === '9')
        return 'sh';
    if (head === '0' || head === '2' || head === '3')
        return 'sz';
    if (head === '4' || head === '8')
        return 'bj';
    return 'sh';
}
/** 港股代码补 0 到 5 位。 */
export function padHK(code) {
    const digits = String(code).replace(/\D/g, '');
    return digits.padStart(5, '0').slice(-5);
}
export function canonicalOf(symbol) {
    if (!symbol)
        return '';
    switch (symbol.market) {
        case 'ashare': return `${symbol.exchange || exchangeForAShare(symbol.code)}${symbol.code}`;
        case 'hk': return `hk${symbol.code}`;
        case 'us': return `us${symbol.code}`;
        case 'fund': return `fund${symbol.code}`;
        default: return symbol.code;
    }
}
/**
 * 严格解析：只认明确写法。全字母**不认**（返回 null）——这是与 `parse` 的唯一区别。
 */
export function parseStrict(input) {
    const raw = String(input || '').trim();
    if (!raw)
        return null;
    const lower = raw.toLowerCase();
    let match = /^(sh|sz|bj)(\d{6})$/.exec(lower);
    if (match)
        return makeSymbol('ashare', match[2], match[1]);
    match = /^of(\d{6})$/.exec(lower);
    if (match)
        return makeSymbol('fund', match[1], null);
    match = /^fund(\d+)$/.exec(lower);
    if (match)
        return makeSymbol('fund', match[1].padStart(6, '0'), null);
    match = /^hk(\d+)$/.exec(lower);
    if (match)
        return makeSymbol('hk', padHK(match[1]), null);
    match = /^us(.+)$/.exec(raw);
    if (match && /^[A-Za-z0-9.\-]+$/.test(match[1]))
        return makeSymbol('us', match[1].toUpperCase(), null);
    if (/^\d+$/.test(raw)) {
        if (raw.length === 6)
            return makeSymbol('ashare', raw, exchangeForAShare(raw));
        if (raw.length === 5)
            return makeSymbol('hk', raw, null);
        if (raw.length === 4)
            return makeSymbol('hk', padHK(raw), null);
    }
    return null;
}
/**
 * 宽松解析：先 strict，失败时全 ASCII 字母/点 → 当美股 ticker 大写兜底。
 * 只有「用户明确在输代码」的路径才该用它。
 */
export function parseSymbol(input) {
    const strict = parseStrict(input);
    if (strict)
        return strict;
    const raw = String(input || '').trim();
    if (raw && /^[A-Za-z.]+$/.test(raw) && raw.length <= 8)
        return makeSymbol('us', raw.toUpperCase(), null);
    return null;
}
/** canonical 串 → symbol；解析不出来时返回 null。 */
export function symbolFromCanonical(canonical) {
    return parseStrict(canonical);
}
export function currencyOf(symbol) {
    return MARKET_CURRENCY[symbol && symbol.market] || 'CNY';
}
// —— Provider 代码映射（规格 §8）——
/** 腾讯实时行情代码：A股 sh/sz/bj+6位；港股 r_hk+5位；美股 us+大写 ticker。 */
export function tencentQuoteCode(symbol) {
    switch (symbol.market) {
        case 'ashare': return `${symbol.exchange || exchangeForAShare(symbol.code)}${symbol.code}`;
        case 'hk': return `r_hk${symbol.code}`;
        case 'us': return `us${symbol.code}`;
        default: return null;
    }
}
/** 腾讯 K 线代码：港股用 `hk`+5 位（**不是** r_hk）。 */
export function tencentKlineCode(symbol) {
    switch (symbol.market) {
        case 'ashare': return `${symbol.exchange || exchangeForAShare(symbol.code)}${symbol.code}`;
        case 'hk': return `hk${symbol.code}`;
        case 'us': return `us${symbol.code}`;
        default: return null;
    }
}
/** 新浪实时行情代码：A股 sh/sz/bj+码；港股 rt_hk+码；美股 gb_+小写 ticker。 */
export function sinaQuoteCode(symbol) {
    switch (symbol.market) {
        case 'ashare': return `${symbol.exchange || exchangeForAShare(symbol.code)}${symbol.code}`;
        case 'hk': return `rt_hk${symbol.code}`;
        case 'us': return `gb_${symbol.code.toLowerCase()}`;
        default: return null;
    }
}
/** 东财 SECUCODE：`600519.SH`（大写交易所）。 */
export function secuCode(symbol) {
    if (symbol.market !== 'ashare')
        return null;
    return `${symbol.code}.${(symbol.exchange || exchangeForAShare(symbol.code)).toUpperCase()}`;
}
/** push2 secid：1.<code>（沪）/ 0.<code>（深、北）。 */
export function secid(symbol) {
    if (symbol.market !== 'ashare')
        return null;
    return `${(symbol.exchange || exchangeForAShare(symbol.code)) === 'sh' ? 1 : 0}.${symbol.code}`;
}
/** 从裸 A 股代码按首位数字推 secid（行业页资金榜用）。 */
export function secidFromCode(code, marketFlag) {
    if (marketFlag === 1 || marketFlag === '1')
        return `1.${code}`;
    if (marketFlag === 0 || marketFlag === '0')
        return `0.${code}`;
    return `${exchangeForAShare(code) === 'sh' ? 1 : 0}.${code}`;
}
// —— 固定指数表（规格 §2.1，顺序不可配置）——
export const INDEX_ROWS = [
    { canonical: 'sh000001', key: 'idx.sse' },
    { canonical: 'sz399001', key: 'idx.szse' },
    { canonical: 'sz399006', key: 'idx.chinext' },
    { canonical: 'hkHSI', key: 'idx.hsi' },
    { canonical: 'usIXIC', key: 'idx.nasdaq' },
    { canonical: 'usDJI', key: 'idx.dji' },
    { canonical: 'usINX', key: 'idx.sp500' },
];
/**
 * 指数 canonical → symbol。`hkHSI` / `usIXIC` 这类不是普通代码（`hk` 后面是字母），
 * `parseStrict` 认不出来，所以这里单独造，且**不能**走宽松 parse 兜底。
 */
export function indexSymbol(canonical) {
    if (canonical.startsWith('hk'))
        return makeSymbol('hk', canonical.slice(2), null);
    if (canonical.startsWith('us'))
        return makeSymbol('us', canonical.slice(2), null);
    return parseStrict(canonical);
}
/** 自选/详情通吃的解析入口：先当指数，再 strict。 */
export function resolveSymbol(canonical) {
    const row = INDEX_ROWS.find((entry) => entry.canonical === canonical);
    if (row)
        return indexSymbol(canonical);
    return parseStrict(canonical) || (canonical.startsWith('us') ? indexSymbol(canonical) : null);
}
