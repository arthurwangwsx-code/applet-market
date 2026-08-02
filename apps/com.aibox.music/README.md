# 音乐（com.aibox.music）—— 与原生版的差异说明

本应用是 AiBox 原生 `AiBoxMusicKit`（Swift / SwiftUI，101 文件 / 13342 行）的 **React 小应用复刻**。
页面结构、交互语义、视觉令牌、中英双语文案逐条对齐规格；文案取自
`AiBoxMusicKit/Resources/Localizable.xcstrings`（en 源 + zh-Hans）。

**架构裁决（不可违反）**：本应用**遥控宿主播放引擎 `aibox.music.*`，不自持任何媒体引擎**。
播放由原生 `AudioPlayerService` 执行，锁屏 NowPlaying 卡片、remote command、耳机线控、
后台续播、音频中断恢复、系统音量全部由原生维护——WebView 被挂起也不影响。
`aibox.media` 那条路不写锁屏、不注册 remote command，做出来的播放器在锁屏和控制中心
**没有任何媒体卡片**，因此被结构性排除。同理，**播放队列留在原生**（`music_queue`），
本应用不维护影子队列（跨 App 重启恢复与锁屏控制都依赖原生那一份）。
依据：`docs/capabilities/applet/framework-capabilities.md` §3.6 / §3.6.1。

---

## 1. 目录

```
src/
  manifest.json          scene.tabBar（5 Tab）/ scene.toolbar / actions（3 个对外动作）/ 权限
  app.jsx                根装配：外壳接线、Tab 路由、动作总表、mini 播放条
  i18n/                  ~170 条中英文案 + locale 跟随（environment.localeChanged）
  lib/
    host.js              桥封装（music / haptics / ui / share / open / storage / net）
    music.js             MusicController：轮询、平滑时钟、走带、队列乐观更新、定时器、音效
    queue.js             队列状态机（规格 §5.4 逐条，纯函数，有 Node 断言）
    clock.js             整数秒 → 单调时钟插值（规格 §4.7）
    lyrics.js            LRC 解析 + 行模型 + 当前行 + 扫光（逐行同步接口已就位）
    artwork.js           封面取字节 / data URL / 专辑主色 / 封面 URL 反查
    store.js             本应用自有持久化：播放历史、搜索历史、UI 恢复点、封面映射
    format.js            时长 / 剩余 / 音质标签 / 稳定键 / 播放参数
    actions.js           3 个对外 AI 动作（headless）
  components/            NowPlaying / Lyrics / PlayerControls / MiniBar / 5 个 Tab 页 /
                         详情 / 设置 / 音效 / 两个 sheet / ⋯ 菜单 / 行组件 / 图标 / 令牌 /
                         Shell.jsx（宿主没渲染 tabBar/顶栏时的自绘降级件）
tests/queue.test.mjs     38 条 Node 断言（队列状态机 + 平滑时钟 + 歌词行模型）
```

单文件均 < 500 行。

---

## 2. 完全对齐的部分

- **5 Tab，Now Playing 在正中间**，默认选中就是 Now Playing（不是资料库）；选中 tab 持久化并恢复；
  切 tab 触发 selection 触感 + 清空下钻状态。
- **Now Playing 氛围背景 5 层叠加**：纯黑打底 → 模糊封面（blur 80 / opacity .55）→ 专辑取色渐变
  `[base 55%, base 16%, black 35%]` → 底部加深 `[transparent, black 50%]` → 歌词态再叠 `black 28%`；
  专辑色变化 0.4s、进出歌词态 0.35s。
- **布局红线已守住**：封面被有具体尺寸的容器 `overflow:hidden` + `object-fit:cover` 裁住，
  绝不撑开父级（原生历史 bug「Now Playing 控件不显示」的真根因）。
- **两态就地切换**：点封面 / 点缩略封面 / 点歌词按钮都切换；底部控件组两态共享；
  滑动歌词时底部控件隐藏（0.28s），滚动停止 1.8 秒后恢复；回到专辑态强制恢复。
- **无曲目时点歌词按钮不切换**，弹自绘胶囊「暂无歌词」，2 秒后淡出（`Toast.show` 在本宿主渲染为空，
  所以自绘；样式按规格：Capsule + 白字 15pt medium + 水平 20 / 垂直 12 + 阴影 + scale(0.92) 过渡）。
