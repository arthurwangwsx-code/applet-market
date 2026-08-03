# `aibox.voiceMemos`

> Remote-control the host Voice Memos module: browse, transcribe and analyze entries in the USER'S OWN memo library. CHOOSING BETWEEN aibox.voiceMemos AND aibox.audio — ask one question: should the result show up in the user's own Voice Memos library? If yes, use this namespace. If no, use aibox.audio instead: recordStart here opens the host's full-screen recorder ON TOP of your applet and files the result into the user's library (they end up with junk entries they never asked for), and you get back neither the audio bytes nor a live level meter. This whole namespace is a projection of a host module — it reports unavailable on builds where that module is not installed, whereas aibox.audio is always present.

**分组** 系统能力投影 ｜ **方法数** 21 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"voiceMemos"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

本命名空间由 `HostToolProjectionCapabilityAdapter` 把宿主 AgentTool 升格而成：参数 schema 直接取真实
`ToolDefinition`，执行仍走同一个 ToolRunner（consent、超时、系统权限一个都不少）。
**宿主没装对应模块时，整条命名空间不注册**——不会广告假能力。

| 方法 | 背后的宿主工具 | 档位 |
|---|---|---|
| `list` | `memo_list` | `read` |
| `get` | `memo_get` | `read` |
| `recordStart` | `memo_record_start` | `presentation` |
| `recordControl` | `memo_record_control` | `localWrite` |
| `recordStatus` | `memo_record_status` | `read` |
| `transcribe` | `memo_transcribe` | `meta` |
| `transcript` | `memo_get_transcript` | `read` |
| `play` | `memo_play` | `localWrite` |
| `stop` | `memo_stop_playback` | `localWrite` |
| `seek` | `memo_seek` | `localWrite` |
| `waveform` | `memo_waveform` | `read` |
| `import` | `memo_import` | `localWrite` |
| `rename` | `memo_rename` | `localWrite` |
| `delete` | `memo_delete` | `localWrite` |
| `move` | `memo_move` | `localWrite` |
| `favourite` | `memo_toggle_favourite` | `localWrite` |
| `summarize` | `memo_summarize` | `external` |
| `actionItems` | `memo_get_action_items` | `external` |
| `ask` | `memo_ask` | `external` |
| `cleanTranscript` | `memo_clean_transcript` | `external` |
| `chapters` | `memo_get_chapters` | `external` |

### `aibox.voiceMemos.list()`

投影自宿主工具 `memo_list`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `memo_list` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.get()`

投影自宿主工具 `memo_get`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `memo_get` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.recordStart()`

投影自宿主工具 `memo_record_start`；摘要与参数以该工具的真实定义为准。

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

参数取自宿主工具 `memo_record_start` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.recordControl()`

投影自宿主工具 `memo_record_control`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `memo_record_control` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.recordStatus()`

投影自宿主工具 `memo_record_status`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `memo_record_status` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.transcribe()`

投影自宿主工具 `memo_transcribe`；摘要与参数以该工具的真实定义为准。

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

参数取自宿主工具 `memo_transcribe` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.transcript()`

投影自宿主工具 `memo_get_transcript`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `memo_get_transcript` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.play()`

投影自宿主工具 `memo_play`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `memo_play` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.stop()`

投影自宿主工具 `memo_stop_playback`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `memo_stop_playback` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.seek()`

投影自宿主工具 `memo_seek`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `memo_seek` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.waveform()`

投影自宿主工具 `memo_waveform`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `memo_waveform` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.import()`

投影自宿主工具 `memo_import`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `memo_import` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.rename()`

投影自宿主工具 `memo_rename`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `memo_rename` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.delete()`

投影自宿主工具 `memo_delete`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `memo_delete` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.move()`

投影自宿主工具 `memo_move`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `memo_move` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.favourite()`

投影自宿主工具 `memo_toggle_favourite`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `memo_toggle_favourite` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.summarize()`

投影自宿主工具 `memo_summarize`；摘要与参数以该工具的真实定义为准。

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

参数取自宿主工具 `memo_summarize` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.actionItems()`

投影自宿主工具 `memo_get_action_items`；摘要与参数以该工具的真实定义为准。

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

参数取自宿主工具 `memo_get_action_items` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.ask()`

投影自宿主工具 `memo_ask`；摘要与参数以该工具的真实定义为准。

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

参数取自宿主工具 `memo_ask` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.cleanTranscript()`

投影自宿主工具 `memo_clean_transcript`；摘要与参数以该工具的真实定义为准。

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

参数取自宿主工具 `memo_clean_transcript` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.voiceMemos.chapters()`

投影自宿主工具 `memo_get_chapters`；摘要与参数以该工具的真实定义为准。

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

参数取自宿主工具 `memo_get_chapters` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/HostToolProjectionCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab；headless 下多数只读方法可用，需要前台的方法回 `aibox/not-visible`
- **宿主变体**：Full ✅ ／ Lean ⚠️ 取决于壳是否装了语音备忘模块
- **manifest 声明**：需声明；且**宿主必须真的装了对应模块**——工具不在场时整条命名空间不注册。
- **iOS 系统授权**：录音需要麦克风授权；转写与 AI 分析另经模型能力，可能受 AI 配额限制。
- **降级行为**：用 `await aibox.capabilities()` 看命名空间在不在（不在 = 宿主没这个模块），不在就别渲染入口。调用不存在的命名空间回 `aibox/not-granted` 或 `aibox/unavailable`。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
