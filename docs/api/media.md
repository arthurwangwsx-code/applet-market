# `aibox.media`

> Play applet-scoped audio assets with channel-aware controls.

**分组** 系统能力投影 ｜ **方法数** 6 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"media"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.media.play()`

Play an audio file from this applet's assets/data/cache directories.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `path` | string | ✓ |  |
| `channel` | `music` \| `voice` \| `sfx` \| `ambient` |  |  |
| `volume` | number |  | （最小 0、最大 1） |
| `loop` | boolean |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{id,channel,state}`

**返回类型** `{ channel: "music" | "voice" | "sfx" | "ambient"; id: string; state: "playing" }`

```js
await aibox.media.play({path:'assets/audio/welcome.m4a',channel:'voice'})
```

### `aibox.media.pause()`

Pause one playback handle.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `id` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

**返回类型** `boolean`

### `aibox.media.resume()`

Resume one playback handle.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `id` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

**返回类型** `boolean`

### `aibox.media.stop()`

Stop one playback handle.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `id` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

**返回类型** `boolean`

### `aibox.media.stopAll()`

Stop all audio, optionally limited to one channel.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `channel` | `music` \| `voice` \| `sfx` \| `ambient` |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `integer`

**返回类型** `number`

### `aibox.media.getState()`

Read playback state for one handle.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `id` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{id,state,currentTime,duration,channel} | {state:'stopped'}`

**返回类型** `{ channel: string; currentTime: number; duration: number; id: string; state: "playing" | "paused" } | { state: "stopped" }`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/MediaCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**；播放属 `presentation` 档位，无头执行时能出声但没有可见控件
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：需声明 `"media"`。
- **iOS 系统授权**：无（播放不需要授权；录音不在本能力范围内）。
- **降级行为**：**只接受当前 applet 工作域内的相对路径**（assets/data/cache），给任意 `file://` 会被拒。`music` 与 `voice` 通道是互斥的，播新的会停掉同通道旧的。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **小应用不得自持媒体引擎（架构裁决）**：需要真正的音乐播放能力请用 [`aibox.music`](music.md)，不要在应用里自建播放器。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §3.6。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
