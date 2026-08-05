# 小应用桥接 API 参考

写小应用时查这里：每个 `aibox.<namespace>` 一篇，含方法签名、参数表、副作用档位、可直接抄的示例，
外加人工维护的兼容性与规划。

- 第一次写小应用？先读 [入门指南](../authoring-guide.md)（运行时约束、起步、发布流程）。
- 想理解协议本身（JSON-RPC 形状、权限模型、版本规则）？读主仓库 `docs/capabilities/applet/platform-protocol.md`。
- 应用内还有一份**按当前宿主实际安装能力生成**的 `.aibox/aibox.d.ts`；跑在真机上时它比本文档更准。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 生成，请勿手改 -->

当前宿主共 **48** 个命名空间、**254** 个方法。

## 容器内建

小应用平台内核。只碰 applet 自己的沙箱与声明合同，manifest 无需重复声明（`storage` / `net` / `ai` 走各自的权限位）。

| 命名空间 | 说明 | 方法 | 声明 |
|---|---|:--:|---|
| [`aibox.access`](access.md) | Explain the effective permission decision for a native capability or host tool. | 2 | 恒可用 |
| [`aibox.action`](action.md) | Expose or return applet actions to the host. | 1 | 恒可用 |
| [`aibox.ai`](ai.md) | The app's language model: prose (generate), typed objects (decide), and constrained choices (chooseAction). Needs permissions.ai; metered per applet; every call can fail, so keep a deterministic fallback. | 12 | 需 `ai` |
| [`aibox.apps`](apps.md) | Discover and invoke declared actions on installed applets without changing the host tool registry. | 4 | 恒可用 |
| [`aibox.chat`](chat.md) | Bind the current applet to its docked AI conversation and share compact, user-approved page context. | 7 | 恒可用 |
| [`aibox.data`](data.md) | Metadata about this applet's own private data: how much of its storage budget is left, and which version last wrote it. The budget is shared by aibox.storage, aibox.db and aibox.resource; going over it fails writes with aibox/quota-exceeded. | 4 | 恒可用 |
| [`aibox.db`](db.md) | Per-applet structured document collections with atomic persistence and exact-match queries. | 11 | 恒可用 |
| [`aibox.jobs`](jobs.md) | Persistent applet automations executed through short-lived headless action runtimes. | 6 | 恒可用 |
| [`aibox.lifecycle`](lifecycle.md) | Read host lifecycle state and subscribe to foreground, background, memory, locale, text-size and occlusion events. Subscribe to 'occluded'/'revealed' to stop animations and polling when the applet is no longer on screen: document.visibilitychange does NOT fire when another tab or an overlay covers the applet, so this is the only signal for that case. | 1 | 恒可用 |
| [`aibox.net`](net.md) | Native HTTP proxy with a per-host allowlist. Unlike browser fetch it can set Referer/User-Agent and read any charset, so use it for endpoints that reject browser requests or answer in GBK/Big5. | 1 | 需 `network` |
| [`aibox.resource`](resource.md) | Inspect, read or remove applet-scoped resources returned by native pickers. | 4 | 恒可用 |
| [`aibox.storage`](storage.md) | Per-applet persistent JSON key-value storage. | 4 | 需 `storage` |

## 应用级外壳

让小应用长得像一个 App：原生 Tab、导航栏、弹框、选择器、反馈。身份静态声明在 manifest，运行时只改显示状态。

