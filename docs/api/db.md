# `aibox.db`

> Per-applet structured document collections with atomic persistence and exact-match queries.

**分组** 容器内建 ｜ **方法数** 11 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

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

### `aibox.db.removeWhere()`

"Delete every document matching `where`; returns how many were removed. "
                      + "Use this instead of looping remove() — each single remove rewrites the whole collection file, "
                      + "so deleting 500 documents one by one is 500 full-table writes. `where` must be non-empty; "
                      + "to empty a collection call clear()."

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `collection` | string | ✓ |  |
| `where` | object | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `number (documents removed)`

```js
await aibox.db.removeWhere({ collection:'clips', where:{ _createdAt:{ $lt:'2026-05-01' } } })
```

### `aibox.db.query()`

"Query documents, with stable sorting and pagination. " + Self.operatorHelp

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

**返回** `document[] (at most 500 — page with offset, or use count/aggregate for totals)`

```js
await aibox.db.query({ collection:'tx', where:{ date:{$gte:'2026-08-01'}, kind:{$in:['food','rent']} }, sortBy:'date', descending:true })
```

### `aibox.db.count()`

"Count matching documents without transferring them. " + Self.operatorHelp

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `collection` | string | ✓ |  |
| `where` | object |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `number`

```js
await aibox.db.count({ collection:'tx', where:{ amount:{$gt:1000} } })
```

### `aibox.db.aggregate()`

"Group and reduce documents natively. "
                      + "Prefer this over query()+reduce in JS: a monthly total over 3000 rows needs no rows to cross the bridge "
                      + "(and query() caps at 500 anyway). Each result row has _group and _count plus your named metrics. "
                      + "Omit groupBy to reduce the whole collection into one row. " + Self.operatorHelp

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `collection` | string | ✓ |  |
| `where` | object |  |  |
| `groupBy` | string |  |  |
| `metrics` | object<string, object> | ✓ |  |
| `metrics.<key>.$sum` | string |  |  |
| `metrics.<key>.$avg` | string |  |  |
| `metrics.<key>.$min` | string |  |  |
| `metrics.<key>.$max` | string |  |  |
| `metrics.<key>.$count` | boolean |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `Array<{_group, _count, ...metrics}> sorted by _group; $avg/$min/$max are null when no value qualifies`

```js
await aibox.db.aggregate({ collection:'tx', where:{ date:{$gte:'2026-08-01',$lt:'2026-09-01'} }, groupBy:'category', metrics:{ total:{$sum:'amount'}, n:{$count:true} } })
```

### `aibox.db.search()`

"Case- and accent-insensitive substring scan across string fields. "
                      + "Omit `fields` to scan every non-underscore string field. Combine with `where` to scope it. "
                      + "NOTE: this is a linear substring scan, not an inverted index, and results are NOT ranked — "
                      + "they come back in collection order. That is deliberate: tokenizer-based ranking drops CJK text "
                      + "(no word boundaries), and at the 20k-document cap a scan is milliseconds."

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `collection` | string | ✓ |  |
| `text` | string | ✓ |  |
| `fields` | string[] |  |  |
| `where` | object |  |  |
| `limit` | integer |  | （最小 1、最大 500） |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `document[] in collection order (unranked)`

```js
await aibox.db.search({ collection:'notes', text:'蛋白质', fields:['title','body'] })
```

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
