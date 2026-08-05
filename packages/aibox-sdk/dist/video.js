import { bridge } from './bridge';
import { normalizeError } from './errors';
/**
 * 让**宿主**解析视频页。
 *
 * ⚠️ 这不是「可选的优化」，对需要 Referer 的站点是**唯一**能播的路径。
 * `aibox.video.play` 只收 `sourceURL` / `url` / `artifactRef`，**没有 headers 参数**：
 * 页面自己 fetch 到的流地址交给宿主 AVPlayer 时，那次请求是播放器发的，带不上页面这边的头，
 * 站点直接回 403。表现是**舞台开着、画面全黑、而且不报错**——最难查的一类。
 *
 * 宿主的抽取器认识这些站点，解析时自带 Referer 与 UA；随后 `play({sourceURL})` 复用同一份结果。
 */
export async function resolveVideo(pageURL) {
    const host = bridge();
    if (!host?.video?.resolve)
        throw new Error('宿主没有视频解析能力');
    try {
        const r = (await host.video.resolve({ url: pageURL }));
        if (!r?.ok)
            throw new Error(r?.error || '解析不出可播放的地址');
        return { ...r, formats: Array.isArray(r.formats) ? r.formats : [] };
    }
    catch (error) {
        throw normalizeError(error);
    }
}
/**
 * 从解析结果里挑一路流：**按像素数**取最大。
 *
 * 别按 `quality` 字符串排——那是 "480P"/"1080P60"/"4K" 这类人读的标签，
 * 字典序排出来 "1080P" 恰好在 "480P" 前面纯属巧合，遇到 "4K" 就翻车。宿主给了数字，用数字。
 */
export function pickBestFormat(formats) {
    const usable = (formats || []).filter((f) => f && f.playable !== false);
    if (!usable.length)
        return null;
    const area = (f) => (Number(f.width) || 0) * (Number(f.height) || 0);
    return usable.reduce((best, f) => (area(f) > area(best) ? f : best));
}
/**
 * 由视频真实分辨率算舞台宽高比串。
 *
 * 写死 `'16:9'` 的后果是竖屏视频被塞进一条扁窗口、上下两条巨大黑边——而竖屏内容占比不低。
 *
 * **宿主只接受比例落在 [0.5, 4] 的值**（`AppletVideoStageAspect.parse`：太高的舞台会把整页挤没），
 * 越界会被判非法并**静默退回 16:9**。所以这里先夹紧——让降级发生在看得见的地方，
 * 而不是页面传了 `9:21` 却拿到一个 16:9 舞台还不知道为什么。
 */
export function stageAspect(width, height) {
    const w = Number(width), h = Number(height);
    if (!(w > 0) || !(h > 0))
        return '16:9';
    const ratio = Math.min(4, Math.max(0.5, w / h));
    // 用 100 作分母保留两位有效比例，避免 "852:480" 这种长串（宿主只做除法，形式不敏感）。
    return `${Math.round(ratio * 100)}:100`;
}
/**
 * 起播。**优先 `sourceURL`**（配合 `resolveVideo` 用），裸 `url` 只作退路。
 *
 * 两者不是等价的二选一：`sourceURL` 要求宿主缓存里有对应的解析结果，走的是带 headers 的那条；
 * `url` 是直给 AVPlayer，遇上要 Referer 的站点必 403。**能解析就别传 url。**
 */
export async function playVideo(args) {
    const host = bridge();
    if (!host?.video?.play)
        throw new Error('宿主没有视频播放能力');
    const payload = {
        title: args.title, resumeFrom: args.resumeFrom ?? 0,
    };
    if (args.sourceURL) {
        payload.sourceURL = args.sourceURL;
        if (args.formatID)
            payload.formatID = args.formatID;
    }
    else {
        payload.url = args.url;
    }
    try {
        return await host.video.play(payload);
    }
    catch (error) {
        throw normalizeError(error);
    }
}