| 命名空间 | 说明 | 方法 | 声明 |
|---|---|:--:|---|
| [`aibox.haptics`](haptics.md) | Trigger native haptic feedback on a physical device. | 3 | 需声明 `haptics` |
| [`aibox.list`](list.md) | Real native row gestures for your lists: UIContextMenuInteraction on long press and native swipe actions, driven by row rectangles your list reports. Web CSS cannot reproduce the lift-and-blur preview, the haptic curve or the swipe rubber-banding, which is most of what makes a list feel native. ALWAYS keep your own long-press/swipe fallback: configure returns rendered:false on surfaces that cannot host the layer. | 4 | 恒可用 |
| [`aibox.menu`](menu.md) | Read or update the display state of business menu items declared by manifest.scene.menu. | 3 | 恒可用 |
| [`aibox.navigation`](navigation.md) | Coordinate web history, native title, exit confirmation and edge-swipe behavior with the applet container. | 10 | 恒可用 |
| [`aibox.overlay`](overlay.md) | A persistent control layer the host draws ABOVE the bottom tab bar, declared by manifest.scene.overlay. Use it for controls that must always be reachable — a record button, a mini player, a batch-action bar. Do NOT hand-draw these with position:fixed: the host layer gets real Liquid Glass, correct safe-area and keyboard behaviour, and structural stacking with the tab bar. It reserves its own height, so it never covers the last row of your content. | 3 | 恒可用 |
| [`aibox.picker`](picker.md) | Let the user choose files or photos and return applet-scoped resource handles instead of Base64 payloads. | 2 | 需声明 `picker` |
| [`aibox.scene`](scene.md) | Inspect native presentation, appearance, safe areas and orientation, and request declared changes. | 3 | 恒可用 |
| [`aibox.tabs`](tabs.md) | The applet's own bottom tab bar, declared by manifest.scene.tabBar. The host renders it; switching tabs never reloads the WebView, so scroll position and in-memory state survive. | 4 | 恒可用 |
| [`aibox.toast`](toast.md) | Show a short native in-app message. | 1 | 需声明 `toast` |
| [`aibox.toolbar`](toolbar.md) | Navigation-bar buttons and the search field declared by manifest.scene.toolbar. The host back/close control and the ⋯ menu always remain. | 4 | 恒可用 |
| [`aibox.ui`](ui.md) | Present native alerts, confirmations, prompts and action sheets from a visible applet. | 4 | 需声明 `ui` |

## 系统能力投影

把宿主模块与系统能力投影成一等 `aibox.*` API。**能力缺席时整条命名空间不注册**——先探测再渲染入口。

