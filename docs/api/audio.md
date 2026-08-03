# `aibox.audio`

> Record audio inside your own UI and turn your own audio into text. This is the ONLY way an applet can capture audio — getUserMedia and MediaRecorder do not work inside the applet WebView. Everything here works on applet-private resource handles and stays permanently available, independent of any host module. CHOOSING BETWEEN aibox.audio AND aibox.voiceMemos — ask one question: should the result show up in the user's own Voice Memos library? If yes, use aibox.voiceMemos (it drives the host module, opens host UI, and disappears when that module is not installed). If no, use aibox.audio: the product belongs to you, nothing is written to the user's library, and nothing here can vanish with a module.

**分组** 系统能力投影 ｜ **方法数** 9 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"audio"`。**声明 ≠ 授权**，用户仍会被逐项询问。

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

### `aibox.audio.transcribeAvailability()`

Probe whether transcribe() can run for a locale. Never prompts and never transcribes — call it before showing a transcribe button. state tells you WHY it is unavailable: engine-missing (this build has no transcription engine), not-authorized, unsupported-locale, unsupported-os, needs-model-download (transcribe() will download it on first use, so this state is still worth offering).

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `locale` | string |  | BCP-47 tag such as en-US or zh-CN. Defaults to the device locale. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{available, state, locale, engine} — state is one of available | needs-model-download | not-authorized | unsupported-locale | unsupported-os | engine-missing`

```js
const a = await aibox.audio.transcribeAvailability({ locale:'zh-CN' }); if (!a.available && a.state !== 'needs-model-download') hideTranscribeButton(a.state)
```

### `aibox.audio.transcribe()`

Transcribe an audio resource of YOUR OWN into text plus timestamped segments. Pass the handle from recordStop() or picker.file() — never a file path (you do not have one, and the host resolves the handle itself). Long files take minutes; one transcription per applet at a time. First use may prompt for speech recognition and may download the locale model.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `handle` | string | ✓ | A resource:// handle belonging to this applet (from aibox.audio.recordStop or aibox.picker.file). |
| `locale` | string |  | BCP-47 tag. Always pass it when you know the spoken language — a mismatched recognizer transcribes look-alike words in the wrong language. |
| `segments` | boolean |  | Include timestamped segments. Default true; pass false when you only need the text and want a smaller payload. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{text, locale, segments:[{text, start, duration, end}], segmentCount} — start/duration/end are seconds`

```js
const r = await aibox.audio.recordStop(); const t = await aibox.audio.transcribe({ handle:r.handle, locale:'zh-CN' }); show(t.text)
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
