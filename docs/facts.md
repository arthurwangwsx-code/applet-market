# 小应用平台事实基线（生成）

> 手写文档里凡是「几个命名空间 / 几个方法 / 覆盖率多少 / 几份分叉」这类数字，**一律引用本页**，
> 不要抄进正文——抄进去的数字一天就会过期（2026-08-03→04 实测：命名空间 39→47、应用 7→11、分叉 4→8）。

<!-- FACTS:BEGIN -->
<!-- 由 applet-market/scripts/gen-facts.mjs 生成，请勿手改。刷新： node scripts/gen-facts.mjs -->

| 事实 | 当前值 | 真值源 |
|---|---|---|
| 桥命名空间 | 47 | `docs/api/capabilities.snapshot.json` |
| 桥方法（合计 / 可声明 / 工具投影） | 252 / 172 / 80 | 同上 |
| **返回类型覆盖（生成签名）** | 106/106（100%）—— 真正吃 `Promise<unknown>` 的那批 | `resultSchemaJSON` 字段 |
| 返回类型覆盖（含手写签名命名空间） | 106/172（61.6%）—— 其余那批补了只改文档 | 同上 |
| 生成的 `aibox-global.d.ts` | 1199 行 / 266 个签名 / 80 个 `Promise<unknown>` | `packages/aibox-sdk/src/generated/` |
| 市场应用（总数 / bundle 型 / 用 SDK） | 11 / 11 / 11 | `apps/*/package.json` |
| `host.js` 分叉 | 8 份、1630 行 | `apps/*/src/lib/host.js` |
| SDK | v1.0.0，16 个模块 / 1750 行 | `packages/aibox-sdk/` |

<!-- FACTS:END -->

## 怎么读这几个数

- **返回类型覆盖**是这条链上最关键的单一指标：未覆盖的方法在 SDK 与 `.aibox/aibox.d.ts` 里都是
  `Promise<unknown>`，应用侧只能自己手写补丁或按文案猜。由 `audit-result-schema.mjs` 棘轮只减不增。
- **工具投影**那部分不计入覆盖率：它们返回统一信封，形状由投影层保证，按类型豁免。
- **`host.js` 分叉**是「同一件事有几个答案」的直接度量。它每多一份，AI 就多一个可继承的矛盾范例。
