import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Icon from './Icon.js';
import { C, SPACE } from './theme.js';
export function BroadcastNotice({ messageKey, t, onDismiss, }) {
    if (!messageKey)
        return null;
    return (_jsxs("button", { type: "button", className: "news-btn news-press", onClick: onDismiss, style: {
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.s2,
            width: '100%',
            padding: `10px ${SPACE.s4}px`,
            background: C.blur,
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            borderTop: `0.5px solid ${C.line}`,
        }, children: [_jsx(Icon, { name: "exclamationmark.triangle.fill", size: 15, color: C.warning }), _jsx("span", { style: { flex: '1 1 auto', fontSize: 13, color: C.ink, textAlign: 'left' }, children: t(messageKey) }), _jsx(Icon, { name: "xmark", size: 13, color: C.muted })] }));
}
function ControlButton({ icon, size, onClick, disabled, label, }) {
    return (_jsx("button", { type: "button", className: "news-btn news-press", onClick: onClick, disabled: disabled, "aria-label": label, style: {
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: disabled ? C.muted : C.ink,
            opacity: disabled ? 0.4 : 1,
        }, children: _jsx(Icon, { name: icon, size: size }) }));
}
export default function BroadcastBar({ broadcast, t, onOpenCurrent, }) {
    if (!broadcast.active)
        return null;
    const current = broadcast.current;
    const total = broadcast.items.length;
    const position = broadcast.index + 1;
    return (_jsxs("div", { style: {
            flex: '0 0 auto',
            background: C.blur,
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            borderTop: `0.5px solid ${C.line}`,
        }, children: [_jsx("div", { style: { height: 2, background: 'color-mix(in srgb, var(--news-line) 60%, transparent)' }, children: _jsx("div", { style: {
                        height: 2,
                        width: `${Math.round(broadcast.progress * 100)}%`,
                        background: C.brand,
                        transition: 'width 240ms linear',
                    } }) }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: `6px ${SPACE.s3}px` }, children: [_jsxs("button", { type: "button", className: "news-btn news-press", onClick: onOpenCurrent, "aria-label": t('news.broadcast.openCurrent'), style: { display: 'flex', alignItems: 'center', gap: 7, flex: '1 1 auto', minWidth: 0 }, children: [_jsx(Icon, { name: "speaker.wave.2.fill", size: 15, color: C.brand }), _jsxs("span", { style: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, textAlign: 'left' }, children: [_jsx("span", { className: "news-clamp-1", style: { fontSize: 14, fontWeight: 500, color: C.ink }, children: current ? current.title : t('news.broadcast.title') }), _jsx("span", { className: "news-clamp-1 news-mono", style: { fontSize: 12, color: C.muted }, children: `${position}/${total}${current && current.sourceName ? ` · ${current.sourceName}` : ''}` })] })] }), _jsx(ControlButton, { icon: "backward.fill", size: 15, disabled: broadcast.index === 0, onClick: () => broadcast.previous(), label: t('news.broadcast.previous') }), _jsx(ControlButton, { icon: broadcast.playing ? 'pause.fill' : 'play.fill', size: 18, onClick: () => (broadcast.playing ? broadcast.pause() : broadcast.resume()), label: t(broadcast.playing ? 'news.broadcast.pause' : 'news.broadcast.resume') }), _jsx(ControlButton, { icon: "forward.fill", size: 15, disabled: broadcast.index >= total - 1, onClick: () => broadcast.next(), label: t('news.broadcast.next') }), _jsx(ControlButton, { icon: "xmark", size: 15, onClick: () => broadcast.stop({ userInitiated: true }), label: t('news.broadcast.stop') })] })] }));
}
