import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Icon from './Icon.js';
import { C, RADIUS, SPACE } from './theme.js';
export function Card({ children, padding = SPACE.s4, style, }) {
    return (_jsx("div", { style: {
            background: C.surface,
            borderRadius: RADIUS.card,
            border: `1px solid ${C.line}`,
            padding,
            overflow: 'hidden',
            ...style,
        }, children: children }));
}
export function SectionHeader({ children, trailing }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: `0 4px ${SPACE.s2}px` }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }, children: children }), _jsx("div", { style: { flex: '1 1 auto' } }), trailing] }));
}
export function EmptyState({ icon, title, hint, action, }) {
    return (_jsxs("div", { style: { textAlign: 'center', padding: `${SPACE.s6 * 2}px ${SPACE.s5}px`, color: C.muted }, children: [_jsx("div", { style: { display: 'flex', justifyContent: 'center', marginBottom: SPACE.s3, opacity: 0.55 }, children: _jsx(Icon, { name: icon, size: 44 }) }), _jsx("div", { style: { fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: SPACE.s2 }, children: title }), _jsx("div", { style: { fontSize: 14, lineHeight: 1.5, maxWidth: 300, margin: '0 auto' }, children: hint }), action ? _jsx("div", { style: { marginTop: SPACE.s4 }, children: action }) : null] }));
}
export function Button({ children, onClick, kind = 'plain', disabled, icon, block, style, }) {
    const tone = {
        primary: { background: C.brand, color: C.onAccent, border: 'none' },
        danger: { background: 'transparent', color: C.failed, border: `1px solid ${C.line}` },
        plain: { background: 'transparent', color: C.ink, border: `1px solid ${C.line}` },
    }[kind];
    return (_jsxs("button", { type: "button", onClick: onClick, disabled: disabled, style: {
            display: block ? 'flex' : 'inline-flex',
            width: block ? '100%' : undefined,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight: 40,
            padding: `0 ${SPACE.s4}px`,
            borderRadius: RADIUS.control,
            opacity: disabled ? 0.4 : 1,
            cursor: disabled ? 'default' : 'pointer',
            fontSize: 15,
            fontWeight: 500,
            ...tone,
            ...style,
        }, children: [icon ? _jsx(Icon, { name: icon, size: 17 }) : null, children] }));
}
/** 圆角小按钮（行内动作）。触区 ≥ 36×36：低于这个数在真机上就是「图标点不动」。 */
export function IconButton({ name, onClick, color, label, }) {
    return (_jsx("button", { type: "button", onClick: onClick, "aria-label": label, title: label, style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 18,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: color || C.muted,
            padding: 0,
        }, children: _jsx(Icon, { name: name, size: 20 }) }));
}
export function Chip({ children, active, onClick, }) {
    return (_jsx("button", { type: "button", onClick: onClick, style: {
            padding: '6px 14px',
            borderRadius: RADIUS.chip,
            border: `1px solid ${active ? 'transparent' : C.line}`,
            background: active ? C.brand : 'transparent',
            color: active ? C.onAccent : C.muted,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
        }, children: children }));
}
/** 进度条。`fraction == null` 时画成不确定态（半宽条纹）——不要假装 0%。 */
export function ProgressBar({ fraction, color }) {
    const determinate = typeof fraction === 'number' && Number.isFinite(fraction);
    return (_jsx("div", { style: { height: 4, borderRadius: 2, background: C.track, overflow: 'hidden' }, children: _jsx("div", { style: {
                height: '100%',
                width: determinate ? `${Math.max(0, Math.min(1, fraction)) * 100}%` : '35%',
                background: color || C.running,
                borderRadius: 2,
                transition: determinate ? 'width 220ms linear' : 'none',
                opacity: determinate ? 1 : 0.6,
            } }) }));
}
/** 底部 sheet。宿主的原生 sheet 呈现是**整个 applet 的容器形态**，不能用来开一个内部面板。 */
export function Sheet({ open, title, onClose, children, footer, }) {
    if (!open)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0,0,0,0.42)',
            display: 'flex',
            alignItems: 'flex-end',
        }, onClick: onClose, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), style: {
                width: '100%',
                maxHeight: '86vh',
                overflowY: 'auto',
                background: C.surface,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: `${SPACE.s4}px ${SPACE.s4}px calc(${SPACE.s5}px + env(safe-area-inset-bottom))`,
                boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: SPACE.s3 }, children: [_jsx("span", { style: { fontSize: 17, fontWeight: 600 }, children: title }), _jsx("div", { style: { flex: '1 1 auto' } }), _jsx(IconButton, { name: "xmark", onClick: onClose, label: "\u5173\u95ED" })] }), children, footer ? _jsx("div", { style: { marginTop: SPACE.s4 }, children: footer }) : null] }) }));
}
/** 一行文字提示条（替代 Toast——运行时已知 antd-mobile 的 Toast.show 渲染为空）。 */
export function Notice({ text, tone = 'info', onDismiss, }) {
    if (!text)
        return null;
    const color = tone === 'error' ? C.failed : tone === 'success' ? C.done : C.brand;
    return (_jsx("div", { onClick: onDismiss, style: {
            margin: `0 ${SPACE.s4}px ${SPACE.s3}px`,
            padding: `${SPACE.s2}px ${SPACE.s3}px`,
            borderRadius: RADIUS.control,
            border: `1px solid ${color}`,
            color,
            fontSize: 13,
            cursor: 'pointer',
        }, children: text }));
}
