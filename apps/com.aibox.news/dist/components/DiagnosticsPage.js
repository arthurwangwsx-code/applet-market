import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 资讯诊断（对应 NewsDiagnosticsView）：概览 → 最近一次刷新 → 逐源状态 → 立即刷新 / 清除缓存。
import React from 'react';
import Icon from './Icon.js';
import { Card, Row, SectionFooter, SectionHeader } from './primitives.js';
import { C, SPACE } from './theme.js';
import { bytes, duration, relative } from '../lib/format.js';
const STATUS_META = {
    success: { icon: 'checkmark.circle', color: C.brand, key: 'news.diagnostics.success' },
    empty: { icon: 'minus.circle', color: C.orange, key: 'news.diagnostics.empty' },
    failed: { icon: 'exclamationmark.circle', color: C.danger, key: 'news.diagnostics.failed' },
};
function failureText(state, t) {
    if (!state.failure)
        return null;
    if (state.failure === 'http' && state.httpStatus)
        return `HTTP ${state.httpStatus}`;
    return t(`news.diagnostics.failure.${state.failure}`);
}
export default function DiagnosticsPage({ ctx }) {
    const { agg, t, locale, now } = ctx;
    const report = agg.lastReport;
    const enabledCount = ctx.store.enabledFeeds.length;
    return (_jsxs("div", { className: "news-scroll", children: [_jsx(SectionHeader, { children: t('news.diagnostics.overview') }), _jsxs(Card, { children: [_jsx(Row, { title: t('news.diagnostics.lastUpdate'), detail: agg.lastUpdated ? relative(agg.lastUpdated, locale, now) : t('news.diagnostics.never') }), _jsx(Row, { title: t('news.diagnostics.timelineCount'), detail: agg.timeline.length }), _jsx(Row, { title: t('news.diagnostics.enabledSources'), detail: enabledCount }), _jsx(Row, { title: t('news.diagnostics.clustering'), detail: ctx.settings.clustering ? t('news.diagnostics.available') : t('news.diagnostics.disabled') }), _jsx(Row, { title: t('news.diagnostics.cache'), detail: bytes(ctx.store.contentCacheBytes()), last: true })] }), _jsx(SectionHeader, { children: t('news.diagnostics.lastRun') }), report ? (_jsxs(_Fragment, { children: [_jsxs(Card, { children: [_jsx(Row, { title: t('news.diagnostics.duration'), detail: duration((report.finishedAt - report.startedAt) / 1000, t) }), _jsx(Row, { title: t('news.diagnostics.fetchDuration'), detail: duration(report.fetchDuration, t) }), _jsx(Row, { title: t('news.diagnostics.processingDuration'), detail: duration(report.processingDuration, t) }), _jsx(Row, { title: t('news.diagnostics.enrichmentDuration'), detail: report.enrichmentDuration === null ? '—' : duration(report.enrichmentDuration, t) }), _jsx(Row, { title: t('news.diagnostics.fetched'), detail: report.fetchedArticleCount }), _jsx(Row, { title: t('news.diagnostics.duplicates'), detail: report.duplicateCount }), _jsx(Row, { title: t('news.diagnostics.clustered'), detail: report.clusteredArticleCount }), _jsx(Row, { title: t('news.diagnostics.successSources'), detail: report.sourceStates.filter((row) => row.status === 'success').length }), _jsx(Row, { title: t('news.diagnostics.emptySources'), detail: report.sourceStates.filter((row) => row.status === 'empty').length }), _jsx(Row, { title: t('news.diagnostics.failedSources'), detail: report.sourceStates.filter((row) => row.status === 'failed').length, last: true })] }), _jsx(SectionFooter, { children: t('news.diagnostics.emptyFooter') })] })) : (_jsx(Card, { children: _jsx(Row, { title: t('news.diagnostics.noSourceData'), last: true }) })), _jsx(SectionHeader, { children: t('news.diagnostics.sources') }), _jsx(Card, { children: report && report.sourceStates.length > 0 ? report.sourceStates.map((state, i) => {
                    const meta = STATUS_META[state.status] || STATUS_META.failed;
                    const failure = failureText(state, t);
                    return (_jsxs("div", { style: {
                            display: 'flex', alignItems: 'center', gap: SPACE.s3,
                            padding: `10px ${SPACE.s4}px`,
                            borderBottom: i === report.sourceStates.length - 1 ? 'none' : `0.5px solid ${C.line}`,
                        }, children: [_jsx(Icon, { name: meta.icon, size: 16, color: meta.color }), _jsxs("span", { style: { display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto', minWidth: 0 }, children: [_jsx("span", { className: "news-clamp-1", style: { fontSize: 15, color: C.ink }, children: state.sourceName }), _jsx("span", { className: "news-mono", style: { fontSize: 12, color: C.muted }, children: t('news.diagnostics.sourceDetail', state.itemCount, duration(state.duration, t)) }), failure ? _jsx("span", { style: { fontSize: 12, color: C.danger }, children: failure }) : null] }), _jsx("span", { style: { fontSize: 13, color: meta.color, flex: '0 0 auto' }, children: t(meta.key) })] }, `${state.id}-${state.sourceName}`));
                }) : (_jsx(Row, { title: t('news.diagnostics.noSourceData'), last: true })) }), _jsx("div", { style: { height: SPACE.s5 } }), _jsxs(Card, { children: [_jsx(Row, { icon: "arrow.clockwise", iconColor: C.brand, title: t('news.diagnostics.refreshNow'), onClick: () => ctx.actions.refresh(true), accessory: null }), _jsx(Row, { icon: "trash", iconColor: C.danger, title: t('news.subs.cache.clear'), danger: true, onClick: () => ctx.actions.clearContentCache(), accessory: null, last: true })] }), _jsx("div", { style: { height: 32 } })] }));
}
