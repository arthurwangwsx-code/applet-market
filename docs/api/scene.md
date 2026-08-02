# `aibox.scene`

> Inspect native presentation, appearance, safe areas and orientation, and request declared changes.

**分组** 应用级外壳 ｜ **方法数** 3 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.scene.getState()`

Read effective presentation, appearance, safe areas and orientation.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{requested,effective,current,allowed,requestable,appearance,orientation,safeArea}`

```js
await aibox.scene.getState()
```

### `aibox.scene.requestPresentation()`

Switch this visible applet to an allowed page, fullscreen, sheet or drawer surface.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `surface` | `page` \| `fullscreen` \| `sheet` \| `drawer` | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{requested,effective,current,allowed,requestable}`

```js
await aibox.scene.requestPresentation({ surface:'fullscreen' })
```

### `aibox.scene.requestOrientation()`

Request one orientation declared by manifest.scene.orientation on a visible page/fullscreen surface.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `orientation` | `portrait` \| `landscapeLeft` \| `landscapeRight` | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `scene state`

```js
await aibox.scene.requestOrientation('landscapeRight')
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：`getState` 全部可用；`requestPresentation` / `requestOrientation` 需要可见运行时，且只在 page / fullscreen 下有意义
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明；但**可切换到哪些形态由 `manifest.presentation.surfaces` 静态声明**，运行时只能在声明过的集合里切。
- **iOS 系统授权**：无。
- **降级行为**：请求未声明的形态会被拒。`getState()` 的 `allowed` / `requestable` 如实回报当前能切到哪些，据此决定要不要渲染「全屏」按钮。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **滚动位置恢复 —— P1**：形态切换与返回后回到原滚动位置，目前要应用自己存。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §4。
- **冷启动预热 —— P1**：已有 `AppletAssetPreloader`，但没做「最近用过的 applet 预热 WebView」，目标冷启 < 300ms。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
