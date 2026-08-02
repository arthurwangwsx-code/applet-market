# `aibox.navigation`

> Coordinate web history, native title, exit confirmation and edge-swipe behavior with the applet container.

**分组** 应用级外壳 ｜ **方法数** 10 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.navigation.getState()`

Read route depth, native title, confirmation copy and swipe-back policy.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{depth,url,title,closeConfirmation,closeConfirmationTitle,closeConfirmationMessage,swipeBack}`

```js
await aibox.navigation.getState()
```

### `aibox.navigation.push()`

Push one Web History route and optionally update the native title.

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `route` | string |  |  |
| `state` | object |  |  |
| `title` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `navigation state`

```js
await aibox.navigation.push({ route:'#/match', title:'Match' })
```

### `aibox.navigation.replace()`

Replace the current Web History route without increasing depth.

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `route` | string |  |  |
| `state` | object |  |  |
| `title` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `navigation state`

### `aibox.navigation.back()`

Go back one or more applet Web History entries.

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `steps` | integer |  | （最小 1、最大 100） |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

### `aibox.navigation.popToRoot()`

Return to the applet's Web History root.

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

无参数。

**返回** `boolean`

### `aibox.navigation.stateChanged()`

Synchronize browser history state with the native container.

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `depth` | integer | ✓ | （最小 0） |
| `title` | string |  |  |
| `url` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

### `aibox.navigation.setTitle()`

Set the native navigation title.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `title` | string | ✓ | （最长 120） |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

```js
await aibox.navigation.setTitle('3D Arena')
```

### `aibox.navigation.setCloseConfirmation()`

Configure a retention confirmation shown by native back/close controls.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `enabled` | boolean | ✓ |  |
| `title` | string |  | （最长 120） |
| `message` | string |  | （最长 500） |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `navigation state`

```js
await aibox.navigation.setCloseConfirmation({ enabled:true, title:'Leave match?', message:'Current progress will be lost.' })
```

### `aibox.navigation.setSwipeBack()`

Allow automatic swipe-back behavior or disable all left-edge/back-forward swipe gestures.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `policy` | `automatic` \| `disabled` | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `navigation state`

```js
await aibox.navigation.setSwipeBack('disabled')
```

### `aibox.navigation.close()`

Ask the native container to close this visible applet, honoring its configured retention confirmation.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `title` | string |  |  |
| `message` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

```js
await aibox.navigation.close()
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab；headless 下调用回 `aibox/not-visible`；`close` 另需可见运行时
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明。
- **iOS 系统授权**：无。
- **降级行为**：`getState()` 回当前 depth / 标题 / 挽留配置 / 边缘手势策略。宿主的返回与关闭出口**永远在**——页面没法把用户困住。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **大标题 / 滚动折叠头 —— P1**：目前只有固定标题。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §4。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
