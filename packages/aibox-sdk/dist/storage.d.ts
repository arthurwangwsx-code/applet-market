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
export declare function defineKey<T>(key: string, fallback: T, codec?: KeyCodec<T>): {
    key: string;
    read: () => Promise<T>;
    write: (value: T) => Promise<boolean>;
    clear: () => Promise<boolean>;
};
//# sourceMappingURL=storage.d.ts.map