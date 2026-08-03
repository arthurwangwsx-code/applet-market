# 写一个新的小应用

给「在这个仓库里开发下一个应用」的人（或 AI）看的。读完就能动手。

---

## 0. 先选一条路

| | **TypeScript + Vite（推荐）** | 纯 JSX（快速原型） |
|---|---|---|
| 适合 | 要发布、要维护、有业务逻辑的应用 | 试想法、一次性小工具、AI 在设备上直接写 |
| 类型 | 全量 `aibox.*` 类型 + manifest action 编译期校验 | 无 |
| 上传的是 | 构建产物，**设备上零转译** | 源码，每次加载浏览器内 Sucrase 转译 |
| 改一行 | 要重新 `vite build` | 存盘即生效 |
| manifest 与代码对齐 | tsc 保证 | 全靠自觉 |
| 文档 | **[typescript-workflow.md](typescript-workflow.md)** | 本文 |

**新应用默认走 TS 工程**：`cp -r apps/com.aibox.timer apps/com.aibox.<你的>`，
timer 就是为 fork 准备的范例。完整流程见 [typescript-workflow.md](typescript-workflow.md)。

纯 JSX 没有废弃，也不会废弃——它是 AI 在设备上直接改代码那条链路的形态，
「零构建、存盘即生效」在那个场景里不可替代。本文其余部分讲的是这条路径，
其中 §1 的运行时约束、§2 的平台能力、§3 的 manifest 两条路径**完全通用**。

---

## 0.1 三分钟起步（纯 JSX）

```bash
node scripts/new-app.mjs com.aibox.weather --name "天气" --name-en "Weather" \
  --icon cloud.sun.fill --tint 4A90D9 --category tools --summary "本地天气与预报"

# 改 apps/com.aibox.weather/src/app.jsx
node scripts/validate.mjs com.aibox.weather
node scripts/release.mjs com.aibox.weather 1.0.0 --notes "首个版本"
git add -A && git commit -m "release(weather): 1.0.0" && git push
```

推上去之后，在 iOS 端「小应用 → 市场」下拉刷新就能看到。

---

## 1. 运行时：能用什么，不能用什么

小应用跑在一个独立的 WKWebView 里，`applet://localhost` 虚拟文件系统伺服源码，浏览器内
Sucrase 即时转译 JSX——**没有构建步骤**，你写的 `.jsx` 原样落盘、原样进 Git。

### 能用

| | 说明 |
|---|---|
| **React 18** | `import React from 'react'`；`react-dom/client`、`react/jsx-runtime` 都在 |
| **antd-mobile v5** | `import { Button, List } from 'antd-mobile'`——手机尺寸的正确变体 |
| **chart.js** | 画图 |
| **Tailwind** | 页面内 JIT，直接写 class |
| 浏览器标准 API | `DOMParser`、`fetch`(仅经桥)、`localStorage`、`IntersectionObserver`… |

### 不能用（这是最容易踩的坑）

- **任何其它 npm 包**。裸 import 非白名单模块**转译期不报错、运行时炸掉整个模块 → 白屏**。
  没有 date-fns、没有 lodash、没有 axios。需要什么自己手写。
  （`validate.mjs` 会在提交前拦下来，别绕过它。）
- **antd-mobile 子路径**：只能 `from 'antd-mobile'`，`from 'antd-mobile/es/components/button'` 会 404。
- **`chart.js/auto` 与 `react/jsx-dev-runtime`**：都**不在** import map 里（2026-08-03 前市场白名单
  误列了这两条，会放过一个装上就白屏的包，已修）。图表用
  `import { Chart, registerables } from 'chart.js'` + `Chart.register(...registerables)`。
- **`index.html`**：源码型应用**不要自己写**。挂载、import map、CSP 全由宿主外壳负责，
  你只写 `app.jsx`（`export default function App`）以及它 import 的文件。
  历史上 AI 反复「去修 index.html」把离线 import map 换成 CDN URL，然后整个应用白屏。

  > ⚠️ **但市场包必须自带 `index.html`。** 补默认外壳的逻辑只在 `.aiboxapplet` 导入路径
  > （`AppletVerifySideload.commit`）里；**市场安装器 `AppletMarketInstaller.install` 是把包内
  > 文件原样落盘、不做任何补齐**。所以 `manifest.entry` 指向的文件必须真的在包里，否则装上去
  > 打开就是 404 空白页。`validate.mjs` 现在会检查这一条（构建型工程是硬错误；
  > 源码型是提醒，因为存量包就是这个状态）。
- **`Toast.show` 渲染为空**（antd-mobile 在这个宿主下的已知 quirk）。要弹提示用
  `Dialog.alert` / `Dialog.confirm`。
- **页面直连网络**：CSP + ContentRuleList 双闸锁死。联网只能走 `aibox.net.fetch`。

