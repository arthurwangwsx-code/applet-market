# `aibox.location`

> Read location, geocode places and manage geofences through the host location module.

**分组** 系统能力投影 ｜ **方法数** 6 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"location"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

本命名空间由 `HostToolProjectionCapabilityAdapter` 把宿主 AgentTool 升格而成：参数 schema 直接取真实
`ToolDefinition`，执行仍走同一个 ToolRunner（consent、超时、系统权限一个都不少）。
**宿主没装对应模块时，整条命名空间不注册**——不会广告假能力。

| 方法 | 背后的宿主工具 | 档位 |
|---|---|---|
| `current` | `whereabouts_current` | `read` |
| `placemark` | `whereabouts_placemark` | `read` |
| `permission` | `whereabouts_permission` | `read` |
| `geocode` | `whereabouts_geocode` | `read` |
| `places` | `whereabouts_places` | `meta` |
| `geofence` | `whereabouts_geofence` | `meta` |

### `aibox.location.current()`

投影自宿主工具 `whereabouts_current`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `whereabouts_current` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

```js
await aibox.location.current({})
```

### `aibox.location.placemark()`

投影自宿主工具 `whereabouts_placemark`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `whereabouts_placemark` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.location.permission()`

投影自宿主工具 `whereabouts_permission`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `whereabouts_permission` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.location.geocode()`

投影自宿主工具 `whereabouts_geocode`；摘要与参数以该工具的真实定义为准。

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

参数取自宿主工具 `whereabouts_geocode` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.location.places()`

投影自宿主工具 `whereabouts_places`；摘要与参数以该工具的真实定义为准。

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

参数取自宿主工具 `whereabouts_places` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

### `aibox.location.geofence()`

投影自宿主工具 `whereabouts_geofence`；摘要与参数以该工具的真实定义为准。

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

参数取自宿主工具 `whereabouts_geofence` 的真实 `ToolDefinition.parametersJSON`，随宿主版本变化。
写代码前用 `await aibox.capabilities()` 或 `applet_read action=capabilities` 读当前 schema。

**返回** `{ok, text, permission, details?, progress, artifacts}`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/HostToolProjectionCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab；headless 下多数只读方法可用，需要前台的方法回 `aibox/not-visible`
- **宿主变体**：Full ✅ ／ Lean ⚠️ 取决于壳是否装了位置模块
- **manifest 声明**：需声明；且**宿主必须真的装了对应模块**——工具不在场时整条命名空间不注册。
- **iOS 系统授权**：需要定位授权；`geofence` 还需「始终允许」。
- **降级行为**：用 `await aibox.capabilities()` 看命名空间在不在（不在 = 宿主没这个模块），不在就别渲染入口。调用不存在的命名空间回 `aibox/not-granted` 或 `aibox/unavailable`。 `permission` 方法可以在不触发定位的前提下先查授权状态。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
