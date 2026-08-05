// 宿主桥接口：**共享部分全部转发给 `@aibox/applet-sdk`**。
//
// 2026-08-05 迁移：这里原本是一份私有胶水，是全市场 8 份分叉之一。分叉的代价不是重复代码，
// 是**同一件事有好几个答案**——几份实现对「不可用时回什么」各有各的说法，AI 写新应用时
// 检索到哪份就继承哪份。现在语义由 SDK 统一裁定（见 sdk/src/ui.ts、system.ts 的文件头）。
//
// 保留这层薄转发而不是让各调用点直接 import SDK：调用点一个都不用改，迁移 diff 只有本文件，
// 出问题回滚面也只有本文件。真机验过一轮后再把调用点逐步指向 SDK 并删掉本文件。
import { available, bridge, events, system, intelligence, storage as sdkStorage } from '../lib/aibox-sdk.js';
export function hasNamespace(name, method) {
    return available(name, method);
}
export const capabilities = {
    get tabs() { return hasNamespace('tabs', 'getState'); },
    get toolbar() { return hasNamespace('toolbar', 'on'); },
    get net() { return hasNamespace('net', 'fetch'); },
    get ai() { return hasNamespace('ai', 'generate'); },
    get chat() { return hasNamespace('chat', 'open'); },
    get notifications() { return hasNamespace('notifications', 'schedule'); },
    get share() { return hasNamespace('share', 'file'); },
    get action() { return hasNamespace('action', 'register'); },
    get haptics() { return hasNamespace('haptics', 'impact'); },
};
// —— storage（per-applet KV）——
const memoryStore = new Map();
export const storage = {
    async get(key) {
        const api = bridge();
        if (!api || !api.storage)
            return memoryStore.has(key) ? memoryStore.get(key) : null;
        try {
            const value = await api.storage.get(key);
            return value === undefined ? null : value;
        }
        catch (error) {
            return null;
        }
    },
    async set(key, value) {
        const api = bridge();
        if (!api || !api.storage) {
            memoryStore.set(key, value);
            return true;
        }
        try {
            await api.storage.set(key, value);
            return true;
        }
        catch (error) {
            return false;
        }
    },
    async remove(key) {
        const api = bridge();
        if (!api || !api.storage) {
            memoryStore.delete(key);
            return true;
        }
        try {
            await api.storage.remove(key);
            return true;
        }
        catch (error) {
            return false;
        }
    },
};
// —— 事件总线 ——
export const onEvent = events.on;
/** 外壳命名空间自带回调（tabs/toolbar），与 aibox.events 是两套机制，别混。 */
export const onNamespaceEvent = events.shellOn;
// —— AI ——
export const aiAvailability = intelligence.aiAvailability;
/** 降级路径：没有停靠会话时跳聊天页开一个带种子的会话（原生自己就有这条降级）。 */
export async function openChat({ prompt, categoryKey, autoSend = true, identity }) {
    const api = bridge();
    if (api && api.chat && typeof api.chat.open === 'function') {
        try {
            await api.chat.open({ prompt, categoryKey, autoSend, identity });
            return true;
        }
        catch (error) { /* 落到 ai.generate */ }
    }
    return false;
}
export const aiGenerate = intelligence.aiGenerate;
// —— 本地通知（到价提醒）——
//
// 容器只有 `schedule`，**没有后台唤醒**——所以到价检查照原生做法放在「前台刷新时」，
// UI 文案如实说明「App 活跃时生效」，不假装能后台盯盘。
export async function scheduleNotification({ title, body, afterMinutes = 0 }) {
    const api = bridge();
    if (!api || !api.notifications || typeof api.notifications.schedule !== 'function')
        return false;
    try {
        await api.notifications.schedule({ title, body, afterMinutes });
        return true;
    }
    catch (error) {
        return false;
    }
}
// —— 文件导出（账户归档）——
export const shareFile = system.shareFile;
export function impact(style = 'light') {
    const api = bridge();
    if (api && api.haptics && typeof api.haptics.impact === 'function') {
        try {
            api.haptics.impact({ style });
        }
        catch (error) { /* 触觉是锦上添花 */ }
    }
}
/** 注册一个可被 AI / 自动化调用的 action（manifest.actions 里已静态声明的那些）。 */
export function registerAction(name, handler) {
    const api = bridge();
    if (!api || !api.action || typeof api.action.register !== 'function')
        return false;
    try {
        api.action.register(name, handler);
        return true;
    }
    catch (error) {
        return false;
    }
}
