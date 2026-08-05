import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 分摊编辑器（LedgerSplitEditorView）。
// 总额口径 = `toBaseMinor(当前输入金额, from: 记账币种)`，**一律以基准币推演**。
// 付款人被排到份额数组首位 → 零头永远落在付款人身上，Σ 各人应担 ≡ 总额。
import React from 'react';
import Icon from './Icon.js';
import { Segmented } from './primitives.js';
import { C, RADIUS, SPACE } from './theme.js';
import { resolveSplit } from '../lib/split.js';
import { money } from '../lib/money.js';
const MODES = ['equal', 'exact', 'shares', 'percent'];
export default function SplitEditor({ ctx, request, onSubmit }) {
    const { store, t } = ctx;
    const members = store.projectMembers(request.projectID);
    const total = request.totalBaseMinor ?? 0;
    const [mode, setMode] = React.useState(request.split ? request.split.mode : 'equal');
    const [checked, setChecked] = React.useState(() => {
        if (request.split && Array.isArray(request.split.shares)) {
            return new Set(request.split.shares.map((row) => row.memberID));
        }
        return new Set(members.map((row) => row.id));
    });
    const [values, setValues] = React.useState(() => {
        const table = {};
        for (const row of (request.split && request.split.shares) ?? [])
            table[row.memberID] = String(row.value ?? '');
        return table;
    });
    // 付款人排首位。
    const ordered = React.useMemo(() => {
        const selected = members.filter((row) => checked.has(row.id));
        if (!request.payerMemberID)
            return selected;
        const payer = selected.find((row) => row.id === request.payerMemberID);
        if (!payer)
            return selected;
        return [payer, ...selected.filter((row) => row.id !== request.payerMemberID)];
    }, [members, checked, request.payerMemberID]);
    const draft = React.useMemo(() => ({
        mode,
        shares: ordered.map((row) => ({ memberID: row.id, value: Number(values[row.id] ?? 0) })),
    }), [mode, ordered, values]);
    const resolved = React.useMemo(() => resolveSplit(draft, total), [draft, total]);
    const amountFor = (memberID) => (resolved.find((row) => row.memberID === memberID)?.amountMinor ?? 0);
    const assigned = mode === 'exact'
        ? ordered.reduce((sum, row) => sum + Math.round((Number(values[row.id]) || 0) * 100), 0)
        : resolved.reduce((sum, row) => sum + row.amountMinor, 0);
    React.useEffect(() => {
        onSubmit.current = () => ({ split: ordered.length > 0 ? draft : null, valid: ordered.length > 0 });
    });
    const hint = { equal: t('ent.equalHint'), exact: t('ent.exactHint'), shares: t('ent.sharesHint'), percent: t('ent.percentHint') }[mode];
    const placeholder = { percent: '%', shares: '1', exact: '0.00', equal: '' }[mode];
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: [_jsx(Segmented, { value: mode, onChange: setMode, items: MODES.map((id) => ({ id, label: t(`ent.${id}`) })) }), _jsx("span", { style: { fontSize: 12, color: C.muted, lineHeight: 1.4 }, children: hint }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', padding: '0 4px' }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }, children: t('ent.splitAmong') }), _jsx("div", { style: { flex: '1 1 auto' } }), _jsx("span", { className: "lg-mono", style: { fontSize: 13, color: C.muted }, children: money(total, store.baseCode) })] }), _jsx("div", { style: {
                    background: C.surface, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, overflow: 'hidden',
                }, children: members.map((member, index) => {
                    const on = checked.has(member.id);
                    return (_jsxs("div", { style: {
                            display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s3,
                            borderTop: index === 0 ? 'none' : `1px solid ${C.line}`,
                        }, children: [_jsx("button", { type: "button", className: "lg-btn", onClick: () => setChecked((current) => {
                                    const next = new Set(current);
                                    if (next.has(member.id))
                                        next.delete(member.id);
                                    else
                                        next.add(member.id);
                                    return next;
                                }), children: _jsx(Icon, { name: on ? 'checkmark.circle.fill' : 'circle', size: 18, color: on ? C.brand : C.muted }) }), _jsxs("span", { className: "lg-clamp-1", style: { fontSize: 15, color: C.ink, flex: '1 1 auto', minWidth: 0 }, children: [member.name, member.isMe ? _jsx("span", { style: { fontSize: 11, color: C.muted }, children: ` ${t('prj.me')}` }) : null] }), mode === 'equal' ? (_jsx("span", { className: "lg-mono", style: { fontSize: 14, color: C.muted }, children: on ? money(amountFor(member.id), store.baseCode) : '—' })) : (_jsxs(_Fragment, { children: [_jsx("input", { className: "lg-field lg-mono", inputMode: "decimal", disabled: !on, placeholder: placeholder, value: values[member.id] ?? '', onChange: (event) => setValues((current) => ({ ...current, [member.id]: event.target.value })), style: {
                                            width: 74, flex: '0 0 auto', textAlign: 'right', fontSize: 15,
                                            background: C.bg, borderRadius: 8, padding: '5px 8px', opacity: on ? 1 : 0.4,
                                        } }), _jsx("span", { className: "lg-mono", style: { fontSize: 12, color: C.muted, flex: '0 0 auto' }, children: on ? `= ${money(amountFor(member.id), store.baseCode)}` : '' })] }))] }, member.id));
                }) }), mode !== 'equal' ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', padding: '0 4px' }, children: [_jsx("span", { style: { fontSize: 14, color: C.muted }, children: t('ent.assigned') }), _jsx("div", { style: { flex: '1 1 auto' } }), _jsx("span", { className: "lg-mono", style: { fontSize: 14, fontWeight: 500, color: assigned === total ? C.ink : C.expense }, children: money(assigned, store.baseCode) })] }), _jsx("span", { style: { fontSize: 12, color: C.muted, padding: '0 4px', lineHeight: 1.4 }, children: t('ent.remainderHint') })] })) : null] }));
}
