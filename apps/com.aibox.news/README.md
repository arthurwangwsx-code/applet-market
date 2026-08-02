# 资讯（com.aibox.news）—— 与原生版的差异说明

本应用是 AiBox 原生 `NewsPluginKit`（Swift / SwiftUI）的 **React 小应用复刻**。
目标是 1:1：页面结构、交互、视觉令牌、中英双语文案、边界行为逐条对齐；
文案直接取自 `NewsPluginKit/Resources/Localizable.xcstrings`（en + zh-Hans）。

复刻规格：`docs/capabilities/applet/app-shell-and-market.md` §5；
平台合同：同文档 §1（`aibox.tabs`）/ §2（`aibox.toolbar`）/ §3（`aibox.browser`）。

---

## 1. 目录

```
src/
  manifest.json            scene.tabBar / scene.toolbar / scene.menu / actions / 权限与域名白名单
  app.jsx                  根装配：外壳接线、路由、动作总表
  i18n/                    154 条中英文案 + locale 跟随
  lib/                     纯逻辑：文本/哈希、日期、格式化、FeedParser、Provider、
                           去重、聚类、投影、正文抽取、持久化、刷新编排、播报、打开文章
  components/              UI：文章行、列表、分页器、订阅、收藏、设置、诊断、播报条、AI 面板、图标
```

单文件均 < 500 行；全部逻辑经 Node 侧单测（FNV-1a 已知向量、SimHash、RSS/Atom/RDF 解析、
去重、聚类、投影、正文抽取、相对时间）与 jsdom 侧整页渲染 + 逐页点击验证。

---

## 2. 完全对齐的部分

- **三 Tab**（资讯 / 订阅 / 收藏）由 `scene.tabBar` 声明、`aibox.tabs.on('changed')` 切渲染。
- **顶栏四态互斥**：`showBroadcast = (tab === 'feed') && 有TTS && 时间线非空`；
  ✨ 走 `toolbar.invoke`（`toolbar.update({items:{ai:{hidden}}})` 控制显隐），⋯ 用 `role: hostMenu`，
  「朗读 / 停止朗读」经 `manifest.actions` + `scene.menu` 挂进宿主 ⋯ 菜单，标题随播报状态实时切换。
  一处**语义上的细微差别**：宿主 ⋯ 菜单是平台保留出口，声不声明都在、也不该被小应用藏掉
  （`role:hostMenu` 那一项只是位置标记，不是自己的按钮）。所以「不可播报时右上角只剩 ✨」这一态，
  本应用是靠 `menu.update({items:{listen:{hidden:true}}})` **隐藏菜单项**表达的，
  而不是像原生那样整个 ⋯ 不渲染——⋯ 仍在，只是里面没有本应用的项。
- **搜索**：`scene.toolbar.search` + `searchChanged`；匹配规则是 title / summary / sourceName /
  author 的**子串** contains（非分词非模糊），与主题筛选、隐藏已读、事件折叠同一趟计算。
- **分类 chip 行**：11 项，计数 = **该桶折叠后的条目数**，为 0 时不渲染数字；选中滚到居中，
  动画 easeInOut 0.22s；与左右横扫双向联动。
- **列表行**：状态槽互斥（正在朗读 `speaker.wave.2.fill` > 未读 6×6 品牌色圆点 > 已读无标记）、
  标题 16 medium 3 行、摘要 12 muted 2 行、来源 12 品牌色 + `·` + 等宽相对时间 +
  `rectangle.stack`(N+1) + 已收藏书签、右侧 80×80 圆角 11 缩略图（已读 0.72 透明）、
  行内 `padding-vertical 6`、**无左滑操作**（只有长按菜单）。
- **长按菜单**顺序与条件：相关报道（`articleCount > 1`）→ AI 分析（有 AI）→ 朗读（有 TTS）→
  收藏/取消 → 标已读/未读 → 保存到知识库（宿主支持）。收藏/历史页去掉「相关报道」并加左滑删除。
