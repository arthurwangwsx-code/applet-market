import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 视频卡片。对标 YouTube App 的横向列表卡：左缩略图 16:9，右标题两行 + 频道 + 观看数。
//
// 卡片高度**固定**（虚拟列表靠估高定位，行高一变就跳），标题用 `.yt-clamp2` 截两行正是为此。
import React from 'react';
import { C, RADIUS, SPACE } from './theme.js';
import { imageURL } from '../lib/host.js';
const COVER_W = 152;
const COVER_H = 86;
export const CARD_HEIGHT = COVER_H + SPACE.s3 * 2;
export default function VideoCard({ video, onOpen }) {
    return (_jsxs("div", { className: "yt-press", "data-row-id": video.id, onClick: () => onOpen?.(video), style: {
            display: 'flex',
            gap: SPACE.s3,
            padding: `${SPACE.s3}px ${SPACE.s4}px`,
            alignItems: 'flex-start',
            boxSizing: 'border-box',
            height: CARD_HEIGHT,
        }, children: [_jsxs("div", { style: {
                    position: 'relative', width: COVER_W, height: COVER_H, flexShrink: 0,
                    borderRadius: RADIUS.md, overflow: 'hidden', background: C.surface,
                }, children: [video.cover ? (_jsx("img", { src: imageURL(video.cover, COVER_W), alt: "", loading: "lazy", style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } })) : null, video.durationLabel ? (_jsx("span", { style: {
                            position: 'absolute', right: 4, bottom: 4, padding: '1px 5px',
                            borderRadius: RADIUS.sm, background: 'rgba(0,0,0,0.75)', color: '#fff',
                            fontSize: 11, fontVariantNumeric: 'tabular-nums',
                        }, children: video.durationLabel })) : null] }), _jsxs("div", { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: COVER_H }, children: [_jsx("div", { className: "yt-clamp2", style: { fontSize: 14, lineHeight: 1.35, color: C.text, fontWeight: 500 }, children: video.title }), _jsx("div", { style: { flex: 1 } }), video.author ? (_jsx("div", { style: {
                            fontSize: 12, color: C.faint, whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                        }, children: video.author })) : null, _jsx("div", { style: { fontSize: 12, color: C.faint, marginTop: 2 }, children: [video.viewLabel, video.published].filter(Boolean).join(' · ') })] })] }));
}