- **进度条**：轨高 4/8、圆点 12/16、按下即进入拖动态、时间等宽、右侧剩余时间带 `-` 前缀、
  duration ≤ 0 显示 `--:--`；**松手后 0.3 秒内仍显示松手位置**再交还真实时间。
- **走带条**：三键等分，忙态在播放键位置显示 spinner，无曲目三键禁用，点播放先打 impact 触感；
  随机/循环/音效/定时器都不在这里，全在 ⋯。
- **`previous` 在 `currentTime > 3s` 是回到本曲开头**（原生 `music_transport previous` 即此语义，
  本地同时把插值时钟归零，视觉不等一趟往返）。
- **乐观点亮**：点播时先把 UI 切成播放态，不等授权/订阅/取曲/起播；失败分支如实纠回并显示失败卡。
- **失败态**只在 `playbackState == failed` 渲染（loading / buffering 不在这里显示 spinner），
  四类原因文案 + 「重试」白底黑字 Capsule。
- **loading 归属**：音频加载只在播放键、歌词只在歌词区、封面/元数据静默后台补全，绝不叠两个 spinner。
- **mini 播放条**：只在非 Now Playing tab 出现；液态玻璃胶囊 + 底部 2pt 进度线；
  **上滑 25pt 展开**到 Now Playing（不只是点击）。
- **队列页**三段（正在播放 / 即将播放 / 最常播放前 8），已播过的不显示；
  即将播放支持拖拽排序与左滑删除；最常播放行右侧 `text.append` 加入队列；标题「队列（N）」。
- **搜索页**：范围分段、防抖 300ms、五段结果（顶级结果最多 3 条，不足补歌单第 1）、
  历史视图（最近搜索 ≤10 / 最近点播 ≤15，左滑删单条、段头「清空」走二次确认）。
- **资料库页**四段与 Apple Music 五态互斥（加载中 / 未授权 / 无订阅 / 空 / 已加载）。
- **本地曲库**四种浏览模式、音质标签规则（仅 flac / alac 显示大写徽标，Apple Music 一律不标无损）、
  扫描问题横幅「旧索引已保留」。
- **详情页**：专辑/歌单 180 封面 + 播放/随机等宽按钮（随机 = 先开随机再从第一首起播）、
  曲目行序号/时长、艺人页 130 圆形头像 + 热门歌曲最多 10 首 + 专辑横向卡。
- **音效页**：开关 / 速度（滑块 + 5 个预设胶囊）/ 均衡器（8 预设 + 10 频段 ±12dB + 前置增益），
  改动即时应用，无「保存」。
- **平滑时钟**：轮询锚点 + 单调运行时间插值，暂停/忙时速率为 0，切歌与 seek 递增时间线版本重锚。
- **i18n**：跟随 `window.__aiboxEnvironment.locale`，监听 `environment.localeChanged` 重渲染不重载。

---

## 3. ⭐ 四个平台缺口与降级方案（如实列出，没有假装做到）

### ① 高频进度 / 状态推送缺失 —— 只能轮询，且 `currentTime` 是**整数秒**

- **现状**：容器没有 `aibox.music.on('progress'|'stateChanged'|'trackChanged')`，只能
  `setInterval` 轮询 `aibox.music.status()`；每次是一整趟 AgentTool 调用（跨桥 → consent → 执行 → 序列化）。
  返回的 `currentTime` / `duration` 是 `Int(...)` **取整到秒**。
- **本应用的处理**：轮询 1Hz（播放中）/ 0.4Hz（暂停），页面不可见时**停轮询**；
  显示层用 `lib/clock.js` 的「轮询锚点 + `performance.now()` 单调插值」铺平，UI 侧 10Hz 重绘。
  额外一招：整数秒的**进位沿**是免费的高精度信息——观测到秒数 +1 时把锚点钉在那一刻，
  误差不超过一个轮询周期；同一秒内的重复观测只兜底纠偏，不重新锚定。
- **仍然存在的差距**：外部操作（锁屏 / 耳机 / 控制中心暂停切歌）最多滞后 1 秒才反映到本页；
  硬件音量键改音量不会即时回填滑块（缺口⑦，只能等下一次轮询）。

### ② 歌词没有时间轴 —— 逐行同步与卡拉OK扫光**做不了**

- **现状**：`music_lyrics` 返回的是 `lyrics.lines.map(\.text).join("\n")`，**时间轴在包内被丢掉了**。
- **本应用的处理**：按纯文本渲染歌词（居中、可滚动、上下边缘淡出遮罩、底部留白 280）；
  **不做**当前行高亮、不做自动滚动、不做扫光、点行不跳转（没有时间就不能假装能跳）。
