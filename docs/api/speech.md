# `aibox.speech`

> "On-device speech-to-text. This is the ONLY way an applet can take voice input — "
                + "getUserMedia and webkitSpeechRecognition do not work inside the applet WebView. "
                + "Audio never leaves the device."

**分组** 系统能力投影 ｜ **方法数** 5 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"speech"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.speech.availability()`

Probe whether recognition can run right now. Never prompts and never opens the microphone — call it on mount and hide the mic button when unavailable.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `locale` | string |  | BCP-47 tag such as en-US or zh-CN. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{available, supportsOnDevice, microphone, speech, locale, reason}`

```js
const a = await aibox.speech.availability({ locale:'en-US' }); if (!a.available) hideMic(a.reason)
```

### `aibox.speech.recognize()`

Open the microphone and resolve with the recognized text. Resolves when you call stop(), when maxDurationMs elapses, or when the engine finalizes. For push-to-talk, call recognize() WITHOUT awaiting on press and stop() on release, then await the recognize promise.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `locale` | string |  | BCP-47 tag. Always pass it for read-aloud practice: a mismatched recognizer transcribes look-alike words in the wrong language and every score is wrong. |
| `maxDurationMs` | integer |  | Hard stop; default 10000. Reaching it finalizes (it does not discard). （最小 1000、最大 120000） |
| `onPartial` | boolean |  | Keep interim results flowing; read them from status().partial. Default true. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{transcript, confidence, locale, cancelled, timedOut, onDevice}`

```js
const r = await aibox.speech.recognize({ locale:'en-US', maxDurationMs:10000 }); if (!r.cancelled) score(r.transcript)
```

### `aibox.speech.stop()`

Stop capturing and let the pending recognize() resolve with the final text.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

```js
await aibox.speech.stop()
```

### `aibox.speech.cancel()`

Abandon the pending recognize(); it resolves with cancelled:true and an empty transcript.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

```js
await aibox.speech.cancel()
```

### `aibox.speech.status()`

Poll the in-flight session: elapsed time and the interim transcript so far.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{recognizing, elapsedMs, partial, locale}`

```js
const s = await aibox.speech.status(); caption.textContent = s.partial
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/SpeechRecognitionCapabilityAdapter.swift`

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
