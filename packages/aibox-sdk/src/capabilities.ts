import { available, bridge, capabilityMap } from './bridge'
import { AiboxError, normalizeError } from './errors'

/**
 * 能力探测与降级。
 *
 * 纪律（docs/api/README 与 framework-capabilities §「能力缺席时整条命名空间不注册」）：
 * **先探测再渲染入口**。一个点下去报 `aibox/method-not-found` 的按钮，比没有这个按钮更伤。
 * 这里把这条纪律变成 API：`isAvailable()` 同步、零成本，可以直接写在 render 里。
 */

/** 某条能力当前能不能用（同步）。`method` 省略时只判命名空间是否注册。 */
export function isAvailable(namespace: string, method?: string): boolean {
  return available(namespace, method)
}

/** 一次判多条，全部可用才返回 true。 */
export function allAvailable(...namespaces: string[]): boolean {
  return namespaces.every((name) => available(name))
}

/** 可用就跑，不可用返回 `fallback`——**不抛**。用于「有就用、没有就退化」的增强路径。 */
export async function ifAvailable<T>(
  namespace: string,
  method: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  if (!available(namespace, method)) return fallback
  try {
    return await run()
  } catch {
    return fallback
  }
}

/** 不可用直接抛 `aibox/unavailable`——用于「这条路必须通，通不了就该显式失败」。 */
export function requireAvailable(namespace: string, method?: string): void {
  if (available(namespace, method)) return
  const target = method ? `aibox.${namespace}.${method}` : `aibox.${namespace}`
  throw new AiboxError(
    'aibox/unavailable',
    `aibox/unavailable: ${target} is not registered in this host. ` +
      'Declare it in manifest.permissions.capabilities, and gate the entry point on isAvailable().',
  )
}

/** 宿主当前注册的全部命名空间（诊断页用）。 */
export function registeredNamespaces(): string[] {
  return Object.keys(capabilityMap()).sort()
}

/** `aibox.access.explain` 的结果（宿主真值类型）。 */
export type AccessDecision = Awaited<ReturnType<typeof aibox.access.explain>>

/**
 * 深探测：为什么调不动？走 `aibox.access.explain`，返回**具体是哪一道门**拦的以及补救建议。
 * 用于设置/诊断页面和「去授权」引导，不要放在热路径（一次桥往返）。
 */
export async function explainAccess(
  target: { tool: string } | { capability: string; method?: string },
): Promise<AccessDecision | null> {
  const host = bridge()
  if (!host?.access || typeof host.access.explain !== 'function') return null
  try {
    return await host.access.explain(target)
  } catch (error) {
    throw normalizeError(error)
  }
}

/** 探测结果：能不能用 + 不能用的话是哪一道门。 */
export interface CapabilityProbe {
  namespace: string
  /** 命名空间是否已注册（同步判据，决定「要不要渲染入口」）。 */
  registered: boolean
  /** 授权门是否放行（异步判据，决定「要不要显示去授权引导」）。null = 宿主没给出判定。 */
  allowed: boolean | null
  /** 被哪一道门拦下（宿主原文）。 */
  failedGate: string | null
  /** 宿主给的补救建议（可直接展示给用户）。 */
  remedies: string[]
}

/** 一次拿到「注册 + 授权」两层结论。 */
export async function probe(namespace: string, method?: string): Promise<CapabilityProbe> {
  const registered = available(namespace, method)
  const base: CapabilityProbe = { namespace, registered, allowed: null, failedGate: null, remedies: [] }
  if (!registered) return base
  const decision = await explainAccess(method ? { capability: namespace, method } : { capability: namespace }).catch(
    () => null,
  )
  if (!decision) return { ...base, allowed: null }
  return {
    namespace,
    registered,
    allowed: Boolean(decision.allowed),
    failedGate: decision.failedGate ?? null,
    remedies: Array.isArray(decision.remedies) ? decision.remedies : [],
  }
}
