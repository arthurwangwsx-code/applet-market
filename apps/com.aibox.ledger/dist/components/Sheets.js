import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Sheet, SheetButton } from './primitives.js';
import { C, SPACE } from './theme.js';
import EntryEditor from './EntryEditor.js';
import SplitEditor from './SplitEditor.js';
import CurrencyManager from './CurrencyManager.js';
import RecentlyDeleted from './RecentlyDeleted.js';
import CSVImportPreview from './CSVImportPreview.js';
import AIPanel from './AIPanel.js';
import { AccountEditor, BudgetEditor, MemberEditor, ProjectEditor, RateEditor, ReconcileSheet } from './Editors.js';
import { addMember, createAccount, createProject, setRate, updateAccount, updateMember, updateProject, upsertBudget, } from '../lib/entities.js';
import { setBalance } from '../lib/balances.js';
import { performImport } from '../lib/csv.js';
import { nativeAlert } from '../lib/host.js';
/** ⋯ 菜单固定顺序：AI 分析（仅有 AI 时）/ 导出 CSV / 导入 CSV / 最近删除。 */
export function overflowItems({ t, caps, canMutate, setSheet, doExport, doImport }) {
    const items = [];
    if (caps.ai)
        items.push({ id: 'ai', label: t('menu.ai'), icon: 'sparkles', onSelect: () => setSheet({ kind: 'ai' }) });
    if (caps.share)
        items.push({ id: 'export', label: t('menu.exportCSV'), icon: 'square.and.arrow.up', onSelect: doExport });
    if (caps.picker && canMutate) {
        items.push({ id: 'import', label: t('menu.importCSV'), icon: 'square.and.arrow.down', onSelect: doImport });
    }
    items.push({
        id: 'deleted',
        label: t('menu.recentlyDeleted'),
        icon: 'trash',
        onSelect: () => setSheet({ kind: 'recentlyDeleted' }),
    });
    return items;
}
export default function Sheets({ sheet, setSheet, ctx, submitRef, failIfNeeded }) {
    if (!sheet)
        return null;
    const { store, t } = ctx;
    const close = () => setSheet(null);
    const formSheet = ({ title, detent, body, onSave, saveLabel }) => (_jsx(Sheet, { open: true, onClose: close, title: title, detent: detent, leading: _jsx(SheetButton, { onClick: close, children: t('x.cancel') }), trailing: _jsx(SheetButton, { bold: true, onClick: onSave, children: saveLabel ?? t('x.save') }), children: body }));
    switch (sheet.kind) {
        case 'entry':
            // 记一笔是全高面板（自带底部计算器键盘），不走通用 formSheet。
            return (_jsx("div", { className: "lg-backdrop", onClick: (event) => {
                    if (event.target === event.currentTarget)
                        close();
                }, children: _jsxs("div", { className: "lg-sheet", style: { height: 'calc(100dvh - 40px)' }, children: [_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                padding: `${SPACE.s3}px ${SPACE.s4}px`,
                                borderBottom: `1px solid ${C.line}`,
                                flex: '0 0 auto',
                            }, children: [_jsx(SheetButton, { onClick: close, children: t('x.cancel') }), _jsx("span", { style: { flex: '1 1 auto', textAlign: 'center', fontSize: 16, fontWeight: 500 }, children: sheet.editing ? t('ent.edit') : t('ent.new') }), _jsx("span", { style: { minWidth: 44 } })] }), _jsx(EntryEditor, { ctx: ctx, editing: sheet.editing, onClose: close })] }) }));
        case 'account':
            return formSheet({
                title: sheet.editing ? t('acc.edit') : t('acc.new'),
                body: (_jsx(AccountEditor, { ctx: ctx, editing: sheet.editing, onSubmit: submitRef })),
                onSave: async () => {
                    const value = submitRef.current();
                    if (!value.valid)
                        return;
                    if (sheet.editing)
                        await updateAccount(store, sheet.editing.id, value);
                    else
                        await createAccount(store, value);
                    if (await failIfNeeded())
                        close();
                },
            });
        case 'project':
            return formSheet({
                title: sheet.editing ? t('prj.edit') : t('prj.new'),
                body: (_jsx(ProjectEditor, { ctx: ctx, editing: sheet.editing, onSubmit: submitRef })),
                onSave: async () => {
                    const value = submitRef.current();
                    if (!value.valid)
                        return;
                    if (sheet.editing)
                        await updateProject(store, sheet.editing.id, value);
                    else
                        await createProject(store, value);
                    if (await failIfNeeded())
                        close();
                },
            });
        case 'budget':
            return formSheet({
                title: t('x.budget'),
                detent: 360,
                body: (_jsx(BudgetEditor, { ctx: ctx, monthKey: ctx.monthKey, categoryID: sheet.categoryID, onSubmit: submitRef })),
                onSave: async () => {
                    const value = submitRef.current();
                    await upsertBudget(store, value.monthKey, value.categoryID, value.limitMinor, value.carryover);
                    if (await failIfNeeded())
                        close();
                },
            });
        case 'member':
            return formSheet({
                title: sheet.editing ? t('prj.editMember') : t('prj.newMember'),
                detent: 320,
                body: (_jsx(MemberEditor, { ctx: ctx, editing: sheet.editing, order: store.projectMembers(sheet.projectID).length, onSubmit: submitRef })),
                onSave: async () => {
                    const value = submitRef.current();
                    if (!value.valid)
                        return;
                    if (sheet.editing)
                        await updateMember(store, sheet.editing.id, value);
                    else
                        await addMember(store, sheet.projectID, value);
                    if (await failIfNeeded())
                        close();
                },
            });
        case 'reconcile':
            return formSheet({
                title: sheet.account.name,
                detent: 320,
                body: (_jsx(ReconcileSheet, { ctx: ctx, account: sheet.account, onSubmit: submitRef })),
                onSave: async () => {
                    const value = submitRef.current();
                    if (!value.valid || value.targetMinor === null)
                        return;
                    await setBalance(store, sheet.account, value.targetMinor);
                    if (await failIfNeeded())
                        close();
                },
            });
        case 'rate':
            return formSheet({
                title: sheet.code,
                detent: 280,
                body: (_jsx(RateEditor, { ctx: ctx, code: sheet.code, onSubmit: submitRef })),
                onSave: async () => {
                    const value = submitRef.current();
                    if (!value.valid)
                        return;
                    await setRate(store, value.code, value.rate);
                    if (await failIfNeeded())
                        setSheet({ kind: 'currencies' });
                },
            });
        case 'split':
            return formSheet({
                title: t('ent.split'),
                saveLabel: t('x.done'),
                body: (_jsx(SplitEditor, { ctx: ctx, request: sheet.request, onSubmit: submitRef })),
                onSave: () => {
                    const value = submitRef.current();
                    if (!value.valid)
                        return;
                    sheet.request.onDone(value.split);
                    close();
                },
            });
        case 'currencies':
            return (_jsx(Sheet, { open: true, onClose: close, title: t('acc.currencies'), leading: _jsx(SheetButton, { onClick: close, children: t('x.done') }), children: _jsx(CurrencyManager, { ctx: ctx }) }));
        case 'addCurrency':
            return (_jsx(Sheet, { open: true, onClose: () => setSheet({ kind: 'currencies' }), title: t('cur.add'), leading: _jsx(SheetButton, { onClick: () => setSheet({ kind: 'currencies' }), children: t('x.cancel') }), children: _jsx(CurrencyManager, { ctx: ctx, mode: "add" }) }));
        case 'recentlyDeleted':
            return (_jsx(Sheet, { open: true, onClose: close, title: t('menu.recentlyDeleted'), trailing: _jsx(SheetButton, { bold: true, onClick: close, children: t('x.done') }), children: _jsx(RecentlyDeleted, { ctx: ctx }) }));
        case 'csvPreview': {
            const draft = sheet.draft;
            // 「导入」**仅当「有效行非空 且 问题数为 0」才可点**。
            const importable = (draft.rows ?? []).length > 0 && (draft.problems ?? []).length === 0;
            return (_jsx(Sheet, { open: true, onClose: close, title: t('csv.title'), leading: _jsx(SheetButton, { onClick: close, children: t('x.cancel') }), trailing: _jsx(SheetButton, { bold: true, disabled: !importable, onClick: async () => {
                        const result = await performImport(store, draft.rows);
                        close();
                        await nativeAlert({
                            title: t('import.complete'),
                            message: t('import.summary', result.imported, result.skipped, result.failed),
                        });
                    }, children: t('csv.import') }), children: _jsx(CSVImportPreview, { ctx: ctx, draft: draft }) }));
        }
        case 'ai':
            return (_jsx(Sheet, { open: true, onClose: close, title: t('ai.title'), trailing: _jsx(SheetButton, { bold: true, onClick: close, children: t('x.done') }), children: _jsx(AIPanel, { ctx: ctx }) }));
        default:
            return null;
    }
}
