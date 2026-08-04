import { bridge } from './bridge';
/** 确认框。返回 true 仅当用户**明确**点了非 cancel 的动作；桥缺席、报错、用户取消都返回 false。 */
export async function confirm(input) {
    const host = bridge();
    if (!host?.ui?.confirm)
        return false;
    try {
        const result = await host.ui.confirm(input);
        return !result.cancelled;
    }
    catch {
        return false;
    }
}
/** 提示框。返回是否真的弹了出来（不可用时 false，调用方可自己退化成页内提示）。 */
export async function alert(input) {
    const host = bridge();
    if (!host?.ui?.alert)
        return false;
    try {
        await host.ui.alert(input);
        return true;
    }
    catch {
        return false;
    }
}
/** 输入框。取消或不可用一律返回 null——调用方只需判 null，不必区分两种「没拿到」。 */
export async function prompt(input) {
    const host = bridge();
    if (!host?.ui?.prompt)
        return null;
    try {
        const result = await host.ui.prompt(input);
        return result.cancelled ? null : result.value;
    }
    catch {
        return null;
    }
}
/** 动作面板。返回用户选中的 action id；取消或不可用返回 null。 */
export async function actionSheet(input) {
    const host = bridge();
    if (!host?.ui?.actionSheet)
        return null;
    try {
        const result = await host.ui.actionSheet(input);
        return result.cancelled ? null : result.actionId;
    }
    catch {
        return null;
    }
}
/** 轻提示。**从不抛错、从不阻塞**——提示失败不该影响主流程，故只回布尔。 */
export async function toast(message) {
    const host = bridge();
    if (!host?.toast?.show)
        return false;
    try {
        return await host.toast.show({ message });
    }
    catch {
        return false;
    }
}
