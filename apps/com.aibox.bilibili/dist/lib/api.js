// B 站 Web API 层。所有网络出口收敛在这里，页面只见业务对象。
//
// ## 三条来自实测的纪律（每条都踩过）
//
// 1. **`code === 0` 不等于有数据。** `wbi/search/type` 在风控下返回 `{code:0, data:{v_voucher:…}}` ——
//    没有 `result`、没有错误。所以改用 `wbi/search/all/v2`（实测稳定回 20 条），
//    且每个端点都要检查真正的数据字段，不能只看 code。
// 2. **`Referer` 是必须的，`Cookie` 不要自己写。** Referer 走 net.fetch 的请求头（浏览器 fetch 设不了，
//    这是原生代理的红利）；Cookie 由宿主的 per-applet 罐自动注入与收集（登录后 SESSDATA 自动生效）。
// 3. **播放地址用 `fnval=1` 而不是 DASH。** DASH（fnval=4048）是音视频分离流，AVPlayer 播不了；
//    `fnval=1` 回单文件 MP4 直链，实测**免登录就有 720P**、支持 Range，可以直接喂 aibox.video。
import { md5 } from './md5.js';
import { fetchJSON } from './host.js';
const API = 'https://api.bilibili.com';
/**
 * 登录相关接口在**另一个域**上。
 *
 * `passport-login` 这个路径前缀很容易让人以为它和其它接口一样挂在 `api.bilibili.com` 下 ——
 * 实测那样会拿到一个 **HTTP 404 的 HTML 页面**（不是 JSON 错误码），于是页面侧看到的是
 * 「responseType 'json' 但 body 不是合法 JSON」这种指向不明的报错。
 */
