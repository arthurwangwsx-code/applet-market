import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 事件簇详情（对应 NewsClusterDetailView）：首段事件标题 + 「N 篇报道」，
// 第二段列出簇内全部文章（发布时间倒序）；长按菜单只有「AI 分析」+「收藏 / 取消收藏」。
import React from 'react';
import ArticleList from './ArticleList.js';
import { SectionHeader } from './primitives.js';
import { C, SPACE } from './theme.js';
export default function ClusterDetail({ ctx, cluster }) {
    const articles = React.useMemo(() => [...cluster.articles].sort((a, b) => b.publishedAt - a.publishedAt), [cluster]);
    const items = React.useMemo(() => articles.map((article) => ({ id: article.id, lead: article, related: [] })), [articles]);
    const menuFor = React.useCallback((article) => {
        const actions = [];
        if (ctx.hasAI) {
            actions.push({
                key: 'analyze',
                icon: 'sparkles',
                label: ctx.t('news.action.analyze'),
                onSelect: () => ctx.actions.analyze(article),
            });
        }
        const saved = ctx.savedKeys.has(article.id);
        actions.push({
            key: 'save',
            icon: saved ? 'bookmark.slash' : 'bookmark',
            label: ctx.t(saved ? 'news.action.unsave' : 'news.action.save'),
            onSelect: () => ctx.actions.toggleSaved(article),
        });
        return actions;
    }, [ctx]);
    return (_jsxs("div", { className: "news-scroll", children: [_jsxs("div", { style: { padding: `${SPACE.s4}px ${SPACE.s4}px ${SPACE.s3}px`, display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx("span", { style: { fontSize: 18, fontWeight: 500, color: C.ink, lineHeight: 1.3 }, children: cluster.title }), _jsx("span", { style: { fontSize: 13, color: C.muted }, children: ctx.t('news.cluster.reportCount', articles.length) })] }), _jsx(SectionHeader, { children: ctx.t('news.cluster.sources') }), _jsx(ArticleList, { items: items, ctx: ctx, menuFor: menuFor }), _jsx("div", { style: { height: 24 } })] }));
}
