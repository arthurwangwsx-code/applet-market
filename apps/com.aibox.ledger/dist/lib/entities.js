// 账户 / 分类 / 币种 / 预算 / 项目 / 成员的写操作。UI 与 AI action 共用。
import { newID } from './store.js';
import { ACCOUNT_KIND_COLOR, ACCOUNT_KIND_ICON, MEMBER_COLORS } from './seeds.js';
import { currencyDecimals, currencySymbol } from './currencies.js';
import { dayStart } from './dates.js';
const nextOrder = (rows) => rows.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
// MARK: - 账户
export async function createAccount(store, input) {
    const name = String(input.name ?? '').trim();
    if (name.length === 0)
        return { ok: false, reason: 'emptyName' };
    const kind = input.kind ?? 'cash';
    const currency = String(input.currency ?? store.baseCode).toUpperCase();
    // 信用账户的「初始余额」是欠款，正数取负（欠款用负余额表达）。
    let opening = Math.round(input.initialBalanceMinor ?? 0);
    if (kind === 'credit' && opening > 0)
        opening = -opening;
    const account = {
        id: newID(),
        name,
        kind,
        currency,
        initialBalanceMinor: opening,
        includeInNetWorth: input.includeInNetWorth !== false,
        creditLimitMinor: Math.max(0, Math.round(input.creditLimitMinor ?? 0)),
        iconName: ACCOUNT_KIND_ICON[kind] ?? 'banknote',
        colorHex: ACCOUNT_KIND_COLOR[kind] ?? '#2A9D63',
        sortOrder: nextOrder(store.accounts),
        isArchived: false,
        createdAt: Date.now(),
    };
    const ok = await store.mutate((draft) => {
        // 选到尚未启用的币种时自动登记（不带汇率 → rateConfigured=false，进不了汇总）。
        ensureCurrency(draft, currency);
        draft.table('accounts').push(account);
    });
    return ok ? { ok: true, account } : { ok: false, reason: 'persistence' };
}
/** 编辑模式只改 名称 / 类型 / 计入净资产 / 信用额度（**币种不可变**）。 */
export async function updateAccount(store, id, patch) {
    const ok = await store.mutate((draft) => {
        const rows = draft.table('accounts');
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0)
            return false;
        const current = rows[index];
        if (!current)
            return false;
        const next = { ...current };
        if (patch.name !== undefined)
            next.name = String(patch.name).trim();
        if (patch.kind !== undefined)
            next.kind = patch.kind;
        if (patch.includeInNetWorth !== undefined)
            next.includeInNetWorth = !!patch.includeInNetWorth;
        if (patch.creditLimitMinor !== undefined)
            next.creditLimitMinor = Math.max(0, Math.round(patch.creditLimitMinor));
        if (patch.isArchived !== undefined)
            next.isArchived = !!patch.isArchived;
        rows[index] = next;
        return true;
    });
    return ok ? { ok: true } : { ok: false, reason: 'persistence' };
}
export function archiveAccount(store, id, archived = true) {
    return updateAccount(store, id, { isArchived: archived });
}
// MARK: - 分类
export async function createCategory(store, input) {
    const name = String(input.name ?? '').trim();
    if (name.length === 0)
        return { ok: false, reason: 'emptyName' };
    const kind = input.kind === 'income' ? 'income' : 'expense';
    const parent = input.parentID ? store.category(input.parentID) : null;
    // 两级封顶：挂到二级分类下时上提到它的父类。
    const parentID = parent ? (parent.parentID ?? parent.id) : null;
    const siblings = store.categories.filter((row) => (row.parentID ?? null) === parentID && row.kind === kind);
    const category = {
        id: newID(),
        name,
        systemImage: input.systemImage ?? 'tag',
        kind,
        parentID,
        colorHex: input.colorHex ?? (parent ? parent.colorHex : '#68665E'),
        sortOrder: nextOrder(siblings),
        isArchived: false,
        isSeed: false,
    };
    const ok = await store.mutate((draft) => {
        draft.table('categories').push(category);
    });
    return ok ? { ok: true, category } : { ok: false, reason: 'persistence' };
}
export async function updateCategory(store, id, patch) {
    const ok = await store.mutate((draft) => {
        const rows = draft.table('categories');
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0)
            return false;
        const current = rows[index];
        if (!current)
            return false;
        const next = { ...current };
        if (patch.name !== undefined)
            next.name = String(patch.name).trim();
        if (patch.isArchived !== undefined)
            next.isArchived = !!patch.isArchived;
        if (patch.colorHex !== undefined)
            next.colorHex = patch.colorHex;
        if (patch.systemImage !== undefined)
            next.systemImage = patch.systemImage;
        rows[index] = next;
        return true;
    });
    return ok ? { ok: true } : { ok: false, reason: 'persistence' };
}
// MARK: - 币种
function ensureCurrency(draft, code, rate) {
    const rows = draft.table('currencies');
    const upper = String(code ?? '').toUpperCase();
    if (upper.length === 0)
        return null;
    const existing = rows.find((row) => row.code === upper);
    if (existing)
        return existing;
    const value = Number(rate);
    const configured = Number.isFinite(value) && value > 0;
    const row = {
        code: upper,
        symbol: currencySymbol(upper),
        decimals: currencyDecimals(upper),
        // rate <= 0 视为没给：rateToBase 占位 1，但 rateConfigured = false（进不了汇总）。
        rateToBase: configured ? value : 1,
        isBase: rows.length === 0,
        manualRate: false,
        rateConfigured: rows.length === 0 ? true : configured,
        sortOrder: rows.length,
        updatedAt: Date.now(),
    };
    rows.push(row);
    return row;
}
export async function addCurrency(store, code, rate) {
    const upper = String(code ?? '').toUpperCase();
    if (upper.length !== 3)
        return { ok: false, reason: 'invalidCode' };
    if (store.currencyRow(upper))
        return { ok: true, duplicate: true };
    const ok = await store.mutate((draft) => {
        ensureCurrency(draft, upper, rate);
    });
    return ok ? { ok: true } : { ok: false, reason: 'persistence' };
}
/** 手动设定汇率 → 标 manual（在线刷新不再覆盖）。 */
export async function setRate(store, code, rate) {
    const value = Number(rate);
    if (!Number.isFinite(value) || value <= 0)
        return { ok: false, reason: 'invalidRate' };
    const ok = await store.mutate((draft) => {
        const rows = draft.table('currencies');
        const index = rows.findIndex((row) => row.code === String(code).toUpperCase());
        if (index < 0)
            return false;
        const current = rows[index];
        if (!current)
            return false;
        rows[index] = { ...current, rateToBase: value, manualRate: true, rateConfigured: true, updatedAt: Date.now() };
        return true;
    });
    return ok ? { ok: true } : { ok: false, reason: 'persistence' };
}
/**
 * 切换基准币：要求目标币已配置汇率且 > 0。
 * `divisor = 目标币当前 rateToBase`，把**所有币**的 rateToBase 除以它，再把目标币置 1 并标 isBase。
 */
