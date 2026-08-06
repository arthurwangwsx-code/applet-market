import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 页面通用零件：空态 / 分段 / chip / 下拉菜单 / 底部面板 / 左滑删除 / 下拉刷新 / 数字输入。
//
// 弹层刻意自绘（不用 antd-mobile 的 Popup / ActionSheet / Toast）——运行时已知
// `Toast.show` 渲染为空，同族命令式弹层风险相同；自绘的 fixed 覆盖层在 WebView 里行为确定。
//
// **触摸手势一律走 SDK**（`useDragGesture`），本文件不再出现任何 `onTouch*`。
// 理由见 SDK `react/gestures.ts` 文件头：`touchcancel` 只有原生手势抢走触摸时才发，
// 浏览器里测不出来，手搓必漏——2026-08-06 实测本应用与资讯各自手搓、各自写错，错法还相反
//（这边是根本没接、状态永不复位，那边是当成 end 直接误提交一次翻页）。
import React from 'react';
import { useDragGesture } from '../lib/aibox-sdk-react.js';
import Icon from './Icon.js';
import { C, RADIUS, SPACE } from './theme.js';
export function Spinner({ size = 16, color = 'currentColor' }) {
    return (_jsxs("svg", { className: "fin-spin", viewBox: "0 0 24 24", width: size, height: size, style: { display: 'block', color }, children: [_jsx("circle", { cx: "12", cy: "12", r: "9", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeOpacity: "0.22" }), _jsx("path", { d: "M21 12a9 9 0 0 0-9-9", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round" })] }));
}
export function EmptyState({ icon, text, actionLabel, onAction, padding = 48 }) {
    return (_jsxs("div", { style: {
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            padding: `${padding}px 32px`, textAlign: 'center',
        }, children: [icon ? _jsx(Icon, { name: icon, size: 34, color: C.muted }) : null, _jsx("span", { style: { fontSize: 15, color: C.muted, lineHeight: 1.4 }, children: text }), actionLabel ? (_jsx("button", { type: "button", className: "fin-btn fin-press", onClick: onAction, style: { color: C.brand, fontSize: 15 }, children: actionLabel })) : null] }));
}
/** 卡壳：标题 13pt muted（+ 可选副标题）+ surface 内容块。 */
export function Card({ title, subtitle, trailing, children, padding = SPACE.s3, style }) {
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, ...style }, children: [(title || trailing) ? (_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8 }, children: [title ? _jsx("span", { style: { fontSize: 13, color: C.muted }, children: title }) : null, subtitle ? _jsx("span", { style: { fontSize: 12, color: C.muted }, children: subtitle }) : null, _jsx("span", { style: { flex: '1 1 auto' } }), trailing] })) : null, _jsx("div", { style: { background: C.surface, borderRadius: RADIUS.card, padding }, children: children })] }));
}
/** 标签 / 值的一格（指标网格、stat 行共用）。 */
export function Stat({ label, value, color, valueSize = 15, align = 'flex-start' }) {
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2, alignItems: align, minWidth: 0 }, children: [_jsx("span", { style: { fontSize: 12, color: C.muted }, children: label }), _jsx("span", { className: "fin-mono", style: { fontSize: valueSize, fontWeight: 500, color: color || C.ink }, children: value })] }));
}
/**
 * chip：12pt（选中 semibold）。两套配色——
 * 行业页用 brand 字 + brand 12% 底；自选分组条用 ink 字 + surface 底 + muted 25% 描边。
 */
