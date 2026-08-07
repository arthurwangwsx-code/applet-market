// 宿主桥接口：**共享部分转发给 `@aibox/applet-sdk`**（2026-08-05 迁移）。
// 分叉的代价不是重复代码，是同一件事有好几个答案；语义现在由 SDK 统一裁定
// （confirm 不可用回 false、openURL 一律超时封顶、图片走 applet:// 不走 data:）。
// 本文件只留这个应用**自己的**东西：领域投影与外壳编排。
import { bridge, system } from 'aibox/sdk';
import { imageURL as uiImageURL } from 'aibox/ui';
import { classifyVideoReadiness, errorMessage } from './types.js';
// —— 网络 ——————————————————————————————————————————————
/**
 * 取 JSON。用 `responseType: 'json'` 让原生侧解析——省一次 JS 侧 JSON.parse，
 * 也避免大响应在 JS 里再复制一份字符串。
 *
 * `maxBytes` 抬到 2MB：排行榜一次 100 条、搜索一次多组结果，默认 200KB 会被**静默截断**
 * （宿主会回 `truncated: true`，但 JSON 已经断在半截解不出来了）。
 */
/**
 * 从市场安装的应用**权限是归零的**（`AppletMarketInstaller`：「市场包永远带不来授权」），
 * 所以每个用户第一次打开都会撞上这条。宿主给的原文是英文技术信息
 * （`aibox/not-granted: 'net' is not declared — update the applet permissions…`），
 * 直接显示给用户等于让他自己去猜要点哪里。
 *
 * 这条判定**只认前缀**，不认整句：错误文案是宿主的，不该被这里的字符串匹配钉死。
 */
const PERMISSION_HINT = '需要先允许这个小应用联网：在 App 的能力中心里打开它的网络权限，' +
    '然后回到这里重试。（从市场安装的小应用默认不带任何授权。）';
function isPermissionError(message) {
    return /aibox\/(not-granted|denied|not-visible)/.test(String(message || ''));
}
export async function fetchJSON(url, headers = {}) {
    const api = bridge();
    if (!api?.net?.fetch)
        throw new Error('宿主没有开放网络能力');
    let res;
    try {
        res = await api.net.fetch(url, { headers, responseType: 'json', maxBytes: 2 * 1024 * 1024 });
    }
    catch (cause) {
        const raw = errorMessage(cause);
        if (isPermissionError(raw)) {
            const denied = new Error(PERMISSION_HINT);
            denied.permission = true; // 页面据此换成「去授权」而不是「重试」
            throw denied; // 不标 retryable：重试一万次也还是没授权
        }
        // 传输层失败（超时、断网）值得重试一次。
        const err = new Error(raw);
        err.retryable = true;
        throw err;
    }
    if (res?.truncated)
        throw new Error('响应过大被截断');
    if (typeof res?.status === 'number' && (res.status < 200 || res.status >= 300)) {
        const err = new Error(`HTTP ${res.status}`);
        err.retryable = res.status >= 500 || res.status === 429;
        throw err;
    }
    return res.body;
}
// —— 图片 ——————————————————————————————————————————————
/**
 * 封面/头像的 URL。**必须**走这条：secure CSP 是 `img-src applet: data: blob:`，
 * 裸 `<img src="https://i0.hdslb.com/…">` 会被静默拦成空白。
 * 走 `applet://image/` 还能复用宿主的两级图片缓存（内存 + 磁盘 + 降采样）。
 *
 * `width` 收的是 **CSS 点**，由宿主乘屏幕倍率——JS 侧不要自己乘 dpr，否则缓存键与原生侧对不上。
 */
export function imageURL(url, width) {
    if (!url)
        return '';
    // 注意：这是 `aibox/ui` 的**纯客户端**字符串拼接函数，不是桥方法——
    // `window.aibox` 上没有 image 命名空间（查过 d.ts），走桥去找它只会拿到 undefined，
    // 表现是所有封面静默变空白。
    return uiImageURL(url, width ? { width } : undefined);
}
// —— 视频播放 ——————————————————————————————————————————
/**
 * 宿主的视频能力状态。
 *
 * **区分三种情况**，因为它们的排查方向完全相反，混成一句「没有视频引擎」会让人查错方向：
 *  · `noBridge`  —— `aibox.video` 命名空间根本不存在。宿主 App 太旧（没有这条桥），
 *                   要重新构建安装宿主，与小应用版本无关。
 *  · `noEngine`  —— 桥在，但 `available:false`：播放器模块没链入这个构建（如 Lean 变体）。
 *  · `ok`        —— 能播。
 */
export async function videoReadiness() {
    const api = bridge();
    if (!api?.video?.availability) {
        return classifyVideoReadiness(null, { play: false, resolve: false });
    }
    try {
        const res = await api.video.availability();
        return classifyVideoReadiness(res, {
            play: typeof api.video.play === 'function',
            resolve: typeof api.video.resolve === 'function',
        });
    }
    catch (err) {
        return {
            ok: false,
            reason: 'noBridge',
            resolve: false,
            dash: false,
            error: errorMessage(err),
        };
    }
}
/** 兼容旧调用点：只关心能不能播。 */
export async function videoAvailable() {
    return (await videoReadiness()).ok;
}
/**
 * 打开页面顶部的原生视频区。
 *
 * **必须先开舞台再 play**：舞台开着时播放会内嵌在这块区域里，页面照常竖屏、内容在下面滚；
 * 没开舞台就 play 会接管整屏并转横屏——那对一个「边看边翻简介/选集」的页面是错的。
 */
