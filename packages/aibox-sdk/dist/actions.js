import { bridge } from './bridge';
import { AiboxError, normalizeError } from './errors';
function requireAction() {
    const host = bridge();
    if (!host?.action || typeof host.action.register !== 'function') {
        throw new AiboxError('aibox/unavailable', 'aibox/unavailable: aibox.action.register is not available. Actions only work inside the applet container.');
    }
    return host.action;
}
/**
 * 注册一个 action handler。名字与入参/返回类型都受 `AppletActionMap` 约束。
 *
 * 容器外（单测、被当普通网页打开）调用是**静默 no-op**：一个只在容器里有意义的注册
 * 不该让页面在 Node 里崩掉。真正的桥缺失会在 `registerActions` 的 strict 模式里显式抛。
 */
export function registerAction(name, handler) {
    const host = bridge();
    if (!host?.action || typeof host.action.register !== 'function')
        return;
    // handler 的入参是 manifest schema 推出来的具体类型，桥那侧只知道 JSONValue——
    // 这个方向的收窄由 schema 保证（宿主按 inputSchemaJSON 校验后才派发），不是这里能表达的。
    host.action.register(name, handler);
}
/**
 * 一次注册全部 action。
 *
 * 「漏注册」是 manifest 声明了 action 却没人处理——宿主会把它列进工具清单，AI 调过来直接失败。
 * 用整表注册就把「漏一个」变成编译错（`Property 'x' is missing in type ...`）。
 */
export function registerActions(handlers) {
    const host = bridge();
    if (!host?.action || typeof host.action.register !== 'function')
        return;
    for (const [name, handler] of Object.entries(handlers)) {
        if (typeof handler !== 'function')
            continue;
        host.action.register(name, handler);
    }
}
/** 把结构化结果回给当前调用方（AI / 自动化）。 */
export async function actionResult(data) {
    try {
        return await requireAction().result(data);
    }
    catch (error) {
        throw normalizeError(error);
    }
}
