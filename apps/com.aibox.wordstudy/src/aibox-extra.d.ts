// `aibox.speech.*` 的本地类型补丁。
//
// 真值在
// `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/SpeechRecognitionCapabilityAdapter.swift`
// 的 descriptor，本文件按它逐字誊写签名。
//
// **不改 SDK 包**：那是另一条流水线的产物（`npm run sdk:types` 从宿主源码重新生成），
// 手改会在下一次生成时被覆盖，而"漂移的类型比没有类型更糟"。
//
// ## 2026-08-03 更正：快照已刷新，但本文件**还不能删**
//
// 原注释写着「等快照刷新后本文件可整份删掉」。快照已经刷到 42 命名空间（`aibox.audio` /
// `aibox.speech` / `aibox.list` 都进去了），SDK 也重新生成过 —— 实测删掉本文件后 `tsc --noEmit`：
//
//   src/lib/host.ts(95,9): error TS18046: 'value' is of type 'unknown'.   ×6
//
// 命名空间确实有了，**返回类型仍是 `Promise<unknown>`**。原因见主仓库
// `docs/capabilities/applet/sdk-architecture.md` §5.1：descriptor 只有机器可读的入参 schema
//（`parametersJSON`），返回侧只有散文 `resultSummary`，于是 185 个方法里 126 个（68%）的生成签名
// 一律是 `Promise<unknown>`。
//
// **真正的删除前提是 §5.1 的 `resultSchemaJSON`（落地顺序第 12 步），不是刷快照。**
// 在那之前本文件是「返回 schema 缺失」在应用侧的形状，删了就是把类型换成一堆 `as` 断言。
//
// 与 `aibox-global.d.ts` 同样的纪律：**本文件必须保持为 global script**（无顶层 import/export），
// 否则 `declare namespace aibox` 会变成模块内可见，全仓 `aibox.*` 类型一起失效。

declare namespace aibox {
  namespace speech {
    /** 不弹框、不开麦克风的探测。挂载时调一次，不可用就别渲染麦克风入口。 */
    function availability(input?: { locale?: string }): Promise<{
      available: boolean
      supportsOnDevice: boolean
      microphone: string
      speech: string
      locale: string
      reason?: string
    }>

    /**
     * 开麦克风并解析出文本。`stop()`、`maxDurationMs` 到点、或引擎自己定稿时 resolve。
     * 按住说话：按下时 **不 await** 地调 `recognize()`，松手调 `stop()`，再 await 那个 promise。
     */
    function recognize(input?: {
      /** BCP-47。跟读评分**必须**显式传：识别器语言不对会把发音相近的词转成另一种语言，分数全错。 */
      locale?: string
      /** 硬上限，默认 10000。到点是定稿，不是丢弃。 */
      maxDurationMs?: number
      /** 保持中间结果，默认 true；从 `status().partial` 读。 */
      onPartial?: boolean
    }): Promise<{
      transcript: string
      confidence: number
      locale: string
      cancelled: boolean
      timedOut: boolean
      onDevice: boolean
    }>

    /** 停止采集，让在途的 `recognize()` 用最终文本 resolve。 */
    function stop(): Promise<boolean>
    /** 放弃在途的 `recognize()`，它会以 `cancelled:true` + 空文本 resolve。 */
    function cancel(): Promise<boolean>
    /** 轮询在途会话：已用时长与目前的中间文本。 */
    function status(): Promise<{ recognizing: boolean; elapsedMs: number; partial: string; locale: string }>
  }
}
