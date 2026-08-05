// 歌词：取词 → 行模型 → 逐行同步接口。
//
// ⚠️ 当前平台事实（framework-capabilities.md §3.6.1 缺口 #2）：
// `music_lyrics` 返回的是**剥掉 `[mm:ss]` 时间轴的纯文本**（包内 `lyrics.lines.map(\.text)`），
// 所以今天只能整块居中显示 —— 当前行高亮、自动滚动、卡拉OK扫光、点行跳转**全部做不了**。
//
// 但接口按规格 §4.7 的形状**留好了**：行模型统一是 `{time, text, translation}`，
// `currentLineIndex` / `sweepRatio` 已实现且有单测。等宿主补上
// `{synced, source, lines:[{time,text,translation}]}`，只要 `readLyricsPayload` 认出结构化字段，
// 上层渲染无需改动就会自动变成逐行同步。
//
// 另外：**不要自己去网上抓歌词**。包内已有 lrclib → 网易云 → QQ 的多源链路 + 严格匹配门
// + 正负缓存 + AI 翻译，重造一份既错又会显示错歌词。
const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET_TAG = /\[offset:\s*([+-]?\d+)\s*\]/i;
/** LRC 解析（规格 §4.2）：一行多标签各产一行；`[offset:±ms]` 加到所有时间轴上；按时间升序。 */
export function parseLRC(raw) {
    const source = String(raw || '');
    if (!source)
        return [];
    const offsetMatch = OFFSET_TAG.exec(source);
    const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;
    const out = [];
    source.split(/\r?\n/).forEach((line) => {
        TIME_TAG.lastIndex = 0;
        const times = [];
        let match = TIME_TAG.exec(line);
        while (match !== null) {
            const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
            times.push(Number(match[1]) * 60 + Number(match[2]) + fraction);
            match = TIME_TAG.exec(line);
        }
        if (times.length === 0)
            return;
        const text = line.replace(TIME_TAG, '').trim();
        times.forEach((time) => out.push({ time: Math.max(0, time + offset), text, translation: null }));
    });
    return out.sort((a, b) => a.time - b.time);
}
/** 纯文本歌词 → 行模型：按行拆、trim、去空行，`time = null`。 */
export function plainLines(raw) {
    return String(raw || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((text) => ({ time: null, text, translation: null }));
}
/** 当前行 = 最后一个满足 `time <= 显示时间 + 0.05` 的行。无时间轴时恒为 -1。 */
export function currentLineIndex(lines, displayTime) {
    if (!Array.isArray(lines) || lines.length === 0)
        return -1;
    const threshold = Number(displayTime) + 0.05;
    let found = -1;
    for (let i = 0; i < lines.length; i += 1) {
        const time = lines[i].time;
        if (time === null || time === undefined)
            continue;
        if (time <= threshold)
            found = i;
        else
            break;
    }
    return found;
}
/**
 * 当前行的卡拉OK扫光比例（规格 §4.7）：
 * `clamp((显示时间 - 本行时间) / max(0.25, 下一行时间 - 本行时间), 0, 1)`；无下一行按 +4s 估算。
 * 量化到 1/60 档，吃掉浮点微抖。
 */
export function sweepRatio(lines, index, displayTime) {
    if (!Array.isArray(lines) || index < 0 || index >= lines.length)
        return 0;
    const line = lines[index];
    if (line.time === null || line.time === undefined)
        return 0;
    const next = lines[index + 1];
    const end = (next && next.time !== null && next.time !== undefined) ? next.time : line.time + 4;
    const span = Math.max(0.25, end - line.time);
    const raw = (Number(displayTime) - line.time) / span;
    const clamped = Math.max(0, Math.min(1, raw));
    return Math.round(clamped * 60) / 60;
}
const HEADER = /^Lyrics for [\s\S]*?:\n\n/;
const NO_LYRICS = /^No lyrics found for/i;
const NOTHING_PLAYING = /^No song specified/i;
/**
 * 把 `music_lyrics` 的返回读成行模型。
 * 三条路径，按可用性从高到低：
 *  1. 宿主已经透出结构化 `lines`（未来补上缺口 #2 后）→ 直接用，`synced` 由宿主给；
 *  2. 文本里带 `[mm:ss]` → 按 LRC 解析（宿主某天改成回传原始 LRC 也能直接吃）；
 *  3. 当前实现：纯文本 → 无时间轴行模型。
 */
export function readLyricsPayload(result) {
    if (!result || !result.ok) {
        return { state: 'none', synced: false, lines: [], source: null };
    }
    const structured = result.json && !Array.isArray(result.json) ? result.json : null;
    if (structured && Array.isArray(structured.lines)) {
        const lines = structured.lines
            .map((row) => ({
            time: (row && typeof row.time === 'number') ? row.time : null,
            text: String((row && row.text) || ''),
            translation: (row && row.translation) ? String(row.translation) : null,
        }));
        return {
            state: lines.length > 0 ? 'ok' : 'none',
            synced: !!structured.synced && lines.some((row) => row.time !== null),
            lines,
            source: structured.source || null,
        };
    }
    const text = String(result.text || '');
    if (!text || NO_LYRICS.test(text) || NOTHING_PLAYING.test(text)) {
        return { state: 'none', synced: false, lines: [], source: null };
    }
    const body = text.replace(HEADER, '');
    const hasTimeline = /\[\d{1,3}:\d{1,2}/.test(body);
    const lines = hasTimeline ? parseLRC(body) : plainLines(body);
    return {
        state: lines.length > 0 ? 'ok' : 'none',
        synced: hasTimeline && lines.some((row) => row.time !== null),
        lines,
        source: null,
    };
}
/** 取当前播放曲（或指定曲）的歌词。 */
export async function fetchLyrics(music, track) {
    const args = {};
    if (track && track.title) {
        args.title = track.title;
        if (track.artist)
            args.artist = track.artist;
    }
    const result = await music('lyrics', args);
    return readLyricsPayload(result);
}
