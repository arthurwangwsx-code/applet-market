// NewsDate 的移植：feed 时间串的宽松解析。
// 顺序对齐原生：ISO8601（含小数秒）→ ISO8601 → RFC822 四变体 → 五种宽松格式。
// 无时区标记的格式按**本地时区**解释（与 Swift DateFormatter 未设 timeZone 时一致）。

// yyyy-MM-dd[T ]HH:mm[:ss[.fff]][Z|±HH:mm]
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?\s*(Z|z|[+-]\d{2}:?\d{2})?$/
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function offsetMinutes(zone) {
  if (!zone) return null
  if (zone === 'Z' || zone === 'z') return 0
  const sign = zone[0] === '-' ? -1 : 1
  const digits = zone.slice(1).replace(':', '')
  const hours = Number(digits.slice(0, 2))
  const minutes = Number(digits.slice(2, 4) || '0')
  return sign * (hours * 60 + minutes)
}

/** 解析 feed 的时间串；失败返回 null（调用方回落 now）。 */
export function parseDate(raw) {
  const text = String(raw || '').trim()
  if (!text) return null

  const iso = ISO_RE.exec(text)
  if (iso) {
    const [, y, mo, d, h, mi, s, frac, zone] = iso
    const millis = frac ? Math.round(Number(frac) * 1000) : 0
    const offset = offsetMinutes(zone)
    if (offset === null) {
      return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0), millis)
    }
    const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0), millis)
    return new Date(utc - offset * 60000)
  }

  const dateOnly = DATE_ONLY_RE.exec(text)
  if (dateOnly) {
    // Swift 的 `yyyy-MM-dd` formatter 用本地时区；JS 的 Date.parse 对纯日期按 UTC 解释，故手工构造。
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  }

  // RFC822 / RFC1123 及其变体（"Mon, 02 Jan 2026 15:04:05 +0800" / "… GMT"）交给引擎。
  const parsed = Date.parse(text)
  if (Number.isFinite(parsed)) return new Date(parsed)
  return null
}

/** 毫秒时间戳 → Date；非法值返回 null。持久化里时间一律存毫秒数。 */
export function toDate(millis) {
  if (typeof millis !== 'number' || !Number.isFinite(millis)) return null
  return new Date(millis)
}
