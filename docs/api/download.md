# `aibox.download`

> The host download engine, remote-controlled. Files land on the host (never in your applet sandbox) and keep downloading after your applet closes or the app is killed — a background URLSession does the transfer. You only ever handle taskIds and read-only metadata. Every method is automatically scoped to YOUR downloads: list/pauseAll/cancelAll can never see or touch another app's tasks.

**分组** 系统能力投影 ｜ **方法数** 16 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"download"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.download.enqueue()`

Queue one download and get its taskId back immediately. Resumable, survives app termination. headers are passed through verbatim (Referer/Cookie/User-Agent for sites that reject plain requests).

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `url` | string | ✓ |  |
| `filename` | string |  | Saved name including extension. Defaults to the last path component of the URL. |
| `destination` | object |  | Where the file lands. Omit for the app sandbox Downloads folder, which always works and needs no permission. |
| `destination.kind` | `sandbox` \| `externalFiles` \| `iCloud` \| `vault` |  |  |
| `destination.path` | string |  | Relative folder inside the chosen root. |
| `destination.vault` | string |  | Vault name for kind 'vault'; omit for the active vault. |
| `headers` | object<string, object> |  |  |
| `priority` | `low` \| `normal` \| `high` |  |  |
| `groupId` | string |  | Tie several downloads into one logical task so cancelAll of that group works. |
| `expectedBytes` | integer |  | Size hint so the progress bar is meaningful before the first byte arrives. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{taskId, artifactRef}`

```js
const { taskId } = await aibox.download.enqueue({ url, filename: 'lecture.mp4', destination: { kind:'sandbox', path:'Lectures' } })
```

### `aibox.download.list()`

Your downloads, newest state first-hand. Never includes other apps' tasks.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `state` | `queued` \| `running` \| `paused` \| `completed` \| `failed` \| `cancelled` \| `active` \| `finished` |  |  |
| `groupId` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `DownloadTask[] — {taskId,url,filename,state,bytesReceived,totalBytes,fraction,speed,eta,outputPath,artifactRef,groupId,error}`

```js
const tasks = await aibox.download.list({ state: 'active' })
```

### `aibox.download.status()`

One task's snapshot; null when the id is not yours or no longer exists.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `taskId` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `DownloadTask|null`

### `aibox.download.pause()`

Pause one download; resume data is written to disk so it continues from where it stopped.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `taskId` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

### `aibox.download.resume()`

Resume a paused or failed download.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `taskId` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

### `aibox.download.cancel()`

Cancel one download; the record stays in the list as cancelled.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `taskId` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

### `aibox.download.remove()`

Drop one record from the list entirely (cancels it first if running).

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `taskId` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

### `aibox.download.pauseAll()`

Pause every download of YOURS. Other apps and the host queue are untouched.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

### `aibox.download.resumeAll()`

Resume every paused/failed download of yours.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

### `aibox.download.cancelAll()`

Cancel every active download of yours.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

### `aibox.download.clearFinished()`

Remove your completed/failed/cancelled records. Does NOT delete downloaded files.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

### `aibox.download.subscribe()`

Start pushing 'download.progress' events for your tasks to aibox.events. Strongly preferred over polling: a 10-download queue polled once a second is dozens of bridge round-trips per second. Events stop automatically when your applet closes.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

```js
await aibox.download.subscribe(); aibox.events.on('download.progress', t => update(t))
```

### `aibox.download.unsubscribe()`

Stop the progress event stream.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

### `aibox.download.openIn()`

Hand a finished file to the host's opener (Quick Look / the system app for that type). The file never enters your sandbox.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `taskId` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

### `aibox.download.share()`

Present the native share sheet for a finished file.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `taskId` | string | ✓ |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

### `aibox.download.availability()`

Probe whether the download engine is usable right now. No consent prompt.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{available:boolean, reason?:string}`

```js
const a = await aibox.download.availability(); if (!a.available) hideDownloadUI()
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/DownloadCapabilityAdapter.swift`

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
