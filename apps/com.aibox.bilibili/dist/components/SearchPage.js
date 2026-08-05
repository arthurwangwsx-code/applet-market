import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 搜索页。走 `wbi/search/all/v2` 综合搜索（含视频 / 番剧 / UP 主三组）。
//
// 输入框用受控 input + 显式提交，**不做输入即搜**：每敲一个字发一次带 WBI 签名的请求，
// 既浪费也更容易撞风控。
import React from 'react';
import { VirtualList, useKeyboardInset } from 'aibox/ui';
import VideoCard, { CARD_HEIGHT } from './VideoCard.js';
import { EmptyState, Spinner } from './primitives.js';
import { C, RADIUS, SPACE } from './theme.js';
import * as api from '../lib/api.js';
import { imageURL, openInBrowser } from '../lib/host.js';
import { formatCount } from '../lib/format.js';
/** 番剧/UP 主这类本应用没做详情的结果，点了交给宿主浏览器，而不是留一个点不动的行。 */
function BangumiRow({ item }) {
    return (_jsxs("div", { className: "bl-press", onClick: () => openInBrowser(item.url), style: { display: 'flex', gap: SPACE.s3, padding: `${SPACE.s3}px ${SPACE.s4}px`, alignItems: 'center' }, children: [_jsx("img", { src: imageURL(item.cover, 60), alt: "", style: { width: 60, height: 80, objectFit: 'cover', borderRadius: RADIUS.sm, background: C.surface } }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { className: "bl-clamp2", style: { fontSize: 14, color: C.text }, children: item.title }), _jsx("div", { style: { fontSize: 12, color: C.faint, marginTop: 4 }, children: item.desc })] })] }));
}
function UserRow({ item }) {
    return (_jsxs("div", { className: "bl-press", onClick: () => openInBrowser(`https://space.bilibili.com/${item.mid}`), style: { display: 'flex', gap: SPACE.s3, padding: `${SPACE.s3}px ${SPACE.s4}px`, alignItems: 'center' }, children: [_jsx("img", { src: imageURL(item.avatar, 44), alt: "", style: { width: 44, height: 44, borderRadius: 22, objectFit: 'cover', background: C.surface } }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 14, color: C.text }, children: item.name }), _jsxs("div", { style: { fontSize: 12, color: C.faint, marginTop: 2 }, children: [formatCount(item.fans), "\u7C89\u4E1D \u00B7 ", item.videos, "\u4E2A\u89C6\u9891"] })] })] }));
}
function SectionHeader({ label }) {
    return (_jsx("div", { style: {
            padding: `${SPACE.s3}px ${SPACE.s4}px ${SPACE.s2}px`,
            fontSize: 13, fontWeight: 600, color: C.sub, background: C.bg,
        }, children: label }));
}
export default function SearchPage({ onOpen }) {
    const [keyword, setKeyword] = React.useState('');
    const [hot, setHot] = React.useState([]);
    const [rows, setRows] = React.useState([]);
    const [state, setState] = React.useState('idle'); // idle | loading | ready | error
    const [error, setError] = React.useState('');
    const keyboard = useKeyboardInset();
    React.useEffect(() => { api.hotSearch().then(setHot); }, []);
    const run = React.useCallback(async (text) => {
        const query = String(text || '').trim();
        if (!query)
            return;
        setState('loading');
        setError('');
        try {
            const result = await api.search(query);
            // 三组结果扁平成一条虚拟列表：分组头也是行，这样长结果集照样虚拟滚动。
            const out = [];
            if (result.videos.length) {
                out.push({ kind: 'header', id: 'h-video', label: '视频' });
                for (const v of result.videos)
                    out.push({ kind: 'video', id: `v-${v.bvid}`, video: v });
            }
            if (result.bangumi.length) {
                out.push({ kind: 'header', id: 'h-bangumi', label: '番剧' });
                result.bangumi.forEach((b, i) => out.push({ kind: 'bangumi', id: `b-${i}`, item: b }));
            }
            if (result.users.length) {
                out.push({ kind: 'header', id: 'h-user', label: 'UP 主' });
                for (const u of result.users)
                    out.push({ kind: 'user', id: `u-${u.mid}`, item: u });
            }
            setRows(out);
            setState('ready');
        }
        catch (err) {
            setError(String(err?.message || err));
            setState('error');
        }
    }, []);
    const searchBar = (_jsxs("div", { style: { padding: SPACE.s3, background: C.bg, display: 'flex', gap: SPACE.s2 }, children: [_jsx("input", { value: keyword, onChange: (e) => setKeyword(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') {
                    e.target.blur();
                    run(keyword);
                } }, placeholder: "\u641C\u7D22\u89C6\u9891\u3001\u756A\u5267\u3001UP \u4E3B", enterKeyHint: "search", style: {
                    flex: 1, border: 'none', outline: 'none',
                    padding: `9px ${SPACE.s3}px`, borderRadius: RADIUS.md,
                    background: C.surface, color: C.text, fontSize: 14,
                } }), _jsx("button", { type: "button", onClick: () => run(keyword), style: {
                    border: 'none', padding: `0 ${SPACE.s4}px`, borderRadius: RADIUS.md,
                    background: C.brand, color: '#fff', fontSize: 14,
                }, children: "\u641C\u7D22" })] }));
    let body;
    if (state === 'loading')
        body = _jsx(Spinner, { label: "\u641C\u7D22\u4E2D" });
    else if (state === 'error') {
        body = _jsx(EmptyState, { title: "\u641C\u7D22\u5931\u8D25", detail: error, actionLabel: "\u91CD\u8BD5", onAction: () => run(keyword) });
    }
    else if (state === 'ready' && rows.length === 0) {
        body = _jsx(EmptyState, { title: "\u6CA1\u6709\u627E\u5230\u76F8\u5173\u5185\u5BB9", detail: "\u6362\u4E2A\u5173\u952E\u8BCD\u8BD5\u8BD5" });
    }
    else if (state === 'idle') {
        body = (_jsxs("div", { style: { padding: SPACE.s4 }, children: [_jsx("div", { style: { fontSize: 13, color: C.sub, marginBottom: SPACE.s3 }, children: "\u70ED\u641C" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: SPACE.s2 }, children: hot.map((word) => (_jsx("button", { type: "button", onClick: () => { setKeyword(word); run(word); }, style: {
                            border: 'none', padding: `7px ${SPACE.s3}px`, borderRadius: RADIUS.lg,
                            background: C.surface, color: C.text, fontSize: 13,
                        }, children: word }, word))) })] }));
    }
    return (
    // 键盘避让：宿主推 keyboardChanged，输入框才不会被挡住（这是「一眼网页」的典型症状之一）。
    _jsxs("div", { style: {
            height: '100%', display: 'flex', flexDirection: 'column',
            background: C.bg, paddingBottom: keyboard.height,
            transition: `padding-bottom ${keyboard.animationMs}ms`,
        }, children: [searchBar, body ? (_jsx("div", { className: "bl-scroll", style: { flex: 1, overflowY: 'auto' }, children: body })) : (_jsx(VirtualList, { className: "bl-scroll", style: { flex: 1 }, items: rows, keyExtractor: (row) => row.id, estimatedRowHeight: CARD_HEIGHT, restoreKey: "search", footer: _jsx("div", { style: { height: SPACE.s6 } }), renderRow: (row) => {
                    if (row.kind === 'header')
                        return _jsx(SectionHeader, { label: row.label });
                    if (row.kind === 'video')
                        return _jsx(VideoCard, { video: row.video, onOpen: onOpen });
                    if (row.kind === 'bangumi')
                        return _jsx(BangumiRow, { item: row.item });
                    return _jsx(UserRow, { item: row.item });
                } }))] }));
}
