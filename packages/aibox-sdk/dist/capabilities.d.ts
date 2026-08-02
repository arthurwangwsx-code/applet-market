/**
 * 能力探测与降级。
 *
 * 纪律（docs/api/README 与 framework-capabilities §「能力缺席时整条命名空间不注册」）：
 * **先探测再渲染入口**。一个点下去报 `aibox/method-not-found` 的按钮，比没有这个按钮更伤。
 * 这里把这条纪律变成 API：`isAvailable()` 同步、零成本，可以直接写在 render 里。
 */
/** 某条能力当前能不能用（同步）。`method` 省略时只判命名空间是否注册。 */
export declare function isAvailable(namespace: string, method?: string): boolean;
/** 一次判多条，全部可用才返回 true。 */
export declare function allAvailable(...namespaces: string[]): boolean;
/** 可用就跑，不可用返回 `fallback`——**不抛**。用于「有就用、没有就退化」的增强路径。 */
export declare function ifAvailable<T>(namespace: string, method: string, run: () => Promise<T>, fallback: T): Promise<T>;
/** 不可用直接抛 `aibox/unavailable`——用于「这条路必须通，通不了就该显式失败」。 */
export declare function requireAvailable(namespace: string, method?: string): void;
/** 宿主当前注册的全部命名空间（诊断页用）。 */
export declare function registeredNamespaces(): string[];
/** `aibox.access.explain` 的结果（宿主真值类型）。 */
export type AccessDecision = Awaited<ReturnType<typeof aibox.access.explain>>;
/**
 * 深探测：为什么调不动？走 `aibox.access.explain`，返回**具体是哪一道门**拦的以及补救建议。
 * 用于设置/诊断页面和「去授权」引导，不要放在热路径（一次桥往返）。
 */
export declare function explainAccess(target: {
    tool: string;
} | {
    capability: string;
    method?: string;
}): Promise<AccessDecision | null>;
/** 探测结果：能不能用 + 不能用的话是哪一道门。 */
export interface CapabilityProbe {
    namespace: string;
    /** 命名空间是否已注册（同步判据，决定「要不要渲染入口」）。 */
    registered: boolean;
    /** 授权门是否放行（异步判据，决定「要不要显示去授权引导」）。null = 宿主没给出判定。 */
    allowed: boolean | null;
    /** 被哪一道门拦下（宿主原文）。 */
    failedGate: string | null;
    /** 宿主给的补救建议（可直接展示给用户）。 */
    remedies: string[];
}
/** 一次拿到「注册 + 授权」两层结论。 */
export declare function probe(namespace: string, method?: string): Promise<CapabilityProbe>;
//# sourceMappingURL=capabilities.d.ts.map