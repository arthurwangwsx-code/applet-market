# `aibox.lifecycle`

> Read host lifecycle state and subscribe to foreground, background, memory, locale and text-size events.

**分组** 容器内建 ｜ **方法数** 1 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.lifecycle.getState()`

Read the current application lifecycle and environment state.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{state,locale,contentSizeCategory,lowPowerMode}`

```js
await aibox.lifecycle.getState()
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明。
- **iOS 系统授权**：无。
- **降级行为**：恒在场。事件（前后台、内存、语言、字号）走 `aibox.events` 事件总线，协议形状见主仓库 `docs/capabilities/applet/platform-protocol.md` §5.6。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **键盘高度事件 + 避让 —— P0，未落地**：目前拿不到键盘高度，输入框被遮挡只能靠 Web 侧猜。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §3.4。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
