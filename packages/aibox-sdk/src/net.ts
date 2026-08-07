import { bridge } from './bridge'
import { AiboxError, normalizeError } from './errors'

/**
 * `aibox.net.fetch` 的便利封装。
 *
 * 裸桥 API 有三处**每个应用都要重写一遍**的样板，这里一次做对：
 *  ① **非 UTF-8 站点**：`responseType:'text'` 对 GB18030 / Big5 / Shift_JIS 直接返回空串。正解是
 *    取 base64 再用 `TextDecoder` 解——`fetchText(url, { encoding: 'gb18030' })` 就是这段。
 *  ② **`truncated`**：body 被 `maxBytes` 截断时宿主只置一个布尔位。把截断的 XML/JSON 当完整数据解析
 *    会得到「解析成功但内容少一半」，比报错更难查。默认**截断即抛**。
 *  ③ 状态码：桥不会因为 404/500 抛，`res.status` 要自己判。默认非 2xx 即抛。
 *
 * 三条默认都可以关（`allowTruncated` / `allowErrorStatus`），但必须是**显式**关掉。
 */

export type NetMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

export interface NetRequestOptions {
  method?: NetMethod
  /** 原样透传，包括浏览器 fetch 禁止的 Referer / User-Agent。 */
  headers?: Record<string, string>
  body?: string
  /** 响应上限字节。宿主默认 200000，最大 10485760。 */
  maxBytes?: number
  /** 允许被截断的响应（默认 false = 截断即抛 `aibox/truncated`）。 */
  allowTruncated?: boolean
  /** 允许非 2xx（默认 false = 非 2xx 抛 `aibox/upstream-failed`）。 */
  allowErrorStatus?: boolean
}

export interface TextRequestOptions extends NetRequestOptions {
  /**
   * 响应字符集。`utf8`（默认）走宿主原生解码；其它一律取 base64 再由 `TextDecoder` 解。
   * 常见取值：`gb18030`（覆盖 GBK/GB2312）、`big5`、`shift_jis`、`euc-kr`、`iso-8859-1`。
   */
  encoding?: string
}

/** 一次响应的元信息（`body` 之外的一切）。 */
export interface NetMeta {
  status: number
  headers: Record<string, string>
  contentType: string | null
  truncated: boolean
  bytes: number
}

function requireNet(): NonNullable<ReturnType<typeof bridge>>['net'] {
  const host = bridge()
  if (!host?.net || typeof host.net.fetch !== 'function') {
    throw new AiboxError(
      'aibox/unavailable',
      'aibox/unavailable: aibox.net.fetch is not registered. Set "network": true and list hosts in ' +
        'manifest.permissions.networkAllowed — page-level fetch() is blocked by CSP and will never work.',
    )
  }
  return host.net
}

function assertResponse(url: string, meta: NetMeta, options: NetRequestOptions): void {
  if (!options.allowErrorStatus && (meta.status < 200 || meta.status >= 300)) {
    throw new AiboxError('aibox/upstream-failed', `aibox/upstream-failed: ${meta.status} from ${url}`, { data: meta })
  }
  if (!options.allowTruncated && meta.truncated) {
    throw new AiboxError(
      'aibox/truncated',
      `aibox/truncated: ${url} returned ${meta.bytes} bytes and was cut off. ` +
        'Raise maxBytes, or pass allowTruncated: true if a partial body is genuinely acceptable.',
      { data: meta },
    )
  }
}

/** base64 -> 字节。宿主 `responseType:'base64'` 的标准解法。 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function rawFetch(
  url: string,
  responseType: 'text' | 'base64' | 'json',
  options: NetRequestOptions,
): Promise<{ body: unknown; meta: NetMeta }> {
  const net = requireNet()
  try {
    const response = await net.fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      responseType,
      maxBytes: options.maxBytes,
    })
    const meta: NetMeta = {
      status: response.status,
      headers: response.headers ?? {},
      contentType: response.contentType ?? null,
      truncated: Boolean(response.truncated),
      bytes: response.bytes ?? 0,
    }
    return { body: response.body, meta }
  } catch (error) {
    throw normalizeError(error)
  }
}

/** 取文本。非 UTF-8 站点传 `encoding`，SDK 自动走 base64 + `TextDecoder`。 */
export async function fetchText(url: string, options: TextRequestOptions = {}): Promise<string> {
  const encoding = (options.encoding ?? 'utf8').toLowerCase()
  const isUTF8 = encoding === 'utf8' || encoding === 'utf-8'
  const { body, meta } = await rawFetch(url, isUTF8 ? 'text' : 'base64', options)
  assertResponse(url, meta, options)
  if (isUTF8) return typeof body === 'string' ? body : String(body ?? '')
  const bytes = base64ToBytes(typeof body === 'string' ? body : '')
  try {
    return new TextDecoder(options.encoding).decode(bytes)
  } catch (error) {
    throw new AiboxError('aibox/parse-failed', `aibox/parse-failed: unsupported encoding "${options.encoding}"`, {
      cause: error,
    })
  }
}

/** 取 JSON。宿主侧解析（`responseType:'json'`），解析失败按 `aibox/parse-failed` 抛。 */
export async function fetchJSON<T = unknown>(url: string, options: NetRequestOptions = {}): Promise<T> {
  const { body, meta } = await rawFetch(url, 'json', options)
  assertResponse(url, meta, options)
  return body as T
}

/** 取原始字节（图片、二进制协议）。 */
export async function fetchBytes(url: string, options: NetRequestOptions = {}): Promise<Uint8Array> {
  const { body, meta } = await rawFetch(url, 'base64', options)
  assertResponse(url, meta, options)
  return base64ToBytes(typeof body === 'string' ? body : '')
}

/** 需要响应头/状态码时用这个（不做任何断言，元信息完整返回）。 */
export async function fetchWithMeta(
  url: string,
  responseType: 'text' | 'base64' | 'json',
  options: NetRequestOptions = {},
): Promise<{ body: unknown } & NetMeta> {
  const { body, meta } = await rawFetch(url, responseType, options)
  return { body, ...meta }
}

/**
 * 远端图片 -> 同源 `applet://localhost/image/...`（走宿主两级缓存 + 尺寸下采样）。
 * 直接写 `<img src={remoteURL}>` 在 secure 模式会被 CSP 拦；这条路是唯一正解。
 * 与 `aibox/ui` 的 `imageURL` 同一实现，SDK 内联一份是为了不强制依赖运行时模块。
 */
export function imageURL(remoteURL: string, options: { width?: number } = {}): string {
  if (typeof remoteURL !== 'string' || remoteURL === '' || !/^https?:\/\//i.test(remoteURL)) return remoteURL
  let binary = ''
  const bytes = new TextEncoder().encode(remoteURL)
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  const handle = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const width = Number(options.width)
  const query = Number.isFinite(width) && width > 0 ? `?w=${Math.round(width)}` : ''
  return `applet://localhost/image/${handle}${query}`
}
