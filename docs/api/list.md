# `aibox.list`

> Real native row gestures for your lists: UIContextMenuInteraction on long press and native swipe actions, driven by row rectangles your list reports. Web CSS cannot reproduce the lift-and-blur preview, the haptic curve or the swipe rubber-banding, which is most of what makes a list feel native. ALWAYS keep your own long-press/swipe fallback: configure returns rendered:false on surfaces that cannot host the layer.

**分组** 应用级外壳 ｜ **方法数** 4 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.list.getState()`

Read whether the host actually attached the gesture layer, plus the declared actions of one region. Always readable — this is the degradation probe.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `regionId` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{rendered, regions:string[], configured?, contextMenu?, leadingSwipe?, trailingSwipe?, rows?}`

```js
const s = await aibox.list.getState('feed'); if (!s.rendered) useOwnLongPressMenu()
```

### `aibox.list.configure()`

Declare the row actions of one region. Identity (ids, role, tint) is fixed here; per-row differences go through setRows overrides. Re-configuring the same regionId replaces the declaration and drops the stale row rectangles.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `regionId` | string | ✓ | （最长 64） |
| `contextMenu` | object[] |  | （最多 12 项） |
| `contextMenu[].id` | string | ✓ |  |
| `contextMenu[].title` | string | ✓ | （最长 60） |
| `contextMenu[].icon` | string |  | SF Symbol name. |
| `contextMenu[].role` | `normal` \| `destructive` |  |  |
| `contextMenu[].tint` | `default` \| `accent` \| `danger` |  |  |
| `leadingSwipe` | object[] |  | （最多 12 项） |
| `leadingSwipe[].id` | string | ✓ |  |
| `leadingSwipe[].title` | string | ✓ | （最长 60） |
| `leadingSwipe[].icon` | string |  |  |
| `leadingSwipe[].role` | `normal` \| `destructive` |  |  |
| `leadingSwipe[].tint` | `default` \| `accent` \| `danger` |  |  |
| `trailingSwipe` | object[] |  | （最多 12 项） |
| `trailingSwipe[].id` | string | ✓ |  |
| `trailingSwipe[].title` | string | ✓ | （最长 60） |
| `trailingSwipe[].icon` | string |  |  |
| `trailingSwipe[].role` | `normal` \| `destructive` |  |  |
| `trailingSwipe[].tint` | `default` \| `accent` \| `danger` |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{rendered, regions, configured, contextMenu, leadingSwipe, trailingSwipe, rows}`

```js
const s = await aibox.list.configure({ regionId:'feed', contextMenu:[{id:'save',title:'Save',icon:'bookmark'},{id:'delete',title:'Delete',icon:'trash',role:'destructive'}], trailingSwipe:[{id:'delete',title:'Delete',icon:'trash',role:'destructive'}] }); if (!s.rendered) useOwnLongPressMenu()
```

### `aibox.list.setRows()`

Report the currently VISIBLE row rectangles. rect is [x, y, width, height] in CSS points in viewport coordinates — exactly getBoundingClientRect(); never multiply by devicePixelRatio and never add scrollTop. Rectangles expire after 600ms, so re-report on every scroll frame (VirtualList and useListGestures already do). Per-row 'actions' overrides may change title/icon/enabled/hidden only — never identity.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `regionId` | string | ✓ |  |
| `rows` | object[] | ✓ | （最多 120 项） |
| `rows[].id` | string | ✓ |  |
| `rows[].rect` | number[] | ✓ | [x, y, width, height] in CSS points, viewport coordinates. （最多 4 项） |
| `rows[].actions` | object<string, object> |  | Per-row display overrides keyed by declared action id. |
| `rows[].actions.<key>.title` | string \| null |  |  |
| `rows[].actions.<key>.icon` | string \| null |  |  |
| `rows[].actions.<key>.enabled` | boolean \| null |  |  |
| `rows[].actions.<key>.hidden` | boolean \| null |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{accepted:boolean, regionId, rows?, generation?, reason?}`

```js
aibox.list.setRows('feed', [{ id:'a1', rect:[0,120,390,96], actions:{ delete:{ hidden: item.pinned } } }])
```

### `aibox.list.release()`

Drop a region when its list unmounts. Idempotent.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `regionId` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{released:boolean, regionId}`

```js
await aibox.list.release('feed')
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
> **待补**。请写清楚：起始宿主版本、可用 surface（page/fullscreen/sheet/drawer/card/headless）、
> 宿主变体（Full/Lean）、manifest 声明要求、iOS 系统授权，以及**能力缺席时的降级行为**。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
> **待补**。从主仓库 `docs/capabilities/applet/framework-capabilities.md` 的 P0/P1/P2
> 分级里摘取与本能力相关的条目，并链接回去。没有已知缺口就写「暂无已知缺口」。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
