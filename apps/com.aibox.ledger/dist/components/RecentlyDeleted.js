import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 最近删除（LedgerRecentlyDeletedView）。
// 左滑（leading，可整滑）→ 恢复；右滑（trailing，不允许整滑）→ 永久删除（带二次确认）。
// **转账两腿只展示一条**（以两个 id 里字典序较小的那个作为配对键去重）。
import React from 'react';
import { IconBadge } from './Icon.js';
import { Card, Divider, EmptyState, SwipeRow } from './primitives.js';
import { C, SPACE, alpha, fade } from './theme.js';
import { KIND } from '../lib/store.js';
import { recentlyDeleted } from '../lib/entries.js';
import { money } from '../lib/money.js';
import { shortDate } from '../lib/dates.js';
import { entryGlyph, entryPathTitle } from '../lib/display.js';
export default function RecentlyDeleted({ ctx }) {
    const { store, t, locale, actions, canMutate } = ctx;
    const rows = React.useMemo(() => recentlyDeleted(store, 200), [store, store.revision]);
    if (rows.length === 0) {
        return _jsx(EmptyState, { icon: "trash", title: t('del.emptyTitle'), body: t('del.emptyBody') });
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: [_jsx(Card, { padding: 0, children: rows.map((txn, index) => {
                    const glyph = entryGlyph(store, txn);
                    const account = store.account(txn.accountID);
                    const text = txn.kind === KIND.income
                        ? money(txn.amountMinor, txn.currency, { signed: true })
                        : (txn.kind === KIND.expense
                            ? money(-txn.amountMinor, txn.currency)
                            : (txn.kind === KIND.adjustment
                                ? money(txn.signedAdjustment ?? 0, txn.currency, { signed: true })
                                : money(txn.amountMinor, txn.currency)));
                    const tone = txn.kind === KIND.income ? C.income : (txn.kind === KIND.expense ? C.ink : C.muted);
                    const body = (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s3 }, children: [_jsx(IconBadge, { name: glyph.icon, size: 34, color: glyph.color, background: alpha(glyph.color, 0.16) }), _jsxs("div", { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("span", { className: "lg-clamp-1", style: { fontSize: 15, color: C.ink }, children: entryPathTitle(store, txn, t) }), _jsx("span", { className: "lg-clamp-1", style: { fontSize: 12, color: C.muted }, children: [account ? account.name : null, shortDate(txn.occurredOn, locale)].filter(Boolean).join(' · ') })] }), _jsx("span", { className: "lg-mono", style: { fontSize: 15, fontWeight: 500, color: tone }, children: text })] }));
                    return (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, { inset: 50 }) : null, canMutate ? (_jsx(SwipeRow, { leading: {
                                    label: t('x.restore'), icon: 'arrow.uturn.backward', fullSwipe: true,
                                    onAction: () => actions.restoreEntry(txn),
                                }, trailing: {
                                    label: t('del.permanently'), icon: 'trash.slash', destructive: true, fullSwipe: false,
                                    onAction: () => actions.purgeEntry(txn),
                                }, children: body })) : body] }, txn.id));
                }) }), _jsx("span", { style: { fontSize: 12, color: C.muted, padding: '0 4px', lineHeight: 1.4 }, children: t('del.transferFooter') })] }));
}
