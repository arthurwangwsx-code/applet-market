import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, NavBar, Space } from 'antd-mobile';
import { haptic, isAvailable } from './lib/aibox-sdk.js';
import { useKeyboardInset, useLocale, useScene } from './lib/aibox-sdk-react.js';
import { Dial } from './components/Dial.js';
import { HistoryList } from './components/HistoryList.js';
import { registerAppletActions } from './lib/actions.js';
import { DEFAULT_SECONDS, appendHistory, loadHistory, loadRunning, newSessionID, remainingSeconds, saveRunning, } from './lib/timer.js';
/**
 * 计时器 —— TypeScript 标准工程的完整范例（AI fork 的起点）。
 *
 * 构建走 `@aibox/applet-tsbuild`：`src/**` 逐文件编译成 `dist/**` 的多文件 ESM，
 * 不打包、不改模块图，所以设备上的文件与这里一一对应、报错行号能对上。
 *
 * 这个应用刻意示范了小应用交付里最容易漏的四件事：
 *  ① **入口是 `src/app.tsx` 的 `export default function App`**，由构建生成的
 *    `dist/index.html` 外壳 `import('./app.js')` 后 `createRoot` 挂载。
 *  ② **能力探测先于渲染**：`haptics` 不在就不渲染相关反馈，而不是点下去报错。
 *  ③ **headless action 与 UI 共用同一份持久化状态**：AI 在页面没打开时调 `start`，
 *    页面下次打开必须看到那个计时——所以真值在 `aibox.storage`，不在 React state。
 *  ④ **布局不写死高度**：读 `scene.safeArea` 与键盘 inset，同一份代码要能在
 *    全屏页 / 半屏 sheet 里都对。
 */
const POLL_MS = 500;
export default function App() {
    const { locale } = useLocale();
    const scene = useScene();
    const keyboard = useKeyboardInset();
    const [running, setRunning] = useState(null);
    const [remaining, setRemaining] = useState(DEFAULT_SECONDS);
    const [history, setHistory] = useState([]);
    const [ready, setReady] = useState(false);
    // 到点时只结算一次：轮询每 500ms 醒一次，没有这个闸门会连写多条历史。
    const settling = useRef(false);
    const refresh = useCallback(async () => {
        const [next, sessions] = await Promise.all([loadRunning(), loadHistory()]);
        setRunning(next);
        setHistory(sessions);
        setRemaining(next ? remainingSeconds(next) : DEFAULT_SECONDS);
    }, []);
    useEffect(() => {
        void refresh().finally(() => setReady(true));
        // action 可能在页面没打开时改了状态，注册时带一个回调把 UI 拉回来。
        registerAppletActions(() => { void refresh(); });
    }, [refresh]);
    // 倒计时：**按墙钟差值算**而不是每秒 -1。后台/锁屏时 setInterval 会被节流，
    // 递减法回到前台就少了一截；差值法永远准。
    useEffect(() => {
        if (!running)
            return undefined;
        const tick = async () => {
            const left = remainingSeconds(running);
            setRemaining(left);
            if (left > 0 || settling.current)
                return;
            settling.current = true;
            await saveRunning(null);
            const sessions = await appendHistory({
                id: newSessionID(),
                label: running.label,
                plannedSeconds: running.plannedSeconds,
                actualSeconds: running.plannedSeconds,
                finishedAt: Date.now(),
                completed: true,
            });
            setHistory(sessions);
            setRunning(null);
            void haptic('success');
            settling.current = false;
        };
        void tick();
        const id = window.setInterval(() => { void tick(); }, POLL_MS);
        return () => window.clearInterval(id);
    }, [running]);
    const start = useCallback(async (seconds) => {
        const next = { label: '专注', plannedSeconds: seconds, startedAt: Date.now() };
        await saveRunning(next);
        setRunning(next);
        setRemaining(seconds);
        void haptic('light');
    }, []);
    const stop = useCallback(async () => {
        if (!running)
            return;
        const left = remainingSeconds(running);
        await saveRunning(null);
        const sessions = await appendHistory({
            id: newSessionID(),
            label: running.label,
            plannedSeconds: running.plannedSeconds,
            actualSeconds: running.plannedSeconds - left,
            finishedAt: Date.now(),
            completed: false,
        });
        setHistory(sessions);
        setRunning(null);
        setRemaining(DEFAULT_SECONDS);
        void haptic('warning');
    }, [running]);
    const safeBottom = scene?.safeArea.bottom ?? 0;
    return (_jsxs("div", { style: { minHeight: '100dvh', display: 'flex', flexDirection: 'column' }, children: [_jsx(NavBar, { back: null, children: "\u8BA1\u65F6\u5668" }), _jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '32px 16px 0' }, children: [_jsx(Dial, { remaining: remaining, planned: running?.plannedSeconds ?? DEFAULT_SECONDS, label: running ? running.label : '准备开始', running: Boolean(running) }), running ? (_jsx(Button, { color: "danger", fill: "outline", size: "large", onClick: () => { void stop(); }, children: "\u505C\u6B62" })) : (_jsx(Space, { wrap: true, justify: "center", children: [5, 15, 25, 45].map((minutes) => (_jsxs(Button, { color: minutes === 25 ? 'primary' : 'default', size: "large", onClick: () => { void start(minutes * 60); }, children: [minutes, " \u5206\u949F"] }, minutes))) })), !isAvailable('haptics') && (_jsx("div", { className: "ax-muted", style: { fontSize: 12 }, children: "\u8FD9\u53F0\u8BBE\u5907\u6CA1\u6709\u89E6\u89C9\u53CD\u9988\uFF0C\u8BA1\u65F6\u7ED3\u675F\u53EA\u6709\u89C6\u89C9\u63D0\u793A\u3002" }))] }), _jsx("div", { style: { marginTop: 24, paddingBottom: safeBottom + keyboard.height }, children: ready && _jsx(HistoryList, { sessions: history, locale: locale }) })] }));
}
