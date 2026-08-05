# `aibox.vision`

> Read the text out of an image your applet already has — a photo the user picked, a screenshot, a scanned receipt. Runs entirely ON DEVICE (Vision framework); the image never leaves the phone and never goes to a model. This is the one to use for images from aibox.picker.photo/file; aibox.photos.ocr is a different thing (it reads images attached to the CHAT, not yours).

**分组** 系统能力投影 ｜ **方法数** 2 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"vision"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.vision.recognizeText()`

OCR an image resource you own. Pass the handle you got back from picker.photo or picker.file. Returns the text in reading order, newline-separated. Empty text means no readable text was found — that is a normal outcome, not an error, so tell the user rather than retrying.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `handle` | string | ✓ | Resource handle from aibox.picker.photo() or picker.file(). |
| `languages` | string[] |  | Recognition language priority, e.g. ["zh-Hans","en"]. Defaults to Chinese then English. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{ok:boolean, text:string, empty:boolean}`

```js
const picked = await aibox.picker.photo({ limit: 1 })
const { text } = await aibox.vision.recognizeText({ handle: picked.resources[0].handle })
```

### `aibox.vision.availability()`

Whether on-device text recognition exists in this build. Hide the scan entry point instead of letting a tap do nothing.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{available:boolean}`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/VisionCapabilityAdapter.swift`

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
