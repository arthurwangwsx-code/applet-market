# `aibox.apps`

> Discover and invoke declared actions on installed applets without changing the host tool registry.

**分组** 容器内建 ｜ **方法数** 4 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.apps.list()`

List installed applets and their declared action names.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{id,name,icon,summary,actions:string[]}[]`

```js
await aibox.apps.list()
```

### `aibox.apps.describe()`

Read one applet's action/event contract.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `app` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{id,name,summary,actions,events}`

### `aibox.apps.invoke()`

Headlessly invoke a registered action on another applet.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `app` | string | ✓ | Applet id or name. |
| `action` | string | ✓ |  |
| `input` | any |  |  |
| `waitMs` | integer |  | （最小 300、最大 6000） |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{appId,action,result}`

```js
await aibox.apps.invoke({ app:'expense-manager', action:'addExpense', input:{amount:35} })
```

### `aibox.apps.emit()`

Publish one event declared by the current applet and run matching event automations.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `event` | string | ✓ |  |
| `payload` | any |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{event,accepted,automationsRun}`

```js
await aibox.apps.emit({ event:'expenseAdded', payload:{id} })
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/AppsCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**；但调用一个**非 headless** 的目标 action 需要可见运行时，否则回 `aibox/not-visible`
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明（调用型方法仍会走一次授权确认）。
- **iOS 系统授权**：无。
- **降级行为**：只能发现和调用**已安装且显式声明了 action** 的其它小应用。目标不在或没声明该 action 时回错误码，不会静默成功。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
