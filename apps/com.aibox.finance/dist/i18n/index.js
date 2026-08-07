// 语言：跟随宿主有效 UI 语言（documentStart 就写好的 `window.__aiboxEnvironment`），
// 并监听 `environment.localeChanged` 重渲染（不重载 WebView）。
import { STRINGS } from './strings.js';
export function normalizeLocale(locale) {
    const raw = String(locale || 'en').toLowerCase();
    return raw.startsWith('zh') ? 'zh-Hans' : 'en';
}
export function currentLocale() {
    const env = typeof window !== 'undefined' ? window.__aiboxEnvironment : null;
    return normalizeLocale(env && (env.locale || env.language));
}
export function onLocaleChanged(handler) {
    const bus = typeof window !== 'undefined' && window.aibox && window.aibox.events;
    if (!bus || typeof bus.on !== 'function')
        return () => { };
    return bus.on('environment.localeChanged', (payload) => {
        handler(normalizeLocale(payload?.locale || payload?.language));
    });
}
export function translate(locale, key) {
    const table = STRINGS[locale] || STRINGS.en;
    const fallback = STRINGS.en;
    if (table[key] !== undefined)
        return table[key];
    if (fallback[key] !== undefined)
        return fallback[key];
    return key;
}
/** 位置占位符：fmt('更新于 {0}', '15:04')。 */
export function fmt(template, ...args) {
    return String(template).replace(/\{(\d+)\}/g, (whole, index) => {
        const value = args[Number(index)];
        return value === undefined || value === null ? whole : String(value);
    });
}
export function makeT(locale) {
    return (key, ...args) => {
        const value = translate(locale, key);
        return args.length > 0 ? fmt(value, ...args) : value;
    };
}
export function bcp47(locale) {
    return locale === 'zh-Hans' ? 'zh-CN' : 'en-US';
}
/**
 * 分组名解析：以 `group.` 开头（或等于 `finance.watch.group.all`）→ 走本地化；
 * 否则原样显示（用户自建名）。
 */
export function groupLabel(t, name) {
    if (!name)
        return '';
    if (name === 'finance.watch.group.all' || name.startsWith('group.'))
        return t(name);
    return name;
}
/** 账户名同理：种子账户名是键，用户改过的是字面量。 */
export function accountLabel(t, name) {
    if (name === 'account.default.name')
        return t(name);
    return name;
}
