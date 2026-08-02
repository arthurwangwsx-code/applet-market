# `aibox.storage`

> Per-applet persistent JSON key-value storage.

**分组** 容器内建 ｜ **方法数** 4 ｜ **声明要求** 需要 `manifest.permissions.storage: true`。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.storage.get()`

Read one value.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `key` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `JSON value or null`

```js
await aibox.storage.get('theme')
```

### `aibox.storage.set()`

Persist one JSON value.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `key` | string | ✓ |  |
| `value` | any | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

```js
await aibox.storage.set('theme', 'dark')
```

### `aibox.storage.list()`

List stored keys.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `string[]`

```js
await aibox.storage.list()
```

### `aibox.storage.remove()`

Remove one stored key.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `key` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

```js
await aibox.storage.remove('theme')
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：`permissions.storage: true`。
- **iOS 系统授权**：无。
- **降级行为**：恒在场。数据按 applet 隔离，**更新版本时保留，卸载时清除**。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **安全存储（Keychain）—— P2**：股票 API Key、账本密码这类不该躺在普通 KV 里的数据，目前没有专门通道。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §5。
- 大数据量别塞进单个 key，用 [`aibox.db`](db.md)。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
