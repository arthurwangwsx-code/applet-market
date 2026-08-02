# `aibox.music`

> Search, browse and control Apple Music or local playback through the host music engine.

**分组** 系统能力投影 ｜ **方法数** 19 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"music"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

本命名空间由 `HostToolProjectionCapabilityAdapter` 把宿主 AgentTool 升格而成：参数 schema 直接取真实
`ToolDefinition`，执行仍走同一个 ToolRunner（consent、超时、系统权限一个都不少）。
**宿主没装对应模块时，整条命名空间不注册**——不会广告假能力。

| 方法 | 背后的宿主工具 | 档位 |
|---|---|---|
| `search` | `music_search` | `read` |
| `play` | `music_play` | `localWrite` |
| `transport` | `music_transport` | `localWrite` |
| `status` | `music_status` | `read` |
| `queue` | `music_queue` | `meta` |
| `album` | `music_album` | `read` |
| `get` | `music_get` | `read` |
| `library` | `music_library` | `meta` |
| `local` | `music_local` | `read` |
| `lyrics` | `music_lyrics` | `read` |
| `seek` | `music_seek` | `localWrite` |
| `volume` | `music_set_volume` | `localWrite` |
| `repeat` | `music_set_repeat` | `localWrite` |
| `shuffle` | `music_set_shuffle` | `localWrite` |
| `sleepTimer` | `music_sleep_timer` | `localWrite` |
| `recommendations` | `music_recommendations` | `read` |
| `effects` | `music_effects` | `meta` |
| `playlist` | `music_playlist` | `meta` |
| `deletePlaylist` | `music_playlist_delete` | `localWrite` |

### `aibox.music.search()`

投影自宿主工具 `music_search`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `music_search` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.play()`

投影自宿主工具 `music_play`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `music_play` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.transport()`

投影自宿主工具 `music_transport`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `music_transport` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.status()`

投影自宿主工具 `music_status`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `music_status` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.queue()`

投影自宿主工具 `music_queue`；摘要与参数以该工具的真实定义为准。

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

参数取自宿主工具 `music_queue` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.album()`

投影自宿主工具 `music_album`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `music_album` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.get()`

投影自宿主工具 `music_get`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `music_get` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.library()`

投影自宿主工具 `music_library`；摘要与参数以该工具的真实定义为准。

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

参数取自宿主工具 `music_library` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.local()`

投影自宿主工具 `music_local`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `music_local` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.lyrics()`

投影自宿主工具 `music_lyrics`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `music_lyrics` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.seek()`

投影自宿主工具 `music_seek`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `music_seek` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.volume()`

投影自宿主工具 `music_set_volume`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `music_set_volume` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.repeat()`

投影自宿主工具 `music_set_repeat`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `music_set_repeat` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.shuffle()`

投影自宿主工具 `music_set_shuffle`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `music_set_shuffle` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.sleepTimer()`

投影自宿主工具 `music_sleep_timer`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `music_sleep_timer` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.recommendations()`

投影自宿主工具 `music_recommendations`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `music_recommendations` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.effects()`

投影自宿主工具 `music_effects`；摘要与参数以该工具的真实定义为准。

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

参数取自宿主工具 `music_effects` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.playlist()`

投影自宿主工具 `music_playlist`；摘要与参数以该工具的真实定义为准。

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

参数取自宿主工具 `music_playlist` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.music.deletePlaylist()`

投影自宿主工具 `music_playlist_delete`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `music_playlist_delete` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/HostToolProjectionCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab；headless 下多数只读方法可用，需要前台的方法回 `aibox/not-visible`
- **宿主变体**：Full ✅ ／ Lean ⚠️ 取决于壳是否装了音乐模块
- **manifest 声明**：需声明；且**宿主必须真的装了对应模块**——工具不在场时整条命名空间不注册。
- **iOS 系统授权**：本地播放无需授权；Apple Music 内容需要媒体资料库授权与有效订阅。
- **降级行为**：用 `await aibox.capabilities()` 看命名空间在不在（不在 = 宿主没这个模块），不在就别渲染入口。调用不存在的命名空间回 `aibox/not-granted` 或 `aibox/unavailable`。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **`aibox.music.*` 的四个覆盖缺口** 见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §3.6.1。
- **架构裁决：小应用不得自持媒体引擎** —— 播放一律经本命名空间，不要在应用里自建播放器（自建的那个必然在锁屏、来电打断、与聊天朗读抢音频会话这些地方出问题）。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §3.6。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