- **刷新状态条**：只在资讯 Tab 且 `showRefreshStatus` 时作为列表第一行；四态标题 / 图标 / 颜色、
  第二行「{相对时间} · {N} 个来源」（N = **成功**来源数），整行点进诊断页。
- **空态四级优先级**：刷新中 → 有搜索词 → 选了主题且时间线非空 → 默认。
- **订阅页**：设置 / 添加两行 + 按分类分组（只显示有源的分类，组内按 sortOrder），
  源行六态状态、点行下钻单源实时拉取（不进主时间线、不缓存、一次 40 条）、
  长按上移/下移/删除、左滑删除，**内置源也能删**。
- **添加表单**：名称可空则用 endpoint 顶替；「测试来源」走正式抓取链路但不写库；
  改 endpoint/kind/topic 清空结果；**endpoint 以 `/` 开头强制视为 rsshub**；`sortOrder = max+1`。
- **收藏页**：两个子 Tab 可横扫；收藏按 savedAt 倒序、历史按 readAt 倒序取前 200 且只显示带展示字段的记录。
- **设置页**：4 段 + 高级设置，控件、图标、默认值、footer 文案逐条对齐（含预加载数在关闭预取时禁用）。
- **诊断页**：概览 / 最近一次刷新（含总耗时、来源抓取、时间线处理、事件聚类、抓取、去重、聚类、
  有内容/空/失败来源数）/ 逐源状态 / 立即刷新 / 清除缓存；耗时格式 `<1s → %.0f 毫秒`，否则 `%.1f 秒`；
  10 种失败分类，http 有状态码时直接显示 `HTTP 404`。
- **数据层**：稳定键（`u:`/`g:`/`t:` + FNV-1a 64 位十六进制）、URL 归一（去锚点/追踪参数/尾斜杠）、
  RSS 2.0 / RDF / Atom 解析（单 feed ≤ 60 条，字段拾取与 SAX 缓冲语义一致，**不支持 JSON Feed**）、
  日期解析顺序、49 条内置源（默认开 14 条，与 NewsSourceCatalog.swift 逐条同名）、三个 Provider 的 URL 构造与条数、
  **SimHash 64 位 + 汉明 ≤3 去重**（切词：英文成词 + CJK 逐字 + 相邻二字组）、
  折叠规则、时间线快照（写节流 15s）、正文缓存分片 + LRU 删到 90% 水位、
  阅读记录上限 2000 → 裁到 1500。
- **刷新编排**：前台 TTL 300s、单飞、并发 fan-out 逐源计时、**首个非空来源立即发布一版**、
  一条都没抓到时**保留旧时间线与旧 lastUpdated**、去重 → 倒序 → 截断 → 发布 → 报告 → 落盘 →
  预取正文 → 异步聚类（代际号校验）。
- **打开文章**：URL 为空直接返回 → **先标已读并写历史** → `openMode === 'web'` 走
  `aibox.browser.open({mode:'inApp'})`，否则 `aibox.browser.openArticle` 带预提取正文进 Reader。
- **正文抽取**：整块删 script/style/nav/header/footer（找不到闭合就删到文末）→ 剥标签 → 解实体 →
  折叠空白 → 截断 8000 字符；四级回退（缓存 → feed contentHTML 且长度 > summary+40 → 抓页 → summary）。
- **知识库入库**：只存摘要快照 + 原文链接，Markdown 结构逐字一致。
- **i18n**：跟随 `window.__aiboxEnvironment`，并监听 `environment.localeChanged` 重渲染（不重载）。

---

## 3. 对外提供的 AI 工具

原生 `NewsPluginKit` 给 AI 暴露了 4 个 `AgentTool`。复刻版用**小应用的 action 机制**等价提供：
`manifest.actions[]` 声明 → 宿主投影成**延迟工具**（不进常驻 tools 数组，AI 经
`tool_search` / `describe` / `call` 发现与调用）→ 回到页面执行。宿主会给名字加上应用前缀。

