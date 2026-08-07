import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Icon from './Icon.js';
import { C, SPACE } from './theme.js';
/** 宿主没渲染顶栏，或处在下钻页时的自绘导航栏。 */
export function Header({ title, onBack, onMenu, transparent = false, }) {
    const tint = transparent ? '#fff' : C.ink;
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: `10px ${SPACE.s4}px`,
            flex: '0 0 auto',
            background: transparent ? 'transparent' : C.bg,
            position: transparent ? 'absolute' : 'relative',
            left: 0,
            right: 0,
            zIndex: 2,
        }, children: [_jsx("div", { style: { width: 40 }, children: onBack ? (_jsx("button", { type: "button", className: "mu-btn mu-press", onClick: onBack, children: _jsx(Icon, { name: "chevron.backward", size: 18, color: transparent ? '#fff' : C.accent }) })) : null }), _jsx("span", { style: { flex: '1 1 auto', textAlign: 'center', fontSize: 17, fontWeight: 600, color: tint }, children: title }), _jsx("div", { style: { width: 40, display: 'flex', justifyContent: 'flex-end' }, children: onMenu ? (_jsx("button", { type: "button", className: "mu-btn mu-press", onClick: onMenu, "aria-label": "musicMoreMenu", children: _jsx(Icon, { name: "ellipsis", size: 20, color: tint }) })) : null })] }));
}
/** 宿主没渲染 tabBar 时的自绘底栏。 */
export function TabBar({ items, selected, onSelect, t, }) {
    return (_jsx("div", { style: {
            display: 'flex',
            flex: '0 0 auto',
            borderTop: `0.5px solid ${C.line}`,
            background: C.glass,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            paddingBottom: 'env(safe-area-inset-bottom)',
        }, children: items.map((item) => (_jsxs("button", { type: "button", className: "mu-btn mu-press", onClick: () => onSelect(item.id), "aria-label": `audioTab_${item.id}`, style: {
                flex: '1 1 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '7px 0 5px',
                color: selected === item.id ? C.accent : C.muted,
            }, children: [_jsx(Icon, { name: item.icon, size: 22 }), _jsx("span", { style: { fontSize: 10 }, children: t(item.titleKey) })] }, item.id))) }));
}
/** 屏幕底部的短提示条（电台不支持、播放失败原因等）。 */
export function Notice({ message }) {
    if (!message)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: 96,
            padding: '10px 14px',
            borderRadius: 12,
            background: 'rgba(60,60,60,0.86)',
            color: '#fff',
            fontSize: 13,
            zIndex: 70,
            textAlign: 'center',
        }, children: message }));
}
