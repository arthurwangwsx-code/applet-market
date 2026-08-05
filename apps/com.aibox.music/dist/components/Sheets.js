import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 收藏（§2.9）与播放历史（§2.10）两个 sheet。
//
// 差异（README 有记）：
//  · 收藏页左上的「导入本地音频」去掉了 —— 容器的 `aibox.picker.file` 返回的是 applet 私有资源句柄，
//    原生播放引擎读不到它，导进来也放不了；不做假入口。
//  · 播放历史是**本应用自己记的**（宿主 19 个工具没有任何一个能读原生播放历史）。
import React from 'react';
import Icon from './Icon.js';
import { EmptyState, Segmented, Sheet, SwipeRow, Artwork, Spinner } from './primitives.js';
import { SongRow } from './rows.js';
import { C, SPACE } from './theme.js';
export function FavoritesSheet({ open, onClose, ctx }) {
    const { t, actions, favorites, favoritesLoading } = ctx;
    return (_jsxs(Sheet, { open: open, onClose: onClose, title: t('fav.title'), trailing: (_jsx("button", { type: "button", className: "mu-btn mu-press", onClick: onClose, style: { color: C.accent, fontSize: 16 }, children: t('common.done') })), children: [favoritesLoading ? (_jsx("div", { style: { padding: 40, display: 'flex', justifyContent: 'center' }, children: _jsx(Spinner, { color: C.muted }) })) : null, !favoritesLoading && favorites.length === 0 ? (_jsx(EmptyState, { icon: "heart", title: t('fav.empty'), hint: t('fav.emptyHint') })) : null, favorites.map((track, index) => (_jsx(SwipeRow, { actionLabel: t('common.remove'), onAction: () => actions.toggleFavorite(track, false), children: _jsx(SongRow, { track: track, onClick: () => actions.playTrack(track, favorites), onLongPress: () => actions.trackMenu(track, { group: favorites }), trailing: _jsx(Icon, { name: "play.circle.fill", size: 24, color: C.accent }) }) }, track.id || index))), _jsx("div", { style: { height: 24 } })] }));
}
export function HistorySheet({ open, onClose, ctx }) {
    const { t, store, actions } = ctx;
    const [mode, setMode] = React.useState('most');
    const rows = mode === 'most' ? store.mostPlayed(200) : store.recentlyPlayed(200);
    return (_jsxs(Sheet, { open: open, onClose: onClose, title: t('history.title'), trailing: (_jsx("button", { type: "button", className: "mu-btn mu-press", onClick: onClose, style: { color: C.accent, fontSize: 16 }, children: t('common.done') })), children: [_jsx("div", { style: { padding: `${SPACE.s3}px ${SPACE.s4}px`, display: 'flex', justifyContent: 'center' }, children: _jsx(Segmented, { style: { width: 200 }, items: [{ id: 'most', title: t('history.mostPlayed') }, { id: 'recent', title: t('history.recent') }], value: mode, onChange: setMode }) }), rows.length === 0 ? (_jsx(EmptyState, { icon: "chart.bar.xaxis", title: t('history.empty'), hint: t('history.emptyHint') })) : null, rows.map((row, index) => (_jsx(SwipeRow, { actionLabel: t('common.remove'), onAction: () => store.removeHistory(row.key), children: _jsx(HistoryRow, { row: row, rank: mode === 'most' ? index : null, t: t, onClick: () => actions.playTrack(row.track), onLongPress: () => actions.trackMenu(row.track), onAdd: () => actions.addToQueue(row.track) }) }, row.key))), _jsx("div", { style: { height: 24 } })] }));
}
function HistoryRow({ row, rank, t, onClick, onLongPress, onAdd }) {
    const timer = React.useRef(null);
    return (_jsxs("div", { className: "mu-press", style: { display: 'flex', alignItems: 'center', gap: 12, padding: `6px ${SPACE.s4}px` }, onPointerDown: () => { timer.current = setTimeout(onLongPress, 500); }, onPointerUp: () => { if (timer.current)
            clearTimeout(timer.current); }, onPointerCancel: () => { if (timer.current)
            clearTimeout(timer.current); }, onClick: onClick, children: [rank !== null ? (_jsx("span", { className: "mu-mono", style: { fontSize: 15, fontWeight: 600, width: 22, color: rank < 3 ? C.accent : C.muted }, children: rank + 1 })) : null, _jsx(Artwork, { url: row.track.artworkUrl, size: 44, radius: 6, iconSize: 16 }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 1 auto' }, children: [_jsx("span", { className: "mu-clamp-1", style: { fontSize: 14, fontWeight: 500, color: C.ink }, children: row.track.title }), row.track.artist ? (_jsx("span", { className: "mu-clamp-1", style: { fontSize: 11, color: C.muted }, children: row.track.artist })) : null] }), _jsx("span", { style: { fontSize: 11, color: C.muted }, children: t('history.plays', row.count) }), _jsx("button", { type: "button", className: "mu-btn mu-press", onClick: (event) => { event.stopPropagation(); onAdd(); }, style: { padding: '6px 0 6px 10px', color: C.accent }, children: _jsx(Icon, { name: "text.append", size: 15, color: C.accent }) })] }));
}
