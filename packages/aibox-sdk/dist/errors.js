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
/** 规范化后的桥错误。原始异常保存在 `cause`，永不丢。 */
export class AiboxError extends Error {
    code;
    rpcCode;
    data;
    constructor(code, message, options) {
        super(message);
        this.name = 'AiboxError';
        this.code = code;
        this.rpcCode = options?.rpcCode;
        this.data = options?.data;
        if (options?.cause !== undefined)
            this.cause = options.cause;
    }
}
export function isAiboxError(value) {
    return value instanceof AiboxError;
}
/** 这条错误是不是某个（某组）码。`switch (e.code)` 之外的轻量判别。 */
export function hasCode(value, ...codes) {
    return isAiboxError(value) && codes.includes(value.code);
}
/** 授权类拒绝（可以引导用户去能力中心开）。 */
export function isPermissionDenied(value) {
    return hasCode(value, 'aibox/not-granted', 'aibox/denied', 'aibox/not-declared', 'aibox/structurally-denied', 'aibox/host-policy-denied', 'aibox/refused');
}
/** 暂时性拒绝（重试或稍后再来是合理的）。 */
export function isTransient(value) {
    return hasCode(value, 'aibox/busy', 'aibox/timeout', 'aibox/inactive', 'aibox/not-visible', 'aibox/upstream-failed');
}
const CODE_IN_MESSAGE = /\b(aibox\/[a-z][a-z0-9-]*)/;
/** 任意异常 -> `AiboxError`。已经是就原样返回。 */
export function normalizeError(value) {
    if (isAiboxError(value))
        return value;
    const raw = value;
    const message = typeof raw?.message === 'string' && raw.message ? raw.message : String(value);
    const explicit = typeof raw?.code === 'string' && raw.code.startsWith('aibox/') ? raw.code : undefined;
    const parsed = explicit ?? CODE_IN_MESSAGE.exec(message)?.[1] ?? 'aibox/internal-error';
    return new AiboxError(parsed, message, {
        rpcCode: typeof raw?.rpcCode === 'number' ? raw.rpcCode : undefined,
        data: raw?.data,
        cause: value,
    });
}
/** 把一次桥调用收成 `AiboxResult`，异常一律规范化，**绝不吞掉**。 */
export async function attempt(run) {
    try {
        return { ok: true, value: await run() };
    }
    catch (error) {
        return { ok: false, error: normalizeError(error) };
    }
}
/** 失败时回落到一个默认值（探测类调用的常见形态）。失败原因经 `onError` 透出，不静默。 */
export async function withFallback(run, fallback, onError) {
    const result = await attempt(run);
    if (result.ok)
        return result.value;
    onError?.(result.error);
    return fallback;
}
