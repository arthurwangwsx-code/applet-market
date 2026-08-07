// 小票 / 支付截图的文本 → 一笔交易草稿。
//
// ## 分两段，且**先规则后 AI**
//
// 1. 本文件的规则解析：金额、币种、日期、商家。小票的这几样格式相当固定，
//    规则命中率高、零延迟、零配额，而且**离线可用**。
// 2. 规则拿不准时才问 AI（`aibox.ai.decide`）——它擅长的是「这家店属于哪个分类」这类判断，
//    而不是从一堆数字里挑出总额（那件事规则更稳）。
//
// 反过来做（一上来就把整段文本丢给模型）会在没配模型、没网络、超配额时整条不可用，
// 而这恰恰是「随手记一笔」最需要它工作的场景。
//
// ## 多币种：币种必须从票面认，不能默认本位币
//
// 出国消费的小票写的是当地货币。默认成本位币会把 "¥" 和 "$" 记成同一个数，
// 那是**静默的错账**——金额看着对、币种错了，报表和净资产全歪。
// 所以这里认符号也认代码，认不出就**明确回 null** 让页面问用户，而不是猜。
/** 常见货币符号 → ISO 代码。`¥` 有歧义（CNY/JPY），单独处理。 */
const SYMBOL_TO_CODE = {
    $: 'USD',
    US$: 'USD',
    HK$: 'HKD',
    NT$: 'TWD',
    C$: 'CAD',
    A$: 'AUD',
    '€': 'EUR',
    '£': 'GBP',
    '₩': 'KRW',
    '₹': 'INR',
    '₽': 'RUB',
    '฿': 'THB',
    '₫': 'VND',
    '₪': 'ILS',
    '₺': 'TRY',
    R$: 'BRL',
    S$: 'SGD',
    RM: 'MYR',
    '₱': 'PHP',
    Rp: 'IDR',
    CHF: 'CHF',
    kr: 'SEK',
};
/** 明写的 ISO 代码（票面上常见的那些）。 */
const CODE_RE = /\b(CNY|RMB|USD|EUR|GBP|JPY|HKD|TWD|KRW|SGD|AUD|CAD|CHF|THB|MYR|PHP|IDR|VND|INR|RUB|NZD|SEK|NOK|DKK|BRL|TRY|ILS|AED|SAR|ZAR|MXN|PLN)\b/i;
/**
 * 从文本里认币种。
 *
 * `¥` 的歧义按**上下文**判：出现日文/「円」判 JPY，否则 CNY。这不是猜——
 * 一张日文小票上的 ¥ 记成人民币是实打实的错账。认不出回 null，由页面问用户。
 */
export function detectCurrency(text) {
    const s = String(text || '');
    const code = s.match(CODE_RE);
    if (code) {
        const upper = code[1]?.toUpperCase() ?? '';
        return upper === 'RMB' ? 'CNY' : upper;
    }
    // 多字符符号优先（HK$ 要先于 $ 匹配，否则 HK$ 会被认成 USD）
    const symbols = Object.keys(SYMBOL_TO_CODE).sort((a, b) => b.length - a.length);
    for (const sym of symbols) {
        if (s.includes(sym))
            return SYMBOL_TO_CODE[sym] ?? null;
    }
    if (s.includes('¥') || s.includes('￥')) {
        return /[ぁ-んァ-ヶ]|円|税込|合計/.test(s) ? 'JPY' : 'CNY';
    }
    if (s.includes('元') || s.includes('人民币'))
        return 'CNY';
    return null;
}
/**
 * 认总额。
 *
 * 策略是**找带"合计/总计/应付"这类词的那一行**，而不是取最大数字 ——
 * 小票上最大的数字常常是卡号、订单号或时间戳。找不到关键词时才退回
 * 「带货币符号的最大金额」，且那种情况把 `confident` 标 false 让页面提示用户核对。
 */
