# AiBox 小应用市场（applet-market）

这是 AiBox「小应用（Applet）」的**分发仓库**。它是一个纯静态的 Git 仓库：源码是单一真值，
发布产物由脚本生成，iOS 端通过 HTTP 直接读取仓库里的 JSON 文件完成浏览、下载、安装与更新。

- 协议规范：[docs/market-protocol.md](docs/market-protocol.md)
- 宿主实现：`AiBox/Packages/AppletPluginKit/Sources/AppletPluginKit/Market/`
- 宿主方案文档：`AiBox/docs/capabilities/applet/market.md`

## 目录约定

```
registry.json                       # 市场索引（查询列表）——生成物
apps/<appId>/
  app.json                          # 应用元数据（手写）
  src/                              # 源码，单一真值（手写，直接 commit）
    manifest.json                   # AppletManifest 子集
    app.jsx                         # React 入口（export default App）
    ...
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

# 2. 在 apps/<appId>/src/ 里写代码（AiBox App 内的小应用工作台也可以直接改这里）

# 3. 校验（manifest / 能力声明 / import 白名单 / 文件大小）
node scripts/validate.mjs

# 4. 发布一个版本（生成 releases/<version>/ 并刷新索引）
node scripts/release.mjs com.aibox.news 1.0.0 --notes "首个版本"

# 5. 提交
git add -A && git commit -m "release(news): 1.0.0" && git push
```

`release.mjs` 会自动跑一次 `validate`，并在结尾重建 `registry.json`。

## 版本纪律

- 版本号是 **semver**（`MAJOR.MINOR.PATCH`）。
- 已发布的 `releases/<version>/` 是**不可变**的：改代码要发新版本，不要改旧目录。
- `minHostVersion` 声明这个版本依赖的宿主能力底线（例如用了 `aibox.tabs` 需要宿主 ≥ 该版本）；
  宿主低于它时市场只展示、不允许安装。
- 每个文件都带 `sha256`；宿主安装时逐文件校验，不匹配即整包失败，不会装进半个应用。

## 校验闸门

`scripts/validate.mjs` 是提交前的硬闸门，检查：

| 项 | 规则 |
|---|---|
| appId | 反向域名、与目录名一致、全局唯一 |
| manifest | 必填字段齐全、能力命名空间在已知集合内、securityMode 合法 |
| 版本 | semver、releases.json 单调、已发布版本内容未被篡改（sha256 复核） |
| import | 只允许离线白名单裸模块（react / react-dom / antd-mobile / chart.js） |
| 体积 | 单文件 ≤ 2 MB，单版本 ≤ 8 MB，单应用文件数 ≤ 500 |
| 路径 | 禁止 `..`、绝对路径、符号链接 |