| 命名空间 | 说明 | 方法 | 声明 |
|---|---|:--:|---|
| [`aibox.audio`](audio.md) | Record audio inside your own UI and turn your own audio into text. This is the ONLY way an applet can capture audio — getUserMedia and MediaRecorder do not work inside the applet WebView. Everything here works on applet-private resource handles and stays permanently available, independent of any host module. CHOOSING BETWEEN aibox.audio AND aibox.voiceMemos — ask one question: should the result show up in the user's own Voice Memos library? If yes, use aibox.voiceMemos (it drives the host module, opens host UI, and disappears when that module is not installed). If no, use aibox.audio: the product belongs to you, nothing is written to the user's library, and nothing here can vanish with a module. | 9 | 需声明 `audio` |
| [`aibox.browser`](browser.md) | Open a link in the in-app browser, the system browser, or an external browser app — and come back. Prefer this over open.url for anything the user should read and return from. | 3 | 需声明 `browser` |
| [`aibox.calendar`](calendar.md) | Read and manage calendar events and calendar subscriptions. | 2 | 需声明 `calendar` |
| [`aibox.clipboard`](clipboard.md) | Read or replace the system text clipboard. | 2 | 需声明 `clipboard` |
| [`aibox.contacts`](contacts.md) | Find or create contacts through the host Contacts tools. | 2 | 需声明 `contacts` |
| [`aibox.device`](device.md) | Read non-identifying device, locale, battery, and free-storage information. | 1 | 需声明 `device` |
| [`aibox.download`](download.md) | The host download engine, remote-controlled. Files land on the host (never in your applet sandbox) and keep downloading after your applet closes or the app is killed — a background URLSession does the transfer. You only ever handle taskIds and read-only metadata. Every method is automatically scoped to YOUR downloads: list/pauseAll/cancelAll can never see or touch another app's tasks. | 16 | 需声明 `download` |
| [`aibox.files`](files.md) | Browse and modify the host file-box workspace through stable file tools. | 17 | 需声明 `files` |
| [`aibox.health`](health.md) | Read Apple Health metrics, motion activity and workouts through the host health tools. | 4 | 需声明 `health` |
| [`aibox.location`](location.md) | Read location, geocode places and manage geofences through the host location module. | 6 | 需声明 `location` |
| [`aibox.media`](media.md) | Play applet-scoped audio assets with channel-aware controls. | 6 | 需声明 `media` |
| [`aibox.music`](music.md) | Search, browse and control Apple Music or local playback through the host music engine. | 19 | 需声明 `music` |
| [`aibox.notifications`](notifications.md) | Schedule local device notifications. | 1 | 需声明 `notifications` |
| [`aibox.open`](open.md) | Open a safe external URL or system handler. | 1 | 需声明 `open` |
| [`aibox.photos`](photos.md) | Search, inspect, OCR, save and explicitly mutate photos through the host media tools. | 5 | 需声明 `photos` |
| [`aibox.reminders`](reminders.md) | Read and manage reminders through the host reminders module. | 1 | 需声明 `reminders` |
| [`aibox.secrets`](secrets.md) | Keychain-backed credential storage, isolated per applet — and the session cookie jar behind aibox.net.fetch. Use this for anything that authenticates the user (login tokens, API keys), NEVER aibox.storage: storage is plaintext and goes into the user's backup. Cookies are handled for you: net.fetch injects and collects them automatically, so a login flow just needs to call the site's login endpoint and then read the session with hasSession(). | 7 | 需声明 `secrets` |
| [`aibox.share`](share.md) | Present the native system share sheet, as plain text or as a real file the user can save to Files or AirDrop. | 2 | 需声明 `share` |
| [`aibox.shortcuts`](shortcuts.md) | Run or open Apple Shortcuts from a visible applet. | 2 | 需声明 `shortcuts` |
| [`aibox.speech`](speech.md) | "On-device speech-to-text. This is the ONLY way an applet can take voice input — "                 + "getUserMedia and webkitSpeechRecognition do not work inside the applet WebView. "                 + "Audio never leaves the device." | 5 | 需声明 `speech` |
| [`aibox.tts`](tts.md) | Speak text with the device's speech synthesizer. Audible even when the ring switch is silent; other audio is ducked, not stopped. | 2 | 需声明 `tts` |
| [`aibox.video`](video.md) | Play video on the host's native full-screen player — the same engine the media library uses, so you get AirPlay, picture-in-picture, the lock-screen card and background audio for free. Your applet never owns the player: it sends commands and receives progress events. Use this for ANY video playback; a <video> tag inside an applet is blocked by CSP and dies the moment the app goes to the background. | 15 | 需声明 `video` |
| [`aibox.vision`](vision.md) | Read the text out of an image your applet already has — a photo the user picked, a screenshot, a scanned receipt. Runs entirely ON DEVICE (Vision framework); the image never leaves the phone and never goes to a model. This is the one to use for images from aibox.picker.photo/file; aibox.photos.ocr is a different thing (it reads images attached to the CHAT, not yours). | 2 | 需声明 `vision` |
| [`aibox.voiceMemos`](voiceMemos.md) | Remote-control the host Voice Memos module: browse, transcribe and analyze entries in the USER'S OWN memo library. CHOOSING BETWEEN aibox.voiceMemos AND aibox.audio — ask one question: should the result show up in the user's own Voice Memos library? If yes, use this namespace. If no, use aibox.audio instead: recordStart here opens the host's full-screen recorder ON TOP of your applet and files the result into the user's library (they end up with junk entries they never asked for), and you get back neither the audio bytes nor a live level meter. This whole namespace is a projection of a host module — it reports unavailable on builds where that module is not installed, whereas aibox.audio is always present. | 21 | 需声明 `voiceMemos` |

## 长尾工具网关

没有被升格为一等 API 的宿主工具，统一经此发现和调用。

| 命名空间 | 说明 | 方法 | 声明 |
|---|---|:--:|---|
| [`aibox.tools`](tools.md) | Discover and call the app's active AI tools through the same permission and audit pipeline used by the assistant. | 5 | 需声明 `tools` |

