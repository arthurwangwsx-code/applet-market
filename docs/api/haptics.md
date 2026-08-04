# `aibox.haptics`

> Trigger native haptic feedback on a physical device.

**分组** 应用级外壳 ｜ **方法数** 3 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"haptics"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.haptics.impact()`

Play an impact haptic.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `style` | `light` \| `medium` \| `heavy` \| `soft` \| `rigid` |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

**返回类型** `boolean`

```js
await aibox.haptics.impact({ style: 'light' })
```

### `aibox.haptics.selection()`

Play a selection tick.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

**返回类型** `boolean`

```js
await aibox.haptics.selection()
```

### `aibox.haptics.notify()`

Play a success, warning, or error pattern.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `type` | `success` \| `warning` \| `error` |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

**返回类型** `boolean`

```js
await aibox.haptics.notify({ type: 'success' })
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/HapticsCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：需要可见运行时
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：需声明 `"haptics"`。
- **iOS 系统授权**：无。但**模拟器没有触觉引擎**，部分老设备也没有——调用成功不代表用户感觉得到。
- **降级行为**：触觉是锦上添花，永远不要把它当成唯一反馈；每一次震动都要配一个看得见的状态变化。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
