import { storage } from '@aibox/applet-sdk';
import type { JSONValue } from '@aibox/applet-sdk';

/** 一段已完成（或被中断）的计时记录。 */
export interface Session {
  id: string;
  label: string;
  /** 计划时长（秒）。 */
  plannedSeconds: number;
  /** 实际计到的秒数。被中断时小于 plannedSeconds。 */
  actualSeconds: number;
  /** 结束时刻（epoch 毫秒）。 */
  finishedAt: number;
  completed: boolean;
}

export interface RunningTimer {
  label: string;
  plannedSeconds: number;
  /** 起始时刻（epoch 毫秒）。**存起点而不是存剩余秒数**——后台/锁屏时 JS 定时器会被节流，
   *  按剩余量递减会漂；按墙钟差值算永远准。 */
  startedAt: number;
}

export const DEFAULT_SECONDS = 25 * 60;
const HISTORY_LIMIT = 100;

const running = storage.defineKey<JSONValue>('timer.running', null);
const history = storage.defineKey<JSONValue>('timer.history', []);

function asRecord(value: JSONValue): Record<string, JSONValue> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, JSONValue>)
    : null;
}

function toRunning(raw: JSONValue): RunningTimer | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;
  const plannedSeconds = Number(record.plannedSeconds);
  const startedAt = Number(record.startedAt);
  if (!Number.isFinite(plannedSeconds) || plannedSeconds <= 0) return undefined;
  if (!Number.isFinite(startedAt) || startedAt <= 0) return undefined;
  return { label: typeof record.label === 'string' ? record.label : '', plannedSeconds, startedAt };
}

function toSession(raw: JSONValue): Session | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;
  const id = typeof record.id === 'string' ? record.id : null;
  if (!id) return undefined;
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
export function remainingSeconds(timer: RunningTimer, now = Date.now()): number {
  const elapsed = Math.floor((now - timer.startedAt) / 1000);
  return Math.max(0, timer.plannedSeconds - elapsed);
}

export async function loadRunning(): Promise<RunningTimer | null> {
  const value = await running.readParsed(toRunning);
  return toRunning(value as JSONValue) ?? null;
}

export async function saveRunning(timer: RunningTimer | null): Promise<void> {
  await running.write(timer === null ? null : ({ ...timer } as unknown as JSONValue));
}

export async function loadHistory(): Promise<Session[]> {
  const value = await history.read();
  if (!Array.isArray(value)) return [];
  return value.map(toSession).filter((entry): entry is Session => entry !== undefined);
}

export async function appendHistory(session: Session): Promise<Session[]> {
  const previous = await loadHistory();
  const next = [session, ...previous].slice(0, HISTORY_LIMIT);
  await history.write(next as unknown as JSONValue);
  return next;
}

export async function clearHistory(): Promise<void> {
  await history.write([]);
}

/** `mm:ss`（超过一小时给 `h:mm:ss`）。 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 从 action 入参解析出时长（秒）。`seconds` 优先于 `minutes`，都没有走默认。 */
export function durationFrom(input: { minutes?: number; seconds?: number }): number {
  if (Number.isFinite(input.seconds) && (input.seconds as number) > 0) {
    return Math.min(10800, Math.floor(input.seconds as number));
  }
  if (Number.isFinite(input.minutes) && (input.minutes as number) > 0) {
    return Math.min(180, Math.floor(input.minutes as number)) * 60;
  }
  return DEFAULT_SECONDS;
}

export function newSessionID(): string {
  return `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