export function Chip({ label, selected, onClick, variant = 'brand' }) {
    const brandStyle = selected
        ? { color: C.brand, background: 'color-mix(in srgb, var(--fin-brand) 12%, transparent)', border: '0' }
        : { color: C.muted, background: C.surface, border: '0' };
    const plainStyle = selected
        ? { color: C.ink, background: C.surface, border: '0' }
        : { color: C.muted, background: 'transparent', border: '1px solid color-mix(in srgb, var(--fin-muted) 25%, transparent)' };
    const skin = variant === 'brand' ? brandStyle : plainStyle;
    return (_jsx("button", { type: "button", className: "fin-btn fin-press", onClick: onClick, style: {
            flex: '0 0 auto',
            padding: variant === 'brand' ? '5px 10px' : '7px 12px',
            borderRadius: RADIUS.pill,
            fontSize: 12,
            fontWeight: selected ? 600 : 400,
            whiteSpace: 'nowrap',
            ...skin,
        }, children: label }));
}
/** 横向 chip 条（指数条、分组条、行业 toggle 共用的滚动容器）。 */
export function ChipRow({ children, padding = SPACE.s4, gap = SPACE.s2, style }) {
    return (_jsx("div", { className: "fin-hscroll", style: { display: 'flex', gap, padding: `0 ${padding}px`, ...style }, children: children }));
}
/** 分段控件（行业页的板块/资金/龙虎）。 */
export function Segmented({ items, value, onChange }) {
    return (_jsx("div", { style: {
            display: 'flex', background: 'color-mix(in srgb, var(--fin-muted) 12%, transparent)',
            borderRadius: 9, padding: 2, gap: 2,
        }, children: items.map((item) => (_jsx("button", { type: "button", className: "fin-btn fin-press", onClick: () => onChange(item.id), style: {
                flex: '1 1 0', textAlign: 'center', padding: '6px 4px', borderRadius: 7, fontSize: 13,
                fontWeight: value === item.id ? 600 : 400,
                color: C.ink,
                background: value === item.id ? C.surface : 'transparent',
                boxShadow: value === item.id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }, children: item.label }, item.id))) }));
}
/** 下拉菜单（详情页的周期/复权/指标；自选页的排序）。 */
export function Menu({ icon, label, items, value, onSelect, align = 'left', trailing }) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);
    React.useEffect(() => {
        if (!open)
            return undefined;
        const close = (event) => { if (ref.current && !ref.current.contains(event.target))
            setOpen(false); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [open]);
    return (_jsxs("div", { ref: ref, style: { position: 'relative', flex: '0 0 auto' }, children: [_jsxs("button", { type: "button", className: "fin-btn fin-press", onClick: () => setOpen((current) => !current), style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.ink }, children: [icon ? _jsx(Icon, { name: icon, size: 12, color: C.muted }) : null, _jsx("span", { children: label }), trailing === undefined ? _jsx(Icon, { name: "chevron.down", size: 10, color: C.muted }) : trailing] }), open ? (_jsx("div", { style: {
                    position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 30, minWidth: 132,
                    background: C.surface, borderRadius: 12, padding: 4,
                    boxShadow: '0 8px 28px rgba(0,0,0,0.22)', border: `0.5px solid ${C.line}`,
                }, children: items.map((item) => (item.divider ? (_jsx("div", { style: { height: 0.5, background: C.line, margin: '4px 8px' } }, item.id)) : (_jsxs("button", { type: "button", className: "fin-btn fin-press", disabled: item.disabled, onClick: () => { setOpen(false); onSelect(item.id); }, style: {
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '9px 10px', borderRadius: 8, fontSize: 14,
                        color: item.disabled ? C.muted : C.ink,
                        opacity: item.disabled ? 0.5 : 1,
                    }, children: [_jsx("span", { style: { flex: '1 1 auto' }, children: item.label }), value === item.id ? _jsx(Icon, { name: "checkmark.circle.fill", size: 14, color: C.brand }) : null] }, item.id)))) })) : null] }));
}
// MARK: - 底部面板
export function Sheet({ visible, onClose, children, maxHeight = '86dvh' }) {
    const [mounted, setMounted] = React.useState(visible);
    React.useEffect(() => {
        if (visible) {
            setMounted(true);
            return undefined;
        }
        const timer = window.setTimeout(() => setMounted(false), 200);
        return () => window.clearTimeout(timer);
    }, [visible]);
    if (!mounted)
        return null;
    return (_jsx("div", { className: "fin-sheet-backdrop", style: { opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }, onClick: onClose, children: _jsxs("div", { onClick: (event) => event.stopPropagation(), style: {
                width: '100%', background: C.bg,
                borderTopLeftRadius: 16, borderTopRightRadius: 16,
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
                transform: visible ? 'translateY(0)' : 'translateY(16px)',
                transition: 'transform 200ms ease',
                maxHeight,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
            }, children: [_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: '8px 0 4px', flex: '0 0 auto' }, children: _jsx("span", { style: { width: 36, height: 5, borderRadius: 3, background: 'color-mix(in srgb, var(--fin-muted) 40%, transparent)' } }) }), children] }) }));
}
export function SheetHeader({ title, onClose, closeLabel, trailing }) {
    return (_jsxs("div", { style: {
            display: 'flex', alignItems: 'center', gap: 8, padding: `4px ${SPACE.s4}px 10px`,
            borderBottom: `0.5px solid ${C.line}`, flex: '0 0 auto',
        }, children: [_jsx("span", { style: { fontSize: 17, fontWeight: 500, flex: '1 1 auto' }, children: title }), trailing, onClose ? (_jsx("button", { type: "button", className: "fin-btn fin-press", onClick: onClose, style: { color: C.brand, fontSize: 15 }, children: closeLabel })) : null] }));
}
// MARK: - 数字输入
//
// `inputMode="decimal"` 让 iOS 弹小数键盘（对齐原生的 decimalPad）。
export function Field({ label, value, onChange, placeholder, suffix, numeric = true, autoFocus }) {
    return (_jsxs("label", { style: {
            display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: '11px 0', minHeight: 44,
            borderBottom: `0.5px solid ${C.line}`,
        }, children: [_jsx("span", { style: { fontSize: 15, color: C.ink, flex: '0 0 auto', minWidth: 76 }, children: label }), _jsx("input", { className: "fin-field", style: { textAlign: 'right' }, inputMode: numeric ? 'decimal' : 'text', value: value, autoFocus: autoFocus, placeholder: placeholder, onChange: (event) => onChange(event.target.value) }), suffix ? _jsx("span", { style: { fontSize: 13, color: C.muted, flex: '0 0 auto' }, children: suffix }) : null] }));
}
export function Toggle({ checked, onChange, label, disabled }) {
    return (_jsx("button", { type: "button", role: "switch", "aria-checked": checked, "aria-label": label, disabled: disabled, className: "fin-btn fin-press", onClick: (event) => { event.stopPropagation(); if (!disabled)
            onChange(!checked); }, style: {
            width: 46, height: 28, borderRadius: 14, flex: '0 0 auto', padding: 2,
            opacity: disabled ? 0.45 : 1,
            background: checked ? C.green : 'color-mix(in srgb, var(--fin-muted) 32%, transparent)',
            transition: 'background 180ms ease',
        }, children: _jsx("span", { style: {
                display: 'block', width: 24, height: 24, borderRadius: 12, background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
                transform: `translateX(${checked ? 18 : 0}px)`,
                transition: 'transform 180ms ease',
            } }) }));
}
/** 设置/列表里的一行。 */
export function Row({ icon, title, subtitle, detail, detailColor, accessory, onClick, danger, last }) {
    const Element = onClick ? 'button' : 'div';
    return (_jsxs(Element, { className: onClick ? 'fin-btn fin-press' : undefined, onClick: onClick, style: {
            display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%',
            padding: '11px 0', minHeight: 44,
            borderBottom: last ? 'none' : `0.5px solid ${C.line}`,
            background: 'transparent',
        }, children: [icon ? _jsx(Icon, { name: icon, size: 17, color: C.muted }) : null, _jsxs("div", { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("span", { style: { fontSize: 15, color: danger ? C.danger : C.ink }, children: title }), subtitle ? _jsx("span", { className: "fin-clamp-1", style: { fontSize: 12, color: C.muted }, children: subtitle }) : null] }), detail !== undefined && detail !== null ? (_jsx("span", { className: "fin-mono", style: { fontSize: 15, color: detailColor || C.muted, flex: '0 0 auto' }, children: detail })) : null, accessory, onClick && accessory === undefined ? _jsx(Icon, { name: "chevron.right", size: 13, color: C.muted }) : null] }));
}
// MARK: - 左滑删除（自选行始终可用）
export function SwipeRow({ children, actionLabel, onAction, disabled }) {
    const [offset, setOffset] = React.useState(0);
    const [animating, setAnimating] = React.useState(false);
    // 手势起点的基准偏移与实时偏移都放 ref：处理器身份稳定，读到的永远是最新值而不是闭包快照。
    const base = React.useRef(0);
    const live = React.useRef(0);
    const WIDTH = 82;
    const settle = React.useCallback((value) => {
        live.current = value;
        setAnimating(true);
        setOffset(value);
        window.setTimeout(() => setAnimating(false), 200);
    }, []);
    // 横向轴锁 + 6px slop + 锁定后才 preventDefault，与迁移前逐条一致；
    // `touchcancel` 由 SDK 定死成「弹回原位、不提交」，这里不需要（也不该）再写一遍。
    const { handlers } = useDragGesture({
        axis: 'x',
        onStart: () => { base.current = live.current; },
        onDrag: ({ dx }) => {
            const next = Math.max(-WIDTH, Math.min(0, base.current + dx));
            live.current = next;
            setOffset(next);
        },
        onEnd: () => settle(live.current < -WIDTH / 2 ? -WIDTH : 0),
        onCancel: () => settle(0),
    });
    if (disabled)
        return children;
    return (_jsxs("div", { style: { position: 'relative', overflow: 'hidden' }, children: [_jsx("button", { type: "button", className: "fin-btn fin-press", onClick: () => { settle(0); onAction(); }, style: {
                    position: 'absolute', top: 0, right: 0, bottom: 0, width: WIDTH,
                    background: C.danger, color: '#fff', fontSize: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }, children: actionLabel }), _jsx("div", { ...handlers, style: {
                    transform: `translate3d(${offset}px, 0, 0)`,
                    transition: animating ? 'transform 200ms ease' : 'none',
                    background: C.bg,
                    position: 'relative',
                }, children: children })] }));
}
// MARK: - 下拉刷新
export function PullRefresh({ onRefresh, refreshing, children, scrollRef, style }) {
    const [pull, setPull] = React.useState(0);
    const live = React.useRef(0);
    const THRESHOLD = 64;
    // `lock: 'none'`：下拉刷新本来就只读 dy、不与横向竞争，也不抢事件（`preventDefault` 关掉）。
    // 迁移前这里没有方向锁，保持一致——加锁会改掉既有观感，而这不是本次要改的东西。
    const { handlers, dragging } = useDragGesture({
        axis: 'y',
        lock: 'none',
        preventDefaultWhenLocked: false,
        canStart: () => Boolean(scrollRef.current) && scrollRef.current.scrollTop <= 0 && !refreshing,
        onDrag: ({ dy }) => {
            const next = dy <= 0 ? 0 : Math.min(96, dy * 0.5);
            live.current = next;
            setPull(next);
        },
        onEnd: () => {
            if (live.current >= THRESHOLD)
                onRefresh();
            live.current = 0;
            setPull(0);
        },
        // 放弃：收起下拉区，**绝不触发刷新**（用户并没有完成这次下拉，那一下属于别的手势）。
        onCancel: () => { live.current = 0; setPull(0); },
    });
    return (_jsxs("div", { ref: scrollRef, className: "fin-scroll", style: style, ...handlers, children: [_jsx("div", { style: {
                    height: refreshing ? 40 : pull,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: dragging ? 'none' : 'height 200ms ease',
                    overflow: 'hidden', color: C.muted,
                }, children: refreshing || pull > 8 ? _jsx(Spinner, { size: 18, color: C.brand }) : null }), children] }));
}
