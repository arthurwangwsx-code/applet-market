// 腾讯（主源，A/港/美通吃）—— 规格 §8.1。零 API Key，靠 `Referer: https://gu.qq.com` 绕反爬。
//
// 响应是 **GBK**，必须 `responseType:'base64'` + `TextDecoder('gb18030')`（见 lib/http.js 文件头）。
// 三个必须照抄的细节：
//  · 字段数 ≤ 34 的行**直接丢弃**（半截响应比没有更危险）；
//  · 下标 37 成交额，**A 股单位是万元（×10000），港/美是元**；
//  · 联想搜索的名称是 JSON 式 `\uXXXX` 转义，不反转义中文全乱。

import { coalesce, getGBK, getJSON, unescapeUnicode } from '../http.js'
import { canonicalOf, currencyOf, padHK, tencentKlineCode, tencentQuoteCode } from '../symbol.js'

const REFERER = { Referer: 'https://gu.qq.com' }

function pick(parts, index) {
  const raw = parts[index]
  if (raw === undefined || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

/** 五档：价格 > 0 才收。原始量单位是股，UI 侧再 ÷100 成手。 */
function levels(parts, priceStart) {
  const out = []
  for (let i = 0; i < 5; i += 1) {
    const price = pick(parts, priceStart + i * 2)
    const volume = pick(parts, priceStart + i * 2 + 1)
    if (price !== null && price > 0) out.push({ price, volume: volume || 0 })
  }
  return out
}

/** 解析一行 `v_<key>="1~字段~...";` 的主体。 */
export function parseQuoteLine(body, symbol) {
  const parts = body.split('~')
  if (parts.length <= 34) return null
  const market = symbol.market
  const price = pick(parts, 3)
  if (price === null) return null
  const prevClose = pick(parts, 4) || 0
  let change = pick(parts, 31)
  if (change === null) change = price - prevClose
  const amountRaw = pick(parts, 37)
  // A 股成交额单位是**万元**，港/美是元。
  const amount = amountRaw === null ? null : (market === 'ashare' ? amountRaw * 10000 : amountRaw)

  return {
    symbol: canonicalOf(symbol),
    market,
    name: parts[1] || '',
    price,
    prevClose,
    open: pick(parts, 5) || 0,
    high: pick(parts, 33) || 0,
    low: pick(parts, 34) || 0,
    change,
    changePct: pick(parts, 32) || 0,
    volume: pick(parts, 6) || 0,
    amount,
    turnover: (market === 'ashare' || market === 'hk') ? pick(parts, 38) : null,
    pe: pick(parts, 39),
    pb: market === 'ashare' ? pick(parts, 48) : null,
    marketCap: (market === 'ashare' || market === 'hk') ? pick(parts, 46) : null,
    amplitude: (market === 'ashare' || market === 'hk') ? pick(parts, 44) : null,
    bids: market === 'ashare' ? levels(parts, 9) : [],
    asks: market === 'ashare' ? levels(parts, 19) : [],
    time: parts[30] || '',
    currency: currencyOf(symbol),
    isEstimate: false,
    source: 'tencent',
  }
}

/**
 * 批量实时行情。返回 canonical → quote 的字典（拿不到的代码直接缺席，**不填假值**）。
 * 网络/解析失败一律返回空字典，不抛。
 */
export async function fetchQuotes(symbols) {
  const usable = symbols.map((symbol) => ({ symbol, code: tencentQuoteCode(symbol) })).filter((row) => row.code)
  if (usable.length === 0) return {}
  const codes = usable.map((row) => row.code).join(',')
  const url = `https://qt.gtimg.cn/q=${codes}`
  const result = await coalesce(`tencent:q:${[...usable.map((r) => r.code)].sort().join(',')}`,
    () => getGBK(url, { headers: REFERER }))
  if (!result.ok) return {}

  const byCode = new Map(usable.map((row) => [row.code.toLowerCase(), row.symbol]))
  const out = {}
  for (const line of String(result.body).split(';')) {
    const match = /v_([^=]+)="([^"]*)"/.exec(line)
    if (!match) continue
    const symbol = byCode.get(match[1].trim().toLowerCase())
    if (!symbol) continue
    const quote = parseQuoteLine(match[2], symbol)
    if (quote) out[quote.symbol] = quote
  }
  return out
}

