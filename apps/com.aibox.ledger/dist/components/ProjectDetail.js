import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 项目详情（LedgerProjectDetailView）+ 成员与 AA 结算区块（LedgerMemberSettleSection）。
import React from 'react';
import Icon, { IconBadge } from './Icon.js';
import { Card, Divider, EmptyState, ProgressBar, useLongPress } from './primitives.js';
import { ChartLegend, DonutChart } from './Charts.js';
import { C, RADIUS, SPACE, alpha, fade } from './theme.js';
import { KIND } from '../lib/store.js';
import { buckets, filterTransactions } from '../lib/queries.js';
import { memberBalances, projectIncomeMinor, projectSpentMinor, settlementPlan } from '../lib/split.js';
import { money, moneyCompact } from '../lib/money.js';
import { mediumDayDate, shortDate } from '../lib/dates.js';
import { entryPathTitle } from '../lib/display.js';
export default function ProjectDetail({ ctx, projectID }) {
    const { store, t, locale, actions, canMutate } = ctx;
    const project = store.project(projectID);
    if (!project) {
        return (_jsx("div", { className: "lg-scroll", style: { flex: '1 1 auto', padding: SPACE.s4 }, children: _jsx(EmptyState, { icon: "folder", title: t('prj.notFoundTitle'), body: t('prj.notFoundBody') }) }));
    }
    const spent = projectSpentMinor(store, project.id);
    const income = projectIncomeMinor(store, project.id);
    const flowRows = filterTransactions(store, { projectID: project.id });
    const allRows = filterTransactions(store, { projectID: project.id, includeNonFlow: true }).slice(0, 50);
    const labels = { uncategorized: t('x.uncategorized'), noTag: t('x.noTag'), noProject: t('x.noProject') };
    const categoryBuckets = buckets(store, flowRows, 'byCategory', 'expense', locale, labels);
    const ratio = project.budgetMinor > 0 ? Math.max(0, Math.min(1, spent / project.budgetMinor)) : 0;
    const over = project.budgetMinor > 0 && spent > project.budgetMinor;
    const dateRange = project.startOn || project.endOn
        ? [project.startOn ? mediumDayDate(project.startOn, locale) : '',
            project.endOn ? mediumDayDate(project.endOn, locale) : ''].filter(Boolean).join(' – ')
        : null;
    return (_jsx("div", { className: "lg-scroll", style: { flex: '1 1 auto' }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 96 }, children: [_jsx(Card, { children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE.s2 }, children: [_jsx(IconBadge, { name: project.systemImage, size: 52, color: project.colorHex, background: alpha(project.colorHex, 0.16) }), _jsx("span", { style: { fontSize: 12, color: C.muted }, children: t('prj.spent') }), _jsx("span", { className: "lg-mono", style: { fontSize: 32, fontWeight: 500, color: C.ink }, children: money(spent, store.baseCode) }), _jsxs("div", { style: { display: 'flex', gap: SPACE.s5, marginTop: SPACE.s2, flexWrap: 'wrap', justifyContent: 'center' }, children: [_jsx(Stat, { label: t('prj.entries'), value: String(flowRows.length) }), income > 0 ? _jsx(Stat, { label: t('x.income'), value: moneyCompact(income, store.baseCode) }) : null, dateRange ? _jsx(Stat, { label: t('prj.dates'), value: dateRange }) : null] })] }) }), project.budgetMinor > 0 ? (_jsxs(Card, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: SPACE.s3 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.muted }, children: t('x.budget') }), _jsx("div", { style: { flex: '1 1 auto' } }), _jsx("span", { className: "lg-mono", style: { fontSize: 14, fontWeight: 500, color: C.ink }, children: `${money(spent, store.baseCode)} / ${money(project.budgetMinor, store.baseCode)}` })] }), _jsx(ProgressBar, { progress: ratio, height: 10, color: over ? C.expense : C.brand }), _jsx("div", { style: { marginTop: SPACE.s2, fontSize: 12, color: over ? C.expense : C.muted }, children: over
                                ? t('prj.overBy', money(spent - project.budgetMinor, store.baseCode))
                                : t('prj.left', money(project.budgetMinor - spent, store.baseCode)) })] })) : null, categoryBuckets.length > 0 ? (_jsxs(Card, { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: SPACE.s3 }, children: t('rep.byCategory') }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s4 }, children: [_jsx(DonutChart, { buckets: categoryBuckets, size: 150 }), _jsx(ChartLegend, { buckets: categoryBuckets, currency: store.baseCode })] })] })) : null, _jsx(MemberSettleSection, { ctx: ctx, project: project }), _jsxs(Card, { padding: 0, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 500, color: C.muted, padding: `${SPACE.s4}px ${SPACE.s4}px ${SPACE.s2}px` }, children: t('prj.entries') }), allRows.length === 0 ? (_jsx("div", { style: { padding: `0 ${SPACE.s4}px ${SPACE.s4}px`, fontSize: 15, color: C.muted, textAlign: 'center' }, children: t('prj.noEntries') })) : allRows.map((txn, index) => (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, { inset: SPACE.s4 }) : null, _jsx(ProjectEntryRow, { ctx: ctx, txn: txn, canMutate: canMutate })] }, txn.id)))] }), canMutate ? (_jsxs("button", { type: "button", className: "lg-btn", onClick: () => actions.recordIntoProject(project), style: {
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
                        height: 50, borderRadius: RADIUS.field, background: C.brand, color: C.onAccent,
                        fontSize: 16, fontWeight: 500,
                    }, children: [_jsx(Icon, { name: "checkmark.circle.fill", size: 18, color: C.onAccent }), _jsx("span", { children: t('prj.recordInto') })] })) : null] }) }));
}
function Stat({ label, value }) {
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }, children: [_jsx("span", { style: { fontSize: 12, color: C.muted }, children: label }), _jsx("span", { className: "lg-mono", style: { fontSize: 14, fontWeight: 500, color: C.ink }, children: value })] }));
}
function ProjectEntryRow({ ctx, txn, canMutate }) {
    const { store, t, locale, actions } = ctx;
    const longPress = useLongPress(() => {
        if (!canMutate)
            return;
        actions.showMenu([
            { id: 'delete', label: t('x.delete'), icon: 'trash', destructive: true, onSelect: () => actions.deleteEntry(txn) },
        ]);
    });
    const title = txn.categoryID
        ? entryPathTitle(store, txn, t)
        : (txn.note && txn.note.trim().length > 0 ? txn.note.trim() : shortDate(txn.occurredOn, locale));
    const subtitle = [shortDate(txn.occurredOn, locale), txn.note].filter((piece) => piece && String(piece).trim().length > 0).join(' · ');
    const tone = txn.kind === KIND.income ? C.income : (txn.kind === KIND.expense ? C.ink : C.muted);
    const text = txn.kind === KIND.income
        ? money(txn.amountMinor, txn.currency, { signed: true })
        : (txn.kind === KIND.expense ? money(-txn.amountMinor, txn.currency) : money(txn.amountMinor, txn.currency));
    return (_jsxs("button", { type: "button", className: "lg-btn", onClick: () => actions.editEntry(txn), ...longPress, style: { display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }, children: [_jsxs("div", { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("span", { className: "lg-clamp-1", style: { fontSize: 15, color: C.ink }, children: title }), _jsx("span", { className: "lg-clamp-1", style: { fontSize: 12, color: C.muted }, children: subtitle })] }), _jsx("span", { className: "lg-mono", style: { fontSize: 15, fontWeight: 500, color: tone }, children: text })] }));
}
/** 成员与分摊区块 —— 整块一张卡。 */
function MemberSettleSection({ ctx, project }) {
    const { store, t, actions, canMutate } = ctx;
    const members = store.projectMembers(project.id);
    const others = members.filter((row) => !row.isMe);
    const net = React.useMemo(() => memberBalances(store, project.id), [store, store.revision, project.id]);
    const plan = React.useMemo(() => settlementPlan(store, project.id), [store, store.revision, project.id]);
    return (_jsxs(Card, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: SPACE.s3 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.muted }, children: t('prj.membersSplit') }), _jsx("div", { style: { flex: '1 1 auto' } }), canMutate ? (_jsx("button", { type: "button", className: "lg-btn", "aria-label": t('prj.addMember'), onClick: () => actions.addMember(project), children: _jsx(Icon, { name: "person.badge.plus", size: 15, color: C.brand }) })) : null] }), others.length === 0 ? (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: [_jsx("span", { style: { fontSize: 13, color: C.muted, lineHeight: 1.45 }, children: t('prj.membersIntro') }), canMutate ? (_jsxs("button", { type: "button", className: "lg-btn", onClick: () => actions.addMember(project), style: {
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
                            height: 44, borderRadius: RADIUS.field, background: fade(C.brand, 12), color: C.brand, fontSize: 15,
                        }, children: [_jsx(Icon, { name: "person.2.badge.plus", size: 16, color: C.brand }), _jsx("span", { children: t('prj.addMembers') })] })) : null] })) : (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: [members.map((member) => (_jsx(MemberRow, { ctx: ctx, member: member, amount: net[member.id] ?? 0, canMutate: canMutate }, member.id))), _jsx(Divider, {}), plan.length === 0 ? (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(Icon, { name: "checkmark.seal.fill", size: 13, color: C.income }), _jsx("span", { style: { fontSize: 13, color: C.muted }, children: t('prj.allSettled') })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }, children: t('prj.settleUp') }), plan.map((row) => {
                                const from = store.member(row.fromMemberID);
                                const to = store.member(row.toMemberID);
                                return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("span", { className: "lg-clamp-1", style: { fontSize: 14, color: C.ink }, children: from ? from.name : '—' }), _jsx(Icon, { name: "arrow.right", size: 11, color: C.muted }), _jsx("span", { className: "lg-clamp-1", style: { fontSize: 14, color: C.ink }, children: to ? to.name : '—' }), _jsx("span", { className: "lg-mono", style: { fontSize: 14, fontWeight: 500, color: C.brand, flex: '1 1 auto' }, children: money(row.amountMinor, store.baseCode) }), canMutate ? (_jsx("button", { type: "button", className: "lg-btn", onClick: () => actions.settleUp(project, row), style: {
                                                fontSize: 13, fontWeight: 500, color: C.onAccent, background: C.brand,
                                                borderRadius: RADIUS.pill, padding: '5px 12px', flex: '0 0 auto',
                                            }, children: t('prj.settle') })) : null] }, `${row.fromMemberID}-${row.toMemberID}`));
                            })] }))] }))] }));
}
function MemberRow({ ctx, member, amount, canMutate }) {
    const { store, t, actions } = ctx;
    const longPress = useLongPress(() => {
        if (!canMutate)
            return;
        const items = [{ id: 'edit', label: t('x.edit'), icon: 'pencil', onSelect: () => actions.editMember(member) }];
        if (!member.isMe) {
            items.push({
                id: 'remove', label: t('x.remove'), icon: 'person.badge.minus', destructive: true,
                onSelect: () => actions.removeMember(member),
            });
        }
        actions.showMenu(items);
    });
    const tone = amount > 0 ? C.income : (amount < 0 ? C.expense : C.muted);
    const initial = (member.name || '?').trim().charAt(0).toUpperCase() || '?';
    return (_jsxs("div", { ...longPress, style: { display: 'flex', alignItems: 'center', gap: SPACE.s3 }, children: [_jsx("div", { style: {
                    width: 32, height: 32, borderRadius: 16, flex: '0 0 auto',
                    background: alpha(member.colorHex, 0.18), color: member.colorHex,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500,
                }, children: initial }), _jsx("span", { className: "lg-clamp-1", style: { fontSize: 15, fontWeight: 500, color: C.ink }, children: member.name }), member.isMe ? (_jsx("span", { style: {
                    fontSize: 10, fontWeight: 500, color: C.muted, background: fade(C.muted, 12),
                    borderRadius: RADIUS.pill, padding: '1px 6px', flex: '0 0 auto',
                }, children: t('prj.me') })) : null, _jsx("div", { style: { flex: '1 1 auto' } }), _jsx("span", { className: "lg-mono", style: { fontSize: 14, fontWeight: 500, color: tone }, children: amount === 0 ? money(0, store.baseCode) : money(amount, store.baseCode, { signed: true }) })] }));
}
