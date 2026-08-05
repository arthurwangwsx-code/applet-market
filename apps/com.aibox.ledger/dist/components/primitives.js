import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 页面通用零件：卡片、空态、chip、分段、开关、月份条、进度条、底部 sheet、
// 长按菜单、左右滑操作。
//
// 弹层刻意自绘（不用 antd-mobile 的 Popup/ActionSheet/Toast）——运行时已知 `Toast.show`
// 渲染为空，同族命令式弹层风险相同；自绘的 fixed 覆盖层在 WebView 里行为确定，
// 也更好对齐本包的设计令牌。
import React from 'react';
import Icon from './Icon.js';
import { C, RADIUS, SPACE, fade } from './theme.js';
/** ledgerCard：surface 底 + 16 圆角 + line 描边 + padding 16。 */
export function Card({ children, padding = SPACE.s4, style }) {
    return (_jsx("div", { style: {
            background: C.surface,
            borderRadius: RADIUS.card,
            border: `1px solid ${C.line}`,
            padding,
            overflow: 'hidden',
            ...style,
        }, children: children }));
}
/** 段标题：13 medium muted 全大写。 */
export function SectionHeader({ children, trailing }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: `0 4px ${SPACE.s2}px` }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }, children: children }), _jsx("div", { style: { flex: '1 1 auto' } }), trailing] }));
}
/** 空态：图标 38 light muted / 标题 17 medium ink / 正文 15 muted 居中 / 纵向 padding 32。 */
export function EmptyState({ icon, title, body }) {
    return (_jsxs("div", { style: {
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE.s3,
            padding: `${SPACE.s7}px ${SPACE.s6}px`, textAlign: 'center',
        }, children: [_jsx(Icon, { name: icon, size: 38, color: C.muted }), title ? _jsx("span", { style: { fontSize: 17, fontWeight: 500, color: C.ink }, children: title }) : null, body ? _jsx("span", { style: { fontSize: 15, color: C.muted, lineHeight: 1.45 }, children: body }) : null] }));
}
/** 筛选 chip：文字 12 + chevron.down 9；选中 = brand 字 + brand 12% 底。 */
export function Chip({ label, selected, onClick, showChevron = true }) {
    return (_jsxs("button", { type: "button", className: "lg-btn", onClick: onClick, style: {
            display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 auto',
            padding: '7px 12px', borderRadius: RADIUS.pill,
            border: `1px solid ${C.line}`,
            background: selected ? fade(C.brand, 12) : C.surface,
            color: selected ? C.brand : C.ink,
            fontSize: 12,
        }, children: [_jsx("span", { children: label }), showChevron ? _jsx(Icon, { name: "chevron.down", size: 9 }) : null] }));
}
/** 分段控件（记一笔类型、报表收支、分摊方式）。 */
export function Segmented({ items, value, onChange, disabled }) {
    return (_jsx("div", { style: {
            display: 'flex', background: fade(C.muted, 12), borderRadius: 10, padding: 2,
            opacity: disabled ? 0.5 : 1,
        }, children: items.map((item) => (_jsx("button", { type: "button", className: "lg-btn", disabled: disabled, onClick: () => !disabled && onChange(item.id), style: {
                flex: '1 1 0', textAlign: 'center', padding: '7px 4px', borderRadius: 8,
                background: value === item.id ? C.surface : 'transparent',
                color: value === item.id ? C.ink : C.muted,
                fontSize: 14, fontWeight: value === item.id ? 500 : 400,
                boxShadow: value === item.id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }, children: item.label }, item.id))) }));
}
export function Toggle({ checked, onChange, disabled, tint = C.brand }) {
    return (_jsx("button", { type: "button", className: "lg-btn", role: "switch", "aria-checked": !!checked, disabled: disabled, onClick: () => !disabled && onChange(!checked), style: {
            width: 50, height: 30, borderRadius: 15, flex: '0 0 auto',
            background: checked ? tint : fade(C.muted, 30),
            transition: 'background 0.18s ease', opacity: disabled ? 0.5 : 1, padding: 2,
        }, children: _jsx("span", { style: {
                display: 'block', width: 26, height: 26, borderRadius: 13, background: '#FFFFFF',
                transform: checked ? 'translateX(20px)' : 'none', transition: 'transform 0.18s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            } }) }));
}
/** 月份条：左右箭头 + 月标题；右箭头在 ≥ 当前月时禁用（不能看未来）。 */
export function MonthBar({ title, onPrevious, onNext, nextDisabled }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE.s5 }, children: [_jsx("button", { type: "button", className: "lg-btn", onClick: onPrevious, "aria-label": "previous month", children: _jsx(Icon, { name: "chevron.left", size: 15, color: C.muted }) }), _jsx("span", { style: { fontSize: 16, fontWeight: 500, color: C.ink, minWidth: 120, textAlign: 'center' }, children: title }), _jsx("button", { type: "button", className: "lg-btn", onClick: onNext, disabled: nextDisabled, "aria-label": "next month", style: { opacity: nextDisabled ? 0.3 : 1 }, children: _jsx(Icon, { name: "chevron.right", size: 15, color: C.muted }) })] }));
}
/** 进度条：胶囊，底色 line，宽度 = max(minWidth, 容器宽 × progress)。 */
export function ProgressBar({ progress, height = 10, color, minWidth = 6 }) {
    const ratio = Math.max(0, Number(progress) || 0);
    return (_jsx("div", { style: { position: 'relative', height, borderRadius: height / 2, background: C.line, overflow: 'hidden' }, children: _jsx("div", { style: {
                position: 'absolute', inset: `0 auto 0 0`, height: '100%',
                width: `max(${minWidth}px, ${Math.min(1, ratio) * 100}%)`,
                borderRadius: height / 2, background: color ?? C.brand,
                transition: 'width 0.2s ease',
            } }) }));
}
/** 行间 Divider，可左缩进（原生用 52 / 60）。 */
export function Divider({ inset = 0 }) {
    return _jsx("div", { style: { height: 1, background: C.line, marginLeft: inset } });
}
/** 元信息小卡（记一笔面板里每项都是一张 padding 12 的小卡）。 */
export function FieldCard({ icon, label, children, onClick, style }) {
    const Element = onClick ? 'button' : 'div';
    return (_jsxs(Element, { type: onClick ? 'button' : undefined, className: onClick ? 'lg-btn' : undefined, onClick: onClick, style: {
            display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%',
            background: C.surface, border: `1px solid ${C.line}`, borderRadius: RADIUS.field,
            padding: SPACE.s3, minHeight: 46, ...style,
        }, children: [icon ? _jsx(Icon, { name: icon, size: 15, color: C.muted }) : null, label ? _jsx("span", { style: { fontSize: 15, color: C.muted, flex: '0 0 auto' }, children: label }) : null, _jsx("div", { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', justifyContent: 'flex-end' }, children: children })] }));
}
/** 底部 sheet。`detent` 是内容区高度上限（对应原生的 detent 档位）。 */
export function Sheet({ open, onClose, title, leading, trailing, detent, children }) {
    React.useEffect(() => {
        if (!open)
            return undefined;
        const onKey = (event) => { if (event.key === 'Escape')
            onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open)
        return null;
    return (_jsx("div", { className: "lg-backdrop", onClick: (event) => { if (event.target === event.currentTarget)
            onClose(); }, children: _jsxs("div", { className: "lg-sheet", style: detent ? { height: detent } : undefined, children: [_jsxs("div", { style: {
                        display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: `${SPACE.s3}px ${SPACE.s4}px`,
                        borderBottom: `1px solid ${C.line}`, flex: '0 0 auto',
                    }, children: [_jsx("div", { style: { minWidth: 60 }, children: leading }), _jsx("span", { style: { flex: '1 1 auto', textAlign: 'center', fontSize: 16, fontWeight: 500 }, children: title }), _jsx("div", { style: { minWidth: 60, display: 'flex', justifyContent: 'flex-end' }, children: trailing })] }), _jsx("div", { className: "lg-scroll", style: { padding: SPACE.s4, paddingBottom: `calc(${SPACE.s4}px + env(safe-area-inset-bottom))` }, children: children })] }) }));
}
export function SheetButton({ children, onClick, bold, disabled, danger }) {
    return (_jsx("button", { type: "button", className: "lg-btn", onClick: onClick, disabled: disabled, style: {
            fontSize: 16, fontWeight: bold ? 600 : 400,
            color: disabled ? C.muted : (danger ? C.expense : C.brand),
            opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
        }, children: children }));
}
/** 下拉菜单（筛选 chip、账户/项目选择器共用）。 */
export function Menu({ open, onClose, items, anchorStyle }) {
    if (!open)
        return null;
    return (_jsx("div", { className: "lg-backdrop", style: { alignItems: 'center', justifyContent: 'center' }, onClick: onClose, children: _jsx("div", { style: {
                background: C.surface, borderRadius: RADIUS.card, minWidth: 220, maxWidth: '80vw',
                maxHeight: '60dvh', overflowY: 'auto', margin: SPACE.s4, ...anchorStyle,
            }, onClick: (event) => event.stopPropagation(), children: items.map((item, index) => (_jsxs("button", { type: "button", className: "lg-btn", onClick: () => { onClose(); item.onSelect(); }, style: {
                    display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%',
                    padding: `12px ${SPACE.s4}px`, minHeight: 46,
                    borderTop: index === 0 ? 'none' : `1px solid ${C.line}`,
                    color: item.destructive ? C.expense : C.ink, fontSize: 15,
                }, children: [item.icon ? _jsx(Icon, { name: item.icon, size: 15, color: item.destructive ? C.expense : C.muted }) : null, _jsx("span", { style: { flex: '1 1 auto' }, children: item.label }), item.selected ? _jsx(Icon, { name: "checkmark.circle.fill", size: 16, color: C.brand }) : null] }, item.id ?? index))) }) }));
}
/**
 * 长按上下文菜单（原生的 contextMenu）。500ms 触发，移动 > 10px 取消。
 * 用在账户行、项目行、成员行、币种行、项目流水行。
 */
export function useLongPress(onLongPress, { delay = 500 } = {}) {
    const timer = React.useRef(null);
    const origin = React.useRef(null);
    const fired = React.useRef(false);
    const clear = () => {
        if (timer.current) {
            window.clearTimeout(timer.current);
            timer.current = null;
        }
    };
    return {
        onPointerDown(event) {
            fired.current = false;
            origin.current = { x: event.clientX, y: event.clientY };
            clear();
            timer.current = window.setTimeout(() => { fired.current = true; onLongPress(); }, delay);
        },
        onPointerMove(event) {
            if (!origin.current)
                return;
            const dx = Math.abs(event.clientX - origin.current.x);
            const dy = Math.abs(event.clientY - origin.current.y);
            if (dx > 10 || dy > 10)
                clear();
        },
        onPointerUp() { clear(); },
        onPointerCancel() { clear(); },
        onClickCapture(event) {
            // 长按已触发时吞掉随后的 click，避免同时进详情页。
            if (fired.current) {
                event.preventDefault();
                event.stopPropagation();
                fired.current = false;
            }
        },
    };
}
/**
 * 左右滑操作（原生 swipeActions 的等价件）。
 * `trailing` 从右往左划出（明细页的删除）；`leading` 从左往右划出（最近删除的恢复）。
 * `fullSwipe` 为真时划过阈值直接执行（对应原生 allowsFullSwipe）。
 */
export function SwipeRow({ children, leading, trailing, disabled }) {
    const [offset, setOffset] = React.useState(0);
    const start = React.useRef(null);
    const active = React.useRef(false);
    const width = 92;
    const leadingWidth = leading ? width : 0;
    const trailingWidth = trailing ? width : 0;
    const finish = () => {
        if (offset < -trailingWidth * 0.9 && trailing && trailing.fullSwipe) {
            setOffset(0);
            trailing.onAction();
        }
        else if (offset > leadingWidth * 0.9 && leading && leading.fullSwipe) {
            setOffset(0);
            leading.onAction();
        }
        else if (offset < -trailingWidth * 0.4 && trailing)
            setOffset(-trailingWidth);
        else if (offset > leadingWidth * 0.4 && leading)
            setOffset(leadingWidth);
        else
            setOffset(0);
    };
    if (disabled)
        return _jsx("div", { children: children });
    return (_jsxs("div", { style: { position: 'relative', overflow: 'hidden' }, children: [trailing ? (_jsxs("button", { type: "button", className: "lg-btn", onClick: () => { setOffset(0); trailing.onAction(); }, style: {
                    position: 'absolute', top: 0, bottom: 0, right: 0, width: trailingWidth,
                    background: trailing.destructive ? C.expense : C.brand, color: '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 13,
                }, children: [trailing.icon ? _jsx(Icon, { name: trailing.icon, size: 16, color: "#FFFFFF" }) : null, _jsx("span", { children: trailing.label })] })) : null, leading ? (_jsxs("button", { type: "button", className: "lg-btn", onClick: () => { setOffset(0); leading.onAction(); }, style: {
                    position: 'absolute', top: 0, bottom: 0, left: 0, width: leadingWidth,
                    background: leading.destructive ? C.expense : C.brand, color: '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 13,
                }, children: [leading.icon ? _jsx(Icon, { name: leading.icon, size: 16, color: "#FFFFFF" }) : null, _jsx("span", { children: leading.label })] })) : null, _jsx("div", { style: {
                    position: 'relative', background: C.surface,
                    transform: `translateX(${offset}px)`,
                    transition: active.current ? 'none' : 'transform 0.2s ease',
                    touchAction: 'pan-y',
                }, onPointerDown: (event) => { start.current = { x: event.clientX, base: offset }; active.current = false; }, onPointerMove: (event) => {
                    if (!start.current)
                        return;
                    const delta = event.clientX - start.current.x;
                    if (!active.current && Math.abs(delta) < 8)
                        return;
                    active.current = true;
                    const next = start.current.base + delta;
                    setOffset(Math.max(-trailingWidth * 1.15, Math.min(leadingWidth * 1.15, next)));
                }, onPointerUp: () => { if (active.current)
                    finish(); start.current = null; active.current = false; }, onPointerCancel: () => { setOffset(0); start.current = null; active.current = false; }, onClickCapture: (event) => {
                    // 划开时点内容 = 收起，而不是触发行的点击。
                    if (offset !== 0) {
                        event.preventDefault();
                        event.stopPropagation();
                        setOffset(0);
                    }
                }, children: children })] }));
}
