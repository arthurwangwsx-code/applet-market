# `aibox.video`

> Play video on the host's native full-screen player — the same engine the media library uses, so you get AirPlay, picture-in-picture, the lock-screen card and background audio for free. Your applet never owns the player: it sends commands and receives progress events. Use this for ANY video playback; a <video> tag inside an applet is blocked by CSP and dies the moment the app goes to the background.

**分组** 系统能力投影 ｜ **方法数** 13 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"video"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.video.play()`

Play one video full-screen. Two ways to call it. (1) AFTER video.resolve: pass the SAME page url as sourceURL plus the chosen formatID — this is the one you want, because it keeps the request headers and split-stream info that resolve found; passing resolve's raw url instead loses them and sites like Bilibili will answer 403. (2) For a plain direct media URL you already have (mp4/m3u8, not a web page): pass url. resumeFrom continues from a saved position in seconds; presentation 'immersive' (default) takes over the screen, 'embedded' does not.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `sourceURL` | string |  | The page url you passed to video.resolve. Preferred. |
| `formatID` | string |  | id of the chosen format from resolve; omit to let the host pick the best playable one. |
| `url` | string |  | A direct media URL. Only for streams you did not get from resolve. |
| `title` | string |  |  |
| `subtitleURL` | string |  | Optional .srt sidecar subtitle URL. |
| `resumeFrom` | number |  | Seconds to resume from. （最小 0） |
| `presentation` | `immersive` \| `embedded` |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{playing:boolean}`

```js
const r = await aibox.video.resolve({ url: pageURL })
const best = r.formats.filter(f => f.playable)[0]
await aibox.video.play({ sourceURL: pageURL, formatID: best.id, resumeFrom: 120 })
```

### `aibox.video.playQueue()`

Play a list of videos starting at startAt, so next/previous walk the list. Use this for episode lists and multi-part videos instead of calling play() again on every part.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `items` | object[] | ✓ |  |
| `items[].url` | string | ✓ |  |
| `items[].title` | string |  |  |
| `items[].subtitleURL` | string |  |  |
| `startAt` | integer |  | （最小 0） |
| `resumeFrom` | number |  | （最小 0） |
| `presentation` | `immersive` \| `embedded` |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{playing:boolean, count:integer}`

```js
await aibox.video.playQueue({ items: parts.map(p => ({url: p.url, title: p.title})), startAt: 0 })
```

### `aibox.video.pause()`

Pause playback. Does nothing if what is playing was not started by your applet.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

无参数。

**返回** `boolean`

### `aibox.video.resume()`

Resume playback. Does nothing if what is playing was not started by your applet.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

无参数。

**返回** `boolean`

### `aibox.video.stop()`

Stop playback and dismiss the player. Only affects playback your applet started.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

无参数。

**返回** `boolean`

### `aibox.video.seek()`

Jump to a position in seconds. Clamped to the video duration by the host.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `seconds` | number | ✓ | （最小 0） |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

### `aibox.video.next()`

Play the next item in the queue. No-op without a queue.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

无参数。

**返回** `boolean`

### `aibox.video.previous()`

Play the previous item in the queue. No-op without a queue.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

无参数。

**返回** `boolean`

### `aibox.video.status()`

Current playback snapshot. mine tells you whether the host is playing something YOUR applet started — check it before showing your own progress UI, because the user may be watching something else entirely.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{state:'idle'|'loading'|'playing'|'paused'|'failed', url, title, currentTime, duration, queueIndex, queueCount, mine:boolean, error}`

```js
const s = await aibox.video.status(); if (s.mine) setProgress(s.currentTime / s.duration)
```

### `aibox.video.subscribe()`

Start pushing 'video.progress' events (~2Hz) to aibox.events. Strongly preferred over polling status(). Events stop automatically when your applet closes.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

```js
await aibox.video.subscribe(); aibox.events.on('video.progress', s => setProgress(s))
```

### `aibox.video.unsubscribe()`

Stop the progress event stream.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

### `aibox.video.resolve()`

Turn a video PAGE url (Bilibili, YouTube, a page with an embedded player, an m3u8…) into playable stream urls, using the host's own extractor stack. Use this instead of reimplementing site parsing in JS. Each returned format carries `playable`: FALSE means this build cannot play that one (DASH split streams need a merge backend that may not be compiled in) — filter on it and never offer the user a quality that would just go black. Pass a playable format's `url` straight to video.play.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `url` | string | ✓ | The page or media URL to resolve. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{ok:boolean, title, uploader, durationSeconds, thumbnailURL, extractor, formats:[{id,kind:'direct'|'hls'|'dash',quality,width,height,fps,bitrate,bytes,url,playable:boolean}], error}`

```js
const r = await aibox.video.resolve({ url: pageURL })
const best = r.formats.filter(f => f.playable)[0]
if (best) await aibox.video.play({ url: best.url, title: r.title })
```

### `aibox.video.availability()`

What this build can actually do: `available` = there is a video engine, `resolve` = the extractor stack is compiled in, `dash` = split video/audio streams can be played. Hide the entry points this build cannot honor instead of letting a tap do nothing.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{available:boolean, resolve:boolean, dash:boolean}`

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/VideoCapabilityAdapter.swift`

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
