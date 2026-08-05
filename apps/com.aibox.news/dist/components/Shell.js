import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 外壳降级件。
//
// 正常情况下底部 Tab 与顶部按钮/搜索由宿主渲染（manifest 的 scene.tabBar / scene.toolbar +
// aibox.tabs / aibox.toolbar）。但 card/sheet/drawer 形态不渲染 tabBar、fullscreen 形态没有导航栏，
// 宿主也可能还没装这两个能力 —— 此时 getState().rendered 为假，页面按协议**自己降级**成
// 内部分段控件与自绘搜索框，而不是把导航锁死。
import React from 'react';
import Icon from './Icon.js';
import { C, SPACE } from './theme.js';
/** 自绘顶栏（宿主 toolbar 不可用时）。 */
export function NavBar({ title, onBack, backLabel, trailing }) {
    return (_jsxs("div", { style: {
            display: 'flex', alignItems: 'center', gap: SPACE.s2,
            padding: `0 ${SPACE.s2}px`, height: 44, flex: '0 0 auto',
            background: C.bg, borderBottom: `0.5px solid ${C.line}`,
        }, children: [_jsx("div", { style: { width: 76, display: 'flex', justifyContent: 'flex-start' }, children: onBack ? (_jsxs("button", { type: "button", className: "news-btn news-press", onClick: onBack, "aria-label": backLabel, style: { display: 'flex', alignItems: 'center', gap: 2, color: C.brand, padding: '8px 6px' }, children: [_jsx(Icon, { name: "chevron.left", size: 16 }), _jsx("span", { style: { fontSize: 15 }, children: backLabel })] })) : null }), _jsx("div", { style: {
                    flex: '1 1 auto', textAlign: 'center', fontSize: 17, fontWeight: 500,
                    color: C.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }, children: title }), _jsx("div", { style: { width: 76, display: 'flex', justifyContent: 'flex-end', gap: 2 }, children: trailing })] }));
}
export function ToolbarButton({ icon, onClick, label, tint }) {
    return (_jsx("button", { type: "button", className: "news-btn news-press", onClick: onClick, "aria-label": label, style: {
            width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: tint || C.brand,
        }, children: _jsx(Icon, { name: icon, size: 18 }) }));
}
/** 自绘搜索框（宿主 search 不渲染时）。 */
export function SearchField({ value, onChange, placeholder }) {
    return (_jsx("div", { style: { padding: `${SPACE.s2}px ${SPACE.s4}px`, background: C.bg, flex: '0 0 auto' }, children: _jsxs("div", { style: {
                display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: `0 ${SPACE.s2}px`,
                borderRadius: 10, background: 'color-mix(in srgb, var(--news-line) 45%, transparent)',
            }, children: [_jsx(Icon, { name: "magnifyingglass", size: 15, color: C.muted }), _jsx("input", { value: value, onChange: (event) => onChange(event.target.value), placeholder: placeholder, autoCorrect: "off", autoCapitalize: "none", spellCheck: false, style: {
                        flex: '1 1 auto', minWidth: 0, border: 0, outline: 'none', background: 'transparent',
                        font: 'inherit', fontSize: 15, color: C.ink,
                    } }), value ? (_jsx("button", { type: "button", className: "news-btn news-press", onClick: () => onChange(''), style: { color: C.muted, padding: 4 }, "aria-label": "clear", children: _jsx(Icon, { name: "xmark.circle.fill", size: 15 }) })) : null] }) }));
}
/** 自绘底部 Tab（宿主 tabBar 不渲染时）——悬浮胶囊，与 PluginGlassTabBar 同语言。 */
export function TabBar({ items, selected, onSelect }) {
    return (_jsx("div", { style: {
            flex: '0 0 auto',
            padding: `6px ${SPACE.s4}px calc(env(safe-area-inset-bottom) + 6px)`,
            background: C.blur,
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            borderTop: `0.5px solid ${C.line}`,
            display: 'flex',
        }, children: items.map((item) => {
            const active = item.id === selected;
            return (_jsxs("button", { type: "button", className: "news-btn news-press", onClick: () => onSelect(item.id), style: {
                    flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: '4px 0', color: active ? C.brand : C.muted,
                }, children: [_jsxs("span", { style: { position: 'relative' }, children: [_jsx(Icon, { name: active && item.selectedIcon ? item.selectedIcon : item.icon, size: 22 }), item.badge ? (_jsx("span", { style: {
                                    position: 'absolute', top: -4, right: -10, minWidth: 15, height: 15, padding: '0 4px',
                                    borderRadius: 8, background: C.danger, color: '#fff', fontSize: 10, lineHeight: '15px',
                                    textAlign: 'center',
                                }, children: item.badge })) : null] }), _jsx("span", { style: { fontSize: 10, fontWeight: active ? 600 : 400 }, children: item.title })] }, item.id));
        }) }));
}
