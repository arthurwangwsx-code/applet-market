// LedgerStore：内存模型 + 唯一写门面（对应原生 LedgerStore + LedgerReliability §4.7）。
//
// 持久层四态与原生一一对应：
//   unopened / ready / degradedMemory(reason) / readOnly(reason)
// 只有 ready 可写。**所有调用方在向用户或模型宣告成功前，必须检查 lastMutationSucceeded。**
//
// 写路径只有一条：`mutate(fn)` → Draft 上改 → 算出脏文档 → 走 db.commit（带 WAL）→
// 成功才把 Draft 换进内存并 revision += 1；失败则内存**原样不动**（天然回滚）、切只读、记录问题。
import { commit as dbCommit, databaseAvailable, loadAll, txDocID } from './db.js';
import { monthKeyOf, dayStart } from './dates.js';
import { ACCOUNT_SEEDS, EXPENSE_SEEDS, INCOME_SEEDS, seedName } from './seeds.js';
import { applyPostingSnapshot, baseCode, currencyRow, reportingBaseMinor, toBaseMinor, convertMinor, hasUsableRate, } from './fx.js';
import { currencyDecimals, currencySymbol } from './currencies.js';
export const TABLE_NAMES = [
    'accounts',
    'categories',
    'currencies',
    'budgets',
    'projects',
    'members',
    'settlements',
    'snapshots',
    'meta',
];
export const KIND = {
    expense: 'expense',
    income: 'income',
    transferOut: 'transferOut',
    transferIn: 'transferIn',
    adjustment: 'adjustment',
};
export const SCHEMA_VERSION = 2;
export function newID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        return crypto.randomUUID();
    return `x-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
/** 是否计入收支报表：**转账两腿与校准都不计**。 */
export function countsInFlow(txn) {
    return txn.kind === KIND.expense || txn.kind === KIND.income;
}
/** 只对账户余额有意义的有符号金额。 */
export function signedAmountMinor(txn) {
    switch (txn.kind) {
        case KIND.expense:
        case KIND.transferOut:
            return -txn.amountMinor;
        case KIND.income:
        case KIND.transferIn:
            return txn.amountMinor;
        case KIND.adjustment:
            return txn.signedAdjustment ?? 0;
        default:
            return 0;
    }
}
// MARK: - Draft（写事务的暂存层）
export class Draft {
    store;
    tables;
    months;
    txMonth;
    dirtyTables;
    dirtyMonths;
    constructor(store) {
        this.store = store;
        this.tables = {};
        this.months = {};
        this.txMonth = new Map(); // id → monthKey 的覆盖层
        this.dirtyTables = new Set();
        this.dirtyMonths = new Set();
    }
    /** 可写取表（首次访问时浅拷贝并标脏）。 */
    table(name) {
        if (!(name in this.tables)) {
            this.tables[name] = this.store.tables[name].slice();
            this.dirtyTables.add(name);
        }
        return this.tables[name];
    }
    /** 只读取表（不标脏）。 */
    read(name) {
        return (name in this.tables ? this.tables[name] : this.store.tables[name]);
    }
    month(key) {
        if (!(key in this.months)) {
            this.months[key] = (this.store.months[key] ?? []).slice();
            this.dirtyMonths.add(key);
        }
        return this.months[key] ?? [];
    }
    monthOf(id) {
        if (this.txMonth.has(id))
            return this.txMonth.get(id) ?? null;
        return this.store.txMonth.get(id) ?? null;
    }
    /** 读一笔流水（Draft 覆盖优先）。 */
    tx(id) {
        const key = this.monthOf(id);
        if (key === null || key === undefined)
            return null;
        const rows = key in this.months ? (this.months[key] ?? []) : (this.store.months[key] ?? []);
        return rows.find((row) => row.id === id) ?? null;
    }
    /** 整条 put（自动处理跨月搬家）。 */
    putTx(txn) {
        const next = monthKeyOf(txn.occurredOn);
        const previous = this.monthOf(txn.id);
        if (previous !== null && previous !== undefined && previous !== next) {
            const old = this.month(previous);
            const index = old.findIndex((row) => row.id === txn.id);
            if (index >= 0)
                old.splice(index, 1);
        }
        const rows = this.month(next);
        const index = rows.findIndex((row) => row.id === txn.id);
        if (index >= 0)
            rows[index] = txn;
        else
            rows.push(txn);
        this.txMonth.set(txn.id, next);
        return txn;
    }
    /** 物理删除（仅「最近删除」的永久删除用；日常删除是写 deletedAt 的软删）。 */
    dropTx(id) {
        const key = this.monthOf(id);
        if (key === null || key === undefined)
            return;
        const rows = this.month(key);
        const index = rows.findIndex((row) => row.id === id);
        if (index >= 0)
            rows.splice(index, 1);
        this.txMonth.set(id, null);
    }
    /** 生成 db 操作序列。 */
    operations() {
        const ops = [];
        for (const name of this.dirtyTables) {
            const rows = this.tables[name];
            if (rows)
                ops.push({ c: 'tables', id: name, rows });
        }
        for (const key of this.dirtyMonths) {
            const rows = this.months[key] ?? [];
            if (rows.length === 0)
                ops.push({ c: 'tx', id: txDocID(key), del: true });
            else
                ops.push({ c: 'tx', id: txDocID(key), rows });
        }
        return ops;
    }
}
// MARK: - Store
export class LedgerStore {
    state;
    stateReason;
    lastMutationSucceeded;
    problems;
    revision;
    locale;
    tables;
    months;
    txMonth;
    listeners;
    _allCache;
    _allCacheRevision;
    constructor() {
        this.state = 'unopened';
        this.stateReason = '';
        this.lastMutationSucceeded = true;
        this.problems = [];
        this.revision = 0;
        this.locale = 'en';
        this.tables = Object.fromEntries(TABLE_NAMES.map((name) => [name, []]));
        this.months = {};
        this.txMonth = new Map();
        this.listeners = new Set();
        this._allCache = null;
        this._allCacheRevision = -1;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    emit() {
        this.revision += 1;
        for (const listener of this.listeners)
            listener();
    }
    get canMutate() {
        return this.state === 'ready';
    }
    recordProblem(reason) {
        this.problems = [...this.problems.slice(-9), { reason: String(reason), at: Date.now() }];
    }
    // MARK: 打开
    async open(locale) {
        this.locale = locale;
        if (!databaseAvailable()) {
            this.state = 'degradedMemory';
            this.stateReason = 'aibox/db-unavailable';
            this.recordProblem('结构化存储不可用，账本只读');
            this.emit();
            return;
        }
        try {
            const { tables, tx } = await loadAll();
            for (const name of TABLE_NAMES)
                replaceTable(this.tables, name, tables[name]);
            this.months = {};
            this.txMonth = new Map();
            for (const [key, rows] of Object.entries(tx)) {
                const monthKey = Number(key);
                this.months[monthKey] = rows;
                for (const row of rows)
                    this.txMonth.set(row.id, monthKey);
            }
            this.state = 'ready';
            this.stateReason = '';
            await this.seedIfNeeded();
        }
        catch (error) {
            this.state = 'degradedMemory';
            this.stateReason = errorMessage(error);
            this.recordProblem(this.stateReason);
        }
        this.emit();
    }
    // MARK: 唯一写门面
    /**
     * 执行一次写。`fn(draft)` 在 Draft 上改；返回 false 可主动放弃。
     * 返回是否**真的落盘成功** —— 调用方在向用户或模型宣告成功前必须看它。
     */
    async mutate(fn) {
        this.lastMutationSucceeded = false;
        if (!this.canMutate) {
            this.recordProblem('账本只读，改动已被阻止');
            this.emit();
            return false;
        }
        const draft = new Draft(this);
        let outcome;
        try {
            outcome = fn(draft);
        }
        catch (error) {
            this.recordProblem(`写入前校验失败：${errorMessage(error)}`);
            this.emit();
            return false;
        }
        if (outcome === false) {
            this.lastMutationSucceeded = false;
            return false;
        }
        const ops = draft.operations();
        if (ops.length === 0) {
            this.lastMutationSucceeded = true;
            return true;
        }
        try {
            await dbCommit(ops);
        }
        catch (error) {
            // 落盘失败：内存原样不动（Draft 直接丢弃 = 回滚），切只读并显式告知。
            this.state = 'readOnly';
            this.stateReason = errorMessage(error);
            this.recordProblem(this.stateReason);
            this.lastMutationSucceeded = false;
            this.emit();
            return false;
        }
        for (const name of draft.dirtyTables) {
            const rows = draft.tables[name];
            if (rows)
                replaceTable(this.tables, name, rows);
        }
        for (const key of draft.dirtyMonths) {
            const rows = draft.months[key] ?? [];
            if (rows.length === 0)
                delete this.months[key];
            else
                this.months[key] = rows;
        }
        for (const [id, key] of draft.txMonth) {
            if (key === null)
                this.txMonth.delete(id);
            else
                this.txMonth.set(id, key);
        }
        this.lastMutationSucceeded = true;
        this._allCache = null;
        this.emit();
        return true;
    }
    // MARK: 种子
    /** 分类表为空时一次性物化；币种表为空时种入基准币 CNY。**永不回灌**。 */
    async seedIfNeeded() {
        const needCategories = this.tables.categories.length === 0;
        const needCurrencies = this.tables.currencies.length === 0;
        const needAccounts = this.tables.accounts.length === 0 && needCategories;
        if (!needCategories && !needCurrencies && !needAccounts)
            return;
        const locale = this.locale;
        await this.mutate((draft) => {
            if (needCurrencies) {
                draft.table('currencies').push({
                    code: 'CNY',
                    symbol: currencySymbol('CNY'),
                    decimals: currencyDecimals('CNY'),
                    rateToBase: 1,
                    isBase: true,
                    manualRate: false,
                    rateConfigured: true,
                    sortOrder: 0,
                    updatedAt: Date.now(),
                });
            }
            if (needCategories) {
                const rows = draft.table('categories');
                let order = 0;
                for (const seed of EXPENSE_SEEDS) {
                    const parentID = newID();
                    rows.push({
                        id: parentID,
                        name: seedName(seed, locale),
                        systemImage: seed.icon,
                        kind: 'expense',
                        parentID: null,
                        colorHex: seed.color,
                        sortOrder: order,
                        isArchived: false,
                        isSeed: true,
                    });
                    order += 1;
                    let childOrder = 0;
                    for (const child of seed.children ?? []) {
                        rows.push({
                            id: newID(),
                            name: seedName(child, locale),
                            systemImage: child.icon,
                            kind: 'expense',
                            parentID,
                            colorHex: seed.color,
                            sortOrder: childOrder,
                            isArchived: false,
                            isSeed: true,
                        });
                        childOrder += 1;
                    }
                }
                let incomeOrder = 0;
                for (const seed of INCOME_SEEDS) {
                    rows.push({
                        id: newID(),
                        name: seedName(seed, locale),
                        systemImage: seed.icon,
                        kind: 'income',
                        parentID: null,
                        colorHex: seed.color,
                        sortOrder: incomeOrder,
                        isArchived: false,
                        isSeed: true,
                    });
                    incomeOrder += 1;
                }
            }
            if (needAccounts) {
                const rows = draft.table('accounts');
                let order = 0;
                for (const seed of ACCOUNT_SEEDS) {
                    rows.push({
                        id: newID(),
                        name: seedName(seed, locale),
                        kind: seed.kind,
                        currency: 'CNY',
                        initialBalanceMinor: 0,
                        includeInNetWorth: true,
                        creditLimitMinor: 0,
                        iconName: seed.icon,
                        colorHex: seed.color,
                        sortOrder: order,
                        isArchived: false,
                        createdAt: Date.now(),
                    });
                    order += 1;
                }
            }
            draft.table('meta');
            const meta = draft.tables.meta;
            if (!meta)
                return false;
            if (meta.length === 0)
                meta.push({ id: 'schema', version: SCHEMA_VERSION, seededAt: Date.now(), seedLocale: locale });
        });
    }
    // MARK: 读
    get accounts() {
        return this.tables.accounts;
    }
    get categories() {
        return this.tables.categories;
    }
    get currencies() {
        return this.tables.currencies;
    }
    get budgets() {
        return this.tables.budgets;
    }
    get projects() {
        return this.tables.projects;
    }
    get members() {
        return this.tables.members;
    }
    get settlements() {
        return this.tables.settlements;
    }
    get snapshots() {
        return this.tables.snapshots;
    }
    /** 全部未软删流水，按 occurredOn 倒序 + createdAt 倒序（= 原生 allTransactions 的顺序）。 */
    allTransactions() {
        if (this._allCache && this._allCacheRevision === this.revision)
            return this._allCache;
        const rows = [];
        for (const key of Object.keys(this.months).map(Number)) {
            for (const row of this.months[key] ?? [])
                if (!row.deletedAt)
                    rows.push(row);
        }
        rows.sort((a, b) => b.occurredOn - a.occurredOn || b.createdAt - a.createdAt);
        this._allCache = rows;
        this._allCacheRevision = this.revision;
        return rows;
    }
    /** 含软删的全量（最近删除页用）。 */
    allTransactionsIncludingDeleted() {
        const rows = [];
        for (const key of Object.keys(this.months).map(Number))
            rows.push(...(this.months[key] ?? []));
        return rows;
    }
    /** 指定月份的流水（未软删）。 */
    monthTransactions(monthKey) {
        return (this.months[monthKey] ?? []).filter((row) => !row.deletedAt);
    }
    /** `from` 之后（含）的全部未软删流水，倒序。 */
    transactionsSince(from) {
        return this.allTransactions().filter((row) => row.occurredOn >= from);
    }
    transaction(id) {
        const key = this.txMonth.get(id);
        if (key === null || key === undefined)
            return null;
        return (this.months[key] ?? []).find((row) => row.id === id) ?? null;
    }
    account(id) {
        return this.accounts.find((row) => row.id === id) ?? null;
    }
    category(id) {
        return this.categories.find((row) => row.id === id) ?? null;
    }
    project(id) {
        return this.projects.find((row) => row.id === id) ?? null;
    }
    member(id) {
        return this.members.find((row) => row.id === id) ?? null;
    }
    activeAccounts() {
        return this.accounts.filter((row) => !row.isArchived).sort((a, b) => a.sortOrder - b.sortOrder);
    }
    /** 默认账户 = 排序最前的未归档账户。 */
    defaultAccount() {
        return this.activeAccounts()[0] ?? null;
    }
    activeProjects() {
        return this.projects.filter((row) => !row.isArchived).sort((a, b) => a.sortOrder - b.sortOrder);
    }
    currentProject() {
        return this.projects.find((row) => row.isActive && !row.isArchived) ?? null;
    }
    projectMembers(projectID) {
        return this.members.filter((row) => row.projectID === projectID).sort((a, b) => a.sortOrder - b.sortOrder);
    }
    projectSettlements(projectID) {
        return this.settlements.filter((row) => row.projectID === projectID);
    }
    /** 一级分类（未归档），按 sortOrder。 */
    rootCategories(kind) {
        return this.categories
            .filter((row) => row.kind === kind && !row.parentID && !row.isArchived)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    childCategories(parentID) {
        return this.categories
            .filter((row) => row.parentID === parentID && !row.isArchived)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    /** 展示路径：一级用自身名，二级用「父名 / 子名」。 */
    categoryPath(id) {
        const row = this.category(id);
        if (!row)
            return '';
        if (!row.parentID)
            return row.name;
        const parent = this.category(row.parentID);
        return parent ? `${parent.name} / ${row.name}` : row.name;
    }
    /** 一级归并：二级返回其父 id。 */
    rootCategoryID(id) {
        const row = this.category(id);
        if (!row)
            return null;
        return row.parentID ?? row.id;
    }
    // MARK: 币种面（委托 fx.js）
    get baseCode() {
        return baseCode(this.currencies);
    }
    currencyRow(code) {
        return currencyRow(this.currencies, code);
    }
    hasUsableRate(code) {
        return hasUsableRate(this.currencies, code);
    }
    toBaseMinor(minor, code) {
        return toBaseMinor(this.currencies, minor, code);
    }
    convertMinor(minor, from, to) {
        return convertMinor(this.currencies, minor, from, to);
    }
    reportingBaseMinor(txn) {
        return reportingBaseMinor(this.currencies, txn);
    }
    applyPostingSnapshot(txn) {
        return applyPostingSnapshot(this.currencies, txn);
    }
    /** 新建一条空白流水骨架。 */
    makeTransaction(input) {
        const now = Date.now();
        return {
            id: input.id ?? newID(),
            kind: input.kind ?? KIND.expense,
            amountMinor: Math.abs(Math.round(input.amountMinor ?? 0)),
            currency: input.currency ?? this.baseCode,
            baseAmountMinorAtPosting: null,
            baseCurrencyAtPosting: null,
            fxRateToBaseAtPosting: null,
            fxRateDate: null,
            calculationExpression: input.calculationExpression ?? null,
            idempotencyKey: input.idempotencyKey ?? null,
            batchID: input.batchID ?? null,
            sourceFingerprint: input.sourceFingerprint ?? null,
            occurredOn: dayStart(input.occurredOn ?? now),
            createdAt: input.createdAt ?? now,
            categoryID: input.categoryID ?? null,
            accountID: input.accountID ?? null,
            transferPeerID: input.transferPeerID ?? null,
            merchant: input.merchant ?? null,
            note: input.note ?? '',
            tags: normalizeTags(input.tags),
            reimbursable: !!input.reimbursable,
            refundOfID: input.refundOfID ?? null,
            source: input.source ?? 'manual',
            bookID: null,
            projectID: input.projectID ?? null,
            payerMemberID: input.payerMemberID ?? null,
            split: input.split ?? null,
            deletedAt: null,
            signedAdjustment: input.signedAdjustment ?? 0,
        };
    }
}
/** 标签：去空白、丢空串。 */
export function normalizeTags(value) {
    if (!Array.isArray(value))
        return [];
    const out = [];
    for (const raw of value) {
        const text = String(raw ?? '').trim();
        if (text.length > 0 && !out.includes(text))
            out.push(text);
    }
    return out;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function replaceTable(tables, name, rows) {
    tables[name] = rows;
}