| 原生工具 | 本应用 action | 参数 | 语义 |
|---|---|---|---|
| `news_search` | `search` | `{query?, topic?, cluster?, limit(1-30, 默 15)}` | 检索时间线；**时间线为空先刷一遍**（TTL 内直接用缓存）；配了 News API Key 且有 query 时并入全网检索再去重；`cluster:true` 按 clusterID 归并成事件组 |
| `news_read` | `read` | `{url \| id}` | 正文四级回退（缓存 → feed contentHTML → 抓页 → summary），**截断 6000 字符**，返回 `{article, excerpt, text}` |
| `news_source` | `source` | `{action: list\|add\|remove\|test, url?, title?, topic?, kind?}` | 订阅源增删查测。add 时**显式 kind 优先**，没给才按「`/` 开头 = rsshub」推断；remove 按 title 或 endpoint 匹配；test 拉 5 条但不写库 |
| `news_save` | `save` | `{action: save\|unsave\|list, url?, id?}` | 收藏 / 取消 / 列表（列表取前 30，按 savedAt 倒序） |

> ⚠️ **模型看到的工具名不是 `news_search`。** 宿主投影时按
> `String(format:"appact_%016llx", FNV-1a(appletID + actionID))` 生成工具名，即 `appact_3f2a…`。
> 上表左列只是「对应哪个原生工具」的说明，**不是可调用的名字**——
> 别在提示词里让模型「调用 news_search」，它找不到。模型只能靠 `tool_search` 按**描述文本**发现，
> 所以每个 action 的 `summary`（进 description + 140 字 shortDescription）与 `keywords`
> （拼成 `Keywords: …` 进 description）才是真正的可发现性来源，本包这两项都按中英双语关键词填满了。

声明要点：

- 4 个全部 `headless: true` + `visibility: ["agent","automation"]`，AI 才发现得到
  （投影条件逐字是 `allowsHeadlessExecution && effectiveVisibility.contains(.agent) && !disabled`）；
- `inputSchemaJSON` 写全（含 enum 与 min/max）且**刻意不用 `oneOf` / `anyOf` / `allOf`**——
  用了会让整个工具退化成单参数 `input_json`（一个 JSON 字符串），具名参数全没；
- `execution`：`search` / `read` 是 `mode:"concurrent"`（对齐原生这两个工具不覆写
  `executionMode`、走默认 `.parallel`），`source` / `save` 是 `"sequential"`
  （对齐原生它俩显式声明 `.sequential`）；超时按各自最坏情况给
  （`search` 冷启动要刷 49 个源 → 45s，`read` / `source.test` 各一次网络 → 20s，`save` 纯本地 → 15s）；
- `search` / `read` 是 `effect:"read"` + `readOnly:true` + `idempotent:true`；
  `source` / `save` 是 `effect:"write"` + `readOnly:false` + `destructive:true`（含 remove / unsave 语义）；
- 另有第 5 个动作 `toggleBroadcast`（⋯ 菜单的「朗读 / 停止朗读」），它**故意不是** agent 工具：
  `headless: false` + `visibility: ["userInterface","applet"]` —— 它要读「用户此刻看到的那串文章」
  并驱动播报条，无 UI 时没有意义。

**架构约束的落实**：数据层（`lib/store.js` / `aggregator.js` / `projection.js` / `providers.js` …）
是纯逻辑，运行时状态住在 `lib/session.js` 的**模块级单例**里，`lib/actions.js` 的处理函数
只依赖它 + `whenReady()`，**完全不碰任何 React 状态**；UI 只是同一份状态的另一个消费方。
注册发生在 `app.jsx` 的**模块求值期**（不是 React 副作用），所以无头 WebView 里没有组件挂载也能调用。
已用「不挂载任何 React 组件、直接按宿主调用路径跑 4 个 action」的 jsdom 用例验证（33 条断言全过）。

### 工具侧的近似

