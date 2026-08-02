# 写一个新的小应用

给「在这个仓库里开发下一个应用」的人（或 AI）看的。读完就能动手。

---

## 0. 三分钟起步

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
- **`index.html`**：由系统托管、不落盘、**你写不了也不该写**。挂载、import map、CSP 全由宿主生成。
  你只写 `app.jsx`（`export default function App`）以及它 import 的文件。
  历史上 AI 反复「去修 index.html」把离线 import map 换成 CDN URL，然后整个应用白屏——所以这条被
  结构性锁死了。
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
下面只列最常用的。

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