### 写法约定

- 相对 import 带扩展名（`./components/Row.jsx`），无扩展名虽然会被自动补 `.js`，但显式更稳。
- 布局用 `100dvh` 和 `env(safe-area-inset-bottom)`，**不要写死高度**——同一个应用会跑在
  全屏页 / 半屏 sheet / 聊天内嵌卡片里，高度完全不同。
- 深浅色都要能看。宿主会把有效颜色方案传下来，别只测一种。
- 单文件别超过 ~500 行，拆 `components/` + `lib/`。

---

## 2. 平台能力（`aibox.*`）

完整类型定义在**应用内**的虚拟文件 `.aibox/aibox.d.ts`（宿主按当前实际安装的能力生成，是真值）。
下面只列最常用的；逐个命名空间的完整 API 参考（参数表、副作用档位、兼容性与降级行为）见 [`docs/api/`](api/README.md)。

### 一定要知道的

```javascript
// 存储：per-applet 隔离的 KV，卸载重装会保留（更新时不会被清）
await aibox.storage.set('settings', { theme: 'dark' })
const s = await aibox.storage.get('settings')

// 联网：唯一出口。需要 manifest 声明 network + networkAllowed 精确域名
const res = await aibox.net.fetch('https://example.com/feed.xml')

// 结构化数据：数据量大时用它，别把几千条塞进一个 storage key
await aibox.db.insert({ collection: 'articles', document: {...} })

// 打开链接：页面里的 <a href> 是不通的，必须走桥
await aibox.browser.open({ url, mode: 'inApp' })
```

### 应用级外壳（让小应用长得像一个 App）

底部 Tab 与顶部导航栏**在 `manifest.json` 里静态声明**，宿主用原生控件渲染，页面只负责响应：

```jsonc
// src/manifest.json
{
  "scene": {
    "tabBar": {
      "items": [
        { "id": "home",  "title": "首页", "icon": "house",     "selectedIcon": "house.fill" },
        { "id": "me",    "title": "我的", "icon": "person",    "selectedIcon": "person.fill" }
      ]
    },
    "toolbar": {
      "trailing": [{ "id": "add", "icon": "plus" }],
      "search": { "enabled": true, "placeholder": "搜索" }
    }
  }
}
```

```javascript
aibox.tabs.on('changed', ({ selected }) => setTab(selected))
aibox.toolbar.on('invoke', ({ id }) => { if (id === 'add') openComposer() })
aibox.toolbar.on('searchChanged', ({ query }) => setQuery(query))
```

**为什么是声明式而不是让你自己画**：这样底栏/顶栏用的是原生控件，跟系统的滚动收起、
安全区、深浅色、动态字号天然一致；而且宿主能保证「返回出口永远在」——页面没法把用户困住。

运行时只能改**显示状态**（标题/图标/角标/禁用/隐藏），不能增删 Tab、不能改 id。

完整合同见宿主文档 `docs/capabilities/applet/app-shell-and-market.md` §1–§3。

有两条细节写错了不会报错、只会在真机上显形：

- **`role: "hostMenu"`**：宿主的 ⋯ 菜单是**保留出口**，声不声明都在。想让自己的 ⋯ 就是它，
  必须在 `toolbar.trailing` 里放一个 `{ "id": "more", "icon": "ellipsis", "role": "hostMenu" }`
  ——这是个**位置标记**，不渲染成按钮、也永不发 `toolbar.invoke`。漏了 `role`，宿主会把它
  当成一个普通按钮画在前面、再画自己的 ⋯，于是**右上角出现两个 ⋯**。
  菜单内容写进 `scene.menu`（支持两级子菜单，每项 `actionID` 指向 `manifest.actions`）。
- **`tabs.changed` 要读 `rendered`，不只是 `selected`**：宿主会在**挂载之后**翻转 `rendered`
  （形态切换、控制器重建都会重发 `changed`）。只在启动那一刻判断一次，自绘降级底栏就会
  永远缺席或永远多一条。

### 子页导航：用系统的页栈，不要自己画

有「列表 → 详情」结构就必须接这条，否则**在详情页左滑会直接退出整个小应用**——宿主看到的
`webDepth` 恒为 0，于是认为你在根路由，把最左缘让给了外层的退出手势。这不是「返回没有动画」，
是「返回手势是错的」。

接上之后，返回走的是 iOS 自己的 interactive pop：拖动中实时透出上一页、拖到一半可以放弃。

三步：

```jsonc
// ① manifest 打开开关（这是 opt-in；card / sheet / drawer 形态不装页栈）
{ "presentation": { "default": "page", "subpages": true } }
```

