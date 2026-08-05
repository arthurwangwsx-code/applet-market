// 语言：跟随宿主有效 UI 语言（documentStart 就写好的 window.__aiboxEnvironment），
// 并监听 aibox.events 的 environment.localeChanged 重渲染（不重载 WebView）。
//
// 记账多一条纪律：**首启种子分类/账户名按当时的 App 内语言物化，之后永不回灌**，
// 所以 open() 前必须先拿到正确的 locale（见 app.jsx 的启动顺序）。
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
        handler(normalizeLocale(payload && (payload.locale || payload.language)));
    });
}
/** 取一条文案。缺键回落 en，再回落键名本身（漏键会显形，不会渲染成空白）。 */
export function translate(locale, key) {
    const table = STRINGS[locale] || STRINGS.en;
    if (table[key] !== undefined)
        return table[key];
    if (STRINGS.en[key] !== undefined)
        return STRINGS.en[key];
    return key;
}
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
