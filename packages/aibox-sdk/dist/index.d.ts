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
 * ## 零运行时依赖
 * 本包不 import 任何第三方模块（`react` 只在 `@aibox/applet-sdk/react` 子入口出现，且是 peer）。
 * 构建时会被打进应用产物并 tree-shake，不额外占宿主体积。
 */
export { bridge, isApplet, available, namespaceOf, capabilityMap } from './bridge';
export type { AiboxBridge, AiboxNamespace } from './bridge';
export type { JSONValue, JSONObject } from './json';
export { AiboxError, isAiboxError, hasCode, isPermissionDenied, isTransient, normalizeError, attempt, withFallback, } from './errors';
export type { AiboxErrorCode, KnownAiboxErrorCode, AiboxResult } from './errors';
export { isAvailable, allAvailable, ifAvailable, requireAvailable, registeredNamespaces, explainAccess, probe, } from './capabilities';
export type { AccessDecision, CapabilityProbe } from './capabilities';
export { resolveVideo, pickBestFormat, stageAspect, playVideo } from './video';
export type { ResolvedVideo, ResolvedFormat } from './video';
export { fetchText, fetchJSON, fetchBytes, fetchWithMeta, base64ToBytes, imageURL, } from './net';
export type { NetMethod, NetMeta, NetRequestOptions, TextRequestOptions } from './net';
export * as storage from './storage';
export { queryAll, removeMany, databaseAvailable } from './db';
export type { QueryAllOptions } from './db';
export { registerAction, registerActions, actionResult } from './actions';
export type { AppletActionMap, ActionName, ActionInput, ActionOutput, ActionHandler, ActionHandlers, } from './actions';
export { tabsAreRendered, searchIsRendered, tabsState, selectTab, setTabBadge, sceneState, setTitle, setCloseConfirmation, haptic, } from './shell';
export type { TabsState, ToolbarState, ToolbarSearchState, SceneState, NavigationState } from './shell';
export { defineManifest } from './manifest';
export type { AppletManifestDeclaration, AppletActionDeclaration, AppletRuntimeKind } from './manifest';
export * as events from './events';
export * as ui from './ui';
export * as system from './system';
export * as intelligence from './intelligence';
export type { DialogAction } from './ui';
//# sourceMappingURL=index.d.ts.map