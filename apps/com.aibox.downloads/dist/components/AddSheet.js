import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 「添加下载」面板：批量粘贴 + 落点选择 + 优先级。
//
// **落点必须在这里出现**，哪怕大多数人只用沙盒。改造前这条桥把落点硬编码成沙盒根，
// 引擎明明支持四种——把它画出来，是这一轮泛化在用户面前的唯一证据。
import React from 'react';
import Icon from './Icon.js';
import { Button, Chip, Sheet } from './primitives.js';
import { C, RADIUS, SPACE } from './theme.js';
const DESTINATIONS = [
    { kind: 'sandbox', label: '应用内', icon: 'folder', hint: '恒可用，不需要任何授权' },
    { kind: 'iCloud', label: 'iCloud', icon: 'icloud', hint: '同步到 iCloud Drive' },
    { kind: 'externalFiles', label: '外部文件夹', icon: 'externaldrive', hint: '需先在下载设置里授权一个文件夹' },
    { kind: 'vault', label: '笔记 Vault', icon: 'lock', hint: '落进当前活动 vault' },
];
const PRIORITIES = [
    { id: 'high', label: '优先' },
    { id: 'normal', label: '普通' },
    { id: 'low', label: '后台' },
];
/** 从一段文本里抽出所有 http(s) 链接（换行、空格、混在正文里都能认）。 */
export function extractURLs(text) {
    if (!text)
        return [];
    const found = String(text).match(/https?:\/\/[^\s<>"')\]]+/g) || [];
    const seen = new Set();
    const out = [];
    for (const raw of found) {
        const url = raw.replace(/[.,;]+$/, '');
        if (seen.has(url))
            continue;
        seen.add(url);
        out.push(url);
    }
    return out;
}
export default function AddSheet({ open, onClose, onSubmit, onPaste }) {
    const [text, setText] = React.useState('');
    const [destination, setDestination] = React.useState('sandbox');
    const [folder, setFolder] = React.useState('');
    const [priority, setPriority] = React.useState('normal');
    const urls = React.useMemo(() => extractURLs(text), [text]);
    React.useEffect(() => {
        if (open)
            setText('');
    }, [open]);
    const submit = () => {
        if (!urls.length)
            return;
        onSubmit({ urls, destination, folder: folder.trim(), priority });
        onClose();
    };
    return (_jsxs(Sheet, { open: open, title: "\u6DFB\u52A0\u4E0B\u8F7D", onClose: onClose, footer: _jsx(Button, { kind: "primary", block: true, disabled: !urls.length, onClick: submit, icon: "arrow.down.to.line", children: urls.length > 1 ? `下载 ${urls.length} 个链接` : '开始下载' }), children: [_jsx("textarea", { value: text, onChange: (e) => setText(e.target.value), placeholder: "\u7C98\u8D34\u4E00\u4E2A\u6216\u591A\u4E2A\u94FE\u63A5\uFF0C\u6BCF\u884C\u4E00\u4E2A", rows: 4, style: {
                    width: '100%',
                    boxSizing: 'border-box',
                    resize: 'none',
                    padding: SPACE.s3,
                    borderRadius: RADIUS.control,
                    border: `1px solid ${C.line}`,
                    background: 'transparent',
                    fontSize: 14,
                    lineHeight: 1.5,
                } }), onPaste ? (_jsx("div", { style: { marginTop: SPACE.s2 }, children: _jsx(Button, { icon: "doc.on.clipboard", onClick: async () => {
                        const t = await onPaste();
                        if (t)
                            setText((prev) => (prev ? `${prev}\n${t}` : t));
                    }, children: "\u4ECE\u526A\u8D34\u677F\u7C98\u8D34" }) })) : null, text && !urls.length ? (_jsx("div", { style: { marginTop: SPACE.s2, fontSize: 12.5, color: C.failed }, children: "\u6CA1\u627E\u5230 http(s) \u94FE\u63A5\u3002" })) : null, urls.length > 1 ? (_jsxs("div", { style: { marginTop: SPACE.s2, fontSize: 12.5, color: C.muted }, children: ["\u8BC6\u522B\u5230 ", urls.length, " \u4E2A\u94FE\u63A5\uFF0C\u4F1A\u4F5C\u4E3A\u540C\u4E00\u6279\u5165\u961F\uFF08\u53EF\u4E00\u5E76\u6682\u505C\u6216\u53D6\u6D88\uFF09\u3002"] })) : null, _jsx("div", { style: { marginTop: SPACE.s5, fontSize: 13, fontWeight: 600, color: C.muted }, children: "\u5B58\u5230\u54EA" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s1, marginTop: SPACE.s2 }, children: DESTINATIONS.map((d) => (_jsxs("button", { type: "button", onClick: () => setDestination(d.kind), style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.s3,
                        textAlign: 'left',
                        padding: `${SPACE.s2}px ${SPACE.s3}px`,
                        borderRadius: RADIUS.control,
                        border: `1px solid ${destination === d.kind ? C.brand : C.line}`,
                        background: 'transparent',
                        cursor: 'pointer',
                        minHeight: 44,
                    }, children: [_jsx(Icon, { name: d.icon, size: 20, color: destination === d.kind ? C.brand : C.muted }), _jsxs("span", { style: { flex: '1 1 auto' }, children: [_jsx("span", { style: { display: 'block', fontSize: 14.5, fontWeight: 500 }, children: d.label }), _jsx("span", { style: { display: 'block', fontSize: 12, color: C.muted }, children: d.hint })] }), destination === d.kind ? _jsx(Icon, { name: "checkmark.circle.fill", size: 18, color: C.brand }) : null] }, d.kind))) }), _jsx("input", { value: folder, onChange: (e) => setFolder(e.target.value), placeholder: "\u5B50\u6587\u4EF6\u5939\uFF08\u53EF\u7559\u7A7A\uFF09", style: {
                    width: '100%',
                    boxSizing: 'border-box',
                    marginTop: SPACE.s3,
                    padding: SPACE.s3,
                    borderRadius: RADIUS.control,
                    border: `1px solid ${C.line}`,
                    background: 'transparent',
                    fontSize: 14,
                } }), _jsx("div", { style: { marginTop: SPACE.s5, fontSize: 13, fontWeight: 600, color: C.muted }, children: "\u4F18\u5148\u7EA7" }), _jsx("div", { style: { display: 'flex', gap: SPACE.s2, marginTop: SPACE.s2 }, children: PRIORITIES.map((p) => (_jsx(Chip, { active: priority === p.id, onClick: () => setPriority(p.id), children: p.label }, p.id))) })] }));
}