export async function setBaseCurrency(store, code) {
    const upper = String(code ?? '').toUpperCase();
    const target = store.currencyRow(upper);
    if (!target)
        return { ok: false, reason: 'unknownCurrency' };
    if (target.isBase)
        return { ok: true, noop: true };
    const divisor = Number(target.rateToBase);
    if (!target.rateConfigured || !(divisor > 0))
        return { ok: false, reason: 'rateNeeded' };
    const ok = await store.mutate((draft) => {
        const rows = draft.table('currencies');
        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            if (!row)
                continue;
            rows[i] = {
                ...row,
                rateToBase: row.code === upper ? 1 : Number(row.rateToBase) / divisor,
                isBase: row.code === upper,
                rateConfigured: row.code === upper ? true : row.rateConfigured,
                updatedAt: Date.now(),
            };
        }
        return true;
    });
    return ok ? { ok: true } : { ok: false, reason: 'persistence' };
}
/**
 * 在线刷新写回：只更新 `!isBase && !manualRate` 的币；**手动锁定的币绝不覆盖**。
 * 先算出会不会真的变，没变就完全不进 mutate ——「无事发生」不能被报成写失败。
 */
export async function applyFetchedRates(store, rates) {
    if (!rates)
        return { ok: false, reason: 'unavailable' };
    const updates = [];
    for (const row of store.currencies) {
        if (row.isBase || row.manualRate)
            continue;
        const inverse = Number(rates[row.code]);
        if (!Number.isFinite(inverse) || inverse <= 0)
            continue;
        const next = 1 / inverse;
        if (row.rateConfigured && Math.abs(next - Number(row.rateToBase)) < 1e-12)
            continue;
        updates.push({ code: row.code, rateToBase: next });
    }
    if (updates.length === 0)
        return { ok: true, changed: false };
    const ok = await store.mutate((draft) => {
        const rows = draft.table('currencies');
        for (const update of updates) {
            const index = rows.findIndex((row) => row.code === update.code);
            if (index < 0)
                continue;
            const current = rows[index];
            if (!current)
                continue;
            rows[index] = { ...current, rateToBase: update.rateToBase, rateConfigured: true, updatedAt: Date.now() };
        }
        return true;
    });
    return ok ? { ok: true, changed: true } : { ok: false, reason: 'persistence' };
}
// MARK: - 预算（upsert：limit ≤ 0 视为删除该行）
export async function upsertBudget(store, monthKey, categoryID, limitMinor, carryover) {
    const limit = Math.round(limitMinor ?? 0);
    const ok = await store.mutate((draft) => {
        const rows = draft.table('budgets');
        const index = rows.findIndex((row) => row.monthKey === monthKey && (row.categoryID ?? null) === (categoryID ?? null));
        if (limit <= 0) {
            if (index >= 0)
                rows.splice(index, 1);
            return true;
        }
        const next = {
            id: index >= 0 ? (rows[index]?.id ?? newID()) : newID(),
            monthKey,
            categoryID: categoryID ?? null,
            limitMinor: limit,
            carryover: !!carryover,
        };
        if (index >= 0)
            rows[index] = next;
        else
            rows.push(next);
        return true;
    });
    return ok ? { ok: true, removed: limit <= 0 } : { ok: false, reason: 'persistence' };
}
// MARK: - 项目
export async function createProject(store, input) {
    const name = String(input.name ?? '').trim();
    if (name.length === 0)
        return { ok: false, reason: 'emptyName' };
    const project = {
        id: newID(),
        name,
        note: String(input.note ?? ''),
        systemImage: input.systemImage ?? 'airplane',
        colorHex: input.colorHex ?? '#3A83D0',
        startOn: input.startOn !== undefined && input.startOn !== null ? dayStart(input.startOn) : null,
        endOn: input.endOn !== undefined && input.endOn !== null ? dayStart(input.endOn) : null,
        budgetMinor: Math.max(0, Math.round(input.budgetMinor ?? 0)),
        isActive: !!input.isActive,
        isArchived: false,
        sortOrder: nextOrder(store.projects),
        createdAt: Date.now(),
    };
    const ok = await store.mutate((draft) => {
        const rows = draft.table('projects');
        if (project.isActive) {
            for (let i = 0; i < rows.length; i += 1) {
                const row = rows[i];
                if (row?.isActive)
                    rows[i] = { ...row, isActive: false };
            }
        }
        rows.push(project);
    });
    return ok ? { ok: true, project } : { ok: false, reason: 'persistence' };
}
export async function updateProject(store, id, patch) {
    const ok = await store.mutate((draft) => {
        const rows = draft.table('projects');
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0)
            return false;
        const current = rows[index];
        if (!current)
            return false;
        const next = { ...current };
        if (patch.name !== undefined)
            next.name = String(patch.name).trim();
        if (patch.note !== undefined)
            next.note = String(patch.note);
        if (patch.systemImage !== undefined)
            next.systemImage = patch.systemImage;
        if (patch.colorHex !== undefined)
            next.colorHex = patch.colorHex;
        if (patch.startOn !== undefined)
            next.startOn = patch.startOn === null ? null : dayStart(patch.startOn);
        if (patch.endOn !== undefined)
            next.endOn = patch.endOn === null ? null : dayStart(patch.endOn);
        if (patch.budgetMinor !== undefined)
            next.budgetMinor = Math.max(0, Math.round(patch.budgetMinor));
        if (patch.isArchived !== undefined)
            next.isArchived = !!patch.isArchived;
        if (patch.isActive !== undefined) {
            next.isActive = !!patch.isActive;
            // 至多一个 true。
            if (next.isActive) {
                for (let i = 0; i < rows.length; i += 1) {
                    const row = rows[i];
                    if (row && row.id !== id && row.isActive)
                        rows[i] = { ...row, isActive: false };
                }
            }
        }
        if (next.isArchived)
            next.isActive = false;
        rows[index] = next;
        return true;
    });
    return ok ? { ok: true } : { ok: false, reason: 'persistence' };
}
/** 设为当前项目；`null` 清空。 */
export async function activateProject(store, id) {
    const ok = await store.mutate((draft) => {
        const rows = draft.table('projects');
        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            if (!row)
                continue;
            const shouldBeActive = id !== null && row.id === id;
            if (row.isActive !== shouldBeActive)
                rows[i] = { ...row, isActive: shouldBeActive };
        }
        return true;
    });
    return ok ? { ok: true } : { ok: false, reason: 'persistence' };
}
// MARK: - 成员
export async function addMember(store, projectID, input) {
    const name = String(input.name ?? '').trim();
    if (name.length === 0)
        return { ok: false, reason: 'emptyName' };
    const existing = store.projectMembers(projectID);
    const member = {
        id: newID(),
        projectID,
        name,
        isMe: !!input.isMe,
        colorHex: input.colorHex ?? MEMBER_COLORS[existing.length % MEMBER_COLORS.length] ?? '#3A83D0',
        sortOrder: nextOrder(existing),
        createdAt: Date.now(),
    };
    const ok = await store.mutate((draft) => {
        const rows = draft.table('members');
        // 每项目至多一个 isMe。
        if (member.isMe) {
            for (let i = 0; i < rows.length; i += 1) {
                const row = rows[i];
                if (row && row.projectID === projectID && row.isMe)
                    rows[i] = { ...row, isMe: false };
            }
        }
        rows.push(member);
    });
    return ok ? { ok: true, member } : { ok: false, reason: 'persistence' };
}
export async function updateMember(store, id, patch) {
    const ok = await store.mutate((draft) => {
        const rows = draft.table('members');
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0)
            return false;
        const current = rows[index];
        if (!current)
            return false;
        const next = { ...current };
        if (patch.name !== undefined)
            next.name = String(patch.name).trim();
        if (patch.colorHex !== undefined)
            next.colorHex = patch.colorHex;
        if (patch.isMe !== undefined) {
            next.isMe = !!patch.isMe;
            if (next.isMe) {
                for (let i = 0; i < rows.length; i += 1) {
                    const row = rows[i];
                    if (row && row.id !== id && row.projectID === next.projectID && row.isMe) {
                        rows[i] = { ...row, isMe: false };
                    }
                }
            }
        }
        rows[index] = next;
        return true;
    });
    return ok ? { ok: true } : { ok: false, reason: 'persistence' };
}
/**
 * 删成员（§4.6）：清掉其付款流水的 payerMemberID（回落到「我」）→ 从所有分摊方案里剔除
 * → 删掉涉及 TA 的结算 → 删成员。全部在**同一次 mutate** 里落地。
 */