// 舞台宽高比换算已收编进 SDK（`stageAspect`）—— 那是宿主契约知识（合法区间 [0.5,4]），
// 不是本应用的领域逻辑。这里只做重导出，调用点不用改。
export { stageAspect as aspectFor, resolveVideo, playVideo } from 'aibox/sdk';
export async function openStage(settings, aspect) {
    const api = bridge();
    if (!api?.video?.stage)
        return { rendered: false, available: false };
    try {
        // 参数来自**用户偏好**（「我的 → 播放设置」），不写死——
        // 「只想听」和「边做别的边看」是两种诉求，写死必然让一半人被迫接受另一半的行为。
        return await api.video.stage({
            aspect: aspect || '16:9',
            backgroundAudio: settings?.backgroundAudio !== false,
            pictureInPicture: settings?.pictureInPicture !== false,
            gestureControls: settings?.gestureControls !== false,
        });
    }
    catch {
        return { rendered: false, available: false };
    }
}
/** 收起视频区。**不停止播放** —— 用户可能正想让它转画中画或后台听声。 */
export async function closeStage() {
    fireAndForget(() => bridge()?.video?.dismissStage?.());
}
/** 播放状态快照。`mine` 表示当前播的是不是本应用起的。 */
export async function videoStatus() {
    const api = bridge();
    if (!api?.video?.status)
        return null;
    try {
        return await api.video.status();
    }
    catch {
        return null;
    }
}
/** 订阅播放进度（~2Hz）。回退订函数。 */
export function onVideoProgress(handler) {
    const api = bridge();
    if (!api?.video?.subscribe || !api?.events?.on)
        return () => { };
    let off = () => { };
    try {
        off = api.events.on('video.progress', handler) || (() => { });
    }
    catch {
        return () => { };
    }
    fireAndForget(() => api.video.subscribe());
    return () => {
        fireAndForget(() => api.video.unsubscribe?.());
        try {
            off();
        }
        catch {
            /* 已经退订了 */
        }
    };
}
// —— 登录态 ——————————————————————————————————————————
/**
 * 有没有 B 站的会话 cookie。
 *
 * **不要**自己在 storage 里记一个 isLoggedIn 标志——cookie 会过期，标志不会，
 * 两者一旦漂移用户就会看到「显示已登录但接口全是未登录数据」。真值只有一个，就是罐里有没有 cookie。
 */
export async function hasSession() {
    const api = bridge();
    if (!api?.secrets?.hasSession)
        return false;
    try {
        const res = await api.secrets.hasSession({ host: 'bilibili.com' });
        return !!res?.hasSession;
    }
    catch {
        return false;
    }
}
/** 登出：丢掉会话 cookie。 */
export async function clearSession() {
    const api = bridge();
    try {
        await api?.secrets?.clearSession?.({ host: 'bilibili.com' });
    }
    catch {
        /* 没有就算了 */
    }
}
/** Keychain 在这个构建里能不能写（未签名模拟器构建写不了，登录态存不住）。 */
export async function secretsWritable() {
    const api = bridge();
    if (!api?.secrets?.availability)
        return false;
    try {
        const res = await api.secrets.availability();
        return !!res?.available;
    }
    catch {
        return false;
    }
}
// —— 本地存储（偏好，不是凭据）——————————————————————————
export async function loadPref(key, fallback) {
    const api = bridge();
    if (!api?.storage?.get)
        return fallback;
    try {
        const value = await api.storage.get(key);
        return value == null ? fallback : value;
    }
    catch {
        return fallback;
    }
}
export async function savePref(key, value) {
    const api = bridge();
    try {
        await api?.storage?.set?.(key, value);
    }
    catch {
        /* 偏好存不住不该影响主流程 */
    }
}
// —— 交互 ——————————————————————————————————————————————
/**
 * 「发了就不管」的桥调用统一走这里。
 *
 * 桥方法回的是 **Promise**，能力不可用时是 **reject** 而不是 throw ——
 * 同步 `try/catch` 抓不住，于是每一次都变成一条「Unhandled promise rejection」。
 * 无头验收里 `tabs.select` 就是这么冒出来三条 console 错误的。
 */
function fireAndForget(thunk) {
    try {
        const result = thunk();
        if (result instanceof Promise)
            result.catch(() => { });
    }
    catch {
        /* 连命名空间都不在 */
    }
}
export function haptic(kind = 'light') {
    fireAndForget(() => bridge()?.haptics?.impact?.({ style: kind }));
}
export function toast(message) {
    fireAndForget(() => bridge()?.toast?.show?.({ message }));
}
export async function share(text, url) {
    const api = bridge();
    if (!api?.share?.text)
        return false;
    try {
        // `url` 是独立参数：分享面板据此给出「拷贝链接 / 在浏览器打开」这类链接专属动作，
        // 拼进 text 就只剩一段纯文本了。
        return await api.share.text(url ? { text, url } : { text });
    }
    catch {
        return false;
    }
}
export const copyText = system.copyText;
/** 用宿主内置浏览器打开（番剧、直播这类本应用没做的页面，交给浏览器而不是留死路）。 */
export const openInBrowser = system.openInBrowser;
