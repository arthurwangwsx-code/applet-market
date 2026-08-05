// 对外提供的 3 个 AI 动作（search / trending / play）。
//
// 为什么值得提供：AI 侧「帮我找个讲 XX 的视频并播放」这条链路，如果没有这些动作就只能靠
// 通用 web 搜索猜链接。有了它们，模型拿到的是结构化的 bvid + 播放入口。
//
// **动作在模块求值期注册**（见 app.jsx 顶部的 registerActions 调用）：无头执行时页面不挂载
// 任何组件，等 React 副作用就来不及了。
import * as api from './api.js';
import { playVideo, videoAvailable } from './host.js';
/** 搜索视频。回结构化列表 + 一段给模型读的文本。 */
async function search({ keyword, limit }) {
    const query = String(keyword || '').trim();
    if (!query)
        return { ok: false, error: 'keyword is required', text: '需要一个搜索关键词。' };
    try {
        const result = await api.search(query);
        const videos = result.videos.slice(0, Math.min(Math.max(1, Number(limit) || 10), 20));
        return {
            ok: true,
            videos: videos.map((v) => ({
                bvid: v.bvid, title: v.title, author: v.author,
                durationSeconds: v.duration, plays: v.play,
                url: `https://www.bilibili.com/video/${v.bvid}`,
            })),
            text: videos.length
                ? videos.map((v, i) => `${i + 1}. ${v.title} — ${v.author}（${v.bvid}）`).join('\n')
                : `没有搜到与「${query}」相关的视频。`,
        };
    }
    catch (err) {
        return { ok: false, error: String(err?.message || err), text: `搜索失败：${err?.message || err}` };
    }
}
/** 热门 / 排行榜。 */
async function trending({ kind, limit }) {
    const count = Math.min(Math.max(1, Number(limit) || 10), 30);
    try {
        const list = kind === 'ranking' ? await api.ranking(0) : await api.popular(1);
        const videos = list.slice(0, count);
        return {
            ok: true,
            videos: videos.map((v) => ({
                bvid: v.bvid, title: v.title, author: v.author, plays: v.play,
                url: `https://www.bilibili.com/video/${v.bvid}`,
            })),
            text: videos.map((v, i) => `${i + 1}. ${v.title} — ${v.author}（${v.bvid}）`).join('\n'),
        };
    }
    catch (err) {
        return { ok: false, error: String(err?.message || err), text: `拿不到榜单：${err?.message || err}` };
    }
}
/**
 * 播放一个视频。
 *
 * 注意它**不是**「返回一个链接让调用方自己播」——播放归宿主引擎，
 * 这个动作做的是取流 + 交给 `aibox.video`（于是全屏、画中画、锁屏卡片都在）。
 */
async function play({ bvid }) {
    const id = String(bvid || '').trim();
    if (!id)
        return { ok: false, error: 'bvid is required', text: '需要一个视频的 BV 号。' };
    if (!await videoAvailable()) {
        return { ok: false, error: 'no video engine', text: '这个版本没有装视频引擎，播放不了。' };
    }
    try {
        const detail = await api.videoDetail(id);
        const stream = await api.playURL(id, detail.cid);
        await playVideo({ url: stream.url, title: detail.title });
        return {
            ok: true,
            video: { bvid: id, title: detail.title, author: detail.author, quality: stream.format },
            text: `正在播放《${detail.title}》（${detail.author}）。`,
        };
    }
    catch (err) {
        return { ok: false, error: String(err?.message || err), text: `播放失败：${err?.message || err}` };
    }
}
export function registerActions() {
    const api_ = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!api_?.action?.register)
        return false;
    api_.action.register('search', search);
    api_.action.register('trending', trending);
    api_.action.register('play', play);
    return true;
}
