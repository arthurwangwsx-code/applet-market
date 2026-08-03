# `aibox.chat`

> Bind the current applet to its docked AI conversation and share compact, user-approved page context.

**分组** 容器内建 ｜ **方法数** 7 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.chat.bind()`

Set the collaboration mode for this applet.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `mode` | `use` \| `build` \| `diagnose` \| `automate` |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `ConversationBinding`

```js
await aibox.chat.bind({ mode:'diagnose' })
```

### `aibox.chat.snapshot()`

Update the compact current-page snapshot without sending a chat message.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `route` | string |  |  |
| `pageTitle` | string |  |  |
| `visibleText` | string |  |  |
| `formState` | any |  |  |
| `consoleErrors` | string[] |  |  |
| `selectedElement` | object |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `ContextSnapshot`

```js
await aibox.chat.snapshot({ route:location.hash, pageTitle:document.title, visibleText:document.body.innerText.slice(0,1200) })
```

### `aibox.chat.context()`

Read the current collaboration binding and compact snapshot.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `ConversationBinding`

### `aibox.chat.selectElement()`

Record a user-selected DOM element for precise AI edits.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `element` | object | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `SelectedElement`

### `aibox.chat.report()`

Report build/diagnostic progress for the chat card and Studio.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `mode` | `use` \| `build` \| `diagnose` \| `automate` |  |  |
| `phase` | `idle` \| `planning` \| `editing` \| `running` \| `testing` \| `completed` \| `failed` | ✓ |  |
| `progress` | number |  | （最小 0、最大 1） |
| `message` | string |  |  |
| `changedFiles` | string[] |  |  |
| `errors` | string[] |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `CollaborationEnvelope`

### `aibox.chat.progress()`

Read the latest collaboration progress envelope.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `CollaborationEnvelope|null`

### `aibox.chat.shareContext()`

Explicitly hand the current compact snapshot to the docked AI conversation; optionally send a visible suggested prompt.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `suggestedPrompt` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

```js
await aibox.chat.shareContext({ suggestedPrompt:'Analyze the selected component and improve its layout.' })
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/CollaborationCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**；`shareContext` 需要可见运行时
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明（分享型方法仍会走一次授权确认）。
- **iOS 系统授权**：无。
- **降级行为**：只能绑定**显式停靠**到本 applet 的会话，读不到用户的其它聊天记录。没有停靠会话时回空状态而不是报错。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
