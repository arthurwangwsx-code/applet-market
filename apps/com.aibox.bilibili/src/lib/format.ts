// 展示层格式化。B 站的数字口径是「万 / 亿」，直接显示原始数字会让人对不上官方 App。

/** 播放量 / 弹幕数：1.2万、3.4亿。一万以下直接显示。 */
export function formatCount(n: number | string): string {
  const value = Number(n) || 0
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1).replace(/\.0$/, '')}亿`
  if (value >= 10_000) return `${(value / 10_000).toFixed(1).replace(/\.0$/, '')}万`
  return String(value)
}

/** 秒 → "12:34" / "1:02:03"。 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (part: number) => String(part).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** 发布时间：今天显示时刻，今年显示月日，跨年显示年月日。 */
export function formatDate(unixSeconds: number): string {
  const ts = Number(unixSeconds) || 0
  if (!ts) return ''
  const date = new Date(ts * 1000)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}-${date.getDate()}`
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}
