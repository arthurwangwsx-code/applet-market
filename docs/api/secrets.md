# `aibox.secrets`

> Keychain-backed credential storage, isolated per applet — and the session cookie jar behind aibox.net.fetch. Use this for anything that authenticates the user (login tokens, API keys), NEVER aibox.storage: storage is plaintext and goes into the user's backup. Cookies are handled for you: net.fetch injects and collects them automatically, so a login flow just needs to call the site's login endpoint and then read the session with hasSession().

**分组** 系统能力投影 ｜ **方法数** 7 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"secrets"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.secrets.set()`

Store one credential under a key. Empty value removes it.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `key` | string | ✓ |  |
| `value` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{stored:boolean}`

```js
await aibox.secrets.set('apiKey', key)
```

### `aibox.secrets.get()`

Read one credential back. Returns null when absent.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `key` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `string or null`

```js
const key = await aibox.secrets.get('apiKey')
```

### `aibox.secrets.remove()`

Delete one credential.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `key` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

### `aibox.secrets.keys()`

List the credential keys this applet has stored. Values are never returned.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `string[]`

### `aibox.secrets.hasSession()`

Whether this applet holds session cookies for a host — i.e. whether the user is logged in. Check this on launch to decide between the logged-in and guest UI; do NOT keep your own 'isLoggedIn' flag in storage, it will drift from the real cookie state.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `host` | string |  | Optional host filter, e.g. 'bilibili.com'. Omit to ask about any host. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{hasSession:boolean, hosts:string[]}`

```js
const { hasSession } = await aibox.secrets.hasSession({ host: 'bilibili.com' })
```

### `aibox.secrets.clearSession()`

Log out: drop the session cookies. Pass a host to drop only that site's, omit to drop all of them. Credentials stored via set() are untouched.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `host` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{cleared:integer}`

```js
await aibox.secrets.clearSession({ host: 'bilibili.com' })
```

### `aibox.secrets.availability()`

Whether the keychain actually accepts writes in this build. False on unsigned simulator builds — surface it instead of letting logins silently fail to persist.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{available:boolean}`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/SecretsCapabilityAdapter.swift`

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
