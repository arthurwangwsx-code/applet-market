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
export type KnownAiboxErrorCode =
  | 'aibox/ai-failed'
  | 'aibox/ai-unavailable'
  | 'aibox/busy'
  | 'aibox/cancelled'
  | 'aibox/denied'
  | 'aibox/encode-failed'
  | 'aibox/host-policy-denied'
  | 'aibox/inactive'
  | 'aibox/internal-error'
  | 'aibox/invalid-args'
  | 'aibox/invalid-params'
  | 'aibox/invalid-request'
  | 'aibox/io-error'
  | 'aibox/io-failed'
  | 'aibox/method-not-found'
  | 'aibox/not-declared'
  | 'aibox/not-found'
  | 'aibox/not-granted'
  | 'aibox/not-visible'
  | 'aibox/parse-failed'
  | 'aibox/picker-failed'
  | 'aibox/quota-exceeded'
  | 'aibox/refused'
  | 'aibox/resource-failed'
  | 'aibox/schema-invalid'
  | 'aibox/structurally-denied'
  | 'aibox/timeout'
  | 'aibox/too-large'
  | 'aibox/too-long'
  | 'aibox/truncated'
  | 'aibox/unavailable'
  | 'aibox/upstream-failed';

// `(string & {})` 保留字面量自动补全的同时接纳未知码。
// eslint-disable-next-line @typescript-eslint/ban-types
export type AiboxErrorCode = KnownAiboxErrorCode | (string & {});

/** 规范化后的桥错误。原始异常保存在 `cause`，永不丢。 */
export class AiboxError extends Error {
  readonly code: AiboxErrorCode;
  readonly rpcCode?: number;
  readonly data?: unknown;

  constructor(code: AiboxErrorCode, message: string, options?: { rpcCode?: number; data?: unknown; cause?: unknown }) {
    super(message);
    this.name = 'AiboxError';
    this.code = code;
    this.rpcCode = options?.rpcCode;
    this.data = options?.data;
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

export function isAiboxError(value: unknown): value is AiboxError {
  return value instanceof AiboxError;
}

/** 这条错误是不是某个（某组）码。`switch (e.code)` 之外的轻量判别。 */
export function hasCode(value: unknown, ...codes: AiboxErrorCode[]): boolean {
  return isAiboxError(value) && codes.includes(value.code);
}

/** 授权类拒绝（可以引导用户去能力中心开）。 */
export function isPermissionDenied(value: unknown): boolean {
  return hasCode(value, 'aibox/not-granted', 'aibox/denied', 'aibox/not-declared',
    'aibox/structurally-denied', 'aibox/host-policy-denied', 'aibox/refused');
}

/** 暂时性拒绝（重试或稍后再来是合理的）。 */
export function isTransient(value: unknown): boolean {
  return hasCode(value, 'aibox/busy', 'aibox/timeout', 'aibox/inactive', 'aibox/not-visible',
    'aibox/upstream-failed');
}

const CODE_IN_MESSAGE = /\b(aibox\/[a-z][a-z0-9-]*)/;

/** 任意异常 -> `AiboxError`。已经是就原样返回。 */
export function normalizeError(value: unknown): AiboxError {
  if (isAiboxError(value)) return value;
  const raw = value as { message?: unknown; code?: unknown; rpcCode?: unknown; data?: unknown } | null;
  const message = typeof raw?.message === 'string' && raw.message ? raw.message : String(value);
  const explicit = typeof raw?.code === 'string' && raw.code.startsWith('aibox/') ? raw.code : undefined;
  const parsed = explicit ?? CODE_IN_MESSAGE.exec(message)?.[1] ?? 'aibox/internal-error';
  return new AiboxError(parsed, message, {
    rpcCode: typeof raw?.rpcCode === 'number' ? raw.rpcCode : undefined,
    data: raw?.data,
    cause: value,
  });
}

/** 成功/失败的显式结果（不想写 try/catch 的调用点用）。 */
export type AiboxResult<T> = { ok: true; value: T } | { ok: false; error: AiboxError };

/** 把一次桥调用收成 `AiboxResult`，异常一律规范化，**绝不吞掉**。 */
export async function attempt<T>(run: () => Promise<T>): Promise<AiboxResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error: normalizeError(error) };
  }
}

/** 失败时回落到一个默认值（探测类调用的常见形态）。失败原因经 `onError` 透出，不静默。 */
export async function withFallback<T>(
  run: () => Promise<T>,
  fallback: T,
  onError?: (error: AiboxError) => void,
): Promise<T> {
  const result = await attempt(run);
  if (result.ok) return result.value;
  onError?.(result.error);
  return fallback;
}
