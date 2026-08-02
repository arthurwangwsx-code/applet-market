// NewsText / NewsURL 的逐行移植：HTML 剥离、实体解码、首图提取、URL 归一、
// FNV-1a 64 位哈希与 64 位 SimHash + 汉明距离。
//
// 64 位整数在 JS 里没有原生类型：这里用一对无符号 32 位（hi/lo）手算，
// 与 Swift 的 UInt64 逐位等价（BigInt 也能算，但去重要跑上千篇标题、常数太大）。

const FNV_OFFSET_HI = 0xcbf29ce4
const FNV_OFFSET_LO = 0x84222325
const FNV_PRIME_HI = 0x00000100
const FNV_PRIME_LO = 0x000001b3

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null

/** [hi, lo] = [hi, lo] * [pHi, pLo]，模 2^64。 */
function mul64(hi, lo, pHi, pLo) {
  const l0 = lo & 0xffff
  const l1 = lo >>> 16
  const p0 = pLo & 0xffff
  const p1 = pLo >>> 16

  const c0 = l0 * p0
  let c1 = (c0 >>> 16) + l1 * p0
  let c2 = c1 >>> 16
  c1 = (c1 & 0xffff) + l0 * p1
  c2 += c1 >>> 16

  const rLo = (((c1 & 0xffff) << 16) | (c0 & 0xffff)) >>> 0
  const rHi = (c2 + l1 * p1 + Math.imul(hi, pLo) + Math.imul(lo, pHi)) >>> 0
  return [rHi, rLo]
}

/** UTF-8 字节流上的 FNV-1a 64 位；返回 [hi, lo]（都是无符号 32 位）。 */
export function fnv1a64(text) {
  const bytes = encoder ? encoder.encode(String(text)) : legacyUTF8(String(text))
  let hi = FNV_OFFSET_HI
  let lo = FNV_OFFSET_LO
  for (let i = 0; i < bytes.length; i += 1) {
    lo = (lo ^ bytes[i]) >>> 0
    const next = mul64(hi, lo, FNV_PRIME_HI, FNV_PRIME_LO)
    hi = next[0]
    lo = next[1]
  }
  return [hi, lo]
}

function legacyUTF8(text) {
  const out = []
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code < 0x80) out.push(code)
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63))
    else out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
  }
  return out
}

/** 与 Swift `String(UInt64, radix: 16)` 一致：小写、无前导零。 */
export function hex64(pair) {
  const [hi, lo] = pair
  if (hi === 0) return lo.toString(16)
  return hi.toString(16) + lo.toString(16).padStart(8, '0')
}

export function fnv1aHex(text) {
  return hex64(fnv1a64(text))
}

// MARK: - HTML → 纯文本

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"',
  apos: "'", '#39': "'", '#x27': "'",
  nbsp: ' ', '#160': ' ',
  mdash: '—', '#8212': '—',
  ndash: '–', '#8211': '–',
  hellip: '…', '#8230': '…',
  ldquo: '“', rdquo: '”', lsquo: '‘',
  rsquo: '’', '#8217': '’',
}

function decodeEntity(entity) {
  if (Object.prototype.hasOwnProperty.call(ENTITIES, entity)) return ENTITIES[entity]
  if (entity.startsWith('#x') || entity.startsWith('#X')) {
    const code = parseInt(entity.slice(2), 16)
    if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) return safeFromCodePoint(code)
    return null
  }
  if (entity.startsWith('#')) {
    const code = parseInt(entity.slice(1), 10)
    if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) return safeFromCodePoint(code)
  }
  return null
}

function safeFromCodePoint(code) {
  try {
    return String.fromCodePoint(code)
  } catch (error) {
    return null
  }
}

export function decodeEntities(text) {
  if (!text.includes('&')) return text
  let out = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '&') {
      const semi = text.indexOf(';', i)
      if (semi > i && semi - i <= 10) {
        const decoded = decodeEntity(text.slice(i + 1, semi))
        if (decoded !== null) {
          out += decoded
          i = semi + 1
          continue
        }
      }
    }
    out += text[i]
    i += 1
  }
  return out
}

export function collapse(text) {
  return String(text).split(/[ \n\t\r ]+/).filter(Boolean).join(' ').trim()
}

/** 剥 HTML 标签 + 解实体 + 折叠空白（`<` 与 `>` 之间整段丢弃，`>` 补一个空格）。 */
export function plain(html) {
  const source = String(html == null ? '' : html)
  if (!source.includes('<') && !source.includes('&')) return collapse(source)
  let out = ''
  let inTag = false
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '<') inTag = true
    else if (ch === '>') { inTag = false; out += ' ' }
    else if (!inTag) out += ch
  }
  return collapse(decodeEntities(out))
}

