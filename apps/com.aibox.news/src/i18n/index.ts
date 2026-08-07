// 语言：跟随宿主有效 UI 语言（documentStart 就写好的 window.__aiboxEnvironment），
// 并监听 aibox.events 的 environment.localeChanged 事件重渲染（不重载 WebView）。

import { STRINGS } from './strings.js'
import type { Translate, Unsubscribe } from '../types.js'

export type SupportedLocale = keyof typeof STRINGS

/** 宿主 locale → 本包支持的语言键（只有 zh-Hans 与 en 两档，其余一律回落 en）。 */
export function normalizeLocale(locale: unknown): SupportedLocale {
  const raw = String(locale || 'en').toLowerCase()
  if (raw.startsWith('zh')) return 'zh-Hans'
  return 'en'
}

export function currentLocale() {
  const env = (typeof window !== 'undefined' ? window.__aiboxEnvironment : null) as {
    locale?: string
    language?: string
  } | null
  return normalizeLocale(env && (env.locale || env.language))
}

/** 订阅宿主语言变化；返回退订函数。宿主没接事件总线时静默返回空函数。 */
export function onLocaleChanged(handler: (locale: SupportedLocale) => void): Unsubscribe {
  const bus = typeof window !== 'undefined' && window.aibox && window.aibox.events
  if (!bus || typeof bus.on !== 'function') return () => {}
  return bus.on('environment.localeChanged', (payload: unknown) => {
    const row = payload && typeof payload === 'object' ? (payload as { locale?: string; language?: string }) : null
    handler(normalizeLocale(row && (row.locale || row.language)))
  })
}

/** 取一条文案。缺键时回落 en，再回落键名本身（便于发现漏键，不会渲染成空白）。 */
export function translate(locale: SupportedLocale, key: string) {
  const table: Record<string, string> = STRINGS[locale] || STRINGS.en
  if (table[key] !== undefined) return table[key]
  const english = STRINGS.en as Record<string, string>
  if (english[key] !== undefined) return english[key]
  return key
}

/** 位置占位符填充：fmt('{0} · {1} 个来源', '3分钟前', 6)。 */
export function fmt(template: string, ...args: Array<string | number>) {
  return String(template).replace(/\{(\d+)\}/g, (whole, index) => {
    const value = args[Number(index)]
    return value === undefined || value === null ? whole : String(value)
  })
}

/** 绑定 locale 的取词器：const t = makeT(locale); t('news.tab.feed') / t('news.status.updated', a, b) */
export function makeT(locale: SupportedLocale): Translate {
  return (key: string, ...args: Array<string | number>) => {
    const value = translate(locale, key)
    return args.length > 0 ? fmt(value, ...args) : value
  }
}

/** BCP-47 标签（给 Intl 与 TTS 用）。 */
export function bcp47(locale: SupportedLocale) {
  return locale === 'zh-Hans' ? 'zh-CN' : 'en-US'
}
