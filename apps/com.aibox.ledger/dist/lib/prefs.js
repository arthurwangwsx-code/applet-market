// 轻量偏好（§2.7 ⑧ / §9.2 19）。键名照抄原生 AppStorage，落 localStorage。
// 这些是「越用越顺手」的记忆，不是账本主数据，丢了不影响正确性，所以不进 db、不参与 WAL。
export const PREF_KEYS = {
    lastExpenseAccountID: 'ledger.entry.lastExpenseAccountID',
    lastIncomeAccountID: 'ledger.entry.lastIncomeAccountID',
    lastTransferAccountID: 'ledger.entry.lastTransferAccountID',
    recentExpenseCategories: 'ledger.entry.recentExpenseCategories',
    recentIncomeCategories: 'ledger.entry.recentIncomeCategories',
    localOCR: 'ledger.photo.localOCR',
};
const RECENT_LIMIT = 8;
function read(key) {
    try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
    catch (error) {
        return null;
    }
}
function write(key, value) {
    try {
        if (typeof localStorage !== 'undefined')
            localStorage.setItem(key, value);
    }
    catch (error) {
        /* 隐私模式等场景静默降级 */
    }
}
/** 按收支方向记住上次账户；账户被归档则回落默认账户。 */
export function lastAccountID(store, direction) {
    const key = direction === 'income'
        ? PREF_KEYS.lastIncomeAccountID
        : direction === 'transfer'
            ? PREF_KEYS.lastTransferAccountID
            : PREF_KEYS.lastExpenseAccountID;
    const stored = read(key);
    if (stored) {
        const account = store.account(stored);
        if (account && !account.isArchived)
            return account.id;
    }
    const fallback = store.defaultAccount();
    return fallback ? fallback.id : null;
}
export function rememberAccount(direction, accountID) {
    if (!accountID)
        return;
    const key = direction === 'income'
        ? PREF_KEYS.lastIncomeAccountID
        : direction === 'transfer'
            ? PREF_KEYS.lastTransferAccountID
            : PREF_KEYS.lastExpenseAccountID;
    write(key, accountID);
}
/** 最近使用分类（逗号分隔的 uuid 串，最多 8 个）。 */
export function recentCategories(kind) {
    const key = kind === 'income' ? PREF_KEYS.recentIncomeCategories : PREF_KEYS.recentExpenseCategories;
    const raw = read(key);
    if (!raw)
        return [];
    return raw
        .split(',')
        .map((piece) => piece.trim())
        .filter((piece) => piece.length > 0);
}
export function rememberCategory(kind, categoryID) {
    if (!categoryID)
        return;
    const key = kind === 'income' ? PREF_KEYS.recentIncomeCategories : PREF_KEYS.recentExpenseCategories;
    const current = recentCategories(kind).filter((id) => id !== categoryID);
    write(key, [categoryID, ...current].slice(0, RECENT_LIMIT).join(','));
}
/**
 * 一级分类排序 = **最近使用优先**：把子类的使用次序归到其父类打分，同分再按 sortOrder；
 * 没有历史时直接按 sortOrder。
 */
export function sortRootCategoriesByRecency(store, roots, kind) {
    const recents = recentCategories(kind);
    if (recents.length === 0)
        return [...roots];
    const score = new Map();
    recents.forEach((id, index) => {
        const rootID = store.rootCategoryID(id);
        if (!rootID)
            return;
        if (!score.has(rootID))
            score.set(rootID, index);
    });
    return [...roots].sort((a, b) => {
        const left = score.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const right = score.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (left !== right)
            return left - right;
        return a.sortOrder - b.sortOrder;
    });
}
