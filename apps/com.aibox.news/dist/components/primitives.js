import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 页面通用零件：空态、分组/行、底部动作面板、长按手势、左滑删除、下拉刷新、增量渲染。
// 弹层刻意自绘（不用 antd-mobile 的 Popup/ActionSheet/Toast）—— 运行时已知 `Toast.show` 渲染为空，
// 同族命令式弹层风险相同；自绘的 fixed 覆盖层在 WebView 里行为确定，也更好对齐本包的设计令牌。
import React from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.js';
import { C, SPACE } from './theme.js';
export function Spinner({ size = 16, color = 'currentColor' }) {
    return (_jsxs("svg", { className: "news-spin", viewBox: "0 0 24 24", width: size, height: size, style: { display: 'block', color }, children: [_jsx("circle", { cx: "12", cy: "12", r: "9", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeOpacity: "0.22" }), _jsx("path", { d: "M21 12a9 9 0 0 0-9-9", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round" })] }));
}
export function EmptyState({ icon, text }) {
    return (_jsxs("div", { style: {
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            padding: '60px 32px', textAlign: 'center',
        }, children: [_jsx(Icon, { name: icon, size: 34, color: C.muted }), _jsx("span", { style: { fontSize: 15, color: C.muted, lineHeight: 1.4 }, children: text })] }));
}
export function SectionHeader({ children }) {
    return (_jsx("div", { style: {
            padding: `${SPACE.s5}px ${SPACE.s4}px 6px`,
            fontSize: 13,
            color: C.muted,
            textTransform: 'none',
        }, children: children }));
}
export function SectionFooter({ children }) {
    return (_jsx("div", { style: { padding: `6px ${SPACE.s4}px ${SPACE.s3}px`, fontSize: 12, color: C.muted, lineHeight: 1.4 }, children: children }));
}
export function Card({ children, style }) {
    return (_jsx("div", { style: {
            background: C.surface,
            borderRadius: 12,
            margin: `0 ${SPACE.s4}px`,
            overflow: 'hidden',
            ...style,
        }, children: children }));
}
/** 设置/列表里的一行：左图标 + 标题（+副标题）+ 右侧内容/箭头。 */
export function Row({ icon, iconColor, title, subtitle, detail, accessory, onClick, danger, last }) {
    const Element = onClick ? 'button' : 'div';
    return (_jsxs(Element, { className: onClick ? 'news-btn news-press' : undefined, onClick: onClick, style: {
            display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%',
            padding: `11px ${SPACE.s4}px`, minHeight: 44,
            borderBottom: last ? 'none' : `0.5px solid ${C.line}`,
            background: 'transparent',
        }, children: [icon ? _jsx(Icon, { name: icon, size: 17, color: iconColor || C.muted }) : null, _jsxs("div", { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("span", { style: { fontSize: 15, color: danger ? C.danger : C.ink }, children: title }), subtitle ? (_jsx("span", { className: "news-clamp-1", style: { fontSize: 12, color: C.muted }, children: subtitle })) : null] }), detail !== undefined && detail !== null ? (_jsx("span", { className: "news-mono", style: { fontSize: 15, color: C.muted, flex: '0 0 auto' }, children: detail })) : null, accessory, onClick && accessory === undefined ? _jsx(Icon, { name: "chevron.right", size: 13, color: C.muted }) : null] }));
}
export function Toggle({ checked, onChange, label, disabled }) {
    return (_jsx("button", { type: "button", role: "switch", "aria-checked": checked, "aria-label": label, disabled: disabled, className: "news-btn news-press", onClick: (event) => { event.stopPropagation(); if (!disabled)
            onChange(!checked); }, style: {
            width: 46, height: 28, borderRadius: 14, flex: '0 0 auto', padding: 2,
            opacity: disabled ? 0.45 : 1,
            background: checked ? C.brand : 'color-mix(in srgb, var(--news-line) 90%, transparent)',
            transition: 'background 180ms ease',
        }, children: _jsx("span", { style: {
                display: 'block', width: 24, height: 24, borderRadius: 12, background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
                transform: `translateX(${checked ? 18 : 0}px)`,
                transition: 'transform 180ms ease',
            } }) }));
}
// MARK: - 底部动作面板
export function Sheet({ visible, onClose, children }) {
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
    // 必须 portal 到 body：分页器轨道带 transform，会给 position:fixed 后代造出新的包含块，
    // 面板留在原位就会跟着轨道被平移 / 裁掉。
    const node = (_jsx("div", { className: "news-sheet-backdrop", style: { opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }, onClick: onClose, children: _jsx("div", { onClick: (event) => event.stopPropagation(), style: {
                width: '100%',
                background: C.surface,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
                transform: visible ? 'translateY(0)' : 'translateY(16px)',
                transition: 'transform 200ms ease',
                maxHeight: '82dvh',
                overflowY: 'auto',
            }, children: children }) }));
    return typeof document !== 'undefined' && document.body ? createPortal(node, document.body) : node;
}
/** 长按菜单 / 选项列表。actions = [{ key, label, icon, danger, onSelect }] */
export function ActionSheet({ visible, title, actions, cancelLabel, onClose }) {
    return (_jsxs(Sheet, { visible: visible, onClose: onClose, children: [title ? (_jsx("div", { style: {
                    padding: `${SPACE.s4}px ${SPACE.s4}px ${SPACE.s2}px`, fontSize: 13, color: C.muted,
                    borderBottom: `0.5px solid ${C.line}`,
                }, children: _jsx("span", { className: "news-clamp-2", children: title }) })) : null, actions.map((action, i) => (_jsxs("button", { type: "button", className: "news-btn news-press", onClick: () => { onClose(); action.onSelect(); }, style: {
                    display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%',
                    padding: `14px ${SPACE.s4}px`,
                    borderBottom: i === actions.length - 1 ? 'none' : `0.5px solid ${C.line}`,
                    color: action.danger ? C.danger : C.ink,
                    fontSize: 16,
                }, children: [_jsx(Icon, { name: action.icon, size: 18 }), _jsx("span", { children: action.label })] }, action.key))), cancelLabel ? (_jsx("button", { type: "button", className: "news-btn news-press", onClick: onClose, style: {
                    display: 'block', width: '100%', padding: `14px ${SPACE.s4}px`, marginTop: 6,
                    borderTop: `6px solid ${C.bg}`, color: C.brand, fontSize: 16, textAlign: 'center',
                }, children: cancelLabel })) : null] }));
}
// MARK: - 长按
const LONG_PRESS_MS = 480;
export function useLongPress(onLongPress, onTap) {
    const state = React.useRef({ timer: null, x: 0, y: 0, fired: false, touched: false, moved: false });
    const clear = () => {
        if (state.current.timer) {
            window.clearTimeout(state.current.timer);
            state.current.timer = null;
        }
    };
    return {
        onTouchStart(event) {
            const touch = event.touches[0];
            state.current.x = touch.clientX;
            state.current.y = touch.clientY;
            state.current.fired = false;
            state.current.touched = true;
            state.current.moved = false;
            clear();
            state.current.timer = window.setTimeout(() => {
                state.current.fired = true;
                onLongPress();
            }, LONG_PRESS_MS);
        },
        onTouchMove(event) {
            const touch = event.touches[0];
            if (Math.abs(touch.clientX - state.current.x) > 8 || Math.abs(touch.clientY - state.current.y) > 8) {
                // 手指走过 8px 就**不再是一次点击**：滚列表 / 横扫切主题时手指恰好落在某一行上，
                // 松手时不能把它当成「点开这篇文章」。只清长按计时器是不够的。
                state.current.moved = true;
                clear();
            }
        },
        onTouchEnd() {
            clear();
            if (!state.current.fired && !state.current.moved && onTap)
                onTap();
        },
        onTouchCancel: clear,
        onContextMenu(event) { event.preventDefault(); },
        onClick() {
            // 触摸设备上 tap 已由 onTouchEnd 处理（iOS 随后还会补一个合成 click，必须吞掉）；
            // 没有发生过触摸时才把 click 当成点击 —— 服务鼠标与辅助技术。
            if (state.current.touched)
                return;
            if (onTap)
                onTap();
        },
    };
}
// MARK: - 左滑删除
export function SwipeRow({ children, actionLabel, onAction, disabled }) {
    const [offset, setOffset] = React.useState(0);
    const [animating, setAnimating] = React.useState(false);
    const state = React.useRef({ active: false, startX: 0, startY: 0, base: 0, lock: null });
    const WIDTH = 88;
    if (disabled)
        return children;
    const settle = (value) => {
        setAnimating(true);
        setOffset(value);
        window.setTimeout(() => setAnimating(false), 200);
    };
    return (_jsxs("div", { style: { position: 'relative', overflow: 'hidden' }, children: [_jsx("button", { type: "button", className: "news-btn news-press", onClick: () => { settle(0); onAction(); }, style: {
                    position: 'absolute', top: 0, right: 0, bottom: 0, width: WIDTH,
                    background: C.danger, color: '#fff', fontSize: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }, children: actionLabel }), _jsx("div", { style: {
                    transform: `translate3d(${offset}px, 0, 0)`,
                    transition: animating ? 'transform 200ms ease' : 'none',
                    background: C.surface,
                    position: 'relative',
                }, onTouchStart: (event) => {
                    const touch = event.touches[0];
                    state.current = { active: true, startX: touch.clientX, startY: touch.clientY, base: offset, lock: null };
                }, onTouchMove: (event) => {
                    if (!state.current.active)
                        return;
                    const touch = event.touches[0];
                    const dx = touch.clientX - state.current.startX;
                    const dy = touch.clientY - state.current.startY;
                    if (state.current.lock === null) {
                        if (Math.abs(dx) < 6 && Math.abs(dy) < 6)
                            return;
                        state.current.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
                    }
                    if (state.current.lock !== 'h')
                        return;
                    if (event.cancelable)
                        event.preventDefault();
                    setOffset(Math.max(-WIDTH, Math.min(0, state.current.base + dx)));
                }, onTouchEnd: () => {
                    if (!state.current.active)
                        return;
                    state.current.active = false;
                    if (state.current.lock !== 'h')
                        return;
                    settle(offset < -WIDTH / 2 ? -WIDTH : 0);
                }, children: children })] }));
}
// MARK: - 下拉刷新
export function PullRefresh({ onRefresh, refreshing, children, scrollRef }) {
    const [pull, setPull] = React.useState(0);
    const state = React.useRef({ active: false, startY: 0 });
    const THRESHOLD = 64;
    return (_jsxs("div", { ref: scrollRef, className: "news-scroll", onTouchStart: (event) => {
            const node = scrollRef.current;
            if (!node || node.scrollTop > 0 || refreshing)
                return;
            state.current = { active: true, startY: event.touches[0].clientY };
        }, onTouchMove: (event) => {
            if (!state.current.active)
                return;
            const dy = event.touches[0].clientY - state.current.startY;
            if (dy <= 0) {
                setPull(0);
                return;
            }
            setPull(Math.min(96, dy * 0.5));
        }, onTouchEnd: () => {
            if (!state.current.active)
                return;
            state.current.active = false;
            if (pull >= THRESHOLD)
                onRefresh();
            setPull(0);
        }, children: [_jsx("div", { style: {
                    height: refreshing ? 40 : pull,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: state.current.active ? 'none' : 'height 200ms ease',
                    overflow: 'hidden', color: C.muted,
                }, children: refreshing || pull > 8 ? _jsx(Spinner, { size: 18, color: C.brand }) : null }), children] }));
}
// MARK: - 增量渲染
/**
 * 一次性全量渲染 300 行 DOM 会明显掉帧；这里按 step 增量挂载（**不是分页**：数据仍是全量，
 * 滚到底自动补渲染，与原生「一次性全量渲染」的可见行为一致）。
 */
export function useIncremental(items, step = 30) {
    const [limit, setLimit] = React.useState(step);
    const sentinel = React.useRef(null);
    React.useEffect(() => { setLimit(step); }, [items, step]);
    React.useEffect(() => {
        const node = sentinel.current;
        if (!node || typeof IntersectionObserver === 'undefined')
            return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setLimit((current) => (current >= items.length ? current : current + step));
            }
        }, { rootMargin: '400px' });
        observer.observe(node);
        return () => observer.disconnect();
    }, [items.length, step]);
    return { visible: items.slice(0, limit), sentinel, hasMore: limit < items.length };
}
