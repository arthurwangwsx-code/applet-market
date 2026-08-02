# `aibox.picker`

> Let the user choose files or photos and return applet-scoped resource handles instead of Base64 payloads.

**分组** 应用级外壳 ｜ **方法数** 2 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"picker"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.picker.file()`

Present the system document picker.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `types` | string[] |  | （最多 20 项） |
| `multiple` | boolean |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{items:ResourceRef[],cancelled:boolean}`

```js
await aibox.picker.file({ types:['text/plain','.md'], multiple:false })
```

### `aibox.picker.photo()`

Present the system photo picker without granting broad photo-library access.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `limit` | integer |  | （最小 1、最大 10） |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{items:ResourceRef[],cancelled:boolean}`

```js
await aibox.picker.photo({ limit:1 })
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：需要可见运行时；headless 下回 `aibox/not-visible`
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：需声明 `"picker"`。
- **iOS 系统授权**：**不需要**。系统文件/照片选择器是进程外的，用户选了什么才给什么——不会申请整个照片库的访问权。
- **降级行为**：用户取消时回 `{cancelled:true}` 而不是报错，**必须处理这个分支**。返回的是 applet 私有资源句柄，配合 [`aibox.resource`](resource.md) 读取；二进制不走 JSON Base64。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
