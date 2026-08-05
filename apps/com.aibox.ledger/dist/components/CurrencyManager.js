import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 币种与汇率（LedgerCurrencyManagerView）+ 添加币种。
// 行排序：**基准币置顶**，其余按币种码升序。
import React from 'react';
import Icon, { Spinner } from './Icon.js';
import { Card, Divider, useLongPress } from './primitives.js';
import { C, RADIUS, SPACE, fade } from './theme.js';
import { CURRENCY_CATALOG, currencySymbol } from '../lib/currencies.js';
import { formatRate } from '../lib/fx.js';
export default function CurrencyManager({ ctx, mode = 'list' }) {
    const { store, t, actions, canMutate } = ctx;
    const [refreshing, setRefreshing] = React.useState(false);
    const [failed, setFailed] = React.useState(false);
    const rows = React.useMemo(() => {
        const list = [...store.currencies];
        list.sort((a, b) => {
            if (a.isBase !== b.isBase)
                return a.isBase ? -1 : 1;
            return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0);
        });
        return list;
    }, [store, store.revision]); // eslint-disable-line react-hooks/exhaustive-deps
    const refresh = async () => {
        setRefreshing(true);
        const ok = await actions.refreshRates();
        setRefreshing(false);
        setFailed(!ok);
    };
    if (mode === 'add') {
        const enabled = new Set(store.currencies.map((row) => row.code));
        const available = CURRENCY_CATALOG.filter((row) => !enabled.has(row.code));
        return (_jsx(Card, { padding: 0, children: available.length === 0 ? (_jsx("div", { style: { padding: SPACE.s4, fontSize: 15, color: C.muted }, children: "\u2014" })) : available.map((row, index) => (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, { inset: SPACE.s4 }) : null, _jsxs("button", { type: "button", className: "lg-btn", onClick: () => actions.addCurrency(row.code), style: { display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }, children: [_jsx("span", { className: "lg-mono", style: { fontSize: 15, fontWeight: 500, color: C.ink, minWidth: 66 }, children: `${row.code} ${row.symbol}` }), _jsx("span", { className: "lg-clamp-1", style: { fontSize: 15, color: C.muted, flex: '1 1 auto', minWidth: 0 }, children: t(`cur.${row.code}`) }), _jsx(Icon, { name: "arrow.right.circle", size: 17, color: C.brand })] })] }, row.code))) }));
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: '0 4px' }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.muted, flex: '1 1 auto' }, children: t('cur.header', store.baseCode) }), canMutate ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "lg-btn", onClick: () => actions.openAddCurrency(), "aria-label": t('cur.add'), children: _jsx(Icon, { name: "plus", size: 16, color: C.brand }) }), _jsx("button", { type: "button", className: "lg-btn", onClick: refresh, disabled: refreshing, "aria-label": t('cur.refresh'), children: refreshing ? _jsx(Spinner, { size: 15, color: C.brand }) : _jsx(Icon, { name: "arrow.clockwise", size: 15, color: C.brand }) })] })) : null] }), _jsx(Card, { padding: 0, children: rows.map((row, index) => (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, { inset: SPACE.s4 }) : null, _jsx(CurrencyRow, { ctx: ctx, row: row, canMutate: canMutate })] }, row.code))) }), _jsx("span", { style: { fontSize: 12, color: C.muted, padding: '0 4px', lineHeight: 1.4 }, children: t('cur.footer', store.baseCode) }), failed ? (_jsx("span", { style: { fontSize: 12, color: C.expense, padding: '0 4px', lineHeight: 1.4 }, children: t('cur.refreshFailed') })) : null] }));
}
function CurrencyRow({ ctx, row, canMutate }) {
    const { store, t, actions } = ctx;
    const longPress = useLongPress(() => {
        if (!canMutate || row.isBase)
            return;
        actions.showMenu([
            { id: 'base', label: t('cur.setAsBase'), icon: 'star', onSelect: () => actions.setBaseCurrency(row.code) },
        ]);
    });
    return (_jsxs("button", { type: "button", className: "lg-btn", onClick: () => { if (!row.isBase && canMutate)
            actions.editRate(row.code); }, ...longPress, style: { display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }, children: [_jsxs("div", { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("span", { className: "lg-mono", style: { fontSize: 15, fontWeight: 500, color: C.ink }, children: `${row.code} ${currencySymbol(row.code)}` }), row.isBase ? (_jsx("span", { style: {
                                    fontSize: 10, fontWeight: 500, color: C.brand, background: fade(C.brand, 14),
                                    borderRadius: RADIUS.pill, padding: '1px 6px',
                                }, children: t('cur.base') })) : null] }), _jsx("span", { className: "lg-clamp-1", style: { fontSize: 12, color: C.muted }, children: t(`cur.${row.code}`) })] }), row.isBase ? (_jsx("span", { className: "lg-mono", style: { fontSize: 15, color: C.muted }, children: "1" })) : (_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 6 }, children: [_jsx("span", { className: "lg-mono", style: { fontSize: 15, color: row.rateConfigured ? C.ink : C.expense }, children: row.rateConfigured
                            ? `1 ${row.code} = ${formatRate(row.rateToBase)} ${store.baseCode}`
                            : t('tx.rateNeeded') }), row.manualRate ? _jsx("span", { style: { fontSize: 12, color: C.muted }, children: t('cur.manual') }) : null] }))] }));
}
