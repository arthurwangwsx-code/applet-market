# `aibox.jobs`

> Persistent applet automations executed through short-lived headless action runtimes.

**分组** 容器内建 ｜ **方法数** 6 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.jobs.list()`

List this applet's automations and last run status.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `Automation[]`

**返回类型** `Array<{ action: string; catchUpWindowSeconds?: number; consecutiveFailures?: number; createdAt: string; enabled: boolean; id: string; inputJSON?: string; lastError?: string; lastInvocationID?: string; lastResultJSON?: string; lastRunAt?: string; lastSkipReason?: string; lastSkippedAt?: string; leaseUntil?: string; name?: string; nextRetryAt?: string; pendingOccurrenceID?: string; trigger: { at?: string; event?: string; hour?: number; intervalSeconds?: number; kind: "once" | "interval" | "daily" | "event" | "appLaunch" | "appForeground" | "appletOpen"; minute?: number }; updatedAt: string }>`

```js
await aibox.jobs.list()
```

### `aibox.jobs.register()`

Create or update an automation.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `id` | string |  |  |
| `name` | string |  |  |
| `action` | string | ✓ |  |
| `input` | any |  |  |
| `enabled` | boolean |  |  |
| `trigger` | object | ✓ |  |
| `trigger.kind` | `once` \| `interval` \| `daily` \| `event` \| `appLaunch` \| `appForeground` \| `appletOpen` | ✓ |  |
| `trigger.at` | string |  | ISO8601 for once. |
| `trigger.intervalSeconds` | integer |  | （最小 60） |
| `trigger.hour` | integer |  | （最小 0、最大 23） |
| `trigger.minute` | integer |  | （最小 0、最大 59） |
| `trigger.event` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `Automation`

**返回类型** `{ action: string; catchUpWindowSeconds?: number; consecutiveFailures?: number; createdAt: string; enabled: boolean; id: string; inputJSON?: string; lastError?: string; lastInvocationID?: string; lastResultJSON?: string; lastRunAt?: string; lastSkipReason?: string; lastSkippedAt?: string; leaseUntil?: string; name?: string; nextRetryAt?: string; pendingOccurrenceID?: string; trigger: { at?: string; event?: string; hour?: number; intervalSeconds?: number; kind: "once" | "interval" | "daily" | "event" | "appLaunch" | "appForeground" | "appletOpen"; minute?: number }; updatedAt: string }`

```js
await aibox.jobs.register({ name:'Nightly summary', action:'summarizeDay', trigger:{kind:'daily',hour:20,minute:0} })
```

### `aibox.jobs.remove()`

Remove one automation.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `id` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

**返回类型** `boolean`

### `aibox.jobs.run()`

Run one automation immediately.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `id` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

**返回类型** `boolean`

### `aibox.jobs.runDue()`

Run every currently due automation for this applet.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `{count:number}`

**返回类型** `{ count: number }`

### `aibox.jobs.next()`

Read the next calculable due time for every enabled automation.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{id,nextAt:string|null}[]`

**返回类型** `Array<{ id: string; nextAt: string | unknown }>`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/JobsCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**——本能力就是为无头/后台设计的
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明（注册型方法仍会走一次授权确认）。
- **iOS 系统授权**：无。
- **降级行为**：iOS 不保证后台执行时机：任务是**声明 + 补跑**语义，不是精确定时器。别把「必须准点」的逻辑架在上面。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
