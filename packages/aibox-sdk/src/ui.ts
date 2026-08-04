import { bridge } from './bridge';

/**
 * 原生对话框与轻提示。
 *
 * ## 这一层收的是**语义分歧**，不只是重复代码
 * 四份 `host.js` 对「宿主没有 ui 命名空间时 confirm 该返回什么」给了三个不同答案：
 * ledger 回 `null`、music 回 `false`、finance 干脆没有这条。调用方写
 * `if (await confirm(...))` 时，`null` 与 `false` 恰好等价；写 `if (result === false)`
 * 或 `result == null` 的分支就开始各自漂。
 *
 * **SDK 的裁定：不可用一律按「用户没有确认」处理，即 `confirm/actionSheet` 返回 false / null 选项。**
 * 理由是破坏性操作的默认答案必须是「不做」——把「问不出来」解释成「同意」，
 * 在删除类操作上就是数据事故。要区分「用户拒绝」和「问不出来」的，用 `available('ui')` 先判。
 */

export type DialogAction = { id: string; title: string; role?: 'default' | 'cancel' | 'destructive' };

/** 确认框。返回 true 仅当用户**明确**点了非 cancel 的动作；桥缺席、报错、用户取消都返回 false。 */
export async function confirm(input: {
  title?: string;
  message?: string;
  actions?: DialogAction[];
}): Promise<boolean> {
  const host = bridge();
  if (!host?.ui?.confirm) return false;
  try {
    const result = await host.ui.confirm(input);
    return !result.cancelled;
  } catch {
    return false;
  }
}

/** 提示框。返回是否真的弹了出来（不可用时 false，调用方可自己退化成页内提示）。 */
export async function alert(input: { title?: string; message?: string }): Promise<boolean> {
  const host = bridge();
  if (!host?.ui?.alert) return false;
  try {
    await host.ui.alert(input);
    return true;
  } catch {
    return false;
  }
}

/** 输入框。取消或不可用一律返回 null——调用方只需判 null，不必区分两种「没拿到」。 */
export async function prompt(input: {
  title?: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
}): Promise<string | null> {
  const host = bridge();
  if (!host?.ui?.prompt) return null;
  try {
    const result = await host.ui.prompt(input);
    return result.cancelled ? null : result.value;
  } catch {
    return null;
  }
}

/** 动作面板。返回用户选中的 action id；取消或不可用返回 null。 */
export async function actionSheet(input: {
  title?: string;
  message?: string;
  actions: DialogAction[];
}): Promise<string | null> {
  const host = bridge();
  if (!host?.ui?.actionSheet) return null;
  try {
    const result = await host.ui.actionSheet(input);
    return result.cancelled ? null : result.actionId;
  } catch {
    return null;
  }
}

/** 轻提示。**从不抛错、从不阻塞**——提示失败不该影响主流程，故只回布尔。 */
export async function toast(message: string): Promise<boolean> {
  const host = bridge();
  if (!host?.toast?.show) return false;
  try {
    return await host.toast.show({ message });
  } catch {
    return false;
  }
}
