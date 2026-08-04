// 本地类型补丁——**只剩宿主工具投影的返回信封**。
//
// ## 2026-08-04：`aibox.audio.*` 那一整块已删（93 行）
//
// 删除前提兑现了：descriptor 加了机器可读的 `resultSchemaJSON`（与 `parametersJSON` 对称），
// `audio` 的 9 个方法逐条对着**真实返回构造**填了 schema，于是 SDK 生成的签名从
// `Promise<unknown>` 变成了具体类型，连 `recordStop` 的两支联合都带**字面量判别式**
// （`discarded: false | true`），`if (!r.discarded) player.src = r.url` 现在能正确收窄。
// 实测：删掉那 93 行后 `tsc --noEmit` **零错误**（此前是 20+ 条）。
//
// 生成的类型比这份手写补丁更准 —— 它带上了散文摘要漏掉的 `createdAt`，
// 也把 `reason` / `state` 收成了真实的枚举字面量联合，而不是宽泛的 `string`。
//
// ## 剩下的这一段为什么还不能删
//
// `ToolEnvelope` 描述的是 `HostToolProjectionCapabilityAdapter` 升格来的那类方法
// （voiceMemos 的 21 个）的统一返回信封。它们的形状由投影层保证、不逐条声明 schema，
// 在棘轮 `audit-result-schema.mjs` 里按类型豁免，因此生成侧不会有它的类型。
// 要删它，得先把这个信封提升成宿主侧的一等类型（那是另一件事）。
//
// **不改 SDK 包**：那是 `npm run sdk:types` 从宿主源码重新生成的产物，手改会被覆盖，
// 而"漂移的类型比没有类型更糟"。
// 纪律同 `aibox-global.d.ts`：**本文件必须保持为 global script**（无顶层 import/export）。

declare namespace aibox {
  /** 宿主工具投影的统一返回信封。多数 memo 工具把 JSON 直接放在 `text` 里，不走 `details`。 */
  interface ToolEnvelope {
    ok?: boolean
    isError?: boolean
    text?: string
    permission?: string
    details?: unknown
    progress?: unknown
    artifacts?: unknown
  }


}
