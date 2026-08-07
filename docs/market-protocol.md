# 小应用市场协议 v1（当前 minor：v1.1）

> 一句话：市场是**一组静态 JSON 文件**。任何能发 HTTP GET 的宿主都能实现客户端，
> 服务端零逻辑、零数据库，Git 就是数据库。

设计取向对齐业界成熟做法：Git 为单一真值、静态 JSON 索引、内容按 sha256 寻址校验
（同 Homebrew tap / Scoop bucket / Bazel registry / npm integrity 的组合）。

---

## 1. 三个端点

宿主只需要一个 `baseURL`（例如
`https://raw.githubusercontent.com/<owner>/applet-market/main`），然后：

| 用途 | 路径 | 说明 |
|---|---|---|
| **查询列表** | `GET {base}/registry.json` | 市场全部应用 + 各自最新版本 |
| **查询发布版本** | `GET {base}/apps/{appId}/releases.json` | 单个应用的完整版本历史 |
| **下载安装** | `GET {base}/apps/{appId}/releases/{version}/bundle.json` | 一次请求拿到全部文件 |

额外可选：`GET {base}/apps/{appId}/releases/{version}/release.json`
只要元数据与文件清单（不含内容），用于「查看更新详情」而不下载正文。

所有响应都是 UTF-8 JSON。所有路径大小写敏感。

### 1.1 ⚠️ CDN 缓存：推送后不会立刻可见

`raw.githubusercontent.com` 对文件做 **CDN 缓存（约 5 分钟）**，且**带 `Cache-Control: no-cache`
或查询串 cache-buster 都绕不过**（实测：`git push` 后 HEAD 里 `appCount=5`，线上仍返回 3）。

含义：

- 「提交 → 在 App 市场里看到新应用」有**分钟级延迟**，这是正常的，不是 bug。
  客户端不要因此重试风暴，也不要把它诊断成推送失败。
- 客户端用 ETag / `If-None-Match` 能省流量，但**省不掉这个延迟**——缓存的是内容本身。
- 急需立刻可见时，只能等缓存过期。若这个延迟长期不可接受，选项是换托管
  （GitHub Pages 的缓存策略不同，或自建 CDN 并控制 `Cache-Control`），
  但那会失去「Git 就是数据库、零服务端」这个核心简洁性——**当前判断是不值得**。

**验证发布是否成功，看 `git log` / GitHub 网页版，不要看 raw 端点**——后者会在几分钟内骗你。

---

## 2. registry.json

```json
{
  "schemaVersion": 1,
  "name": "AiBox 官方小应用市场",
  "updatedAt": "2026-08-03T00:00:00Z",
  "appCount": 1,
  "apps": [
    {
      "appId": "com.aibox.news",
      "name": "资讯",
      "localizedNames": { "en": "News" },
      "summary": "RSS 聚合阅读器",
      "localizedSummaries": { "en": "RSS reader" },
      "icon": "newspaper.fill",
      "iconTintHex": "1E9E5A",
      "category": "information",
      "tags": ["rss", "reader"],
      "author": "AiBox",
      "latestVersion": "1.0.0",
      "latestReleasedAt": "2026-08-03T00:00:00Z",
      "minHostVersion": "1.0.0",
      "versionCount": 1,
      "capabilities": ["net", "storage", "browser", "tabs"],
      "latestTotalBytes": 84213,
      "latestFileCount": 12,
      "runtimeKind": "source",
      "path": "apps/com.aibox.news"
    }
  ]
}
```

- `schemaVersion` 只在破坏性变更时 +1；新增字段一律 optional、不改类型（与 manifest 同纪律）。
- `capabilities` 是**给用户看的能力摘要**，不是授权；真实授权仍由宿主 consent 决定。
  外壳能力从 manifest 的**静态声明键**推导：`scene.tabBar` → `tabs`、`scene.toolbar` → `toolbar`
  （`aibox.tabs` 只是运行时 API 的命名空间，manifest 里没有这个键）。
- `category` 取值：`information` / `productivity` / `tools` / `media` / `developer` / `lifestyle` / `game` / `other`。
- `appCount` 是 `apps` 的长度，冗余但便于客户端不解析全表就显示数量。
- `path` 是该应用在仓库里的相对路径，客户端据此拼后续两个端点，不要自己按 `appId` 硬拼。
- `homepage` 可选，指向应用的说明页。

### 2.2 v1.1 新增的三个字段（additive optional，老宿主忽略）

