# `aibox.access`

> Explain the effective permission decision for a native capability or host tool.

**分组** 容器内建 ｜ **方法数** 2 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.access.summary()`

Return this applet's effective permission profile and bridge protocol version.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{protocol, tier, developerFullAccess, declaredCapabilities, toolRequirements}`

```js
await aibox.access.summary()
```

### `aibox.access.explain()`

Explain exactly which permission gate allows or blocks a capability or host tool.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `tool` | string |  |  |
| `capability` | string |  |  |
| `method` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{target, allowed, code, failedGate, gates, remedies}`

```js
await aibox.access.explain({ tool: 'health_metric' })
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明。
- **iOS 系统授权**：无。
- **降级行为**：恒在场，无降级分支。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。

这条能力本身就是给「能力缺席」排错用的：任何一次 `aibox/not-granted` 之后，用 `aibox.access.explain({ capability, method })` 能拿到具体被哪一道门挡住以及补救办法。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
