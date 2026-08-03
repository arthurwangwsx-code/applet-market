# `aibox.overlay`

> A persistent control layer the host draws ABOVE the bottom tab bar, declared by manifest.scene.overlay. Use it for controls that must always be reachable — a record button, a mini player, a batch-action bar. Do NOT hand-draw these with position:fixed: the host layer gets real Liquid Glass, correct safe-area and keyboard behaviour, and structural stacking with the tab bar. It reserves its own height, so it never covers the last row of your content.

**分组** 应用级外壳 ｜ **方法数** 3 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.overlay.getState()`

Read the effective overlay items and whether the host actually rendered them (card/sheet/drawer surfaces do not). Always readable — this is the degradation probe.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{declared, rendered, items:[{id,kind,icon,activeIcon,title,subtitle,tint,progress,active,enabled,hidden,controls:[{id,icon,activeIcon,tint,active,enabled}]}]}`

```js
const s = await aibox.overlay.getState(); if (!s.rendered) renderInlineControlsAtEndOfContent()
```

### `aibox.overlay.update()`

Update the display state of declared overlay ids: icon, activeIcon, title, subtitle, tint, progress, active, enabled, hidden, and the same fields on declared controls. Layers and controls cannot be added, removed or renamed by id.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `items` | object<string, object> | ✓ |  |
| `items.<key>.icon` | string \| null |  |  |
| `items.<key>.activeIcon` | string \| null |  |  |
| `items.<key>.title` | string \| null |  |  |
| `items.<key>.subtitle` | string \| null |  |  |
| `items.<key>.tint` | `default` \| `accent` \| `danger` \| `null` |  |  |
| `items.<key>.progress` | number \| null |  | （最小 0、最大 1） |
| `items.<key>.active` | boolean \| null |  |  |
| `items.<key>.enabled` | boolean \| null |  |  |
| `items.<key>.hidden` | boolean \| null |  |  |
| `items.<key>.controls` | object \| null |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `overlay state`

```js
await aibox.overlay.update({ items: { record: { active: true, title: '00:12' }, player: { title: song.name, progress: 0.42, controls: { toggle: { active: true } } } } })
```

### `aibox.overlay.reset()`

Clear all runtime overlay overrides and restore manifest values.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

无参数。

**返回** `overlay state`

```js
await aibox.overlay.reset()
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起
- **可用 surface**：需要可见运行时。**card / sheet / drawer 高度不够，声明了也不画** —— `getState().rendered` 会如实回 `false`
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需在 `permissions` 里声明；但**层与控件的身份由 `manifest.scene.overlay` 静态声明**，运行时只能改展示状态（图标 / 标题 / 副标题 / 色档 / 进度 / 二态 / 禁用 / 隐藏），不能增删层与控件、不能改 id。
- **声明约束**：1…2 层，且**至多一个 `bar` + 至多一个 `button`**；`bar` 最多 4 枚控件。越界时整条声明不渲染。
- **iOS 系统授权**：无。
- **降级行为**：先读 `getState().rendered`，为 `false` 时把控件放回自己的内容流（页面底部的常规按钮）。宿主渲染时它画在**底栏之上**，并且**自己占掉那份高度** —— 所以它不会盖住内容的最后一行，页面不需要额外留白。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **更多形态 —— 按需**：当前只有 `bar`（控制条）与 `button`（显要动作键）两种形态。需要第三种（分段、滑杆…）时先回主仓库 `docs/capabilities/applet/app-shell-and-market.md` §2.5 补合同，**不要在页面里自绘一个替代品**。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
