import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 图表（规格 §7）—— 全部手绘 SVG。
//
// **全模块没有一根蜡烛**：所有价格图都是折线 + 渐变面积图，
// **没有**十字光标、tooltip、长按刻度、双指缩放、时间轴标签。别"好心"升级成蜡烛图或加交互，
// 那会偏离 1:1（§15 第 1 条）。
//
// 为什么不用内置的 chart.js：这里要的是「面积渐变 18%→2%、X 轴完全隐藏、Y 轴不含 0」这种
// 逐像素对齐原生 Swift Charts 的形态。手绘 SVG 反而更短、更可控，也不引入需要注册控制器的依赖。
import React from 'react';
import { C } from './theme.js';
let gradientSeq = 0;
function useGradientID() {
    const ref = React.useRef(null);
    if (ref.current === null) {
        gradientSeq += 1;
        ref.current = `fin-grad-${gradientSeq}`;
    }
    return ref.current;
}
/** 数值序列 → SVG 路径点。`nulls` 段自动断开（暖机期不画点）。 */
function pathFor(values, { width, height, min, max, padTop = 0, padBottom = 0 }) {
    const span = max - min || 1;
    const usable = height - padTop - padBottom;
    const step = values.length > 1 ? width / (values.length - 1) : 0;
    let path = '';
    let pen = false;
    for (let i = 0; i < values.length; i += 1) {
        const value = values[i];
        if (value === null || value === undefined || !Number.isFinite(value)) {
            pen = false;
            continue;
        }
        const x = i * step;
        const y = padTop + usable - ((value - min) / span) * usable;
        path += `${pen ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
        pen = true;
    }
    return path;
}
function extent(series) {
    let min = Infinity;
    let max = -Infinity;
    for (const values of series) {
        for (const value of values) {
            if (value === null || value === undefined || !Number.isFinite(value))
                continue;
            if (value < min)
                min = value;
            if (value > max)
                max = value;
        }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max))
        return { min: 0, max: 1 };
    if (min === max)
        return { min: min - 1, max: max + 1 };
    return { min, max };
}
/**
 * 主图：面积（渐变 18% → 2%）+ 折线。x = **数组下标**（不是日期），y = 收盘价。
 * 主色 = sign(最后收盘 − 第一根收盘) 的涨跌色。Y 轴 automatic(includesZero: false)。
 */
export function AreaLineChart({ values, overlays = [], height = 200, color, upIsRed = true, baseline, }) {
    const gradientID = useGradientID();
    const width = 1000; // viewBox 宽；实际宽度由 CSS 撑满
    const clean = values.filter((value) => Number.isFinite(value));
    if (clean.length < 2)
        return _jsx("div", { style: { height } });
    const first = clean[0];
    const last = clean[clean.length - 1];
    const rising = last >= first;
    const trend = color || ((rising === upIsRed) ? C.red : C.green);
    const series = [values, ...overlays.map((row) => row.values)];
    if (Array.isArray(baseline))
        series.push(baseline);
    const { min, max } = extent(series);
    const geometry = { width, height, min, max, padTop: 6, padBottom: 6 };
    const line = pathFor(values, geometry);
    const step = values.length > 1 ? width / (values.length - 1) : 0;
    const area = `${line}L${((values.length - 1) * step).toFixed(2)} ${height}L0 ${height}Z`;
    return (_jsxs("svg", { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", width: "100%", height: height, style: { display: 'block', overflow: 'visible' }, "aria-hidden": "true", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: gradientID, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: trend, stopOpacity: "0.18" }), _jsx("stop", { offset: "100%", stopColor: trend, stopOpacity: "0.02" })] }) }), _jsx("path", { d: area, fill: `url(#${gradientID})` }), Array.isArray(baseline) ? (_jsx("path", { d: pathFor(baseline, geometry), fill: "none", stroke: C.muted, strokeWidth: "1.4", strokeDasharray: "5 4", vectorEffect: "non-scaling-stroke" })) : null, _jsx("path", { d: line, fill: "none", stroke: trend, strokeWidth: "1.8", vectorEffect: "non-scaling-stroke", strokeLinejoin: "round" }), overlays.map((row) => (_jsx("path", { d: pathFor(row.values, geometry), fill: "none", stroke: row.color, strokeWidth: "1", vectorEffect: "non-scaling-stroke", strokeLinejoin: "round" }, row.id)))] }));
}
/**
 * 副图（100pt）：柱 + 若干条线。MACD / KDJ / VOL 共用。
 * `bars` 按正负着涨跌色（VOL 则由调用方直接给每根的颜色）。
 */
export function SubChart({ bars, barColors, lines = [], height = 100, upIsRed = true }) {
    const width = 1000;
    const series = lines.map((row) => row.values);
    if (bars)
        series.push(bars);
    const { min, max } = extent(series);
    const geometry = { width, height, min, max, padTop: 4, padBottom: 4 };
    const span = max - min || 1;
    const usable = height - 8;
    const zeroY = 4 + usable - ((0 - min) / span) * usable;
    const count = bars ? bars.length : (lines[0] ? lines[0].values.length : 0);
    const slot = count > 0 ? width / count : 0;
    const barWidth = Math.max(0.8, slot * 0.62);
    return (_jsxs("svg", { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", width: "100%", height: height, style: { display: 'block' }, "aria-hidden": "true", children: [bars ? bars.map((value, index) => {
                if (!Number.isFinite(value))
                    return null;
                const y = 4 + usable - ((value - min) / span) * usable;
                const top = Math.min(y, zeroY);
                const barHeight = Math.max(0.6, Math.abs(y - zeroY));
                const fill = barColors ? barColors[index]
                    : ((value >= 0) === upIsRed ? C.red : C.green);
                return (_jsx("rect", { x: index * slot + (slot - barWidth) / 2, y: top, width: barWidth, height: barHeight, fill: fill }, index));
            }) : null, lines.map((row) => (_jsx("path", { d: pathFor(row.values, geometry), fill: "none", stroke: row.color, strokeWidth: "1", vectorEffect: "non-scaling-stroke" }, row.id)))] }));
}
/** 资金流柱状图：y 单位「亿元」，按正负着色，高 90，x 轴隐藏。 */
export function BarChart({ values, height = 90, upIsRed = true }) {
    if (!values || values.length === 0)
        return null;
    return _jsx(SubChart, { bars: values, height: height, upIsRed: upIsRed });
}
/**
 * 资产配置环形图：`innerRadius = 0.62`、`angularInset 1.5`、110×110。图例由调用方自己画。
 */
