# TypeScript + Vite 工程

小应用的**推荐**开发方式：标准 TS React 工程，本地构建，上传产物，设备上零转译。

纯 JSX（源码型）路径没有废弃，见 [authoring-guide.md](authoring-guide.md) §0 的取舍。

---

## 0. 三分钟起步

```bash
# 从范例复制（timer 就是为 fork 准备的）
cp -r apps/com.aibox.timer apps/com.aibox.weather
cd apps/com.aibox.weather && rm -rf dist node_modules

# 改 app.json / src/manifest.json 的身份字段，然后：
cd ../.. && npm install
npm run build --prefix apps/com.aibox.weather
node scripts/validate.mjs com.aibox.weather
node scripts/release.mjs com.aibox.weather 1.0.0 --notes "首个版本"
```

---

## 1. 两种运行时，一套外壳

宿主 `AppletManifest.runtimeKind` 声明这份代码是哪一种：

| | `source`（默认，老行为） | `bundle`（本文档） |
|---|---|---|
| 进包的是 | `src/**` 原样 | `dist/**` + `src/manifest.json` |
| 谁转译 | 浏览器内 Sucrase，**每次加载都跑一遍** | 没有转译，构建时已经做完 |
| 模块加载器 | `es-module-shims`（shimMode） | 浏览器原生 `<script type="module">` |
| import map | shim 的 `importmap-shim` | 原生 `importmap` |
| 改一行要多久 | 存盘即生效 | 要重新 `vite build` |
| 谁写 | AI 在设备上直接写 | 人 / AI 在仓库里写 |

**关键：两种形态共用同一批运行时资产和同一份 import map。**
`react` / `react-dom` / `react-dom/client` / `react/jsx-runtime` / `antd-mobile` / `chart.js` /
`aibox/ui` 在两种形态下都是 **external 裸 import**，都由宿主的
`applet://localhost/runtime/*.mjs` 提供。差别只有一条：**要不要过转译钩子**。

所以「支持两种运行时」不是两套架构，而是同一套架构的一个开关。

---

## 2. 为什么那几个库必须 external

这是本方案里**唯一一条不能妥协**的规则。

### 2.1 打进产物会得到两份 React

`antd-mobile` 是宿主提供的（`applet://localhost/runtime/antd-mobile.mjs`），它 import 的是
宿主那份 `react.mjs`。如果你的产物里也打了一份 React，页面上就有两个 React 实例：
`<Button>` 的 hooks 挂在宿主实例上，你的组件 hooks 挂在你那份上。表现是
`Invalid hook call` 或者 state 静默地不更新——**两种都极难归因**。

### 2.2 体积

`react.mjs` 143 KB、`antd-mobile.mjs` 622 KB、`chart.mjs` 205 KB。单版本上限 8 MB，
把它们打进去每个应用都要付一次，而它们在设备上本来就已经存在。

### 2.3 它们不是 npm 原版

宿主那几个 `.mjs` 是 esbuild 自建的 bundle，interop 垫片与 npm 原版不同。
即使你打一份进去，行为也未必一致。

**结论：`@aibox/applet-vite` 把这 7 个说明符写死在 external 名单里，并在构建结束时
扫一遍产物做正向断言。** 想加别的 external 要有非常明确的理由。

---

## 3. 工程结构

```
apps/<appId>/
  app.json                  市场元数据（分类 / 作者 / 标签）
  package.json              依赖与 scripts
  tsconfig.json             继承 @aibox/applet-vite/tsconfig.base.json
  vite.config.ts            一行：export default defineAppletConfig()
  index.html                外壳：import map + 挂载点 + 错误浮层
  src/
    manifest.json           小应用声明（**不是代码**，发布时从这里原样取）
    aibox-actions.d.ts      从 manifest 生成，签入仓库
    main.tsx                入口：自挂载 + default 导出
    App.tsx                 根组件
    components/*.tsx
    lib/*.ts
  dist/                     构建产物，**签入仓库**（发布包的真值）
```

### 为什么 `dist/` 要签入

