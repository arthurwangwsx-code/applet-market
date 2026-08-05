import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// CSV 导入预览（LedgerCSVImportPreviewView）。
// **绝不「选文件即写库」**：这一页只读、只展示，确认后才落库。
import React from 'react';
import { IconBadge } from './Icon.js';
import { Card, Divider } from './primitives.js';
import { C, SPACE, alpha } from './theme.js';
import { KIND } from '../lib/store.js';
import { money } from '../lib/money.js';
import { shortDate } from '../lib/dates.js';
const PREVIEW_LIMIT = 100;
const GLYPH = {
    [KIND.expense]: { icon: 'arrow.up.right', color: '#D9534F' },
    [KIND.income]: { icon: 'arrow.down.left', color: '#2A9D63' },
    [KIND.adjustment]: { icon: 'equal.circle', color: '#2A9D63' },
    [KIND.transferOut]: { icon: 'arrow.left.arrow.right', color: '#2A9D63' },
    [KIND.transferIn]: { icon: 'arrow.left.arrow.right', color: '#2A9D63' },
};
const KIND_LABEL_KEY = {
    [KIND.expense]: 'x.expense',
    [KIND.income]: 'x.income',
    [KIND.adjustment]: 'x.balanceAdjustment',
    [KIND.transferOut]: 'x.transfer',
    [KIND.transferIn]: 'x.transfer',
};
export default function CSVImportPreview({ ctx, draft }) {
    const { t, locale } = ctx;
    const rows = draft.rows ?? [];
    const problems = draft.problems ?? [];
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: [_jsxs(Card, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 15, color: C.ink }, children: t('csv.validRows') }), _jsx("div", { style: { flex: '1 1 auto' } }), _jsx("span", { className: "lg-mono", style: { fontSize: 15, fontWeight: 500, color: C.ink }, children: rows.length })] }), _jsx(Divider, {}), _jsxs("div", { style: { display: 'flex', alignItems: 'center', marginTop: SPACE.s2 }, children: [_jsx("span", { style: { fontSize: 15, color: C.ink }, children: t('csv.problems') }), _jsx("div", { style: { flex: '1 1 auto' } }), _jsx("span", { className: "lg-mono", style: { fontSize: 15, fontWeight: 500, color: problems.length > 0 ? C.expense : C.ink }, children: problems.length })] })] }), _jsx("span", { style: { fontSize: 12, color: C.muted, padding: '0 4px', lineHeight: 1.4 }, children: t('csv.noWriteFooter') }), problems.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.muted, padding: '0 4px' }, children: t('csv.importProblems') }), _jsx(Card, { children: _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: problems.slice(0, 50).map((problem, index) => (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.expense }, children: t('csv.row', problem.row) }), _jsx("span", { style: { fontSize: 12, color: C.muted, lineHeight: 1.4 }, children: problem.message })] }, index))) }) })] })) : null, rows.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.muted, padding: '0 4px' }, children: t('csv.preview') }), _jsx(Card, { padding: 0, children: rows.slice(0, PREVIEW_LIMIT).map((row, index) => {
                            const glyph = GLYPH[row.kind] ?? GLYPH[KIND.expense];
                            return (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, { inset: 50 }) : null, _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s3 }, children: [_jsx(IconBadge, { name: glyph.icon, size: 32, color: glyph.color, background: alpha(glyph.color, 0.16) }), _jsxs("div", { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("span", { className: "lg-clamp-1", style: { fontSize: 15, color: C.ink }, children: row.categoryPath || t(KIND_LABEL_KEY[row.kind] ?? 'x.expense') }), _jsx("span", { className: "lg-clamp-1", style: { fontSize: 12, color: C.muted }, children: [row.accountName, shortDate(row.occurredOn, locale)].filter(Boolean).join(' · ') })] }), _jsx("span", { className: "lg-mono", style: { fontSize: 15, color: C.ink }, children: money(row.amountMinor, row.currency) })] })] }, `${row.line}-${row.originalID}`));
                        }) }), rows.length > PREVIEW_LIMIT ? (_jsx("span", { style: { fontSize: 12, color: C.muted, padding: '0 4px' }, children: t('csv.first100') })) : null] })) : null] }));
}