| 字段 | 含义 | 为什么在**列表**阶段就要有 |
|---|---|---|
| `latestTotalBytes` | 最新版本**解码后**的总字节 | 「装它要下多少」——放在详情页里等于用户点了安装才知道 |
| `latestFileCount` | 最新版本的文件数 | 与体积一起构成「这是个什么量级的应用」 |
| `runtimeKind` | `source` / `bundle` | `source` 会在设备上加载 296 KB 转译器再逐次转译；`bundle` 零转译。这是用户能感知的差别 |

**`runtimeKind` 写的是宿主的 `effectiveRuntimeKind`，不是本地打包判据。**
本地按「有没有 `package.json`」决定怎么打包；宿主按 manifest 的 `runtimeKind` 声明决定要不要转译，
**未声明时一律按 `source`**。索引里回落成 `source` 是如实转述宿主行为。

老宿主缺这三个字段时回落成「不显示这一行」——**不要替它猜一个数字**，
一个猜出来的体积比没有体积更糟。

- `minHostVersion` **只取最新 release 里冻结的那一份**，不回落 `app.json`。
  安装门用的是包里的 `bundle.minHostVersion`；`app.json` 后来加的要求旧包里并不存在，
  回落会让索引展示一个包里没有的要求，列表提示与实际安装判定就此不一致。

### 2.1 版本号解析：两侧规则不同

| 侧 | 对象 | 规则 |
|---|---|---|
| **包侧（严格）** | `latestVersion` / `minHostVersion` / `releases[].version` | 必须严格三段 `major.minor.patch`。非法值按 `0.0.0`，且发布脚本会直接拒绝 |
| **宿主侧（宽松）** | App 自己的 `MARKETING_VERSION` | **必须补齐到三段**：`"1.0"` → `1.0.0`、`"2"` → `2.0.0`、超三段取前三 |

这条分叉是必需的，不是随意：iOS 的 `MARKETING_VERSION` 惯例上是**两段**（当前就是 `1.0`）。
如果宿主版本也按严格三段解析，`"1.0"` 会解析失败并回落 `0.0.0`，导致**任何声明了
`minHostVersion` 的应用都被判为不兼容**。放宽必须只放宽宿主侧——放宽包侧会让写错的版本号静默通过。

## 3. releases.json

```json
{
  "schemaVersion": 1,
  "appId": "com.aibox.news",
  "latestVersion": "1.0.0",
  "releases": [
    {
      "version": "1.0.0",
      "releasedAt": "2026-08-03T00:00:00Z",
      "notes": "首个版本",
      "localizedNotes": { "en": "First release" },
      "minHostVersion": "1.0.0",
      "fileCount": 12,
      "totalBytes": 84213,
      "bundleSha256": "…",
      "path": "apps/com.aibox.news/releases/1.0.0"
    }
  ]
}
```

`releases` 按版本**倒序**（最新在前）。

### 3.1 撤回：`yanked`（v1.1，additive optional）

一条发布记录可以带 `"yanked": true` 与可选的 `"yankedReason": "…"`。
语义照抄 npm deprecate / crates.io yank：

- **字节永远留在仓库里。** 已装用户的完整性校验、诊断复现都依赖它；
  删目录是改写历史，会让「用户装的到底是哪一版」变成不可回答的问题。**撤回不是删除。**
- `latestVersion` 计算时**跳过**已撤回的版本 → 新用户不会再装到它。
- 宿主的自动更新不以它为目标。
- 详情页版本历史里**仍然列出**它并标注「已撤回」，但**不提供安装入口**（开发者模式除外——
  复现一个坏版本是它的正当用途）。列出而不可装是刻意的：已装用户必须能认出「我装的就是这一版」。
- 已经装着被撤回版本的用户会在详情页顶部看到一条明确提示（含 `yankedReason`）
  **以及两条去路**：装最新版，或回到上一版。只提示不给去路比不提示更糟。
- 撤回**不会**让已装用户自动退回。用户侧的出口是应用详情页的「回到上一版」
  （宿主 `AppletManifest.marketPreviousVersion`）。**先有回滚点，`yanked` 才有意义。**

写它的命令：`node scripts/release.mjs yank <appId> <version> --reason "…"`
（`unyank` 撤销）。它同时改 `release.json` 与 `bundle.json` —— 只改一个会让
「索引说撤回了、包里没说」，正是 `bundleSha256` 要防的那种分叉。

## 4. release.json / bundle.json

`release.json`：

