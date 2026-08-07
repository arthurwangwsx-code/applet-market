// 宿主对话框、剪贴板与分享能力的薄封装。
import { fileSlug } from './format.js';
export async function actionSheet(actions) {
    const bridge = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!bridge?.ui || actions.length === 0)
        return null;
    try {
        const result = await bridge.ui.actionSheet({
            actions: actions.map((action) => ({
                id: action.id,
                title: action.title,
                role: action.destructive ? 'destructive' : 'default',
            })),
        });
        return result.cancelled ? null : result.actionId;
    }
    catch {
        return null;
    }
}
export async function confirmDestructive(title, confirmTitle, cancelTitle) {
    const bridge = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!bridge?.ui)
        return true;
    try {
        const result = await bridge.ui.confirm({
            title,
            actions: [
                { id: 'cancel', title: cancelTitle, role: 'cancel' },
                { id: 'ok', title: confirmTitle, role: 'destructive' },
            ],
        });
        return !result.cancelled && result.actionId === 'ok';
    }
    catch {
        return false;
    }
}
export async function confirmAlert(title, message) {
    const bridge = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!bridge?.ui)
        return;
    try {
        await bridge.ui.alert({ title, message });
    }
    catch {
        /* 弹不出来就算了，不该因为提示失败再抛一次 */
    }
}
export async function promptText(title, defaultValue) {
    const bridge = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!bridge?.ui)
        return null;
    try {
        const result = await bridge.ui.prompt({ title, defaultValue });
        const value = (result.value ?? '').trim();
        return result.cancelled || !value ? null : value;
    }
    catch {
        return null;
    }
}
export async function copyText(text) {
    const bridge = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!bridge?.clipboard)
        return;
    try {
        await bridge.clipboard.write({ text });
    }
    catch {
        /* 授权被拒 */
    }
}
export async function shareText(text) {
    const bridge = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!bridge?.share || !text.trim())
        return;
    try {
        await bridge.share.text({ text });
    }
    catch {
        /* 用户取消分享面板不是错误 */
    }
}
export async function shareFile(filename, content) {
    const bridge = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!bridge?.share || typeof bridge.share.file !== 'function' || !content.trim())
        return;
    try {
        await bridge.share.file({
            filename,
            content,
            mimeType: filename.endsWith('.srt') ? 'application/x-subrip' : 'text/plain',
        });
    }
    catch {
        /* 同上 */
    }
}
/** 本机剪辑分享的是音频本体：从 applet URL 取字节 → base64 → `share.file`。 */
export async function shareClipAudio(memo) {
    const bridge = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!bridge?.share || typeof bridge.share.file !== 'function' || !memo.url)
        return;
    try {
        const response = await fetch(memo.url);
        const buffer = new Uint8Array(await response.arrayBuffer());
        let binary = '';
        // `?? 0`：下标访问在 noUncheckedIndexedAccess 下是 `number | undefined`。循环边界已经保证不越界，
        // 这里只是把那条保证写给类型系统看。
        for (let index = 0; index < buffer.length; index += 1)
            binary += String.fromCharCode(buffer[index] ?? 0);
        await bridge.share.file({
            filename: `${fileSlug(memo.title)}.m4a`,
            content: btoa(binary),
            mimeType: 'audio/mp4',
            encoding: 'base64',
        });
    }
    catch {
        /* 超过 10MB 上限或取消 */
    }
}
