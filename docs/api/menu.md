# `aibox.menu`

> Read or update the display state of business menu items declared by manifest.scene.menu.

**分组** 应用级外壳 ｜ **方法数** 3 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.menu.getState()`

Read the effective business menu and host-menu policy.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{declared,mergePolicy,hostPlacement,hostItems,items}`

```js
await aibox.menu.getState()
```

### `aibox.menu.update()`

Update title, icon, enabled or hidden for declared item ids; action identity cannot change.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `items` | object<string, object> | ✓ |  |
| `items.<key>.title` | string \| null |  |  |
| `items.<key>.icon` | string \| null |  |  |
| `items.<key>.enabled` | boolean \| null |  |  |
| `items.<key>.hidden` | boolean \| null |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `menu state`

```js
await aibox.menu.update({ items:{ save:{ enabled:hasChanges, title:hasChanges?'Save':'Saved' } } })
```

### `aibox.menu.reset()`

Clear all runtime menu overrides and restore manifest values.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

无参数。

**返回** `menu state`

```js
await aibox.menu.reset()
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：所有方法都需要可见运行时；headless 下回 `aibox/not-visible`
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明；但**菜单项身份由 `manifest.scene.menu` 静态声明**，运行时只能改显示状态（标题/图标/禁用/隐藏），不能增删项、不能改 id。
- **iOS 系统授权**：无。
- **降级行为**：更新未声明的 id 会被拒。宿主自己的 ⋯ 菜单项始终保留，不会被业务项挤掉。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
