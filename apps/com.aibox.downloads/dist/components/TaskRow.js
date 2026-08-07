import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Icon from './Icon.js';
import { IconButton, ProgressBar } from './primitives.js';
import { C, SPACE, formatBytes, formatETA, formatSpeed, stateColor } from './theme.js';
const STATE_LABEL = {
    queued: '排队中',
    running: '下载中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
};
/** 副标题：把「多少 / 多快 / 还要多久」压成一行，缺哪项就不写哪项，不留占位符。 */
function subtitle(task) {
    const parts = [];
    if (task.state === 'completed') {
        if (task.totalBytes || task.bytesReceived)
            parts.push(formatBytes(task.totalBytes || task.bytesReceived));
        if (task.outputPath)
            parts.push(task.outputPath.split('/').slice(-2).join('/'));
        return parts.join(' · ');
    }
    if (task.state === 'failed')
        return task.error || '下载失败';
    if (task.state === 'cancelled')
        return '已取消';
    if (task.totalBytes)
        parts.push(`${formatBytes(task.bytesReceived || 0)} / ${formatBytes(task.totalBytes)}`);
    else if (task.bytesReceived)
        parts.push(formatBytes(task.bytesReceived));
    const speed = formatSpeed(task.speed);
    if (speed && task.state === 'running')
        parts.push(speed);
    const eta = formatETA(task.eta);
    if (eta && task.state === 'running')
        parts.push(`剩 ${eta}`);
    if (!parts.length)
        parts.push(STATE_LABEL[task.state] || task.state);
    return parts.join(' · ');
}
export default function TaskRow({ task, onPause, onResume, onCancel, onRemove, onOpen, onShare }) {
    const color = stateColor(task.state);
    const running = task.state === 'running' || task.state === 'queued';
    const resumable = task.state === 'paused' || task.state === 'failed';
    const finished = ['completed', 'failed', 'cancelled'].includes(task.state);
    const percent = typeof task.fraction === 'number' ? `${Math.round(task.fraction * 100)}%` : '';
    return (_jsxs("div", { "data-row-id": task.taskId, style: { padding: `${SPACE.s3}px ${SPACE.s4}px` }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s3 }, children: [_jsx(Icon, { name: task.state === 'completed'
                            ? 'checkmark.circle.fill'
                            : task.state === 'failed'
                                ? 'exclamationmark.triangle'
                                : task.state === 'paused'
                                    ? 'pause.circle'
                                    : 'arrow.down.circle', size: 24, color: color }), _jsxs("div", { style: { flex: '1 1 auto', minWidth: 0 }, children: [_jsx("div", { style: {
                                    fontSize: 15,
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }, children: task.filename }), _jsx("div", { style: {
                                    fontSize: 12.5,
                                    color: task.state === 'failed' ? C.failed : C.muted,
                                    marginTop: 2,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }, children: subtitle(task) })] }), percent && !finished ? (_jsx("span", { style: { fontSize: 12.5, color: C.muted, fontVariantNumeric: 'tabular-nums' }, children: percent })) : null, running ? _jsx(IconButton, { name: "pause", onClick: () => onPause(task), label: "\u6682\u505C" }) : null, resumable ? _jsx(IconButton, { name: "play", onClick: () => onResume(task), label: "\u7EE7\u7EED" }) : null, !finished ? _jsx(IconButton, { name: "xmark", onClick: () => onCancel(task), label: "\u53D6\u6D88" }) : null, task.state === 'completed' && onOpen ? (_jsx(IconButton, { name: "doc.text", onClick: () => onOpen(task), label: "\u6253\u5F00" })) : null, task.state === 'completed' && onShare ? (_jsx(IconButton, { name: "square.and.arrow.up", onClick: () => onShare(task), label: "\u5206\u4EAB" })) : null, finished ? _jsx(IconButton, { name: "trash", onClick: () => onRemove(task), label: "\u5220\u9664\u8BB0\u5F55" }) : null] }), !finished ? (_jsx("div", { style: { marginTop: SPACE.s2, marginLeft: 24 + SPACE.s3 }, children: _jsx(ProgressBar, { fraction: task.fraction, color: color }) })) : null] }));
}
