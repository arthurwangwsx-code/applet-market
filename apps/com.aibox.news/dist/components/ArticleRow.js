import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 时间线 / 收藏 / 事件详情共用的文章行（对应 NewsArticleRow.swift）。
// 状态槽互斥：正在朗读 → speaker.wave.2.fill；否则未读 → 6×6 品牌色圆点；已读 → 无标记。
import React from 'react';
import Icon from './Icon.js';
import { C, SPACE } from './theme.js';
import { relative } from '../lib/format.js';
import { imageURL } from '../lib/host.js';
const THUMB = 80;
function Thumbnail({ url, isRead, blockedLabel }) {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => { setFailed(false); }, [url]);
    return (_jsxs("div", { style: {
            position: 'relative',
            width: THUMB,
            height: THUMB,
            borderRadius: 11,
            overflow: 'hidden',
            background: 'color-mix(in srgb, var(--news-line) 55%, transparent)',
            opacity: isRead ? 0.72 : 1,
            flex: '0 0 auto',
        }, children: [_jsx("div", { style: {
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: C.muted,
                }, children: _jsx(Icon, { name: "photo", size: 20, title: failed ? blockedLabel : undefined }) }), failed ? null : (_jsx("img", { 
                // 必须走 applet:// 字节通道 —— secure 模式的 CSP 直接挡死远端 https 图片。
                src: imageURL(url, THUMB), alt: "", loading: "lazy", onError: () => setFailed(true), style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }))] }));
}
export default function ArticleRow({ article, isRead, relatedCount = 0, isSaved = false, isSpeaking = false, locale, t, now, }) {
    const summary = article.summary || '';
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: SPACE.s3, padding: '6px 0' }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, flex: '1 1 auto' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }, children: [isSpeaking ? (_jsx(Icon, { name: "speaker.wave.2.fill", size: 12, color: C.brand, style: { position: 'relative', top: 1 }, title: t('news.broadcast.nowReading') })) : (!isRead ? (_jsx("span", { style: {
                                    width: 6, height: 6, borderRadius: 3, background: C.brand,
                                    flex: '0 0 auto', position: 'relative', top: -2,
                                } })) : null), _jsx("span", { className: "news-clamp-3", style: { fontSize: 16, fontWeight: 500, lineHeight: 1.32, color: isRead ? C.muted : C.ink, minWidth: 0 }, children: article.title })] }), summary ? (_jsx("span", { className: "news-clamp-2", style: { fontSize: 12, lineHeight: 1.38, color: C.muted }, children: summary })) : null, _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'nowrap' }, children: [_jsx("span", { className: "news-clamp-1", style: { fontSize: 12, color: C.brand, minWidth: 0 }, children: article.sourceName }), _jsx("span", { style: { fontSize: 12, color: C.muted, flex: '0 0 auto' }, children: "\u00B7" }), _jsx("span", { className: "news-mono", style: { fontSize: 12, color: C.muted, flex: '0 0 auto' }, children: relative(article.publishedAt, locale, now) }), relatedCount > 0 ? (_jsxs("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: C.muted, flex: '0 0 auto' }, "aria-label": t('news.cluster.reportCount', relatedCount + 1), children: [_jsx(Icon, { name: "rectangle.stack", size: 12 }), relatedCount + 1] })) : null, isSaved ? (_jsx(Icon, { name: "bookmark.fill", size: 11, color: C.brand, title: t('news.saved.favorites') })) : null] })] }), article.imageURL ? (_jsx(Thumbnail, { url: article.imageURL, isRead: isRead, blockedLabel: t('news.x.imageBlocked') })) : null] }));
}
