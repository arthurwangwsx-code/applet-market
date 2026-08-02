# `aibox.files`

> Browse and modify the host file-box workspace through stable file tools.

**分组** 系统能力投影 ｜ **方法数** 17 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"files"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

本命名空间由 `HostToolProjectionCapabilityAdapter` 把宿主 AgentTool 升格而成：参数 schema 直接取真实
`ToolDefinition`，执行仍走同一个 ToolRunner（consent、超时、系统权限一个都不少）。
**宿主没装对应模块时，整条命名空间不注册**——不会广告假能力。

| 方法 | 背后的宿主工具 | 档位 |
|---|---|---|
| `boxes` | `fs_boxes` | `read` |
| `list` | `fs_list` | `read` |
| `read` | `fs_read` | `read` |
| `readBinary` | `fs_read_binary` | `read` |
| `stat` | `fs_stat` | `read` |
| `search` | `fs_search` | `read` |
| `tree` | `fs_tree` | `read` |
| `glob` | `fs_glob` | `read` |
| `write` | `fs_write` | `localWrite` |
| `writeBinary` | `fs_write_binary` | `localWrite` |
| `append` | `fs_append` | `localWrite` |
| `createDirectory` | `fs_create_dir` | `localWrite` |
| `transfer` | `fs_transfer` | `localWrite` |
| `delete` | `fs_delete` | `localWrite` |
| `createBox` | `fs_create_box` | `localWrite` |
| `renameBox` | `fs_rename_box` | `localWrite` |
| `describeBox` | `fs_describe_box` | `read` |

### `aibox.files.boxes()`

投影自宿主工具 `fs_boxes`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `fs_boxes` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.list()`

投影自宿主工具 `fs_list`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `fs_list` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.read()`

投影自宿主工具 `fs_read`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `fs_read` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.readBinary()`

投影自宿主工具 `fs_read_binary`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `fs_read_binary` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.stat()`

投影自宿主工具 `fs_stat`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `fs_stat` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.search()`

投影自宿主工具 `fs_search`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `fs_search` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.tree()`

投影自宿主工具 `fs_tree`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `fs_tree` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.glob()`

投影自宿主工具 `fs_glob`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `fs_glob` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.write()`

投影自宿主工具 `fs_write`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `fs_write` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.writeBinary()`

投影自宿主工具 `fs_write_binary`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `fs_write_binary` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.append()`

投影自宿主工具 `fs_append`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `fs_append` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.createDirectory()`

投影自宿主工具 `fs_create_dir`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `fs_create_dir` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.transfer()`

投影自宿主工具 `fs_transfer`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `fs_transfer` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.delete()`

投影自宿主工具 `fs_delete`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `fs_delete` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.createBox()`

投影自宿主工具 `fs_create_box`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `fs_create_box` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.renameBox()`

投影自宿主工具 `fs_rename_box`；摘要与参数以该工具的真实定义为准。

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

参数取自宿主工具 `fs_rename_box` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.files.describeBox()`

投影自宿主工具 `fs_describe_box`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `fs_describe_box` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/HostToolProjectionCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab；headless 下多数只读方法可用，需要前台的方法回 `aibox/not-visible`
- **宿主变体**：Full ✅ ／ Lean ⚠️ 取决于壳是否装了文件箱模块
- **manifest 声明**：需声明；且**宿主必须真的装了对应模块**——工具不在场时整条命名空间不注册。
- **iOS 系统授权**：无（访问的是 App 内的文件箱工作区，不是系统文件系统）。
- **降级行为**：用 `await aibox.capabilities()` 看命名空间在不在（不在 = 宿主没这个模块），不在就别渲染入口。调用不存在的命名空间回 `aibox/not-granted` 或 `aibox/unavailable`。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