- **接口已经留好**：行模型统一是 `{time, text, translation}`，`currentLineIndex` / `sweepRatio`
  已按规格 §4.7 实现并有单测；`readLyricsPayload` 一旦看到宿主返回
  `{synced, source, lines:[{time,text,translation}]}` 或带 `[mm:ss]` 的原文，
  **同一份渲染代码自动变成逐行同步 + 扫光 + 点行 seek**，上层无需改动。
- **明确不做的事**：不自己去网上抓歌词。包内已有 lrclib → 网易云 → QQ 的多源链路、严格匹配门
  （标题硬门 0.72 / 总分 0.72 / 时长超差直接拒）、正负缓存与 AI 翻译，重造只会显示错歌词。
- **精度声明**：即使宿主补上时间轴，只要进度仍是整数秒接口，**同步精度也受限于插值估计，
  与原生的亚秒级同步有差距**。

### ③ 本地曲库没有封面

- **现状**：`music_local` 的条目只有 `{title, artist, album, genre, year, duration, codec, localTrackId}`，
  **没有封面字段**；真实封面在沙盒 `<AppSupport>/AudioLibrary/.artworks/<hash>.jpg`，
  WebView 读不到，路径按设计也不外泄。
- **本应用的处理**：本地曲库按原生布局做（专辑网格 / 艺人 / 歌曲 / 流派），封面位一律显示
  **accent 12% 底 + 音符占位**；页面顶部有一行说明文字，不让用户以为是加载失败。

### ④ 专辑主色拿不到 —— 氛围渐变底是**近似**

- **现状**：原生取的是 Apple Music 服务端给的官方 `Artwork.backgroundColor`，容器没有透出。
- **本应用的处理**：把远程封面取回来画进 8×8 canvas 取加权平均色，再做一次饱和度提升；
  黑白封面（饱和度 < 0.08）保持原色不硬拉。**这与服务端主色不是同一个值，只是视觉上接近。**
  拿不到图时（本地曲目、无网络、无权限）回落到 accent 色。

---

## 4. 复刻过程中发现的、规格外的额外差异

### ⑤ 远程封面在 secure 模式下被 CSP 拦掉 —— 所有封面都要绕一趟原生代理

`AppletSchemeHandler.csp(.secure)` 是 `img-src applet: data: blob:`，**远程 URL 的 `<img>` 会被整条拦掉**。
所以封面统一走 `aibox.net.fetch(url, {responseType:'base64'})` → 拼 `data:` URL 再渲染
（顺带解决 canvas 取色的跨域污染问题）。代价：
- manifest 必须声明 `network: true` + `networkAllowed: ["mzstatic.com"]`（Apple 封面 CDN），
  用户首次会看到一次网络 consent；**拒绝后所有封面变占位图，播放不受影响**。
- 每张封面是一次桥调用；已做内存缓存 + 同 URL 请求去重 + 按显示尺寸改写 `{w}x{h}` 段。

### ⑥ `music_status.currentTrack` 不带封面，也不带 Apple Music 链接

`AudioTrack.toolJSON` 只有 `{id, title, url|musicItemId, artist, album, duration}`。
所以本应用维护一张 **封面 / 外链映射表**（`stableKey → {art, link}`，上限 400 条，随搜索/推荐/资料库/
详情结果自动喂入），当前曲没命中时**后台做一次 `music_search` 反查**并记住。副作用：
- 从未在任何列表里出现过的曲目（例如 AI 直接用 id 点播的），第一次可能短暂显示占位图；
- 「分享」与「在 Apple Music 打开」只在映射表里有链接时出现（原生是有 `externalURL` 就出现）。

### ⑦ For You 丢失服务端货架标题

`music_recommendations` 把服务端货架**拍平成按类型分组**（`{kind, albums, playlists, songs, ...}`），
`shelf.title` 在工具层就丢了。所以本应用按「最近播放 / 为你推荐 / 排行榜 × 类型」排版，
卡片尺寸仍按规格（132 / 164 / 132），但**看不到「因为你听了 XXX」这类服务端货架名**。

### ⑧ 电台（无尽流）做不了

没有任何工具投影 `playStation`。For You 里 `kind == station` 的卡片点击后**如实提示不支持**，
不假装能播。

### ⑨ 没有搜索建议

