import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 录音面板（规格 §3）—— **录音界面不是 Tab，是从列表页底部 FAB 弹出的 sheet**；
// 而且是「先真正起录成功，才弹面板」，不是「弹面板再让用户点录音」。
//
// 自上而下：标题输入 / 环境行 / 实时滚动波形 / 百分秒计时 / 已暂停标 / 控制排。
import { useEffect, useRef, useState } from 'react';
import { clockCentis } from '../lib/format.js';
import { haptic, recordCancel, recordPause, recordResume, recordStatus, recordStop } from '../lib/memos.js';
import { SPACE } from '../lib/theme.js';
import { Icon, Sheet } from './primitives.js';
/** 20 Hz —— 与底座的采样率一致，即便以更低频率轮询也不会丢样本（环形缓冲有 6 秒余量）。 */
const POLL_MS = 50;
/** 环形缓冲最多 120 个样本（20 Hz × 6 秒）。 */
const MAX_SAMPLES = 120;
export function RecordSheet(props) {
    const { palette, t } = props;
    const [elapsed, setElapsed] = useState(0);
    const [levels, setLevels] = useState([]);
    const [paused, setPaused] = useState(false);
    const [recording, setRecording] = useState(true);
    useEffect(() => {
        if (!props.open) {
            setElapsed(0);
            setLevels([]);
            setPaused(false);
            setRecording(true);
            return;
        }
        let alive = true;
        const timer = window.setInterval(async () => {
            const status = await recordStatus();
            if (!alive)
                return;
            setElapsed(status.elapsedMs);
            setLevels(status.levels.slice(-MAX_SAMPLES));
            setPaused(status.paused);
            setRecording(status.recording);
        }, POLL_MS);
        return () => {
            alive = false;
            window.clearInterval(timer);
        };
    }, [props.open]);
    const stop = async () => {
        // 先给触感再收尾 —— 与原生同序：按下就有反馈，不等落库。
        void haptic('medium');
        const clip = await recordStop();
        if (clip)
            props.onFinish(clip);
        else
            props.onCancel();
    };
    return (_jsxs(Sheet, { palette: palette, open: props.open, 
        // 录音中不能误滑关掉：点遮罩只在已停止时才关（原生是 interactiveDismissDisabled）。
        onClose: () => { if (!recording)
            props.onCancel(); }, children: [_jsx("div", { style: { padding: `${SPACE.s5}px ${SPACE.s5}px ${SPACE.s3}px` }, children: _jsx("input", { value: props.title, onChange: (event) => props.onTitleChange(event.target.value), placeholder: t('recordTitlePlaceholder'), style: {
                        width: '100%', boxSizing: 'border-box', border: 'none', background: 'transparent',
                        textAlign: 'center', fontSize: 17, fontWeight: 600, color: palette.ink, outline: 'none',
                    } }) }), _jsxs("div", { style: { display: 'flex', gap: SPACE.s3, padding: `0 ${SPACE.s5}px ${SPACE.s2}px`, fontSize: 12, color: palette.muted }, children: [_jsxs("span", { style: { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: [_jsx(Icon, { name: "waveform.and.mic", size: 11 }), " ", t('localeAuto')] }), props.backgroundSupported ? _jsx("span", { children: _jsx(Icon, { name: "checkmark.circle", size: 11 }) }) : null] }), _jsx(LiveWaveform, { palette: palette, levels: levels, active: recording && !paused }), _jsx("div", { style: {
                    padding: `${SPACE.s4}px 0`, textAlign: 'center',
                    fontSize: 44, fontWeight: 200, fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    color: recording && !paused ? palette.accent : palette.muted,
                }, children: clockCentis(elapsed) }), paused ? (_jsxs("div", { style: { textAlign: 'center', fontSize: 12, color: palette.muted, marginBottom: SPACE.s2 }, children: [_jsx(Icon, { name: "pause", size: 12 }), " ", t('paused')] })) : null, _jsxs("div", { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: SPACE.s6, paddingBottom: SPACE.s6 }, children: [_jsx("button", { type: "button", onClick: async () => {
                            if (paused)
                                await recordResume();
                            else
                                await recordPause();
                        }, "aria-label": paused ? t('resume') : t('pause'), style: {
                            width: 56, height: 56, borderRadius: 28, background: palette.surface,
                            border: `1px solid ${palette.line}`, color: palette.ink, fontSize: 20, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }, children: _jsx(Icon, { name: paused ? 'record.circle' : 'pause', size: 20, color: paused ? palette.red : undefined }) }), _jsx("button", { type: "button", onClick: stop, "aria-label": t('stop'), style: {
                            width: 72, height: 72, borderRadius: 36, background: palette.red, border: 'none',
                            color: '#FFFFFF', fontSize: 22, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }, children: _jsx(Icon, { name: "stop", size: 22, color: "#FFFFFF" }) }), _jsx("button", { type: "button", onClick: async () => {
                            await recordCancel();
                            props.onCancel();
                        }, "aria-label": t('cancel'), style: {
                            width: 56, height: 56, borderRadius: 28, background: 'transparent',
                            border: `1px solid ${palette.line}`, color: palette.muted, fontSize: 15, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }, children: _jsx(Icon, { name: "xmark", size: 18 }) })] })] }));
}
/**
 * 实时滚动波形（规格 §11.2）。
 *
 * 数据源是底座的 `averagePower` 计量，**已经在宿主侧按原生同一条曲线归一到 0…1**
 * （`floorDb=-50`，`pow((db+50)/50, 1.6)`），页面只负责画。
 *
 * 画法逐条对齐：单 `<canvas>`（不是一堆 DOM 节点）、bar 宽 3 间隙 2（step 5）、
 * 条数 = `floor(width/5)`、取最近 count 个、**左侧不足处补 0**（绝不留空缺）、最新样本贴右边缘、
 * 每条高 `max(2, level × height)` **中心锚定**、圆角 = barWidth/2。
 */
function LiveWaveform(props) {
    const ref = useRef(null);
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas)
            return;
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width === 0 || height === 0)
            return;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        const context = canvas.getContext('2d');
        if (!context)
            return;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        const barWidth = 3;
        const step = 5;
        const count = Math.max(1, Math.floor(width / step));
        const tail = props.levels.slice(-count);
        // 左侧补 0，最新样本贴右边缘。
        const padded = [...new Array(Math.max(0, count - tail.length)).fill(0), ...tail];
        context.fillStyle = props.active ? props.palette.red : props.palette.muted;
        context.globalAlpha = props.active ? 1 : 0.4;
        const mid = height / 2;
        for (let index = 0; index < padded.length; index += 1) {
            const level = Math.max(0, Math.min(1, padded[index]));
            const barHeight = Math.max(2, level * height);
            const x = index * step;
            const y = mid - barHeight / 2;
            roundRect(context, x, y, barWidth, barHeight, barWidth / 2);
        }
    }, [props.levels, props.active, props.palette]);
    return (_jsx("div", { style: { padding: `0 ${SPACE.s3}px` }, children: _jsx("canvas", { ref: ref, style: { width: '100%', height: 90, display: 'block' } }) }));
}
function roundRect(context, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + w, y, x + w, y + h, radius);
    context.arcTo(x + w, y + h, x, y + h, radius);
    context.arcTo(x, y + h, x, y, radius);
    context.arcTo(x, y, x + w, y, radius);
    context.closePath();
    context.fill();
}
