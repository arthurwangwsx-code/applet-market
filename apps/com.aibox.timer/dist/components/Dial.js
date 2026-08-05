import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatDuration } from '../lib/timer.js';
/**
 * 圆环倒计时。用 SVG 而不是 canvas：矢量随明暗与 Dynamic Type 自然缩放，且不用管 devicePixelRatio。
 * 颜色全部走 `aibox-ui.css` 的设计 token，跟随宿主明暗，不写死。
 */
export function Dial({ remaining, planned, label, running }) {
    const radius = 96;
    const circumference = 2 * Math.PI * radius;
    const progress = planned > 0 ? Math.min(1, Math.max(0, remaining / planned)) : 0;
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }, children: [_jsxs("svg", { viewBox: "0 0 220 220", style: { width: 'min(64vw, 240px)', height: 'auto' }, "aria-hidden": "true", children: [_jsx("circle", { cx: "110", cy: "110", r: radius, fill: "none", stroke: "currentColor", strokeWidth: "10", opacity: "0.15" }), _jsx("circle", { cx: "110", cy: "110", r: radius, fill: "none", stroke: "currentColor", strokeWidth: "10", strokeLinecap: "round", strokeDasharray: circumference, strokeDashoffset: circumference * (1 - progress), transform: "rotate(-90 110 110)", 
                        // 流式/高频更新的元素不要加 CSS transition：倒计时每秒重绘一次，
                        // 动画会和下一次更新打架，表现为进度环抖动。
                        style: { opacity: running ? 1 : 0.45 } })] }), _jsx("div", { style: { fontSize: 44, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }, children: formatDuration(remaining) }), _jsx("div", { className: "ax-muted", style: { fontSize: 15 }, children: label })] }));
}