发布包必须是可复现、可审阅的。`dist/` 在仓库里意味着：
- code review 能看到真正发出去的字节
- CI 能断言「重新构建后无 diff」（源码与产物不同步会当场红）
- 没有 node 环境的人也能看清楚包里到底是什么

固定文件名（`app.js`，不带 hash）就是为这条服务的——带 hash 每次构建都是新文件，diff 无意义。

### 为什么 `manifest.json` 留在 `src/`

它是**声明**不是代码：宿主用它决定这个应用有什么能力、以什么形态呈现、暴露哪些 action。
它不该被打包器碰，也不该出现在 `dist/`。`release.mjs` 单独从 `src/manifest.json` 取。

---

## 4. `@aibox/applet-sdk`

```ts
import { isAvailable, fetchText, storage, registerActions, AiboxError } from '@aibox/applet-sdk';
import { useTabs, useToolbarSearch, useKeyboardInset, useLocale } from '@aibox/applet-sdk/react';
```

### 4.1 类型是**派生的**，不是手抄的

`aibox.*` 全部 39 个命名空间的类型由 `scripts/gen-sdk-types.mjs` 从三份宿主真值生成：

| 来源 | 内容 |
|---|---|
| `AppletDeveloperSDK+TypeScript.swift` 的 `platformTypeScript` | 手写 ergonomic 签名（storage / net / tabs / toolbar …） |
| `AppletDeveloperSDK.swift` 的 `aiTypeScript` | `namespace ai` |
| `docs/api/capabilities.snapshot.json` | descriptor 快照（**复用 api-docs 的提取器，不造第二套**） |

```bash
npm run sdk:types          # 重新生成
npm run sdk:types:check    # 漂移检查（宿主源码不在场时自动降级）
```

手抄一份进 SDK 必然漂移，而**漂移的类型比没有类型更糟**：它让 tsc 给出「编译通过」的假绿。

### 4.2 能力探测：把纪律变成 API

宿主纪律是「能力缺席时整条命名空间不注册，所以先探测再渲染入口」。裸桥上这是口头约定：

```ts
// 之前：每个应用自己写一遍，写不写全靠自觉
if (window.aibox && window.aibox.music && typeof window.aibox.music.play === 'function') { … }

// 现在：
if (!isAvailable('music', 'play')) return null;   // 同步、零成本，可以直接写在 render 里
```

要知道**为什么**调不动（授权还是没装）用 `probe()`，它会走 `aibox.access.explain`
返回是哪一道门拦的 + 宿主给的补救建议。

### 4.3 错误码是判别式联合

桥拒绝时抛的 `Error` 挂了 `.code`，但类型是 `any`：

```ts
try { await aibox.health.read(...) } catch (e) { if (e.code === 'aibox/not-grante') … }  // 拼错没人管
```

SDK 把它规范化成 `AiboxError`，`code` 是字面量联合：

```ts
catch (error) {
  const e = normalizeError(error);
  switch (e.code) {
    case 'aibox/not-granted': return showPermissionHint(e);
    case 'aibox/busy': return retryLater();
    // 拼错的 case 编译不过；漏掉的分支 switch 能穷尽提醒
  }
}
```
另有 `isPermissionDenied()` / `isTransient()` 两个分组判据。

### 4.4 `net` 的三条样板

```ts
// 之前每个应用都要手写：base64 → TextDecoder、判 truncated、判状态码
const res = await aibox.net.fetch(url, { responseType: 'base64' });
const bytes = Uint8Array.from(atob(res.body), c => c.charCodeAt(0));
const text = new TextDecoder('gb18030').decode(bytes);
if (res.truncated) { /* 大多数应用漏了这一步 */ }

// 现在
const text = await fetchText(url, { encoding: 'gb18030' });
```
`fetchText` / `fetchJSON` / `fetchBytes` 默认**截断即抛**、**非 2xx 即抛**。
两条都能显式关（`allowTruncated` / `allowErrorStatus`），但必须是显式的。