### 副作用档位

| 档位 | 含义 |
|---|---|
| `read` | **读取** — 只读，不改任何状态；不触发用户确认。 |
| `localWrite` | **本地写** — 改本机数据或系统状态；首次使用会弹一次授权。 |
| `external` | **外发** — 发往网络或模型；有配额与失败分支，必须有兜底。 |
| `presentation` | **呈现** — 弹出原生界面或播放；需要可见的 applet 运行时。 |
| `meta` | **元操作** — 改容器自身的声明或路由，不碰宿主数据。 |

<!-- GENERATED:END -->

## 维护契约

**descriptor 是唯一真值，本目录是它的投影。**（主仓库 `docs/capabilities/applet/framework-capabilities.md` §6 第 3 条）

```bash
node scripts/gen-api-docs.mjs           # 重新生成
node scripts/gen-api-docs.mjs --check   # 校验漂移（CI 跑的就是这条）
```

新增或修改一条宿主能力时：

1. 在宿主侧改 `AppletCapabilityDescriptor`（`AppletCapabilityCatalog.builtIns`、各 `*CapabilityAdapter.descriptor`，或 `AppletStandardCapabilityProjections.catalog`）。
2. 在市场仓库跑 `node scripts/gen-api-docs.mjs`，把 `docs/api/` 的改动一起提交。
3. 新命名空间会让生成器**硬失败**，直到你在 `scripts/gen-api-docs.mjs` 的 `NAMESPACE_GROUP` 里给它分组——这是故意的，逼你顺手把文档补齐。
4. 填掉新文件里「兼容性」与「接下来的规划」两段的待补占位。

### 手写增补写在哪

每篇文档里这两段之间的内容**归人维护，生成器不会覆盖**：

```md
<!-- MANUAL:BEGIN compat -->   ... 兼容性 ...    <!-- MANUAL:END compat -->
<!-- MANUAL:BEGIN roadmap -->  ... 规划 ...      <!-- MANUAL:END roadmap -->
```

`<!-- GENERATED:BEGIN -->` … `<!-- GENERATED:END -->` 之间的内容则相反：手改一定会被下次生成冲掉，CI 也会先一步拦住。

### CI 怎么卡的

市场是独立仓库，CI 里没有宿主 Swift 源码，所以校验分两段：

| 场景 | `--check` 做什么 |
|---|---|
| 本地（宿主源码在场） | Swift → snapshot → Markdown 全链校验，能抓「宿主改了能力但没重新生成」 |
| CI（只有市场仓库） | snapshot → Markdown 校验，能抓「有人手改了生成内容」或「漏提交 snapshot」 |

`capabilities.snapshot.json` 是这两段之间的中间产物，**必须跟文档一起提交**。

<!-- MANUAL:BEGIN notes -->
### 本目录**不**覆盖什么

descriptor 只描述 `aibox.<namespace>.<method>()` 这一种形状的桥调用。以下几类能力没有 descriptor，
因此**永远不会出现在生成内容里**，查它们请去主仓库文档或应用内的 `.aibox/aibox.d.ts`：

| 不在这里的东西 | 去哪查 |
|---|---|
| 事件总线（`aibox.tabs.on(...)`、`aibox.events.*`、生命周期回调） | `docs/capabilities/applet/platform-protocol.md` §5.6 |
| `applet://` URL 路由（虚拟文件系统、图片走宿主缓存） | `docs/capabilities/applet/framework-capabilities.md` §3.3 |
| `manifest.json` 的静态声明（`scene.tabBar` / `toolbar` / `menu` / `presentation`） | `docs/capabilities/applet/app-shell-and-market.md` §1–§3 |
| 运行时约束（可用 npm 包、CSP、白屏排查） | [入门指南](../authoring-guide.md) |

一条经验：**外壳类能力都是「manifest 静态声明身份 + JSAPI 运行时改显示状态」的两段式**。
本目录只讲后一半；只读本目录会以为 Tab 可以凭空创建出来。
<!-- MANUAL:END notes -->