/** 从一段 HTML 里抓第一个 `<img src="http…">`（feed 无独立图字段时的封面兜底）。 */
export function firstImageURL(html) {
  const source = String(html == null ? '' : html)
  const imgAt = source.toLowerCase().indexOf('<img')
  if (imgAt < 0) return null
  const tail = source.slice(imgAt + 4)
  const srcAt = tail.toLowerCase().indexOf('src')
  if (srcAt < 0) return null
  const afterSrc = tail.slice(srcAt + 3)
  const eq = afterSrc.indexOf('=')
  if (eq < 0) return null
  const afterEq = afterSrc.slice(eq + 1).replace(/^ +/, '')
  const quote = afterEq[0]
  if (quote !== '"' && quote !== "'") return null
  const body = afterEq.slice(1)
  const end = body.indexOf(quote)
  if (end < 0) return null
  const url = body.slice(0, end).trim()
  return url.startsWith('http') ? url : null
}

// MARK: - SimHash

function isCJK(code) {
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)
}

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u

/** 切词：英文按字母数字成词；CJK 逐字入词，且相邻二字组也入词。 */
export function shingles(text) {
  const lower = String(text || '').toLowerCase()
  const words = []
  const cjk = []
  let current = ''
  const flush = () => { if (current) { words.push(current); current = '' } }

  for (const ch of lower) {
    if (LETTER_OR_NUMBER.test(ch)) {
      if (isCJK(ch.codePointAt(0))) { flush(); cjk.push(ch) }
      else current += ch
    } else {
      flush()
    }
  }
  flush()

  if (cjk.length >= 2) {
    for (const ch of cjk) words.push(ch)
    for (let i = 0; i < cjk.length - 1; i += 1) words.push(cjk[i] + cjk[i + 1])
  } else if (cjk.length === 1) {
    words.push(cjk[0])
  }
  return words
}

/** 64 位 SimHash，返回 [hi, lo]；无 token 时返回 [0, 0]（＝ Swift 的 0）。 */
export function simhash(text) {
  const tokens = shingles(text)
  if (tokens.length === 0) return [0, 0]
  const votes = new Int32Array(64)
  for (const token of tokens) {
    const [hi, lo] = fnv1a64(token)
    for (let i = 0; i < 32; i += 1) votes[i] += ((lo >>> i) & 1) === 1 ? 1 : -1
    for (let i = 0; i < 32; i += 1) votes[i + 32] += ((hi >>> i) & 1) === 1 ? 1 : -1
  }
  let lo = 0
  let hi = 0
  for (let i = 0; i < 32; i += 1) if (votes[i] > 0) lo = (lo | (1 << i)) >>> 0
  for (let i = 0; i < 32; i += 1) if (votes[i + 32] > 0) hi = (hi | (1 << i)) >>> 0
  return [hi, lo]
}

export function isZeroHash(pair) {
  return pair[0] === 0 && pair[1] === 0
}

function popcount32(value) {
  let v = value - ((value >>> 1) & 0x55555555)
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333)
  v = (v + (v >>> 4)) & 0x0f0f0f0f
  return (Math.imul(v, 0x01010101) >>> 24)
}

export function hamming(a, b) {
  return popcount32((a[0] ^ b[0]) >>> 0) + popcount32((a[1] ^ b[1]) >>> 0)
}

// MARK: - URL 归一

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'spm', 'frommodule', 'from', 'ref', 'source', 'wxsource', 'scene',
])

/** 归一：去锚点、去追踪参数、host 小写、去尾斜杠 —— 让转载/带参链接对齐同一稳定键。 */
export function normalizeURL(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  let url
  try {
    url = new URL(trimmed)
  } catch (error) {
    return trimmed.toLowerCase()
  }
  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  const kept = []
  url.searchParams.forEach((value, name) => {
    if (!TRACKING_PARAMS.has(name.toLowerCase())) kept.push([name, value])
  })
  url.search = ''
  if (kept.length > 0) {
    const params = new URLSearchParams()
    for (const [name, value] of kept) params.append(name, value)
    url.search = `?${params.toString()}`
  }
  let out = url.toString()
  while (out.endsWith('/')) out = out.slice(0, -1)
  return out
}

/** 稳定键：归一 URL 的哈希优先，URL 空则退 guid，再退 title。 */
export function stableKey(url, guid, title) {
  const normalized = normalizeURL(url)
  if (normalized) return `u:${fnv1aHex(normalized)}`
  if (guid) return `g:${guid}`
  return `t:${fnv1aHex(title || '')}`
}
