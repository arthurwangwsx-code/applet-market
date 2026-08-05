import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 订阅页：首段「设置 / 添加订阅源」两行 + 按分类分组的源列表（只显示有源的分类）。
// 源行：左主题图标 + 三行文字（源名 / kind · endpoint / 状态）+ 右侧 chevron 与开关。
// 点行下钻该源文章列表；长按 = 上移 / 下移 / 删除；左滑 = 删除。内置源也能删。
import React from 'react';
import Icon from './Icon.js';
import { ActionSheet, Card, Row, SectionHeader, SwipeRow, Toggle, useLongPress } from './primitives.js';
import { C, SPACE } from './theme.js';
import { TOPIC_ICON, TOPIC_ORDER, topicKey } from '../lib/catalog.js';
import { relative } from '../lib/format.js';
function statusFor(feed, state, ctx) {
    if (!feed.enabled)
        return { icon: 'pause.circle', text: ctx.t('news.source.paused'), color: C.muted };
    if (state) {
        if (state.status === 'success') {
            return { icon: 'checkmark.circle', text: ctx.t('news.source.updatedItems', state.itemCount), color: C.brand };
        }
        if (state.status === 'failed') {
            return { icon: 'exclamationmark.circle', text: ctx.t('news.source.failed'), color: C.danger };
        }
        return { icon: 'minus.circle', text: ctx.t('news.source.noItems'), color: C.orange };
    }
    if (!feed.lastFetched)
        return { icon: 'clock', text: ctx.t('news.source.never'), color: C.muted };
    return { icon: 'clock', text: relative(feed.lastFetched, ctx.locale, ctx.now), color: C.muted };
}
function SourceRow({ feed, ctx, state, last }) {
    const [menu, setMenu] = React.useState(false);
    const status = statusFor(feed, state, ctx);
    const press = useLongPress(() => setMenu(true), () => ctx.actions.navigate({ name: 'source', feed }));
    return (_jsxs(_Fragment, { children: [_jsx(SwipeRow, { actionLabel: ctx.t('news.action.delete'), onAction: () => ctx.actions.removeFeed(feed.id), children: _jsxs("div", { className: "news-press", style: {
                        display: 'flex', alignItems: 'center', gap: SPACE.s3,
                        padding: `10px ${SPACE.s4}px`, background: C.surface,
                        borderBottom: last ? 'none' : `0.5px solid ${C.line}`,
                    }, ...press, children: [_jsx("span", { style: { width: 22, display: 'flex', justifyContent: 'center', flex: '0 0 auto' }, children: _jsx(Icon, { name: TOPIC_ICON[feed.topic] || 'newspaper', size: 14, color: C.brand }) }), _jsxs("span", { style: { display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto', minWidth: 0 }, children: [_jsx("span", { className: "news-clamp-1", style: { fontSize: 15, color: C.ink }, children: feed.title }), _jsx("span", { className: "news-clamp-1", style: { fontSize: 12, color: C.muted }, children: `${feed.kind} · ${feed.endpoint}` }), _jsxs("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: status.color }, children: [_jsx(Icon, { name: status.icon, size: 12 }), status.text] })] }), _jsx(Icon, { name: "chevron.right", size: 12, color: C.muted }), _jsx(Toggle, { checked: feed.enabled, label: feed.title, onChange: (next) => ctx.actions.setFeedEnabled(feed.id, next) })] }) }), _jsx(ActionSheet, { visible: menu, title: feed.title, cancelLabel: ctx.t('news.action.cancel'), onClose: () => setMenu(false), actions: [
                    { key: 'up', icon: 'arrow.up', label: ctx.t('news.action.moveUp'), onSelect: () => ctx.actions.moveFeed(feed.id, -1) },
                    { key: 'down', icon: 'arrow.down', label: ctx.t('news.action.moveDown'), onSelect: () => ctx.actions.moveFeed(feed.id, 1) },
                    { key: 'delete', icon: 'trash', label: ctx.t('news.action.delete'), danger: true, onSelect: () => ctx.actions.removeFeed(feed.id) },
                ] })] }));
}
export default function SourcesPage({ ctx }) {
    const statesByID = React.useMemo(() => {
        const map = new Map();
        const report = ctx.agg.lastReport;
        if (report)
            for (const state of report.sourceStates)
                map.set(state.id, state);
        return map;
    }, [ctx.agg.lastReport, ctx.agg.timelineRevision]); // eslint-disable-line react-hooks/exhaustive-deps
    const groups = React.useMemo(() => {
        const byTopic = new Map();
        for (const feed of ctx.store.feeds) {
            if (!byTopic.has(feed.topic))
                byTopic.set(feed.topic, []);
            byTopic.get(feed.topic).push(feed);
        }
        return TOPIC_ORDER
            .filter((topic) => (byTopic.get(topic) || []).length > 0)
            .map((topic) => ({
            topic,
            feeds: [...byTopic.get(topic)].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
        }));
    }, [ctx.store.feeds, ctx.storeVersion]); // eslint-disable-line react-hooks/exhaustive-deps
    return (_jsxs("div", { className: "news-scroll", children: [_jsx("div", { style: { height: SPACE.s3 } }), _jsxs(Card, { children: [_jsx(Row, { icon: "gearshape", title: ctx.t('news.subs.settings'), onClick: () => ctx.actions.navigate({ name: 'settings' }) }), _jsx(Row, { icon: "plus.circle", iconColor: C.brand, title: ctx.t('news.add.nav'), onClick: () => ctx.actions.navigate({ name: 'addSource' }), last: true })] }), groups.map((group) => (_jsxs("div", { children: [_jsx(SectionHeader, { children: ctx.t(topicKey(group.topic)) }), _jsx(Card, { children: group.feeds.map((feed, i) => (_jsx(SourceRow, { feed: feed, ctx: ctx, state: statesByID.get(feed.id), last: i === group.feeds.length - 1 }, feed.id))) })] }, group.topic))), _jsx("div", { style: { height: 32 } })] }));
}
