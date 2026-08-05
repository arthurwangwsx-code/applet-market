// 封面与专辑主色。
//
// 两个绕不开的平台事实：
//  1. secure 模式 CSP 是 `img-src applet: data: blob:` —— **远程 URL 的 <img> 会被整条拦掉**。
//     所以封面统一走 `aibox.net.fetch(responseType:'base64')` → `data:` URL。
//     附带好处：data URL 是同源的，canvas `getImageData` 不会被跨域污染，取色才可能。
//  2. `music_status.currentTrack` 用的是 `AudioTrack.toolJSON`，**不含 artworkUrl**；
//     `music_local` 的条目也没有封面字段。所以封面要靠「搜索/推荐/资料库结果里见过就记下来」
//     这条旁路补齐（见 store.rememberArtwork），本地曲目则永远是音符占位。
import { imageURL } from '../lib/aibox-sdk.js';
import { stableKey } from './format.js';
const dataURLCache = new Map();
const inflight = new Map();
const colorCache = new Map();
const MAX_CACHE = 60;
/** 取封面的 data URL（内存缓存 + 同 URL 请求去重）。失败回 null，调用方显示占位。 */
export async function artworkDataURL(url) {
    const key = String(url || '');
    if (!key)
        return null;
    if (dataURLCache.has(key))
        return dataURLCache.get(key);
    if (inflight.has(key))
        return inflight.get(key);
    // 2026-08-05：从 `fetchImageDataURL`（整张图 base64 进 JS 内存再进 DOM，比原图大 33%、
    // 60 张常驻必爆）换成 `imageURL()` —— 走宿主图片通道，字节不经过 JS，宿主两级缓存跨会话。
    // ⚠️ 取色那条路（canvas getImageData）此前依赖 data: URL 的同源性，换成 applet:// 之后
    // **是否仍不被判跨域污染尚未真机验证**；`dominantColor` 已加 try/catch 兜底，
    // 万一被污染就退回无主色，不会崩，但主色会消失——这条要在真机上确认。
    const task = Promise.resolve(imageURL(key, { width: 300 })).then((value) => {
        inflight.delete(key);
        if (dataURLCache.size >= MAX_CACHE)
            dataURLCache.delete(dataURLCache.keys().next().value);
        dataURLCache.set(key, value);
        return value;
    }).catch(() => {
        inflight.delete(key);
        return null;
    });
    inflight.set(key, task);
    return task;
}
/** Apple Music 的封面 URL 常带 `{w}x{h}bb.jpg` 尺寸段，按需换成目标边长省流量。 */
export function sizedArtworkURL(url, size) {
    const value = String(url || '');
    if (!value)
        return value;
    return value.replace(/\/(\d+)x(\d+)([a-z-]*\.(?:jpg|jpeg|png|webp))/i, `/${size}x${size}$3`);
}
/**
 * 专辑主色（氛围渐变底用）。
 * 原生取的是 Apple Music 服务端给的官方 `Artwork.backgroundColor`；容器没有透出（缺口 #4），
 * 这里退而求其次：把封面画进 8×8 的 canvas，取加权平均后再拉高饱和度。是**近似**，不是同一个值。
 */
export async function dominantColor(dataURL) {
    const key = String(dataURL || '').slice(0, 128);
    if (!key)
        return null;
    if (colorCache.has(key))
        return colorCache.get(key);
    try {
        const color = await new Promise((resolve) => {
            const image = new Image();
            image.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 8;
                    canvas.height = 8;
                    const context = canvas.getContext('2d', { willReadFrequently: true });
                    if (!context) {
                        resolve(null);
                        return;
                    }
                    context.drawImage(image, 0, 0, 8, 8);
                    resolve(averageColor(context.getImageData(0, 0, 8, 8).data));
                }
                catch (error) {
                    // 跨域污染或 canvas 不可用：如实回 null，调用方用 accent 兜底。
                    resolve(null);
                }
            };
            image.onerror = () => resolve(null);
            image.src = dataURL;
        });
        if (colorCache.size >= MAX_CACHE)
            colorCache.delete(colorCache.keys().next().value);
        colorCache.set(key, color);
        return color;
    }
    catch (error) {
        return null;
    }
}
/** 取「够鲜艳且够暗」的平均色：跳过接近纯白/纯黑的像素，再把饱和度拉到可用区间。 */
function averageColor(pixels) {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha < 24)
            continue;
        const pr = pixels[i];
        const pg = pixels[i + 1];
        const pb = pixels[i + 2];
        const max = Math.max(pr, pg, pb);
        const min = Math.min(pr, pg, pb);
        if (max < 24 || min > 236)
            continue;
        r += pr;
        g += pg;
        b += pb;
        count += 1;
    }
    if (count === 0)
        return null;
    return boost({ r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) });
}
function boost(color) {
    const max = Math.max(color.r, color.g, color.b);
    const min = Math.min(color.r, color.g, color.b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    // 太灰的封面（黑白照）直接原样返回，硬拉饱和度只会出脏色。
    if (saturation < 0.08 || max === 0)
        return color;
    const target = Math.min(190, Math.max(96, max));
    const scale = target / max;
    return {
        r: Math.min(255, Math.round(color.r * scale)),
        g: Math.min(255, Math.round(color.g * scale)),
        b: Math.min(255, Math.round(color.b * scale)),
    };
}
export function rgba(color, alpha) {
    if (!color)
        return `rgba(255,107,107,${alpha})`;
    return `rgba(${color.r},${color.g},${color.b},${alpha})`;
}
/**
 * 补齐当前曲的封面 URL：`music_status` 不给，只能反查一次目录搜索并记进映射表。
 * 只对 Apple Music 曲目做（本地曲目服务端没有对应条目），且每个 key 只查一次。
 */
const backfilled = new Set();
export async function backfillArtworkURL(track, { store, music }) {
    if (!track || !track.musicItemId)
        return null;
    const key = stableKey(track);
    if (!key || backfilled.has(key))
        return store.artworkURL(track);
    backfilled.add(key);
    const query = [track.title, track.artist].filter(Boolean).join(' ');
    if (!query)
        return null;
    const result = await music('search', { query, types: ['song'], limit: 5 });
    const songs = (result.json && Array.isArray(result.json.songs)) ? result.json.songs : [];
    const hit = songs.find((row) => String(row.musicItemId) === String(track.musicItemId))
        || songs.find((row) => String(row.title || '').toLowerCase() === String(track.title || '').toLowerCase());
    if (hit && (hit.artworkUrl || hit.url)) {
        // 顺带把 Apple Music 页面链接记下来——`music_status` 也不给 externalURL，分享要用。
        store.rememberArtwork({ ...track, artworkUrl: hit.artworkUrl, url: hit.url });
        return hit.artworkUrl || null;
    }
    return null;
}