原生用 `MusicCatalogSearchSuggestionsRequest` 做实时联想，宿主未投影 → 建议行整块不渲染。
（中文输入仍是「拼音上屏后才更新 query」，与原生一致，不是 bug。）

### ⑩ 五态是「反推」的，不是查出来的

没有 `aibox.music.availability()`（缺口⑨），未授权 / 无订阅 / 真的空只能从工具**失败文案**归类。
宿主哪天改了错误文案，这里会退化成「加载失败」而不是误报成「库为空」。

### ⑪ ⋯ 菜单里少了两项

- **Autoplay（无尽播放）**：原生是偏好键 `AudioAutoplay`，**没有任何工具能读写** → 整项不渲染。
- **歌词翻译（Show Translation / 翻译语言）**：需要 AI 文本能力；本应用 manifest `ai: false`
  → 整段不渲染（留个点了没反应的开关比没有更糟）。

### ⑫ 设置页少了「歌词源」整段

lrclib / 网易云 / QQ 的顺序与开关只在原生模块内部，没有工具投影 → 整段不渲染，
并在歌词段脚注里如实说明「由宿主音乐模块管理」。
「默认循环模式 / 默认随机播放」两项在原生是偏好键，这里改为**直接作用于当前播放器**，段脚注注明。

### ⑬ 本地曲库一次最多 500 条 + 不能导入文件夹

- `music_local` 的 `limit` 上限就是 500，**超大曲库拿不全**（规格里「上万首」的场景取不到全量）。
- 容器只有单文件 picker，没有目录选择与安全书签持久化（缺口⑧）→ **「导入文件夹」入口不做**，
  空态文案改成「请在原生音乐里导入」。
- 收藏页左上的「导入本地音频」同理去掉：`aibox.picker.file` 返回的是 applet 私有资源句柄，
  原生播放引擎读不到它，导进来也播不了。

### ⑭ 队列重排是「松手提交一次」

`music_queue action=move` 一次只能移一步（缺口⑪ 没有批量重排）。拖动过程中只做本地乐观重排，
**松手时只发一次 `move(from, to)`**，随后用 `music_queue list` 对账；失败则整体回滚。

### ⑮ 长列表用的是自写的 `VirtualList`

市场校验的离线裸模块白名单里**没有 `aibox/ui`**（只有 react / react-dom / react/jsx-runtime /
antd-mobile / chart.js），引用会被 `validate.mjs` 拒掉、运行时白屏。所以
`components/primitives.jsx` 里写了一个**同接口**的等价实现
（`<VirtualList items itemHeight renderItem overscan header footer />`）。
宿主哪天把 `aibox/ui` 放进白名单，只要接口一致就能整体替换。

### ⑯ 宿主壳贡献点一并消失（产品决策，不是技术缺口）

通知台卡、根级悬浮控制台、创作中心入口、快捷启动、设置面贡献、Files 的「用音乐打开」——
这些是宿主 `UIContribution` 的 slot，小应用没有等价能力。

---

## 5. 对外提供的 AI 动作

### 5.1 本应用声明的 3 个动作（`manifest.actions` + `aibox.action.register`）

刻意**不重复**宿主已有的 19 个 `music_*` 工具——那些是原生 AiBoxMusicKit 提供的，
再包一层只会造成重名混淆。这里只声明宿主工具**覆盖不到**的编排型能力：

| name | 语义 | effect | headless |
|---|---|---|---|
| `nowPlayingSummary` | 一次调用返回 当前曲 + 位置/时长 + 队列摘要（含 upNext 5 条）+ 循环/随机 + 睡眠定时器 + 歌词可用性，省掉 AI 连打 3 个宿主工具 | read / 只读 / 幂等 | ✅ |
| `playMostPlayed` | 按**本应用自己的播放历史**排名起播（宿主 19 个工具**没有任何一个能读播放历史**） | mediaPlayback / 写 | ✅ |
| `resumeLast` | 回到本应用记的上次播放曲目与位置（同样没有工具能读这个恢复点）；已在放同一首时只补 seek，不重新起播 | mediaPlayback / 写 | ✅ |

三个都 `visibility` 含 `agent`、都能**无 UI 执行**：只依赖 `aibox.music.*` 与 `aibox.storage`，
不读任何 React state。`nowPlayingSummary` 里「歌词当前行」依赖时间轴，当前拿不到时
**如实回 `currentLine: null` 并附 `note` 说明原因**，不猜。

### 5.2 依赖宿主的 19 个 `music_*` 工具（本应用只调用，不重复声明）

