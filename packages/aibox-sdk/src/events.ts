import { bridge } from './bridge';

/**
 * 桥事件订阅。
 *
 * ## 为什么这层值得存在
 * 8 份 `host.js` 分叉里有 6 份各写了一遍 `onEvent` / `onNamespaceEvent`，形态还不一样：
 * 有的返回退订函数、有的返回 `void`（于是调用方根本退订不了，applet 反复挂载就泄漏一堆监听器）。
 * 裸 `aibox.events.on` 本身是对的，问题出在**每个应用都要自己记得**：
 *  · 命名空间事件的前缀约定（`download.progress` / `video.progress` / `menu.changed`）；
 *  · 卸载时退订——React 里忘了 return 清理函数是最常见的一种。
 *
 * 这里只做三件事：统一返回退订函数、提供命名空间批量订阅、以及 `aibox.events` 缺席时安全退化成 no-op
 * （无头执行、被当普通网页打开时都会走到）。
 */

/** 订阅一个事件。返回退订函数——**永远返回**，即使桥不在场（此时是 no-op）。 */
export function on<T = unknown>(name: string, handler: (payload: T) => void): () => void {
  const host = bridge();
  if (!host?.events?.on) return () => {};
  try {
    const off = host.events.on<T>(name, handler);
    // 宿主返回的就是退订函数；老桥若返回 undefined，退回手动 off。
    return typeof off === 'function' ? off : () => host.events?.off?.<T>(name, handler);
  } catch {
    return () => {};
  }
}

/**
 * 订阅某个命名空间下的一组事件（`namespaceOn('download', ['progress'], fn)` 等价于
 * 订阅 `download.progress`）。返回一次性退订全部的函数。
 *
 * 用它而不是拼字符串：事件名前缀写错不会报错，只会**永远收不到事件**——那是最难查的一类静默失败。
 */
export function namespaceOn<T = unknown>(
  namespace: string,
  events: string[],
  handler: (event: string, payload: T) => void,
): () => void {
  const offs = events.map((event) =>
    on<T>(`${namespace}.${event}`, (payload) => handler(event, payload)),
  );
  return () => offs.forEach((off) => off());
}

/**
 * 订阅**外壳命名空间自己的**事件（`tabs.on('changed')` / `toolbar.on('invoke')` / `lifecycle.on(…)`）。
 *
 * ⚠️ 与 `on()` 是两套机制，别混：
 *  · `on('download.progress')` 走 `aibox.events`，是宿主**推送**的全局事件总线（要先 `subscribe()`）；
 *  · 本函数走 `aibox.<ns>.on(event)`，是外壳命名空间自带的回调注册。
 * 混用的后果是**永远收不到事件而且不报错**——`aibox.download.on` 根本不存在，
 * 写成那样只会拿到一个空的退订函数，页面上表现为「进度永远不动」。
 */
export function shellOn(
  namespace: string,
  event: string,
  handler: (payload: unknown) => void,
): () => void {
  const host = bridge() as Record<string, { on?: (e: string, h: (p: unknown) => void) => unknown }> | undefined;
  const ns = host?.[namespace];
  if (!ns || typeof ns.on !== 'function') return () => {};
  try {
    const off = ns.on(event, handler);
    return typeof off === 'function' ? (off as () => void) : () => {};
  } catch {
    return () => {};
  }
}

/** 一次性订阅：首次触发后自动退订。 */
export function once<T = unknown>(name: string, handler: (payload: T) => void): () => void {
  let off = () => {};
  off = on<T>(name, (payload) => {
    off();
    handler(payload);
  });
  return off;
}
