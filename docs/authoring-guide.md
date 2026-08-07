# 写一个新的 AiBox 小应用

这份指南面向下一位开发者或 AI。目标不是“先跑起来再说”，而是让第 12 个、第 30 个应用从第一行代码
就进入同一套类型、桥接、性能、测试和发布体系。

## 1. 从脚手架开始

```bash
npm run new -- com.aibox.weather --name "天气" --name-en "Weather" \
  --icon cloud.sun.fill --category tools --summary "本地天气与预报"
npm install
```

新应用只能使用 TypeScript。不要复制旧应用目录，不要添加 `--source`，也不要新建 `host.js`、
`vite.config.ts`、`src/main.tsx` 或手写 `index.html`。

脚手架已经包含：

- 严格 TS 配置与 `aibox-tsbuild`；
- 宿主共享 SDK 的开发期依赖；
- 能力探测、兼容模式和存储降级范例；
- `aibox/ui` chrome 内缩范例；
- 一份可由 `applet-verify` 重放的 `.tests.json`。

## 2. 先写 manifest，再写入口

`src/manifest.json` 是权限和外壳合同。声明越窄越好：

```json
{
  "name": "天气",
  "icon": "cloud.sun.fill",
  "template": "react",
  "entry": "index.html",
  "runtimeKind": "bundle",
  "securityMode": "secure",
  "permissions": {
    "network": true,
    "networkAllowed": ["api.weather.example"],
    "storage": true,
    "ai": false,
    "capabilities": ["location"]
  },
  "presentation": {
    "default": "page",
    "surfaces": ["page", "fullscreen"]
  }
}
```

注意：

- `networkAllowed` 只能列精确域名，不能使用 `*`；
- capability 声明不等于授权，调用前仍要探测；
- 原生 Tab、Toolbar、菜单和子页栈应通过 manifest + SDK 接入，不要在 Web 中再画一份；
- 市场安装不会修补缺失入口；标准入口由构建器生成。

## 3. 用 SDK，不直接复制桥胶水

```ts
import { checkCompatibility, fetchJSON, storage, supports } from '@aibox/applet-sdk'

const compatibility = checkCompatibility({
  capabilities: [
    { namespace: 'storage', method: 'get' },
    { namespace: 'location', method: 'current', optional: true },
  ],
})

if (supports('capability:location.current')) {
  // 渲染定位入口
} else {
  // 使用手选城市降级
}

const settings = storage.defineKey('settings', { city: 'Kuala Lumpur' })
const data = await fetchJSON('https://api.weather.example/current')
```

SDK 的实现由宿主以 `aibox-sdk.mjs` 单实例提供。应用里的 `@aibox/applet-sdk` import 是稳定开发接口，
构建后会改写成宿主模块，不增加每个小应用的包体积。

SDK 负责桥协议知识：能力探测、错误归一、超时/降级、存储和网络语义。业务领域模型、展示规则和数据迁移
留在应用。若某段代码换一个业务仍然需要，而且正确实现依赖宿主行为，应先补 SDK，不要复制到第二个应用。

## 4. UI 和性能

```ts
import { VirtualList, imageURL, useAppletInsets, useListGestures } from 'aibox/ui'
```

`aibox/ui` 是共享 Web 能力，不是原生渲染。它的价值是让虚拟列表、滚动恢复、行手势接线、图片缓存 URL、
键盘与 chrome 内缩只有一份正确实现。

开发约束：

- 长列表优先 `VirtualList`，稳定 `keyExtractor`，合理 `estimatedRowHeight`；
- 远程图片经 `imageURL`，页面不能直接绕过 secure CSP；
- 页内布局使用 `--aibox-inset-*` 或 `useAppletInsets`，不要把 safe area 写死；
- `setInterval`、持续 rAF、无限动画和动态 Tailwind class 都会进入性能预算审阅；
- 源码只允许 TS/TSX；禁止显式 `any`、`@ts-ignore`、`@ts-nocheck` 或关闭 `strict`；
- 新文件不超过 800 行；存量大文件只能缩小；
- 无网络、拒绝授权、旧容器和可选模块缺席都必须有明确 UI。

## 5. 类型、格式与测试

源码 import 最容易写错的一点：目标是 `.ts/.tsx`，说明符仍写 `.js`。

```ts
import { WeatherRow } from './components/WeatherRow.js'
```

日常循环：

```bash
npm run typecheck --prefix apps/com.aibox.weather
npm run build --prefix apps/com.aibox.weather
npm run check:build --prefix apps/com.aibox.weather
npm run format
npm run verify
```

`.tests.json` 至少覆盖：首屏关键内容、核心写路径、错误/空态和 `noHorizontalOverflow`。静态全绿不等于真机成功；
依赖授权、媒体、原生手势、后台或弱网的应用仍需在发布候选上走模拟器/真机验证。

## 6. 预算和发布

新应用首次构建后登记预算：

```bash
npm run budgets:update
git diff -- config/applet-budgets.json
```

必须人工审阅新增体积和常驻任务，不能用更新基线掩盖意外膨胀。发布前：

```bash
npm run verify
node scripts/release.mjs com.aibox.weather 1.0.0 --notes "首个版本"
```

发布版本不可变。坏版本用 `release.mjs yank` 撤回，不能删除历史目录。`registry.json`、`releases.json`、
`release.json` 和 `bundle.json` 必须随发布一起提交。

## 7. 存量 JS 迁移

```bash
node scripts/migrate-to-ts.mjs com.aibox.legacy --dry-run
node scripts/migrate-to-ts.mjs com.aibox.legacy --out .migrate-preview/com.aibox.legacy
```

迁移工具会生成当前的 aibox-tsbuild 工程，不再生成 Vite 文件。自动迁移不等于完成：报告中的严格 TS 错误、
`TODO(migrate)`、领域级 host 封装和真机行为都需要人工收口。完整解释见
[typescript-workflow.md](typescript-workflow.md)。