`music_play` / `music_transport` / `music_seek` / `music_set_volume` / `music_set_repeat` /
`music_set_shuffle` / `music_status` / `music_queue` / `music_search` / `music_library` /
`music_recommendations` / `music_album` / `music_get` / `music_playlist` / `music_playlist_delete` /
`music_local` / `music_lyrics` / `music_sleep_timer` / `music_effects`

它们经 `aibox.music.<method>` 一等投影调用，执行仍走 active scope / ConsentGate / timeout /
系统权限。`music_playlist_delete` 是其中唯一需要二次确认的。

### 5.3 若原生音乐模块下线，本应用需要补齐的工具清单

一旦 `AiBoxMusicKit` 不再打包进 App，上面 19 个工具会一起消失，本应用**必须自行承接**
（届时也就必须自持播放引擎，那需要先给 `aibox.media` 补 NowPlaying 属主租约 + remote command 转发）：

| 需要补的工具 | 现在依赖宿主的什么 |
|---|---|
| `music_play` / `music_transport` / `music_seek` | `AudioPlayerService` 的起播与走带 |
| `music_set_volume` / `music_set_repeat` / `music_set_shuffle` / `music_status` | 播放态与系统音量 |
| `music_queue` | **原生队列**（跨 App 重启恢复 + 锁屏控制的真值） |
| `music_search` / `music_recommendations` / `music_album` / `music_get` / `music_library` | MusicKit 目录、资料库与发现流（**iOS 端只有原生能调**） |
| `music_playlist` / `music_playlist_delete` | 歌单 CRUD（Apple Music 侧只支持 list/create/add_tracks/play） |
| `music_local` | 本地曲库扫描与索引（安全书签、增量对账、封面抽取） |
| `music_lyrics` | 多源取词 + 严格匹配门 + 正负缓存 + AI 翻译 |
| `music_sleep_timer` / `music_effects` | 睡眠定时器与 EQ/变速引擎 |

其中 **Apple Music 相关的五个在小应用侧无法承接**（MusicKit 是原生 API），
只能保留原生模块或明确放弃 Apple Music 能力。

---

## 6. 自测

```
node apps/com.aibox.music/tests/queue.test.mjs      # 38 条断言，全绿
```

覆盖：队列状态机 §5.4 全部归一化规则（replace / appendOrSelect / add / remove / move /
setShuffle / 随机序对账 / nextIndex / previousIndex / 与原生真值对账）、
平滑时钟（暂停冻结、单调插值、进位沿锚定、时间线版本重锚、不越过总时长）、
歌词行模型（LRC 多标签与 offset、纯文本、当前行阈值、扫光量化、表头剥离、结构化 lines 自动接管）。

另有两个离线闸门（脚本在会话 scratchpad，不入包）：
- **转译 + 语法检查**：用仓库 vendored 的 sucrase 转译 30 个源文件后 `node --check`，30/30 通过；
- **冒烟渲染**：`react-dom/server` 渲染根组件与 15 个页面/弹层组件，全部通过、无 React 告警。

---

## 7. 未完成项

1. **自建合集详情 sheet（§2.14）** 没做：本地歌单目前走通用详情页（只读 + 整张播放），
   缺「拖拽排序 / 滑动删除 / 编辑态」。宿主 `music_playlist` 的 `remove` / `reorder` 对 local 是支持的，
   补这一页不需要新平台能力。
2. **聊天工具卡片版 mini 播放器 / 通知台卡 / 悬浮控制台（§3.4）** 不做：宿主壳贡献点，小应用无等价能力。
3. **Lean 变体的 3 Tab 形态**：`scene.tabBar` 的 tab 身份与数量在声明期冻结，运行时只能 `hidden`。
   代码路径已具备（`aibox.tabs.update({items:{forYou:{hidden:true}, search:{hidden:true}}})`），
   但**没有接自动判定**——因为缺口⑩，「没有 Apple Music 能力」只能从错误文案反推，
   贸然隐藏 Tab 的误伤代价高于收益，所以当前始终显示 5 个 Tab，能力缺失时由各页空态如实解释。
4. **模块级推入/边缘右滑退出转场**：由宿主盖层承载，页面侧不模拟。
5. **真机验收未做**：出声播放、锁屏卡片、耳机线控、系统音量写入都必须真机验证
   （模拟器无音频硬件，系统音量写不进去）。本轮只做了离线断言 + 冒烟渲染 + 市场校验。