const PASSPORT = 'https://passport.bilibili.com';
/** B 站接口一律要 Referer 防盗链；UA 用移动端串，拿到的是移动端口径的数据。 */
const HEADERS = {
    Referer: 'https://www.bilibili.com',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
        + '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};
// —— WBI 签名 ——————————————————————————————————————————————
// 官方前端脚本里的固定重排表。搜索/推荐/空间等接口都要签，签错回 -403。
const MIXIN_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
    26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
    20, 34, 44, 52,
];
let cachedKey = null; // { key, at }
const KEY_TTL_MS = 6 * 60 * 60 * 1000;
/** 取 WBI mixin key。nav 未登录也回 key（code=-101 但 data.wbi_img 在），所以不看 code。 */
async function mixinKey() {
    if (cachedKey && Date.now() - cachedKey.at < KEY_TTL_MS)
        return cachedKey.key;
    const res = await fetchJSON(`${API}/x/web-interface/nav`, HEADERS);
    const img = res?.data?.wbi_img;
    if (!img?.img_url || !img?.sub_url)
        throw new Error('拿不到 WBI 密钥');
    const name = (u) => u.slice(u.lastIndexOf('/') + 1).split('.')[0];
    const raw = name(img.img_url) + name(img.sub_url);
    const key = MIXIN_TAB.map((i) => raw[i]).join('').slice(0, 32);
    cachedKey = { key, at: Date.now() };
    return key;
}
/** 给参数加 wts + w_rid，回完整 query 串。 */
async function signed(params) {
    const key = await mixinKey();
    const all = { ...params, wts: Math.floor(Date.now() / 1000) };
    const query = Object.keys(all).sort()
        // 官方实现会先剔除 value 里的 `!'()*` 再编码；不剔的话签名对不上。
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(all[k]).replace(/[!'()*]/g, ''))}`)
        .join('&');
    return `${query}&w_rid=${md5(query + key)}`;
}
// —— 通用取数 ——————————————————————————————————————————————
/**
 * B 站的风控是**间歇**的：同一个请求上一秒 `code: 0`、下一秒 `-352`（请求被拦截），
 * 隔几百毫秒重发又好了。不重试的话，用户看到的是「时好时坏的加载失败」，
 * 而实测里它也会让回归测试随机变红。
 *
 * 只重试**值得重试**的：`-352` 风控与传输层错误。参数错（-400）、
 * 未登录（-101）重试多少次都是一样的结果，重试只是浪费时间。
 */
const RETRYABLE_CODES = new Set([-352, -509]);
async function withRetry(run) {
    try {
        return await run();
    }
    catch (err) {
        if (!err?.retryable)
            throw err;
        await new Promise((resolve) => setTimeout(resolve, 600));
        return run();
    }
}
/** 把 B 站的业务错误码翻成 Error，并标记可否重试。 */
function apiError(res) {
    const err = new Error(res?.message || `接口返回 ${res?.code}`);
    err.code = res?.code;
    err.retryable = RETRYABLE_CODES.has(res?.code);
    return err;
}
async function get(path, params, base = API) {
    const query = params
        ? '?' + Object.keys(params).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&')
        : '';
    return withRetry(async () => {
        const res = await fetchJSON(`${base}${path}${query}`, HEADERS);
        if (res?.code !== 0)
            throw apiError(res);
        return res.data;
    });
}
async function getSigned(path, params) {
    return withRetry(async () => {
        // 签名在重试时重算：`wts` 是时间戳，隔了 600ms 再用旧签名反而更可疑。
        const res = await fetchJSON(`${API}${path}?${await signed(params)}`, HEADERS);
        if (res?.code !== 0)
            throw apiError(res);
        return res.data;
    });
}
// —— 列表面 ——————————————————————————————————————————————
/** 一条视频的统一投影。各端点字段名不一致（pic/cover、owner.name/author…），在这里抹平。 */
function normalizeVideo(raw) {
    if (!raw)
        return null;
    const bvid = raw.bvid || raw.bvId || '';
    if (!bvid)
        return null;
    const stat = raw.stat || {};
    return {
        bvid,
        aid: raw.aid || raw.id || 0,
        cid: raw.cid || 0,
        title: String(raw.title || '').replace(/<[^>]+>/g, ''), // 搜索结果的标题带 <em> 高亮标签
        cover: normalizeImage(raw.pic || raw.cover || raw.first_frame || ''),
        author: raw.owner?.name || raw.author || raw.up_name || '',
        mid: raw.owner?.mid || raw.mid || 0,
        duration: parseDuration(raw.duration),
        play: stat.view ?? raw.play ?? raw.stat?.view ?? 0,
        danmaku: stat.danmaku ?? raw.video_review ?? 0,
        pubdate: raw.pubdate || raw.ctime || raw.senddate || 0,
    };
}
/** 封面 URL 归一：搜索结果给的是 `//i0.hdslb.com/…` 协议相对地址，直接用会变成 applet://。 */
function normalizeImage(url) {
    if (!url)
        return '';
    if (url.startsWith('//'))
        return `https:${url}`;
    return url.replace(/^http:/, 'https:');
}
/** 时长：列表接口有的给秒（number），有的给 "12:34" 串。 */
function parseDuration(raw) {
    if (typeof raw === 'number')
        return raw;
    if (typeof raw !== 'string' || !raw)
        return 0;
    const parts = raw.split(':').map((n) => parseInt(n, 10) || 0);
    return parts.reduce((acc, n) => acc * 60 + n, 0);
}
/**
 * 首页推荐流（免登录也有，登录后是个性化的）。
 *
 * ⚠️ `ps` **只能是 12**。实测 `ps=20` 一律回 `-400 请求错误`，而 `ps=12` 正常——
 * 且不管传几，服务端实际都回 **30 条**。也就是说这个参数被服务端忽略，**但取值仍被校验**。
 * 别把它改成「看起来更合理」的数字，也别以为返回条数和它有关系。
 * 同理不传 `fresh_type`：带上它同样会 -400。
 */
export async function recommend(freshIdx = 1) {
    const data = await getSigned('/x/web-interface/wbi/index/top/rcmd', { ps: 12, fresh_idx: freshIdx });
    return (data?.item || []).map(normalizeVideo).filter(Boolean);
}
/** 热门（免签）。 */
export async function popular(pn = 1) {
    const data = await get('/x/web-interface/popular', { ps: 20, pn });
    return (data?.list || []).map(normalizeVideo).filter(Boolean);
}
/** 排行榜（免签，一次回 100 条，无分页）。`rid=0` 是全站。 */
export async function ranking(rid = 0) {
    const data = await get('/x/web-interface/ranking/v2', { rid, type: 'all' });
    return (data?.list || []).map(normalizeVideo).filter(Boolean);
}
/** 综合搜索。**用 all/v2 而不是 type**：后者在风控下静默回空壳（见文件头纪律 1）。 */
export async function search(keyword, page = 1) {
    const data = await getSigned('/x/web-interface/wbi/search/all/v2', { keyword, page });
    const groups = data?.result || [];
    const videos = groups.find((g) => g.result_type === 'video')?.data || [];
    const bangumi = groups.find((g) => g.result_type === 'media_bangumi')?.data || [];
    const users = groups.find((g) => g.result_type === 'bili_user')?.data || [];
    return {
        videos: videos.map(normalizeVideo).filter(Boolean),
        bangumi: bangumi.map((b) => ({
            title: String(b.title || '').replace(/<[^>]+>/g, ''),
            cover: normalizeImage(b.cover),
            url: b.url || '',
            desc: b.desc || b.styles || '',
        })),
        users: users.map((u) => ({
            mid: u.mid,
            name: u.uname || '',
            avatar: normalizeImage(u.upic),
            fans: u.fans || 0,
            videos: u.videos || 0,
        })),
    };
}
/** 热搜词。 */
export async function hotSearch() {
    try {
        const data = await getSigned('/x/web-interface/wbi/search/square', { limit: 10 });
        return (data?.trending?.list || []).map((t) => t.keyword).filter(Boolean);
    }
    catch {
        return []; // 热搜是锦上添花，挂了不该让搜索页开不了
    }
}
// —— 详情与播放 ——————————————————————————————————————————
/** 视频详情。含分P（pages）与 UP 主信息。 */
export async function videoDetail(bvid) {
    const data = await get('/x/web-interface/view', { bvid });
    return {
        ...normalizeVideo(data),
        cid: data.cid,
        desc: data.desc || '',
        like: data.stat?.like || 0,
        coin: data.stat?.coin || 0,
        favorite: data.stat?.favorite || 0,
        share: data.stat?.share || 0,
        reply: data.stat?.reply || 0,
        avatar: normalizeImage(data.owner?.face || ''),
        pages: (data.pages || []).map((p) => ({
            cid: p.cid,
            page: p.page,
            title: p.part || `P${p.page}`,
            duration: p.duration || 0,
        })),
    };
}
/**
 * 取可播放的 MP4 直链。
 *
 * `fnval: 1` = 老的 MP4 格式，回 `durl[]`（单文件，音视频已合流）。**这是关键选择**：
 * 默认的 `fnval: 4048`（DASH）回的是分离流，AVPlayer 放不了，而小应用又不可能自己合流。
 * 实测未登录能拿到 720P（`format: "mp4720"`），登录后更高。
 *
 * 回 `{ url, quality, format, timelength }`。
 */
export async function playURL(bvid, cid, qn = 80) {
    const data = await get('/x/player/playurl', { bvid, cid, qn, fnval: 1, fourk: 1 });
    const durl = data?.durl || [];
    if (!durl.length)
        throw new Error('这个视频没有可直接播放的地址');
    return {
        url: durl[0].url,
        backup: durl[0].backup_url || [],
        quality: data.quality,
        format: data.format || '',
        // 服务端给的是毫秒
        duration: Math.round((data.timelength || 0) / 1000),
        accepted: (data.accept_description || []).map((label, i) => ({
            label,
            qn: (data.accept_quality || [])[i],
        })).filter((q) => q.qn != null),
    };
}
/** 相关推荐（免签，一次 40 条）。 */
export async function related(bvid) {
    try {
        const data = await get('/x/web-interface/archive/related', { bvid });
        return (Array.isArray(data) ? data : []).map(normalizeVideo).filter(Boolean);
    }
    catch {
        return [];
    }
}
// —— 登录 ——————————————————————————————————————————————
/** 申请登录二维码。回 `{ url, key }`。**走 PASSPORT 域**（见该常量的注释）。 */
export async function loginQRCode() {
    const data = await get('/x/passport-login/web/qrcode/generate', null, PASSPORT);
    if (!data?.url || !data?.qrcode_key)
        throw new Error('接口没有返回二维码');
    return { url: data.url, key: data.qrcode_key };
}
/**
 * 轮询扫码状态。
 *
 * 关键：登录成功时 B 站在**响应头**里下发 SESSDATA 等 cookie，宿主的 per-applet cookie 罐
 * 会自动收下（`net.fetch` 负责），所以这里**不需要**、也**不应该**自己解析 Set-Cookie。
 * 回 `{ status: 'pending'|'scanned'|'expired'|'ok', message }`。
 */
export async function loginPoll(qrcodeKey) {
    const res = await fetchJSON(`${PASSPORT}/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcodeKey)}`, HEADERS);
    // 注意是 `data.code` 而不是外层 `code`：外层恒 0（HTTP 层面成功），
    // 真正的扫码状态在 data 里（86101 未扫码 / 86090 已扫待确认 / 86038 失效 / 0 成功）。
    const code = res?.data?.code;
    if (code === 0)
        return { status: 'ok', message: '登录成功' };
    if (code === 86038)
        return { status: 'expired', message: '二维码已失效' };
    if (code === 86090)
        return { status: 'scanned', message: '已扫码，请在手机上确认' };
    return { status: 'pending', message: '等待扫码' };
}
/** 当前登录状态。未登录时 nav 回 code=-101。 */
export async function me() {
    const res = await fetchJSON(`${API}/x/web-interface/nav`, HEADERS);
    if (res?.code !== 0 || !res?.data?.isLogin)
        return null;
    return {
        mid: res.data.mid,
        name: res.data.uname || '',
        avatar: normalizeImage(res.data.face || ''),
        level: res.data.level_info?.current_level || 0,
        coins: res.data.money || 0,
    };
}
/** 观看历史（需登录）。 */
export async function history() {
    const data = await get('/x/web-interface/history/cursor', { ps: 20, type: 'archive' });
    return (data?.list || []).map((item) => normalizeVideo({
        ...item,
        bvid: item.history?.bvid,
        cid: item.history?.cid,
        owner: { name: item.author_name, mid: item.author_mid },
    })).filter(Boolean);
}
