# `aibox.browser`

> Open a link in the in-app browser, the system browser, or an external browser app — and come back. Prefer this over open.url for anything the user should read and return from.

**分组** 系统能力投影 ｜ **方法数** 3 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"browser"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.browser.open()`

Open an http/https URL. mode inApp keeps the user inside the app (default); system uses SFSafari so Safari logins/passkeys apply; external hands off to the default browser app. Unavailable modes degrade inApp → system → external instead of failing.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `url` | string | ✓ |  |
| `mode` | `inApp` \| `system` \| `external` |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{opened:boolean, mode:string}`

**返回类型** `{ mode: "inApp" | "system" | "external"; opened: boolean }`

```js
await aibox.browser.open({ url, mode: 'inApp' })
```

### `aibox.browser.openArticle()`

Open a link straight into Reader with content you already extracted, so the host does not fetch and parse it a second time.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `url` | string | ✓ |  |
| `title` | string |  |  |
| `excerpt` | string |  |  |
| `siteName` | string |  |  |
| `publishedAt` | string |  |  |
| `content` | string |  | Pre-extracted article HTML; omit to let the host extract on arrival. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{opened:boolean, mode:string, reader:boolean}`

**返回类型** `{ mode: "inApp" | "system" | "external"; opened: boolean; reader: boolean }`

```js
await aibox.browser.openArticle({ url, title, content: extractedHTML })
```

### `aibox.browser.availability()`

Which modes this host can actually serve right now, and whether Reader exists. Hide entry points the host cannot honor instead of letting a tap do nothing.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{modes:string[], reader:boolean}`

**返回类型** `{ modes: Array<"inApp" | "system" | "external">; reader: boolean }`

```js
const info = await aibox.browser.availability()
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/BrowserCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：需要可见运行时
- **宿主变体**：Full ✅ ／ **Lean ❌** —— Lean 壳没装浏览器模块，`BrowserCapability` 缺席，整条 `aibox.browser` 不进目录
- **manifest 声明**：需声明 `"browser"`。
- **iOS 系统授权**：无。
- **降级行为**：**这是降级链最典型的一条**：先 `await aibox.browser.availability()`，`modes` 里没有 `inApp` 就别渲染「应用内阅读」入口；整条命名空间都不在时退回 [`aibox.open.url`](open.md) 跳出到系统浏览器。页面里的 `<a href>` 是不通的，开链接**必须**走桥。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- 浏览器桥在 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2 的总账里标记为「🚧 本轮」——已落地，但 Lean 变体下的缺席是**结构性的**，不会补。应用侧只能靠探测。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
