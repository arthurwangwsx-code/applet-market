# `aibox.shortcuts`

> Run or open Apple Shortcuts from a visible applet.

**分组** 系统能力投影 ｜ **方法数** 2 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"shortcuts"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

本命名空间由 `HostToolProjectionCapabilityAdapter` 把宿主 AgentTool 升格而成：参数 schema 直接取真实
`ToolDefinition`，执行仍走同一个 ToolRunner（consent、超时、系统权限一个都不少）。
**宿主没装对应模块时，整条命名空间不注册**——不会广告假能力。

| 方法 | 背后的宿主工具 | 档位 |
|---|---|---|
| `run` | `shortcut_run` | `presentation` |
| `open` | `shortcut_open` | `presentation` |

### `aibox.shortcuts.run()`

投影自宿主工具 `shortcut_run`；摘要与参数以该工具的真实定义为准。

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

参数取自宿主工具 `shortcut_run` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.shortcuts.open()`

投影自宿主工具 `shortcut_open`；摘要与参数以该工具的真实定义为准。

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

参数取自宿主工具 `shortcut_open` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/HostToolProjectionCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab；headless 下多数只读方法可用，需要前台的方法回 `aibox/not-visible`
- **宿主变体**：Full ✅ ／ Lean ⚠️ 取决于壳是否装了快捷指令模块
- **manifest 声明**：需声明；且**宿主必须真的装了对应模块**——工具不在场时整条命名空间不注册。
- **iOS 系统授权**：无，但运行快捷指令会**切出 App**。
- **降级行为**：用 `await aibox.capabilities()` 看命名空间在不在（不在 = 宿主没这个模块），不在就别渲染入口。调用不存在的命名空间回 `aibox/not-granted` 或 `aibox/unavailable`。 两个方法都是 `presentation` 档位，需要可见运行时。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
