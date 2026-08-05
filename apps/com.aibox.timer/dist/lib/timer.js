import { storage } from '../lib/aibox-sdk.js';
export const DEFAULT_SECONDS = 25 * 60;
const HISTORY_LIMIT = 100;
// 编解码收在一处：旧版本写进去的形状不认识时回落默认值，而不是让整个应用白屏。
const running = storage.defineKey('timer.running', null, {
    parse: (raw) => (raw === null ? null : toRunning(raw)),
    serialize: (value) => (value === null ? null : { ...value }),
});
const history = storage.defineKey('timer.history', [], {
    parse: (raw) => (Array.isArray(raw)
        ? raw.map(toSession).filter((entry) => entry !== undefined)
        : undefined),
    serialize: (value) => value,
});
function asRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function toRunning(raw) {
    const record = asRecord(raw);
    if (!record)
        return undefined;
    const plannedSeconds = Number(record.plannedSeconds);
    const startedAt = Number(record.startedAt);
    if (!Number.isFinite(plannedSeconds) || plannedSeconds <= 0)
        return undefined;
    if (!Number.isFinite(startedAt) || startedAt <= 0)
        return undefined;
    return { label: typeof record.label === 'string' ? record.label : '', plannedSeconds, startedAt };
}
function toSession(raw) {
    const record = asRecord(raw);
    if (!record)
        return undefined;
    const id = typeof record.id === 'string' ? record.id : null;
    if (!id)
        return undefined;
    return {
        id,
        label: typeof record.label === 'string' ? record.label : '',
        plannedSeconds: Number(record.plannedSeconds) || 0,
        actualSeconds: Number(record.actualSeconds) || 0,
        finishedAt: Number(record.finishedAt) || 0,
        completed: record.completed === true,
    };
}
/** 剩余秒数。已到点返回 0。 */
export function remainingSeconds(timer, now = Date.now()) {
    const elapsed = Math.floor((now - timer.startedAt) / 1000);
    return Math.max(0, timer.plannedSeconds - elapsed);
}
export function loadRunning() {
    return running.read();
}
export function saveRunning(timer) {
    return running.write(timer);
}
export function loadHistory() {
    return history.read();
}
export async function appendHistory(session) {
    const previous = await loadHistory();
    const next = [session, ...previous].slice(0, HISTORY_LIMIT);
    await history.write(next);
    return next;
}
export function clearHistory() {
    return history.write([]);
}
/** `mm:ss`（超过一小时给 `h:mm:ss`）。 */
export function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (value) => String(value).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
/** 从 action 入参解析出时长（秒）。`seconds` 优先于 `minutes`，都没有走默认。 */
export function durationFrom(input) {
    if (Number.isFinite(input.seconds) && input.seconds > 0) {
        return Math.min(10800, Math.floor(input.seconds));
    }
    if (Number.isFinite(input.minutes) && input.minutes > 0) {
        return Math.min(180, Math.floor(input.minutes)) * 60;
    }
    return DEFAULT_SECONDS;
}
export function newSessionID() {
    return `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