export function DonutChart({ slices, size = 110, colors }) {
    const total = slices.reduce((sum, row) => sum + Math.max(0, row.value), 0);
    if (total <= 0)
        return null;
    const radius = size / 2;
    const inner = radius * 0.62;
    const gap = 1.5; // angularInset，单位度
    let angle = -90;
    const paths = slices.map((row, index) => {
        const sweep = (Math.max(0, row.value) / total) * 360;
        const from = angle + gap / 2;
        const to = angle + sweep - gap / 2;
        angle += sweep;
        if (to <= from)
            return null;
        const rad = (deg) => (deg * Math.PI) / 180;
        const x1 = radius + radius * Math.cos(rad(from));
        const y1 = radius + radius * Math.sin(rad(from));
        const x2 = radius + radius * Math.cos(rad(to));
        const y2 = radius + radius * Math.sin(rad(to));
        const x3 = radius + inner * Math.cos(rad(to));
        const y3 = radius + inner * Math.sin(rad(to));
        const x4 = radius + inner * Math.cos(rad(from));
        const y4 = radius + inner * Math.sin(rad(from));
        const large = to - from > 180 ? 1 : 0;
        return (_jsx("path", { d: `M${x1} ${y1}A${radius} ${radius} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${inner} ${inner} 0 ${large} 0 ${x4} ${y4}Z`, fill: colors[index % colors.length] }, row.id || index));
    });
    return (_jsx("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { display: 'block', flex: '0 0 auto' }, "aria-hidden": "true", children: paths }));
}
/** 环形图与图例共用的配色（brand 起头，其余取中性可辨识色）。 */
export const ALLOCATION_COLORS = [C.brand, C.blue, C.amber, C.green, C.muted];
/** 折线（持仓收益曲线 h140 / 策略曲线 h130）——无面积、Y 不含 0。 */
export function LineChart({ values, baseline, height = 140, color, upIsRed = true }) {
    return (_jsx(AreaLineChart, { values: values, baseline: baseline, height: height, color: color, upIsRed: upIsRed }));
}
