// 语言：跟随宿主有效 UI 语言（documentStart 就写好的 window.__aiboxEnvironment），
// 并监听 `environment.localeChanged` 重渲染（不重载 WebView）。

import { STRINGS } from './strings.js'
import type { Translate } from '../lib/types.js'

type SupportedLocale = keyof typeof STRINGS

/** 宿主 locale → 本包支持的语言键（zh-Hans 与 en 两档，其余回落 en）。 */
export function normalizeLocale(locale: unknown): SupportedLocale {
  const raw = String(locale || 'en').toLowerCase()
  if (raw.startsWith('zh')) return 'zh-Hans'
  return 'en'
}

export function currentLocale(): SupportedLocale {
  const env = typeof window !== 'undefined' ? window.__aiboxEnvironment : null
  return normalizeLocale(env && (env.locale || env.language))
}

/** 订阅宿主语言变化；返回退订函数。 */
export function onLocaleChanged(handler: (locale: SupportedLocale) => void): () => void {
  const bus = typeof window !== 'undefined' && window.aibox && window.aibox.events
  if (!bus || typeof bus.on !== 'function') return () => {}
  return bus.on<{ locale?: string; language?: string }>('environment.localeChanged', (payload) => {
    handler(normalizeLocale(payload?.locale || payload?.language))
  })
}

/** 缺键时回落 en，再回落键名本身（便于发现漏键，不会渲染成空白）。 */
export function translate(locale: SupportedLocale, key: string): string {
  const table: Record<string, string> = STRINGS[locale] || STRINGS.en
  const fallback: Record<string, string> = STRINGS.en
  if (table[key] !== undefined) return table[key]
  if (fallback[key] !== undefined) return fallback[key]
  return key
}

export function fmt(template: string, ...args: Array<string | number>): string {
  return String(template).replace(/\{(\d+)\}/g, (whole, index) => {
    const value = args[Number(index)]
    return value === undefined || value === null ? whole : String(value)
  })
}

export function makeT(locale: SupportedLocale): Translate {
  return (key: string, ...args: Array<string | number>) => {
    const value = translate(locale, key)
    return args.length > 0 ? fmt(value, ...args) : value
  }
}

export function bcp47(locale: SupportedLocale): string {
  return locale === 'zh-Hans' ? 'zh-CN' : 'en-US'
}
