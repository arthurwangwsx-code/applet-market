// 时长 / 日期 / 导出格式（规格 §15）。负值 / NaN / 无穷一律按 0 秒处理。
function safeSeconds(value) {
    return Number.isFinite(value) && value > 0 ? value : 0;
}
/** 列表行 / 卡片 / 章节：≥1h → `h:mm:ss`，否则 `m:ss`。 */
export function clockString(seconds) {
    const total = Math.floor(safeSeconds(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0)
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}
/** transport 时间：始终 `m:ss`（分钟可 > 59）。 */
export function clockFlat(seconds) {
    const total = Math.floor(safeSeconds(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
/** 录音面板计时：`m:ss.cc`（百分秒）。 */
export function clockCentis(ms) {
    const total = Math.max(0, Math.floor(ms));
    const m = Math.floor(total / 60_000);
    const s = Math.floor((total % 60_000) / 1000);
    const cc = Math.floor((total % 1000) / 10);
    return `${m}:${String(s).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
}
/** 导出用：`hh:mm:ss` 或 `mm:ss`（**补零**）。 */
export function clockPadded(seconds) {
    const total = Math.floor(safeSeconds(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}
/** SRT 时间轴：`HH:MM:SS,mmm`。 */
export function srtTime(seconds) {
    const total = safeSeconds(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    const ms = Math.floor((total - Math.floor(total)) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`;
}
function pad(value) {
    return String(value).padStart(2, '0');
}
export function mediumDateTime(ms, locale) {
    try {
        return new Date(ms).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
    }
    catch {
        return new Date(ms).toISOString();
    }
}
export function shortDate(ms, locale) {
    try {
        return new Date(ms).toLocaleDateString(locale, { dateStyle: 'medium' });
    }
    catch {
        return new Date(ms).toISOString().slice(0, 10);
    }
}
/** 文件大小：`ByteCountFormatter` `.file` 风格（1 kB = 1000 B）。 */
export function byteSize(bytes) {
    const value = Math.max(0, bytes);
    if (value < 1000)
        return `${value} B`;
    if (value < 1_000_000)
        return `${(value / 1000).toFixed(0)} kB`;
    if (value < 1_000_000_000)
        return `${(value / 1_000_000).toFixed(1)} MB`;
    return `${(value / 1_000_000_000).toFixed(2)} GB`;
}
/**
 * 默认录音标题：`"{本地化 New Recording} {日期 时间}"`。
 * **必须在进持久层前解析成用户语言的真实文案** —— 绝不把 `New Recording` 这个 key 当用户数据存。
 */
export function defaultTitle(prefix, locale, at = new Date()) {
    let stamp;
    try {
        stamp = at.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'medium' });
    }
    catch {
        stamp = at.toISOString();
    }
    return `${prefix} ${stamp}`;
}
/** 分享文件名 slug：非字母数字/-/_ 全换成 `-`，压缩连字符，截断 60，空则 `recording`。 */
export function fileSlug(title) {
    const slug = String(title ?? '')
        .replace(/[^\p{L}\p{N}\-_]+/gu, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);
    return slug || 'recording';
}
/** Markdown 导出。 */
export function exportMarkdown(input) {
    const lines = [`# ${input.memo.title}`, ''];
    lines.push(`- **${input.labels.createdAt}:** ${mediumDateTime(input.memo.createdAt, input.locale)}`);
    lines.push(`- **${input.labels.duration}:** ${clockPadded(input.memo.duration)}`);
    lines.push('');
    if (input.summary.trim())
        lines.push(`## ${input.labels.summary}`, '', input.summary.trim(), '');
    const body = transcriptBody(input, true);
    if (body.text)
        lines.push(`## ${body.heading}`, '', body.text, '');
    if (input.chapters.length) {
        lines.push(`## ${input.labels.chapters}`, '');
        for (const chapter of input.chapters)
            lines.push(`- [${clockString(chapter.start)}] ${chapter.title}`);
        lines.push('');
    }
    if (input.actionItems.length) {
        lines.push(`## ${input.labels.actionItems}`, '');
        for (const item of input.actionItems) {
            const tail = [item.owner, item.dueHint, item.sourceTime !== undefined ? clockString(item.sourceTime) : '']
                .filter(Boolean)
                .join(' · ');
            lines.push(`- [${item.isDone ? 'x' : ' '}] ${item.text}${tail ? ` — ${tail}` : ''}`);
        }
        lines.push('');
    }
    if (input.translation.trim())
        lines.push(`## ${input.labels.translation}`, '', input.translation.trim(), '');
    return lines.join('\n').trimEnd() + '\n';
}
/** 纯文本导出：同结构，标题不带 `#`、正文不带 `**`。 */
export function exportText(input) {
    return exportMarkdown(input)
        .replace(/^#+ /gm, '')
        .replace(/\*\*/g, '');
}
function transcriptBody(input, markdown) {
    if (input.correctionTurns.length) {
        const text = input.correctionTurns
            .map((turn) => (markdown ? `**${turn.speaker}:** ${turn.text}` : `${turn.speaker}: ${turn.text}`))
            .join('\n\n');
        return { heading: input.labels.corrected, text };
    }
    return { heading: input.labels.transcript, text: input.transcript.trim() };
}
/**
 * SRT 字幕。
 *
 * ⚠️ 逐词时间戳（segments）在容器里**拿不到**（`memo_get_transcript` 只回 `segmentCount`，
 * 规格 §17.2 缺口④），所以这里只能走原生的**同一条兜底分支**：
 * 把整段 `fullText` 作为一条 cue（`0 → max(duration, 1)`）。
 * 校正稿存在时按 turn 均分时间轴，比一条 cue 可读得多，但仍不是真实时间戳 —— UI 上必须说明。
 */
export function exportSRT(input) {
    const total = Math.max(input.memo.duration, 1);
    const turns = input.correctionTurns;
    if (turns.length) {
        const slice = total / turns.length;
        return turns
            .map((turn, index) => {
            const start = index * slice;
            const end = Math.max(start + 0.2, (index + 1) * slice);
            return `${index + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${turn.speaker}: ${turn.text}\n`;
        })
            .join('\n');
    }
    const text = input.transcript.trim();
    if (!text)
        return '';
    return `1\n${srtTime(0)} --> ${srtTime(total)}\n${text}\n`;
}
/** 稳定哈希：用来判断「转写变了没有」→ 决定把 `ready` 降成 `stale`。 */
export function hashText(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return (hash >>> 0).toString(36);
}
/**
 * 行内摘录（规格 §2.2）：仅当命中不在标题里时显示；取匹配位置**前 16 字符、后 40 字符**，
 * 两端截断处加 `…`。
 */
export function snippetOf(text, query) {
    if (!text || !query)
        return undefined;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0)
        return undefined;
    const start = Math.max(0, index - 16);
    const end = Math.min(text.length, index + query.length + 40);
    return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
