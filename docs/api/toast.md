# `aibox.toast`

> Show a short native in-app message.

**分组** 应用级外壳 ｜ **方法数** 1 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"toast"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.toast.show()`

Show a transient message.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `message` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

**返回类型** `boolean`

```js
await aibox.toast.show({ message: 'Saved' })
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/ToastCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：需要可见运行时
- **宿主变体**：Full ✅ ／ Lean ⚠️ 取决于壳是否注册了 `ToastPresenting`（非 UIKit 平台会被跳过）
- **manifest 声明**：需声明 `"toast"`。
- **iOS 系统授权**：无。
- **降级行为**：宿主没提供 `ToastPresenting` 时整条命名空间不进目录 —— 先用 `aibox.capabilities()` 探测，缺席就退回 [`aibox.ui.alert`](ui.md) 或页面内提示。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
