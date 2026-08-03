// `aibox.audio.*` 与 `aibox.voiceMemos.*` 的本地类型补丁。
//
// SDK 的 `generated/aibox-global.d.ts` 是从 `docs/api/capabilities.snapshot.json` 派生的：
//  · `aibox.audio`（2026-08 新落的应用内录音）**还没进快照**，SDK 里查不到；
//  · `aibox.voiceMemos` 在快照里，但由 `HostToolProjectionCapabilityAdapter` 升格而成，
//    SDK 只给到 `Promise<unknown>` —— 这里补一个 `ToolEnvelope` 别名，让调用点少写一堆断言。
//
// 真值：
//  · `Runtime/Capabilities/AudioRecordingCapabilityAdapter.swift` 的 descriptor
//  · `Runtime/Capabilities/HostToolProjectionCapabilityAdapter.swift`（voiceMemos 的 20 个方法）
//
// **不改 SDK 包**：那是 `npm run sdk:types` 从宿主源码重新生成的产物，手改会被覆盖，
// 而"漂移的类型比没有类型更糟"。等快照刷新后本文件可整份删掉。
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

  namespace voiceMemos {
    function list(input?: { folderId?: string; favOnly?: boolean; query?: string }): Promise<ToolEnvelope>
    function get(input: { id: string }): Promise<ToolEnvelope>
    function recordStart(input?: { title?: string }): Promise<ToolEnvelope>
    function recordControl(input: { action: 'pause' | 'resume' | 'stop' }): Promise<ToolEnvelope>
    function recordStatus(input?: Record<string, never>): Promise<ToolEnvelope>
    function transcribe(input: { id: string; locale?: string }): Promise<ToolEnvelope>
    function transcript(input: { id: string }): Promise<ToolEnvelope>
    function play(input: { id: string }): Promise<ToolEnvelope>
    function stop(input?: Record<string, never>): Promise<ToolEnvelope>
    function seek(input: { seconds?: number; percentage?: number }): Promise<ToolEnvelope>
    function rename(input: { id: string; title: string }): Promise<ToolEnvelope>
    function move(input: { id: string; folderId?: string }): Promise<ToolEnvelope>
    function favourite(input: { id: string }): Promise<ToolEnvelope>
    function summarize(input: { id: string }): Promise<ToolEnvelope>
    function actionItems(input: { id: string; force?: boolean }): Promise<ToolEnvelope>
    function ask(input: { id: string; question: string }): Promise<ToolEnvelope>
    /** ⚠️ **破坏性**：直接改写 fullText 并置 isEdited。 */
    function cleanTranscript(input: { id: string }): Promise<ToolEnvelope>
    function chapters(input: { id: string; force?: boolean }): Promise<ToolEnvelope>
    // `delete` / `import` 是 TS 保留字，`declare namespace` 里声明不出来 —— 桥上它们**确实**叫
    // 这两个名字（`memo_delete` / `memo_import` 的投影）。调用点用方括号取，见 `lib/memos.ts`。
    // ⚠️ `delete` 是**永久删除**（删音频 + 删记录），不是移到最近删除。
  }
}
