import { bridge } from './bridge';
import { AiboxError, normalizeError } from './errors';
function requireNet() {
    const host = bridge();
    if (!host?.net || typeof host.net.fetch !== 'function') {
        throw new AiboxError('aibox/unavailable', 'aibox/unavailable: aibox.net.fetch is not registered. Set "network": true and list hosts in ' +
            'manifest.permissions.networkAllowed — page-level fetch() is blocked by CSP and will never work.');
    }
    return host.net;
}
function assertResponse(url, meta, options) {
    if (!options.allowErrorStatus && (meta.status < 200 || meta.status >= 300)) {
        throw new AiboxError('aibox/upstream-failed', `aibox/upstream-failed: ${meta.status} from ${url}`, { data: meta });
    }
    if (!options.allowTruncated && meta.truncated) {
        throw new AiboxError('aibox/truncated', `aibox/truncated: ${url} returned ${meta.bytes} bytes and was cut off. ` +
            'Raise maxBytes, or pass allowTruncated: true if a partial body is genuinely acceptable.', { data: meta });
    }
}
/** base64 -> 字节。宿主 `responseType:'base64'` 的标准解法。 */
export function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i);
    return bytes;
}
async function rawFetch(url, responseType, options) {
    const net = requireNet();
    try {
        const response = await net.fetch(url, {
            method: options.method,
            headers: options.headers,
            body: options.body,
            responseType,
            maxBytes: options.maxBytes,
        });
        const meta = {
            status: response.status,
            headers: response.headers ?? {},
            contentType: response.contentType ?? null,
            truncated: Boolean(response.truncated),
            bytes: response.bytes ?? 0,
        };
        return { body: response.body, meta };
    }
    catch (error) {
        throw normalizeError(error);
    }
}
/** 取文本。非 UTF-8 站点传 `encoding`，SDK 自动走 base64 + `TextDecoder`。 */
export async function fetchText(url, options = {}) {
    const encoding = (options.encoding ?? 'utf8').toLowerCase();
    const isUTF8 = encoding === 'utf8' || encoding === 'utf-8';
    const { body, meta } = await rawFetch(url, isUTF8 ? 'text' : 'base64', options);
    assertResponse(url, meta, options);
    if (isUTF8)
        return typeof body === 'string' ? body : String(body ?? '');
    const bytes = base64ToBytes(typeof body === 'string' ? body : '');
    try {
        return new TextDecoder(options.encoding).decode(bytes);
    }
    catch (error) {
        throw new AiboxError('aibox/parse-failed', `aibox/parse-failed: unsupported encoding "${options.encoding}"`, {
            cause: error,
        });
    }
}
/** 取 JSON。宿主侧解析（`responseType:'json'`），解析失败按 `aibox/parse-failed` 抛。 */
export async function fetchJSON(url, options = {}) {
    const { body, meta } = await rawFetch(url, 'json', options);
    assertResponse(url, meta, options);
    return body;
}
/** 取原始字节（图片、二进制协议）。 */
export async function fetchBytes(url, options = {}) {
    const { body, meta } = await rawFetch(url, 'base64', options);
    assertResponse(url, meta, options);
    return base64ToBytes(typeof body === 'string' ? body : '');
}
/** 需要响应头/状态码时用这个（不做任何断言，元信息完整返回）。 */
export async function fetchWithMeta(url, responseType, options = {}) {
    const { body, meta } = await rawFetch(url, responseType, options);
    return { body, ...meta };
}
/**
 * 远端图片 -> 同源 `applet://localhost/image/...`（走宿主两级缓存 + 尺寸下采样）。
 * 直接写 `<img src={remoteURL}>` 在 secure 模式会被 CSP 拦；这条路是唯一正解。
 * 与 `aibox/ui` 的 `imageURL` 同一实现，SDK 内联一份是为了不强制依赖运行时模块。
 */
export function imageURL(remoteURL, options = {}) {
    if (typeof remoteURL !== 'string' || remoteURL === '' || !/^https?:\/\//i.test(remoteURL))
        return remoteURL;
    let binary = '';
    const bytes = new TextEncoder().encode(remoteURL);
    for (let i = 0; i < bytes.length; i += 1)
        binary += String.fromCharCode(bytes[i]);
    const handle = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const width = Number(options.width);
    const query = Number.isFinite(width) && width > 0 ? `?w=${Math.round(width)}` : '';
    return `applet://localhost/image/${handle}${query}`;
}
