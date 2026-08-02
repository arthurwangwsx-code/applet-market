# `aibox.db`

> Per-applet structured document collections with atomic persistence and exact-match queries.

**分组** 容器内建 ｜ **方法数** 8 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.db.collections()`

List collection names.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `string[]`

```js
await aibox.db.collections()
```

### `aibox.db.insert()`

Insert or replace one JSON object; returns metadata including _id.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `collection` | string | ✓ |  |
| `document` | object | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `stored document`

```js
await aibox.db.insert({ collection:'tasks', document:{ title:'Ship', done:false } })
```

### `aibox.db.get()`

Read one document by _id.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `collection` | string | ✓ |  |
| `id` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `document|null`

### `aibox.db.update()`

Patch one document; JSON null removes a field.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `collection` | string | ✓ |  |
| `id` | string | ✓ |  |
| `patch` | object | ✓ |  |
| `merge` | boolean |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `updated document`

### `aibox.db.remove()`

Delete one document by _id.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `collection` | string | ✓ |  |
| `id` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

### `aibox.db.query()`

Query by exact field equality, with stable sorting and pagination.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `collection` | string | ✓ |  |
| `where` | object |  |  |
| `sortBy` | string |  |  |
| `descending` | boolean |  |  |
| `offset` | integer |  | （最小 0） |
| `limit` | integer |  | （最小 1、最大 500） |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `document[]`

```js
await aibox.db.query({ collection:'tasks', where:{done:false}, sortBy:'_updatedAt', descending:true })
```

### `aibox.db.count()`

Count documents matching exact field equality.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `collection` | string | ✓ |  |
| `where` | object |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `number`

### `aibox.db.clear()`

Delete every document in one collection.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `collection` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/DatabaseCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：容器协议内核，无需声明（写入型方法仍会走一次授权确认）。
- **iOS 系统授权**：无。
- **降级行为**：恒在场，按 applet 隔离。查询只支持**精确字段相等**加排序分页——没有范围查询、没有全文检索，复杂筛选要在 JS 侧做。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。

数据量大时用它而不是 [`aibox.storage`](storage.md)：storage 是整值读写，几千条记录会把每次读写都变成全量序列化。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
