/// <reference path="./generated/aibox-global.d.ts" />

/**
 * `@aibox/applet-sdk` —— AiBox 小应用的前端 SDK。
 *
 * ## 它比裸 `window.aibox` 多了什么
 *  · **类型**：`aibox.*` 全部 39 个命名空间的 TS 类型，由 `scripts/gen-sdk-types.mjs`
 *    从宿主真值派生（不是手抄），带漂移检查。
 *  · **能力探测与降级**：`isAvailable()` / `probe()` / `useCapability()` ——
 *    把「不可用就别渲染入口」从口头约定变成一次函数调用。
 *  · **错误规范化**：`AiboxError` + 字面量联合 `AiboxErrorCode`，`switch` 能穷尽，拼错即编译错。
 *  · **`net` 便利封装**：`fetchText(url, { encoding: 'gb18030' })` 一行处理
 *    base64 → TextDecoder + `truncated` 检查 + 状态码断言。
 *  · **类型化 action**：manifest 声明的 action 与注册的 handler 在**编译期**对齐。
 *  · **React hooks**：`useTabs` / `useToolbarSearch` / `useKeyboardInset` / `useLocale` / `useScene`。
 *
 * ## 开发包与运行时分离
 * 本包为 npm 开发期入口，提供类型、测试与源码真值；`@aibox/applet-tsbuild` 会把产物说明符
 * 确定性改写到宿主内置的 `aibox/sdk` / `aibox/sdk/react`。因此 SDK 只随 AiBox 宿主交付一次，
 * 每个小应用包都不会再携带一份实现。`react` 仍只在 React 子入口出现，且是 peer dependency。
 */

export { bridge, isApplet, available, namespaceOf, capabilityMap } from './bridge'
export type { AiboxBridge, AiboxNamespace } from './bridge'

export {
  SDK_VERSION,
  SDK_COMPATIBILITY_SCHEMA,
  containerInfo,
  supports,
  checkCompatibility,
} from './runtime'
export type {
  SDKDelivery,
  ContainerRuntimeMetadata,
  ContainerInfo,
  CapabilityRequirement,
  CompatibilityRequirement,
  CompatibilityIssueKind,
  CompatibilityIssue,
  CompatibilityReport,
} from './runtime'

export type { JSONValue, JSONObject } from './json'

export {
  AiboxError,
  isAiboxError,
  hasCode,
  isPermissionDenied,
  isTransient,
  normalizeError,
  attempt,
  withFallback,
} from './errors'
export type { AiboxErrorCode, KnownAiboxErrorCode, AiboxResult } from './errors'

export {
  isAvailable,
  allAvailable,
  ifAvailable,
  requireAvailable,
  registeredNamespaces,
  explainAccess,
  probe,
} from './capabilities'
export type { AccessDecision, CapabilityProbe } from './capabilities'

export { resolveVideo, pickBestFormat, stageAspect, playVideo } from './video'
export type { ResolvedVideo, ResolvedFormat } from './video'

export {
  fetchText,
  fetchJSON,
  fetchBytes,
  fetchWithMeta,
  base64ToBytes,
  imageURL,
} from './net'
export type { NetMethod, NetMeta, NetRequestOptions, TextRequestOptions } from './net'

export * as storage from './storage'

export { queryAll, removeMany, databaseAvailable } from './db'
export type { QueryAllOptions } from './db'

export { registerAction, registerActions, actionResult } from './actions'
export type {
  AppletActionMap,
  ActionName,
  ActionInput,
  ActionOutput,
  ActionHandler,
  ActionHandlers,
} from './actions'

export {
  tabsAreRendered,
  searchIsRendered,
  tabsState,
  selectTab,
  setTabBadge,
  sceneState,
  setTitle,
  setCloseConfirmation,
  haptic,
} from './shell'
export type { TabsState, ToolbarState, ToolbarSearchState, SceneState, NavigationState } from './shell'

export { defineManifest } from './manifest'
export type { AppletManifestDeclaration, AppletActionDeclaration, AppletRuntimeKind } from './manifest'

// --- 桥胶水并集（2026-08-04 收编）------------------------------------------------
// 这四组曾经散在 8 份应用私有的 `host.js` 里，各写各的、语义还不一致
// （confirm 不可用回 null 还是 false、openURL 要不要封顶、图片走 applet:// 还是 data:）。
// 收进来的是**并集且补全**，不是可配置框架——差异部分原本就只是「各自只实现了当时用到的子集」。
export * as events from './events'
export * as ui from './ui'
export * as system from './system'
export * as intelligence from './intelligence'
export type { DialogAction } from './ui'
