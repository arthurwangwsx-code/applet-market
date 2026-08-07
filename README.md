# AiBox 小应用市场（applet-market）

这是 AiBox「小应用（Applet）」的**分发仓库**。它是一个纯静态的 Git 仓库：源码是单一真值，
发布产物由脚本生成，iOS 端通过 HTTP 直接读取仓库里的 JSON 文件完成浏览、下载、安装与更新。

- **写新应用先读**：[docs/authoring-guide.md](docs/authoring-guide.md)
- 协议规范：[docs/market-protocol.md](docs/market-protocol.md)
- 宿主实现：`AiBox/Packages/AppletPluginKit/Sources/AppletPluginKit/Market/`
- 宿主方案文档：`AiBox/docs/capabilities/applet/market.md`

## 目录约定

```
registry.json                       # 市场索引（查询列表）——生成物
apps/<appId>/
  app.json                          # 应用元数据（手写）
  package.json                      # TypeScript / 构建脚本
  tsconfig.json                     # 继承 @aibox/applet-tsbuild
  src/                              # 源码，单一真值（手写，直接 commit）
    manifest.json                   # AppletManifest 子集
    app.tsx                         # React 入口（export default App）
    .tests.json                     # 应用自带的 smoke 验收
    ...
  dist/                             # 保结构多文件 ESM（生成并签入）
  releases.json                     # 版本索引（查询发布版本）——生成物
  releases/<version>/
    release.json                    # 版本元数据 + 文件清单 + sha256——生成物
    bundle.json                     # 一次请求装完的完整包——生成物
```

`appId` 用反向域名（`com.aibox.news`），全仓库唯一且**永不变更**——它是宿主判断
「已安装 / 有更新」的稳定键。

## 日常流程

```bash
# 1. 新建一个应用骨架
node scripts/new-app.mjs com.aibox.weather --name "天气" --icon cloud.sun.fill

# 2. 安装 workspace 依赖并构建
npm install
npm run typecheck --prefix apps/com.aibox.weather
npm run build --prefix apps/com.aibox.weather

# 3. 提交前统一验证（格式、类型、合同、构建漂移、包体与发布冒烟）
npm run verify

# 4. 发布一个版本（生成 releases/<version>/ 并刷新索引）
node scripts/release.mjs com.aibox.news 1.0.0 --notes "首个版本"

# 5. 只暂存本次应用与生成索引，再提交/推送
```

`release.mjs` 会自动 typecheck、构建、validate，并在结尾重建 `registry.json`。SDK 的运行时实现由宿主以
`aibox-sdk.mjs` 单实例提供，小应用源码仍 import `@aibox/applet-sdk` 获取稳定 API 与类型。

## 版本纪律

- 版本号是 **semver**（`MAJOR.MINOR.PATCH`）。
- 已发布的 `releases/<version>/` 是**不可变**的：改代码要发新版本，不要改旧目录。
- `minHostVersion` 声明这个版本依赖的宿主能力底线（例如用了 `aibox.tabs` 需要宿主 ≥ 该版本）；
  宿主低于它时市场只展示、不允许安装。
- 每个文件都带 `sha256`；宿主安装时逐文件校验，不匹配即整包失败，不会装进半个应用。

## 校验闸门

`npm run verify` 是本地和 CI 的统一硬闸门。`validate.mjs` 只是其中的包结构分区，不能代替全量验证。

| 项 | 规则 |
|---|---|
| appId | 反向域名、与目录名一致、全局唯一 |
| manifest | 必填字段齐全、能力命名空间在已知集合内、securityMode 合法 |
| 版本 | semver、releases.json 单调、已发布版本内容未被篡改（sha256 复核） |
| import | 构建器 / 市场 / 宿主 Swift 的运行时模块合同逐条相等 |
| 类型 | 应用源码全量 TS/TSX；构建器与审计共同拒绝 JS、显式 `any` 和类型绕过指令 |
| SDK/UI | SDK 类型与宿主能力、`aibox/ui` 类型与运行时导出不得漂移 |
| 体积/性能 | 协议绝对上限 + 每应用包体基线；常驻 timer/rAF/无限动画只减不增 |
| 路径 | 禁止 `..`、绝对路径、符号链接 |
