import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Icon from './Icon.js';
import { C, SPACE } from './theme.js';
export function NavBar({ title, onBack, backLabel, trailing, }) {
    return (_jsx("div", { style: {
            position: 'sticky',
            top: 0,
            zIndex: 20,
            flex: '0 0 auto',
            paddingTop: 'env(safe-area-inset-top)',
            background: C.blur,
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            borderBottom: `0.5px solid ${C.line}`,
        }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s2, height: 44, padding: `0 ${SPACE.s3}px` }, children: [onBack ? (_jsx("button", { type: "button", "aria-label": backLabel, className: "fin-btn fin-press", onClick: onBack, style: {
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        flex: '0 0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'color-mix(in srgb, var(--fin-muted) 14%, transparent)',
                        color: C.brand,
                    }, children: _jsx(Icon, { name: "chevron.backward", size: 15, weight: "semibold" }) })) : (_jsx("span", { style: { width: 4 } })), _jsx("span", { className: "fin-clamp-1", style: { flex: '1 1 auto', fontSize: 17, fontWeight: 600, textAlign: 'center' }, children: title }), _jsx("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.s3,
                        flex: '0 0 auto',
                        minWidth: 30,
                        justifyContent: 'flex-end',
                    }, children: trailing })] }) }));
}
export function ToolbarButton({ icon, label, onClick, color, }) {
    return (_jsx("button", { type: "button", "aria-label": label, className: "fin-btn fin-press", onClick: onClick, style: { color: color || C.brand, display: 'flex', alignItems: 'center' }, children: _jsx(Icon, { name: icon, size: 17, weight: "semibold" }) }));
}
export function TabBar({ items, selected, onSelect, }) {
    return (_jsx("div", { style: {
            position: 'sticky',
            bottom: 0,
            flex: '0 0 auto',
            zIndex: 20,
            padding: `6px ${SPACE.s4}px calc(env(safe-area-inset-bottom) + 6px)`,
            background: C.blur,
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            borderTop: `0.5px solid ${C.line}`,
        }, children: _jsx("div", { style: { display: 'flex', gap: 4 }, children: items.map((item) => {
                const active = item.id === selected;
                return (_jsxs("button", { type: "button", className: "fin-btn fin-press", onClick: () => onSelect(item.id), "aria-current": active ? 'page' : undefined, style: {
                        flex: '1 1 0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        padding: '4px 0',
                        color: active ? C.brand : C.muted,
                    }, children: [_jsx(Icon, { name: active && item.selectedIcon ? item.selectedIcon : item.icon, size: 22 }), _jsx("span", { style: { fontSize: 10, fontWeight: active ? 600 : 400 }, children: item.title })] }, item.id));
            }) }) }));
}
/** 顶部常驻搜索框（宿主 `toolbar.search` 未渲染时的降级件）。 */
export function SearchField({ value, onChange, placeholder, autoFocus, trailing, }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, padding: `8px ${SPACE.s4}px`, flex: '0 0 auto' }, children: [_jsxs("div", { style: {
                    flex: '1 1 auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'color-mix(in srgb, var(--fin-muted) 14%, transparent)',
                    borderRadius: 10,
                    padding: '7px 10px',
                }, children: [_jsx(Icon, { name: "magnifyingglass", size: 15, color: C.muted }), _jsx("input", { className: "fin-field", style: { fontSize: 15 }, value: value, autoFocus: autoFocus, placeholder: placeholder, onChange: (event) => onChange(event.target.value) }), value ? (_jsx("button", { type: "button", className: "fin-btn fin-press", onClick: () => onChange(''), style: { color: C.muted }, children: _jsx(Icon, { name: "xmark.circle.fill", size: 15 }) })) : null] }), trailing] }));
}
/**
 * 全局横幅：持久化存储不健康时顶部插一条红条。
 * 此时所有写操作会被拒绝并返回错误——横幅是唯一的可见解释，别省。
 */
export function StorageBanner({ text }) {
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: '0 0 auto',
            padding: `8px ${SPACE.s4}px`,
            background: 'color-mix(in srgb, var(--fin-danger) 10%, transparent)',
            color: C.danger,
        }, children: [_jsx(Icon, { name: "externaldrive.badge.exclamationmark", size: 14 }), _jsx("span", { style: { fontSize: 12, lineHeight: 1.35 }, children: text })] }));
}
