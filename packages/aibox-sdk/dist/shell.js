import { bridge, available } from './bridge';
import { normalizeError } from './errors';
/** 原生 TabBar 当前是否真的画出来了。false = 自己画页内切换器。 */
export async function tabsAreRendered() {
    const host = bridge();
    if (!host?.tabs)
        return false;
    try {
        const state = await host.tabs.getState();
        return Boolean(state.declared && state.rendered);
    }
    catch {
        return false;
    }
}
/** 导航栏搜索框当前是否真的画出来了。false = 自己画输入框。 */
export async function searchIsRendered() {
    const host = bridge();
    if (!host?.toolbar)
        return false;
    try {
        const state = await host.toolbar.getState();
        return Boolean(state.search?.declared && state.search?.rendered);
    }
    catch {
        return false;
    }
}
/** 读 tabs 状态（不可用返回 null）。 */
export async function tabsState() {
    const host = bridge();
    if (!host?.tabs)
        return null;
    try {
        return await host.tabs.getState();
    }
    catch {
        return null;
    }
}
/** 选中一个 tab（等价用户点击，会触发 changed 事件）。 */
export async function selectTab(id) {
    const host = bridge();
    if (!host?.tabs)
        return null;
    try {
        return await host.tabs.select(id);
    }
    catch (error) {
        throw normalizeError(error);
    }
}
/** 给某个 tab 打角标。`null` 清掉。 */
export async function setTabBadge(id, badge) {
    const host = bridge();
    if (!host?.tabs)
        return;
    try {
        await host.tabs.update({ items: { [id]: { badge } } });
    }
    catch { /* 角标是装饰，失败不该影响主流程 */ }
}
/** 读 scene 状态（呈现面、安全区、外观）。 */
export async function sceneState() {
    const host = bridge();
    if (!host?.scene)
        return null;
    try {
        return await host.scene.getState();
    }
    catch {
        return null;
    }
}
/** 设置导航栏标题。 */
export async function setTitle(title) {
    const host = bridge();
    if (!host?.navigation)
        return;
    try {
        await host.navigation.setTitle(title);
    }
    catch { /* 标题是装饰 */ }
}
/**
 * 关闭确认。有未保存改动时开、保存后关——**别永久开着**，那会让用户每次退出都被拦一下。
 */
export async function setCloseConfirmation(enabled, options) {
    const host = bridge();
    if (!host?.navigation)
        return;
    try {
        await host.navigation.setCloseConfirmation(enabled ? { enabled: true, ...options } : { enabled: false });
    }
    catch { /* 确认框是增强 */ }
}
/** 触觉反馈。宿主没有 haptics 时静默忽略（这是纯增强，绝不该因为它抛）。 */
export async function haptic(kind = 'light') {
    if (!available('haptics'))
        return;
    const host = bridge();
    const ns = host?.haptics;
    if (!ns)
        return;
    try {
        if (typeof ns.impact === 'function' && (kind === 'light' || kind === 'medium' || kind === 'heavy')) {
            await ns.impact({ style: kind });
        }
        else if (typeof ns.notification === 'function') {
            await ns.notification({ type: kind });
        }
    }
    catch { /* 增强路径 */ }
}
