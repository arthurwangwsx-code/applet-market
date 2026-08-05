import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 视频下载（com.aibox.viddl）—— 解析 / 画质 / 离线资料库。
//
// ## 边界：这个应用做 UI 与策略，不做解析也不做传输
//
//  · **来源解析**（B 站 / YouTube / HLS / 通用页嗅探）是领域逻辑，五个站点适配器留在原生侧，
//    本应用经 `aibox.tools` 遥控 `viddl_inspect`；
//  · **传输**在宿主的两条后台 session 上跑（直链/DASH 轨道走下载引擎、HLS 走 AVAssetDownload），
//    本应用只拿 jobId 和只读进度；
//  · **画质选择**与**资料库排序**才是本应用的东西——判据把它们判为「策略归应用」：
//    同一个视频，两个应用可以默认选不同档且都对。
//
// 进度有两个来源，同源不冲突：`viddl_jobs list`（高层 job 状态机，权威）+
// `aibox.download.list()`（统一队列的结构化字节/速度，**含 HLS 那一半**——补充源已并进来）。
// 前者定「有哪些任务、到哪一步」，后者补「多少字节、多快」。
//
// ⚠️ 没有「私密视频」。该功能连同 Face ID 门已整体裁撤（2026-08-03 用户裁定）。
import React from 'react';
import { THEME_CSS, C, SPACE, formatBytes, formatSpeed, stateColor } from './components/theme.js';
import { Button, Card, EmptyState, Notice, ProgressBar, SectionHeader, IconButton } from './components/primitives.js';
import Icon from './components/Icon.js';
import InspectSheet from './components/InspectSheet.js';
import { capabilities, onEvent, onNamespaceEvent, queue, readClipboard, tap, toolAllowed, toolBlockReason, } from './lib/host.js';
import { fetchVideo, inspectVideo, isLibraryDenied, libraryAction, registerActions, uiHooks } from './lib/actions.js';
// 无头执行时页面不挂载任何组件——注册必须发生在模块求值期。
registerActions();
const TABS = [
    { id: 'library', title: '资料库', icon: 'film', selectedIcon: 'film.fill' },
    { id: 'downloading', title: '下载中', icon: 'arrow.down.circle', selectedIcon: 'arrow.down.circle.fill' },
];
const DONE_STATES = ['completed'];
const FAIL_STATES = ['failed', 'cancelled'];
function useThemeSetup() {
    React.useEffect(() => {
        if (document.getElementById('__vd_css__'))
            return;
        const style = document.createElement('style');
        style.id = '__vd_css__';
        style.textContent = THEME_CSS;
        document.head.appendChild(style);
    }, []);
}
/** 高层 job 表 + 统一队列的字节明细。两者按 groupId(=jobId) 对齐。 */
function useJobs() {
    const [jobs, setJobs] = React.useState([]);
    const [bytes, setBytes] = React.useState({});
    const [loaded, setLoaded] = React.useState(false);
    const [denied, setDenied] = React.useState(false);
    const refresh = React.useCallback(async () => {
        const result = await libraryAction({ action: 'list' });
        setJobs(result.jobs || []);
        setLoaded(true);
        if (result.denied)
            setDenied(true);
    }, []);
    /**
     * 播放一个已完成的任务。
     *
     * 走的是**和哔哩哔哩同一条路**：`video.stage()` 开页面内舞台 → `video.play({artifactRef})`。
     * 这样拿到的是舞台播放器——画中画、后台音频、手势、以及播放器自己的全屏按钮全都在，
     * 页面还能继续滚动。
     *
     * 老路（`viddl_jobs play`）会把整屏交给宿主全屏播放器并转横屏，且没有画中画。
     * 它仍作**兜底**：没有句柄（比如 HLS 离线包还没导出成 mp4）时退回去，总比不能播好。
     */
    const playJob = React.useCallback(async (job) => {
        const api = typeof window !== 'undefined' ? window.aibox : undefined;
        const ref = (bytes[job.jobId] || {}).artifactRef;
        if (api && api.video && ref) {
            try {
                // 舞台是可选增强：开不出来（无头 / 这个构建没编播放器）也不该挡住播放。
                try {
                    await api.video.stage({ aspect: '16:9', backgroundAudio: true, pictureInPicture: true });
                }
                catch (_) { }
                const result = await api.video.play({ artifactRef: ref, title: job.title });
                if (result && result.playing)
                    return;
            }
            catch (error) {
                // 落到兜底，不把异常抛给 UI——播放失败要给用户一条能读的提示，不是一个红框。
            }
        }
        await act('play', job.jobId);
    }, [bytes]);
    const refreshBytes = React.useCallback(async () => {
        const items = await queue.list();
        // 一个 job 可能有多条轨道（DASH 双轨），按 groupId 聚合；HLS 只有一条（补充源投影的那条）。
        const map = {};
        for (const item of items) {
            const key = item.groupId || item.taskId;
            const row = map[key] || { received: 0, total: 0, speed: 0, known: true, artifactRef: null };
            // 句柄留给播放用：完成的那条轨道就是可播的那个文件（DASH 双轨里取先完成的那条即可，
            // 宿主合轨后 outputPath 指向同一个成品）。
            if (!row.artifactRef && item.state === 'completed' && item.artifactRef)
                row.artifactRef = item.artifactRef;
            row.received += item.bytesReceived || 0;
            if (item.totalBytes)
                row.total += item.totalBytes;
            else
                row.known = false;
            row.speed += item.speed || 0;
            map[key] = row;
        }
        setBytes(map);
    }, []);
    React.useEffect(() => {
        let alive = true;
        let poll = null;
        let off = null;
        const boot = async () => {
            await refresh();
            await refreshBytes();
            const pushed = await queue.subscribe();
            if (!alive)
                return;
            off = onEvent('download.progress', () => { refreshBytes(); });
            // job 状态机没有事件通道（`viddl_jobs` 是工具不是能力），所以状态仍要轮询；
            // 但**字节/速度走事件**，于是轮询周期可以放到 2.5s 而不牺牲进度条的顺滑。
            poll = setInterval(() => {
                // 工具已被拒就停表：继续轮询只会每 2.5s 再打一条 console 错误，把真错误埋掉。
                if (isLibraryDenied()) {
                    clearInterval(poll);
                    poll = null;
                    return;
                }
                refresh();
                if (!pushed)
                    refreshBytes();
            }, pushed ? 2500 : 1200);
        };
        boot();
        return () => {
            alive = false;
            if (poll)
                clearInterval(poll);
            if (off)
                off();
            queue.unsubscribe();
        };
    }, [refresh, refreshBytes]);
    return { jobs, bytes, loaded, refresh, denied };
}
function JobRow({ job, detail, onPause, onResume, onCancel, onRetry, onPlay, onExport }) {
    const done = DONE_STATES.includes(job.state);
    const failed = FAIL_STATES.includes(job.state);
    const active = !done && !failed;
    const color = stateColor(job.state === 'downloading' || job.state === 'processing' ? 'running'
        : done ? 'completed' : failed ? 'failed' : job.state);
    const parts = [];
    if (detail && detail.received) {
        parts.push(detail.known && detail.total
            ? `${formatBytes(detail.received)} / ${formatBytes(detail.total)}`
            : formatBytes(detail.received));
    }
    if (active && detail && detail.speed)
        parts.push(formatSpeed(detail.speed));
    if (job.source)
        parts.push(job.source);
    if (failed)
        parts.push(job.state === 'cancelled' ? '已取消' : '失败');
    if (done && job.outputName)
        parts.push(job.outputName);
    return (_jsxs("div", { "data-row-id": job.jobId, style: { padding: `${SPACE.s3}px ${SPACE.s4}px` }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s3 }, children: [_jsx("div", { style: {
                            // `flex: '0 0 44px'` 不能省：只写 width 的话，flex 容器在标题长的行里会把它**压窄**，
                            // 于是每行的图标宽度和标题起点都不一样——真机上就是一列参差不齐的行（2026-08-05 实测）。
                            flex: '0 0 44px', width: 44, height: 44, borderRadius: 8, background: C.track,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color,
                        }, children: _jsx(Icon, { name: done ? 'play.rectangle' : failed ? 'exclamationmark.circle' : 'arrow.down.circle', size: 20 }) }), _jsxs("div", { style: { flex: '1 1 auto', minWidth: 0 }, children: [_jsx("div", { style: {
                                    fontSize: 15, fontWeight: 500,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }, children: job.title }), _jsx("div", { style: {
                                    fontSize: 12.5, color: failed ? C.failed : C.muted, marginTop: 2,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }, children: parts.join(' · ') || job.state })] }), active && typeof job.fraction === 'number' ? (_jsxs("span", { style: { flexShrink: 0, fontSize: 12.5, color: C.muted, fontVariantNumeric: 'tabular-nums' }, children: [Math.round(job.fraction * 100), "%"] })) : null, job.state === 'downloading' ? _jsx(IconButton, { name: "pause", onClick: () => onPause(job), label: "\u6682\u505C" }) : null, job.state === 'paused' ? _jsx(IconButton, { name: "play", onClick: () => onResume(job), label: "\u7EE7\u7EED" }) : null, active ? _jsx(IconButton, { name: "xmark", onClick: () => onCancel(job), label: "\u53D6\u6D88" }) : null, failed ? _jsx(IconButton, { name: "arrow.clockwise", onClick: () => onRetry(job), label: "\u91CD\u8BD5" }) : null, done ? _jsx(IconButton, { name: "play", onClick: () => onPlay(job), label: "\u64AD\u653E" }) : null, done && job.outputName && /\.movpkg$/i.test(job.outputName)
                        ? _jsx(IconButton, { name: "square.and.arrow.down", onClick: () => onExport(job), label: "\u5BFC\u51FA mp4" })
                        : null] }), active ? (_jsx("div", { style: { marginTop: SPACE.s2, marginLeft: 44 + SPACE.s3 }, children: _jsx(ProgressBar, { fraction: job.fraction, color: color }) })) : null] }));
}
export default function App() {
    useThemeSetup();
    const [tab, setTab] = React.useState('library');
    const [shell, setShell] = React.useState({ tabsRendered: false, toolbarRendered: false });
    const [adding, setAdding] = React.useState(false);
    const [notice, setNotice] = React.useState(null);
    const [extractorReady, setExtractorReady] = React.useState(true);
    // 不可用时的**真实原因**（宿主没装模块 vs 没授权 —— 两者的下一步动作完全不同）。
    const [blockHint, setBlockHint] = React.useState('');
    const { jobs, bytes, loaded, refresh, denied } = useJobs();
    // 解析面不可用时（Lean 变体解链了 MODULE_VIDEODOWNLOAD）**整块入口不渲染**，
    // 而不是留一个点了报错的按钮——「合法留 ≠ 必须留」。
    React.useEffect(() => {
        toolBlockReason('viddl_inspect').then((verdict) => {
            setExtractorReady(verdict.ok);
            setBlockHint(verdict.ok ? '' : verdict.hint);
        });
    }, []);
    // 轮询侧探到 denied 也要把入口收掉——两条路径指向同一个事实。
    React.useEffect(() => { if (denied)
        setExtractorReady(false); }, [denied]);
    React.useEffect(() => {
        uiHooks.refresh = refresh;
        return () => { uiHooks.refresh = null; };
    }, [refresh]);
    const done = jobs.filter((j) => DONE_STATES.includes(j.state));
    const running = jobs.filter((j) => !DONE_STATES.includes(j.state));
    const visible = tab === 'library' ? done : running;
    const act = React.useCallback(async (action, jobId) => {
        tap('light');
        const result = await libraryAction({ action, jobId });
        if (!result.ok)
            setNotice({ tone: 'error', text: result.text || '操作失败' });
        await refresh();
    }, [refresh]);
    const startDownload = React.useCallback(async (request) => {
        const result = await fetchVideo(request);
        setNotice(result.ok ? { tone: 'success', text: result.text } : { tone: 'error', text: result.text });
        if (result.ok) {
            tap('medium');
            setTab('downloading');
        }
        await refresh();
    }, [refresh]);
    // —— 宿主外壳接线 ——
    const addRef = React.useRef(null);
    addRef.current = () => setAdding(true);
    React.useEffect(() => {
        let cancelled = false;
        const offs = [];
        const wire = async () => {
            const api = window.aibox;
            if (api && api.tabs && typeof api.tabs.getState === 'function') {
                try {
                    const state = await api.tabs.getState();
                    if (!cancelled && state && state.rendered) {
                        setShell((c) => ({ ...c, tabsRendered: true }));
                        if (state.selected)
                            setTab(state.selected);
                    }
                }
                catch (error) { /* 宿主没这能力：留给自绘 TabBar */ }
                offs.push(onNamespaceEvent('tabs', 'changed', (state) => {
                    if (!state)
                        return;
                    // `rendered` 会在挂载之后翻转（形态切换重发 changed），只判一次会永远多/少一条自绘条。
                    const rendered = state.rendered !== false;
                    setShell((c) => (c.tabsRendered === rendered ? c : { ...c, tabsRendered: rendered }));
                    if (state.selected)
                        setTab(state.selected);
                }));
            }
            if (api && api.toolbar && typeof api.toolbar.getState === 'function') {
                try {
                    const state = await api.toolbar.getState();
                    if (!cancelled && state)
                        setShell((c) => ({ ...c, toolbarRendered: state.rendered !== false }));
                }
                catch (error) { /* 同上 */ }
                offs.push(onNamespaceEvent('toolbar', 'invoke', (payload) => {
                    if (payload && payload.id === 'add' && addRef.current)
                        addRef.current();
                }));
            }
            offs.push(onEvent('lifecycle.foreground', () => { refresh(); }));
        };
        wire();
        return () => { cancelled = true; offs.forEach((off) => off && off()); };
    }, [refresh]);
    const runningCount = running.length;
    React.useEffect(() => {
        const api = window.aibox;
        const title = tab === 'library' ? '资料库' : '下载中';
        document.title = title;
        if (api && api.navigation && typeof api.navigation.setTitle === 'function') {
            api.navigation.setTitle(title).catch(() => { });
        }
        // 只在宿主真的画了外壳时才发 update（无头运行恒回 aibox/not-visible，会把验收日志染红）。
        if (shell.toolbarRendered && api && api.toolbar && typeof api.toolbar.update === 'function') {
            api.toolbar.update({ items: { add: { hidden: !extractorReady } } }).catch(() => { });
        }
        if (shell.tabsRendered && api && api.tabs && typeof api.tabs.update === 'function') {
            api.tabs.update({
                items: { downloading: { badge: runningCount ? String(runningCount) : null } },
            }).catch(() => { });
        }
    }, [tab, runningCount, extractorReady, shell.tabsRendered, shell.toolbarRendered]);
    return (_jsxs("div", { style: { minHeight: '100vh', paddingBottom: shell.tabsRendered ? 0 : 76 }, children: [!shell.toolbarRendered ? (_jsxs("div", { style: {
                    display: 'flex', alignItems: 'center', gap: SPACE.s2,
                    padding: `calc(${SPACE.s3}px + env(safe-area-inset-top)) ${SPACE.s4}px ${SPACE.s3}px`,
                }, children: [_jsx("span", { style: { fontSize: 22, fontWeight: 700 }, children: tab === 'library' ? '资料库' : '下载中' }), _jsx("div", { style: { flex: '1 1 auto' } }), extractorReady
                        ? _jsx(Button, { kind: "primary", icon: "plus", onClick: () => setAdding(true), children: "\u6DFB\u52A0" })
                        : null] })) : null, _jsx(Notice, { text: notice && notice.text, tone: notice && notice.tone, onDismiss: () => setNotice(null) }), !extractorReady ? (_jsx("div", { style: { padding: `0 ${SPACE.s4}px` }, children: _jsx(EmptyState, { icon: "exclamationmark.circle", title: "\u89E3\u6790\u80FD\u529B\u4E0D\u53EF\u7528", hint: blockHint || '视频解析工具当前不可用。' }) })) : null, _jsx("div", { style: { padding: `0 ${SPACE.s4}px ${SPACE.s5}px` }, children: !loaded ? null : visible.length === 0 ? (extractorReady ? (_jsx(EmptyState, { icon: tab === 'library' ? 'film' : 'arrow.down.circle', title: tab === 'library' ? '资料库还是空的' : '没有进行中的下载', hint: tab === 'library'
                        ? '粘贴一个视频页面地址，先看清有哪些画质，再决定下哪一个。'
                        : '下载在后台继续，退出这个小应用也不会中断。', action: tab === 'library'
                        ? _jsx(Button, { kind: "primary", icon: "plus", onClick: () => setAdding(true), children: "\u6DFB\u52A0\u89C6\u9891" })
                        : null })) : null) : (_jsxs(_Fragment, { children: [_jsxs(SectionHeader, { children: [visible.length, " \u9879"] }), _jsx(Card, { padding: 0, children: visible.map((job, index) => (_jsx("div", { style: index ? { borderTop: `1px solid ${C.line}` } : undefined, children: _jsx(JobRow, { job: job, detail: bytes[job.jobId], onPause: (j) => act('pause', j.jobId), onResume: (j) => act('resume', j.jobId), onCancel: (j) => act('cancel', j.jobId), onRetry: (j) => act('retry', j.jobId), onPlay: (j) => playJob(j), onExport: (j) => act('export', j.jobId) }) }, job.jobId))) })] })) }), !shell.tabsRendered ? (_jsx("div", { style: {
                    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
                    display: 'flex', borderTop: `1px solid ${C.line}`, background: C.surface,
                    paddingBottom: 'env(safe-area-inset-bottom)',
                }, children: TABS.map((row) => (_jsxs("button", { type: "button", onClick: () => { setTab(row.id); tap('light'); }, style: {
                        flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 2, padding: '8px 0 6px', background: 'none', border: 'none', cursor: 'pointer',
                        color: tab === row.id ? C.brand : C.muted,
                    }, children: [_jsx(Icon, { name: tab === row.id ? row.selectedIcon : row.icon, size: 22 }), _jsx("span", { style: { fontSize: 11 }, children: row.title })] }, row.id))) })) : null, _jsx(InspectSheet, { open: adding, onClose: () => setAdding(false), onInspect: (url) => inspectVideo({ url }), onDownload: startDownload, onPaste: capabilities.clipboard ? readClipboard : null })] }));
}
