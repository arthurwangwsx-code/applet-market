import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 通用小件。刻意不引 antd-mobile 的重组件：这些都只有几十行，
// 自己写能精确控制高度（虚拟列表要求行高可预测）与配色（跟随系统深浅色）。
import React from 'react';
import { C, RADIUS, SPACE } from './theme.js';
/** 分段控件（首页的推荐/热门/排行）。 */
export function Segmented({ items, value, onChange }) {
    return (_jsx("div", { style: {
            display: 'flex',
            gap: SPACE.s2,
            padding: `${SPACE.s2}px ${SPACE.s4}px`,
            overflowX: 'auto',
            background: C.bg,
        }, children: items.map((item) => {
            const active = item.id === value;
            return (_jsx("button", { type: "button", onClick: () => onChange(item.id), style: {
                    flexShrink: 0,
                    border: 'none',
                    padding: `6px ${SPACE.s3}px`,
                    borderRadius: RADIUS.lg,
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    background: active ? C.brand : C.surface,
                    color: active ? '#fff' : C.sub,
                }, children: item.label }, item.id));
        }) }));
}
export function Spinner({ label = '加载中' }) {
    return (_jsxs("div", { style: { padding: SPACE.s6, textAlign: 'center', color: C.faint, fontSize: 13 }, children: [label, "\u2026"] }));
}
/**
 * 空态。**必须区分「没有内容」和「出错了」**——两者混为一谈时，用户看到「暂无内容」
 * 而实际是网络挂了，会以为是 B 站没数据。
 */
export function EmptyState({ title, detail, actionLabel, onAction }) {
    return (_jsxs("div", { style: { padding: `${SPACE.s6}px ${SPACE.s5}px`, textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 15, color: C.text, marginBottom: SPACE.s2 }, children: title }), detail ? (_jsx("div", { style: { fontSize: 13, color: C.faint, lineHeight: 1.5, marginBottom: SPACE.s4 }, children: detail })) : null, actionLabel ? (_jsx("button", { type: "button", onClick: onAction, style: {
                    border: 'none', padding: `8px ${SPACE.s5}px`, borderRadius: RADIUS.lg,
                    background: C.brand, color: '#fff', fontSize: 14,
                }, children: actionLabel })) : null] }));
}
/** 主按钮。 */
export function PrimaryButton({ children, onClick, disabled, block = true }) {
    return (_jsx("button", { type: "button", onClick: onClick, disabled: disabled, style: {
            display: block ? 'block' : 'inline-block',
            width: block ? '100%' : undefined,
            border: 'none',
            padding: `11px ${SPACE.s5}px`,
            borderRadius: RADIUS.md,
            background: disabled ? C.surface : C.brand,
            color: disabled ? C.faint : '#fff',
            fontSize: 15,
            fontWeight: 500,
        }, children: children }));
}
/** 统计数字块（详情页的点赞/投币/收藏）。 */
export function StatItem({ label, value }) {
    return (_jsxs("div", { style: { flex: 1, textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 15, color: C.text, fontVariantNumeric: 'tabular-nums' }, children: value }), _jsx("div", { style: { fontSize: 11, color: C.faint, marginTop: 2 }, children: label })] }));
}
/**
 * 设置开关行。
 *
 * 自己写而不是用 antd-mobile 的 Switch：这一行要同时承载标题、说明和开关，
 * 而说明文字是这些开关能不能被正确理解的关键（「后台播放」和「画中画」的区别
 * 光看标题是说不清的）。
 */
export function SettingSwitch({ title, detail, value, onChange }) {
    return (_jsxs("div", { className: "bl-press", onClick: () => onChange(!value), style: {
            display: 'flex', alignItems: 'flex-start', gap: SPACE.s3,
            padding: `${SPACE.s3}px ${SPACE.s4}px`,
        }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 15, color: C.text }, children: title }), detail ? (_jsx("div", { style: { fontSize: 12, color: C.faint, marginTop: 3, lineHeight: 1.5 }, children: detail })) : null] }), _jsx("div", { style: {
                    width: 44, height: 26, borderRadius: 13, flexShrink: 0, marginTop: 2,
                    background: value ? C.brand : 'rgba(120,120,128,0.32)',
                    transition: 'background 180ms', position: 'relative',
                }, children: _jsx("div", { style: {
                        position: 'absolute', top: 2, left: value ? 20 : 2,
                        width: 22, height: 22, borderRadius: 11, background: '#fff',
                        transition: 'left 180ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    } }) })] }));
}
/** 分组标题。 */
export function SectionTitle({ children }) {
    return (_jsx("div", { style: {
            padding: `${SPACE.s4}px ${SPACE.s4}px ${SPACE.s2}px`,
            fontSize: 13, fontWeight: 600, color: C.sub,
        }, children: children }));
}
