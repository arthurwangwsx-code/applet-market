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
export { AiboxError, isAiboxError, hasCode, isPermissionDenied, isTransient, normalizeError, attempt, withFallback, } from './errors';
export { isAvailable, allAvailable, ifAvailable, requireAvailable, registeredNamespaces, explainAccess, probe, } from './capabilities';
export { resolveVideo, pickBestFormat, stageAspect, playVideo } from './video';
export { fetchText, fetchJSON, fetchBytes, fetchWithMeta, base64ToBytes, imageURL, } from './net';
export * as storage from './storage';
export { queryAll, removeMany, databaseAvailable } from './db';
export { registerAction, registerActions, actionResult } from './actions';
export { tabsAreRendered, searchIsRendered, tabsState, selectTab, setTabBadge, sceneState, setTitle, setCloseConfirmation, haptic, } from './shell';
export { defineManifest } from './manifest';
// --- 桥胶水并集（2026-08-04 收编）------------------------------------------------
// 这四组曾经散在 8 份应用私有的 `host.js` 里，各写各的、语义还不一致
// （confirm 不可用回 null 还是 false、openURL 要不要封顶、图片走 applet:// 还是 data:）。
// 收进来的是**并集且补全**，不是可配置框架——差异部分原本就只是「各自只实现了当时用到的子集」。
export * as events from './events';
export * as ui from './ui';
export * as system from './system';
export * as intelligence from './intelligence';
