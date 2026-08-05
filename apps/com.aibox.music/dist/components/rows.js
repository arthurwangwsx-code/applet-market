import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 各页共用的行：队列行 / 歌曲行 / 合集行 / 曲目行（本地曲库与详情）。
// 行尺寸、字号与图标严格按规格 §2.4 / §2.6 / §2.8 / §2.11。
import React from 'react';
import Icon from './Icon.js';
import { Artwork, useLongPress } from './primitives.js';
import { C, SPACE } from './theme.js';
import { duration as fmtDuration, losslessBadge, trackSubtitle } from '../lib/format.js';
/** 队列行（§2.4）：36×36 封面；当前行叠 waveform / play.fill，标题用 accent。 */
export function QueueRow({ track, isCurrent, isPlaying, onClick, onLongPress, trailing, rowId }) {
    const press = useLongPress(() => onLongPress && onLongPress());
    return (_jsxs("div", { className: "mu-press", "data-row-id": rowId, style: { display: 'flex', alignItems: 'center', gap: 12, padding: `6px ${SPACE.s4}px` }, ...press.bind, onClick: () => { if (!press.consumed() && onClick)
            onClick(); }, children: [_jsxs("div", { style: { position: 'relative' }, children: [_jsx(Artwork, { url: track.artworkUrl, size: 36, radius: 6, iconSize: 16, tint: isCurrent ? C.accent : C.muted, background: isCurrent
                            ? `color-mix(in srgb, ${C.accent} 12%, transparent)`
                            : `color-mix(in srgb, ${C.line} 50%, transparent)` }), isCurrent ? (_jsx("div", { style: {
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.28)', borderRadius: 6,
                        }, children: _jsx(Icon, { name: isPlaying ? 'waveform' : 'play.fill', size: isPlaying ? 14 : 12, color: C.accent }) })) : null] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 1 auto' }, children: [_jsx("span", { className: "mu-clamp-1", style: { fontSize: 13, fontWeight: isCurrent ? 500 : 400, color: isCurrent ? C.accent : C.ink }, children: track.title }), track.artist ? _jsx("span", { className: "mu-clamp-1", style: { fontSize: 11, color: C.muted }, children: track.artist }) : null] }), Number(track.duration) > 0 ? (_jsx("span", { className: "mu-mono", style: { fontSize: 11, color: C.muted }, children: fmtDuration(track.duration) })) : null, trailing] }));
}
/** 搜索/收藏里的歌曲行（§2.6）：40×40 封面 + 右侧 play.circle.fill。 */
export function SongRow({ track, onClick, onLongPress, trailing, artworkSize = 40, rowId }) {
    const press = useLongPress(() => onLongPress && onLongPress());
    return (_jsxs("div", { className: "mu-press", "aria-label": "audioSongRow", "data-row-id": rowId, style: { display: 'flex', alignItems: 'center', gap: 12, padding: `6px ${SPACE.s4}px` }, ...press.bind, onClick: () => { if (!press.consumed() && onClick)
            onClick(); }, children: [_jsx(Artwork, { url: track.artworkUrl, size: artworkSize, radius: 6, iconSize: 16 }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 1 auto' }, children: [_jsx("span", { className: "mu-clamp-1", style: { fontSize: 14, color: C.ink }, children: track.title }), track.artist ? _jsx("span", { className: "mu-clamp-1", style: { fontSize: 11, color: C.muted }, children: track.artist }) : null] }), trailing !== undefined ? trailing : _jsx(Icon, { name: "play.circle.fill", size: 22, color: C.accent })] }));
}
/** 合集行（艺人 / 专辑 / 歌单）：44×44 封面，**艺人是圆形**。 */
export function CollectionRow({ item, onClick, onLongPress, rowId }) {
    const press = useLongPress(() => onLongPress && onLongPress());
    const circular = item.type === 'artist';
    return (_jsxs("div", { className: "mu-press", "aria-label": "audioCollectionRow", "data-row-id": rowId, style: { display: 'flex', alignItems: 'center', gap: 12, padding: `8px ${SPACE.s4}px` }, ...press.bind, onClick: () => { if (!press.consumed() && onClick)
            onClick(); }, children: [_jsx(Artwork, { url: item.artworkUrl, size: 44, radius: circular ? 22 : 6, iconSize: 18 }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 1 auto' }, children: [_jsx("span", { className: "mu-clamp-1", style: { fontSize: 14, fontWeight: 500, color: C.ink }, children: item.title || item.name }), item.artist || item.curator ? (_jsx("span", { className: "mu-clamp-1", style: { fontSize: 11, color: C.muted }, children: item.artist || item.curator })) : null] }), _jsx(Icon, { name: "chevron.right", size: 13, color: C.muted })] }));
}
/** 本地曲库的曲目行（§2.8）：44 封面 + 「艺人 · 专辑」+ 音质标签。 */
export function LocalTrackRow({ track, onClick, onLongPress }) {
    const press = useLongPress(() => onLongPress && onLongPress());
    const badge = losslessBadge(track.codec);
    return (_jsxs("div", { className: "mu-press", style: { display: 'flex', alignItems: 'center', gap: 12, padding: `6px ${SPACE.s4}px`, height: 60 }, ...press.bind, onClick: () => { if (!press.consumed() && onClick)
            onClick(); }, children: [_jsx(Artwork, { url: track.artworkUrl, size: 44, radius: 8, iconSize: 14 }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto' }, children: [_jsx("span", { className: "mu-clamp-1", style: { fontSize: 15, color: C.ink }, children: track.title }), _jsx("span", { className: "mu-clamp-1", style: { fontSize: 12, color: C.muted }, children: trackSubtitle(track) })] }), badge ? (_jsx("span", { style: {
                    fontSize: 9, color: C.accent, padding: '2px 5px', borderRadius: 999,
                    background: `color-mix(in srgb, ${C.accent} 12%, transparent)`, flex: '0 0 auto',
                }, children: badge })) : null] }));
}
/** 专辑/歌单详情里的曲目行（§2.11）：序号 + 标题/艺人 + 时长。 */
export function NumberedTrackRow({ index, track, onClick, onLongPress, numberWidth = 28 }) {
    const press = useLongPress(() => onLongPress && onLongPress());
    return (_jsxs("div", { className: "mu-press", style: { display: 'flex', alignItems: 'center', gap: 12, padding: `10px ${SPACE.s4}px` }, ...press.bind, onClick: () => { if (!press.consumed() && onClick)
            onClick(); }, children: [_jsx("span", { className: "mu-mono", style: { fontSize: 13, color: C.muted, width: numberWidth, textAlign: 'right' }, children: index + 1 }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 1 auto' }, children: [_jsx("span", { className: "mu-clamp-1", style: { fontSize: 14, color: C.ink }, children: track.title }), track.artist ? _jsx("span", { className: "mu-clamp-1", style: { fontSize: 11, color: C.muted }, children: track.artist }) : null] }), Number(track.duration) > 0 ? (_jsx("span", { className: "mu-mono", style: { fontSize: 11, color: C.muted }, children: fmtDuration(track.duration) })) : null] }));
}
export function Divider({ inset = 16 }) {
    return _jsx("div", { style: { height: 0.5, background: C.line, marginLeft: inset } });
}