const TOTAL_HINTS = /(合计|總計|总计|应付|實付|实付|付款金额|消费金额|总额|total|amount due|amount paid|grand total|subtotal)/i;
const MONEY_RE = /(?:[¥￥$€£₩₹₽฿₫₪₺]|HK\$|NT\$|US\$|R\$|S\$|RM|Rp)?\s*(\d{1,3}(?:[,，]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;
export function detectAmount(text) {
    const lines = String(text || '').split(/\r?\n/);
    const parse = (raw) => Number.parseFloat(String(raw).replace(/[,，]/g, ''));
    // 一轮：带「合计」这类词的行
    for (const line of lines) {
        if (!TOTAL_HINTS.test(line))
            continue;
        const found = [...line.matchAll(MONEY_RE)].map((m) => parse(m[1])).filter((n) => Number.isFinite(n) && n > 0);
        if (found.length)
            return { amount: Math.max(...found), confident: true };
    }
    // 二轮：全文里带货币符号的数字，取最大
    const all = [];
    for (const line of lines) {
        for (const m of line.matchAll(MONEY_RE)) {
            // 只要**带符号**的，纯数字（卡号/单号）不算
            if (!/[¥￥$€£₩₹₽฿₫₪₺]|HK\$|NT\$|US\$|R\$|S\$|RM|Rp/.test(m[0]))
                continue;
            const n = parse(m[1]);
            if (Number.isFinite(n) && n > 0)
                all.push(n);
        }
    }
    if (all.length)
        return { amount: Math.max(...all), confident: false };
    return { amount: null, confident: false };
}
/** 认日期。支持 2026-08-06 / 2026/8/6 / 08-06 / 2026年8月6日。认不出回 null（页面用今天）。 */
export function detectDate(text, now = Date.now()) {
    const s = String(text || '');
    const thisYear = new Date(now).getFullYear();
    const patterns = [/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/, /(\d{1,2})[-/月.](\d{1,2})[日]?(?!\d)/];
    for (const [i, re] of patterns.entries()) {
        const m = s.match(re);
        if (!m)
            continue;
        const y = i === 0 ? Number(m[1]) : thisYear;
        const mo = Number(i === 0 ? m[2] : m[1]);
        const d = Number(i === 0 ? m[3] : m[2]);
        if (mo < 1 || mo > 12 || d < 1 || d > 31)
            continue;
        const ts = new Date(y, mo - 1, d).getTime();
        // 未来日期多半是认错了（把有效期/单号当成日期），丢掉。
        if (ts > now + 86400000)
            continue;
        return ts;
    }
    return null;
}
/**
 * 认商家。取最前面那些**不含数字、不是纯符号**的行 —— 小票抬头几乎总是店名。
 * 只回一个候选串给页面做默认值，用户可改。
 */
export function detectPayee(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    for (const line of lines.slice(0, 6)) {
        if (line.length < 2 || line.length > 24)
            continue;
        if (/\d{3,}/.test(line))
            continue; // 单号、电话
        // 分隔线判据：**一个字母或数字都没有**。
        // ⚠️ 不能用 `/^[\W_]+$/` —— JS 的 `\W` 是 `[^A-Za-z0-9_]`，**中日韩文字全部算 `\W`**，
        // 那条会把「星巴克咖啡」当成分隔线跳掉，于是中文小票几乎永远认不出商家。
        // `\p{L}` 需要 `u` 标志，它认所有语言的字母。
        if (!/[\p{L}\p{N}]/u.test(line))
            continue;
        if (TOTAL_HINTS.test(line))
            continue;
        // 金额行不是商家名：带货币符号、或「数字+小数」占了整行的，跳过。
        if (/[¥￥$€£₩₹₽฿₫₪₺]/.test(line))
            continue;
        if (/^\S*\s*[x×]\s*\d+\s+[\d.]+$/i.test(line))
            continue; // "拿铁 x1  32.00"
        return line;
    }
    return '';
}
/**
 * 一次性把 OCR 文本解析成交易草稿。
 *
 * 回的每一项都可能是 null —— **不编造**。页面据此决定哪几栏要用户确认，
 * 这比填一个看似合理的猜测安全得多（记错的账比没记上的账更难发现）。
 */
export function parseReceipt(text, now = Date.now()) {
    const { amount, confident } = detectAmount(text);
    return {
        amount,
        amountConfident: confident,
        currency: detectCurrency(text),
        date: detectDate(text, now),
        payee: detectPayee(text),
        raw: String(text || ''),
    };
}
