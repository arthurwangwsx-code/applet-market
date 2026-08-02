/// <reference path="./generated/aibox-global.d.ts" />
/**
 * 取桥对象。**不在 applet WebView 里时返回 `undefined`**（Node 单测、SSR、被当普通网页打开）。
 * 一切 SDK 调用都从这里出发，绝不直接摸 `window.aibox`——那会在测试环境里 ReferenceError。
 */
export function bridge() {
    try {
        return typeof window !== 'undefined' ? window.aibox : undefined;
    }
    catch {
        return undefined;
    }
}
/** 当前是否运行在 applet 容器里。 */
export function isApplet() {
    return bridge() !== undefined;
}
/** 取某个命名空间对象（不存在返回 `undefined`）。 */
export function namespaceOf(name) {
    const host = bridge();
    const value = host?.[name];
    return (value && typeof value === 'object' ? value : undefined);
}
/**
 * 命名空间（可选：某个方法）当前是否**已注册**。同步、零成本，用于「不可用就别渲染入口」。
 *
 * 这是本 SDK 存在的核心理由之一：把口头纪律变成一次函数调用。
 *   if (!available('music')) return null   // 不渲染音乐 Tab，而不是渲染一个点了报错的按钮
 */
export function available(name, method) {
    const host = bridge();
    const ns = host?.[name];
    if (!ns || typeof ns !== 'object')
        return false;
    if (!method)
        return true;
    return typeof ns[method] === 'function';
}
/**
 * 宿主自报的能力表：命名空间 -> 方法名数组。比 `available()` 全面（能一次拿到全部方法），
 * 但要走一次桥调用形态的同步 API，故只在诊断/设置页用，热路径用 `available()`。
 */
export function capabilityMap() {
    const host = bridge();
    if (!host || typeof host.capabilities !== 'function')
        return {};
    try {
        return host.capabilities() ?? {};
    }
    catch {
        return {};
    }
}
