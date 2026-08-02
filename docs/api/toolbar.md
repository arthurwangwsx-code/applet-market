# `aibox.toolbar`

> Navigation-bar buttons and the search field declared by manifest.scene.toolbar. The host back/close control and the ⋯ menu always remain.

**分组** 应用级外壳 ｜ **方法数** 4 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.toolbar.getState()`

Read the effective toolbar items and search state, including whether the host actually rendered them (fullscreen has no navigation bar).

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{declared, rendered, leading, trailing, items, search:{declared,rendered,placeholder,scopes,query,scope,active}}`

```js
const state = await aibox.toolbar.getState()
```

### `aibox.toolbar.update()`

Update title, icon, badge, enabled or hidden for declared item ids; action identity, role and placement cannot change.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `items` | object<string, object> | ✓ |  |
| `items.<key>.title` | string \| null |  |  |
| `items.<key>.icon` | string \| null |  |  |
| `items.<key>.badge` | string \| null |  |  |
| `items.<key>.enabled` | boolean \| null |  |  |
| `items.<key>.hidden` | boolean \| null |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `toolbar state`

```js
await aibox.toolbar.update({ items: { ai: { enabled: hasSelection, badge: '2' } } })
```

### `aibox.toolbar.reset()`

Clear all runtime toolbar overrides and restore manifest values.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

无参数。

**返回** `toolbar state`

```js
await aibox.toolbar.reset()
```

### `aibox.toolbar.setSearch()`

Clear, prefill or dismiss the declared search field from code.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `query` | string \| null |  |  |
| `scope` | string |  |  |
| `active` | boolean |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `search state`

```js
await aibox.toolbar.setSearch({ query: '', active: false })
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：需要可见运行时。**fullscreen 没有导航栏，整条工具栏不渲染** —— `getState().rendered` 回 `false`
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明；但**按钮与搜索框由 `manifest.scene.toolbar` 静态声明**，运行时只能改显示状态，action 身份 / role / 摆放位置都不能改。
- **iOS 系统授权**：无。
- **降级行为**：同 tabs：先查 `rendered`。宿主的返回/关闭控件与 ⋯ 菜单**始终保留**，业务按钮只能加在它们旁边。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **大标题 / 折叠头 / 顶栏分段控件 —— P1**。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §4。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
