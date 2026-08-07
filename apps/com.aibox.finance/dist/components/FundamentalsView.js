import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 基本面区块 —— 规格 §4。
//
// **仅 A 股渲染**：港股/美股/基金整个区块不出现，尽管底层财务接口支持港美股
// （UI 层写死了 market == ashare，§15 第 12 条）。
// 懒加载：同一 canonical 只拉一次；四张卡各自「无数据就整卡不渲染」。
import React from 'react';
import { BarChart } from './Chart.js';
import { Card, Spinner, Stat } from './primitives.js';
import { C, RADIUS, SPACE } from './theme.js';
import { formatCompactCurrency, formatPercent, formatPrice, trendColor } from '../lib/format.js';
import { fetchAnnouncements, fetchDividends, fetchFinancials } from '../lib/providers/eastmoney.js';
import { fetchFundFlow } from '../lib/providers/push2.js';
import { canonicalOf, secid } from '../lib/symbol.js';
const FLOW_DAYS = 20;
export default function FundamentalsView({ ctx, symbol }) {
    const { t, settings } = ctx;
    const canonical = canonicalOf(symbol);
    const [state, setState] = React.useState({
        loading: true,
        financials: [],
        flows: [],
        dividends: [],
        announcements: [],
    });
    React.useEffect(() => {
        if (symbol.market !== 'ashare')
            return undefined;
        let cancelled = false;
        setState({ loading: true, financials: [], flows: [], dividends: [], announcements: [] });
        const run = async () => {
            // 四个接口串行 await（对齐原生；也避免一次打爆免费源的限频）。
            const financials = await fetchFinancials(symbol);
            const flows = await fetchFundFlow(secid(symbol), 60);
            const dividends = await fetchDividends(symbol);
            const announcements = await fetchAnnouncements(symbol, 20);
            if (cancelled)
                return;
            setState({ loading: false, financials, flows, dividends, announcements });
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [canonical, symbol]);
    if (symbol.market !== 'ashare')
        return null;
    if (state.loading) {
        return (_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: `${SPACE.s5}px 0` }, children: _jsx(Spinner, { size: 18, color: C.muted }) }));
    }
    const latest = state.financials[0];
    const recentFlows = state.flows.slice(-FLOW_DAYS);
    const cumulative = recentFlows.reduce((sum, row) => sum + row.mainNet, 0);
    const upIsRed = settings.upIsRed;
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4 }, children: [latest ? (_jsx(Card, { title: t('finance.fin.title'), subtitle: latest.periodName, children: _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SPACE.s3 }, children: [_jsx(Stat, { label: t('finance.fin.revenue'), value: _jsxs("span", { style: { display: 'flex', alignItems: 'baseline', gap: 5 }, children: [formatCompactCurrency(latest.revenue, latest.currency), _jsx("span", { className: "fin-mono", style: { fontSize: 12, color: trendColor(latest.revenueYoY, upIsRed) }, children: formatPercent(latest.revenueYoY) })] }) }), _jsx(Stat, { label: t('finance.fin.netprofit'), value: _jsxs("span", { style: { display: 'flex', alignItems: 'baseline', gap: 5 }, children: [formatCompactCurrency(latest.netProfit, latest.currency), _jsx("span", { className: "fin-mono", style: { fontSize: 12, color: trendColor(latest.netProfitYoY, upIsRed) }, children: formatPercent(latest.netProfitYoY) })] }) }), _jsx(Stat, { label: t('finance.fin.roe'), value: formatPercent(latest.roe, false) }), _jsx(Stat, { label: t('finance.fin.gross'), value: formatPercent(latest.grossMargin, false) }), _jsx(Stat, { label: t('finance.fin.eps'), value: formatPrice(latest.eps, 2) }), _jsx(Stat, { label: t('finance.fin.bps'), value: formatPrice(latest.bps, 2) })] }) })) : null, recentFlows.length > 0 ? (_jsxs(Card, { title: t('finance.flow.title'), children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: SPACE.s2, marginBottom: SPACE.s2 }, children: [_jsx("span", { style: { fontSize: 12, color: C.muted }, children: t('finance.flow.mainCum') }), _jsx("span", { className: "fin-mono", style: { fontSize: 15, fontWeight: 500, color: trendColor(cumulative, upIsRed) }, children: formatCompactCurrency(cumulative, 'CNY') })] }), _jsx(BarChart, { values: recentFlows.map((row) => row.mainNet / 1e8), height: 90, upIsRed: upIsRed })] })) : null, state.dividends.length > 0 ? (_jsx(Card, { title: t('finance.div.title'), children: state.dividends.slice(0, 5).map((row) => (_jsxs("div", { style: { display: 'flex', gap: SPACE.s2, padding: '4px 0' }, children: [_jsx("span", { className: "fin-mono", style: { fontSize: 12, color: C.muted, width: 82, flex: '0 0 auto' }, children: row.reportDate }), _jsx("span", { className: "fin-clamp-2", style: { fontSize: 12, color: C.ink }, children: row.plan })] }, `${row.reportDate}-${row.plan}`))) })) : null, state.announcements.length > 0 ? (_jsx(Card, { title: t('finance.news.annTitle'), children: state.announcements.slice(0, 6).map((row) => (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2, padding: '5px 0' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("span", { className: "fin-mono", style: { fontSize: 12, color: C.muted }, children: row.date }), row.kind ? (_jsx("span", { style: {
                                        fontSize: 12,
                                        color: C.brand,
                                        padding: '1px 5px',
                                        borderRadius: RADIUS.pill,
                                        background: 'color-mix(in srgb, var(--fin-brand) 10%, transparent)',
                                    }, children: row.kind })) : null] }), _jsx("span", { className: "fin-clamp-2", style: { fontSize: 12, color: C.ink }, children: row.title })] }, row.id))) })) : null] }));
}
