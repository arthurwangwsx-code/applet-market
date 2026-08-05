// 显示格式（规格 §7.1）。时间一律等宽数字（CSS 侧 font-variant-numeric: tabular-nums）。
/** 时长：`m:ss`（不足 1 小时）/ `h:mm:ss`。不强制补小时位。 */
export function duration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const s = total % 60;
    const m = Math.floor(total / 60) % 60;
    const h = Math.floor(total / 3600);
    const two = (value) => (value < 10 ? `0${value}` : String(value));
    return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}
/** 剩余时间：带 `-` 前缀；总时长 ≤ 0 时 `--:--`。 */
export function remaining(position, total) {
    if (!(Number(total) > 0))
        return '--:--';
    const left = Math.max(0, Math.floor(Number(total) - Number(position)));
    return `-${duration(left)}`;
}
/** 已播时间；总时长 ≤ 0 时仍显示 0:00（原生左侧始终有值）。 */
export function elapsed(position) {
    return duration(Math.max(0, Number(position) || 0));
}
export function percent(value) {
    return `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
}
/** 音效速度：`%.2f×`；预设胶囊 1.0 用 `%.0f×`，其它 `%.2g×`。 */
export function rateLabel(rate) {
    return `${(Number(rate) || 1).toFixed(2)}×`;
}
export function presetRateLabel(rate) {
    const value = Number(rate) || 1;
    if (Number.isInteger(value))
        return `${value}×`;
    return `${String(Number(value.toPrecision(2)))}×`;
}
/** EQ 频段标签：< 1000 直接数字；≥ 1000 用 k。 */
export function bandLabel(hz) {
    const value = Number(hz) || 0;
    return value >= 1000 ? `${value / 1000}k` : String(value);
}
/** EQ 增益：带符号整数。 */
export function gainLabel(db) {
    const value = Math.round(Number(db) || 0);
    return value > 0 ? `+${value}` : String(value);
}
/** 音质标签：仅 flac / alac 显示大写徽标；其它编码（含 Apple Music）一律不标。 */
export function losslessBadge(codec) {
    const value = String(codec || '').toLowerCase();
    return (value === 'flac' || value === 'alac') ? value.toUpperCase() : null;
}
/** 曲目的稳定键：Apple Music `am:<id>`，本地/URL `url:<绝对地址>`。收藏与播放历史共用。 */
export function stableKey(track) {
    if (!track)
        return null;
    if (track.musicItemId)
        return `am:${track.musicItemId}`;
    if (track.url)
        return `url:${track.url}`;
    if (track.localTrackId)
        return `local:${track.localTrackId}`;
    return null;
}
/** 「艺人 · 专辑」副标题，缺项跳过。 */
export function trackSubtitle(track) {
    return [track && track.artist, track && track.album].filter(Boolean).join(' · ');
}
/** 把工具返回的曲目对象规范成播放参数（`music_play` / `music_queue add` 都吃这套字段）。 */
export function playArgs(track) {
    const args = {};
    if (track.musicItemId)
        args.musicItemId = track.musicItemId;
    if (track.url)
        args.url = track.url;
    if (track.localTrackId)
        args.localTrackId = track.localTrackId;
    if (track.title)
        args.title = track.title;
    if (track.artist)
        args.artist = track.artist;
    if (track.album)
        args.album = track.album;
    if (track.artworkUrl)
        args.artworkUrl = track.artworkUrl;
    if (Number(track.duration) > 0)
        args.duration = Number(track.duration);
    return args;
}
