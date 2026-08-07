// 纯 JS MD5 —— WBI 签名的唯一依赖。
//
// 为什么必须自己写：WebView 的 `crypto.subtle` 只支持 SHA-1/256/384/512，**没有 MD5**
// （Web Crypto 规范就没收它）。而 B 站的 WBI 签名 `w_rid = md5(query + mixin_key)` 只认 MD5。
// 所以这条路上没有平台 API 可用，只能实现一遍。
//
// 实现按 RFC 1321。只处理 ASCII/UTF-8 字符串输入（WBI 的输入是 urlencode 过的 query，必为 ASCII），
// 输出 32 位小写 hex。

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4,
  11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

// K[i] = floor(2^32 × |sin(i+1)|)，RFC 1321 的常量表。写死而不是运行时算：
// 运行时算依赖 Math.sin 的精度，跨引擎不保证逐位一致，而这里错一位签名就全废。
const K = new Uint32Array([
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8,
  0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
  0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87,
  0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039,
  0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
  0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb,
  0xeb86d391,
])

const rotl = (x: number, count: number): number => (x << count) | (x >>> (32 - count))

/** UTF-8 编码成字节数组。WBI 的输入是 ASCII，但不假设——多一行换一类边界 bug 消失。 */
function utf8Bytes(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text)
  const out: number[] = []
  for (let i = 0; i < text.length; i += 1) {
    let c = text.charCodeAt(i)
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return new Uint8Array(out)
}

/** 32 位小写 hex 的 MD5。 */
export function md5(text: string): string {
  const msg = utf8Bytes(text)
  const bitLen = msg.length * 8
  // padding：0x80 + 若干 0，直到长度 ≡ 56 (mod 64)，末尾 8 字节是小端 64 位比特长度。
  const padded = new Uint8Array((((msg.length + 8) >> 6) << 6) + 64)
  padded.set(msg)
  padded[msg.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, bitLen >>> 0, true)
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  const M = new Uint32Array(16)

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    for (let i = 0; i < 16; i += 1) M[i] = view.getUint32(chunk + i * 4, true)
    let A = a0
    let B = b0
    let C = c0
    let D = d0
    for (let i = 0; i < 64; i += 1) {
      let F
      let g
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + K[i]! + M[g]!) | 0
      A = D
      D = C
      C = B
      B = (B + rotl(F, S[i]!)) | 0
    }
    a0 = (a0 + A) | 0
    b0 = (b0 + B) | 0
    c0 = (c0 + C) | 0
    d0 = (d0 + D) | 0
  }

  // 输出是小端：每个 32 位字按字节倒序输出。
  const hex = (n: number): string => {
    let s = ''
    for (let i = 0; i < 4; i += 1) s += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
    return s
  }
  return hex(a0) + hex(b0) + hex(c0) + hex(d0)
}
