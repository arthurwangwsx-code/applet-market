import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 资产页（LedgerAccountsView）+ 账户详情（LedgerAccountDetailView）。
// 整页共用**一份**余额快照，净资产卡与每行都从它派生。
import React from 'react';
import Icon, { IconBadge } from './Icon.js';
import { Card, Divider, EmptyState, SectionHeader, useLongPress } from './primitives.js';
import { C, RADIUS, SPACE, alpha, fade } from './theme.js';
import { ACCOUNT_KIND_ORDER } from '../lib/seeds.js';
import { balancesByAccount, netWorth, balanceMinor } from '../lib/balances.js';
import { money } from '../lib/money.js';
import { shortDate } from '../lib/dates.js';
import { KIND } from '../lib/store.js';
import { entryPathTitle } from '../lib/display.js';
export default function AccountsPage({ ctx }) {
    const { store, t, actions, canMutate } = ctx;
    const balances = React.useMemo(() => balancesByAccount(store), [store, store.revision]);
    const worth = React.useMemo(() => netWorth(store, balances), [store, balances]);
    const grouped = ACCOUNT_KIND_ORDER
        .map((kind) => ({ kind, rows: store.activeAccounts().filter((account) => account.kind === kind) }))
        .filter((group) => group.rows.length > 0);
    return (_jsx("div", { className: "lg-scroll", style: { flex: '1 1 auto' }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 96 }, children: [_jsxs("div", { style: {
                        background: C.brand, borderRadius: RADIUS.card, padding: SPACE.s5,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    }, children: [_jsx("span", { style: { fontSize: 12, color: C.onAccent, opacity: 0.8 }, children: t('acc.netWorth') }), _jsx("span", { className: "lg-mono", style: { fontSize: 32, fontWeight: 500, color: C.onAccent }, children: money(worth.net, store.baseCode, { signed: true }) }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s5, marginTop: SPACE.s2 }, children: [_jsx(Column, { label: t('acc.assets'), value: money(worth.assets, store.baseCode) }), _jsx("div", { style: { width: 1, height: 28, background: 'rgba(255,255,255,0.3)' } }), _jsx(Column, { label: t('acc.liabilities'), value: money(worth.liabilities, store.baseCode) })] })] }), grouped.length === 0 ? (_jsx(EmptyState, { icon: "wallet.pass", title: t('fab.addAccount') })) : grouped.map((group) => (_jsxs("div", { children: [_jsx(SectionHeader, { children: t(`acc.kind.${group.kind}`) }), _jsx(Card, { padding: 0, children: group.rows.map((account, index) => (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, { inset: 52 }) : null, _jsx(AccountRow, { ctx: ctx, account: account, balance: balances[account.id] ?? 0, canMutate: canMutate })] }, account.id))) })] }, group.kind))), _jsxs("button", { type: "button", className: "lg-btn", onClick: actions.openCurrencies, style: {
                        display: 'flex', alignItems: 'center', gap: SPACE.s3, height: 46, padding: `0 ${SPACE.s4}px`,
                        background: C.surface, border: `1px solid ${C.line}`, borderRadius: RADIUS.field,
                    }, children: [_jsx(Icon, { name: "coloncurrencysign.arrow.circlepath", size: 15, color: C.muted }), _jsx("span", { style: { flex: '1 1 auto', fontSize: 15, color: C.ink }, children: t('acc.currencies') }), _jsx("span", { className: "lg-mono", style: { fontSize: 14, color: C.muted }, children: store.baseCode }), _jsx(Icon, { name: "chevron.right", size: 12, color: C.muted })] })] }) }));
}
function Column({ label, value }) {
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }, children: [_jsx("span", { style: { fontSize: 12, color: C.onAccent, opacity: 0.8 }, children: label }), _jsx("span", { className: "lg-mono", style: { fontSize: 16, fontWeight: 500, color: C.onAccent }, children: value })] }));
}
function AccountRow({ ctx, account, balance, canMutate }) {
    const { store, t, actions } = ctx;
    const foreign = account.currency !== store.baseCode;
    const longPress = useLongPress(() => {
        if (!canMutate)
            return;
        actions.showMenu([
            { id: 'reconcile', label: t('acc.adjustBalance'), icon: 'equal.circle', onSelect: () => actions.reconcileAccount(account) },
            { id: 'edit', label: t('x.edit'), icon: 'pencil', onSelect: () => actions.editAccount(account) },
            { id: 'archive', label: t('x.archive'), icon: 'archivebox', destructive: true, onSelect: () => actions.archiveAccount(account) },
        ]);
    });
    return (_jsxs("button", { type: "button", className: "lg-btn", onClick: () => actions.openAccount(account), ...longPress, style: { display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }, children: [_jsx(IconBadge, { name: account.iconName, size: 36, color: account.colorHex, background: alpha(account.colorHex, 0.16) }), _jsxs("div", { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }, children: [_jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }, children: [_jsx("span", { className: "lg-clamp-1", style: { fontSize: 15, fontWeight: 500, color: C.ink }, children: account.name }), foreign ? (_jsx("span", { className: "lg-mono", style: {
                                    fontSize: 10, fontWeight: 500, color: C.muted, background: fade(C.muted, 12),
                                    borderRadius: RADIUS.pill, padding: '1px 5px', flex: '0 0 auto',
                                }, children: account.currency })) : null] }), account.kind === 'credit' && account.creditLimitMinor > 0 ? (_jsx("span", { style: { fontSize: 12, color: C.muted }, children: t('acc.limit', money(account.creditLimitMinor, account.currency)) })) : null] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }, children: [_jsx("span", { className: "lg-mono", style: { fontSize: 16, fontWeight: 500, color: balance < 0 ? C.expense : C.ink }, children: money(balance, account.currency) }), foreign ? (_jsxs("span", { className: "lg-mono", style: { fontSize: 12, color: C.muted }, children: ["\u2248 ", money(store.toBaseMinor(balance, account.currency), store.baseCode)] })) : null] })] }));
}
/** 账户详情：余额卡 → 动作条 → 最近 30 条。 */
export function AccountDetail({ ctx, accountID }) {
    const { store, t, locale, actions, canMutate } = ctx;
    const account = store.account(accountID);
    if (!account) {
        return (_jsx("div", { className: "lg-scroll", style: { flex: '1 1 auto', padding: SPACE.s4 }, children: _jsx(EmptyState, { icon: "wallet.pass", title: t('acc.unavailableTitle'), body: t('acc.unavailableBody') }) }));
    }
    const balance = balanceMinor(store, account);
    const foreign = account.currency !== store.baseCode;
    const usable = store.hasUsableRate(account.currency);
    const recent = store.allTransactions().filter((txn) => txn.accountID === account.id).slice(0, 30);
    return (_jsx("div", { className: "lg-scroll", style: { flex: '1 1 auto' }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 96 }, children: [_jsx(Card, { children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE.s2 }, children: [_jsx(IconBadge, { name: account.iconName, size: 52, color: account.colorHex, background: alpha(account.colorHex, 0.16) }), _jsx("span", { style: { fontSize: 12, color: C.muted }, children: t('acc.currentBalance') }), _jsx("span", { className: "lg-mono", style: { fontSize: 32, fontWeight: 500, color: balance < 0 ? C.expense : C.ink }, children: money(balance, account.currency) }), foreign && usable ? (_jsxs("span", { className: "lg-mono", style: { fontSize: 15, color: C.muted }, children: ["\u2248 ", money(store.toBaseMinor(balance, account.currency), store.baseCode)] })) : null, foreign && !usable ? (_jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.expense }, children: [_jsx(Icon, { name: "exclamationmark.triangle.fill", size: 12, color: C.expense }), t('acc.rateNeededTotals')] })) : null, _jsxs("span", { style: { fontSize: 12, color: C.muted }, children: [`${account.currency} · ${t(`acc.kind.${account.kind}`)}`, account.includeInNetWorth ? '' : ` · ${t('acc.excludedFromNetWorth')}`] })] }) }), _jsxs("div", { style: { display: 'flex', gap: SPACE.s3, opacity: canMutate ? 1 : 0.45 }, children: [_jsx(ActionButton, { icon: "pencil", label: t('acc.edit'), disabled: !canMutate, onClick: () => actions.editAccount(account) }), _jsx(ActionButton, { icon: "equal.circle", label: t('acc.adjustBalance'), disabled: !canMutate, onClick: () => actions.reconcileAccount(account) })] }), _jsxs("div", { children: [_jsx(SectionHeader, { children: t('acc.recentEntries') }), recent.length === 0 ? (_jsx(Card, { children: _jsx("span", { style: { fontSize: 15, color: C.muted }, children: t('acc.noEntries') }) })) : (_jsx(Card, { padding: 0, children: recent.map((txn, index) => (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, { inset: 48 }) : null, _jsxs("button", { type: "button", className: "lg-btn", onClick: () => actions.editEntry(txn), style: { display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }, children: [_jsx(IconBadge, { name: txn.categoryID ? (store.category(txn.categoryID)?.systemImage ?? 'tag') : 'tag', size: 32, color: txn.categoryID ? (store.category(txn.categoryID)?.colorHex ?? C.muted) : C.muted, background: fade(C.muted, 14) }), _jsx("span", { className: "lg-clamp-1", style: { flex: '1 1 auto', minWidth: 0, fontSize: 15, color: C.ink }, children: entryPathTitle(store, txn, t) }), _jsx("span", { className: "lg-mono", style: { fontSize: 12, color: C.muted }, children: shortDate(txn.occurredOn, locale) }), _jsx("span", { className: "lg-mono", style: { fontSize: 15, fontWeight: 500, color: txn.kind === KIND.income ? C.income : C.ink }, children: money(txn.kind === KIND.income ? txn.amountMinor : -txn.amountMinor, txn.currency, { signed: txn.kind === KIND.income }) })] })] }, txn.id))) }))] })] }) }));
}
function ActionButton({ icon, label, onClick, disabled }) {
    return (_jsxs("button", { type: "button", className: "lg-btn", onClick: onClick, disabled: disabled, style: {
            flex: '1 1 0', height: 44, borderRadius: RADIUS.field, background: fade(C.brand, 10),
            color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15,
        }, children: [_jsx(Icon, { name: icon, size: 15, color: C.brand }), _jsx("span", { children: label })] }));
}
