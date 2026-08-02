// 语言：跟随宿主有效 UI 语言（documentStart 就写好的 window.__aiboxEnvironment），
// 并监听 `environment.localeChanged` 重渲染（不重载 WebView）。

import { STRINGS } from './strings.js'

/** 宿主 locale → 本包支持的语言键（zh-Hans 与 en 两档，其余回落 en）。 */
export function normalizeLocale(locale) {
  const raw = String(locale || 'en').toLowerCase()
  if (raw.startsWith('zh')) return 'zh-Hans'
  return 'en'
}

export function currentLocale() {
  const env = typeof window !== 'undefined' ? window.__aiboxEnvironment : null
  return normalizeLocale(env && (env.locale || env.language))
}

/** 订阅宿主语言变化；返回退订函数。 */
export function onLocaleChanged(handler) {
  const bus = typeof window !== 'undefined' && window.aibox && window.aibox.events
  if (!bus || typeof bus.on !== 'function') return () => {}
  return bus.on('environment.localeChanged', (payload) => {
    handler(normalizeLocale(payload && (payload.locale || payload.language)))
  })
}

/** 缺键时回落 en，再回落键名本身（便于发现漏键，不会渲染成空白）。 */
export function translate(locale, key) {
  const table = STRINGS[locale] || STRINGS.en
  if (table[key] !== undefined) return table[key]
  if (STRINGS.en[key] !== undefined) return STRINGS.en[key]
  return key
}

export function fmt(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (whole, index) => {
    const value = args[Number(index)]
    return value === undefined || value === null ? whole : String(value)
  })
}

export function makeT(locale) {
  return (key, ...args) => {
    const value = translate(locale, key)
    return args.length > 0 ? fmt(value, ...args) : value
  }
}

export function bcp47(locale) {
  return locale === 'zh-Hans' ? 'zh-CN' : 'en-US'
}
