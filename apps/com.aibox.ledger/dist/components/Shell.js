import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 自绘外壳：宿主不渲染 tabBar / toolbar 时（card / sheet / drawer 呈现面）的降级件。
// 宿主渲染时这些一概不出现——底栏顶栏用原生控件才跟系统的滚动收起、安全区、深浅色一致。
import React from 'react';
import Icon from './Icon.js';
import { C, RADIUS, SPACE, fade } from './theme.js';
export function NavBar({ title, onBack, backLabel, trailing }) {
    return (_jsxs("div", { style: {
            display: 'flex', alignItems: 'center', gap: SPACE.s2, flex: '0 0 auto',
            padding: `${SPACE.s2}px ${SPACE.s3}px`, borderBottom: `1px solid ${C.line}`,
            background: C.bg, paddingTop: 'calc(8px + env(safe-area-inset-top))',
        }, children: [_jsx("div", { style: { minWidth: 44 }, children: onBack ? (_jsx("button", { type: "button", className: "lg-btn", onClick: onBack, "aria-label": backLabel, children: _jsx(Icon, { name: "chevron.backward", size: 17, color: C.brand }) })) : null }), _jsx("span", { className: "lg-clamp-1", style: { flex: '1 1 auto', textAlign: 'center', fontSize: 17, fontWeight: 500 }, children: title }), _jsx("div", { style: { minWidth: 44, display: 'flex', justifyContent: 'flex-end', gap: SPACE.s3 }, children: trailing })] }));
}
export function ToolbarButton({ icon, label, onClick, tint }) {
    return (_jsx("button", { type: "button", className: "lg-btn", onClick: onClick, "aria-label": label, children: _jsx(Icon, { name: icon, size: 17, color: tint ?? C.brand }) }));
}
export function TabBar({ items, selected, onSelect }) {
    return (_jsx("div", { style: {
            display: 'flex', flex: '0 0 auto', borderTop: `1px solid ${C.line}`, background: C.bg,
            paddingBottom: 'env(safe-area-inset-bottom)',
        }, children: items.map((item) => {
            const active = item.id === selected;
            return (_jsxs("button", { type: "button", className: "lg-btn", onClick: () => onSelect(item.id), style: {
                    flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 2, padding: '7px 2px 5px', color: active ? C.brand : C.muted,
                }, children: [_jsx(Icon, { name: active ? (item.selectedIcon ?? item.icon) : item.icon, size: 21 }), _jsx("span", { style: { fontSize: 10 }, children: item.title })] }, item.id));
        }) }));
}
/** 底部悬浮 FAB：Capsule，高 52，brand 实底。 */
export function FAB({ label, onClick }) {
    return (_jsx("div", { style: {
            display: 'flex', justifyContent: 'flex-end', flex: '0 0 auto',
            padding: `8px ${SPACE.s4}px`, pointerEvents: 'none',
        }, children: _jsxs("button", { type: "button", className: "lg-btn", onClick: onClick, style: {
                pointerEvents: 'auto', height: 52, borderRadius: 26, background: C.brand, color: C.onAccent,
                display: 'flex', alignItems: 'center', gap: 6, padding: `0 ${SPACE.s5}px`,
                fontSize: 15, fontWeight: 500, boxShadow: '0 3px 8px rgba(0, 0, 0, 0.18)',
            }, children: [_jsx(Icon, { name: "plus", size: 18, color: C.onAccent }), _jsx("span", { children: label })] }) }));
}
/** 顶部只读横幅：canMutate == false 时常驻。 */
export function ReadOnlyBanner({ title, body }) {
    return (_jsxs("div", { style: {
            display: 'flex', alignItems: 'flex-start', gap: SPACE.s2, flex: '0 0 auto',
            background: fade(C.expense, 10), borderBottom: `1px solid ${C.line}`,
            padding: `${SPACE.s2}px ${SPACE.s4}px`,
        }, children: [_jsx(Icon, { name: "externaldrive.badge.exclamationmark", size: 16, color: C.expense }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }, children: [_jsx("span", { style: { fontSize: 14, fontWeight: 500, color: C.ink }, children: title }), _jsx("span", { style: { fontSize: 12, color: C.muted, lineHeight: 1.35 }, children: body })] })] }));
}
/** 删除撤销条：ink 底、高 48。原生**没有自动消失定时器**，这里照抄。 */
export function UndoBar({ message, actionLabel, onUndo, bottomOffset = 0 }) {
    return (_jsx("div", { className: "lg-undo", style: {
            bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))`,
            padding: `0 ${SPACE.s4}px`,
        }, children: _jsxs("div", { style: {
                height: 48, borderRadius: RADIUS.field, background: C.ink,
                display: 'flex', alignItems: 'center', padding: `0 ${SPACE.s4}px`, gap: SPACE.s3,
            }, children: [_jsx("span", { style: { flex: '1 1 auto', fontSize: 14, color: C.bg }, children: message }), _jsx("button", { type: "button", className: "lg-btn", onClick: onUndo, style: { fontSize: 14, fontWeight: 500, color: C.bg }, children: actionLabel })] }) }));
}
/** 搜索框（宿主没渲染 toolbar.search 时的降级件）。 */
export function SearchField({ value, onChange, placeholder }) {
    return (_jsx("div", { style: { padding: `${SPACE.s2}px ${SPACE.s4}px 0`, flex: '0 0 auto' }, children: _jsxs("div", { style: {
                display: 'flex', alignItems: 'center', gap: SPACE.s2, background: C.surface,
                border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 10px',
            }, children: [_jsx(Icon, { name: "line.3.horizontal.decrease.circle", size: 14, color: C.muted }), _jsx("input", { className: "lg-field", style: { fontSize: 15 }, value: value, placeholder: placeholder, onChange: (event) => onChange(event.target.value) }), value ? (_jsx("button", { type: "button", className: "lg-btn", onClick: () => onChange(''), children: _jsx(Icon, { name: "xmark.circle.fill", size: 14, color: C.muted }) })) : null] }) }));
}
