# `aibox.open`

> Open a safe external URL or system handler.

**分组** 系统能力投影 ｜ **方法数** 1 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"open"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.open.url()`

Open an http, https, mailto, or tel URL.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `url` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

**返回类型** `boolean`

```js
await aibox.open.url('https://example.com')
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/OpenURLCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：需要可见运行时
- **宿主变体**：Full ✅ ／ Lean ⚠️ 取决于壳是否注册了 `URLOpening`（非 UIKit 平台会被跳过）
- **manifest 声明**：需声明 `"open"`。
- **iOS 系统授权**：无。
- **降级行为**：缺席时整条命名空间不进目录。这是 [`aibox.browser`](browser.md) 不在时的兜底出口——但它是**跳出到系统浏览器**，用户会离开 App，别拿它当应用内阅读用。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
