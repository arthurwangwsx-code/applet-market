import type { UserConfig, Plugin } from 'vite';

/** 裸说明符 -> 运行时产物 URL（与 Swift `AppletImportRules.bareToFile` 一致）。 */
export declare const RUNTIME_MODULE_URLS: Readonly<Record<string, string>>;
/** 构建时恒 external 的说明符。 */
export declare const EXTERNAL_MODULES: readonly string[];
/** 明确禁止出现在产物里的说明符 -> 原因。 */
export declare const FORBIDDEN_MODULES: Readonly<Record<string, string>>;

export interface AppletConfigOptions {
  /** 入口，默认 `src/main.tsx`。 */
  entry?: string;
  /** 是否压缩，默认 false（真机调试只有堆栈可看）。 */
  minify?: boolean;
  /** sourcemap，默认 false（进包占体积预算并分发完整源码）。 */
  sourcemap?: boolean | 'inline';
  /** 额外 external。 */
  external?: string[];
  /** CI 模式：生成物不一致直接失败。 */
  checkGenerated?: boolean;
  /** 直接合并进最终配置。 */
  vite?: UserConfig;
}

export declare function defineAppletConfig(options?: AppletConfigOptions): UserConfig;
export declare function aiboxManifest(options?: { check?: boolean }): Plugin;
export declare function renderActionTypes(manifest: unknown): string;
export declare function checkManifest(manifest: unknown): string[];
export declare function isBuildableApp(appDir: string): boolean;
export declare function readAppManifest(appDir: string): unknown;