> 把截断的 XML 当完整数据解析会得到「解析成功但内容少一半」——比报错更难查，
> 所以默认必须是抛。

### 4.5 类型化 action：这就是「可校验」

`src/manifest.json` 里的 action 声明会被翻译成 `src/aibox-actions.d.ts`：

```jsonc
// manifest.json
{ "name": "start", "inputSchemaJSON": "{\"type\":\"object\",\"properties\":{\"label\":{\"type\":\"string\"}}}" }
```
```ts
// 生成的 aibox-actions.d.ts（模块增补）
declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    "start": { input: { label?: string }; output: { ok: boolean; remainingSeconds: number } };
  }
}
```

于是三类错误全部在编译期暴露：

```
① 名字拼错
   Argument of type '"serach"' is not assignable to parameter of type '"start" | "status" | "stop"'

② 参数类型不符（把 label 写成 number）
   Types of property 'label' are incompatible.
     Type 'string | undefined' is not assignable to type 'number | undefined'.

③ 漏注册 manifest 声明的 action
   Property '"stop"' is missing in type '{ start: …; status: … }'
     but required in type '{ start: …; status: …; stop: ActionHandler<"stop"> }'
```

第三条只有用整表注册（`registerActions({...})`）才能拿到，所以**推荐整表注册**。

### 4.6 React hooks

| hook | 解决什么 |
|---|---|
| `useTabs()` | 原生 TabBar 状态 + `rendered`。**`rendered === false` 时必须自己画页内切换器**——card/sheet/drawer 上没有原生 TabBar |
| `useToolbarSearch()` | 导航栏搜索。同样有 `rendered`（fullscreen 面没有导航栏） |
| `useKeyboardInset()` | 键盘遮挡高度。宿主事件优先，退回 `visualViewport` |
| `useLocale()` | 生效语言。**首帧就有值**，不会先渲染成英文再闪 |
| `useScene()` | 呈现面 / 安全区 / 明暗 |
| `useCapability(ns, method)` | 同步能力判据，可以直接写在 render 里 |

全部在 unmount 时自动退订。

---

## 5. 构建

### 5.1 为什么是 Vite

用户点名。除此之外它确实合适：HTML 入口（我们要保留自己手写的 `index.html`
连同 import map 与错误浮层）、`rollupOptions.external` 是一等能力、
`@vitejs/plugin-react` 的 automatic runtime 与宿主 import map 里的 `react/jsx-runtime` 正好对上。

**`vite dev` 不适用**：开发服务器跑在 `http://localhost`，而运行环境是 `applet://localhost`
且 external 模块只存在于宿主。开发循环是 `vite build --watch` + 装到设备上看。

### 5.2 预设做了什么

`defineAppletConfig()` 固定了四条会白屏的配置：

| 配置 | 值 | 配错的后果 |
|---|---|---|
| `base` | `'./'` | 绝对路径 `/app.js` 会解析成 `applet://localhost/app.js`（跨出应用目录）→ 404 |
| `build.target` | `'safari17'` | 部署目标是 iOS 17；更高 target emit 的语法 WKWebView 不认 → 白屏 |
| `rollupOptions.external` | 那 7 个 | 见 §2 |
| `output.entryFileNames` | `'app.js'` | 固定名，见 §3 |

外加三个插件：
- `aibox:manifest` — 校验 manifest + 生成 action 类型
- `aibox:html-shell` — 去掉 Vite 注入的 `crossorigin`（同源，没有收益，只多一条 CORS 判定路径）
- `aibox:verify-output` — 产物自检（external 是否生效、有没有绝对路径、有没有把 React 打进来）

### 5.3 不压缩、不出 sourcemap

**`minify: false`**：真机上唯一的调试面是 console 与错误浮层里的堆栈。压缩后函数名全没了，
而小应用体积（timer 20 KB）远在 8 MB 预算之下——可读性比那几 KB 值钱。
大应用可以 `defineAppletConfig({ minify: true })`。