```javascript
// ② 进子页：先让宿主冻结当前页像素，**等屏障回来**再渲染新路由
await aibox.navigation.push({ route: '#/article/42', title: '文章详情' })
await aibox.navigation.getState()          // ← 顺序屏障，不能省
setStack((rows) => [...rows, route])

// ③ 返回一律经 popstate 回来，并且**对齐到深度**（popToRoot 会一次退多层）
addEventListener('popstate', () => {
  const depth = (history.state && history.state.__aiboxDepth) || 0
  setStack((rows) => rows.slice(0, depth))
})
```

- 屏障为什么不能省：`push()` 是纯 JS、返回的是**已解决的** Promise，`await` 它只让出一个
  微任务。紧接着的 `getState()` 才真正等到宿主处理完（两条消息同一个 reply handler、FIFO）。
  省掉它是**观感退化而非功能损坏**：冻结的会是新页面的像素。
- 自己的返回键**不要乐观 setState**：调 `aibox.navigation.back()`，让 popstate 把栈弹回去。
  抢先改 state 会让宿主的转场演给一个空页面看。
- 切 Tab 用 `aibox.navigation.popToRoot()` + 本地清空，两边幂等对账。
- **宿主画了顶栏就别再自绘**：`webDepth > 0` 时宿主自己就有返回键，两条一起画 = 两层导航栏。
  只在 `toolbar.getState().rendered === false`（fullscreen 形态 / 无宿主）时补自绘顶栏。

本仓 `apps/com.aibox.news/src/lib/subpages.js` 是可直接抄走的实现（`useSubpageStack`），
news / ledger / finance / music 四个应用用的都是它。完整机制见宿主文档
`docs/capabilities/applet/native-navigation.md`。

### 可选能力（用前先探测）

```javascript
const a = await aibox.browser.availability()
if (!a.modes.includes('inApp')) hideReaderEntry()

const ai = await aibox.ai.availability()
if (!ai.available) useOfflineUI()
```

**没有的能力就不要渲染入口**——留一个点了没反应的按钮比没有这个按钮糟糕得多。
宿主变体（Full / Lean）和用户授权都会让能力时有时无。

---

## 3. manifest.json

只列常改的；完整字段以宿主 `AppletManifest` 为准。

```jsonc
{
  "name": "天气",
  "localizedNames": { "en": "Weather" },
  "icon": "cloud.sun.fill",          // SF Symbol
  "iconTintHex": "4A90D9",           // RRGGBB，不带 #
  "summary": "本地天气与预报",
  "template": "react",
  "entry": "index.html",             // 固定，宿主托管
  "securityMode": "secure",          // 市场包必须是 secure
  "permissions": {
    "network": true,
    "networkAllowed": ["api.weather.com"],   // 精确域名，不能用 "*"
    "storage": true,
    "ai": false,
    "capabilities": ["browser", "location"]  // 扩展能力，声明≠授权
  },
  "presentation": { "default": "page", "surfaces": ["page", "fullscreen"] },
  "scene": { /* tabBar / toolbar / menu / 外观 / 方向 */ }
}
```

几条纪律：

- **`id` 不要写**。市场包里的 id 无意义——宿主安装时会分配本机 UUID。发布脚本会自动剥掉。
- **`networkAllowed` 不能用 `"*"`**，`validate.mjs` 会拒。把实际要访问的域名一个个列出来。
- **`capabilities` 是声明，不是授权**。用户在运行时仍会逐项被问。声明得越窄，用户越可能同意。
- 字段**只增不改**：宿主对未知字段是 tolerant 解码，但改语义会让老版本行为漂移。

---

## 4. 发布与版本

```bash
node scripts/release.mjs <appId> <version> --notes "…" [--notes-en "…"] [--min-host x.y.z]
```

- 版本号是 **semver**，且必须**高于**当前最新版本。
- **已发布的 `releases/<version>/` 是不可变的**。改代码要发新版本，不要改旧目录——
  用户装的是哪一版，sha256 说了算。
- `--min-host` 声明这一版依赖的宿主能力底线。用了新平台能力（比如 `aibox.tabs`）就要写，
  否则老宿主装上去会拿到一个半残的应用。
- 每个文件都带 sha256，宿主安装时逐个校验；对不上就整包失败，不会装进半个应用。

发布产物（`releases/`、`releases.json`、`registry.json`）**要一起 commit**——
CI 会检查索引与磁盘真值是否一致，漏提交会红。

---

## 5. 调试

在 iOS 端「小应用 → 开发中」打开应用，⋯ 菜单里有：

- **控制台**：console 输出 + 模块加载失败（白屏的最常见原因会出现在这里）
- **存储**：看 `aibox.storage` 的 KV 和 WebView 的 localStorage
- **查看代码 / 叫 AI 修改**

白屏时的排查顺序：① 控制台有没有 import 解析失败 → ② `app.jsx` 是不是漏了
`export default` → ③ 有没有 import 了白名单外的包。

