# `aibox.net`

> Native HTTP proxy with a per-host allowlist. Unlike browser fetch it can set Referer/User-Agent and read any charset, so use it for endpoints that reject browser requests or answer in GBK/Big5.

**分组** 容器内建 ｜ **方法数** 1 ｜ **声明要求** 需要 `manifest.permissions.network: true` 加 `networkAllowed` 精确域名白名单。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.net.fetch()`

Perform an HTTP request. Defaults to UTF-8 text truncated at 200KB; set responseType 'base64' for binary or non-UTF-8 payloads and decode with TextDecoder, and raise maxBytes for large ones. Always check the returned truncated flag.

**副作用档位** `external`（外发）— 发往网络或模型；有配额与失败分支，必须有兜底。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| `url` | string | ✓ |  |
| `options` | object |  |  |
| `options.method` | `GET` \| `POST` \| `PUT` \| `PATCH` \| `DELETE` \| `HEAD` |  |  |
| `options.headers` | object |  | Passed through verbatim, including Referer and User-Agent which browser fetch forbids. |
| `options.body` | string |  |  |
| `options.responseType` | `text` \| `base64` \| `json` |  | text (default) decodes UTF-8 and yields '' for other charsets; base64 returns raw bytes; json parses for you. |
| `options.maxBytes` | integer |  | Response cap; default 200000, maximum 10485760. |

未列出的字段会被拒绝（`additionalProperties: false`）。

**返回** `{status, headers, body, contentType, truncated, bytes}`

```js
const r = await aibox.net.fetch(url, { headers: { Referer: 'https://finance.sina.com.cn' }, responseType: 'base64' }); const gbk = new TextDecoder('gb18030').decode(Uint8Array.from(atob(r.body), c => c.charCodeAt(0)))
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **宿主版本**：1.0 起（宿主当前只有 1.0；将来能力上新时用 `release.mjs --min-host` 卡住老宿主）
- **可用 surface**：page / fullscreen / sheet / drawer / card / tab / headless —— **全部**
- **宿主变体**：Full ✅ ／ Lean ✅
- **manifest 声明**：`permissions.network: true` + `networkAllowed` 精确域名白名单（**不能写 `"*"`**，`validate.mjs` 会拒）。
- **iOS 系统授权**：无。
- **降级行为**：域名不在白名单 → reject。页面里直接 `fetch` 外部地址被 CSP + ContentRuleList 双闸锁死，联网**只有这一个出口**。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
- **二进制与非 UTF-8 响应 —— P0，已落地**：`responseType: 'base64'` 与 `maxBytes` 已在上面的参数表里。GBK/Big5 站点用 `base64` + `TextDecoder('gb18030')`。见 主仓库 `docs/capabilities/applet/framework-capabilities.md` §3.35。
- 记得每次都查返回的 `truncated` 标志——截断是静默的。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
