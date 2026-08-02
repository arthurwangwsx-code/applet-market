# `aibox.share`

> Present the native system share sheet, as plain text or as a real file the user can save to Files or AirDrop.

**分组** 系统能力投影 ｜ **方法数** 2 ｜ **声明要求** 需要在 `manifest.permissions.capabilities` 里声明 `"share"`。**声明 ≠ 授权**，用户仍会被逐项询问。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.share.text()`

Share text with an optional URL.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `text` | string | ✓ |  |
| `url` | string |  |  |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `boolean`

```js
await aibox.share.text({ text: 'Look at this', url: 'https://example.com' })
```

### `aibox.share.file()`

Export content as a real named file and hand it to the share sheet. Use this for CSV/JSON/OPML exports — text shares the content as a message body, not as a file. Max 10MB; filename must be a bare name.

**副作用档位** `presentation`（呈现）— 弹出原生界面或播放；需要可见的 applet 运行时。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `filename` | string | ✓ | Bare file name with extension, e.g. ledger-2026-08.csv. No slashes, no .., no leading dot. |
| `content` | string | ✓ | utf8 text, or base64 bytes when encoding is base64. |
| `mimeType` | string |  | Advisory; the file extension wins when they disagree. |
| `encoding` | `utf8` \| `base64` |  | Default utf8. Use base64 for binary. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{shared:boolean, filename:string, bytes:number, warning?:string}`

```js
await aibox.share.file({ filename: 'ledger-2026-08.csv', content: csvText, mimeType: 'text/csv' })
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/ShareCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：需要可见运行时；`share.file` 另有一道显式的可见性检查
- **宿主变体**：Full ✅ ／ Lean ⚠️ 取决于壳是否注册了 `SharePresenting`
- **manifest 声明**：需声明 `"share"`。
- **iOS 系统授权**：无。
- **降级行为**：缺席时整条命名空间不进目录，先探测再渲染分享按钮。用户在系统分享面板里取消不算失败。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **文件导出（分享成真文件）** 在 主仓库 `docs/capabilities/applet/framework-capabilities.md` §2 的总账里标记为「🚧 本轮」——把 applet 产物导出成系统层面的真文件，而不只是文本。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
