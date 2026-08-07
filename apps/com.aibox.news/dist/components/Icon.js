import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
const STROKE = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};
const SOLID = { fill: 'currentColor', stroke: 'none' };
/** 圆环 + 内部字形（checkmark.circle / plus.circle / … 一族共用）。 */
function ringed(glyph, filled) {
    return filled ? (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "12", r: "9.2", fill: "currentColor" }), _jsx("g", { fill: "none", stroke: "var(--news-surface)", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", children: glyph })] })) : (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "12", r: "9.2", ...STROKE }), _jsx("g", { ...STROKE, children: glyph })] }));
}
const CHECK = _jsx("path", { d: "M8 12.3l2.7 2.7L16 9.6" });
const PLUS = _jsx("path", { d: "M12 8v8M8 12h8" });
const MINUS = _jsx("path", { d: "M8 12h8" });
const PAUSE = _jsx("path", { d: "M10 8.6v6.8M14 8.6v6.8" });
const BANG = _jsx("path", { d: "M12 7.4v5.4M12 16.2v.2" });
const QUESTION = _jsx("path", { d: "M9.9 9.8a2.2 2.2 0 1 1 2.6 2.5v1.4M12.3 16.4v.2" });
const XMARK = _jsx("path", { d: "M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" });
const SHAPES = {
    newspaper: (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M3.2 6.4h12.4v11.2a2 2 0 0 0 2 2H5.2a2 2 0 0 1-2-2z" }), _jsx("path", { d: "M15.6 8.6h3.2a2 2 0 0 1 2 2v6.6a2.4 2.4 0 0 1-2.4 2.4" }), _jsx("path", { d: "M5.8 9.2h7M5.8 12h7M5.8 14.8h4.4" })] })),
    'newspaper.fill': (_jsxs("g", { children: [_jsx("path", { d: "M3.2 6.4h12.4v11.2a2 2 0 0 0 2 2H5.2a2 2 0 0 1-2-2z", fill: "currentColor" }), _jsx("path", { d: "M15.6 8.6h3.2a2 2 0 0 1 2 2v6.6a2.4 2.4 0 0 1-2.4 2.4", ...STROKE })] })),
    'dot.radiowaves.up.forward': (_jsxs("g", { ...STROKE, children: [_jsx("circle", { cx: "6.4", cy: "17.6", r: "1.5", fill: "currentColor", stroke: "none" }), _jsx("path", { d: "M10.4 17.6a4.4 4.4 0 0 0-4.4-4.4" }), _jsx("path", { d: "M14.6 17.6A8.6 8.6 0 0 0 6 9" }), _jsx("path", { d: "M18.8 17.6A12.8 12.8 0 0 0 6 4.8" })] })),
    bookmark: (_jsx("g", { ...STROKE, children: _jsx("path", { d: "M6.6 4.6h10.8v15.2L12 15.6l-5.4 4.2z" }) })),
    'bookmark.fill': (_jsx("g", { ...SOLID, children: _jsx("path", { d: "M6.6 4.6h10.8v15.2L12 15.6l-5.4 4.2z" }) })),
    'bookmark.slash': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M6.6 4.6h10.8v15.2L12 15.6l-5.4 4.2z" }), _jsx("path", { d: "M4.2 3.6l15.6 16.8" })] })),
    sparkles: (_jsxs("g", { ...SOLID, children: [_jsx("path", { d: "M13.4 3.2l1.3 3.6 3.6 1.3-3.6 1.3-1.3 3.6-1.3-3.6L8.5 8.1l3.6-1.3z" }), _jsx("path", { d: "M6.6 13l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" }), _jsx("path", { d: "M18 14.2l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" })] })),
    ellipsis: (_jsxs("g", { ...SOLID, children: [_jsx("circle", { cx: "5.6", cy: "12", r: "1.6" }), _jsx("circle", { cx: "12", cy: "12", r: "1.6" }), _jsx("circle", { cx: "18.4", cy: "12", r: "1.6" })] })),
    'speaker.wave.2': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M4 9.4h3.2L11 6v12l-3.8-3.4H4z" }), _jsx("path", { d: "M14.4 9.4a3.8 3.8 0 0 1 0 5.2M17.2 7a7.4 7.4 0 0 1 0 10" })] })),
    'speaker.wave.2.fill': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M4 9.4h3.2L11 6v12l-3.8-3.4H4z", fill: "currentColor" }), _jsx("path", { d: "M14.4 9.4a3.8 3.8 0 0 1 0 5.2M17.2 7a7.4 7.4 0 0 1 0 10" })] })),
    'rectangle.stack': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "4", y: "9.6", width: "16", height: "9.6", rx: "2" }), _jsx("path", { d: "M6.4 6.8h11.2M8 4.4h8" })] })),
    'rectangle.3.group': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "3.4", y: "4.6", width: "17.2", height: "6.2", rx: "1.6" }), _jsx("rect", { x: "3.4", y: "13.2", width: "7.6", height: "6.2", rx: "1.6" }), _jsx("rect", { x: "13", y: "13.2", width: "7.6", height: "6.2", rx: "1.6" })] })),
    circle: (_jsx("g", { ...STROKE, children: _jsx("circle", { cx: "12", cy: "12", r: "9.2" }) })),
    'checkmark.circle': ringed(CHECK, false),
    'checkmark.circle.fill': ringed(CHECK, true),
    'plus.circle': ringed(PLUS, false),
    'minus.circle': ringed(MINUS, false),
    'pause.circle': ringed(PAUSE, false),
    'exclamationmark.circle': ringed(BANG, false),
    'questionmark.circle': ringed(QUESTION, false),
    'xmark.circle.fill': ringed(XMARK, true),
    'stop.circle.fill': (_jsxs("g", { children: [_jsx("circle", { cx: "12", cy: "12", r: "9.2", fill: "currentColor" }), _jsx("rect", { x: "9.2", y: "9.2", width: "5.6", height: "5.6", rx: "1.2", fill: "var(--news-surface)" })] })),
    'books.vertical': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "4", y: "4.4", width: "4", height: "15.2", rx: "1" }), _jsx("rect", { x: "10", y: "4.4", width: "4", height: "15.2", rx: "1" }), _jsx("path", { d: "M16.6 5.2l3.2.8-3 14-3.2-.8z" })] })),
    'chevron.right': (_jsx("g", { ...STROKE, children: _jsx("path", { d: "M9.4 5.6l6.4 6.4-6.4 6.4" }) })),
    'chevron.left': (_jsx("g", { ...STROKE, children: _jsx("path", { d: "M14.6 5.6L8.2 12l6.4 6.4" }) })),
    'chevron.down': (_jsx("g", { ...STROKE, children: _jsx("path", { d: "M5.6 9.4l6.4 6.4 6.4-6.4" }) })),
    clock: (_jsxs("g", { ...STROKE, children: [_jsx("circle", { cx: "12", cy: "12", r: "9.2" }), _jsx("path", { d: "M12 6.6V12l3.6 2.2" })] })),
    'clock.arrow.circlepath': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M3.8 12a8.2 8.2 0 1 1 2.6 6" }), _jsx("path", { d: "M3.4 20.4v-4.2h4.2" }), _jsx("path", { d: "M12 7.2V12l3.4 2" })] })),
    'clock.badge.questionmark': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M20.4 13.6A8.6 8.6 0 1 1 12 3.4" }), _jsx("path", { d: "M12 6.6V12l3 1.9" }), _jsx("path", { d: "M16.4 4.2a1.8 1.8 0 1 1 2.2 2v1.1M18.6 9.2v.2" })] })),
    'exclamationmark.triangle': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M12 4.2l8.4 14.6H3.6z" }), _jsx("path", { d: "M12 9.6v3.8M12 16.2v.2" })] })),
    'exclamationmark.triangle.fill': (_jsxs("g", { children: [_jsx("path", { d: "M12 4.2l8.4 14.6H3.6z", fill: "currentColor" }), _jsx("path", { d: "M12 9.6v3.8M12 16.2v.2", fill: "none", stroke: "var(--news-surface)", strokeWidth: "1.9", strokeLinecap: "round" })] })),
    magnifyingglass: (_jsxs("g", { ...STROKE, children: [_jsx("circle", { cx: "10.8", cy: "10.8", r: "6.2" }), _jsx("path", { d: "M15.4 15.4l4.4 4.4" })] })),
    tray: (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M3.4 13.6h4.2l1.4 2.4h6l1.4-2.4h4.2" }), _jsx("path", { d: "M3.4 13.6L5.8 5h12.4l2.4 8.6v3.6a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2z" })] })),
    'lock.slash': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "4.6", y: "10.4", width: "14.8", height: "9", rx: "2.2" }), _jsx("path", { d: "M8 10.4V7.8a4 4 0 0 1 6.9-2.8" }), _jsx("path", { d: "M3.4 3.4l17.2 17.2" })] })),
    'wifi.slash': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M2.6 8.8a15.6 15.6 0 0 1 5.2-3.1M15.4 5.4a15.6 15.6 0 0 1 6 3.4" }), _jsx("path", { d: "M6 12.6a10.4 10.4 0 0 1 2.8-1.7M14.2 10.5a10.4 10.4 0 0 1 3.8 2.1" }), _jsx("path", { d: "M9.2 16.2a5 5 0 0 1 5.6 0" }), _jsx("path", { d: "M12 19.4v.2" }), _jsx("path", { d: "M3.4 3.4l17.2 17.2" })] })),
    'arrow.triangle.2.circlepath': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M4.6 10.4A7.6 7.6 0 0 1 17.4 7" }), _jsx("path", { d: "M19.4 13.6A7.6 7.6 0 0 1 6.6 17" }), _jsx("path", { d: "M17.6 3.4v3.8h-3.8M6.4 20.6v-3.8h3.8" })] })),
    'arrow.clockwise': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M19.4 12a7.4 7.4 0 1 1-2.2-5.2" }), _jsx("path", { d: "M19.6 3.6v4.2h-4.2" })] })),
    photo: (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "3.2", y: "5.2", width: "17.6", height: "13.6", rx: "2.4" }), _jsx("circle", { cx: "8.4", cy: "10", r: "1.5" }), _jsx("path", { d: "M4.4 17l4.8-4.6 3.4 3.2 2.8-2.4 4.2 3.8" })] })),
    gearshape: (_jsxs("g", { ...STROKE, children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M12 2.8l1 2.5 2.6-.6 1.1 2.4 2.6.5-.6 2.6 2 1.8-2 1.8.6 2.6-2.6.5-1.1 2.4-2.6-.6-1 2.5-1-2.5-2.6.6-1.1-2.4-2.6-.5.6-2.6-2-1.8 2-1.8-.6-2.6 2.6-.5L8.4 4.7 11 5.3z" })] })),
    stethoscope: (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M6 3.4v5a4 4 0 0 0 8 0v-5" }), _jsx("path", { d: "M4.6 3.4h2.8M12.6 3.4h2.8" }), _jsx("path", { d: "M10 16.4v.6a4 4 0 0 0 8 0v-2.2" }), _jsx("circle", { cx: "18", cy: "12.4", r: "2.2" })] })),
    'sun.max': (_jsxs("g", { ...STROKE, children: [_jsx("circle", { cx: "12", cy: "12", r: "4.2" }), _jsx("path", { d: "M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" })] })),
    'doc.richtext': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M6 3.4h7.6L19 8.8v11.8H6z" }), _jsx("path", { d: "M13.4 3.4v5.4H19" }), _jsx("path", { d: "M8.6 12.4h7.2M8.6 15.2h7.2M8.6 18h4.4" })] })),
    'doc.on.doc': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "8.4", y: "7.4", width: "10.4", height: "13.2", rx: "2" }), _jsx("path", { d: "M15.4 7.4V5.4a2 2 0 0 0-2-2H7.2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1.2" })] })),
    'arrow.down.doc': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M6 9.6V3.4h7.6L19 8.8v11.8H6v-2.4" }), _jsx("path", { d: "M13.4 3.4v5.4H19" }), _jsx("path", { d: "M3 12.4v5M0.8 15.2L3 17.4l2.2-2.2", transform: "translate(3.6 0)" })] })),
    'list.number': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M9.6 6.4h11M9.6 12h11M9.6 17.6h11" }), _jsx("path", { d: "M4 4.6h1.2v3.6M3.4 11.2h2.2L3.4 14h2.4M3.4 16.4h2.2v1.6H4.2v.2h1.4v1.6H3.4" })] })),
    'eye.slash': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M6 6.6C4.2 8 2.9 9.8 2.2 12c1.6 4 5.3 6.4 9.8 6.4 1.7 0 3.2-.3 4.6-1" }), _jsx("path", { d: "M9.8 5.9A11 11 0 0 1 12 5.6c4.5 0 8.2 2.4 9.8 6.4-.7 1.8-1.8 3.4-3.2 4.6" }), _jsx("circle", { cx: "12", cy: "12", r: "2.8" }), _jsx("path", { d: "M4 3.4l16 17.2" })] })),
    'waveform.path.ecg': (_jsx("g", { ...STROKE, children: _jsx("path", { d: "M2.6 12.4h4l2-5.4 3.2 10.4 2.4-6.2 1.6 2.6h5.6" }) })),
    'moon.zzz': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M19.4 14.6A8 8 0 0 1 9 4.6a8.4 8.4 0 1 0 10.4 10z" }), _jsx("path", { d: "M13.6 3.4h3.2l-3.2 3.6h3.2M18.6 8h2.6l-2.6 3h2.6" })] })),
    'battery.25': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "2.6", y: "7.6", width: "16.4", height: "8.8", rx: "2.6" }), _jsx("path", { d: "M21 10.6v2.8" }), _jsx("rect", { x: "4.6", y: "9.6", width: "3.4", height: "4.8", rx: "1.2", fill: "currentColor", stroke: "none" })] })),
    internaldrive: (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "2.6", y: "6.4", width: "18.8", height: "11.2", rx: "2.6" }), _jsx("circle", { cx: "7.2", cy: "12", r: "1.4" }), _jsx("path", { d: "M11.4 12h6.4" })] })),
    'server.rack': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "3", y: "4.4", width: "18", height: "6", rx: "1.6" }), _jsx("rect", { x: "3", y: "13.6", width: "18", height: "6", rx: "1.6" }), _jsx("path", { d: "M6.4 7.4h.2M6.4 16.6h.2M10 7.4h7M10 16.6h7" })] })),
    key: (_jsxs("g", { ...STROKE, children: [_jsx("circle", { cx: "8", cy: "8", r: "4.4" }), _jsx("path", { d: "M11.2 11.2l8 8M16.4 16.4l2-2M18.6 18.6l2-2" })] })),
    'character.bubble': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M3.4 10.6a6.6 6.6 0 0 1 6.6-6.6h4a6.6 6.6 0 0 1 0 13.2H9l-4.2 3v-3.6a6.6 6.6 0 0 1-1.4-6z" }), _jsx("path", { d: "M9 13.2l3-6 3 6M10 11.4h4" })] })),
    globe: (_jsxs("g", { ...STROKE, children: [_jsx("circle", { cx: "12", cy: "12", r: "9.2" }), _jsx("path", { d: "M3 12h18M12 2.8c2.6 3 3.8 6 3.8 9.2S14.6 18.2 12 21.2c-2.6-3-3.8-6-3.8-9.2S9.4 5.8 12 2.8z" })] })),
    'building.columns': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M2.8 9.4L12 4.2l9.2 5.2" }), _jsx("path", { d: "M5.6 11.4v6.2M10 11.4v6.2M14 11.4v6.2M18.4 11.4v6.2M3.4 19.8h17.2" })] })),
    cpu: (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "6.4", y: "6.4", width: "11.2", height: "11.2", rx: "2" }), _jsx("rect", { x: "9.6", y: "9.6", width: "4.8", height: "4.8", rx: "1" }), _jsx("path", { d: "M9.4 3.4v3M14.6 3.4v3M9.4 17.6v3M14.6 17.6v3M3.4 9.4h3M3.4 14.6h3M17.6 9.4h3M17.6 14.6h3" })] })),
    'chart.line.uptrend.xyaxis': (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M3.4 3.6v16.8h17.2" }), _jsx("path", { d: "M6.4 16.4l3.8-4.4 3 2.4 5-6" }), _jsx("path", { d: "M14.6 8.4h3.6V12" })] })),
    atom: (_jsxs("g", { ...STROKE, children: [_jsx("circle", { cx: "12", cy: "12", r: "2", fill: "currentColor", stroke: "none" }), _jsx("ellipse", { cx: "12", cy: "12", rx: "9.4", ry: "4.2" }), _jsx("ellipse", { cx: "12", cy: "12", rx: "9.4", ry: "4.2", transform: "rotate(60 12 12)" }), _jsx("ellipse", { cx: "12", cy: "12", rx: "9.4", ry: "4.2", transform: "rotate(120 12 12)" })] })),
    sportscourt: (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "2.6", y: "5.6", width: "18.8", height: "12.8", rx: "2.6" }), _jsx("path", { d: "M12 5.6v12.8" }), _jsx("circle", { cx: "12", cy: "12", r: "2.6" })] })),
    'heart.text.square': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "3.4", y: "3.4", width: "17.2", height: "17.2", rx: "4" }), _jsx("path", { d: "M12 16.4s-3.6-2.4-3.6-4.8a2 2 0 0 1 3.6-1.2 2 2 0 0 1 3.6 1.2c0 2.4-3.6 4.8-3.6 4.8z" })] })),
    'square.grid.2x2': (_jsxs("g", { ...STROKE, children: [_jsx("rect", { x: "3.6", y: "3.6", width: "7.2", height: "7.2", rx: "1.6" }), _jsx("rect", { x: "13.2", y: "3.6", width: "7.2", height: "7.2", rx: "1.6" }), _jsx("rect", { x: "3.6", y: "13.2", width: "7.2", height: "7.2", rx: "1.6" }), _jsx("rect", { x: "13.2", y: "13.2", width: "7.2", height: "7.2", rx: "1.6" })] })),
    trash: (_jsxs("g", { ...STROKE, children: [_jsx("path", { d: "M4.6 6.4h14.8M9.4 6.4V4.6h5.2v1.8" }), _jsx("path", { d: "M6.6 6.4l1 13.2h8.8l1-13.2" }), _jsx("path", { d: "M10.2 9.8v6.4M13.8 9.8v6.4" })] })),
    'arrow.up': (_jsx("g", { ...STROKE, children: _jsx("path", { d: "M12 20V4M5.6 10.4L12 4l6.4 6.4" }) })),
    'arrow.down': (_jsx("g", { ...STROKE, children: _jsx("path", { d: "M12 4v16M5.6 13.6L12 20l6.4-6.4" }) })),
    xmark: (_jsx("g", { ...STROKE, children: _jsx("path", { d: "M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" }) })),
    checkmark: (_jsx("g", { ...STROKE, children: _jsx("path", { d: "M4.6 12.6l5 5 9.8-11" }) })),
    'play.fill': (_jsx("g", { ...SOLID, children: _jsx("path", { d: "M7 4.6l12 7.4-12 7.4z" }) })),
    'pause.fill': (_jsxs("g", { ...SOLID, children: [_jsx("rect", { x: "6.4", y: "4.6", width: "3.8", height: "14.8", rx: "1.4" }), _jsx("rect", { x: "13.8", y: "4.6", width: "3.8", height: "14.8", rx: "1.4" })] })),
    'backward.fill': (_jsx("g", { ...SOLID, children: _jsx("path", { d: "M11.6 12L20 6.4v11.2zM3.4 12l8.4-5.6v11.2z" }) })),
    'forward.fill': (_jsx("g", { ...SOLID, children: _jsx("path", { d: "M12.4 12L4 17.6V6.4zM20.6 12l-8.4 5.6V6.4z" }) })),
};
export default function Icon({ name, size = 17, color, style, className, title }) {
    const shape = SHAPES[name] || SHAPES.circle;
    return (_jsxs("svg", { viewBox: "0 0 24 24", width: size, height: size, role: title ? 'img' : 'presentation', "aria-hidden": title ? undefined : 'true', "aria-label": title, className: className, style: { display: 'block', flex: '0 0 auto', color, ...style }, children: [title ? _jsx("title", { children: title }) : null, shape] }));
}
