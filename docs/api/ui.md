# `aibox.ui`

> Present native alerts, confirmations, prompts and action sheets from a visible applet.

**分组** 应用级外壳 ｜ **方法数** 4 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"ui"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.ui.alert()`

Show a native alert and resolve when the user dismisses it.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `title` | string |  |  |
| `message` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{actionId, value, cancelled}`

```js
await aibox.ui.alert({ title: 'Saved', message: 'Your changes were stored.' })
```

### `aibox.ui.confirm()`

Show a native confirmation dialog.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `title` | string |  |  |
| `message` | string |  |  |
| `actions` | object[] |  | （最多 8 项） |
| `actions[].id` | string | ✓ |  |
| `actions[].title` | string | ✓ |  |
| `actions[].role` | `default` \| `cancel` \| `destructive` |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{actionId, value, cancelled}`

```js
await aibox.ui.confirm({ title: 'Delete?', actions: [{id:'cancel',title:'Cancel',role:'cancel'},{id:'delete',title:'Delete',role:'destructive'}] })
```

### `aibox.ui.prompt()`

Show a native text prompt.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `title` | string |  |  |
| `message` | string |  |  |
| `placeholder` | string |  |  |
| `defaultValue` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{actionId, value:string|null, cancelled}`

```js
await aibox.ui.prompt({ title: 'Name', placeholder: 'Project name' })
```

### `aibox.ui.actionSheet()`

Show a native action sheet with up to eight actions.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `title` | string |  |  |
| `message` | string |  |  |
| `actions` | object[] | ✓ | （最多 8 项） |
| `actions[].id` | string | ✓ |  |
| `actions[].title` | string | ✓ |  |
| `actions[].role` | `default` \| `cancel` \| `destructive` |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{actionId, value, cancelled}`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：需要可见运行时；headless 下回 `aibox/not-visible`
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：需声明 `"ui"`（会呈现原生界面，不属于恒可发现的内核）。
- **iOS 系统授权**：无。
- **降级行为**：拿不到时用 Web 侧弹框兜底。注意 antd-mobile 的 `Toast.show` 在本宿主下**渲染为空**，要弹提示请用 `Dialog.alert` 或本命名空间的原生弹框。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **长按上下文菜单 —— P0，未落地**：原生长按菜单挂在 Web DOM 行上，需要「Web 登记行矩形 + 宿主叠透明手势层」的方案。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §3.1。
- **列表行滑动操作 —— P0，未落地**：同上。
- **原生下拉刷新 —— P0 之后**：当前 Web 自绘可用，优先级低于前两条。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §3.1。
- **虚拟长列表 —— P0，未落地**：几千行时 Web 自绘会掉帧，规划中由框架统一提供而不是每个应用重写。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §3.2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
