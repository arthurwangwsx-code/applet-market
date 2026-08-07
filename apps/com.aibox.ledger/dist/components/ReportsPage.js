import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 报表页（LedgerReportsView）+ 下钻列表（LedgerFilteredTransactionsView）。
// 布局：月份条 → 收支切换 → 总额卡 →（占比卡）→（趋势卡）→（排行卡）。
import React from 'react';
import Icon, { IconBadge } from './Icon.js';
import { Card, Divider, EmptyState, MonthBar, Segmented } from './primitives.js';
import { ChartLegend, DonutChart, TimeBarChart, bucketColor } from './Charts.js';
import { C, SPACE, alpha } from './theme.js';
import { KIND } from '../lib/store.js';
import { buckets } from '../lib/queries.js';
import { monthFlowTransactions } from '../lib/reporting.js';
import { addMonths, monthKeyNow, monthTitle, shortDate } from '../lib/dates.js';
import { money } from '../lib/money.js';
import { entryPathTitle } from '../lib/display.js';
export default function ReportsPage({ ctx }) {
    const { store, t, locale, actions } = ctx;
    const [monthKey, setMonthKey] = React.useState(monthKeyNow);
    const [metric, setMetric] = React.useState('expense');
    const [drill, setDrill] = React.useState(null);
    const rows = React.useMemo(() => monthFlowTransactions(store, monthKey), [store, store.revision, monthKey]);
    const labels = { uncategorized: t('x.uncategorized'), noTag: t('x.noTag'), noProject: t('x.noProject') };
    const categoryBuckets = React.useMemo(() => buckets(store, rows, 'byCategory', metric, locale, labels), [store, rows, metric, locale]);
    const dayBuckets = React.useMemo(() => buckets(store, rows, 'byDay', metric, locale, labels), [store, rows, metric, locale]);
    const total = categoryBuckets.reduce((sum, bucket) => sum + bucket.amountMinor, 0);
    const isEmpty = rows.length === 0;
    if (drill) {
        return _jsx(DrillDown, { ctx: ctx, monthKey: monthKey, metric: metric, bucket: drill, onBack: () => setDrill(null) });
    }
    return (_jsx("div", { className: "lg-scroll", style: { flex: '1 1 auto' }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 96 }, children: [_jsx(MonthBar, { title: monthTitle(monthKey, locale), onPrevious: () => setMonthKey((key) => addMonths(key, -1)), onNext: () => setMonthKey((key) => addMonths(key, 1)), nextDisabled: monthKey >= monthKeyNow() }), _jsx(Segmented, { value: metric, onChange: setMetric, items: [
                        { id: 'expense', label: t('x.expense') },
                        { id: 'income', label: t('x.income') },
                    ] }), isEmpty ? (_jsx(EmptyState, { icon: "chart.pie", title: t('rep.emptyTitle'), body: t('rep.emptyBody') })) : (_jsxs(_Fragment, { children: [_jsx(Card, { children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }, children: [_jsx("span", { style: { fontSize: 12, color: C.muted }, children: metric === 'expense' ? t('rep.totalSpending') : t('rep.totalIncome') }), _jsx("span", { className: "lg-mono", style: { fontSize: 30, fontWeight: 500, color: metric === 'expense' ? C.expense : C.income }, children: money(total, store.baseCode) })] }) }), categoryBuckets.length > 0 ? (_jsxs(Card, { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: SPACE.s3 }, children: t('rep.byCategory') }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s4 }, children: [_jsx(DonutChart, { buckets: categoryBuckets, size: 150 }), _jsx(ChartLegend, { buckets: categoryBuckets, currency: store.baseCode })] })] })) : null, dayBuckets.length >= 2 ? (_jsxs(Card, { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: SPACE.s3 }, children: t('rep.dailyTrend') }), _jsx(TimeBarChart, { buckets: dayBuckets, currency: store.baseCode, height: 170, color: metric === 'expense' ? C.expense : C.income })] })) : null, categoryBuckets.length > 0 ? (_jsxs(Card, { padding: 0, children: [_jsx("div", { style: {
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: C.muted,
                                        padding: `${SPACE.s4}px ${SPACE.s4}px ${SPACE.s2}px`,
                                    }, children: t('rep.ranking') }), categoryBuckets.slice(0, 10).map((bucket, index) => (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, { inset: SPACE.s4 }) : null, _jsxs("button", { type: "button", className: "lg-btn", onClick: () => setDrill(bucket), style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: SPACE.s3,
                                                width: '100%',
                                                padding: `11px ${SPACE.s4}px`,
                                            }, children: [_jsx("span", { style: {
                                                        width: 9,
                                                        height: 9,
                                                        borderRadius: 4.5,
                                                        flex: '0 0 auto',
                                                        background: bucketColor(bucket, index),
                                                    } }), _jsx("span", { className: "lg-clamp-1", style: { fontSize: 15, color: C.ink, flex: '1 1 auto', minWidth: 0 }, children: bucket.label }), total > 0 ? (_jsxs("span", { className: "lg-mono", style: { fontSize: 12, color: C.muted }, children: [Math.round((Math.abs(bucket.amountMinor) / Math.abs(total)) * 100), "%"] })) : null, _jsx("span", { className: "lg-mono", style: { fontSize: 14, fontWeight: 500, color: C.ink }, children: money(Math.abs(bucket.amountMinor), store.baseCode) }), _jsx(Icon, { name: "chevron.right", size: 10, color: C.muted })] })] }, bucket.key)))] })) : null] }))] }) }));
}
/** 下钻列表：该月 + metric 对应 kind +（若来自分类桶）一级分类或其子分类。 */
function DrillDown({ ctx, monthKey, metric, bucket, onBack, }) {
    const { store, t, locale, actions } = ctx;
    const rows = React.useMemo(() => monthFlowTransactions(store, monthKey).filter((txn) => {
        if (metric === 'expense' && txn.kind !== KIND.expense)
            return false;
        if (metric === 'income' && txn.kind !== KIND.income)
            return false;
        if (bucket.key === '__uncat__')
            return !txn.categoryID;
        const root = store.rootCategoryID(txn.categoryID);
        return txn.categoryID === bucket.key || root === bucket.key;
    }), [store, store.revision, monthKey, metric, bucket]); // eslint-disable-line react-hooks/exhaustive-deps
    return (_jsx("div", { className: "lg-scroll", style: { flex: '1 1 auto' }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3, padding: SPACE.s4, paddingBottom: 96 }, children: [_jsxs("button", { type: "button", className: "lg-btn", onClick: onBack, style: { display: 'flex', alignItems: 'center', gap: 4, color: C.brand, fontSize: 15 }, children: [_jsx(Icon, { name: "chevron.left", size: 14, color: C.brand }), _jsx("span", { children: monthTitle(monthKey, locale) })] }), rows.length === 0 ? (_jsx(EmptyState, { icon: "list.bullet.rectangle", title: t('tx.noMatchTitle'), body: t('rep.drillEmptyBody') })) : (_jsxs(_Fragment, { children: [_jsx(Card, { padding: 0, children: rows.map((txn, index) => {
                                const category = txn.categoryID ? store.category(txn.categoryID) : null;
                                const color = category ? category.colorHex : C.brand;
                                return (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, { inset: 48 }) : null, _jsxs("button", { type: "button", className: "lg-btn", onClick: () => actions.editEntry(txn), style: { display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }, children: [_jsx(IconBadge, { name: category ? category.systemImage || 'tag' : 'tag', size: 34, color: color, background: category ? alpha(category.colorHex, 0.16) : undefined, style: category ? undefined : { background: 'color-mix(in srgb, var(--lg-brand) 16%, transparent)' } }), _jsxs("div", { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("span", { className: "lg-clamp-1", style: { fontSize: 15, color: C.ink }, children: entryPathTitle(store, txn, t) }), _jsx("span", { className: "lg-clamp-1", style: { fontSize: 12, color: C.muted }, children: [store.account(txn.accountID)?.name, txn.note].filter(Boolean).join(' · ') })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }, children: [_jsx("span", { className: "lg-mono", style: { fontSize: 14, fontWeight: 500, color: C.ink }, children: money(txn.kind === KIND.income ? txn.amountMinor : -txn.amountMinor, txn.currency, {
                                                                signed: txn.kind === KIND.income,
                                                            }) }), _jsx("span", { className: "lg-mono", style: { fontSize: 10, color: C.muted }, children: shortDate(txn.occurredOn, locale) })] })] })] }, txn.id));
                            }) }), _jsx("span", { style: { fontSize: 12, color: C.muted, padding: '0 4px', lineHeight: 1.4 }, children: t('rep.drillFooter') })] }))] }) }));
}
