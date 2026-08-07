// 把 8 个 `ledger_*` 工具接到 `aibox.action.register`。
//
// 宿主把 manifest.actions[] 投影成**延迟工具**（不进常驻 tools 数组，AI 经 tool_search /
// describe / call 发现调用），执行回到页面里跑。三条硬要求：
//  1. 处理器必须在**无 UI 状态**下也能跑 —— 只依赖 store 与 lib/ 的纯函数；
//  2. 走的是与 UI **同一条带 WAL 的写路径**（store.mutate），不绕过去直接写库；
//  3. 返回 JSON 可序列化的结果，写失败时返回明确的「未保存」错误文本。
import { actionBudget, actionQuery, actionRecord, actionStats } from './actions.js';
import { actionAccount, actionCategory, actionCurrency, actionProject } from './actions-entities.js';
/** manifest.actions[].name → 处理器。 */
export const ACTION_HANDLERS = {
    record: actionRecord,
    query: actionQuery,
    stats: actionStats,
    budget: actionBudget,
    account: actionAccount,
    category: actionCategory,
    currency: actionCurrency,
    project: actionProject,
};
/**
 * `context()` 每次调用时求值，拿到当时的 store / locale —— 处理器不持有过期引用。
 * 返回退订函数（宿主没有 action 命名空间时是空函数）。
 */
export function registerLedgerActions(context) {
    const api = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!api || !api.action || typeof api.action.register !== 'function')
        return () => { };
    for (const [name, handler] of Object.entries(ACTION_HANDLERS)) {
        api.action.register(name, async (input) => {
            const { store, locale, labels } = context();
            const args = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
            // 库还没打开（冷启动 headless 调用）→ 先打开再执行。
            if (store.state === 'unopened')
                await store.open(locale);
            try {
                return await handler(store, args, locale, labels);
            }
            catch (error) {
                return { ok: false, text: `The ledger action failed and nothing was saved: ${errorMessage(error)}` };
            }
        });
    }
    return () => { };
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
