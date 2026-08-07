import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { RADIUS, SPACE, alpha } from '../lib/theme.js';
export function Icon({ name, size = 16, color }) {
    // 宿主的 SF Symbol 不在 WebView 里，用等价的 Unicode/emoji 字形近似（形状对齐，不追像素）。
    return (_jsx("span", { "aria-hidden": true, style: { fontSize: size, lineHeight: 1, color, display: 'inline-block' }, children: GLYPH[name] ?? '•' }));
}
const GLYPH = {
    magnifyingglass: '⌕',
    speaker: '🔊',
    tortoise: '🐢',
    star: '☆',
    'star.fill': '★',
    chevron: '›',
    'chevron.down': '⌄',
    'chevron.up': '⌃',
    sparkles: '✦',
    ear: '👂',
    blank: '␣',
    pencil: '✎',
    mic: '🎙',
    stop: '■',
    check: '✓',
    'checkmark.seal': '✅',
    clipboard: '⧉',
    share: '↑',
    trash: '🗑',
    refresh: '↻',
    globe: '🌐',
    swap: '⇄',
    quote: '❝',
    list: '≡',
    lightbulb: '💡',
    question: '?',
    photo: '🖼',
    viewfinder: '⌗',
    warning: '⚠',
    clock: '🕘',
    shield: '🛡',
    drive: '💾',
    play: '▶',
    book: '📖',
    cards: '🃏',
};
/** `InfoChip`：图标 11pt + 文字 12pt 单行，padding h9/v4，Capsule。 */
export function InfoChip(props) {
    const tint = props.tint ?? props.palette.accent;
    const style = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 9px',
        borderRadius: RADIUS.pill,
        fontSize: 12,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
        border: 'none',
        cursor: props.onClick ? 'pointer' : 'default',
        color: props.filled ? tint : props.palette.muted,
        background: props.filled ? alpha(tint, 0.14) : props.palette.line,
    };
    const content = (_jsxs(_Fragment, { children: [props.icon ? _jsx(Icon, { name: props.icon, size: 11 }) : null, _jsx("span", { children: props.label })] }));
    return props.onClick ? (_jsx("button", { type: "button", style: style, onClick: props.onClick, children: content })) : (_jsx("span", { style: style, children: content }));
}
/** `ChipsFlow` = FlowLayout(spacing 6, lineSpacing 6)。 */
export function ChipsFlow({ children }) {
    return _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6 }, children: children });
}
/** `EmptyStatePlaceholder`：图标 26pt muted×0.7 + 文案 13pt muted 居中，纵向 padding 18。 */
export function EmptyState(props) {
    return (_jsxs("div", { style: { padding: '18px 16px', textAlign: 'center', color: props.palette.muted }, children: [_jsx("div", { style: { opacity: 0.7 }, children: _jsx(Icon, { name: props.icon, size: 26 }) }), _jsx("div", { style: { fontSize: 13, marginTop: SPACE.s2 }, children: props.text })] }));
}
/** `CopyButton`：点击后 1.5s 内变 ✓ + 绿色 + "已复制"。 */
export function CopyButton(props) {
    const [done, setDone] = useState(false);
    useEffect(() => {
        if (!done)
            return;
        const timer = setTimeout(() => setDone(false), 1500);
        return () => clearTimeout(timer);
    }, [done]);
    return (_jsxs("button", { type: "button", style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            border: 'none',
            background: 'transparent',
            padding: 0,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            color: done ? props.palette.green : props.palette.accent,
        }, onClick: async () => {
            if (await props.onCopy())
                setDone(true);
        }, children: [_jsx(Icon, { name: done ? 'check' : 'clipboard', size: 12 }), done ? props.copiedLabel : props.label] }));
}
/** 区头：12pt medium muted 大写。 */
export function SectionHeader(props) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.s2 }, children: [_jsx("div", { style: {
                    fontSize: 12,
                    fontWeight: 500,
                    color: props.palette.muted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                }, children: props.title }), props.trailing] }));
}
/** 主按钮（borderedProminent 等价物）。 */
export function PrimaryButton(props) {
    return (_jsx("button", { type: "button", disabled: props.disabled || props.busy, onClick: props.onClick, style: {
            border: 'none',
            borderRadius: RADIUS.field,
            padding: '11px 18px',
            fontSize: 15,
            fontWeight: 500,
            width: props.block ? '100%' : undefined,
            color: props.palette.onAccent,
            background: props.palette.accent,
            opacity: props.disabled || props.busy ? 0.45 : 1,
            cursor: props.disabled || props.busy ? 'default' : 'pointer',
        }, children: props.busy ? '…' : props.title }));
}
/** 次按钮（.bordered 等价物）。 */
export function SecondaryButton(props) {
    return (_jsxs("button", { type: "button", disabled: props.disabled, onClick: props.onClick, style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: `1px solid ${props.palette.line}`,
            borderRadius: RADIUS.field,
            padding: '8px 14px',
            fontSize: 13,
            background: 'transparent',
            color: props.palette.accent,
            opacity: props.disabled ? 0.4 : 1,
            cursor: props.disabled ? 'default' : 'pointer',
        }, children: [props.icon ? _jsx(Icon, { name: props.icon, size: 12 }) : null, props.title] }));
}
/** 复习提醒条（搜索页与生词本页共用同一款）。 */
export function DueBanner(props) {
    return (_jsxs("button", { type: "button", onClick: props.onClick, style: {
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.s3,
            width: '100%',
            border: 'none',
            background: alpha(props.palette.accent, 0.1),
            color: props.palette.accent,
            borderRadius: RADIUS.field,
            padding: '12px 14px',
            fontSize: 14,
            cursor: 'pointer',
            textAlign: 'left',
        }, children: [_jsx(Icon, { name: "cards", size: 16 }), _jsx("span", { style: { flex: 1 }, children: props.text }), _jsx(Icon, { name: "chevron", size: 14 })] }));
}
/** 卡片容器。 */
export function Card(props) {
    return (_jsx("div", { style: {
            background: props.palette.surface,
            borderRadius: RADIUS.card,
            padding: SPACE.s4,
            ...props.style,
        }, children: props.children }));
}
/** 列表行。点整行触发 onClick，右侧可放独立控件（如朗读按钮，不冒泡）。 */
export function Row(props) {
    const timer = useState({ id: null })[0];
    const start = () => {
        if (!props.onLongPress)
            return;
        timer.id = window.setTimeout(() => props.onLongPress?.(), 550);
    };
    const cancel = () => {
        if (timer.id !== null) {
            window.clearTimeout(timer.id);
            timer.id = null;
        }
    };
    return (_jsxs("div", { role: props.onClick ? 'button' : undefined, onClick: props.onClick, onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel, onContextMenu: (event) => {
            if (!props.onLongPress)
                return;
            event.preventDefault();
            props.onLongPress();
        }, style: {
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.s3,
            padding: '10px 16px',
            cursor: props.onClick ? 'pointer' : 'default',
            borderBottom: `1px solid ${props.palette.line}`,
        }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: {
                            fontSize: 15,
                            fontWeight: 500,
                            color: props.palette.ink,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }, children: props.title }), props.subtitle ? (_jsx("div", { style: {
                            fontSize: 12,
                            color: props.palette.muted,
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }, children: props.subtitle })) : null] }), props.trailing] }));
}
/** 朗读按钮（生词本行 / 复习卡 / 音标 chip 共用）。 */
export function SpeakButton(props) {
    return (_jsx("button", { type: "button", onClick: (event) => {
            event.stopPropagation();
            props.onClick();
        }, style: {
            border: 'none',
            background: 'transparent',
            color: props.palette.accent,
            padding: 6,
            cursor: 'pointer',
            lineHeight: 1,
        }, "aria-label": "Speak", children: _jsx(Icon, { name: "speaker", size: props.size ?? 16 }) }));
}
/** 半浮层（sheet）。原生是 `presentationDetents([.medium])`，这里用底部抽屉近似。 */
export function Sheet(props) {
    if (!props.open)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'flex-end',
            background: 'rgba(0,0,0,0.35)',
        }, onClick: props.onClose, children: _jsxs("div", { onClick: (event) => event.stopPropagation(), style: {
                width: '100%',
                maxHeight: '86dvh',
                overflowY: 'auto',
                background: props.palette.bg,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 'env(safe-area-inset-bottom)',
            }, children: [_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }, children: _jsx("div", { style: { width: 36, height: 5, borderRadius: 3, background: props.palette.line } }) }), props.children] }) }));
}
/** 全屏 push 页（原生是 NavigationStack push；这里用同层覆盖 + 左上返回）。 */
export function PushPage(props) {
    return (_jsxs("div", { style: {
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            background: props.palette.bg,
            display: 'flex',
            flexDirection: 'column',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.s2,
                    padding: '10px 12px',
                    borderBottom: `1px solid ${props.palette.line}`,
                    background: props.palette.bg,
                }, children: [_jsx("button", { type: "button", onClick: props.onBack, style: {
                            border: 'none',
                            background: 'transparent',
                            color: props.palette.accent,
                            fontSize: 17,
                            cursor: 'pointer',
                            padding: '4px 8px',
                        }, "aria-label": "Back", children: "\u2039" }), _jsx("div", { style: {
                            flex: 1,
                            fontSize: 16,
                            fontWeight: 600,
                            color: props.palette.ink,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }, children: props.title }), props.trailing] }), _jsx("div", { style: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }, children: props.children })] }));
}
