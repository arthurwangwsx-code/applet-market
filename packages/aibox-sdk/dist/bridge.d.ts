/**
 * 桥对象取用与命名空间探测。
 *
 * `window.aibox` 由宿主在 documentStart 注入（`AppletHostBridge.injectedSource`）。它有两个
 * 关键性质，SDK 的所有「能力探测」都建立在这两条上：
 *  ① **能力缺席时整条命名空间不注册**——`aibox.music` 在没装音乐模块的宿主上是 `undefined`，
 *    不是「存在但报错」。所以 `typeof aibox.music?.play === 'function'` 是可信的探测。
 *  ② 声明 ≠ 授权。命名空间在，不代表调得动：consent 仍可能在调用时拒（`aibox/not-granted`）。
 *
 * 因此 SDK 把纪律拆成两个动作：`isAvailable()`（渲染入口前问，同步、零成本）与
 * `probe()`（要不要展示「去授权」引导，异步、走 aibox.access.explain）。
 */
/** 桥的顶层类型（= 宿主虚拟 `.aibox/aibox.d.ts` 的 `declare namespace aibox`）。 */
export type AiboxBridge = typeof aibox;
/** `aibox.*` 下的命名空间名。 */
export type AiboxNamespace = AiboxDeclarableCapability | AiboxAlwaysAvailableNamespace | 'storage' | 'net' | 'ai' | 'events';
/**
 * 取桥对象。**不在 applet WebView 里时返回 `undefined`**（Node 单测、SSR、被当普通网页打开）。
 * 一切 SDK 调用都从这里出发，绝不直接摸 `window.aibox`——那会在测试环境里 ReferenceError。
 */
export declare function bridge(): AiboxBridge | undefined;
/** 当前是否运行在 applet 容器里。 */
export declare function isApplet(): boolean;
/** 取某个命名空间对象（不存在返回 `undefined`）。 */
export declare function namespaceOf<K extends keyof AiboxBridge>(name: K): AiboxBridge[K] | undefined;
/**
 * 命名空间（可选：某个方法）当前是否**已注册**。同步、零成本，用于「不可用就别渲染入口」。
 *
 * 这是本 SDK 存在的核心理由之一：把口头纪律变成一次函数调用。
 *   if (!available('music')) return null   // 不渲染音乐 Tab，而不是渲染一个点了报错的按钮
 */
export declare function available(name: string, method?: string): boolean;
/**
 * 宿主自报的能力表：命名空间 -> 方法名数组。比 `available()` 全面（能一次拿到全部方法），
 * 但要走一次桥调用形态的同步 API，故只在诊断/设置页用，热路径用 `available()`。
 */
export declare function capabilityMap(): Record<string, string[]>;
//# sourceMappingURL=bridge.d.ts.map