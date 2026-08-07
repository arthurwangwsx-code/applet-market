import { available, bridge, capabilityMap, isApplet } from './bridge'

/** 随宿主发布的 SDK 运行时版本。只做 additive 演进；破坏性变更必须升 major。 */
export const SDK_VERSION = '1.1.0' as const

/** 当前兼容合同的结构版本。结构只增字段，不复用旧字段表达新语义。 */
export const SDK_COMPATIBILITY_SCHEMA = 1 as const

/** 宿主在 documentStart 注入的只读运行时元数据。老宿主没有这份对象。 */
export interface ContainerRuntimeMetadata {
  schemaVersion: number
  containerVersion: string | null
  containerBuild: string | null
  bridgeProtocol: { current: string; supported: string[] }
  runtimeModules: string[]
}

declare global {
  interface Window {
    /** 宿主运行时元数据。不存在表示老宿主或普通 Web 预览，不要把两者误判成当前宿主。 */
    readonly __aiboxContainerRuntime?: Readonly<ContainerRuntimeMetadata>
  }
}

export type SDKDelivery = 'host-shared' | 'legacy-bundled' | 'web-preview'

/** 应用可同步读取的容器/SDK事实。读取不走桥 IPC，也不会触发授权。 */
export interface ContainerInfo {
  containerVersion: string | null
  containerBuild: string | null
  sdkVersion: typeof SDK_VERSION
  sdkCompatibilitySchema: typeof SDK_COMPATIBILITY_SCHEMA
  delivery: SDKDelivery
  bridgeProtocol: { current: string | null; supported: string[] }
  runtimeModules: string[]
}

function injectedMetadata(): Readonly<ContainerRuntimeMetadata> | undefined {
  try {
    return typeof window !== 'undefined' ? window.__aiboxContainerRuntime : undefined
  } catch {
    return undefined
  }
}

/**
 * 同步取得当前容器与 SDK 的真实版本。
 *
 * - `host-shared`：当前实现来自宿主的 `aibox-sdk.mjs`，全机只有一份。
 * - `legacy-bundled`：桥存在但宿主没有运行时元数据；通常是旧宿主里的应用内 SDK。
 * - `web-preview`：不在小应用容器里。
 *
 * 桥协议优先读 `aibox.protocol()`；元数据只是补充容器版本与运行时模块，避免把静态声明当运行时事实。
 */
export function containerInfo(): ContainerInfo {
  const metadata = injectedMetadata()
  let protocol: { current?: unknown; supported?: unknown } | undefined
  const host = bridge()
  try {
    protocol = host && typeof host.protocol === 'function' ? host.protocol() : undefined
  } catch {
    protocol = undefined
  }
  const current =
    typeof protocol?.current === 'string'
      ? protocol.current
      : typeof metadata?.bridgeProtocol?.current === 'string'
        ? metadata.bridgeProtocol.current
        : null
  const supported = Array.isArray(protocol?.supported)
    ? protocol.supported.filter((value): value is string => typeof value === 'string')
    : Array.isArray(metadata?.bridgeProtocol?.supported)
      ? [...metadata.bridgeProtocol.supported]
      : []
  const modules = Array.isArray(metadata?.runtimeModules)
    ? [...new Set(metadata.runtimeModules.filter((value) => typeof value === 'string'))].sort()
    : []
  const delivery: SDKDelivery =
    metadata && modules.includes('aibox/sdk') ? 'host-shared' : isApplet() ? 'legacy-bundled' : 'web-preview'
  return {
    containerVersion: typeof metadata?.containerVersion === 'string' ? metadata.containerVersion : null,
    containerBuild: typeof metadata?.containerBuild === 'string' ? metadata.containerBuild : null,
    sdkVersion: SDK_VERSION,
    sdkCompatibilitySchema: SDK_COMPATIBILITY_SCHEMA,
    delivery,
    bridgeProtocol: { current, supported },
    runtimeModules: modules,
  }
}

/**
 * 统一的 feature 判定。
 *
 * - `supports('sdk', '1.1.0')`
 * - `supports('container', '1.2.0')`
 * - `supports('bridge', '2.0')`
 * - `supports('runtime:aibox/ui')`
 * - `supports('capability:video.resolve')`（也可简写成 `supports('video.resolve')`）
 *
 * capability 优先读宿主 `aibox.capabilities()` 的运行时目录，再以同步方法探测兜底；不依据 SDK 类型猜。
 */
