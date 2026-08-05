// NewsFormat 的移植：相对时间、紧凑绝对时间、字节数、耗时。
import { bcp47, translate } from '../i18n/index.js';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
function pad(value) {
    return String(value).padStart(2, '0');
}
/** 紧凑绝对时间 "MM-dd HH:mm"（与界面语言无关）。 */
export function shortStamp(millis) {
    const date = new Date(millis);
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const UNITS = [
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
    ['second', 1000],
];
/**
 * 信息流相对时间：|Δ| ≥ 7 天回落 "MM-dd HH:mm"；否则本地化相对时间。
 * **有意改良**（原生会对刚发布的时间戳产出「0秒后」）：|Δ| < 60s 一律显示「刚刚」。
 */
export function relative(millis, locale, now = Date.now()) {
    if (!millis || !Number.isFinite(millis))
        return '';
    const delta = Math.abs(now - millis);
    if (delta >= WEEK_MS)
        return shortStamp(millis);
    if (delta < 60 * 1000)
        return translate(locale, 'news.x.justNow');
    const signed = millis - now;
    for (const [unit, size] of UNITS) {
        if (delta >= size || unit === 'second') {
            const value = Math.round(signed / size);
            return formatRelative(value, unit, locale);
        }
    }
    return '';
}
function formatRelative(value, unit, locale) {
    try {
        const formatter = new Intl.RelativeTimeFormat(bcp47(locale), { numeric: 'always', style: 'short' });
        return formatter.format(value, unit);
    }
    catch (error) {
        const abs = Math.abs(value);
        const label = { day: 'd', hour: 'h', minute: 'min', second: 's' }[unit];
        return value < 0 ? `${abs}${label} ago` : `in ${abs}${label}`;
    }
}
/** file 风格字节数（KB / MB），与原生 ByteCountFormatter(.file) 同量级。 */
export function bytes(count) {
    const value = Number(count) || 0;
    if (value < 1000)
        return `${value} B`;
    if (value < 1000 * 1000)
        return `${(value / 1000).toFixed(0)} KB`;
    return `${(value / (1000 * 1000)).toFixed(1)} MB`;
}
/** 耗时：<1s 用「%.0f 毫秒」，否则「%.1f 秒」。 */
export function duration(seconds, t) {
    const value = Number(seconds) || 0;
    if (value < 1)
        return t('news.diagnostics.milliseconds', (value * 1000).toFixed(0));
    return t('news.diagnostics.seconds', value.toFixed(1));
}