- **返回值形态不同**：原生返回 `ToolResult(content:[.text], detailsJSON:)`，卡片由宿主
  `NewsSearchCard` / `NewsArticleCard` / `NewsSourceCard` / `NewsSaveCard` 渲染。小应用 action 只能回
  **JSON 值**，所以我同时给了结构化字段（`items` / `clusters` / `feeds` / `articles`）**和**一个 `text`
  字段——`text` 的行格式与原生逐字一致（`• [来源 · MM-dd HH:mm] 标题\n  URL`），模型两种读法都成立。
  **专用结果卡片没有对应物**（小应用 action 的 `rendererID` 需要宿主注册渲染器，本包没提供）。
- **写型动作的 consent**：原生 `news_source` add/remove 与 `news_save` save/unsave 在
  `actionToolNames` 里，走 ToolRunner 的确认门。小应用 action 的授权由宿主 applet 侧的 consent 决定，
  不是同一条门——语义等价（都会确认），但门的位置不同。
- **`news_source` 的 test / add 受域名白名单限制**：不在 `networkAllowed` 里的 host 会被宿主拒绝，
  AI 添加的新域名源抓不到。错误信息里已如实提示这一点。
- ⚠️ **manifest 的键名必须用 camelCase，且这件事没有任何闸门会替你查。**
  市场安装路径（`AppletMarketInstaller.decodeManifest`）用的是裸 `JSONDecoder()`，
  只设了 `dateDecodingStrategy`、**没有 `keyDecodingStrategy`**；而
  `AppletActionExecutionPolicy` 等结构体没有自定义 `CodingKeys`，于是 JSON 键 = Swift 属性名。
  同一个结构体在 `applet_manage` 工具路径上读的却是 snake_case（`timeout_ms` / `requires_network` …），
  **照着那套写会被 Codable 当未知键静默丢弃**：安装不报错、`validate.mjs` 也不报错
  （它校验的是市场自己的 schema，不是宿主的解码器），只有对应字段悄悄变成 nil。
  本包用的是 camelCase（`timeoutMilliseconds` / `requiresNetworkConnectivity`），
  已用「逐键比对 Swift 属性名 + CodingKeys 重映射」的脚本机械核过 21 个对象、全部被接受。
  改这份 manifest 时请以 **Swift 结构体的属性名**为准，不要抄工具 schema 的写法。
  （已建议市场脚本加一条通用闸门，见 `applet-market` 侧。）
- **`outputSchemaJSON` 在这条路径上不产生任何效果**：延迟工具投影只读 `inputSchemaJSON`。
  本包仍然写了输出 schema（作为契约文档、也为将来可能的用途），但**别指望模型据它校验返回值**。
- **只有已发布版本里的 action 会被投影**（宿主读 Active/LKG 快照，Draft 合同不进目录）。
- **用户可以在能力中心 ▸「这个应用提供的工具」里单独关掉某个 action**：关掉后既不进目录，
  执行时也会被二次拦下。这是宿主行为，本应用无法也不应绕过。

---

## 4. 近似而非 1:1 的部分（诚实清单）

### 4.1 事件聚类 —— 度量与阈值都换了（最大的一处近似）

原生用 `NLTextEmbedder`（Apple 句向量模型）对 `title + " " + summary` 取向量，
贪心单遍、余弦 **> 0.82** 归并、代表向量取簇内第一篇。

小应用运行时的裸 import 白名单只有 react / react-dom / antd-mobile / chart.js，**没有任何句向量模型**，
也不能联网取模型。因此 `lib/cluster.js` 改用**词袋（TF）余弦**，切词复用 SimHash 的 shingles：

| | 原生 | 本应用 |
|---|---|---|
| 向量 | NLTextEmbedder 句向量 | 归一化词频稀疏向量（CJK 逐字 + 相邻二字组） |
| 阈值 | 0.82 | **0.45**（另加「共享词 ≥ 2」的护栏） |
| 贪心单遍 / 代表向量不更新 | ✅ | ✅ |
| 取不到向量不聚类 | ✅ | ✅ |

