// 展示层格式化。B 站的数字口径是「万 / 亿」，直接显示原始数字会让人对不上官方 App。
/** 播放量 / 弹幕数：1.2万、3.4亿。一万以下直接显示。 */
export function formatCount(n) {
    const value = Number(n) || 0;
    if (value >= 100_000_000)
        return `${(value / 100_000_000).toFixed(1).replace(/\.0$/, '')}亿`;
    if (value >= 10_000)
        return `${(value / 10_000).toFixed(1).replace(/\.0$/, '')}万`;
    return String(value);
}
/** 秒 → "12:34" / "1:02:03"。 */
export function formatDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (part) => String(part).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
/**
 * 清晰度档位标签。
 *
 * **不能直接用像素高度**：宽银幕视频（如 2.35:1 的 1920×804）按高度会显示成 "804p"，
 * 而 YouTube / B 站都把它叫 1080p —— 档位说的是**编码档**，不是这一条的实际高度。
 * 按宽度归档对横屏视频准确；竖屏（width 明显小于 height）退回用高度，
 * 否则一条 1080×1920 的竖屏视频会被算成 "480p"。
 */
export function qualityLabel(width, height, fallback) {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    if (!w || !h)
        return fallback || '';
    const basis = w >= h ? w : h; // 横屏看宽，竖屏看高
    const tier = basis >= 3840
        ? '4K'
        : basis >= 2560
            ? '1440p'
            : basis >= 1920
                ? '1080p'
                : basis >= 1280
                    ? '720p'
                    : basis >= 854
                        ? '480p'
                        : basis >= 640
                            ? '360p'
                            : basis >= 426
                                ? '240p'
                                : '144p';
    return tier;
}
/** 发布时间：今天显示时刻，今年显示月日，跨年显示年月日。 */
export function formatDate(unixSeconds) {
    const ts = Number(unixSeconds) || 0;
    if (!ts)
        return '';
    const date = new Date(ts * 1000);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay)
        return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    if (date.getFullYear() === now.getFullYear())
        return `${date.getMonth() + 1}-${date.getDate()}`;
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
