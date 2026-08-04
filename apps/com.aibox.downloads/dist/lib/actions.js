// 对外提供的 AI 动作（downloads_add / list / control）+ ⋯ 菜单的三个 UI 动作。
//
// **模块求值期就注册**：无头执行时页面不挂载任何组件，等 React 副作用就来不及了
// （`applet_invoke` 拉起一个无头 WebView，只跑模块顶层代码然后立刻调 action）。
import { downloads, matchesState } from './host.js';
import { extractURLs } from '../components/AddSheet.js';
/** UI 动作的回调挂载点。页面挂载时填，卸载时清；无头时恒为空（那三个动作本来就 headless:false）。 */
export const uiHooks = { pauseAll: null, resumeAll: null, clearFinished: null, refresh: null };
function targetOf(destination, folder) {
    const path = folder || '';
    if (destination === 'iCloud')
        return { kind: 'iCloud', path };
    if (destination === 'externalFiles')
        return { kind: 'externalFiles', path };
    if (destination === 'vault')
        return { kind: 'vault', path };
    return { kind: 'sandbox', path };
}
function describe(task) {
    const percent = typeof task.fraction === 'number' ? ` ${Math.round(task.fraction * 100)}%` : '';
    const where = task.outputPath ? ` → ${task.outputPath}` : '';
    return `· ${task.filename} — ${task.state}${percent}${where}`;
}
export async function addDownloads({ urls, filename, destination, folder, priority }) {
    const list = (Array.isArray(urls) ? urls : [urls])
        .flatMap((u) => extractURLs(u).length ? extractURLs(u) : []);
    if (!list.length) {
        return { ok: false, error: 'No http(s) URL found in the input.', text: '没有可下载的链接。' };
    }
    // 多条链接共用一个 groupId：调用方之后可以把这一批当成一件事一起取消。
    const groupId = list.length > 1 ? `batch-${Date.now()}` : undefined;
    const tasks = [];
    for (const url of list) {
        const result = await downloads.enqueue({
            url,
            filename: list.length === 1 && filename ? filename : undefined,
            destination: targetOf(destination, folder),
            priority: priority || 'normal',
            groupId,
        });
        if (result && result.taskId) {
            tasks.push({ taskId: result.taskId, url, filename: filename || url.split('/').pop(), artifactRef: result.artifactRef });
        }
        else if (result && result.error) {
            return { ok: false, error: result.error, text: `入队失败：${result.error}` };
        }
    }
    return {
        ok: true,
        count: tasks.length,
        tasks,
        text: `已加入下载队列 ${tasks.length} 项。传输在后台继续，App 退到后台或被杀掉也不中断。`,
    };
}
export async function listDownloads({ state, limit } = {}) {
    const all = await downloads.list(state ? { state } : {});
    const filtered = state ? all.filter((t) => matchesState(state, t.state)) : all;
    const capped = filtered.slice(0, Math.max(1, Math.min(50, limit || 20)));
    return {
        ok: true,
        count: capped.length,
        tasks: capped,
        text: capped.length ? capped.map(describe).join('\n') : '当前没有下载任务。',
    };
}
export async function controlDownloads({ action, taskId }) {
    const ok = await downloads.control(action, taskId);
    if (uiHooks.refresh)
        uiHooks.refresh();
    return {
        ok,
        action,
        text: ok
            ? `已${{ pause: '暂停', resume: '继续', cancel: '取消', remove: '删除', clearFinished: '清空已完成' }[action] || action}${taskId ? '该任务' : '全部任务'}。`
            : '没有匹配的任务。',
    };
}
export function registerActions() {
    const api = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!api || !api.action || typeof api.action.register !== 'function')
        return;
    api.action.register('add', addDownloads);
    api.action.register('list', listDownloads);
    api.action.register('control', controlDownloads);
    api.action.register('pauseAll', async () => {
        if (uiHooks.pauseAll)
            return uiHooks.pauseAll();
        return controlDownloads({ action: 'pause' });
    });
    api.action.register('resumeAll', async () => {
        if (uiHooks.resumeAll)
            return uiHooks.resumeAll();
        return controlDownloads({ action: 'resume' });
    });
    api.action.register('clearFinished', async () => {
        if (uiHooks.clearFinished)
            return uiHooks.clearFinished();
        return controlDownloads({ action: 'clearFinished' });
    });
}