**0.45 是按度量特性推定的，没有用真实语料标注验证过。** 词袋余弦与句向量量纲完全不同
（同一事件的两篇报道在句向量里常达 0.85+，在词袋里通常只有 0.35~0.6），照搬 0.82 会导致一条都不聚。
设置页没有暴露这个阈值，需要调整请改 `lib/cluster.js` 的 `DEFAULT_THRESHOLD`。
语义后果：**跨语言/换词严重的同事件报道会漏聚**（词袋看不出「地震」和「quake」是一回事），
**用词高度重叠但事件不同的稿件可能误聚**。去重（SimHash）不受影响，仍是逐位等价的移植。

### 4.2 播报（TTS）—— 没有「读完了」事件

`aibox.tts` 只有 `speak`（一发即返，不等读完）和 `stop`，**没有完成回调、没有 pause/resume**。于是：

- **自动连播**靠按文本长度**估算时长**后定时切下一篇（中文 ~4.5 字/秒、西文 ~15 字符/秒 + 0.6s 间隔）；
  语速与真实朗读不符时会提前或滞后切换。
- **「暂停」= stop；「继续」= 从当前这篇的开头重新读**，不是断点续读。
- **进度条是估算进度**，不是真实播放进度。

队列上限 20、从长按处往后取、懒加载正文回落 summary、拼「标题. 正文」、
「当前列表没有可播报的文章。」、「朗读失败，请检查语音服务设置。」、5 秒自动撤回提示条、
`speakingArticleId` 替换未读圆点 —— 这些都与原生一致。

### 4.3 AI 助手 —— 自绘轻量对话，不是停靠会话

原生 ✨ 打开宿主的**停靠式会话**：真聊天页、真工具（`news_search` / `news_read`）、
按 identity（首页 `news` / 逐篇 `news:<id>`）**持久续聊**、系统上下文 + 三个快捷 chip。

小应用只有 `aibox.ai.generate`，没有停靠会话 API，所以 `components/AIPanel.jsx` 自绘了一个对话面板：

- 保留：会话身份分档、系统上下文文案、开场消息、三个快捷 chip（标签 / 图标 / prompt 逐字一致）；
- **换掉**：工具调用 → 把当前时间线的前 40 条（标题 + 主题 + 来源）拼进系统上下文；
- **缺失**：会话不持久（关掉面板即清空）、没有流式输出、没有跨页跟随/悬浮球/场景徽标。

没有 `permissions.ai` 或 `aibox.ai.availability()` 报不可用时，整个 ✨ 入口不渲染。

### 4.4 缩略图 —— secure 模式下一律被 CSP 拦截

`securityMode: secure` 的 CSP 是 `img-src applet: data: blob:`，**远程图片一律被阻断**。

行为：仍然按原生布局渲染 80×80 缩略图槽位，`<img>` 加载失败后回落成
`line 55%` 底 + `photo` 图标的占位（即原生的占位样式）。宿主处于 developer 模式时图片会正常显示。
**这是平台边界，不是实现偷懒**：市场包必须保持 secure。

> 新版桥的 `net.fetch({responseType:'base64'})` 理论上能把图片字节取回来转成 `data:` URL 绕过 CSP。
> **没有采用**：文章配图几乎都在 CDN 域名上（`ichef.bbci.co.uk`、`images.thepaper.cn` …），
> 而 `networkAllowed` 只列了 feed 自身的 host——要让它真的有用得把几十个 CDN 域名塞进白名单，
> 既扩大了这个包的网络面，又对用户自己加的源无效。列表里每张图再多一次跨桥的 base64 传输也不划算。

### 4.5 网络 —— 域名白名单封闭

市场校验禁止 `networkAllowed: ["*"]`，所以 manifest 精确列出了 49 条内置源涉及的
36 个 host + `rsshub.app` + `newsdata.io`。后果：

