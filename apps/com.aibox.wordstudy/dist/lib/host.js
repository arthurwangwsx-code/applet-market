// 宿主桥的薄封装。三条纪律：
//  1. 先探测再使用 —— 能力缺席时入口整块不渲染，不留「点了没反应」的按钮；
//  2. 调用不抛到 UI 层，一律回落成可判定的返回值；
//  3. 没有 window.aibox 时（普通浏览器里预览）退化成 no-op，页面仍能跑。
import { bridge, isAvailable, normalizeError } from 'aibox/sdk';
const api = bridge;
/**
 * AI 是否**现在**真的能用。
 *
 * `isAvailable('ai','generate')` 只说明命名空间注册了 —— 无头/未授权时调用仍会被拒
 * （`aibox/not-visible`：授权提示需要一个可见的 applet 来锚定）。纪律是"先探测再使用"，
 * 所以自动触发的 AI（每日一句）必须先过这道，不能靠 catch 兜住一条 console 错误。
 */
export async function probeAI() {
    const bridge = api();
    if (!bridge?.ai || typeof bridge.ai.availability !== 'function')
        return false;
    try {
        return (await bridge.ai.availability()).available;
    }
    catch {
        return false;
    }
}
export const capabilities = {
    get tts() {
        return isAvailable('tts', 'speak');
    },
    get speech() {
        return isAvailable('speech', 'recognize');
    },
    get clipboard() {
        return isAvailable('clipboard', 'write');
    },
    get share() {
        return isAvailable('share', 'text');
    },
    get ui() {
        return isAvailable('ui', 'confirm');
    },
    get haptics() {
        return isAvailable('haptics', 'impact');
    },
    get picker() {
        return isAvailable('picker', 'photo');
    },
    get ocr() {
        return isAvailable('photos', 'ocr');
    },
    get ai() {
        return isAvailable('ai', 'generate');
    },
    get chat() {
        return isAvailable('chat', 'bind');
    },
};
// —— TTS ——
/** 口音 → BCP-47。由调用方显式指定，**不跟随系统语言**。 */
const ACCENT_LANG = { uk: 'en-GB', us: 'en-US' };
/**
 * 朗读。常速 = `rate 0.5`（AVFoundation 默认），慢速 = `0.35` —— 桥的 0..0.5 段是 1:1 映射到
 * AVFoundation 语速，所以这两个值与原生逐字等价（规格 §20.2）。
 *
 * 先停掉正在读的那句（不排队、不叠音）。
 */
export async function speak(text, accent = 'us', rate = 'normal') {
    const bridge = api();
    const value = String(text ?? '').trim();
    if (!bridge?.tts || !value)
        return;
    try {
        await bridge.tts.stop();
    }
    catch {
        /* 没在读就停不了，正常 */
    }
    try {
        await bridge.tts.speak({ text: value, lang: ACCENT_LANG[accent], rate: rate === 'slow' ? 0.35 : 0.5 });
    }
    catch {
        /* 授权被拒时静默：入口已经探测过，这里不该再弹错误 */
    }
}
export async function stopSpeaking() {
    const bridge = api();
    if (!bridge?.tts)
        return;
    try {
        await bridge.tts.stop();
    }
    catch {
        /* 同上 */
    }
}
/** 不弹框、不开麦克风地探一下。不可用就把 `mic.circle` 整个按钮藏掉。 */
export async function probeSpeech(locale = 'en-US') {
    const bridge = api();
    if (!bridge?.speech)
        return { available: false, reason: 'recognizerUnavailable', detail: '' };
    try {
        const value = await bridge.speech.availability({ locale });
        if (value.available)
            return { available: true, reason: null, detail: '' };
        return { available: false, reason: classifySpeechReason(value.reason ?? ''), detail: value.reason ?? '' };
    }
    catch (error) {
        const message = normalizeError(error).message;
        return { available: false, reason: classifySpeechReason(message), detail: message };
    }
}
/** 把宿主的原因码归到原生那 5 类不可用文案上（规格 §8）。 */
export function classifySpeechReason(raw) {
    const value = raw.toLowerCase();
    if (value.includes('microphone-denied') || value.includes('microphone'))
        return 'micDenied';
    if (value.includes('speech-denied') || value.includes('not-authorized'))
        return 'speechDenied';
    if (value.includes('on-device') || value.includes('ondevice'))
        return 'onDeviceUnsupported';
    if (value.includes('locale') || value.includes('unavailable') || value.includes('unsupported')) {
        return 'recognizerUnavailable';
    }
    return 'engineError';
}
/**
 * 按住说话：**不 await** 地发起 `recognize()`，松手时调 `stopRecognizing()`，再 await 这个 promise。
 * 直接 await 会在 promise 落地前拿不到停止时机。
 */
