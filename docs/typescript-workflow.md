# TypeScript 小应用工程

本仓库只有一条应用生产路径：**严格 TypeScript + `@aibox/applet-tsbuild` + 宿主共享 SDK**。
Vite 预设与 `source` 应用均已退役；当前市场源码为零 JS/JSX，构建器与审计会阻止它们回流。

## 1. 创建与目录

```bash
npm run new -- com.aibox.weather --name "天气" --icon cloud.sun.fill \
  --category tools --summary "本地天气与预报"
npm install
npm run typecheck --prefix apps/com.aibox.weather
npm run build --prefix apps/com.aibox.weather
```

脚手架生成：

```text
apps/com.aibox.weather/
  app.json
  package.json
  tsconfig.json
  src/
    app.tsx
    manifest.json
    .tests.json
  dist/                 # aibox-tsbuild 生成并签入
```

不要添加 `vite.config.*`、应用根 `index.html` 或 `src/main.tsx`。构建器保留源码目录结构，生成
`dist/**/*.js` 与标准 `dist/index.html`；宿主直接加载原生 ESM，设备端不再转译。

## 2. 类型与代码政策

所有应用继承：

```json
{
  "extends": "@aibox/applet-tsbuild/tsconfig.base.json",
  "include": ["src"]
}
```

TS/TSX 使用 `strict`、`noUncheckedIndexedAccess`、`isolatedModules`。源码中的相对 import 必须写最终产物
扩展名：即使文件是 `row.tsx`，也写 `import { Row } from './row.js'`。

基础配置固定 `allowJs:false`。规则是：

- 应用源码只能是 TS/TSX，`aibox-tsbuild` 在 emit 前直接拒绝 JS/JSX；
- `strict`、`noUncheckedIndexedAccess` 与 `isolatedModules` 统一继承，应用不得降级；
- Biome 禁止显式 `any` 与 `@ts-ignore`，TypeScript 政策额外禁止 `@ts-nocheck` 和 `strict:false`；
- `config/legacy-js-baseline.json` 是空基线，任何 JS/JSX 回流都会让 CI 失败。

迁移命令：

```bash
node scripts/migrate-to-ts.mjs com.aibox.legacy --dry-run
node scripts/migrate-to-ts.mjs com.aibox.legacy --out .migrate-preview/com.aibox.legacy
# 审阅预览后才可显式就地迁移：
node scripts/migrate-to-ts.mjs com.aibox.legacy --in-place --force
```

迁移器会改扩展名、桥调用和工程文件，但严格类型错误会如实留在报告里，不会降低类型等级换绿灯。

## 3. SDK：开发期 npm，运行期宿主单实例

业务源码始终写稳定的开发期说明符：

```ts
import { checkCompatibility, storage, supports, ui } from '@aibox/applet-sdk'
import { useTabs } from '@aibox/applet-sdk/react'
```

`aibox-tsbuild` 会把它们分别重写成 `aibox/sdk` 与 `aibox/sdk/react`。两者在宿主 import map 中都指向
同一个 `aibox-sdk.mjs`，因此每台设备只有一份 SDK 实现和一个模块实例；应用包里不再复制
`dist/lib/aibox-sdk.js`。npm 包负责类型、开发期 API 与老构建兼容。

应用启动时可以读取容器兼容信息并自行降级：

```ts
import { checkCompatibility, containerInfo, supports } from '@aibox/applet-sdk'

const info = containerInfo()
const compatibility = checkCompatibility({
  minSDKVersion: '1.1.0',
  bridgeProtocol: '2.0',
  runtimeModules: ['aibox/ui'],
  capabilities: [
    { namespace: 'storage', method: 'get' },
    { namespace: 'haptics', method: 'impact', optional: true },
  ],
})

if (compatibility.errors.length) renderUnsupportedState(compatibility.errors)
if (!supports('capability:haptics.impact')) hideHapticPreference()
console.log(info.delivery) // host-shared / legacy-bundled / web-preview
```

硬依赖放进 `errors` 并阻止相关流程；可选能力只产生 `warnings`，应用应隐藏入口或提供 Web 降级。
不要以容器版本号猜能力，优先使用 `supports('capability:namespace.method')`。

## 4. 宿主共享模块

运行时裸模块的唯一市场合同在 `scripts/lib/runtime-modules.mjs`：

- `react`、`react-dom`、`react-dom/client`、`react/jsx-runtime`
- `antd-mobile`、`chart.js`
- `aibox/sdk`、`aibox/sdk/react`
- `aibox/ui`

`react/jsx-dev-runtime`、`chart.js/auto`、`antd` 不可用。`audit-runtime-contracts.mjs` 会把该合同与
构建器、宿主 Swift import map 逐条比对；宿主源码不在场时使用签入的合同快照。

`aibox/ui` 提供宿主共享 Web 原语，例如 `VirtualList`、原生行手势接线、页栈镜像、键盘/chrome
内缩、图片/SF Symbol/二维码 URL。类型声明和运行时导出也由同一审计守住，不能手工加一边漏一边。

## 5. 构建产物

```bash
npm run typecheck --prefix apps/<appId>
npm run build --prefix apps/<appId>
npm run check:build --prefix apps/<appId>
```

构建器先在内存中完成 TS emit 和产物验证，再写 `dist`。它会阻止：

- 缺 `.js` 或仍指向 `.tsx/.jsx` 的相对 import；
- 宿主 import map 不认识的裸说明符；
- 残留开发期 SDK 说明符；
- 源码与签入 `dist` 漂移。

产物不压缩、不带 sourcemap，以保留真机错误堆栈。包体与文件数由 `audit-budgets.mjs` 同时执行绝对上限
和应用基线棘轮；新增常驻 timer、rAF 或无限动画也必须显式审阅预算变化。

## 6. 统一验证与发布

```bash
npm run format
npm run verify
node scripts/release.mjs com.aibox.weather 1.0.0 --notes "首个版本"
```

`npm run verify` 是本地与 CI 的同一入口，分区输出格式/lint、合同、类型、构建漂移、包校验、审计与发布
冒烟。不要用单独跑 `validate` 代替：`validate` 只证明当前包结构可读，不证明 TS、dist 同步、合同或预算。

格式化与显式类型逃生口由 Biome 统一检查；应用业务 TS 的正确性由 tsc，平台特有规则由 audits 管理。
