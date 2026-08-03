// `aibox.audio.*` 的本地类型补丁（2.0.0：`aibox.voiceMemos.*` 那半段已随两条线合并删除）。
//
// 真值：
//  · `Runtime/Capabilities/AudioRecordingCapabilityAdapter.swift` 的 descriptor
//  · `Runtime/Capabilities/HostToolProjectionCapabilityAdapter.swift`（voiceMemos 的 21 个方法）
//
// **不改 SDK 包**：那是 `npm run sdk:types` 从宿主源码重新生成的产物，手改会被覆盖，
// 而"漂移的类型比没有类型更糟"。
//
// ## 2026-08-03 更正：快照已刷新，但本文件**还不能删**
//
// 原注释写着「等快照刷新后本文件可整份删掉」。快照已经刷到 42 命名空间（`aibox.audio` 进去了），
// SDK 也重新生成过 —— 实测删掉本文件后 `tsc --noEmit` 仍有 20+ 条：
//
//   src/lib/memos.ts(51,103): error TS2694: Namespace 'aibox' has no exported member 'ToolEnvelope'.
//   src/lib/memos.ts(222,18): error TS18046: 'value' is of type 'unknown'.   ×20
//
// 命名空间确实有了，**返回类型仍是 `Promise<unknown>`**。原因见主仓库
// `docs/capabilities/applet/sdk-architecture.md` §5.1：descriptor 只有机器可读的入参 schema，
// 返回侧只有散文 `resultSummary`，于是 68% 的生成签名一律是 `Promise<unknown>`；
// `voiceMemos` 更是由 `HostToolProjectionCapabilityAdapter` 升格而来，连入参 schema 都在运行时才有。
//
// **真正的删除前提是 §5.1 的 `resultSchemaJSON`（落地顺序第 12 步），不是刷快照。**
//
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

  namespace audio {
    /** 不弹框、不开麦克风的探测。挂载时调一次，不可用就别渲染录音按钮。 */
    function availability(): Promise<{
      available: boolean
      microphone: string
      supportsBackgroundRecording: boolean
      busy: boolean
      reason?: string
    }>

    /**
     * 起录。**不弹任何宿主界面** —— 与 `voiceMemos.recordStart` 的关键区别就在这里
     * （后者会把宿主录音全屏页顶到前台，盖掉小应用）。已有录音在跑时回 `aibox/busy`。
     */
    function recordStart(input?: {
      format?: 'm4a' | 'wav'
      sampleRate?: number
      bitrate?: number
      channels?: 1 | 2
    }): Promise<{
      started: boolean
      /** `started:false` + `discarded:true` = 权限框还开着时就被 stop 了，什么都没录到。 */
      discarded: boolean
      format?: string
      sampleRate?: number
      channels?: number
      supportsBackgroundRecording?: boolean
    }>

    function recordPause(): Promise<boolean>
    function recordResume(): Promise<boolean>

    /** 停录定稿。< 500ms 的片段直接丢弃（`discarded:true`），不写文件。 */
    function recordStop(): Promise<{
      discarded?: boolean
      durationMs: number
      handle?: string
      /** 同源 `applet://` URL，可以直接 `<audio src>` / `fetch` / `decodeAudioData`。 */
      url?: string
      name?: string
      mimeType?: string
      size?: number
      byteCount?: number
      format?: string
      sampleRate?: number
      channels?: number
      interrupted?: boolean
    }>

    function recordCancel(): Promise<boolean>

    /**
     * 转写能力探测。**不弹框、不转写。**
     * `state` 的分档决定的是**完全相反**的 UI：`engine-missing` 要把整个转写入口藏掉，
     * `needs-model-download` 要照常显示（第一次点会先下模型）。别把它压成一个布尔。
     */
    function transcribeAvailability(input?: { locale?: string }): Promise<{
      available: boolean
      /** available | needs-model-download | not-authorized | unsupported-locale | unsupported-os | engine-missing */
      state: string
      locale: string
      /** 这个宿主构建里到底有没有转写引擎。 */
      engine: boolean
    }>

    /**
     * 把**自己的**一段音频转成文字。输入是 `resource://` 句柄（不是路径——applet 没有路径，
     * 宿主在它那一侧解析）。长录音是分钟级重活，每个 applet 同时只允许一条，撞上回 `aibox/busy`。
     */
    function transcribe(input: { handle: string; locale?: string; segments?: boolean }): Promise<{
      text: string
      locale: string
      segmentCount: number
      /** `segments:false` 时不返回。start/duration/end 单位是秒。 */
      segments?: { text: string; start: number; duration: number; end: number }[]
    }>

    /**
     * 录音中轮询。`levels` 是最近 120 个样本（20 Hz、约 6 秒），**已经按原生同一条曲线归一到 0…1**，
     * 最旧的在前 —— 左侧补零、最新的贴右边缘画，就与原生逐像素同口径。
     */
    function recordStatus(): Promise<{
      state: string
      recording: boolean
      paused: boolean
      interrupted: boolean
      elapsedMs: number
      byteCount: number
      levels: number[]
      levelsHz: number
      averageDb: number
      peakDb: number
    }>
  }

}