export function supports(feature: string, minimumVersion?: string): boolean {
  const name = String(feature || '').trim()
  if (!name) return false
  const info = containerInfo()
  switch (name) {
    case 'sdk':
      return minimumVersion ? versionAtLeast(info.sdkVersion, minimumVersion) : true
    case 'container':
      return (
        info.containerVersion !== null && (!minimumVersion || versionAtLeast(info.containerVersion, minimumVersion))
      )
    case 'bridge': {
      if (!minimumVersion) return info.bridgeProtocol.current !== null
      return info.bridgeProtocol.current === minimumVersion || info.bridgeProtocol.supported.includes(minimumVersion)
    }
    default:
      break
  }
  if (name.startsWith('runtime:')) {
    const moduleName = name.slice('runtime:'.length)
    if (!info.runtimeModules.includes(moduleName)) return false
    // 目前只有 SDK 自己有机器可读 semver；其它运行时模块只判在场，不伪造版本。
    return !minimumVersion || (moduleName === 'aibox/sdk' && versionAtLeast(info.sdkVersion, minimumVersion))
  }
  const target = name.startsWith('capability:') ? name.slice('capability:'.length) : name
  // 能力档位尚未进入桥协议；调用方传 version 时不能假装支持。
  if (minimumVersion) return false
  const dot = target.indexOf('.')
  const namespace = dot < 0 ? target : target.slice(0, dot)
  const method = dot < 0 ? undefined : target.slice(dot + 1)
  if (!namespace || (dot >= 0 && !method)) return false
  const runtime = capabilityMap()
  if (Object.prototype.hasOwnProperty.call(runtime, namespace)) {
    return method ? (runtime[namespace]?.includes(method) ?? false) : true
  }
  return available(namespace, method)
}

export interface CapabilityRequirement {
  namespace: string
  method?: string
  /** 可选能力缺失只进入 warnings，应用仍可启动并自行降级。 */
  optional?: boolean
}

export interface CompatibilityRequirement {
  minContainerVersion?: string
  minSDKVersion?: string
  bridgeProtocol?: string
  runtimeModules?: string[]
  capabilities?: Array<string | CapabilityRequirement>
}

export type CompatibilityIssueKind =
  | 'container-version'
  | 'sdk-version'
  | 'bridge-protocol'
  | 'runtime-module'
  | 'capability'

export interface CompatibilityIssue {
  kind: CompatibilityIssueKind
  target: string
  required?: string
  actual?: string | null
}

export interface CompatibilityReport {
  compatible: boolean
  degraded: boolean
  info: ContainerInfo
  errors: CompatibilityIssue[]
  warnings: CompatibilityIssue[]
}

/**
 * 一次评估启动硬需求与可选增强。应用可据 `compatible` 决定是否进入主流程，
 * 据 `warnings` 关闭次要入口。这个函数纯同步、零授权、零桥 IPC。
 */
export function checkCompatibility(requirement: CompatibilityRequirement = {}): CompatibilityReport {
  const info = containerInfo()
  const errors: CompatibilityIssue[] = []
  const warnings: CompatibilityIssue[] = []
  if (
    requirement.minContainerVersion &&
    (!info.containerVersion || !versionAtLeast(info.containerVersion, requirement.minContainerVersion))
  ) {
    errors.push({
      kind: 'container-version',
      target: 'container',
      required: requirement.minContainerVersion,
      actual: info.containerVersion,
    })
  }
  if (requirement.minSDKVersion && !versionAtLeast(info.sdkVersion, requirement.minSDKVersion)) {
    errors.push({ kind: 'sdk-version', target: 'sdk', required: requirement.minSDKVersion, actual: info.sdkVersion })
  }
  if (requirement.bridgeProtocol && !supports('bridge', requirement.bridgeProtocol)) {
    errors.push({
      kind: 'bridge-protocol',
      target: 'bridge',
      required: requirement.bridgeProtocol,
      actual: info.bridgeProtocol.current,
    })
  }
  for (const moduleName of requirement.runtimeModules ?? []) {
    if (!supports(`runtime:${moduleName}`)) {
      errors.push({ kind: 'runtime-module', target: moduleName, actual: null })
    }
  }
  for (const raw of requirement.capabilities ?? []) {
    const item: CapabilityRequirement = typeof raw === 'string' ? capabilityRequirement(raw) : raw
    const target = item.method ? `${item.namespace}.${item.method}` : item.namespace
    if (!supports(`capability:${target}`)) {
      ;(item.optional ? warnings : errors).push({ kind: 'capability', target, actual: null })
    }
  }
  return { compatible: errors.length === 0, degraded: warnings.length > 0, info, errors, warnings }
}

function capabilityRequirement(value: string): CapabilityRequirement {
  const target = String(value || '')
    .trim()
    .replace(/^capability:/, '')
  const dot = target.indexOf('.')
  return dot < 0 ? { namespace: target } : { namespace: target.slice(0, dot), method: target.slice(dot + 1) }
}

/** 宽松读取宿主版本（`1`/`1.2`/`1.2.3`），要求版本必须同样是数字段；无效值一律不满足。 */
function versionAtLeast(actual: string, required: string): boolean {
  const lhs = versionTuple(actual)
  const rhs = versionTuple(required)
  if (!lhs || !rhs) return false
  for (let index = 0; index < 3; index += 1) {
    const a = lhs[index] ?? 0
    const b = rhs[index] ?? 0
    if (a !== b) return a > b
  }
  return true
}

function versionTuple(value: string): [number, number, number] | null {
  const match = /^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?\s*$/.exec(String(value))
  if (!match) return null
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)]
}
