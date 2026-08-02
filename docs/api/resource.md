# `aibox.resource`

> Inspect, read or remove applet-scoped resources returned by native pickers.

**分组** 容器内建 ｜ **方法数** 4 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.resource.list()`

List imported resource handles owned by this applet.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `ResourceRef[]`

```js
await aibox.resource.list()
```

### `aibox.resource.info()`

Read metadata for an applet resource handle.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `handle` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `ResourceRef`

### `aibox.resource.readText()`

Read a UTF-8 resource up to 1 MB; use the applet URL for larger/binary data.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `handle` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `string`

### `aibox.resource.remove()`

Delete an imported resource owned by this applet.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `handle` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**（句柄的**产生**要走 [`aibox.picker`](picker.md)，那个需要可见运行时；已有句柄的读取/列举/删除在 headless 下也可用）
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明。
- **iOS 系统授权**：无。
- **降级行为**：句柄按 applet 隔离。`readText` 上限 1 MB，更大或二进制的走 `applet://` 同源 URL，**不要走 JSON Base64**。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **图片走宿主两级缓存 —— P0，落地中**：远端图片经 `applet://localhost/image/<b64url>` 回字节，复用宿主已有的两级图片缓存，省掉每个应用各自重复下载解码。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §3.3。

  注意这条是 **URL 路由，不是 JSAPI 方法**——它没有 descriptor，所以**不会出现在本目录的生成内容里**。用法以主仓库文档与 `.aibox/aibox.d.ts` 为准。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
