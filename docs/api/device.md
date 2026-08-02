# `aibox.device`

> Read non-identifying device, locale, battery, and free-storage information.

**分组** 系统能力投影 ｜ **方法数** 1 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"device"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.device.info()`

Read the current device state.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{model, systemName, systemVersion, idiom, locale, timeZone, batteryLevel?, batteryState, freeDiskBytes?}`

```js
await aibox.device.info()
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/DeviceInfoCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：需声明 `"device"`。
- **iOS 系统授权**：无。
- **降级行为**：纯只读，免确认。只回机型/系统版本这类粗粒度信息，拿不到任何可用于跨应用追踪的标识。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
