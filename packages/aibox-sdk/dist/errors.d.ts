/**
 * 桥错误的规范化。
 *
 * 宿主拒绝一次调用时抛的是普通 `Error`，但挂了三个字段（`AppletHostBridge.injectedSource`）：
 *   err.message  人读的说明，通常形如 "aibox/not-granted: ..."
 *   err.code     `aibox/*` 机器码（来自 JSON-RPC error.data.code）
 *   err.rpcCode  JSON-RPC 数字码
 *   err.data     结构化附加数据
 *
 * 问题在于 `code` 是 `any`：调用方要么不判、要么 `if (e.code === 'aibox/not-grante')` 拼错了
 * 也没人管。这里把它收成**判别式联合**——`AiboxErrorCode` 是字面量联合，`switch` 能穷尽，
 * 拼错就是编译错。
 */
/**
 * 宿主会回的 `aibox/*` 错误码。
 *
 * 取自宿主源码里实际出现的码（`grep -o "aibox/[a-z-]*"`）。新码出现时这里加一条即可；
 * `AiboxErrorCode` 额外并上 `(string & {})`，保证**未知码不会让调用方编译不过**——
 * 类型系统在这里的职责是「让你穷尽已知情况」，不是「让宿主升级一个码就编译红」。
 */
export type KnownAiboxErrorCode = 'aibox/ai-failed' | 'aibox/ai-unavailable' | 'aibox/busy' | 'aibox/cancelled' | 'aibox/denied' | 'aibox/encode-failed' | 'aibox/host-policy-denied' | 'aibox/inactive' | 'aibox/internal-error' | 'aibox/invalid-args' | 'aibox/invalid-params' | 'aibox/invalid-request' | 'aibox/io-error' | 'aibox/io-failed' | 'aibox/method-not-found' | 'aibox/not-declared' | 'aibox/not-found' | 'aibox/not-granted' | 'aibox/not-visible' | 'aibox/parse-failed' | 'aibox/picker-failed' | 'aibox/quota-exceeded' | 'aibox/refused' | 'aibox/resource-failed' | 'aibox/schema-invalid' | 'aibox/structurally-denied' | 'aibox/timeout' | 'aibox/too-large' | 'aibox/too-long' | 'aibox/truncated' | 'aibox/unavailable' | 'aibox/upstream-failed';
export type AiboxErrorCode = KnownAiboxErrorCode | (string & {});
/** 规范化后的桥错误。原始异常保存在 `cause`，永不丢。 */
export declare class AiboxError extends Error {
    readonly code: AiboxErrorCode;
    readonly rpcCode?: number;
    readonly data?: unknown;
    constructor(code: AiboxErrorCode, message: string, options?: {
        rpcCode?: number;
        data?: unknown;
        cause?: unknown;
    });
}
export declare function isAiboxError(value: unknown): value is AiboxError;
/** 这条错误是不是某个（某组）码。`switch (e.code)` 之外的轻量判别。 */
export declare function hasCode(value: unknown, ...codes: AiboxErrorCode[]): boolean;
/** 授权类拒绝（可以引导用户去能力中心开）。 */
export declare function isPermissionDenied(value: unknown): boolean;
/** 暂时性拒绝（重试或稍后再来是合理的）。 */
export declare function isTransient(value: unknown): boolean;
/** 任意异常 -> `AiboxError`。已经是就原样返回。 */
export declare function normalizeError(value: unknown): AiboxError;
/** 成功/失败的显式结果（不想写 try/catch 的调用点用）。 */
export type AiboxResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: AiboxError;
};
/** 把一次桥调用收成 `AiboxResult`，异常一律规范化，**绝不吞掉**。 */
export declare function attempt<T>(run: () => Promise<T>): Promise<AiboxResult<T>>;
/** 失败时回落到一个默认值（探测类调用的常见形态）。失败原因经 `onError` 透出，不静默。 */
export declare function withFallback<T>(run: () => Promise<T>, fallback: T, onError?: (error: AiboxError) => void): Promise<T>;
//# sourceMappingURL=errors.d.ts.map