- **用户自己添加的订阅源，若域名不在白名单内会被宿主拒绝**（原生可抓任意 URL）。
  需要新域名只能发新版本；这是市场分发的固有代价。
- **抓页抽取正文基本失效**：文章正文页多在第三方域名上，不在白名单里。
  正文四级回退因此实际退化为「缓存 → feed 自带 contentHTML → summary」。
  用 feed 自带全文的源（少数派、阮一峰、Solidot 等）不受影响。

### 4.6 HTTP 细节

- **超时**：桥不接受 per-request timeout（原生代理固定 30s），所以 8 秒超时是在页面侧用
  `Promise.race` 封顶的——原生请求会继续跑完，只是页面不再等它。
- **响应体上限**：桥默认截断到 200KB。本应用显式传 `maxBytes` 放宽——feed 抓取 1MB、
  整页抓取 512KB（`maxBytes` 是新版桥的可选项，老宿主会忽略未知 option，传了也安全）。
  仍被截断时 feed 会变成不闭合的 XML，`feedParser` 会剪到最后一条完整的 `</item>` / `</entry>`
  再补闭合标签重解析，所以是「少几条」而不是「整份丢失」。原生没有这个限制。
- **老宿主的截断陷阱**（市场包会被装到别人机器上，所以必须处理）：旧版桥不认 `maxBytes`，
  且对 >200KB 的多字节正文是**按字节切断** → UTF-8 解码失败 → 整个 body 变**空串**，
  上面那条 `</item>` 修复路径拿到空串救不回来。判据不是读 `truncated` 的值，而是
  **响应里有没有这个字段**（`'truncated' in response`）——旧版根本不返回它。
  本应用据此把「老宿主 + 200 + 空 body」升级成 `responseTooLarge` 失败，
  诊断页显示「响应过大」，而不是把这个源静静记成「暂无内容」。
  新宿主按字符边界截断并回 `truncated:true`，空 body 就照实是空 body（＝原生的「空来源」语义）。
- `maxBytes` 这类新 option **不需要探测**：桥对 `options` 不做未知键校验，只挑自己认识的键读，
  所以新 option 在老宿主被忽略、未知 option 在新宿主也被忽略，两个方向都安全。
  （descriptor 里的 `"additionalProperties": false` 是给 AI 看的 schema 文档，不是运行时门。）
- **非 UTF-8 的 feed（如 GB2312）会读到空串**：桥用 `String(data:encoding:.utf8)` 解码，失败即空。
- `User-Agent` 与原生一致；`Referer` 未使用（原生也只在需要时传）。

### 4.7 其它已知差异

| 项 | 原生 | 本应用 |
|---|---|---|
| 相对时间 | 刚发布的时间戳会显示「0秒后」 | \|Δ\| < 60s 一律「刚刚」（**有意改良**，spec §2.7 建议） |
| 后台刷新 / 低电量减负 | BGTaskScheduler + `ProcessInfo.isLowPowerModeEnabled` | 无对应 Web 能力：开关保留但**不生效**（低电量恒判为否） |
| 列表渲染 | SwiftUI List 天然懒加载 | 按 30 行增量挂载 + IntersectionObserver 续渲染（**不是分页**，数据仍全量） |
| 主题分页 | `TabView(.page)` | 自绘三屏窗口分页器（跟手拖拽 + 0.22s 吸附） |
| 长按菜单 | `contextMenu` | 自绘底部面板（运行时已知 `Toast.show` 渲染为空，同族命令式弹层不敢用） |
| SF Symbols | 系统符号 | 手绘内联 SVG 等价图形（几何近似，非像素级） |
| 图标 `photo` 占位 | `CachedAsyncImage` 两级缓存 | 浏览器自带 HTTP 缓存（且见 4.4） |
| 文案键 | 166 条 | 154 条 + 10 条 React 侧新增（`news.x.*`）。未移植的是卡片/插件包元信息与知识库蒸馏 sheet 的键，本应用没有对应界面 |
| 每日早报 | 写进宿主定时任务 | 只把同一句 prompt 发给 AI 面板（没有 `aibox.jobs` 权限） |
| 事件簇详情 | `navigationDestination` 推栈 | 应用内路由栈（顶栏自带返回） |

