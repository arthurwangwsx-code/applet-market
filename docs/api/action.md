# `aibox.action`

> Expose or return applet actions to the host.

**分组** 容器内建 ｜ **方法数** 1 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.action.result()`

Return structured data to the current caller.

**副作用档位** `meta`（元操作）— 改容器自身的声明或路由，不碰宿主数据。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `data` | any |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

```js
await aibox.action.result({ ok: true })
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
- **降级行为**：恒在场。这是 headless applet **唯一**的输出通道——被 `applet_invoke` / `applet_run` 调起时，用它把结构化结果交回调用方。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
