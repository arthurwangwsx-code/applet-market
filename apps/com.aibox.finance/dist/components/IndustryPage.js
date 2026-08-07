import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 行业页 —— 规格 §5。
//
// ⚠️ 这一页的数据源（push2 / push2ex）**只在中国大陆网络下通**。所以：
//  · 进页**先从磁盘快照 hydrate 当前段**再拉网络（stale-while-revalidate 的「先显缓存」半程）；
//  · 拉不到就优雅回退到缓存/空态，**不要转圈到超时**（§15 第 11 条）；
//  · 拉取中且无数据才显转圈——不要一进来就显「暂无数据」。
//
// 北向资金面板**不做**（§8.7：官方 2024-08 已停更，字段全 null，原生也放弃了）。
import React from 'react';
import { Chip, EmptyState, PullRefresh, Segmented, Sheet, SheetHeader, Spinner, Stat } from './primitives.js';
import Icon from './Icon.js';
import { C, SPACE } from './theme.js';
import { formatCompactCurrency, formatPercent, formatShortStamp, trendColor } from '../lib/format.js';
import { fetchBreadth, fetchConstituents, fetchMoneyRank, fetchSectors } from '../lib/providers/push2.js';
import { fetchDragonBoard } from '../lib/providers/eastmoney.js';
import { exchangeForAShare } from '../lib/symbol.js';
const SEGMENTS = ['sectors', 'money', 'dragon'];
function Divider() {
    return _jsx("div", { style: { height: 0.5, background: 'color-mix(in srgb, var(--fin-muted) 12%, transparent)' } });
}
/** 通用两栏行：左（名 + 副标题）/ 右（主值 + 次值）。 */
function DataRow({ title, subtitle, primary, primaryColor, secondary, secondaryColor, onClick, }) {
    return (_jsxs("button", { type: "button", className: "fin-btn fin-press", onClick: onClick, style: { display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: '9px 0' }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto' }, children: [_jsx("span", { className: "fin-clamp-1", style: { fontSize: 15, color: C.ink }, children: title }), subtitle ? (_jsx("span", { className: "fin-clamp-1", style: { fontSize: 12, color: C.muted }, children: subtitle })) : null] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: '0 0 auto' }, children: [_jsx("span", { className: "fin-mono", style: { fontSize: 15, fontWeight: 500, color: primaryColor }, children: primary }), _jsx("span", { className: "fin-mono", style: { fontSize: 12, color: secondaryColor || C.muted }, children: secondary })] })] }));
}
export default function IndustryPage({ ctx }) {
    const { t, settings, store, actions } = ctx;
    const upIsRed = settings.upIsRed;
    const scrollRef = React.useRef(null);
    const [segment, setSegment] = React.useState('sectors');
    const [kind, setKind] = React.useState('industry');
    const [sort, setSort] = React.useState('change');
    const [inflow, setInflow] = React.useState(true);
    const [rows, setRows] = React.useState([]);
    const [breadth, setBreadth] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [stale, setStale] = React.useState(false);
    const [updatedAt, setUpdatedAt] = React.useState(null);
    const [sector, setSector] = React.useState(null);
    const cacheKey = `${segment}:${kind}:${sort}:${inflow}`;
    const busy = React.useRef(false);
    const load = React.useCallback(async (force) => {
        if (busy.current)
            return; // 并发保护：loading 时直接返回
        busy.current = true;
        setLoading(true);
        try {
            let fresh = [];
            if (segment === 'sectors')
                fresh = await fetchSectors({ kind, sort, limit: 60 });
            else if (segment === 'money')
                fresh = await fetchMoneyRank({ inflow, limit: 30 });
            else
                fresh = await fetchDragonBoard(40);
            if (fresh.length > 0) {
                setRows(fresh);
                setStale(false);
                setUpdatedAt(Date.now());
                store.persistIndustry(cacheKey, fresh);
            }
            else {
                // 空 → 回退磁盘快照并标 stale；都没有才显空态。
                const cached = await store.loadIndustry(cacheKey);
                if (cached && Array.isArray(cached.payload) && cached.payload.length > 0) {
                    setRows(cached.payload);
                    setStale(true);
                    setUpdatedAt(cached.at);
                }
                else {
                    setRows([]);
                }
            }
            // 情绪横幅只在「首次为空」或 force 时重拉。
            if (breadth === null || force) {
                const sentiment = await fetchBreadth(Date.now());
                if (sentiment)
                    setBreadth(sentiment);
            }
        }
        finally {
            busy.current = false;
            setLoading(false);
        }
    }, [segment, kind, sort, inflow, cacheKey, store, breadth]);
    // 先 hydrate 当前段的磁盘快照秒显，再拉网络。
    React.useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const cached = await store.loadIndustry(cacheKey);
            if (!cancelled && cached && Array.isArray(cached.payload)) {
                setRows(cached.payload);
                setStale(true);
                setUpdatedAt(cached.at);
            }
            if (!cancelled)
                load(false);
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps
    // 自动刷新（默认**关**）：间隔 = max(60, refreshInterval)，循环内用 force=true。
    React.useEffect(() => {
        if (!settings.industryAutoRefresh)
            return undefined;
        const interval = Math.max(60, settings.refreshInterval || 60) * 1000;
        const timer = window.setInterval(() => load(true), interval);
        return () => window.clearInterval(timer);
    }, [settings.industryAutoRefresh, settings.refreshInterval, load]);
    const openSector = React.useCallback((row) => setSector(row), []);
    const openStock = React.useCallback((code, marketFlag) => {
        const exchange = marketFlag === 1 ? 'sh' : marketFlag === 0 ? 'sz' : exchangeForAShare(code);
        actions.openDetail(`${exchange}${code}`);
    }, [actions]);
    return (_jsxs(_Fragment, { children: [_jsx(PullRefresh, { scrollRef: scrollRef, refreshing: loading && rows.length > 0, onRefresh: () => load(true), children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4 }, children: [breadth ? (_jsxs("div", { style: {
                                background: C.surface,
                                borderRadius: 16,
                                padding: SPACE.s4,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: SPACE.s3,
                            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline' }, children: [_jsx("span", { style: { fontSize: 13, color: C.muted, flex: '1 1 auto' }, children: t('finance.senti.title') }), _jsx("span", { className: "fin-mono", style: { fontSize: 12, color: C.muted }, children: breadth.tradeDate })] }), _jsxs("div", { style: { display: 'flex', gap: SPACE.s4, flexWrap: 'wrap' }, children: [_jsx(Stat, { label: t('finance.senti.limitup'), value: breadth.limitUp, valueSize: 17, color: upIsRed ? C.red : C.green }), _jsx(Stat, { label: t('finance.senti.limitdown'), value: breadth.limitDown, valueSize: 17, color: upIsRed ? C.green : C.red }), _jsx(Stat, { label: t('finance.senti.broken'), value: breadth.brokenBoard, valueSize: 17 }), _jsx(Stat, { label: t('finance.senti.sealrate'), value: formatPercent(breadth.limitUpRatio, false), valueSize: 17 }), breadth.maxContBoards > 0 ? (_jsx(Stat, { label: t('finance.senti.contboards'), value: breadth.maxContBoards, valueSize: 17, color: upIsRed ? C.red : C.green })) : null] })] })) : null, _jsx(Segmented, { value: segment, onChange: setSegment, items: SEGMENTS.map((id) => ({ id, label: t(`finance.ind.seg.${id}`) })) }), segment === 'sectors' ? (_jsxs("div", { style: { display: 'flex', gap: SPACE.s2, flexWrap: 'wrap' }, children: [_jsx(Chip, { label: t('finance.ind.kind.industry'), selected: kind === 'industry', onClick: () => setKind('industry') }), _jsx(Chip, { label: t('finance.ind.kind.concept'), selected: kind === 'concept', onClick: () => setKind('concept') }), _jsx("span", { style: { flex: '1 1 auto' } }), _jsx(Chip, { label: t('finance.ind.sort.change'), selected: sort === 'change', onClick: () => setSort('change') }), _jsx(Chip, { label: t('finance.ind.sort.money'), selected: sort === 'moneyflow', onClick: () => setSort('moneyflow') })] })) : null, segment === 'money' ? (_jsxs("div", { style: { display: 'flex', gap: SPACE.s2 }, children: [_jsx(Chip, { label: t('finance.ind.money.inflow'), selected: inflow, onClick: () => setInflow(true) }), _jsx(Chip, { label: t('finance.ind.money.outflow'), selected: !inflow, onClick: () => setInflow(false) })] })) : null, segment === 'dragon' && rows.length > 0 ? (_jsx("span", { className: "fin-mono", style: { fontSize: 12, color: C.muted }, children: rows[0]?.tradeDate })) : null, loading && rows.length === 0 ? (_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: '40px 0' }, children: _jsx(Spinner, { size: 22, color: C.muted }) })) : rows.length === 0 ? (_jsx(EmptyState, { text: t('finance.ind.empty'), padding: 40 })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column' }, children: rows.map((row, index) => (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, {}) : null, segment === 'sectors' ? (_jsx(DataRow, { title: row.name, subtitle: row.leaderName
                                            ? `${t('finance.ind.leader')} ${row.leaderName}`
                                            : null, primary: formatPercent(row.changePct), primaryColor: trendColor(row.changePct, upIsRed), secondary: formatCompactCurrency(row.mainNet, 'CNY'), secondaryColor: trendColor(row.mainNet, upIsRed), onClick: () => openSector(row) })) : segment === 'money' ? (_jsx(DataRow, { title: row.name, subtitle: row.sector ? `${row.code} · ${row.sector}` : row.code, primary: formatCompactCurrency(row.mainNet, 'CNY'), primaryColor: trendColor(row.mainNet, upIsRed), secondary: formatPercent(row.changePct), secondaryColor: trendColor(row.changePct, upIsRed), onClick: () => openStock(row.code, row.marketFlag) })) : (_jsx(DataRow, { title: row.name, subtitle: row.reason, primary: formatCompactCurrency(row.netBuy, 'CNY'), primaryColor: trendColor(row.netBuy, upIsRed), secondary: formatPercent(row.changePct), secondaryColor: trendColor(row.changePct, upIsRed), onClick: () => openStock(row.code) }))] }, `${row.code}-${index}`))) })), rows.length > 0 ? (_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                fontSize: 12,
                                color: C.muted,
                                paddingBottom: SPACE.s4,
                            }, children: [loading ? _jsx(Spinner, { size: 12, color: C.muted }) : null, updatedAt
                                    ? stale
                                        ? t('finance.updated.cached', formatShortStamp(updatedAt))
                                        : t('finance.updated', formatShortStamp(updatedAt))
                                    : null] })) : null] }) }), _jsx(ConstituentsSheet, { ctx: ctx, sector: sector, onClose: () => setSector(null), onOpenStock: openStock })] }));
}
/** 成分股弹层（§5.5）：点板块行进这里，不是详情页。 */
function ConstituentsSheet({ ctx, sector, onClose, onOpenStock, }) {
    const { t, settings } = ctx;
    const [rows, setRows] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    React.useEffect(() => {
        if (!sector)
            return undefined;
        let cancelled = false;
        setLoading(true);
        setRows([]);
        fetchConstituents(sector.code, 40).then((result) => {
            if (cancelled)
                return;
            setRows(result);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [sector]);
    return (_jsxs(Sheet, { visible: !!sector, onClose: onClose, children: [_jsx(SheetHeader, { title: sector ? sector.name : '', onClose: onClose, closeLabel: _jsx(Icon, { name: "xmark", size: 14, weight: "semibold" }) }), _jsxs("div", { className: "fin-scroll", style: { padding: `0 ${SPACE.s4}px` }, children: [loading ? (_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: '40px 0' }, children: _jsx(Spinner, { size: 20, color: C.muted }) })) : rows.length === 0 ? (_jsx(EmptyState, { text: t('finance.ind.empty'), padding: 40 })) : (rows.map((row, index) => (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, {}) : null, _jsxs("button", { type: "button", className: "fin-btn fin-press", onClick: () => {
                                    onClose();
                                    onOpenStock(row.code, row.marketFlag);
                                }, style: { display: 'flex', alignItems: 'center', gap: SPACE.s2, width: '100%', padding: '10px 0' }, children: [_jsx("span", { className: "fin-clamp-1", style: { fontSize: 15, color: C.ink, flex: '1 1 auto', textAlign: 'left' }, children: row.name }), _jsx("span", { className: "fin-mono", style: {
                                            fontSize: 14,
                                            width: 72,
                                            textAlign: 'right',
                                            color: trendColor(row.changePct, settings.upIsRed),
                                        }, children: formatPercent(row.changePct) }), _jsx("span", { className: "fin-mono", style: { fontSize: 13, width: 72, textAlign: 'right', color: C.muted }, children: formatCompactCurrency(row.mainNet, 'CNY') })] })] }, row.code)))), _jsx("div", { style: { height: SPACE.s6 } })] })] }));
}