### 4.8 没有实现的

- **OPML 导入 / 导出**：原生也没有，按 spec 不实现。
- **小组件 / 卡片 / `news_*` 工具**：属于宿主插件面，不在小应用范围内。
- **分享**：`news.article.share` 由浏览器模块提供，不在本应用。

---

## 5. 宿主能力缺席时的降级

三个新平台能力（`aibox.tabs` / `aibox.toolbar` / `aibox.browser`）宿主侧已落地（包级编译 + 单测绿，
真机未验）。本应用**全部先探测再使用**，缺席或不渲染时不留死按钮：

| 缺席的能力 | 降级 |
|---|---|
| `aibox.tabs`（或 `rendered: false`，如 card/sheet/drawer 形态） | 自绘悬浮胶囊底栏 |
| `aibox.toolbar`（或 `rendered: false`，如 fullscreen 无导航栏） | 自绘顶栏（标题 + ✨ + 朗读按钮） |
| `toolbar.search.rendered === false` | 自绘搜索框 |
| `aibox.browser`（Lean 壳无 BrowserCapability 时整条命名空间不进目录） | 依次退 `browser.open` → `aibox.open.url` |
| `aibox.tts` | 播报入口整块不渲染 |
| `aibox.ai` 或 `availability().available === false` | ✨ 入口整块不渲染 |
| `vault_create` 工具不可用 | 长按菜单不出现「保存到知识库」 |

`getState()` 恒可读（无头执行也返回 `rendered:false` 而不是报错），所以探测逻辑可以直接依赖它。

**没有用上的宿主能力**：`browser.openArticle` 返回 `{opened, mode, reader}`，降级到 system/external
时 `reader:false`。本应用**忽略这个返回值**——原生新闻模块自己也没有阅读器（Reader 排版全在浏览器模块），
所以没有「Reader 不可用就自绘阅读态」这条分支可复刻。

---

## 6. 已知待验

以下只在 Node + jsdom 环境验证过，**未在真机 WebKit 里跑过**：

1. 三个新平台能力的真实事件流（本仓库只能按文档合同编码，宿主实现由另一条线并行推进）；
2. 自绘分页器 / 左滑 / 下拉刷新在真机触摸下与 WebView 原生滚动的手势竞争；
3. antd-mobile 的 CSS 注入与本包 CSS 变量在深色模式下的混排；
4. 49 条源同时 fan-out 时，串行桥的实际吞吐（页面侧已限并发 6）；
5. 4 个 AI 工具在真实 `tool_search` / `describe` / `call` 链路上的可发现性与无头执行
   （本地已用「不挂载任何组件、直接走调用路径」的用例验证过逻辑，但没经过宿主的延迟工具投影）。

**曾经列为待验、现已由外壳实现方书面确认的两条**（记在这里备查）：

- **外壳图标不走 `.applet` 策展表**。实现是 `AppletShellSymbol.resolved(_:fallback:)`，
  只做 `UIImage(systemName:) != nil` 存在性判断，存在即原样用，不存在才回退 `circle`；
  `AiBoxIconCatalog` 在外壳渲染路径里没有被引用。所以 `newspaper` / `dot.radiowaves.up.forward` /
  `bookmark` / `sparkles` / `ellipsis` 与各自的 `.fill` 选中态全部原样渲染。
- **`toolbar.update` 接受 `hidden`**。tabs 与 toolbar 的运行时可改字段一致，都是
  `title / icon / badge / enabled / hidden`；传 `null` 是清除 override 回 manifest 声明值，不是设成 false。
  本应用因此用 `hidden` 而非 `enabled`。
