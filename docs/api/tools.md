# `aibox.tools`

> Discover and call the app's active AI tools through the same permission and audit pipeline used by the assistant.

**分组** 长尾工具网关 ｜ **方法数** 5 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"tools"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.tools.list()`

List the tools this applet may call.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `limit` | integer |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `ToolSummary[]`

```js
await aibox.tools.list({ limit: 50 })
```

### `aibox.tools.search()`

Search allowed tools by capability or task.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `query` | string | ✓ |  |
| `limit` | integer |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `ToolSummary[]`

```js
await aibox.tools.search({ query: 'calendar create' })
```

### `aibox.tools.describe()`

Get one tool's full description and JSON Schema.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `name` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `ToolDefinition`

```js
await aibox.tools.describe({ name: 'calendar_create' })
```

### `aibox.tools.call()`

Call one allowed active tool.

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `name` | string | ✓ |  |
| `arguments` | object |  |  |
| `argumentsJSON` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `ToolCallResult`

```js
await aibox.tools.call({ name: 'calendar_create', arguments: { title: 'Review', start: '2026-07-21T10:00:00+08:00', end: '2026-07-21T10:30:00+08:00' } })
```

### `aibox.tools.callBatch()`

Call up to eight tools and return results in order.

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `calls` | object[] | ✓ | （最多 8 项） |
| `calls[].name` | string | ✓ |  |
| `calls[].arguments` | object |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `ToolCallResult[]`

```js
await aibox.tools.callBatch({ calls: [{ name: 'weather_current', arguments: {} }] })
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/AgentToolsCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**；具体某个工具可能自带前台要求，那时回 `aibox/not-visible`
- **宿主变体**：Full ✅ ／ Lean ⚠️ 可见的工具集合随壳装了哪些模块而变
- **manifest 声明**：需声明 `"tools"`，**并且**要在 manifest 的工具需求里列出精确工具名——没有「全部工具」这种授权。
- **iOS 系统授权**：随被调用的工具而定。
- **降级行为**：`list` / `search` 只会回**当前 active 且允许桥接**的工具，所以「搜不到」就是真的没有。递归、记忆、子 Agent、`ask_user` 等入口结构性禁止，永远不会出现。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- 设计上**故意不扩张**：只有高频、跨模板、能显著降低 AI 编码错误率的能力才升格为一等 `aibox.*` API，其余长尾一律留在这个网关，避免平台 API 无限膨胀。见主仓库 `docs/capabilities/applet/platform-protocol.md` §4.3。
- 如果你发现自己反复经网关调同一个工具，那大概率是一条该被升格的能力——值得提一个宿主侧的需求。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
