import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// SF Symbol → 内联 SVG。小应用跑在 WebView 里拿不到 SF Symbols，
// 这里按原生用到的符号名手绘一套等价图形（几何近似，非像素级复刻），统一 24×24、currentColor。
import React from 'react';
const STROKE = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};
function ringed(glyph, filled) {
    return filled
        ? (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "12", r: "9.2", fill: "currentColor" }), _jsx("g", { fill: "none", stroke: "var(--fin-surface)", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", children: glyph })] }))
        : (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "12", r: "9.2", ...STROKE }), _jsx("g", { ...STROKE, children: glyph })] }));
}
const CHECK = _jsx("path", { d: "M8 12.3l2.7 2.7L16 9.6" });
const PLUS = _jsx("path", { d: "M12 8v8M8 12h8" });
const BANG = _jsx("path", { d: "M12 7.4v5.4M12 16.2v.2" });
const QUESTION = _jsx("path", { d: "M9.9 9.8a2.2 2.2 0 1 1 2.6 2.5v1.4M12.3 16.4v.2" });
const XMARK = _jsx("path", { d: "M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" });
const ARROW_UP = _jsx("path", { d: "M12 16V8M8.6 11.4L12 8l3.4 3.4" });
const SHAPES = {
    'chart.line.uptrend.xyaxis': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M3.6 4.4v13.2a2 2 0 0 0 2 2h14.8" }), _jsx("path", { d: "M6.8 15.2l3.6-4.2 2.9 2.4 4.9-5.8" }), _jsx("path", { d: "M15.4 7.6h2.8v2.8" })] })),
    'chart.line.downtrend.xyaxis': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M3.6 4.4v13.2a2 2 0 0 0 2 2h14.8" }), _jsx("path", { d: "M6.8 8.6l3.6 4.2 2.9-2.4 4.9 5.8" }), _jsx("path", { d: "M15.4 16.6h2.8v-2.8" })] })),
    'square.grid.2x2': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "3.8", y: "3.8", width: "7", height: "7", rx: "1.8" }), _jsx("rect", { x: "13.2", y: "3.8", width: "7", height: "7", rx: "1.8" }), _jsx("rect", { x: "3.8", y: "13.2", width: "7", height: "7", rx: "1.8" }), _jsx("rect", { x: "13.2", y: "13.2", width: "7", height: "7", rx: "1.8" })] })),
    'wallet.pass': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "3.4", y: "4.6", width: "17.2", height: "14.8", rx: "3" }), _jsx("path", { d: "M3.4 9.4h17.2" }), _jsx("path", { d: "M7.6 14.4h4.4" })] })),
    gearshape: (_jsxs("g", { ...STROKE, children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M12 3.4l1.2 2.1 2.4-.5.5 2.4 2.1 1.2-1.3 2.1 1.3 2.1-2.1 1.2-.5 2.4-2.4-.5L12 20.6l-1.2-2.1-2.4.5-.5-2.4-2.1-1.2 1.3-2.1-1.3-2.1 2.1-1.2.5-2.4 2.4.5z" })] })),
    star: _jsx("g", { ...STROKE, children: _jsx("path", { d: "M12 4l2.5 5.2 5.6.8-4.1 4 1 5.6L12 16.9 7 19.6l1-5.6-4.1-4 5.6-.8z" }) }),
    'star.fill': _jsx("path", { fill: "currentColor", d: "M12 4l2.5 5.2 5.6.8-4.1 4 1 5.6L12 16.9 7 19.6l1-5.6-4.1-4 5.6-.8z" }),
    bell: (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M6.6 16.6V11a5.4 5.4 0 0 1 10.8 0v5.6h1.2H5.4z" }), _jsx("path", { d: "M10.2 19a1.9 1.9 0 0 0 3.6 0" })] })),
    'bell.fill': (_jsxs("g", { children: [_jsx("path", { fill: "currentColor", d: "M6.6 16.6V11a5.4 5.4 0 0 1 10.8 0v5.6h1.2H5.4z" }), _jsx("path", { ...STROKE, d: "M10.2 19a1.9 1.9 0 0 0 3.6 0" })] })),
    magnifyingglass: _jsxs("g", { ...STROKE, children: [_jsx("circle", { cx: "10.8", cy: "10.8", r: "6.2" }), _jsx("path", { d: "M15.4 15.4l4.2 4.2" })] }),
    'chevron.backward': _jsx("g", { ...STROKE, children: _jsx("path", { d: "M14.4 5.4L7.8 12l6.6 6.6" }) }),
    'chevron.right': _jsx("g", { ...STROKE, children: _jsx("path", { d: "M9.6 5.4L16.2 12l-6.6 6.6" }) }),
    'chevron.down': _jsx("g", { ...STROKE, children: _jsx("path", { d: "M5.4 9.2L12 15.8l6.6-6.6" }) }),
    'chevron.up.chevron.down': _jsx("g", { ...STROKE, children: _jsx("path", { d: "M8 10.2L12 6.2l4 4M8 13.8l4 4 4-4" }) }),
    'arrow.left.arrow.right': _jsx("g", { ...STROKE, children: _jsx("path", { d: "M4.6 9h14.8l-3.4-3.4M19.4 15H4.6l3.4 3.4" }) }),
    'arrow.up.circle.fill': ringed(ARROW_UP, true),
    'arrow.clockwise': _jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M19 12a7 7 0 1 1-2.4-5.3" }), _jsx("path", { d: "M19.4 4.6v3.6h-3.6" })] }),
    'arrow.triangle.2.circlepath': _jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M5 11a7 7 0 0 1 11.6-5.2M19 13a7 7 0 0 1-11.6 5.2" }), _jsx("path", { d: "M16.2 3.2v3h-3M7.8 20.8v-3h3" })] }),
    function: (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M13.8 4.4h-1.2a2.6 2.6 0 0 0-2.6 2.6v10a2.6 2.6 0 0 1-2.6 2.6H6.2" }), _jsx("path", { d: "M7.6 10.4h7.2" }), _jsx("path", { d: "M14 13.4l4 5M18 13.4l-4 5" })] })),
    sparkles: (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M9 3.6l1.5 3.4 3.4 1.5-3.4 1.5L9 13.4 7.5 10 4.1 8.5 7.5 7z" }), _jsx("path", { d: "M16.6 12.4l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" })] })),
    clock: _jsxs("g", { ...STROKE, children: [_jsx("circle", { cx: "12", cy: "12", r: "8.4" }), _jsx("path", { d: "M12 7v5.2l3.4 2" })] }),
    ellipsis: _jsxs("g", { fill: "currentColor", children: [_jsx("circle", { cx: "5.6", cy: "12", r: "1.6" }), _jsx("circle", { cx: "12", cy: "12", r: "1.6" }), _jsx("circle", { cx: "18.4", cy: "12", r: "1.6" })] }),
    'ellipsis.circle': ringed(_jsx("path", { d: "M8.4 12h.2M12 12h.2M15.6 12h.2" }), false),
    'plus.circle': ringed(PLUS, false),
    'checkmark.circle.fill': ringed(CHECK, true),
    'xmark.circle.fill': ringed(XMARK, true),
    xmark: _jsx("g", { ...STROKE, children: _jsx("path", { d: "M6 6l12 12M18 6L6 18" }) }),
    plus: _jsx("g", { ...STROKE, children: _jsx("path", { d: "M12 5v14M5 12h14" }) }),
    trash: _jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M4.8 6.8h14.4M9.4 6.8V5.2a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.6" }), _jsx("path", { d: "M6.6 6.8l.9 12a1.8 1.8 0 0 0 1.8 1.6h5.4a1.8 1.8 0 0 0 1.8-1.6l.9-12" })] }),
    'exclamationmark.triangle': _jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M12 4.2l8.4 14.6H3.6z" }), _jsx("path", { d: "M12 9.6v4M12 16.4v.2" })] }),
    'wifi.exclamationmark': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M3.6 9.2a13 13 0 0 1 12.4-2.6M6.4 12.6a8.6 8.6 0 0 1 7.2-1.2M9.2 16a4 4 0 0 1 2.6-.5" }), _jsx("path", { d: "M19.4 8.6v5M19.4 17v.2" })] })),
    'externaldrive.badge.exclamationmark': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "3", y: "7.4", width: "14", height: "9.2", rx: "2.4" }), _jsx("path", { d: "M6.4 12.2h.2" }), _jsx("path", { d: "M19 11.6v3.4M19 17.8v.2" })] })),
    'questionmark.circle': ringed(QUESTION, false),
    'exclamationmark.circle': ringed(BANG, false),
    'square.and.arrow.up': _jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M12 3.8v11" }), _jsx("path", { d: "M8.4 7.4L12 3.8l3.6 3.6" }), _jsx("path", { d: "M5.4 12.6v5.6a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2v-5.6" })] }),
    'line.3.horizontal.decrease': _jsx("g", { ...STROKE, children: _jsx("path", { d: "M4.4 7h15.2M6.8 12h10.4M9.6 17h4.8" }) }),
    'dollarsign.circle': ringed(_jsx("path", { d: "M14 9.4a2.4 2.4 0 0 0-2.2-1.2c-1.4 0-2.4.8-2.4 1.9 0 2.6 5 1.4 5 4 0 1.2-1.1 2-2.6 2A2.6 2.6 0 0 1 9.4 15M12 6.4v11.2" }), false),
    'chart.pie': _jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M12 3.6v8.4h8.4A8.4 8.4 0 0 0 12 3.6z" }), _jsx("path", { d: "M20.2 14.2A8.6 8.6 0 1 1 10.2 3.8" })] }),
    'chart.bar': _jsx("g", { ...STROKE, children: _jsx("path", { d: "M5.4 19.4V11M12 19.4V4.6M18.6 19.4v-5.8" }) }),
    'list.bullet': _jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M8.4 6.4h11.2M8.4 12h11.2M8.4 17.6h11.2" }), _jsx("circle", { cx: "4.6", cy: "6.4", r: "1", fill: "currentColor", stroke: "none" }), _jsx("circle", { cx: "4.6", cy: "12", r: "1", fill: "currentColor", stroke: "none" }), _jsx("circle", { cx: "4.6", cy: "17.6", r: "1", fill: "currentColor", stroke: "none" })] }),
    'arrow.up.arrow.down': _jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M7.6 4.6v14.8M4.2 8l3.4-3.4L11 8" }), _jsx("path", { d: "M16.4 19.4V4.6M13 16l3.4 3.4L19.8 16" })] }),
    'line.3.horizontal': _jsx("g", { ...STROKE, children: _jsx("path", { d: "M4.4 7h15.2M4.4 12h15.2M4.4 17h15.2" }) }),
    'creditcard': _jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "3.2", y: "5.6", width: "17.6", height: "12.8", rx: "2.6" }), _jsx("path", { d: "M3.2 10h17.6" })] }),
    'tray.and.arrow.down': _jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M12 3.8v8.4" }), _jsx("path", { d: "M8.4 8.6L12 12.2l3.6-3.6" }), _jsx("path", { d: "M4.2 13.6h4l1.2 2.4h5.2l1.2-2.4h4v4.6a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2z" })] }),
};
export default function Icon({ name, size = 17, color, style, weight }) {
    const shape = SHAPES[name];
    if (!shape)
        return _jsx("span", { style: { display: 'inline-block', width: size, height: size, ...style } });
    return (_jsx("svg", { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": "true", style: {
            display: 'block', flex: '0 0 auto', color: color || 'currentColor',
            strokeWidth: weight === 'semibold' ? 2.1 : undefined, ...style,
        }, children: shape }));
}
