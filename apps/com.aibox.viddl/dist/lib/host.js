// 桥接口：**全部转发给 `@aibox/applet-sdk`**，本文件不再有任何自己的实现。
//
// 2026-08-04 迁移：这里原本是 148 行私有胶水，是全市场 8 份分叉之一。分叉的代价不是重复代码，
// 是**同一件事有好几个答案**——四份对「confirm 不可用回什么」给了三个答案，AI 写新应用时
// 检索到哪份就继承哪份。现在语义由 SDK 统一裁定（见 sdk/src/ui.ts、system.ts 的文件头）。
//
// 保留这一层薄转发而不是让各处直接 import SDK：调用点一个都不用改，迁移的 diff 只有本文件，
// 出问题时回滚面也只有本文件。等真机验过一轮之后，再把调用点逐步指向 SDK 并删掉本文件。
import { available, bridge, events, system, intelligence } from '../lib/aibox-sdk.js';
export { parseJobLines } from './jobs.js';
export function hasNamespace(name, method) {
    return available(name, method);
}
export const capabilities = {
    get tools() { return available('tools', 'call'); },
    get download() { return available('download', 'list'); },
    get clipboard() { return available('clipboard', 'read'); },
    get share() { return available('share', 'file'); },
    get haptics() { return available('haptics', 'impact'); },
};
export const toolAllowed = intelligence.toolAllowed;
/**
 * 工具为什么用不了——**分清「宿主没装模块」和「用户没授权」**。
 *
 * 这两件事此前被塌成同一句「这个宿主没有装视频下载模块」，把用户指向了完全错误的地方：
 * 真实情况几乎总是后者（市场安装会把本机工具授权归零，`AppletMarketInstaller.resetLocalAuthorization`
 * 是刻意的——「市场包永远带不来授权」），用户要做的是去能力中心勾一下，而不是换构建。
 *
 * 宿主早就把答案备好了：`aibox.access.explain({tool})` 逐门返回 7 条 gate + 可操作的 remedies。
 * 这里只是把它读出来、翻译成用户能照着做的一句话。
 *
 * 返回 `{ ok, reason, hint }`：
 *  · ok=true            → 能用
 *  · reason='not-active' → 宿主确实没装模块（原来那句话此时才是对的）
 *  · reason='not-granted'→ 装了但没授权（绝大多数情况）
 *  · reason='not-declared'/'blocked'/'unknown' → 其余各归其位
 */
export async function toolBlockReason(name) {
    const api = bridge();
    if (!api || !api.access || typeof api.access.explain !== 'function') {
        return { ok: false, reason: 'unknown', hint: '这个宿主没有工具网关。' };
    }
    try {
        const verdict = await api.access.explain({ tool: name });
        if (verdict && verdict.allowed)
            return { ok: true, reason: null, hint: '' };
        const failed = (verdict && verdict.gates ? verdict.gates : []).filter((g) => !g.passed).map((g) => g.name);
        if (failed.includes('active')) {
            // ⚠️ 别把 active 读成「模块没装」——宿主这一门的 detail 原文是
            // “The tool is not active **or** not installed”：模块缺席和工具开关被关掉走的是同一门，
            // 宿主自己都没分开，这里更不能替它断言。此前写死成「没装模块」，把用户支去换构建，
            // 而实际上绝大多数情况只是开关没开（真机实测：active 与 localGrant 同时为 false）。
            // 所以只描述现象 + 透出宿主自己给的 remedies（它知道该开哪个模块/哪个开关）。
            // 不转发 verdict.remedies：宿主那两条是英文，且第一条写着「in the capability center」——
            // 设置页的能力中心**没有** per-applet 工具授权，照抄只会把用户再支错一次（上一版就栽在这句）。
            // 这里给中文 + 已核实过的路径，两种可能都说清，让用户先去开关看一眼。
            const grantPath = failed.includes('localGrant')
                ? '另外也还没授权给这个小应用：点右上角「⋯」→「应用详情」→「能力」，在宿主工具那一段把 viddl 系列打开。'
                : '';
            return {
                ok: false,
                reason: 'not-active',
                hint: `视频解析工具当前没有启用——可能是宿主的工具开关里关着，也可能是这个构建没装视频下载模块。${grantPath}`,
            };
        }
        if (failed.includes('localGrant')) {
            // 路径是核实过的：AppletRunnerView 的 ⋯ 菜单 → 「App details」→ 「Capabilities」→
            // AppletCapabilitiesView 的宿主工具段（该段的显示条件是 capabilities 含 'tools' 且
            // manifest 声明了 toolRequirements，本应用两条都满足）。
            // **不要**写成「设置 ▸ 能力中心」——那是助手自己的能力页，没有 per-applet 工具授权。
            return { ok: false, reason: 'not-granted', hint: '还没有把视频解析工具授权给这个小应用。点右上角「⋯」→「应用详情」→「能力」，在宿主工具那一段把 viddl 系列打开就能用了。' };
        }
        if (failed.includes('declared') || failed.includes('requirement')) {
            return { ok: false, reason: 'not-declared', hint: '这个版本的小应用没有声明要用视频解析工具，请更新到新版本。' };
        }
        if (failed.includes('bridgeable') || failed.includes('hostPolicy')) {
            return { ok: false, reason: 'blocked', hint: '当前宿主策略不允许小应用调用视频解析工具。' };
        }
        return { ok: false, reason: 'unknown', hint: (verdict && verdict.remedies && verdict.remedies[0]) || '视频解析工具当前不可用。' };
    }
    catch (error) {
        return { ok: false, reason: 'unknown', hint: '视频解析工具当前不可用。' };
    }
}
/** 调一个宿主工具。回 `{ok, text, details?}`——形状与迁移前一致，调用点零改。 */
export async function callTool(name, args) {
    const result = await intelligence.callTool(name, args || {});
    return result.ok ? result : { ok: false, error: result.text, text: result.text };
}
export const queue = {
    /** 视频轨道与 HLS 离线包都在这里。 */
    async list() {
        const api = bridge();
        if (!capabilities.download)
            return [];
        try {
            const items = await api.download.list({});
            return Array.isArray(items) ? items : [];
        }
        catch {
            return [];
        }
    },
    async subscribe() {
        const api = bridge();
        if (!capabilities.download)
            return false;
        try {
            await api.download.subscribe({});
            return true;
        }
        catch {
            return false;
        }
    },
    async unsubscribe() {
        const api = bridge();
        if (!capabilities.download)
            return false;
        try {
            await api.download.unsubscribe({});
            return true;
        }
        catch {
            return false;
        }
    },
};
export const onEvent = events.on;
/** 外壳命名空间自带的回调（tabs/toolbar），与 `aibox.events` 是两套机制，别混。 */
export const onNamespaceEvent = events.shellOn;
export const readClipboard = system.readClipboard;
export function tap(style) {
    const api = bridge();
    if (!capabilities.haptics)
        return;
    try {
        api.haptics.impact({ style: style || 'light' });
    }
    catch { /* 触感失败无所谓 */ }
}
