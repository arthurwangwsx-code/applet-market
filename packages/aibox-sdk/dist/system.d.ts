/**
 * 系统能力的薄封装：分享 / 打开链接 / 剪贴板 / 朗读 / 凭据会话。
 *
 * ## 这一层收的三条分歧（都来自 8 份 `host.js` 的逐函数比对）
 *
 * 1. **打开链接要不要封顶。** news 的 `openURL` 有 12s 超时、music 的没有。
 *    没有封顶时若宿主侧迟迟不回，`await` 就永远挂着——页面上表现为「点了没反应，
 *    而且之后什么都点不动」。这里统一封顶，超时按「没打开」返回 false。
 * 2. **分享的返回形态。** ledger 回 `'file'|'text'|false`、finance 回 `boolean`、music 的
 *    `shareText` 回 `boolean`。三种形态让调用方各写各的判断。这里统一 `boolean`：
 *    真正需要区分渠道的场景一次都没出现过，而三种返回值是实打实的三份分支代码。
 * 3. **图片过 CSP。** 不在这里——`imageURL()` 在 `net.ts`，走 `applet://` 通道；
 *    music 那份 `fetchImageDataURL`（base64 data: URL）是**劣化实现**：整张图进内存再进 DOM，
 *    长列表里必然爆内存。迁移时一律换成 `imageURL`。
 */
/** 打开一个 http/https/mailto/tel 链接。带超时封顶；不可用、超时、被拒一律 false。 */
export declare function openURL(url: string, options?: {
    timeoutMs?: number;
}): Promise<boolean>;
/** 在宿主浏览器里打开（可选呈现形态）。不可用时自动退回 `openURL`。 */
export declare function openInBrowser(url: string, options?: {
    mode?: 'inApp' | 'system' | 'external';
    timeoutMs?: number;
}): Promise<boolean>;
/** 以阅读器形态打开一篇文章；宿主没有阅读器时退回普通打开。 */
export declare function openArticle(article: {
    url: string;
    title?: string;
    content?: string;
    excerpt?: string;
    siteName?: string;
    publishedAt?: string;
}, options?: {
    timeoutMs?: number;
}): Promise<boolean>;
/** 宿主浏览器能力探测：能不能内嵌打开、有没有阅读器。用于决定渲染哪个入口。 */
export declare function browserAvailability(): Promise<{
    modes: Array<'inApp' | 'system' | 'external'>;
    reader: boolean;
}>;
/** 分享一段文本（可带链接）。 */
export declare function shareText(text: string, url?: string): Promise<boolean>;
/** 导出一个**真实文件**到分享面板（CSV / JSON / OPML 导出走这条，不要用 shareText 塞正文）。 */
export declare function shareFile(input: {
    filename: string;
    content: string;
    encoding?: 'utf8' | 'base64';
    mimeType?: string;
}): Promise<boolean>;
/** 读剪贴板文本（不可用或被拒回空串——调用方判空即可，不必 try/catch）。 */
export declare function readClipboard(): Promise<string>;
/** 写剪贴板文本。 */
export declare function copyText(text: string): Promise<boolean>;
/** 朗读一段文本。`lang` 建议显式传——识别错语言的朗读听起来像乱码。 */
export declare function speak(text: string, options?: {
    lang?: string;
    rate?: number;
    pitch?: number;
}): Promise<boolean>;
/** 停止朗读。 */
export declare function stopSpeaking(): Promise<boolean>;
/** 该站点是否已有登录会话（凭据存在 Keychain，applet 读不到明文，只能问「有没有」）。 */
export declare function hasSession(host_?: string): Promise<boolean>;
/** 清除会话；返回清掉几条。 */
export declare function clearSession(host_?: string): Promise<number>;
/** Keychain 当前可写吗（模拟器未签名壳里可能不可写，此时别渲染「登录」入口）。 */
export declare function secretsWritable(): Promise<boolean>;
/** 系统能力是否在场（同步、零成本，用于「不可用就别渲染入口」）。 */
export declare const systemAvailable: {
    share: () => boolean;
    browser: () => boolean;
    clipboard: () => boolean;
    tts: () => boolean;
    secrets: () => boolean;
};
//# sourceMappingURL=system.d.ts.map