export async function removeMember(store, id) {
    const member = store.member(id);
    if (!member)
        return { ok: false, reason: 'notFound' };
    const affected = store
        .allTransactions()
        .filter((row) => row.projectID === member.projectID &&
        (row.payerMemberID === id || (row.split && row.split.shares.some((share) => share.memberID === id))));
    const doomed = store.settlements.filter((row) => row.fromMemberID === id || row.toMemberID === id);
    const ok = await store.mutate((draft) => {
        for (const txn of affected) {
            const next = { ...txn };
            if (next.payerMemberID === id)
                next.payerMemberID = null;
            if (next.split) {
                const shares = next.split.shares.filter((share) => share.memberID !== id);
                next.split = shares.length > 0 ? { ...next.split, shares } : null;
            }
            draft.putTx(next);
        }
        if (doomed.length > 0) {
            const rows = draft.table('settlements');
            for (const row of doomed) {
                const index = rows.findIndex((entry) => entry.id === row.id);
                if (index >= 0)
                    rows.splice(index, 1);
            }
        }
        const members = draft.table('members');
        const index = members.findIndex((row) => row.id === id);
        if (index >= 0)
            members.splice(index, 1);
        return true;
    });
    return ok ? { ok: true } : { ok: false, reason: 'persistence' };
}
export { ensureCurrency };
