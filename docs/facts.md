# 小应用平台事实基线（生成）

> 手写文档里凡是「几个命名空间 / 几个方法 / 覆盖率多少 / 几份分叉」这类数字，**一律引用本页**，
> 不要抄进正文——抄进去的数字一天就会过期（2026-08-03→04 实测：命名空间 39→47、应用 7→11、分叉 4→8）。

<!-- FACTS:BEGIN -->
<!-- 由 applet-market/scripts/gen-facts.mjs 生成，请勿手改。刷新： node scripts/gen-facts.mjs -->

| 事实 | 当前值 | 真值源 |
|---|---|---|
| 桥命名空间 | 48 | `docs/api/capabilities.snapshot.json` |
| 桥方法（合计 / 可声明 / 工具投影） | 254 / 174 / 80 | 同上 |
| **返回类型覆盖（生成签名）** | 108/108（100%）—— 真正吃 `Promise<unknown>` 的那批 | `resultSchemaJSON` 字段 |
| 返回类型覆盖（含手写签名命名空间） | 108/174（62.1%）—— 其余那批补了只改文档 | 同上 |
| 生成的 `aibox-global.d.ts` | 1846 行 / 271 个签名 / 80 个 `Promise<unknown>` | `packages/aibox-sdk/src/generated/` |
| 市场应用（总数 / bundle 型 / 用 SDK） | 11 / 11 / 11 | `apps/*/package.json` |
| 应用 host 适配层（TS/JS） | 9 份、2393 行 | `apps/*/src/lib/host.{ts,js}` |
| 应用源码中的遗留 JS/JSX | 0 个文件 | `apps/*/src/**/*.{js,jsx}` |
| SDK | v1.1.0，17 个模块 / 2088 行 | `packages/aibox-sdk/` |

<!-- FACTS:END -->

## 怎么读这几个数

- **返回类型覆盖**是这条链上最关键的单一指标：未覆盖的方法在 SDK 与 `.aibox/aibox.d.ts` 里都是
  `Promise<unknown>`，应用侧只能自己手写补丁或按文案猜。由 `audit-result-schema.mjs` 棘轮只减不增。
- **工具投影**那部分不计入覆盖率：它们返回统一信封，形状由投影层保证，按类型豁免。
- **应用 host 适配层**只应保留领域语义封装，底层桥接、兼容判断和降级逻辑统一来自宿主内置 `aibox/sdk`。
- **遗留 JS/JSX**由 TypeScript 策略门禁控制，只允许减少；新应用和新源码必须使用严格 TypeScript。
