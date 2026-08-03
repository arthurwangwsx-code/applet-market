# `aibox.audio`

> "Record audio inside your own UI. This is the ONLY way an applet can capture audio — "
                + "getUserMedia and MediaRecorder do not work inside the applet WebView. "
                + "The recording becomes an applet-private resource handle; it is never added to the user's voice-memo library."

**分组** 系统能力投影 ｜ **方法数** 7 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"audio"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.audio.availability()`

Probe whether recording can start right now. Never prompts and never opens the microphone — call it on mount and hide the record button when unavailable.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{available, microphone, supportsBackgroundRecording, busy, reason}`

```js
const a = await aibox.audio.availability(); if (!a.available) hideRecordButton(a.reason)
```

### `aibox.audio.recordStart()`

Start recording. Shows no host UI. Fails with aibox/busy if any recording is already running.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `format` | `m4a` \| `wav` |  | m4a is AAC (default, small); wav is 16-bit PCM for when you want to decode samples in JS. |
| `sampleRate` | integer |  | Default 44100. （最小 8000、最大 48000） |
| `bitrate` | integer |  | AAC bits per second; default 128000. Ignored for wav. |
| `channels` | `1` \| `2` |  | Default 1 — speech gains nothing from stereo and doubles the size. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{started, discarded, format, sampleRate, channels, supportsBackgroundRecording} — started:false with discarded:true means you called recordStop while the permission prompt was still up, so nothing was captured`

```js
await aibox.audio.recordStart({ format:'m4a', sampleRate:44100, bitrate:128000, channels:1 })
```

### `aibox.audio.recordPause()`

Pause the recording. Returns false when there is nothing of yours to pause, or after an interruption (that file is already finalized).

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

```js
await aibox.audio.recordPause()
```

### `aibox.audio.recordResume()`

Resume a paused recording.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

```js
await aibox.audio.recordResume()
```

### `aibox.audio.recordStop()`

Stop and finalize. Returns an applet resource handle you can play with <audio src=ref.url> or decode with AudioContext. Clips shorter than 500ms are discarded (discarded:true) and nothing is written.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `{handle, url, name, mimeType, size, durationMs, byteCount, format, sampleRate, channels, interrupted} | {discarded:true, durationMs}`

```js
const r = await aibox.audio.recordStop(); if (!r.discarded) player.src = r.url
```

### `aibox.audio.recordCancel()`

Discard the recording and delete the file. Nothing is stored.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

```js
await aibox.audio.recordCancel()
```

### `aibox.audio.recordStatus()`

Poll while recording. levels holds the most recent 120 samples (20 Hz, ~6s) already normalized to 0…1 with the same curve the native recorder uses, oldest first — pad the left with zeros and draw the newest at the right edge.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{state, recording, paused, interrupted, elapsedMs, byteCount, levels, levelsHz, averageDb, peakDb}`

```js
const s = await aibox.audio.recordStatus(); drawWaveform(s.levels)
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/AudioRecordingCapabilityAdapter.swift`

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
