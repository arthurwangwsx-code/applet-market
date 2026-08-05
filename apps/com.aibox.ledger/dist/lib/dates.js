// 日期口径（§6.4）。全部走本地时区；记账日恒归一到当天 00:00。
/** 本地时区当天 00:00 的时间戳（ms）。 */
export function dayStart(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}
export const DAY_MS = 24 * 60 * 60 * 1000;
/** 月键 `YYYYMM` 整数。 */
export function monthKeyOf(value) {
    const date = new Date(value);
    return date.getFullYear() * 100 + (date.getMonth() + 1);
}
export function monthKeyNow() {
    return monthKeyOf(Date.now());
}
/** 月键 → 该月 1 号 00:00 的时间戳。 */
export function monthStart(monthKey) {
    const year = Math.trunc(monthKey / 100);
    const month = monthKey % 100;
    return new Date(year, month - 1, 1, 0, 0, 0, 0).getTime();
}
/** 月键 → 次月 1 号 00:00（开区间上界）。 */
export function monthEnd(monthKey) {
    const year = Math.trunc(monthKey / 100);
    const month = monthKey % 100;
    return new Date(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1, 0, 0, 0, 0).getTime();
}
export function addMonths(monthKey, delta) {
    const year = Math.trunc(monthKey / 100);
    const month = monthKey % 100 - 1 + delta;
    const nextYear = year + Math.floor(month / 12);
    const nextMonth = ((month % 12) + 12) % 12;
    return nextYear * 100 + nextMonth + 1;
}
export function daysInMonth(monthKey) {
    return Math.round((monthEnd(monthKey) - monthStart(monthKey)) / DAY_MS);
}
/**
 * 本月剩余天数（含今天）：
 *  - 今天早于该月起始（查未来月）→ 整月天数
 *  - 今天 ≥ 该月结束（查过去月）→ 0
 */
export function daysRemainingInMonth(monthKey, now = Date.now()) {
    const today = dayStart(now);
    const start = monthStart(monthKey);
    const end = monthEnd(monthKey);
    if (today < start)
        return daysInMonth(monthKey);
    if (today >= end)
        return 0;
    return Math.round((end - DAY_MS - today) / DAY_MS) + 1;
}
// MARK: - 本地化格式
const BCP47 = { 'zh-Hans': 'zh-CN', en: 'en-US' };
function tag(locale) {
    return BCP47[locale] ?? 'en-US';
}
const cache = new Map();
function formatter(locale, options) {
    const key = `${locale}|${JSON.stringify(options)}`;
    let value = cache.get(key);
    if (!value) {
        value = new Intl.DateTimeFormat(tag(locale), options);
        cache.set(key, value);
    }
    return value;
}
/** 月标题：zh「2026年7月」/ en「July 2026」。 */
export function monthTitle(monthKey, locale) {
    return formatter(locale, { year: 'numeric', month: 'long' }).format(new Date(monthStart(monthKey)));
}
/** 明细日期表头的 `MMMd EEE`：zh「7月4日周五」/ en「Jul 4, Fri」。 */
export function dayHeaderDate(value, locale) {
    return formatter(locale, { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(value));
}
/** 短日期 `Md`（账户详情、导入预览、下钻列表）。 */
export function shortDate(value, locale) {
    return formatter(locale, { month: 'numeric', day: 'numeric' }).format(new Date(value));
}
/** 项目日期区间用的 `MMMd`。 */
export function mediumDayDate(value, locale) {
    return formatter(locale, { month: 'short', day: 'numeric' }).format(new Date(value));
}
/** ISO 日 `yyyy-MM-dd`（本地时区，不是 UTC——记账日是本地概念）。 */
export function isoDay(value) {
    const date = new Date(value);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}
/** ISO 8601 含小数秒（CSV 时间戳）。 */
export function isoTimestamp(value) {
    return new Date(value).toISOString();
}
/** 宽松日期解析：取前 10 字符按 `yyyy-MM-dd`；失败返回 null。 */
export function parseISODay(text) {
    const raw = String(text ?? '').trim().slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match)
        return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
}
/** 宽松时间戳解析（CSV 的 createdAt）。失败回落到 occurredOn。 */
export function parseTimestamp(text, fallback) {
    const value = Date.parse(String(text ?? ''));
    return Number.isNaN(value) ? fallback : value;
}
export function isSameDay(a, b) {
    return dayStart(a) === dayStart(b);
}
