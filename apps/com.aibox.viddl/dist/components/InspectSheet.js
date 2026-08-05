import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 「添加视频」面板：粘贴地址 → 解析 → **选画质** → 下载。
//
// 画质选择是这个应用的核心交互，也是判据里唯一判为「策略归应用」的那一格：
// 同一个视频，两个应用可以默认选不同档且**都对**（一个默认最高清、一个默认省流量）。
// 所以它必须在这里画出来，而不是让宿主替用户决定。
import React from 'react';
import Icon from './Icon.js';
import { Button, Chip, Sheet } from './primitives.js';
import { C, RADIUS, SPACE } from './theme.js';
/** 从一段文本里抽第一个 http(s) 链接（分享过来的文字常常带一堆前后缀）。 */
export function firstURL(text) {
    const found = String(text || '').match(/https?:\/\/[^\s<>"')\]]+/);
    return found ? found[0].replace(/[.,;]+$/, '') : '';
}
function protoBadge(proto) {
    const label = { direct: '直链', hls: 'HLS', dash: 'DASH' }[proto] || proto;
    return (_jsx("span", { style: {
            fontSize: 11, padding: '1px 6px', borderRadius: 4,
            border: `1px solid ${C.line}`, color: C.muted,
        }, children: label }));
}
export default function InspectSheet({ open, onClose, onInspect, onDownload, onPaste }) {
    const [url, setUrl] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [info, setInfo] = React.useState(null);
    const [formats, setFormats] = React.useState([]);
    const [chosen, setChosen] = React.useState(null);
    const [audioOnly, setAudioOnly] = React.useState(false);
    const [error, setError] = React.useState('');
    React.useEffect(() => {
        if (!open)
            return;
        setUrl('');
        setInfo(null);
        setFormats([]);
        setChosen(null);
        setAudioOnly(false);
        setError('');
    }, [open]);
    const inspect = async () => {
        const target = firstURL(url);
        if (!target) {
            setError('没找到 http(s) 链接。');
            return;
        }
        setBusy(true);
        setError('');
        const result = await onInspect(target);
        setBusy(false);
        if (!result.ok) {
            setError(result.text || result.error || '解析失败。');
            return;
        }
        setInfo(result.video);
        setFormats(result.formats || []);
        // 缺省选第一条——extractor 已按清晰度降序给出，第一条就是「最好的那个」。
        setChosen((result.formats && result.formats[0] && result.formats[0].id) || null);
        if (!result.formats || !result.formats.length) {
            // 解析成功但没有格式清单（部分直链就是这样）：仍然可以下，只是没得选。
            setError('');
        }
    };
    const start = async () => {
        const target = firstURL(url);
        if (!target)
            return;
        setBusy(true);
        await onDownload({ url: target, formatId: chosen || undefined, audioOnly });
        setBusy(false);
        onClose();
    };
    return (_jsxs(Sheet, { open: open, title: "\u6DFB\u52A0\u89C6\u9891", onClose: onClose, footer: info ? (_jsx(Button, { kind: "primary", block: true, disabled: busy, onClick: start, icon: "arrow.down.to.line", children: audioOnly ? '只下音频' : '开始下载' })) : (_jsx(Button, { kind: "primary", block: true, disabled: busy || !url.trim(), onClick: inspect, icon: "magnifyingglass", children: busy ? '解析中…' : '解析' })), children: [_jsx("input", { value: url, onChange: (e) => { setUrl(e.target.value); setInfo(null); setFormats([]); }, placeholder: "\u7C98\u8D34\u89C6\u9891\u9875\u9762\u6216\u76F4\u94FE\u5730\u5740", style: {
                    width: '100%', boxSizing: 'border-box',
                    padding: SPACE.s3, borderRadius: RADIUS.control,
                    border: `1px solid ${C.line}`, background: 'transparent', fontSize: 14,
                } }), onPaste ? (_jsx("div", { style: { marginTop: SPACE.s2 }, children: _jsx(Button, { icon: "doc.on.clipboard", onClick: async () => { const t = await onPaste(); if (t) {
                        setUrl(t);
                        setInfo(null);
                    } }, children: "\u4ECE\u526A\u8D34\u677F\u7C98\u8D34" }) })) : null, error ? (_jsx("div", { style: { marginTop: SPACE.s3, fontSize: 13, color: C.failed, lineHeight: 1.5 }, children: error })) : null, info ? (_jsxs("div", { style: { marginTop: SPACE.s4 }, children: [_jsxs("div", { style: { display: 'flex', gap: SPACE.s3 }, children: [info.thumbnailURL ? (_jsx("img", { src: info.thumbnailURL, alt: "", style: { width: 96, height: 54, objectFit: 'cover', borderRadius: 8, background: C.track } })) : (_jsx("div", { style: {
                                    width: 96, height: 54, borderRadius: 8, background: C.track,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted,
                                }, children: _jsx(Icon, { name: "film", size: 22 }) })), _jsxs("div", { style: { flex: '1 1 auto', minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 600, lineHeight: 1.35 }, children: info.title }), _jsx("div", { style: { fontSize: 12.5, color: C.muted, marginTop: 3 }, children: [info.uploader, info.durationText, info.extractor].filter(Boolean).join(' · ') })] })] }), formats.length ? (_jsxs(_Fragment, { children: [_jsx("div", { style: { marginTop: SPACE.s4, fontSize: 13, fontWeight: 600, color: C.muted }, children: "\u753B\u8D28" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s1, marginTop: SPACE.s2 }, children: formats.map((f) => (_jsxs("button", { type: "button", onClick: () => setChosen(f.id), style: {
                                        display: 'flex', alignItems: 'center', gap: SPACE.s2, textAlign: 'left',
                                        padding: `${SPACE.s2}px ${SPACE.s3}px`, borderRadius: RADIUS.control,
                                        border: `1px solid ${chosen === f.id ? C.brand : C.line}`,
                                        background: 'transparent', cursor: 'pointer', minHeight: 44,
                                    }, children: [_jsxs("span", { style: { flex: '1 1 auto', minWidth: 0 }, children: [_jsx("span", { style: { display: 'block', fontSize: 14.5, fontWeight: 500 }, children: f.qualityLabel }), _jsx("span", { style: { display: 'block', fontSize: 12, color: C.muted }, children: [f.codecs, f.filesizeText, f.needsMerge ? '需合并音视频轨' : null]
                                                        .filter(Boolean).join(' · ') || f.container })] }), protoBadge(f.proto), chosen === f.id ? _jsx(Icon, { name: "checkmark.circle.fill", size: 18, color: C.brand }) : null] }, f.id))) })] })) : (_jsx("div", { style: { marginTop: SPACE.s3, fontSize: 12.5, color: C.muted }, children: "\u8FD9\u4E2A\u6765\u6E90\u6CA1\u6709\u7ED9\u51FA\u53EF\u9009\u753B\u8D28\uFF0C\u4F1A\u6309\u9ED8\u8BA4\u6E05\u6670\u5EA6\u4E0B\u8F7D\u3002" })), _jsxs("div", { style: { marginTop: SPACE.s4, display: 'flex', gap: SPACE.s2, alignItems: 'center' }, children: [_jsx(Chip, { active: !audioOnly, onClick: () => setAudioOnly(false), children: "\u89C6\u9891" }), _jsx(Chip, { active: audioOnly, onClick: () => setAudioOnly(true), children: "\u53EA\u8981\u97F3\u9891" })] }), audioOnly ? (_jsx("div", { style: { marginTop: SPACE.s2, fontSize: 12, color: C.muted, lineHeight: 1.5 }, children: "DASH \u6765\u6E90\u4F1A\u76F4\u63A5\u8DF3\u8FC7\u89C6\u9891\u8F68\uFF08\u5F88\u5FEB\uFF09\uFF1B\u76F4\u94FE\u4E0E HLS \u9700\u8981\u5148\u4E0B\u5B8C\u6574\u6D41\u518D\u62BD\u97F3\u9891\u3002" })) : null, info.subtitles && info.subtitles.length ? (_jsxs("div", { style: { marginTop: SPACE.s2, fontSize: 12, color: C.muted }, children: ["\u5B57\u5E55\uFF1A", info.subtitles.join('、')] })) : null] })) : null] }));
}