**`sourcemap: false`**：sourcemap 会进包占预算，并把**完整源码分发给每个装了这个应用的用户**。
它换来的调试能力，在「不压缩 + `keepNames`」之下已经基本拿到了。
本地要调试就临时 `defineAppletConfig({ sourcemap: true })` 构建一次，**别提交**。

---

## 6. 发布

```bash
node scripts/release.mjs <appId> <version> --notes "…"
```

对构建型工程它会：

1. `npm run typecheck`（若声明）→ **类型不过就不发**
2. `npm run build`
3. `node scripts/validate.mjs <appId>`
4. 打包 `dist/**`（平铺到包根）+ `src/manifest.json`
5. 写 `releases/<version>/{release,bundle}.json`，刷新索引

**构建必须在 validate 之前**：validate 校验的是 `dist/`，先验后构等于验的是上一次的产物。

### validate 对构建型工程额外查什么

| 检查 | 抓的是什么 |
|---|---|
| `dist/` 的裸 import **恰好**是 external 子集 | external 配置没生效 |
| `@aibox/applet-sdk` **不在** `dist/` 的裸 import 里 | SDK 被误当 external，没打进产物 → 运行时 404 |
| `manifest.entry` 必须在包里 | **市场安装器不会替你补 `index.html`**，entry 找不到就是打开白屏 |
| `runtimeKind` 必须是 `"bundle"` | 否则宿主按源码型处理，拿 Sucrase 去转译已经构建好的产物 |
| `template` 必须是 `"react"` | 宿主据此决定要不要准备 React 运行时资产；写 `vanilla` 会让 import map 指向的 URL 全部 404 |
| `dist/index.html` 必须有 import map | 预构建产物的裸 import 没人解析 |
| `src/` 比 `dist/` 新 | 忘了重新构建（warn） |
| manifest 键名必须是宿主认识的 | 宿主合成 Codable **静默忽略**不认识的键，声明从未生效 |

---

## 7. 调试

设备上没有控制台，所以：

1. **错误浮层**：`index.html` 里的 `#__err` 捕获 `error` / `unhandledrejection` 并直接印在页面底部。
   白屏时这是唯一的信息来源，**不要删**。
2. **`console.*`** 经 `AppletConsoleBridge` 进宿主诊断日志，`applet_run` 能读到。
3. **Safari Web Inspector** 可以连模拟器/真机的 WKWebView（Debug 构建）。
4. **能力不可用**是最常见的「功能没反应」：用 `probe()` 打一份诊断，它会告诉你是命名空间没注册
   还是授权没过、以及补救建议。

---

## 8. 已知坑

- **HTML 注释里不能出现字面的 `<script` 起始标签**。Vite 的 HTML 解析会把它当真标签，
  然后把 import map 挪到注释中间去（注释被劈开，页面照样跑但源码不可读）。实测踩过。
- **`Toast.show` 在这个宿主下渲染为空**（antd-mobile 的已知 quirk）。用 `Dialog.alert` / `Dialog.confirm`。
- **`antd-mobile` 子路径导入会 404**。只能 `from 'antd-mobile'`。
- **`chart.js/auto` 不在 import map 里**。用 `import { Chart, registerables } from 'chart.js'`
  + `Chart.register(...registerables)`。
- **布局不要写死高度**。同一个应用会跑在全屏页 / 半屏 sheet / 聊天内嵌卡片里。
  用 `100dvh` + `useScene().safeArea` + `useKeyboardInset()`。

---

## 9. 从 JSX 迁移

```bash
node scripts/migrate-to-ts.mjs <appId> --dry-run                    # 出报告
node scripts/migrate-to-ts.mjs <appId> --out .migrate-preview/<appId>  # 迁到副本
```

工具会：改扩展名、改入口、生成工程文件、**把手写的 `lib/host.js` 封装指向 SDK**、
补 `runtimeKind`，然后跑一次 `tsc --noEmit` 把类型错误如实列出来。

拿不准的一律进「TODO(migrate)」清单，**不静默跳过**。详见
[authoring-guide.md](authoring-guide.md) 的迁移一节。
