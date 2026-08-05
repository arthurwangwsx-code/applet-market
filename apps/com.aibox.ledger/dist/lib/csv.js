// CSV 导入 / 导出（§2.10）。
//
// 导出：全部未软删流水，`allTransactions()` 顺序，CRLF 换行，RFC 4180 转义，22 列固定顺序。
// 导入：**先预览、后确认，绝不「选文件即写库」**；幂等键 `csv:{原 transaction_id}`；
//       引用（转账互指 / 退款关联）靠「原 id → 新对象」映射两遍回填。
import { KIND, newID, normalizeTags } from './store.js';
import { isoDay, isoTimestamp, parseISODay, parseTimestamp } from './dates.js';
import { majorNumberToMinor, plainMajor } from './money.js';
import { createAccount, createCategory, createProject } from './entities.js';
export const CSV_COLUMNS = [
    'transaction_id', 'kind', 'amount_minor', 'currency', 'base_amount_minor_at_posting',
    'base_currency_at_posting', 'fx_rate_to_base_at_posting', 'occurred_on', 'created_at',
    'account_name', 'account_kind', 'category_path', 'project_name', 'merchant', 'note', 'tags',
    'reimbursable', 'refund_of_id', 'source', 'transfer_peer_id', 'calculation_expression',
    'source_fingerprint',
];
// 旧版 20 列（无 merchant、无 refund_of_id）仍接受导入，保证旧备份可恢复。
export const CSV_COLUMNS_V1 = CSV_COLUMNS.filter((name) => name !== 'merchant' && name !== 'refund_of_id');
// 解析失败文案：与原生一致，**纯英文硬编码、有意不本地化**。
export const CSV_ERRORS = {
    notUTF8: 'The file is not valid UTF-8 CSV.',
    empty: 'The CSV file is empty.',
    columns: (found) => `The CSV columns do not match the AiBox Ledger export format (found ${found} columns).`,
    rowColumns: (expected, found) => `Expected ${expected} columns but found ${found}.`,
    required: 'Required transaction fields are missing or invalid.',
};
// MARK: - 导出
function escapeField(value) {
    const text = String(value ?? '');
    if (/[",\n\r]/.test(text))
        return `"${text.replace(/"/g, '""')}"`;
    return text;
}
/** `%.12g` 的等价：12 位有效数字，去掉多余零。 */
function formatRate(value) {
    if (value === null || value === undefined)
        return '';
    const number = Number(value);
    if (!Number.isFinite(number))
        return '';
    return String(Number(number.toPrecision(12)));
}
export function exportCSV(store) {
    const lines = [CSV_COLUMNS.join(',')];
    for (const txn of store.allTransactions()) {
        const account = store.account(txn.accountID);
        const project = txn.projectID ? store.project(txn.projectID) : null;
        const row = [
            txn.id,
            txn.kind,
            txn.amountMinor,
            txn.currency,
            txn.baseAmountMinorAtPosting ?? '',
            txn.baseCurrencyAtPosting ?? '',
            formatRate(txn.fxRateToBaseAtPosting),
            isoTimestamp(txn.occurredOn),
            isoTimestamp(txn.createdAt),
            account ? account.name : '',
            account ? account.kind : '',
            txn.categoryID ? store.categoryPath(txn.categoryID) : '',
            project ? project.name : '',
            txn.merchant ?? '',
            txn.note ?? '',
            (txn.tags ?? []).join('|'),
            txn.reimbursable ? 'true' : 'false',
            txn.refundOfID ?? '',
            txn.source ?? '',
            txn.transferPeerID ?? '',
            txn.calculationExpression ?? '',
            txn.sourceFingerprint ?? '',
        ];
        lines.push(row.map(escapeField).join(','));
    }
    return `${lines.join('\r\n')}\r\n`;
}
export function exportFilename(now = Date.now()) {
    return `AiBox-Ledger-${isoDay(now)}.csv`;
}
// MARK: - 解析
/** RFC 4180 解析成二维数组。 */
export function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let i = 0;
    const source = String(text ?? '').replace(/^﻿/, '');
    while (i < source.length) {
        const ch = source[i];
        if (quoted) {
            if (ch === '"') {
                if (source[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                quoted = false;
                i += 1;
                continue;
            }
            field += ch;
            i += 1;
            continue;
        }
        if (ch === '"') {
            quoted = true;
            i += 1;
            continue;
        }
        if (ch === ',') {
            row.push(field);
            field = '';
            i += 1;
            continue;
        }
        if (ch === '\r') {
            i += 1;
            continue;
        }
        if (ch === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            i += 1;
            continue;
        }
        field += ch;
        i += 1;
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((line) => line.length > 1 || (line[0] ?? '').trim().length > 0);
}
const KIND_VALUES = new Set(Object.values(KIND));
/**
 * 解析成 draft（有效行 + 问题列表），**不写任何数据**。
 * 返回 `{ rows, problems, columns }`；`rows` 是待落库的中间结构。
 */
export function parseImport(text, store) {
    const problems = [];
    const table = parseCSV(text);
    if (table.length === 0)
        return { rows: [], problems: [{ row: 0, message: CSV_ERRORS.empty }] };
    const header = table[0].map((name) => String(name ?? '').trim());
    let columns = null;
    if (header.length === CSV_COLUMNS.length)
        columns = CSV_COLUMNS;
    else if (header.length === CSV_COLUMNS_V1.length)
        columns = CSV_COLUMNS_V1;
    if (!columns)
        return { rows: [], problems: [{ row: 1, message: CSV_ERRORS.columns(header.length) }] };
    const index = Object.fromEntries(columns.map((name, position) => [name, position]));
    const rows = [];
    for (let line = 1; line < table.length; line += 1) {
        const cells = table[line];
        if (cells.length !== columns.length) {
            problems.push({ row: line + 1, message: CSV_ERRORS.rowColumns(columns.length, cells.length) });
            continue;
        }
        const get = (name) => (index[name] === undefined ? '' : String(cells[index[name]] ?? '').trim());
        const amountMinor = Number.parseInt(get('amount_minor'), 10);
        const kind = get('kind');
        const occurredOn = parseTimestamp(get('occurred_on'), null);
        if (!Number.isFinite(amountMinor) || !KIND_VALUES.has(kind) || occurredOn === null) {
            problems.push({ row: line + 1, message: CSV_ERRORS.required });
            continue;
        }
        rows.push({
            line: line + 1,
            originalID: get('transaction_id'),
            kind,
            amountMinor: Math.abs(amountMinor),
            currency: (get('currency') || store.baseCode).toUpperCase(),
            baseAmountMinorAtPosting: get('base_amount_minor_at_posting') === '' ? null : Number.parseInt(get('base_amount_minor_at_posting'), 10),
            baseCurrencyAtPosting: get('base_currency_at_posting') || null,
            fxRateToBaseAtPosting: get('fx_rate_to_base_at_posting') === '' ? null : Number(get('fx_rate_to_base_at_posting')),
            occurredOn,
            createdAt: parseTimestamp(get('created_at'), occurredOn),
            accountName: get('account_name'),
            accountKind: get('account_kind') || 'cash',
            categoryPath: get('category_path'),
            projectName: get('project_name'),
            merchant: get('merchant') || null,
            note: get('note'),
            tags: get('tags').length > 0 ? get('tags').split('|') : [],
            reimbursable: get('reimbursable').toLowerCase() === 'true',
            refundOfID: get('refund_of_id') || null,
            transferPeerID: get('transfer_peer_id') || null,
            calculationExpression: get('calculation_expression') || null,
            sourceFingerprint: get('source_fingerprint') || get('transaction_id') || null,
        });
    }
    return { rows, problems, columns };
}
// MARK: - 落库
function findCategoryByPath(store, path) {
    const trimmed = String(path ?? '').trim();
    if (trimmed.length === 0)
        return { ok: true, id: null };
    const parts = trimmed.split('/').map((piece) => piece.trim()).filter((piece) => piece.length > 0);
    const rootName = parts[0];
    const childName = parts.length > 1 ? parts[1] : null;
    const roots = store.categories.filter((row) => !row.parentID && row.name === rootName);
    if (roots.length > 1)
        return { ok: false };
    const root = roots[0] ?? null;
    if (!childName)
        return { ok: true, id: root ? root.id : null, missingRoot: root ? null : rootName };
    if (!root)
        return { ok: true, id: null, missingRoot: rootName, missingChild: childName };
    const children = store.childCategories(root.id).filter((row) => row.name === childName);
    if (children.length > 1)
        return { ok: false };
    if (children.length === 1)
        return { ok: true, id: children[0].id };
    return { ok: true, id: null, parentID: root.id, missingChild: childName };
}
/**
 * 确认后写库。**整批共享一个 batchID**；`source` 一律改写成 `"import"`；
 * 落盘失败 → 整批算失败（imported 归 0，全部计入 failed）。
 */
export async function performImport(store, rows) {
    const batchID = newID();
    const existingKeys = new Set(store.allTransactions().map((row) => row.idempotencyKey).filter(Boolean));
    let skipped = 0;
    let failed = 0;
    const staged = [];
    const idMap = new Map();
    // ① 先把缺的账户/分类/项目补齐（各自一次 mutate，失败即整批失败）。
    for (const row of rows) {
        const key = `csv:${row.originalID}`;
        if (row.originalID && existingKeys.has(key)) {
            skipped += 1;
            continue;
        }
        let account = store.accounts.find((entry) => entry.name === row.accountName
            && entry.currency === row.currency) ?? null;
        if (!account)
            account = store.accounts.find((entry) => entry.name === row.accountName) ?? null;
        if (!account && row.accountName) {
            const created = await createAccount(store, {
                name: row.accountName, kind: row.accountKind, currency: row.currency,
            });
            if (!created.ok) {
                failed += 1;
                continue;
            }
            account = created.account;
        }
        if (!account)
            account = store.defaultAccount();
        if (!account) {
            failed += 1;
            continue;
        }
        const resolved = findCategoryByPath(store, row.categoryPath);
        if (!resolved.ok) {
            failed += 1;
            continue;
        }
        let categoryID = resolved.id;
        if (categoryID === null && (resolved.missingRoot || resolved.missingChild)) {
            const built = await ensureCategoryPath(store, row.categoryPath, row.kind === KIND.income ? 'income' : 'expense');
            if (!built.ok) {
                failed += 1;
                continue;
            }
            categoryID = built.id;
        }
        let projectID = null;
        if (row.projectName) {
            const project = store.projects.find((entry) => entry.name === row.projectName);
            if (project)
                projectID = project.id;
            else {
                const created = await createProject(store, { name: row.projectName });
                if (!created.ok) {
                    failed += 1;
                    continue;
                }
                projectID = created.project.id;
            }
        }
        const txn = store.makeTransaction({
            kind: row.kind,
            amountMinor: row.amountMinor,
            currency: account.currency,
            accountID: account.id,
            categoryID,
            projectID,
            merchant: row.merchant,
            note: row.note,
            tags: normalizeTags(row.tags),
            reimbursable: row.reimbursable,
            occurredOn: row.occurredOn,
            createdAt: row.createdAt,
            calculationExpression: row.calculationExpression,
            idempotencyKey: row.originalID ? `csv:${row.originalID}` : null,
            batchID,
            sourceFingerprint: row.sourceFingerprint,
            source: 'import',
        });
        txn.baseAmountMinorAtPosting = Number.isFinite(row.baseAmountMinorAtPosting) ? row.baseAmountMinorAtPosting : null;
        txn.baseCurrencyAtPosting = row.baseCurrencyAtPosting;
        txn.fxRateToBaseAtPosting = Number.isFinite(row.fxRateToBaseAtPosting) ? row.fxRateToBaseAtPosting : null;
        if (txn.baseAmountMinorAtPosting === null)
            store.applyPostingSnapshot(txn);
        staged.push({ txn, row });
        if (row.originalID)
            idMap.set(row.originalID, txn.id);
    }
    if (staged.length === 0)
        return { imported: 0, skipped, failed };
    // ② 用「原 id → 新 id」映射回填 transferPeerID / refundOfID，再一次性落库。
    for (const { txn, row } of staged) {
        if (row.transferPeerID)
            txn.transferPeerID = idMap.get(row.transferPeerID) ?? null;
        if (row.refundOfID) {
            txn.refundOfID = idMap.get(row.refundOfID)
                ?? (store.allTransactions().find((entry) => entry.idempotencyKey === `csv:${row.refundOfID}`)?.id ?? null);
        }
    }
    const ok = await store.mutate((draft) => { for (const { txn } of staged)
        draft.putTx(txn); });
    if (!ok)
        return { imported: 0, skipped, failed: failed + staged.length };
    return { imported: staged.length, skipped, failed };
}
async function ensureCategoryPath(store, path, kind) {
    const parts = String(path ?? '').split('/').map((piece) => piece.trim()).filter((piece) => piece.length > 0);
    if (parts.length === 0)
        return { ok: true, id: null };
    let root = store.categories.find((row) => !row.parentID && row.name === parts[0] && row.kind === kind) ?? null;
    if (!root) {
        const created = await createCategory(store, { name: parts[0], kind });
        if (!created.ok)
            return { ok: false };
        root = created.category;
    }
    if (parts.length === 1)
        return { ok: true, id: root.id };
    let child = store.categories.find((row) => row.parentID === root.id && row.name === parts[1]) ?? null;
    if (!child) {
        const created = await createCategory(store, { name: parts[1], kind, parentID: root.id });
        if (!created.ok)
            return { ok: false };
        child = created.category;
    }
    return { ok: true, id: child.id };
}
export { parseISODay, majorNumberToMinor, plainMajor };
