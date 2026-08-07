// 报表与预算聚合（§4.3）。UI 预算页与 AI 的 ledger_budget 共用 `budgetPayload`。
import { KIND } from './store.js';
import { addMonths, daysRemainingInMonth, monthEnd, monthKeyOf, monthStart } from './dates.js';
/** 月度收支：该月 income / expense 各自 `reportingBaseMinor` 之和。 */
export function monthlyFlow(store, monthKey) {
    let income = 0;
    let expense = 0;
    for (const txn of store.monthTransactions(monthKey)) {
        if (txn.kind === KIND.income)
            income += store.reportingBaseMinor(txn);
        else if (txn.kind === KIND.expense)
            expense += store.reportingBaseMinor(txn);
    }
    return { income, expense, net: income - expense };
}
/** 某分类（含其全部二级子类）在某月的支出合计（基准币）。`categoryID = null` 表示当月全部支出。 */
export function spentMinor(store, monthKey, categoryID) {
    let total = 0;
    for (const txn of store.monthTransactions(monthKey)) {
        if (txn.kind !== KIND.expense)
            continue;
        if (categoryID !== null && categoryID !== undefined) {
            if (store.rootCategoryID(txn.categoryID) !== categoryID && txn.categoryID !== categoryID)
                continue;
        }
        total += store.reportingBaseMinor(txn);
    }
    return total;
}
function budgetRow(store, monthKey, categoryID) {
    return (store.budgets.find((row) => row.monthKey === monthKey && (row.categoryID ?? null) === (categoryID ?? null)) ?? null);
}
/**
 * 有效额度（含结转，递归，最多回看 120 个月）：
 *   当月没有该 scope 的预算行 → (0, 0)
 *   上月存在同 scope 的行 **且上月 carryover == true**：
 *       carried = max(0, 上月有效额度 − 上月实际支出)   // 超支不产生负结转
 *       → (当月 limit + carried, carried)
 * 结转开关挂在**上一个月那一行**上。
 */
export function effectiveBudget(store, monthKey, categoryID, depth = 0) {
    const current = budgetRow(store, monthKey, categoryID);
    if (!current)
        return { limitMinor: 0, carriedMinor: 0 };
    if (depth >= 120)
        return { limitMinor: current.limitMinor, carriedMinor: 0 };
    const previousKey = addMonths(monthKey, -1);
    const previous = budgetRow(store, previousKey, categoryID);
    if (previous && previous.carryover) {
        const prior = effectiveBudget(store, previousKey, categoryID, depth + 1);
        const priorSpent = spentMinor(store, previousKey, categoryID);
        const carried = Math.max(0, prior.limitMinor - priorSpent);
        return { limitMinor: current.limitMinor + carried, carriedMinor: carried };
    }
    return { limitMinor: current.limitMinor, carriedMinor: 0 };
}
/**
 * 预算负载。
 *  - lines **按额度从大到小**排序
 *  - 总额度：有「categoryID == null 的总预算行」就用它的有效额度；否则 = **各分类有效额度之和**
 *  - `dailyRemaining = daysLeft > 0 ? max(0, remaining) / daysLeft : max(0, remaining)`
 */
export function budgetPayload(store, monthKey, now = Date.now()) {
    const totalSpent = spentMinor(store, monthKey, null);
    const lines = [];
    for (const row of store.budgets) {
        if (row.monthKey !== monthKey || !row.categoryID)
            continue;
        const effective = effectiveBudget(store, monthKey, row.categoryID);
        const category = store.category(row.categoryID);
        lines.push({
            categoryID: row.categoryID,
            name: category ? category.name : '—',
            colorHex: category ? category.colorHex : null,
            limitMinor: effective.limitMinor,
            carriedMinor: effective.carriedMinor,
            spentMinor: spentMinor(store, monthKey, row.categoryID),
            carryover: !!row.carryover,
        });
    }
    lines.sort((a, b) => b.limitMinor - a.limitMinor);
    const overall = budgetRow(store, monthKey, null);
    let totalLimit = 0;
    let totalCarried = 0;
    if (overall) {
        const effective = effectiveBudget(store, monthKey, null);
        totalLimit = effective.limitMinor;
        totalCarried = effective.carriedMinor;
    }
    else {
        for (const line of lines) {
            totalLimit += line.limitMinor;
            totalCarried += line.carriedMinor;
        }
    }
    const remaining = totalLimit - totalSpent;
    const daysLeft = daysRemainingInMonth(monthKey, now);
    const dailyRemaining = daysLeft > 0 ? Math.round(Math.max(0, remaining) / daysLeft) : Math.max(0, remaining);
    return {
        monthKey,
        totalLimitMinor: totalLimit,
        totalCarriedMinor: totalCarried,
        totalSpentMinor: totalSpent,
        remainingMinor: remaining,
        daysLeft,
        dailyRemainingMinor: dailyRemaining,
        hasExplicitTotal: !!overall,
        lines,
    };
}
/** 该月的流水（报表页口径：只保留 countsInFlow）。 */
export function monthFlowTransactions(store, monthKey) {
    return store.monthTransactions(monthKey).filter((txn) => txn.kind === KIND.expense || txn.kind === KIND.income);
}
export { monthKeyOf, monthStart, monthEnd };
