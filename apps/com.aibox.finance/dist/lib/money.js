// 金额纪律（规格 §9 / §11）：**现金与盈亏一律 Int「分」**，份额与价格才是 Double。
// 浮点只允许出现在最终显示格式化里，任何账目运算都在整数分上做。
//
// JS 没有 Int64；Number.MAX_SAFE_INTEGER = 9007199254740991 分 ≈ 9 万亿元，
// 对模拟账户足够，但**必须显式钳制**——溢出静默变成不精确整数比报错更危险。
export const MAX_MINOR = Number.MAX_SAFE_INTEGER;
export class MoneyError extends Error {
    code;
    detail;
    constructor(code, detail = null) {
        super(code);
        this.code = code;
        this.detail = detail || null;
    }
}
export function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
/**
 * 二进制浮点噪声的归一：`0.145 * 100` 在 IEEE754 下是 `14.499999999999998`，
 * 直接舍入会得到 14 分，而原生走 Decimal 得到的是 15 分。先把小数尾巴削到 6 位再舍入，
 * 结果与 Decimal 一致，同时不影响任何量级正常的账目数字。
 */
function snap(value) {
    if (!Number.isFinite(value))
        return value;
    if (Math.abs(value) >= 1e15)
        return value; // 已超出小数有效位，toFixed 无意义
    return Number(value.toFixed(6));
}
/** 四舍五入**远离 0**（与原生 Decimal plain 舍入一致）；非有限值当 0。 */
export function roundHalfAway(value) {
    if (!isFiniteNumber(value))
        return 0;
    const normalized = snap(value);
    return normalized < 0 ? -Math.round(-normalized) : Math.round(normalized);
}
/** 元 → 分。非有限当 0，溢出钳制（不抛）。 */
export function toMinor(value) {
    if (!isFiniteNumber(value))
        return 0;
    const minor = roundHalfAway(value * 100);
    return clampMinor(minor);
}
/** 分 → 元（只用于显示与比率计算）。 */
export function toMajor(minor) {
    return (Number(minor) || 0) / 100;
}
export function clampMinor(minor) {
    if (!Number.isFinite(minor))
        return 0;
    if (minor > MAX_MINOR)
        return MAX_MINOR;
    if (minor < -MAX_MINOR)
        return -MAX_MINOR;
    return Math.trunc(minor);
}
/** 加法：溢出即抛（账目路径宁可报错也不能默默算错）。 */
export function addMinor(a, b) {
    const sum = Number(a) + Number(b);
    if (!Number.isFinite(sum) || Math.abs(sum) > MAX_MINOR)
        throw new MoneyError('overflow');
    return Math.trunc(sum);
}
export function subMinor(a, b) {
    return addMinor(a, -Number(b));
}
/** 分 × 倍率（汇率等）→ 分，四舍五入远离 0；溢出即抛。 */
export function scaleMinor(minor, factor) {
    if (!isFiniteNumber(factor))
        throw new MoneyError('invalidRate');
    const scaled = Number(minor) * factor;
    if (!Number.isFinite(scaled) || Math.abs(scaled) > MAX_MINOR)
        throw new MoneyError('overflow');
    return roundHalfAway(scaled);
}
/**
 * 数量 × 价格 → 标的币「分」。规格 §10.1：`grossValue = quantity * price * 100`，
 * 必须有限且不越界，否则报错。
 */
export function grossMinorOf(quantity, price) {
    if (!isFiniteNumber(quantity) || quantity <= 0)
        throw new MoneyError('invalidQuantity');
    if (!isFiniteNumber(price) || price <= 0)
        throw new MoneyError('invalidPrice');
    const gross = quantity * price * 100;
    if (!Number.isFinite(gross) || Math.abs(gross) > MAX_MINOR)
        throw new MoneyError('overflow');
    return roundHalfAway(gross);
}
/**
 * 宽松数字解析：locale 感知失败时剥掉分组符号、把小数点归一成 `.` 再 parse。
 * 用于所有用户输入的金额/数量/价格框。
 */
export function parseNumberInput(text) {
    const raw = String(text == null ? '' : text).trim();
    if (!raw)
        return null;
    const direct = Number(raw);
    if (Number.isFinite(direct))
        return direct;
    const normalized = raw
        .replace(/[\s   ]/g, '')
        .replace(/[，,]/g, '')
        .replace(/[。．]/g, '.')
        .replace(/[^0-9.\-+]/g, '');
    // 剥完一个数字都不剩（"abc"）不能当 0——`Number('')` 是 0，
    // 会把无效输入静默变成一笔 0 元交易。
    if (!/\d/.test(normalized))
        return null;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}
