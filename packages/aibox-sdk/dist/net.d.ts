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
export type NetMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
export interface NetRequestOptions {
    method?: NetMethod;
    /** 原样透传，包括浏览器 fetch 禁止的 Referer / User-Agent。 */
    headers?: Record<string, string>;
    body?: string;
    /** 响应上限字节。宿主默认 200000，最大 10485760。 */
    maxBytes?: number;
    /** 允许被截断的响应（默认 false = 截断即抛 `aibox/truncated`）。 */
    allowTruncated?: boolean;
    /** 允许非 2xx（默认 false = 非 2xx 抛 `aibox/upstream-failed`）。 */
    allowErrorStatus?: boolean;
}
export interface TextRequestOptions extends NetRequestOptions {
    /**
     * 响应字符集。`utf8`（默认）走宿主原生解码；其它一律取 base64 再由 `TextDecoder` 解。
     * 常见取值：`gb18030`（覆盖 GBK/GB2312）、`big5`、`shift_jis`、`euc-kr`、`iso-8859-1`。
     */
    encoding?: string;
}
/** 一次响应的元信息（`body` 之外的一切）。 */
export interface NetMeta {
    status: number;
    headers: Record<string, string>;
    contentType: string | null;
    truncated: boolean;
    bytes: number;
}
/** base64 -> 字节。宿主 `responseType:'base64'` 的标准解法。 */
export declare function base64ToBytes(base64: string): Uint8Array;
/** 取文本。非 UTF-8 站点传 `encoding`，SDK 自动走 base64 + `TextDecoder`。 */
export declare function fetchText(url: string, options?: TextRequestOptions): Promise<string>;
/** 取 JSON。宿主侧解析（`responseType:'json'`），解析失败按 `aibox/parse-failed` 抛。 */
export declare function fetchJSON<T = unknown>(url: string, options?: NetRequestOptions): Promise<T>;
/** 取原始字节（图片、二进制协议）。 */
export declare function fetchBytes(url: string, options?: NetRequestOptions): Promise<Uint8Array>;
/** 需要响应头/状态码时用这个（不做任何断言，元信息完整返回）。 */
export declare function fetchWithMeta(url: string, responseType: 'text' | 'base64' | 'json', options?: NetRequestOptions): Promise<{
    body: unknown;
} & NetMeta>;
/**
 * 远端图片 -> 同源 `applet://localhost/image/...`（走宿主两级缓存 + 尺寸下采样）。
 * 直接写 `<img src={remoteURL}>` 在 secure 模式会被 CSP 拦；这条路是唯一正解。
 * 与 `aibox/ui` 的 `imageURL` 同一实现，SDK 内联一份是为了不强制依赖运行时模块。
 */
export declare function imageURL(remoteURL: string, options?: {
    width?: number;
}): string;
//# sourceMappingURL=net.d.ts.map