export function recognize(locale = 'en-US', maxDurationMs = 15_000) {
    const bridge = api();
    if (!bridge?.speech)
        return Promise.resolve({ transcript: '', cancelled: true, error: 'unavailable' });
    return bridge.speech
        .recognize({ locale, maxDurationMs, onPartial: true })
        .then((result) => ({ transcript: result.transcript, cancelled: result.cancelled, error: '' }))
        .catch((error) => ({ transcript: '', cancelled: true, error: normalizeError(error).message }));
}
export async function stopRecognizing() {
    const bridge = api();
    if (!bridge?.speech)
        return;
    try {
        await bridge.speech.stop();
    }
    catch {
        /* 会话已经结束 */
    }
}
export async function cancelRecognizing() {
    const bridge = api();
    if (!bridge?.speech)
        return;
    try {
        await bridge.speech.cancel();
    }
    catch {
        /* 同上 */
    }
}
export async function partialTranscript() {
    const bridge = api();
    if (!bridge?.speech)
        return '';
    try {
        const status = await bridge.speech.status();
        return status.partial ?? '';
    }
    catch {
        return '';
    }
}
// —— 剪贴板 / 分享 / 触感 / 确认 ——
export async function copyText(text) {
    const bridge = api();
    if (!bridge?.clipboard)
        return false;
    try {
        await bridge.clipboard.write({ text });
        return true;
    }
    catch {
        return false;
    }
}
export async function shareText(text) {
    const bridge = api();
    if (!bridge?.share)
        return;
    try {
        await bridge.share.text({ text });
    }
    catch {
        /* 用户取消分享面板不是错误 */
    }
}
export async function haptic(style = 'light') {
    const bridge = api();
    if (!bridge?.haptics)
        return;
    try {
        await bridge.haptics.impact({ style });
    }
    catch {
        /* 模拟器上没有触感 */
    }
}
export async function notify(kind) {
    const bridge = api();
    if (!bridge?.haptics)
        return;
    try {
        await bridge.haptics.notify({ type: kind });
    }
    catch {
        /* 同上 */
    }
}
/**
 * 二次确认。桥不在场时回 true —— 让浏览器预览下的流程不卡死。
 * `ui.confirm` 回的是 `DialogResult`（`actionId` / `cancelled`），不是布尔：确认键的 id 固定为 `ok`。
 */
export async function confirm(input) {
    const bridge = api();
    if (!bridge?.ui)
        return true;
    try {
        const result = await bridge.ui.confirm({
            title: input.title,
            message: input.message,
            actions: [
                { id: 'cancel', title: input.cancelTitle, role: 'cancel' },
                { id: 'ok', title: input.confirmTitle, role: input.destructive ? 'destructive' : 'default' },
            ],
        });
        return !result.cancelled && result.actionId === 'ok';
    }
    catch {
        return false;
    }
}
/**
 * 相册查词：`picker.photo` 拿一张图 → `photos.ocr` 取文字 → 切词。
 *
 * ⚠️ 已知风险（规格 §20.6）：`media_ocr` 的入参是**照片库标识**，而 `picker.photo` 回的是
 * applet 私有资源句柄，两者能不能对接需要真机实测。这里两种入参都试一遍，都不行就报
 * "此设备不支持文字识别"，而不是留一个转圈不动的界面。
 */
export async function lookUpFromPhoto() {
    const bridge = api();
    if (!bridge?.picker || !bridge?.photos)
        return { words: [], error: 'unsupported', previewURL: null };
    let handle = '';
    let url = null;
    try {
        const picked = (await bridge.picker.photo({ limit: 1 }));
        const first = Array.isArray(picked) ? picked[0] : picked;
        if (!first || typeof first !== 'object')
            return { words: [], error: 'load', previewURL: null };
        const ref = first;
        handle = String(ref.handle ?? ref.id ?? '');
        url = ref.url ?? null;
    }
    catch {
        return { words: [], error: 'load', previewURL: null };
    }
    if (!handle)
        return { words: [], error: 'load', previewURL: url };
    let text = '';
    for (const args of [{ handle }, { id: handle }, { asset: handle }]) {
        try {
            const result = (await bridge.photos.ocr(args));
            text = extractOCRText(result);
            if (text)
                break;
        }
        catch {
            /* 换下一种入参形态再试 */
        }
    }
    if (!text)
        return { words: [], error: 'unsupported', previewURL: url };
    const words = tokenizeOCR(text);
    return { words, error: words.length ? null : 'empty', previewURL: url };
}
function extractOCRText(result) {
    if (typeof result === 'string')
        return result;
    if (!result || typeof result !== 'object')
        return '';
    const envelope = result;
    if (envelope.ok === false)
        return '';
    if (typeof envelope.text === 'string')
        return envelope.text;
    return '';
}
/**
 * 切词（规格 §9，可照抄）：按非字母数字切开 → 丢空 token → 只留长度 ≥2 且至少含一个字母的 →
 * 按小写去重，**保留原始大小写与出现顺序**（所以 `The`/`the` 只留先出现的那个）。
 */
export function tokenizeOCR(text) {
    const seen = new Set();
    const out = [];
    for (const token of String(text ?? '').split(/[^\p{L}\p{N}]+/u)) {
        if (token.length < 2)
            continue;
        if (!/\p{L}/u.test(token))
            continue;
        const key = token.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(token);
    }
    return out;
}
// —— 停靠式 AI 会话 ——
/**
 * 把一句可见的建议 prompt 交给宿主的停靠会话（规格 §3.5 的最小可用替代之一）。
 * `shareContext` 的粒度只有「把当前页快照丢过去 + 附一句建议」，拿不到原生那套
 * 「同 identity 复用底层会话 + toolScope 限定 + quickActions chip」。
 * 页面内的轻量对话面板（`AiCompanion`）才是行为等价物，这条只是"接到主聊天里去"的旁路。
 */
export async function shareWordContext(seed) {
    const bridge = api();
    if (!bridge?.chat || typeof bridge.chat.shareContext !== 'function')
        return false;
    try {
        await bridge.chat.shareContext({ suggestedPrompt: seed });
        return true;
    }
    catch {
        return false;
    }
}
