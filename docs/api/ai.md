# `aibox.ai`

> The app's language model: prose (generate), typed objects (decide), and constrained choices (chooseAction). Needs permissions.ai; metered per applet; every call can fail, so keep a deterministic fallback.

**分组** 容器内建 ｜ **方法数** 12 ｜ **声明要求** 需要 `manifest.permissions.ai: true`；按 applet 计量配额。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.ai.availability()`

Probe whether the model is usable right now (no consent prompt, no quota spent).

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{available:boolean, reason?:string, intents:string[]}`

```js
const a = await aibox.ai.availability(); if (!a.available) useOfflineUI()
```

### `aibox.ai.complete()`

Legacy one-liner; same as generate({prompt}).

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `prompt` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `string`

```js
await aibox.ai.complete('Summarize this')
```

### `aibox.ai.generate()`

L1 — free-form text. Use when a human reads the answer.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `system` | string |  | Instructions/persona; keep byte-identical across turns for prefix caching. |
| `prompt` | string |  | Single-turn shorthand; use this or messages. |
| `messages` | object[] |  | Multi-turn transcript. |
| `messages[].role` | `system` \| `user` \| `assistant` | ✓ |  |
| `messages[].content` | string | ✓ |  |
| `intent` | `fast` \| `balanced` \| `reasoning` |  | Model tier hint; applets never name a model id. |
| `maxTokens` | integer |  |  |
| `temperature` | number |  |  |
| `timeoutMs` | integer |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `string`

```js
await aibox.ai.generate({ system: 'You are terse.', prompt: draft, intent: 'fast', maxTokens: 300 })
```

### `aibox.ai.decide()`

L2 — a typed object shaped by a JSON Schema, already parsed (no JSON.parse). Use when your code consumes the answer.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `system` | string |  |  |
| `prompt` | string | ✓ |  |
| `schema` | object | ✓ | JSON Schema object for the answer; enum on a property makes an illegal value unrepresentable. |
| `intent` | `fast` \| `balanced` \| `reasoning` |  |  |
| `maxTokens` | integer |  |  |
| `timeoutMs` | integer |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `object matching schema`

```js
const r = await aibox.ai.decide({ prompt: receipt, schema: { type:'object', properties:{ amount:{type:'number'}, merchant:{type:'string'} }, required:['amount'] } })
```

### `aibox.ai.chooseAction()`

L2 — pick one of the candidates your code computed. Required for move/option decisions: candidates become an enum, so an out-of-range answer cannot occur, and it degrades to fallback:true instead of failing.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `rules` | string | ✓ | Invariant rules; keep byte-identical across turns (prefix-cache boundary). |
| `state` | string | ✓ | What changed this turn. Never include information the model is not entitled to see. |
| `candidates` | object[] | ✓ | Legal options computed by the applet. |
| `candidates[].id` | string | ✓ |  |
| `candidates[].label` | string |  |  |
| `intent` | `fast` \| `balanced` \| `reasoning` |  |  |
| `timeoutMs` | integer |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{actionId:string, reason?:string, fallback:boolean}`

```js
const d = await aibox.ai.chooseAction({ rules: RULES, state: renderState(), candidates: legal.map(m => ({ id: m.id, label: m.label })), intent: 'fast', timeoutMs: 8000 })
```

### `aibox.ai.generateStream()`

L1 streaming — same input as generate, but returns an async-iterable you can render as it arrives. Use for anything long enough that a spinner would feel slow. Structured output (decide/chooseAction) is never streamed.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `system` | string |  |  |
| `prompt` | string |  |  |
| `messages` | object[] |  |  |
| `messages[].role` | `system` \| `user` \| `assistant` | ✓ |  |
| `messages[].content` | string | ✓ |  |
| `intent` | `fast` \| `balanced` \| `reasoning` |  |  |
| `maxTokens` | integer |  |  |
| `temperature` | number |  |  |
| `timeoutMs` | integer |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `async-iterable of string deltas, with .cancel()`

```js
const s = aibox.ai.generateStream({ prompt }); for await (const d of s) out.textContent += d
```

### `aibox.ai.usage()`

This applet's AI spend so far; gate expensive features before hitting aibox/quota-exceeded.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{usedToday, dailyLimit, usedSession, sessionLimit}`

```js
const u = await aibox.ai.usage()
```

### `aibox.ai.summarize()`

L3 sugar over generate: condense text.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `text` | string | ✓ |  |
| `options` | object |  |  |
| `options.style` | string |  | e.g. bullets, paragraph, tldr |
| `options.maxWords` | integer |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `string`

```js
await aibox.ai.summarize(article, { style: 'bullets', maxWords: 120 })
```

### `aibox.ai.rewrite()`

L3 sugar over generate: restyle text.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `text` | string | ✓ |  |
| `options` | object |  |  |
| `options.tone` | string |  | e.g. polite, concise |
| `options.purpose` | string |  | e.g. email, chat |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `string`

```js
await aibox.ai.rewrite(text, { tone: 'polite', purpose: 'email' })
```

### `aibox.ai.translate()`

L3 sugar over generate: translate text.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `text` | string | ✓ |  |
| `options` | object | ✓ |  |
| `options.to` | string | ✓ | BCP-47 tag or plain language name. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `string`

```js
await aibox.ai.translate(text, { to: 'en' })
```

### `aibox.ai.classify()`

L3 sugar over decide: return exactly one of the given labels (enum-constrained).

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `text` | string | ✓ |  |
| `labels` | string[] | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `one of labels`

```js
await aibox.ai.classify(note, ['work', 'life', 'study'])
```

### `aibox.ai.extract()`

L3 sugar over decide: pull named fields out of text into an object.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `text` | string | ✓ |  |
| `fieldsSpec` | object | ✓ | Field name to type hint, e.g. {amount:'number', merchant:'string'}. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `object with the requested fields`

```js
await aibox.ai.extract(receipt, { amount: 'number', merchant: 'string', date: 'string' })
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**
- **宿主变体**：Full ✅ ／ Lean ⚠️ 取决于壳里是否配了模型provider
- **manifest 声明**：`permissions.ai: true`；按 applet 计量配额。
- **iOS 系统授权**：无。
- **降级行为**：宿主没有可用模型时 `availability()` 回 `{available:false}`，调用 reject `aibox/ai-unavailable`。**每一次调用都可能失败**（`aibox/quota-exceeded`、`aibox/timeout`、`aibox/busy`、`aibox/refused`），必须留确定性兜底路径。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- 三层能力面（generate / decide / chooseAction）已按 主仓库 `docs/capabilities/applet/ai-capability.md` §3 落地，无排期中的缺口。
- 结构化输出（`decide` / `chooseAction`）**永不流式**；需要边出边渲染只能用 `generateStream`。
- 让模型做选择时优先 `chooseAction` 而不是 `generate`：候选编成 enum，非法答案在语法上不可表达，并且会降级成 `fallback:true` 而不是整体失败。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