---

## 6. 检查清单

发布前对着过一遍：

- [ ] `node scripts/validate.mjs <appId>` 全绿
- [ ] 深色模式下能看
- [ ] 没有网络 / 接口失败时有可用的错误 UI，不是白屏也不是空列表
- [ ] 声明的每个 capability 都真的用到了（多余声明会白白吓退用户）
- [ ] 可选能力（AI / TTS / 浏览器）先探测再渲染入口
- [ ] 底部内容不被 Tab 栏遮住（用 `env(safe-area-inset-bottom)`）
- [ ] 中英双语都填了（如果面向双语用户）

---

## 7. 从纯 JSX 迁移到 TS 工程

已发布的应用可以迁，**已发布版本不受影响**（发新版本即可，`data/` 用户数据在更新时保留）。

```bash
node scripts/migrate-to-ts.mjs <appId> --dry-run                       # 只出报告
node scripts/migrate-to-ts.mjs <appId> --out .migrate-preview/<appId>  # 迁到副本 + 跑 tsc
node scripts/migrate-to-ts.mjs <appId> --in-place --force              # 就地迁（会删旧 .jsx/.js）
```

### 工具做什么

1. `.jsx → .tsx`、`.js → .ts`，相对 import 的扩展名同步去掉
2. 入口 `app.jsx → src/App.tsx`，新建 `src/main.tsx`（自挂载 + default 导出，两种外壳都能跑）
3. 生成 `package.json` / `tsconfig.json` / `vite.config.ts` / `index.html`
4. **把手写的 `src/lib/host.js` 封装指向 SDK** —— 这是迁移的主要收益
5. manifest 补 `"runtimeKind": "bundle"`
6. 跑 `tsc --noEmit`，把类型错误如实列出来

### 迁移的真正工作量在哪

现有四个应用各自写了一份 `src/lib/host.js`，导出面惊人地一致：
`hasNamespace` / `capabilities` / `storage` / `onEvent` / `aiAvailability` / `aiGenerate` /
`registerAction` / `shareFile`……**四份独立实现的同一个东西**，正是 SDK 要取代的那一层。

所以迁移不是逐个改写调用点（调用点全都 import 自这个封装），而是
**删掉封装、把消费者指向 SDK**，只把应用自有的业务胶水（`openArticle`、`classifyMusicError`
这类）留下。

### 类型错误是预期的

以 `com.aibox.news`（38 个文件）实测：

| 档位 | 错误数 |
|---|---|
| 默认严格档 | 1025 |
| 关掉 `noImplicitAny` + `strictNullChecks` | 478 |

差额（~547 条）全是 `TS7006`/`TS7031`「参数隐式 any」——**加类型注解**就没了，是机械工作。
剩下 478 条里 278 条是 `TS2339`「属性不存在」，那是 TS 在真的发现问题：
未类型化的对象字面量在各处形状不一致。**这些正是迁移的价值所在，不是失败。**

推荐节奏：
1. 先用工具生成的 `tsconfig.json`（已关掉 `noUnusedLocals`/`noUnusedParameters`）让工程编起来
2. 临时加 `"noImplicitAny": false`，先把 478 条真问题清掉
3. 逐目录打开严格档（`lib/` → `components/` → 入口），每次一个目录
4. 全绿后删掉 tsconfig 里的迁移期放宽段

### 一个已发布应用换运行时形态，安全吗

安全，三条依据：

1. **发新版本即可**（如 `com.aibox.news` 1.0.0 → 1.1.0）。appId 不变，宿主按
   `marketSourceID + marketAppID` 认「同一个应用」，走更新路径。
2. **用户数据保留**：`AppletMarketInstaller.install` 在写完包内容后会把本机 `data/`
   （`aibox.storage` 的 kv + db）复制回 staging，**用户数据永远赢**。源码文件全量换掉不影响它。
3. **老宿主装到 `runtimeKind: "bundle"` 的包不会坏**：
   - `AppletManifest` 用合成 Codable，不认识的键**静默忽略** → 老宿主把它当普通 manifest
   - 转译决定权在**包自带的 `index.html`** 里，不在宿主：我们的外壳用原生 module 脚本，
     根本不加载 es-module-shims，Sucrase 无从介入
   - 即便退一万步走了转译钩子：钩子的判据是 `/\.(jsx|tsx|ts)(\?|$)/`，产物叫 `app.js`，**不匹配**

   所以**不需要 `minHostVersion` 卡版本**。（实测补充：如果真把产物喂给 Sucrase，
   它不是逐字节放行——会把 `?.` / `??` 降级成 helper 函数，产物 +9%，但语法仍合法、
   import 保持不变。也就是说最坏情况是白付一次转译开销，不是坏掉。）
