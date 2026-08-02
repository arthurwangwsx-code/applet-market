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

/**
 * 一个键的类型化句柄。适合「一个模块管一份状态」的写法：
 * ```ts
 * const settings = defineKey<Settings>('settings', DEFAULT_SETTINGS)
 * const current = await settings.read()
 * await settings.write({ ...current, theme: 'dark' })
 * ```
 */
export function defineKey<T extends JSONValue>(key: string, fallback: T) {
  return {
    key,
    read: () => get<T>(key, fallback),
    readParsed: (parse: (raw: JSONValue) => T | undefined, onInvalid?: (raw: JSONValue) => void) =>
      getParsed<T>(key, parse, fallback, onInvalid),
    write: (value: T) => set(key, value),
    clear: () => remove(key),
  };
}
