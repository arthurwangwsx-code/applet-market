# 小应用市场协议 v1

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

---

## 2. registry.json

```json
{
  "schemaVersion": 1,
  "name": "AiBox 官方小应用市场",
  "updatedAt": "2026-08-03T00:00:00Z",
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
      "path": "apps/com.aibox.news"
    }
  ]
}
```

- `schemaVersion` 只在破坏性变更时 +1；新增字段一律 optional、不改类型（与 manifest 同纪律）。
- `capabilities` 是**给用户看的能力摘要**，不是授权；真实授权仍由宿主 consent 决定。
- `category` 取值：`information` / `productivity` / `tools` / `media` / `developer` / `lifestyle` / `game` / `other`。

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
    { "path": "app.jsx", "bytes": 12043, "sha256": "…", "encoding": "utf8" },
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
    { "path": "app.jsx", "bytes": 12043, "sha256": "…", "encoding": "utf8", "content": "export default function App() {…}" }
  ]
}
```

- `encoding` 是 `utf8` 或 `base64`。文本文件一律 `utf8`（保持 Git diff 可读），二进制走 `base64`。
- `sha256` 对**解码后的原始字节**计算，与 encoding 无关。
- `manifest` 字段是 `src/manifest.json` 的内容，宿主安装时会补上本机 `id`、时间戳和市场归属字段。

## 5. 宿主安装语义

1. 拉 `bundle.json`，逐文件校验 `sha256`；任一不符 → 整包失败，不落盘。
2. 分配**本机 UUID** 作为 `manifest.id`（同 `.aiboxapplet` 导入语义），并写入市场归属：
   `marketSourceID` / `marketAppID` / `marketVersion`。
3. 权限回到 `minimumSecure`：市场包**不携带**本机 tool grant、consent 决策与 iOS 系统授权。
   `manifest.permissions.capabilities` 只表示「声明需要」，用户仍需在运行时逐项确认。
4. **更新**按 `marketAppID` 匹配已安装应用：保留本机 `id`、`data/`（`aibox.storage`、collection）
   与用户自定义图标，只替换源码与 manifest 的声明部分。
5. **降级**（安装比已装更旧的版本）允许，但需用户显式确认。

## 6. 安全边界

- 路径必须是相对路径，禁止 `..`、前导 `/`、Windows 盘符、`.aibox/` 前缀（宿主保留目录）。
- 单文件 ≤ 2 MB，单版本 ≤ 8 MB，文件数 ≤ 500——与 `.aiboxapplet` 导入限制同量级。
- 市场源默认只有一个官方源，用户可添加自定义源；**非官方源安装时强制二次确认并标注来源**。
- `bundleSha256` 让宿主可以把「我装的到底是不是索引里那一版」钉死；索引被篡改而包未变（或反之）都能发现。
