# `aibox.tts`

> Speak text with the device's speech synthesizer. Audible even when the ring switch is silent; other audio is ducked, not stopped.

**分组** 系统能力投影 ｜ **方法数** 2 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"tts"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.tts.speak()`

Speak text aloud. Returns as soon as speaking starts (it does not wait for the end).

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `text` | string | ✓ |  |
| `lang` | string |  | BCP-47 tag such as en-US or zh-CN. Omit to auto-detect from the text — do not pass the wrong one, a mismatched voice reads nothing. |
| `rate` | number |  | 0…1, default 0.5 (system default speed). |
| `pitch` | number |  | 0.5…2.0, default 1. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

```js
await aibox.tts.speak({ text: 'Hello', lang: 'en-US' })
```

### `aibox.tts.stop()`

Stop what this applet is currently speaking.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `boolean`

```js
await aibox.tts.stop()
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/SpeechCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：需要可见运行时
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：需声明 `"tts"`。
- **iOS 系统授权**：无。
- **降级行为**：**这条不会哑**：宿主统一 TTS 在场时走真服务商（云端音色 / 锁屏 now-playing / 与聊天朗读互不打断）；不在场时适配器自持本地合成器兜底。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
暂无已知缺口。全局能力总账见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
