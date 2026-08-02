import type { JSONValue } from './json';
/** 读一个键。不存在或桥不可用时返回 `fallback`。 */
export declare function get<T = JSONValue>(key: string, fallback: T): Promise<T>;
/**
 * 读一个键并**校验形状**。`parse` 抛或返回 undefined 都回落 `fallback`。
 * 这是持久化数据跨版本演进的正确读法——旧形状不该让新版本崩。
 */
export declare function getParsed<T>(key: string, parse: (raw: JSONValue) => T | undefined, fallback: T, onInvalid?: (raw: JSONValue) => void): Promise<T>;
/** 写一个键。 */
export declare function set(key: string, value: JSONValue): Promise<boolean>;
/** 删一个键。 */
export declare function remove(key: string): Promise<boolean>;
/** 列出全部键。 */
export declare function list(): Promise<string[]>;
/**
 * 一个键的类型化句柄。适合「一个模块管一份状态」的写法：
 * ```ts
 * const settings = defineKey<Settings>('settings', DEFAULT_SETTINGS)
 * const current = await settings.read()
 * await settings.write({ ...current, theme: 'dark' })
 * ```
 */
export declare function defineKey<T extends JSONValue>(key: string, fallback: T): {
    key: string;
    read: () => Promise<T>;
    readParsed: (parse: (raw: JSONValue) => T | undefined, onInvalid?: (raw: JSONValue) => void) => Promise<T>;
    write: (value: T) => Promise<boolean>;
    clear: () => Promise<boolean>;
};
//# sourceMappingURL=storage.d.ts.map