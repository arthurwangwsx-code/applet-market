# `aibox.tabs`

> The applet's own bottom tab bar, declared by manifest.scene.tabBar. The host renders it; switching tabs never reloads the WebView, so scroll position and in-memory state survive.

**分组** 应用级外壳 ｜ **方法数** 4 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.tabs.getState()`

Read the effective tab items, the selected id, and whether the host actually rendered the bar (card/sheet/drawer surfaces do not).

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{declared, style, items:[{id,title,icon,selectedIcon,badge,enabled,hidden}], selected, rendered}`

```js
const state = await aibox.tabs.getState(); if (!state.rendered) useInlineSegmentedControl()
```

### `aibox.tabs.select()`

Switch tabs from code; identical to a user tap, including the changed event.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `id` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `tabs state`

```js
await aibox.tabs.select('saved')
```

### `aibox.tabs.update()`

Update title, icon, badge, enabled or hidden for declared tab ids. Tabs cannot be added, removed or renamed by id.

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

**返回** `tabs state`

```js
await aibox.tabs.update({ items: { subs: { badge: '3' }, saved: { hidden: true } } })
```

### `aibox.tabs.reset()`

Clear all runtime tab overrides and restore manifest values.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

无参数。

**返回** `tabs state`

```js
await aibox.tabs.reset()
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：需要可见运行时。**card / sheet / drawer 高度不够，声明了也不画** —— `getState().rendered` 会如实回 `false`
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明；但 **Tab 身份由 `manifest.scene.tabBar` 静态声明**，运行时只能改标题/图标/角标/禁用/隐藏，不能增删 Tab、不能改 id。
- **iOS 系统授权**：无。
- **降级行为**：**这是最容易踩的一条**：先读 `getState().rendered`，为 `false` 时改用页面内的分段控件，否则用户会看到一个没有导航的半残应用。切 Tab 不会重载 WebView，滚动位置和内存状态都保得住。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **顶栏分段控件 —— P1**：`rendered:false` 时目前只能自绘替代。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §4。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