```json
{
  "schemaVersion": 1,
  "appId": "com.aibox.news",
  "version": "1.0.0",
  "releasedAt": "2026-08-03T00:00:00Z",
  "notes": "首个版本",
  "minHostVersion": "1.0.0",
  "manifest": { "...": "AppletManifest 子集" },
  "files": [
    { "path": "index.html", "bytes": 3912, "sha256": "…", "encoding": "utf8" },
    { "path": "app.js", "bytes": 12043, "sha256": "…", "encoding": "utf8" },
    { "path": "assets/logo.png", "bytes": 2210, "sha256": "…", "encoding": "base64" }
  ],
  "totalBytes": 84213
}
```

`bundle.json` = `release.json` 的全部字段，外加每个文件的 `content`：

```json
{
  "...": "同 release.json",
  "files": [
    { "path": "app.js", "bytes": 12043, "sha256": "…", "encoding": "utf8", "content": "export default function App() {…}" }
  ]
}
```

- `encoding` 是 `utf8` 或 `base64`。文本文件一律 `utf8`（保持 Git diff 可读），二进制走 `base64`。
- `sha256` 对**解码后的原始字节**计算，与 encoding 无关。
- `manifest` 字段是 `src/manifest.json` 的内容，宿主安装时会补上本机 `id`、时间戳和市场归属字段。
- 当前标准工程发布的是 `dist/**` 平铺结果；`src/**/*.ts(x)` 只作为源码真值，不进入用户安装包。

## 5. 宿主安装语义

1. 拉 `bundle.json`，逐文件校验 `sha256`；任一不符 → 整包失败，不落盘。
2. 分配**本机 UUID** 作为 `manifest.id`（同 `.aiboxapplet` 导入语义），并写入市场归属：
   `marketSourceID` / `marketAppID` / `marketVersion`。
3. 权限回到 `minimumSecure`：市场包**不携带**本机 tool grant、consent 决策与 iOS 系统授权。
   `manifest.permissions.capabilities` 只表示「声明需要」，用户仍需在运行时逐项确认。
4. **更新**按 `marketAppID` 匹配已安装应用：保留本机 `id`、`data/`（`aibox.storage`、collection）
   与用户自定义图标，只替换源码与 manifest 的声明部分。
5. **降级**（安装比已装更旧的版本）允许，但需用户显式确认。
6. **回滚点**：更新时宿主记下「这次覆盖掉的是哪一版」（`marketPreviousVersion`），
   详情页据此给一个「回到 <上一版>」。协议侧不需要任何东西——它走的就是第 5 条的降级路径。
   之所以不靠「索引里比当前低一格的版本」推断：索引会因撤回 / 补发而变动，
   而用户想回到的是**他刚才还在用的那一版**。

## 6. 安全边界

- 路径必须是相对路径，禁止 `..`、前导 `/`、Windows 盘符、`.aibox/` 前缀（宿主保留目录）。
- 单文件 ≤ 2 MB，单版本 ≤ 8 MB，文件数 ≤ 500——与 `.aiboxapplet` 导入限制同量级。
- 市场源默认只有一个官方源，用户可添加自定义源；**非官方源安装时强制二次确认并标注来源**。
- `bundleSha256` 让宿主可以把「我装的到底是不是索引里那一版」钉死；索引被篡改而包未变（或反之）都能发现。

### 6.1 宿主侧的两层判据（写在这里是为了让发布侧知道自己会被怎么判）

宿主把包的问题分成**两类**，因为它们的性质完全不同：

| 类别 | 内容 | 宿主行为 |
|---|---|---|
| **越权尝试** | 路径穿越（`..`）、绝对路径 / `~` / 盘符 / 反斜杠、空路径段、`.` 段、控制字符、写 `.aibox/` 或 `.build/` | **任何来源、任何模式都硬拒。** 开发者模式没有豁免 |
| **打包 / 契约错误** | 宿主自有文件撞名、非法枚举值、缺 `index.html` / entry、体积与文件数超限、sha256 或声明字节不符、声明了本机没有的能力、`minHostVersion` 不满足 | 默认拒装；**开发者模式**下逐条列出并可由开发者显式放行 |

判据只有一条：**它是不是一次越权尝试。**
把两者混成一条的代价已经付过——`manifest.json` 与 `.tests.json` 曾被判成「试图越狱」，
分别造成「每个包都装不上」与「四个应用同时更新不了」。

发布侧的对应物是 `scripts/lib/market.mjs` 的 `relativePathError` 与 `LIMITS`；
**两侧任一改动都要同步另一侧**，否则会出现「发布脚本放行、宿主拒收」的静默分叉。
