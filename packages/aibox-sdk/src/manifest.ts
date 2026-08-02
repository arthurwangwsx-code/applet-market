/**
 * `manifest.json` 的 TypeScript 形状。
 *
 * manifest 是**声明**而不是代码，发布时仍然从 `src/manifest.json` 原样取（`release.mjs`）。
 * 这里给的类型有两个用途：
 *  ① 想用 TS 写 manifest 的应用可以 `defineManifest({...})` 然后由构建脚本 emit 成 JSON；
 *  ② `@aibox/applet-vite` 的 manifest 插件读它做 action 类型生成时共用同一份形状。
 *
 * 字段是宿主 `AppletManifest` 的**市场包子集**——本机身份（id/createdAt/updatedAt）与市场归属
 * （marketSourceID/marketAppID/marketVersion）由宿主安装时写，包里写了也会被丢弃，故这里不给。
 */

/**
 * 运行时形态（宿主 `AppletManifest.runtimeKind`，additive Optional）。
 *
 * · `source`（默认，老行为）：源码原样落盘，`index.html` 用 es-module-shims + Sucrase
 *   在浏览器里即时转译 `.jsx/.tsx/.ts`。AI 直接写代码的路径走这条。
 * · `bundle`：已构建产物，`index.html` 用原生 `<script type="module">` + 原生 import map
 *   直接加载，**不经过任何转译**。Vite + TS 工程走这条。
 *
 * 两者共用同一套 import map 与同一批运行时资产（react / antd-mobile / chart.js / aibox/ui
 * 恒为 external 裸 import），差别只在「要不要过转译钩子」。
 */
export type AppletRuntimeKind = 'source' | 'bundle';

/** 起步模板。**externalize react 的应用必须声明 `react`**——它决定宿主要不要备好 React 运行时资产。 */
export type AppletTemplate =
  | 'vanilla' | 'react'
  | 'game-canvas-lite' | 'game-2d-phaser' | 'game-2d-pixi' | 'game-3d-babylon' | 'game-ai-turnbased';

export type AppletSurface = 'card' | 'sheet' | 'drawer' | 'page' | 'fullscreen' | 'tab' | 'headless';

export interface AppletActionDeclaration {
  id: string;
  name: string;
  displayName?: string;
  summary: string;
  keywords?: string[];
  /** JSON Schema 字符串。**类型生成器读的就是它**——写准了才有编译期校验。 */
  inputSchemaJSON?: string;
  outputSchemaJSON?: string;
  headless?: boolean;
  visibility?: Array<'agent' | 'automation' | 'userInterface' | 'applet'>;
  effect?: string;
  readOnly?: boolean;
  destructive?: boolean;
  idempotent?: boolean;
}

export interface AppletPermissionsDeclaration {
  /** 原生 HTTP 代理。页面直连被 CSP 锁死，联网只能走 `aibox.net.fetch`。 */
  network?: boolean;
  storage?: boolean;
  ai?: boolean;
  /** 精确域名列表。市场包不允许 `'*'`。 */
  networkAllowed?: string[];
  /** 要用的扩展能力命名空间。容器内建的那批不用写。 */
  capabilities?: AiboxDeclarableCapability[];
}

export interface AppletManifestDeclaration {
  name: string;
  localizedNames?: Record<string, string>;
  icon: string;
  iconTintHex?: string;
  summary?: string;
  localizedSummaries?: Record<string, string>;
  template: AppletTemplate;
  /** 入口文件相对路径，通常 `index.html`。 */
  entry: string;
  /** 运行时形态。省略 = `source`（老宿主也这么理解）。 */
  runtimeKind?: AppletRuntimeKind;
  securityMode?: 'secure' | 'developer';
  permissions?: AppletPermissionsDeclaration;
  presentation?: { default?: AppletSurface; surfaces?: AppletSurface[] };
  actions?: AppletActionDeclaration[];
  scene?: Record<string, unknown>;
  [extra: string]: unknown;
}

/**
 * 恒等函数，只为拿类型检查与字面量推断。
 * `export default defineManifest({...} as const)` 之后 action 名就是字面量类型。
 */
export function defineManifest<T extends AppletManifestDeclaration>(manifest: T): T {
  return manifest;
}