const PERIOD_TOKEN = { '5m': 'm5', '15m': 'm15', '30m': 'm30', '60m': 'm60' }

/** 每行 `[date, open, close, high, low, volume]`——**close 在第 3 位、high 在第 4 位**。 */
function parseCandleRows(rows) {
  const out = []
  for (const row of rows || []) {
    if (!Array.isArray(row) || row.length < 6) continue
    const open = Number(row[1])
    const close = Number(row[2])
    const high = Number(row[3])
    const low = Number(row[4])
    // 防脏：OHLC 任一 ≤ 0 就丢弃整根。
    if (!(open > 0) || !(close > 0) || !(high > 0) || !(low > 0)) continue
    out.push({ date: String(row[0]), open, close, high, low, volume: Number(row[5]) || 0 })
  }
  return out
}

/** 日/周/月 K 线（港股换 hkfqkline host 路径）。`n` 钳到 1..800。 */
export async function fetchDailyCandles(symbol, period, adjust, count) {
  const code = tencentKlineCode(symbol)
  if (!code) return []
  const n = Math.max(1, Math.min(800, count || 160))
  const path = symbol.market === 'hk' ? 'hkfqkline' : 'fqkline'
  const url = `https://web.ifzq.gtimg.cn/appstock/app/${path}/get?param=${code},${period},,,${n},${adjust}`
  const result = await coalesce(`tencent:k:${code}:${period}:${adjust}:${n}`, () => getJSON(url, { headers: REFERER }))
  if (!result.ok) return []
  const bucket = result.body && result.body.data ? result.body.data[code] : null
  if (!bucket) return []
  // 缺复权键则退回裸键。
  const rows = bucket[`${adjust}${period}`] || bucket[period] || []
  return parseCandleRows(rows)
}

/** 分钟 K 线。（原生注明该端点未经 CI 验证，故失败时静默回空。） */
export async function fetchMinuteCandles(symbol, period, count) {
  const code = tencentKlineCode(symbol)
  const token = PERIOD_TOKEN[period]
  if (!code || !token) return []
  const n = Math.max(1, Math.min(800, count || 160))
  const url = `https://ifzq.gtimg.cn/appstock/app/kline/mkline?param=${code},${token},,${n}`
  const result = await coalesce(`tencent:m:${code}:${token}:${n}`, () => getJSON(url, { headers: REFERER }))
  if (!result.ok) return []
  const bucket = result.body && result.body.data ? result.body.data[code] : null
  if (!bucket) return []
  return parseCandleRows(bucket[token] || [])
}

/**
 * 搜索联想。响应 GBK，引号内主体按 `^` 分条，条内按 `~` 分段：`[0]=交易所 [1]=代码 [2]=名称`。
 * 只收 sh/sz/bj/hk/us，美股代码转大写。
 */
export async function search(query) {
  const text = String(query || '').trim()
  if (!text) return []
  const url = `https://smartbox.gtimg.cn/s3/?q=${encodeURIComponent(text)}&t=all`
  const result = await getGBK(url, { headers: REFERER })
  if (!result.ok) return []
  const match = /"([\s\S]*)"/.exec(String(result.body))
  if (!match) return []

  const out = []
  for (const entry of match[1].split('^')) {
    const parts = entry.split('~')
    if (parts.length < 3) continue
    const exchange = parts[0].trim().toLowerCase()
    const code = parts[1].trim()
    const name = unescapeUnicode(parts[2].trim())
    if (!code || !name) continue
    if (exchange === 'sh' || exchange === 'sz' || exchange === 'bj') {
      out.push({ market: 'ashare', code, exchange, name, symbol: `${exchange}${code}` })
    } else if (exchange === 'hk') {
      const padded = padHK(code)
      out.push({ market: 'hk', code: padded, exchange: null, name, symbol: `hk${padded}` })
    } else if (exchange === 'us') {
      const ticker = code.toUpperCase()
      out.push({ market: 'us', code: ticker, exchange: null, name, symbol: `us${ticker}` })
    }
  }
  return out
}
