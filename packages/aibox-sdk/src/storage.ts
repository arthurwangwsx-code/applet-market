import { bridge } from './bridge';
import type { JSONValue } from './json';
import { AiboxError, normalizeError } from './errors';

/**
 * `aibox.storage` 的类型化封装。
 *
 * 裸 API 返回 `JSONValue | null`，于是每个应用都写一遍「取出来 -> 判 null -> as 成自己的类型」。
 * 这里把那三步收成一个带默认值的 `get<T>()`，并额外做一件裸 API 不做的事：**读到坏数据时不崩**
 * （旧版本写进去的形状变了 → `parse` 失败 → 回默认值 + 可选回调，而不是让整个应用白屏）。
 */

function requireStorage(): NonNullable<ReturnType<typeof bridge>>['storage'] {
  const host = bridge();
  if (!host?.storage || typeof host.storage.get !== 'function') {
    throw new AiboxError(
      'aibox/unavailable',
      'aibox/unavailable: aibox.storage is not available. Set "storage": true in manifest.permissions.',
    );
  }
  return host.storage;
}

/** 读一个键。不存在或桥不可用时返回 `fallback`。 */
export async function get<T = JSONValue>(key: string, fallback: T): Promise<T> {
  const host = bridge();
  if (!host?.storage) return fallback;
  try {
    const value = await host.storage.get(key);
    return (value === null || value === undefined) ? fallback : (value as T);
  } catch {
    return fallback;
  }
}

/**
 * 读一个键并**校验形状**。`parse` 抛或返回 undefined 都回落 `fallback`。
 * 这是持久化数据跨版本演进的正确读法——旧形状不该让新版本崩。
 */
export async function getParsed<T>(
  key: string,
  parse: (raw: JSONValue) => T | undefined,
  fallback: T,
  onInvalid?: (raw: JSONValue) => void,
): Promise<T> {
  const host = bridge();
  if (!host?.storage) return fallback;
  let raw: JSONValue | null = null;
  try {
    raw = await host.storage.get(key);
  } catch {
    return fallback;
  }
  if (raw === null || raw === undefined) return fallback;
  try {
    const parsed = parse(raw);
    if (parsed === undefined) { onInvalid?.(raw); return fallback; }
    return parsed;
  } catch {
    onInvalid?.(raw);
    return fallback;
  }
}

/** 写一个键。 */
export async function set(key: string, value: JSONValue): Promise<boolean> {
  try {
    return await requireStorage().set(key, value);
  } catch (error) {
    throw normalizeError(error);
  }
}

/** 删一个键。 */
export async function remove(key: string): Promise<boolean> {
  try {
    return await requireStorage().remove(key);
  } catch (error) {
    throw normalizeError(error);
  }
}

/** 列出全部键。 */
export async function list(): Promise<string[]> {
  try {
    return await requireStorage().list();
  } catch {
    return [];
  }
}

/** 一个键的编解码器。给了 `parse` 就等于给这份持久化数据加了「跨版本读」的保护。 */
export interface KeyCodec<T> {
  /** 原始 JSON -> 领域类型。返回 undefined 表示形状不认识，回落默认值。 */
  parse?: (raw: JSONValue) => T | undefined;
  /** 领域类型 -> 原始 JSON。省略时按结构等价直传。 */
  serialize?: (value: T) => JSONValue;
  /** 读到不认识的形状时的回调（记日志、上报，别静默）。 */
  onInvalid?: (raw: JSONValue) => void;
}

/**
 * 一个键的类型化句柄。适合「一个模块管一份状态」的写法，且把**编解码与校验收在一处**——
 * 持久化数据跨版本演进时，只有这一个地方需要改：
 * ```ts
 * const settings = defineKey<Settings>('settings', DEFAULTS, { parse: toSettings })
 * const current = await settings.read()          // 旧形状自动回落 DEFAULTS，不崩
 * await settings.write({ ...current, theme: 'dark' })
 * ```
 */
export function defineKey<T>(key: string, fallback: T, codec: KeyCodec<T> = {}) {
  const encode = (value: T): JSONValue =>
    (codec.serialize ? codec.serialize(value) : (value as unknown as JSONValue));
  return {
    key,
    read: (): Promise<T> => (codec.parse
      ? getParsed<T>(key, codec.parse, fallback, codec.onInvalid)
      : get<T>(key, fallback)),
    write: (value: T) => set(key, encode(value)),
    clear: () => remove(key),
  };
}
