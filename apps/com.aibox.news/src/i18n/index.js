// 语言：跟随宿主有效 UI 语言（documentStart 就写好的 window.__aiboxEnvironment），
// 并监听 aibox.events 的 environment.localeChanged 事件重渲染（不重载 WebView）。

import { STRINGS } from './strings.js'

/** 宿主 locale → 本包支持的语言键（只有 zh-Hans 与 en 两档，其余一律回落 en）。 */
export function normalizeLocale(locale) {
  const raw = String(locale || 'en').toLowerCase()
  if (raw.startsWith('zh')) return 'zh-Hans'
  return 'en'
}

export function currentLocale() {
  const env = typeof window !== 'undefined' ? window.__aiboxEnvironment : null
  return normalizeLocale(env && (env.locale || env.language))
}

/** 订阅宿主语言变化；返回退订函数。宿主没接事件总线时静默返回空函数。 */
export function onLocaleChanged(handler) {
  const bus = typeof window !== 'undefined' && window.aibox && window.aibox.events
  if (!bus || typeof bus.on !== 'function') return () => {}
  return bus.on('environment.localeChanged', (payload) => {
    handler(normalizeLocale(payload && (payload.locale || payload.language)))
  })
}

/** 取一条文案。缺键时回落 en，再回落键名本身（便于发现漏键，不会渲染成空白）。 */
export function translate(locale, key) {
  const table = STRINGS[locale] || STRINGS.en
  if (table[key] !== undefined) return table[key]
  if (STRINGS.en[key] !== undefined) return STRINGS.en[key]
  return key
}

/** 位置占位符填充：fmt('{0} · {1} 个来源', '3分钟前', 6)。 */
export function fmt(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (whole, index) => {
    const value = args[Number(index)]
    return value === undefined || value === null ? whole : String(value)
  })
}

/** 绑定 locale 的取词器：const t = makeT(locale); t('news.tab.feed') / t('news.status.updated', a, b) */
export function makeT(locale) {
  return (key, ...args) => {
    const value = translate(locale, key)
    return args.length > 0 ? fmt(value, ...args) : value
  }
}

/** BCP-47 标签（给 Intl 与 TTS 用）。 */
export function bcp47(locale) {
  return locale === 'zh-Hans' ? 'zh-CN' : 'en-US'
}
