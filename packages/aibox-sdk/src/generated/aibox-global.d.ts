// 本文件由 applet-market/scripts/gen-sdk-types.mjs 生成，请勿手改。
// 真值：
//   · Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletDeveloperSDK+TypeScript.swift（platformTypeScript）
//   · Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletDeveloperSDK.swift（aiTypeScript）
//   · applet-market/docs/api/capabilities.snapshot.json（descriptor 快照，由 gen-api-docs.mjs 抽取）
// 重新生成： npm run sdk:types      漂移检查： npm run sdk:types:check
// 命名空间：48 个（宿主恒有 16 个、可声明 29 个）

/* eslint-disable */
declare namespace aibox {
  type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue }

  interface BridgeProtocolInfo {
    current: "2.0"
    supported: Array<"1.0" | "2.0">
    transport: "WKScriptMessageHandlerWithReply"
  }
  function protocol(): BridgeProtocolInfo
  function rpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>
  function invoke<T = unknown>(namespace: string, method: string, args?: Record<string, unknown>): Promise<T>
  function capabilities(): Record<string, string[]>
  function capabilityDescriptors(): Array<{
    namespace: string
    summary: string
    methods: Array<{ name: string; summary: string; parametersJSON: string; resultSummary: string; effect: string; example?: string }>
  }>

  namespace storage {
    function get(key: string): Promise<JSONValue | null>
    function set(key: string, value: JSONValue): Promise<boolean>
    function list(): Promise<string[]>
    function remove(key: string): Promise<boolean>
  }

  namespace net {
    type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD"
    /** text decodes UTF-8 (any other charset yields ""); base64 returns raw bytes; json parses for you. */
    type ResponseType = "text" | "base64" | "json"
    interface FetchOptions {
      method?: Method
      /** Passed through verbatim — including Referer and User-Agent, which browser fetch forbids. */
      headers?: Record<string, string>
      body?: string
      responseType?: ResponseType
      /** Response cap in bytes. Default 200000, maximum 10485760. */
      maxBytes?: number
    }
    interface FetchResponse {
      status: number
      headers: Record<string, string>
      /** string for text/base64; the parsed value for json. */
      body: string | unknown
      contentType: string | null
      /** true when the body was cut off at maxBytes — never treat a truncated body as the whole answer. */
      truncated: boolean
      /** Bytes the server actually returned, before truncation. */
      bytes: number
    }
    /**
     * Native HTTP proxy. For GBK/Big5/Shift_JIS endpoints use responseType 'base64' and decode
     * in JS: new TextDecoder('gb18030').decode(Uint8Array.from(atob(res.body), c => c.charCodeAt(0)))
     */
    function fetch(url: string, options?: FetchOptions): Promise<FetchResponse>
  }

  namespace access {
    interface Gate { name: string; passed: boolean; detail: string }
    interface Decision {
      target: string
      allowed: boolean
      code: string
      failedGate: string | null
      gates: Gate[]
      remedies: string[]
    }
    function summary(): Promise<{
      protocol: { current: string; supported: string[] }
      tier: string
      developerFullAccess: boolean
      securityMode: string
      declaredCapabilities: string[]
      toolRequirements: Record<string, unknown>
    }>
    function explain(input: { tool: string } | { capability: string; method?: string }): Promise<Decision>
  }

  namespace events {
    /** Returns an unsubscribe function. Environment events include localeChanged and textSizeChanged. */
    function on<T = unknown>(name: string, handler: (payload: T) => void): () => void
    function off<T = unknown>(name: string, handler: (payload: T) => void): void
  }

  namespace lifecycle {
    type StateName = "active" | "inactive" | "background" | "unknown"
    interface State {
      state: StateName
      /** Effective host UI locale, including an in-app language override. */
      locale: string
      /** BCP-47 language code suitable for document.documentElement.lang. */
      language: string
      contentSizeCategory: string
      lowPowerMode: boolean
      /** This applet's own surface is on screen right now. */
      visible: boolean
      /** Inverse of visible: nothing of this applet is on screen. Stop animations and polling. */
      occluded: boolean
      /** Host surface activity for this applet: "active" | "inactive" | "background". */
      surfaceActivity: string
      /**
       * The host stops this applet's rendering loop while it is occluded.
       * When false, nothing stops your timers for you — you must stop them yourself.
       */
      hostSuspendsWhenOccluded: boolean
    }
    function getState(): Promise<State>
    /**
     * "occluded" fires when this applet is fully off screen (another tab selected, host in the
     * background, an overlay covering it) and "revealed" when it comes back.
     *
     * Why this exists: document.visibilitychange only fires when WebKit considers the whole page
     * hidden — it does NOT fire when the host merely covers the applet, so an applet that only
     * listens to visibilitychange keeps burning CPU at 60fps behind whatever is on top of it.
     * Both events carry State plus a `reason` string.
     *
     *   const off = aibox.lifecycle.on("occluded", () => { cancelAnimationFrame(raf); clearInterval(tick) })
     *   aibox.lifecycle.on("revealed", () => { raf = requestAnimationFrame(loop); tick = setInterval(poll, 1000) })
     */
    function on(event: "active" | "inactive" | "foreground" | "background" | "memoryWarning" | "occluded" | "revealed", handler: (state: State & { reason?: string }) => void): () => void
  }

  namespace scene {
    type Surface = "card" | "sheet" | "drawer" | "page" | "fullscreen" | "tab" | "headless"
    type RequestableSurface = "sheet" | "drawer" | "page" | "fullscreen"
    type InterfaceOrientation = "portrait" | "landscapeLeft" | "landscapeRight"
    interface State {
      /** Manifest-declared default surface. May differ from effective when the host applies a fallback. */
      requested: Surface
      /** Surface currently provided by the host. */
      effective: Surface
      /** Backward-compatible alias of effective. */
      current: Surface
      allowed: Surface[]
      requestable: RequestableSurface[]
      appearance: {
        requestedColorScheme: "automatic" | "light" | "dark"
        effectiveColorScheme: "light" | "dark" | "unspecified"
        accentColor: string | null
        backgroundColor: string | null
        statusBar: { visibility: string; contentStyle: string; backdrop: string | null }
        navigationBar: { style: string; contentStyle: string; background: string | null; showsIcon: boolean }
      }
      orientation: {
        supported: InterfaceOrientation[]
        preferred: InterfaceOrientation | null
        behavior: "responsive" | "preferred" | "lockedWhileVisible"
        requested: InterfaceOrientation | null
        effective: InterfaceOrientation
        requestable: boolean
      }
      safeArea: { top: number; leading: number; bottom: number; trailing: number }
    }
    function getState(): Promise<State>
    function requestPresentation(input: RequestableSurface | { surface: RequestableSurface }): Promise<State>
    function requestOrientation(input: InterfaceOrientation | { orientation: InterfaceOrientation }): Promise<State>
    function on(event: "changed" | "presentationChanged" | "orientationChanged" | "safeAreaChanged" | "appearanceChanged", handler: (state: unknown) => void): () => void
  }

  namespace menu {
    interface ItemState {
      title: string
      icon: string | null
      enabled: boolean
      hidden: boolean
    }
    interface State {
      declared: boolean
      mergePolicy?: "appletFirst" | "hostFirst"
      hostPlacement?: "inline" | "submenu" | "hidden"
      hostItems?: string[]
      items: Record<string, ItemState>
    }
    interface ItemPatch {
      title?: string | null
      icon?: string | null
      enabled?: boolean | null
      hidden?: boolean | null
    }
    function getState(): Promise<State>
    function update(input: { items: Record<string, ItemPatch> }): Promise<State>
    function reset(): Promise<State>
    function on(event: "changed", handler: (state: State) => void): () => void
    /** A declared item WITHOUT an actionID fires this instead of running an action — handle it
     *  yourself. That is how a menu entry opens a panel, toggles a view or shares the current
     *  page: those render inside your page, so they cannot be expressed as headless actions.
     *  Declare the items in manifest scene.menu and they appear in the system ... menu; there is
     *  no reason to draw a second ... button in your content. */
    function on(event: "invoke", handler: (event: { id: string }) => void): () => void
  }

  namespace tabs {
    interface ItemState {
      id: string
      title: string
      icon: string | null
      selectedIcon: string | null
      badge: string | null
      enabled: boolean
      hidden: boolean
    }
    interface State {
      declared: boolean
      style: "glass" | "plain"
      items: ItemState[]
      selected: string
      /** false on card/sheet/drawer surfaces — fall back to your own in-page segmented control. */
      rendered: boolean
    }
    interface ItemPatch {
      title?: string | null
      icon?: string | null
      badge?: string | null
      enabled?: boolean | null
      hidden?: boolean | null
    }
    function getState(): Promise<State>
    /** Same as a user tap, including the changed event. */
    function select(id: string | { id: string }): Promise<State>
    /** Tabs cannot be added, removed or re-identified at runtime. */
    function update(input: { items: Record<string, ItemPatch> }): Promise<State>
    function reset(): Promise<State>
    function on(event: "changed", handler: (state: State) => void): () => void
  }

  /**
   * 悬浮层：宿主画在底栏之上的**常驻控制层**（录音键、迷你播放器、批量操作条）。
   * 不要用 position:fixed 自绘 —— 自绘补不齐材质、安全区、键盘避让与和底栏的层叠。
   * 它自己占掉那份高度，所以永远不会盖住内容的最后一行。
   */
  namespace overlay {
    interface ControlState {
      id: string
      icon: string | null
      activeIcon: string | null
      tint: "default" | "accent" | "danger"
      active: boolean
      enabled: boolean
    }
    interface ItemState {
      id: string
      kind: "bar" | "button"
      icon: string | null
      activeIcon: string | null
      title: string | null
      subtitle: string | null
      tint: "default" | "accent" | "danger"
      progress: number | null
      active: boolean
      enabled: boolean
      hidden: boolean
      controls: ControlState[]
    }
    interface State {
      declared: boolean
      /** false on card/sheet/drawer surfaces — put the controls back into your content flow. */
      rendered: boolean
      items: ItemState[]
    }
    interface ControlPatch {
      icon?: string | null
      activeIcon?: string | null
      tint?: "default" | "accent" | "danger" | null
      enabled?: boolean | null
      active?: boolean | null
    }
    interface ItemPatch {
      icon?: string | null
      activeIcon?: string | null
      title?: string | null
      subtitle?: string | null
      tint?: "default" | "accent" | "danger" | null
      progress?: number | null
      active?: boolean | null
      enabled?: boolean | null
      hidden?: boolean | null
      controls?: Record<string, ControlPatch> | null
    }
    /** controlId is present only when the user tapped a control inside a `bar`. */
    interface InvokeEvent { id: string; controlId?: string }
    function getState(): Promise<State>
    /** Layers and controls cannot be added, removed or re-identified at runtime. */
    function update(input: { items: Record<string, ItemPatch> }): Promise<State>
    function reset(): Promise<State>
    function on(event: "invoke", handler: (event: InvokeEvent) => void): () => void
    function on(event: "changed", handler: (state: State) => void): () => void
  }

  namespace toolbar {
    interface ItemState {
      title: string
      icon: string | null
      role: "normal" | "hostMenu" | "destructive"
      tint: "default" | "accent" | "danger"
      badge: string | null
      enabled: boolean
      hidden: boolean
      actionID: string | null
    }
    interface SearchState {
      declared: boolean
      /** false when the current surface has no navigation bar (fullscreen) — draw your own field. */
      rendered: boolean
      placeholder: string | null
      scopes: { id: string; title: string }[]
      query: string
      scope: string
      active: boolean
    }
    interface State {
      declared: boolean
      rendered: boolean
      leading: string[]
      trailing: string[]
      items: Record<string, ItemState>
      search: SearchState
    }
    interface ItemPatch {
      title?: string | null
      icon?: string | null
      badge?: string | null
      enabled?: boolean | null
      hidden?: boolean | null
    }
    interface SearchEvent { query: string; scope: string; submitted: boolean }
    function getState(): Promise<State>
    function update(input: { items: Record<string, ItemPatch> }): Promise<State>
    function reset(): Promise<State>
    function setSearch(input: { query?: string | null; scope?: string; active?: boolean }): Promise<SearchState>
    /** invoke fires only for buttons declared WITHOUT an actionID; those with one run the Action instead. */
    function on(event: "invoke", handler: (payload: { id: string }) => void): () => void
    function on(event: "searchChanged", handler: (payload: SearchEvent) => void): () => void
    function on(event: "changed", handler: (state: State) => void): () => void
  }

  namespace list {
    type ActionRole = "normal" | "destructive"
    type ActionTint = "default" | "accent" | "danger"
    interface Action {
      id: string
      title: string
      /** SF Symbol name. */
      icon?: string
      role?: ActionRole
      tint?: ActionTint
    }
    /** Per-row display override. Display state only — identity (id, role, tint) can never change. */
    interface ActionOverride {
      title?: string | null
      icon?: string | null
      enabled?: boolean | null
      hidden?: boolean | null
    }
    interface Row {
      id: string
      /**
       * [x, y, width, height] in CSS POINTS, viewport coordinates — exactly what
       * getBoundingClientRect() returns. Never multiply by devicePixelRatio (the host applies the
       * screen scale) and never add scrollTop (the client rect already accounts for scrolling).
       * Getting this wrong pops the menu on the wrong row, which is worse than no menu at all.
       */
      rect: [number, number, number, number]
      actions?: Record<string, ActionOverride>
    }
    interface State {
      /** false when this surface cannot host the gesture layer (card, headless) — KEEP your own fallback. */
      rendered: boolean
      regions: string[]
      regionId?: string
      configured?: boolean
      contextMenu?: Array<Required<Pick<Action, "id" | "title" | "role" | "tint">> & { icon: string | null }>
      leadingSwipe?: Array<Required<Pick<Action, "id" | "title" | "role" | "tint">> & { icon: string | null }>
      trailingSwipe?: Array<Required<Pick<Action, "id" | "title" | "role" | "tint">> & { icon: string | null }>
      rows?: number
    }
    interface ActionEvent {
      regionId: string
      rowId: string
      actionId: string
      /** Which affordance produced it — you may confirm a swipe-delete differently from a menu-delete. */
      source: "contextMenu" | "swipe"
    }
    function getState(regionId?: string): Promise<State>
    /** Declares the region's action identity once. Check `rendered` and keep a self-drawn fallback. */
    function configure(input: {
      regionId: string
      contextMenu?: Action[]
      leadingSwipe?: Action[]
      trailingSwipe?: Action[]
    }): Promise<State>
    /**
     * Report the currently VISIBLE rows. Rectangles go stale after 600ms, so call this on every
     * scroll frame — `<VirtualList onVisibleRowsChange>` and `useListGestures` already do it for you.
     */
    function setRows(regionId: string, rows: Row[]): Promise<{
      accepted: boolean
      regionId: string
      rows?: number
      generation?: number
      reason?: "not-configured"
    }>
    function release(regionId: string): Promise<{ released: boolean; regionId: string }>
    function on(event: "action", handler: (payload: ActionEvent) => void): () => void
    function on(event: "changed", handler: (state: State) => void): () => void
  }

  namespace navigation {
    type SwipeBackPolicy = "automatic" | "disabled"
    interface State {
      depth: number
      url: string
      title: string | null
      closeConfirmation: boolean
      closeConfirmationTitle: string | null
      closeConfirmationMessage: string | null
      swipeBack: SwipeBackPolicy
      /** "native" = the host runs a real UINavigationController page stack for your sub-pages,
       *  so the back gesture is the system's own interactive pop (previous page revealed live,
       *  abandonable mid-drag). "web" = plain Web History; draw your own back affordance.
       *  Opt in with manifest presentation.subpages = true. */
      transition: "native" | "web"
      /** true = the host is drawing a navigation bar right now (your title, a back/close exit and
       *  the ... menu). THIS is what decides whether you draw your own header — do not infer it
       *  from toolbar.getState().rendered, which only reports whether YOUR declared toolbar
       *  buttons are drawn and is false whenever you did not declare scene.toolbar. Drawing a
       *  header on top of the host's gives two stacked title bars on device.
       *  Re-read it on scene.changed: switching surface changes it. */
      hostChrome: boolean
      /** Depth of the host-side native page stack; mirrors `depth` when transition is "native". */
      nativeDepth: number
    }
    interface CloseConfirmationOptions { enabled: boolean; title?: string; message?: string }
    function getState(): Promise<State>
    function push(input: { route?: string; state?: Record<string, unknown>; title?: string }): Promise<State>
    function replace(input: { route?: string; state?: Record<string, unknown>; title?: string }): Promise<State>
    function back(steps?: number): Promise<boolean>
    function popToRoot(): Promise<boolean>
    function setTitle(title: string): Promise<boolean>
    function setCloseConfirmation(input: boolean | CloseConfirmationOptions): Promise<State>
    /** disabled blocks both the host edge-exit gesture and WebKit back-forward swipe. The host back button remains as a safe escape path. */
    function setSwipeBack(policy: SwipeBackPolicy): Promise<State>
    function close(options?: { title?: string; message?: string }): Promise<boolean>
  }

  namespace ui {
    interface Action { id: string; title: string; role?: "default" | "cancel" | "destructive" }
    interface DialogResult { actionId: string; value: string | null; cancelled: boolean }
    function alert(input: { title?: string; message?: string }): Promise<DialogResult>
    function confirm(input: { title?: string; message?: string; actions?: Action[] }): Promise<DialogResult>
    function prompt(input: { title?: string; message?: string; placeholder?: string; defaultValue?: string }): Promise<DialogResult>
    function actionSheet(input: { title?: string; message?: string; actions: Action[] }): Promise<DialogResult>

    /**
     * How much of YOUR viewport is unusable, in CSS px.
     *
     * NOT the same thing as `aibox.scene.getState().safeArea` — that one reports how much
     * space the host chrome OCCUPIES, measured outside your viewport, and the chrome height
     * has ALREADY been subtracted from your viewport. Padding by it double-compensates.
     *
     * Also note `env(safe-area-inset-*)` is always 0 inside an applet (SwiftUI zeroes the
     * web view's safe area and expresses it by placement instead) — use these values instead.
     *
     * Prefer the CSS custom properties when plain CSS is enough — they need no JS at all:
     *   `--aibox-inset-top|-right|-bottom|-left`, `--aibox-keyboard-inset`,
     *   `--aibox-keyboard-duration`, `--aibox-usable-height`.
     * The host never applies padding for you; you decide where the inset goes.
     */
    interface Insets {
      top: number
      right: number
      /** Device area covered by your viewport (home indicator). 0 when host chrome already shrank you. */
      bottom: number
      left: number
      /** Keyboard overlap of the viewport. Compose as max(bottom, keyboard) — do not add them. */
      keyboard: number
      /** Keyboard animation duration in ms; match it to move in step with the system curve. */
      keyboardAnimationMs: number
      /** Viewport height in CSS px — the same number as 100dvh. */
      viewportHeight: number
    }
    /** Synchronous snapshot. Safe to read during layout; never throws. */
    const insets: Insets
    function getInsets(): Promise<Insets>
    /** Fires on tab bar / toolbar / overlay changes, keyboard, rotation and safe-area changes. */
    function on(event: "insetsChanged", handler: (insets: Insets) => void): () => void
    function on(event: "keyboardChanged", handler: (input: { height: number; animationMs: number }) => void): () => void
  }

  interface ResourceRef {
    handle: string
    /** Same-origin applet URL suitable for <img src>, <audio src> or fetch(). */
    url: string
    name: string
    mimeType: string
    size: number
    createdAt: string
  }
  interface PickerResult { items: ResourceRef[]; cancelled: boolean }

  namespace picker {
    /** MIME types, UTType identifiers or filename extensions such as "text/plain", "public.image", ".md". */
    function file(input?: { types?: string[]; multiple?: boolean }): Promise<PickerResult>
    function photo(input?: { limit?: number }): Promise<PickerResult>
  }

  namespace resource {
    function list(): Promise<ResourceRef[]>
    function info(handle: string): Promise<ResourceRef>
    function readText(handle: string): Promise<string>
    function remove(handle: string): Promise<boolean>
  }

  namespace share {
    function text(input: { text: string; url?: string }): Promise<boolean>
    /**
     * Export a REAL named file to the share sheet (savable to Files, AirDroppable).
     * Use this for CSV/JSON/OPML exports — share.text sends the content as a message body, not a file.
     * filename must be a bare name (no slashes, no .., no leading dot); max 10MB.
     */
    function file(input: {
      filename: string
      /** utf8 text, or base64 bytes when encoding is "base64". */
      content: string
      /** Advisory only — the file extension wins if they disagree, and you get a warning back. */
      mimeType?: string
      encoding?: "utf8" | "base64"
    }): Promise<{ shared: boolean; filename: string; bytes: number; warning?: string }>
  }

  namespace action {
    function register(name: string, handler: (input: JSONValue) => JSONValue | Promise<JSONValue>): void
    function result(data: JSONValue): Promise<boolean>
  }


  namespace apps {
    /** List installed applets and their declared action names. Result: {id,name,icon,summary,actions:string[]}[] */
    function list(input?: Record<string, never>): Promise<Array<{ actions: Array<string>; icon: string; id: string; name: string; summary: string }>>
    /** Read one applet's action/event contract. Result: {id,name,icon,summary,actions,events,automations} */
    function describe(input: { app: string }): Promise<{ actions: Array<Record<string, unknown>>; automations: Array<Record<string, unknown>>; events: Array<Record<string, unknown>>; icon: string; id: string; name: string; summary: string }>
    /** Headlessly invoke a registered action on another applet. Result: {appId,action,result} */
    function invoke(input: { action: string; app: string; input?: unknown; waitMs?: number }): Promise<{ action: string; appId: string; result: unknown }>
    /** Publish one event declared by the current applet and run matching event automations. Result: {event,accepted,automationsRun,payload} */
    function emit(input: { event: string; payload?: unknown }): Promise<{ accepted: boolean; automationsRun: number; event: string; payload: unknown }>
  }

  namespace audio {
    /** Probe whether recording can start right now. Never prompts and never opens the microphone — call it on mount and hide the record button when unavailable. Result: {available, microphone, supportsBackgroundRecording, busy, reason} */
    function availability(input?: Record<string, never>): Promise<{ available: boolean; busy: boolean; microphone: "granted" | "denied" | "undetermined"; reason?: "usage-description-missing" | "microphone-denied" | "busy" | "not-recording" | "destination-unwritable" | "engine-failure" | "platform-unsupported"; supportsBackgroundRecording: boolean }>
    /** Start recording. Shows no host UI. Fails with aibox/busy if any recording is already running. Result: {started, discarded, format, sampleRate, channels, supportsBackgroundRecording} — started:false with discarded:true means you called recordStop while the permission prompt was still up, so nothing was captured */
    function recordStart(input?: { bitrate?: number; channels?: 1 | 2; format?: "m4a" | "wav"; sampleRate?: number }): Promise<{ channels: number; discarded: false; format: "m4a" | "wav"; sampleRate: number; started: true; supportsBackgroundRecording: boolean } | { discarded: true; durationMs: number; started: false }>
    /** Pause the recording. Returns false when there is nothing of yours to pause, or after an interruption (that file is already finalized). Result: boolean */
    function recordPause(input?: Record<string, never>): Promise<boolean>
    /** Resume a paused recording. Result: boolean */
    function recordResume(input?: Record<string, never>): Promise<boolean>
    /** Stop and finalize. Returns an applet resource handle you can play with <audio src=ref.url> or decode with AudioContext. Clips shorter than 500ms are discarded (discarded:true) and nothing is written. Result: {handle, url, name, mimeType, size, createdAt, durationMs, byteCount, format, sampleRate, channels, interrupted, discarded} | {discarded:true, durationMs} */
    function recordStop(input?: Record<string, never>): Promise<{ byteCount: number; channels: number; createdAt: string; discarded: false; durationMs: number; format: "m4a" | "wav"; handle: string; interrupted: boolean; mimeType: string; name: string; sampleRate: number; size: number; url: string } | { discarded: true; durationMs: number }>
    /** Discard the recording and delete the file. Nothing is stored. Result: boolean */
    function recordCancel(input?: Record<string, never>): Promise<boolean>
    /** Poll while recording. levels holds the most recent 120 samples (20 Hz, ~6s) already normalized to 0…1 with the same curve the native recorder uses, oldest first — pad the left with zeros and draw the newest at the right edge. Result: {state, recording, paused, interrupted, elapsedMs, byteCount, levels, levelsHz, averageDb, peakDb} */
    function recordStatus(input?: Record<string, never>): Promise<{ averageDb: number; byteCount: number; elapsedMs: number; interrupted: boolean; levels: Array<number>; levelsHz: number; paused: boolean; peakDb: number; recording: boolean; state: "idle" | "recording" | "paused" | "interrupted" }>
    /** Probe whether transcribe() can run for a locale. Never prompts and never transcribes — call it before showing a transcribe button. state tells you WHY it is unavailable: engine-missing (this build has no transcription engine), not-authorized, unsupported-locale, unsupported-os, needs-model-download (transcribe() will download it on first use, so this state is still worth offering). Result: {available, state, locale, engine} — state is one of available | needs-model-download | not-authorized | unsupported-locale | unsupported-os | engine-missing */
    function transcribeAvailability(input?: { locale?: string }): Promise<{ available: boolean; engine: boolean; locale: string; state: "available" | "needs-model-download" | "unsupported-os" | "not-authorized" | "unsupported-locale" | "engine-missing" }>
    /** Transcribe an audio resource of YOUR OWN into text plus timestamped segments. Pass the handle from recordStop() or picker.file() — never a file path (you do not have one, and the host resolves the handle itself). Long files take minutes; one transcription per applet at a time. First use may prompt for speech recognition and may download the locale model. Result: {text, locale, segments:[{text, start, duration, end}], segmentCount} — start/duration/end are seconds */
    function transcribe(input: { handle: string; locale?: string; segments?: boolean }): Promise<{ locale: string; segmentCount: number; segments?: Array<{ duration: number; end: number; start: number; text: string }>; text: string }>
  }

  namespace browser {
    /** Open an http/https URL. mode inApp keeps the user inside the app (default); system uses SFSafari so Safari logins/passkeys apply; external hands off to the default browser app. Unavailable modes degrade inApp → system → external instead of failing. Result: {opened:boolean, mode:string} */
    function open(input: { mode?: "inApp" | "system" | "external"; url: string }): Promise<{ mode: "inApp" | "system" | "external"; opened: boolean }>
    /** Open a link straight into Reader with content you already extracted, so the host does not fetch and parse it a second time. Result: {opened:boolean, mode:string, reader:boolean} */
    function openArticle(input: { content?: string; excerpt?: string; publishedAt?: string; siteName?: string; title?: string; url: string }): Promise<{ mode: "inApp" | "system" | "external"; opened: boolean; reader: boolean }>
    /** Which modes this host can actually serve right now, and whether Reader exists. Hide entry points the host cannot honor instead of letting a tap do nothing. Result: {modes:string[], reader:boolean} */
    function availability(input?: Record<string, never>): Promise<{ modes: Array<"inApp" | "system" | "external">; reader: boolean }>
  }

  namespace calendar {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function events(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function subscribe(input?: Record<string, never>): Promise<unknown>
  }

  namespace chat {
    /** Set the collaboration mode for this applet. Result: ConversationBinding */
    function bind(input?: { mode?: "use" | "build" | "diagnose" | "automate" }): Promise<{ appletID: string; conversationIdentity: string; mode: "use" | "build" | "diagnose" | "automate"; snapshot?: { appletID: string; capturedAt: string; consoleErrors: Array<string>; formStateJSON?: string; pageTitle?: string; revision: number; route?: string; selectedElement?: { attributes: Record<string, unknown>; component?: string; height?: number; selector: string; sourceHint?: string; tag: string; text?: string; width?: number; x?: number; y?: number }; visibleText?: string }; updatedAt: string }>
    /** Update the compact current-page snapshot without sending a chat message. Result: ContextSnapshot */
    function snapshot(input?: { consoleErrors?: Array<string>; formState?: unknown; pageTitle?: string; route?: string; selectedElement?: Record<string, unknown>; visibleText?: string }): Promise<{ appletID: string; capturedAt: string; consoleErrors: Array<string>; formStateJSON?: string; pageTitle?: string; revision: number; route?: string; selectedElement?: { attributes: Record<string, unknown>; component?: string; height?: number; selector: string; sourceHint?: string; tag: string; text?: string; width?: number; x?: number; y?: number }; visibleText?: string }>
    /** Read the current collaboration binding and compact snapshot. Result: ConversationBinding */
    function context(input?: Record<string, never>): Promise<{ appletID: string; conversationIdentity: string; mode: "use" | "build" | "diagnose" | "automate"; snapshot?: { appletID: string; capturedAt: string; consoleErrors: Array<string>; formStateJSON?: string; pageTitle?: string; revision: number; route?: string; selectedElement?: { attributes: Record<string, unknown>; component?: string; height?: number; selector: string; sourceHint?: string; tag: string; text?: string; width?: number; x?: number; y?: number }; visibleText?: string }; updatedAt: string }>
    /** Record a user-selected DOM element for precise AI edits. Result: ContextSnapshot（回传更新后的整份快照） */
    function selectElement(input: { element: Record<string, unknown> }): Promise<{ appletID: string; capturedAt: string; consoleErrors: Array<string>; formStateJSON?: string; pageTitle?: string; revision: number; route?: string; selectedElement?: { attributes: Record<string, unknown>; component?: string; height?: number; selector: string; sourceHint?: string; tag: string; text?: string; width?: number; x?: number; y?: number }; visibleText?: string }>
    /** Report build/diagnostic progress for the chat card and Studio. Result: CollaborationEnvelope */
    function report(input: { changedFiles?: Array<string>; errors?: Array<string>; message?: string; mode?: "use" | "build" | "diagnose" | "automate"; phase: "idle" | "planning" | "editing" | "running" | "testing" | "completed" | "failed"; progress?: number }): Promise<{ appletID: string; changedFiles: Array<string>; errors: Array<string>; id: string; message?: string; mode: "use" | "build" | "diagnose" | "automate"; phase: "idle" | "planning" | "editing" | "running" | "testing" | "completed" | "failed"; progress?: number; updatedAt: string }>
    /** Read the latest collaboration progress envelope. Result: CollaborationEnvelope|null */
    function progress(input?: Record<string, never>): Promise<{ appletID: string; changedFiles: Array<string>; errors: Array<string>; id: string; message?: string; mode: "use" | "build" | "diagnose" | "automate"; phase: "idle" | "planning" | "editing" | "running" | "testing" | "completed" | "failed"; progress?: number; updatedAt: string } | unknown>
    /** Explicitly hand the current compact snapshot to the docked AI conversation; optionally send a visible suggested prompt. Result: boolean */
    function shareContext(input?: { suggestedPrompt?: string }): Promise<boolean>
  }

  namespace clipboard {
    /** Read clipboard text. Result: string */
    function read(input?: Record<string, never>): Promise<string>
    /** Replace clipboard text. Result: boolean */
    function write(input: { text: string }): Promise<boolean>
  }

  namespace contacts {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function find(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function create(input?: Record<string, never>): Promise<unknown>
  }

  namespace data {
    /** Bytes used and remaining across this applet's private data (kv + db + imports). Check it before bulk writes and use it to drive your own eviction policy — the host sets the budget, you decide what to drop. Result: {usedBytes, limitBytes, remainingBytes, layers:{kv,db,imports,other}} */
    function usage(input?: Record<string, never>): Promise<{ layers: { db: number; imports: number; kv: number; other: number }; limitBytes: number; remainingBytes: number; usedBytes: number }>
    /** Which version last wrote the data on disk versus the version running now. This is the migration hook: when changed is true, migrate from previous to current, then call acknowledgeVersion(). The host knows nothing about your schema. Result: {current, previous, isFirstRun, changed, firstSeenAt?} */
    function version(input?: Record<string, never>): Promise<{ changed: boolean; current: string; firstSeenAt?: string; isFirstRun: boolean; previous: string | unknown }>
    /** Mark the current version's data as migrated. Idempotent; until you call it, version() keeps reporting the same transition, so a failed migration is retried instead of silently skipped. Result: {current, previous, isFirstRun, changed} */
    function acknowledgeVersion(input?: Record<string, never>): Promise<{ changed: boolean; current: string; firstSeenAt?: string; isFirstRun: boolean; previous: string | unknown }>
    /** The data snapshot the host captured before the last update, if any. Read it to tell the user a rollback point exists; the host keeps exactly one. Result: {version?, capturedAt?, bytes} | null */
    function snapshot(input?: Record<string, never>): Promise<{ bytes: number; capturedAt?: string; version?: string } | unknown>
  }

  namespace db {
    /** List collection names. Result: string[] */
    function collections(input?: Record<string, never>): Promise<Array<string>>
    /** Insert or replace one JSON object; returns metadata including _id. Result: stored document */
    function insert(input: { collection: string; document: Record<string, unknown> }): Promise<Record<string, unknown>>
    /** Read one document by _id. Result: document|null */
    function get(input: { collection: string; id: string }): Promise<Record<string, unknown> | unknown>
    /** Patch one document; JSON null removes a field. Result: updated document */
    function update(input: { collection: string; id: string; merge?: boolean; patch: Record<string, unknown> }): Promise<Record<string, unknown>>
    /** Delete one document by _id. Result: boolean */
    function remove(input: { collection: string; id: string }): Promise<boolean>
    /** "Delete every document matching `where`; returns how many were removed. "
                      + "Use this instead of looping remove() — each single remove rewrites the whole collection file, "
                      + "so deleting 500 documents one by one is 500 full-table writes. `where` must be non-empty; "
                      + "to empty a collection call clear()." Result: number (documents removed) */
    function removeWhere(input: { collection: string; where: Record<string, unknown> }): Promise<number>
    /** "Query documents, with stable sorting and pagination. " + Self.operatorHelp Result: document[] (at most 500 — page with offset, or use count/aggregate for totals) */
    function query(input: { collection: string; descending?: boolean; limit?: number; offset?: number; sortBy?: string; where?: Record<string, unknown> }): Promise<Array<Record<string, unknown>>>
    /** "Count matching documents without transferring them. " + Self.operatorHelp Result: number */
    function count(input: { collection: string; where?: Record<string, unknown> }): Promise<number>
    /** "Group and reduce documents natively. "
                      + "Prefer this over query()+reduce in JS: a monthly total over 3000 rows needs no rows to cross the bridge "
                      + "(and query() caps at 500 anyway). Each result row has _group and _count plus your named metrics. "
                      + "Omit groupBy to reduce the whole collection into one row. " + Self.operatorHelp Result: Array<{_group, _count, ...metrics}> sorted by _group; $avg/$min/$max are null when no value qualifies */
    function aggregate(input: { collection: string; groupBy?: string; metrics: Record<string, unknown>; where?: Record<string, unknown> }): Promise<Array<{ _count: number; _group: unknown }>>
    /** "Case- and accent-insensitive substring scan across string fields. "
                      + "Omit `fields` to scan every non-underscore string field. Combine with `where` to scope it. "
                      + "NOTE: this is a linear substring scan, not an inverted index, and results are NOT ranked — "
                      + "they come back in collection order. That is deliberate: tokenizer-based ranking drops CJK text "
                      + "(no word boundaries), and at the 20k-document cap a scan is milliseconds." Result: document[] in collection order (unranked) */
    function search(input: { collection: string; fields?: Array<string>; limit?: number; text: string; where?: Record<string, unknown> }): Promise<Array<Record<string, unknown>>>
    /** Delete every document in one collection. Result: boolean */
    function clear(input: { collection: string }): Promise<boolean>
  }

  namespace device {
    /** Read the current device state. Result: {model, systemName, systemVersion, idiom, locale, timeZone, batteryLevel?, batteryState, freeDiskBytes?} */
    function info(input?: Record<string, never>): Promise<{ batteryLevel?: number; batteryState: "charging" | "full" | "unplugged" | "unknown"; freeDiskBytes?: number; idiom: "phone" | "pad" | "mac" | "tv" | "carPlay" | "vision" | "unspecified"; locale: string; model: string; systemName: string; systemVersion: string; timeZone: string }>
  }

  namespace download {
    /** Queue one download and get its taskId back immediately. Resumable, survives app termination. headers are passed through verbatim (Referer/Cookie/User-Agent for sites that reject plain requests). Result: {taskId, artifactRef} */
    function enqueue(input: { destination?: { kind?: "sandbox" | "externalFiles" | "iCloud" | "vault"; path?: string; vault?: string }; expectedBytes?: number; filename?: string; groupId?: string; headers?: Record<string, unknown>; priority?: "low" | "normal" | "high"; url: string }): Promise<{ artifactRef: string; taskId: string }>
    /** Your downloads, newest state first-hand. Never includes other apps' tasks. Result: DownloadTask[] — {taskId,url,filename,state,bytesReceived,totalBytes,fraction,speed,eta,outputPath,artifactRef,groupId,error} */
    function list(input?: { groupId?: string; state?: "queued" | "running" | "paused" | "completed" | "failed" | "cancelled" | "active" | "finished" }): Promise<Array<{ artifactRef?: string; bytesReceived: number; error?: string; eta?: number; filename: string; fraction?: number; groupId?: string; outputPath?: string; speed?: number; state: "queued" | "running" | "paused" | "completed" | "failed" | "cancelled"; taskId: string; totalBytes?: number; url: string }>>
    /** One task's snapshot; null when the id is not yours or no longer exists. Result: DownloadTask|null */
    function status(input: { taskId: string }): Promise<{ artifactRef?: string; bytesReceived: number; error?: string; eta?: number; filename: string; fraction?: number; groupId?: string; outputPath?: string; speed?: number; state: "queued" | "running" | "paused" | "completed" | "failed" | "cancelled"; taskId: string; totalBytes?: number; url: string } | unknown>
    /** Pause one download; resume data is written to disk so it continues from where it stopped. Result: boolean */
    function pause(input: { taskId: string }): Promise<boolean>
    /** Resume a paused or failed download. Result: boolean */
    function resume(input: { taskId: string }): Promise<boolean>
    /** Cancel one download; the record stays in the list as cancelled. Result: boolean */
    function cancel(input: { taskId: string }): Promise<boolean>
    /** Drop one record from the list entirely (cancels it first if running). Result: boolean */
    function remove(input: { taskId: string }): Promise<boolean>
    /** Pause every download of YOURS. Other apps and the host queue are untouched. Result: boolean */
    function pauseAll(input?: Record<string, never>): Promise<boolean>
    /** Resume every paused/failed download of yours. Result: boolean */
    function resumeAll(input?: Record<string, never>): Promise<boolean>
    /** Cancel every active download of yours. Result: boolean */
    function cancelAll(input?: Record<string, never>): Promise<boolean>
    /** Remove your completed/failed/cancelled records. Does NOT delete downloaded files. Result: boolean */
    function clearFinished(input?: Record<string, never>): Promise<boolean>
    /** Start pushing 'download.progress' events for your tasks to aibox.events. Strongly preferred over polling: a 10-download queue polled once a second is dozens of bridge round-trips per second. Events stop automatically when your applet closes. Result: boolean */
    function subscribe(input?: Record<string, never>): Promise<boolean>
    /** Stop the progress event stream. Result: boolean */
    function unsubscribe(input?: Record<string, never>): Promise<boolean>
    /** Hand a finished file to the host's opener (Quick Look / the system app for that type). The file never enters your sandbox. Result: boolean */
    function openIn(input: { taskId: string }): Promise<boolean>
    /** Present the native share sheet for a finished file. Result: boolean */
    function share(input: { taskId: string }): Promise<boolean>
    /** Probe whether the download engine is usable right now. No consent prompt. Result: {available:boolean, reason?:string} */
    function availability(input?: Record<string, never>): Promise<{ available: boolean; reason: string }>
  }

  // files 含保留字方法名，故用 interface + const 而不是 namespace（语义等价）。
  interface FilesNamespace {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    boxes(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    list(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    read(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    readBinary(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    stat(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    search(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    tree(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    glob(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    write(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    writeBinary(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    append(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    createDirectory(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    transfer(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    "delete"(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    createBox(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    renameBox(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    describeBox(input?: Record<string, never>): Promise<unknown>
  }
  const files: FilesNamespace

  namespace haptics {
    /** Play an impact haptic. Result: boolean */
    function impact(input?: { style?: "light" | "medium" | "heavy" | "soft" | "rigid" }): Promise<boolean>
    /** Play a selection tick. Result: boolean */
    function selection(input?: Record<string, never>): Promise<boolean>
    /** Play a success, warning, or error pattern. Result: boolean */
    function notify(input?: { type?: "success" | "warning" | "error" }): Promise<boolean>
  }

  namespace health {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function metric(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function summary(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function activity(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function workouts(input?: Record<string, never>): Promise<unknown>
  }

  namespace jobs {
    /** List this applet's automations and last run status. Result: Automation[] */
    function list(input?: Record<string, never>): Promise<Array<{ action: string; catchUpWindowSeconds?: number; consecutiveFailures?: number; createdAt: string; enabled: boolean; id: string; inputJSON?: string; lastError?: string; lastInvocationID?: string; lastResultJSON?: string; lastRunAt?: string; lastSkipReason?: string; lastSkippedAt?: string; leaseUntil?: string; name?: string; nextRetryAt?: string; pendingOccurrenceID?: string; trigger: { at?: string; event?: string; hour?: number; intervalSeconds?: number; kind: "once" | "interval" | "daily" | "event" | "appLaunch" | "appForeground" | "appletOpen"; minute?: number }; updatedAt: string }>>
    /** Create or update an automation. Result: Automation */
    function register(input: { action: string; enabled?: boolean; id?: string; input?: unknown; name?: string; trigger: { at?: string; event?: string; hour?: number; intervalSeconds?: number; kind: "once" | "interval" | "daily" | "event" | "appLaunch" | "appForeground" | "appletOpen"; minute?: number } }): Promise<{ action: string; catchUpWindowSeconds?: number; consecutiveFailures?: number; createdAt: string; enabled: boolean; id: string; inputJSON?: string; lastError?: string; lastInvocationID?: string; lastResultJSON?: string; lastRunAt?: string; lastSkipReason?: string; lastSkippedAt?: string; leaseUntil?: string; name?: string; nextRetryAt?: string; pendingOccurrenceID?: string; trigger: { at?: string; event?: string; hour?: number; intervalSeconds?: number; kind: "once" | "interval" | "daily" | "event" | "appLaunch" | "appForeground" | "appletOpen"; minute?: number }; updatedAt: string }>
    /** Remove one automation. Result: boolean */
    function remove(input: { id: string }): Promise<boolean>
    /** Run one automation immediately. Result: boolean */
    function run(input: { id: string }): Promise<boolean>
    /** Run every currently due automation for this applet. Result: {count:number} */
    function runDue(input?: Record<string, never>): Promise<{ count: number }>
    /** Read the next calculable due time for every enabled automation. Result: {id,nextAt:string|null}[] */
    function next(input?: Record<string, never>): Promise<Array<{ id: string; nextAt: string | unknown }>>
  }

  namespace location {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function current(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function placemark(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function permission(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function geocode(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function places(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function geofence(input?: Record<string, never>): Promise<unknown>
  }

  namespace media {
    /** Play an audio file from this applet's assets/data/cache directories. Result: {id,channel,state} */
    function play(input: { channel?: "music" | "voice" | "sfx" | "ambient"; loop?: boolean; path: string; volume?: number }): Promise<{ channel: "music" | "voice" | "sfx" | "ambient"; id: string; state: "playing" }>
    /** Pause one playback handle. Result: boolean */
    function pause(input: { id: string }): Promise<boolean>
    /** Resume one playback handle. Result: boolean */
    function resume(input: { id: string }): Promise<boolean>
    /** Stop one playback handle. Result: boolean */
    function stop(input: { id: string }): Promise<boolean>
    /** Stop all audio, optionally limited to one channel. Result: integer */
    function stopAll(input?: { channel?: "music" | "voice" | "sfx" | "ambient" }): Promise<number>
    /** Read playback state for one handle. Result: {id,state,currentTime,duration,channel} | {state:'stopped'} */
    function getState(input: { id: string }): Promise<{ channel: string; currentTime: number; duration: number; id: string; state: "playing" | "paused" } | { state: "stopped" }>
  }

  namespace music {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function search(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function play(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function transport(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function status(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function queue(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function album(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function get(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function library(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function local(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function lyrics(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function seek(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function volume(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function repeat(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function shuffle(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function sleepTimer(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function recommendations(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function effects(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function playlist(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function deletePlaylist(input?: Record<string, never>): Promise<unknown>
  }

  namespace notifications {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function schedule(input?: Record<string, never>): Promise<unknown>
  }

  namespace open {
    /** Open an http, https, mailto, or tel URL. Result: boolean */
    function url(input: { url: string }): Promise<boolean>
  }

  namespace photos {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function search(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function view(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function ocr(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function save(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function act(input?: Record<string, never>): Promise<unknown>
  }

  namespace reminders {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function items(input?: Record<string, never>): Promise<unknown>
  }

  namespace secrets {
    /** Store one credential under a key. Empty value removes it. Result: {stored:boolean} */
    function set(input: { key: string; value: string }): Promise<{ stored: boolean }>
    /** Read one credential back. Returns null when absent. Result: string or null */
    function get(input: { key: string }): Promise<string | unknown>
    /** Delete one credential. Result: boolean */
    function remove(input: { key: string }): Promise<boolean>
    /** List the credential keys this applet has stored. Values are never returned. Result: string[] */
    function keys(input?: Record<string, never>): Promise<Array<string>>
    /** Whether this applet holds session cookies for a host — i.e. whether the user is logged in. Check this on launch to decide between the logged-in and guest UI; do NOT keep your own 'isLoggedIn' flag in storage, it will drift from the real cookie state. Result: {hasSession:boolean, hosts:string[]} */
    function hasSession(input?: { host?: string }): Promise<{ hasSession: boolean; hosts: Array<string> }>
    /** Log out: drop the session cookies. Pass a host to drop only that site's, omit to drop all of them. Credentials stored via set() are untouched. Result: {cleared:integer} */
    function clearSession(input?: { host?: string }): Promise<{ cleared: number }>
    /** Whether the keychain actually accepts writes in this build. False on unsigned simulator builds — surface it instead of letting logins silently fail to persist. Result: {available:boolean} */
    function availability(input?: Record<string, never>): Promise<{ available: boolean }>
  }

  namespace shortcuts {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function run(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function open(input?: Record<string, never>): Promise<unknown>
  }

  namespace speech {
    /** Probe whether recognition can run right now. Never prompts and never opens the microphone — call it on mount and hide the mic button when unavailable. Result: {available, supportsOnDevice, microphone, speech, locale, reason} */
    function availability(input?: { locale?: string }): Promise<{ available: boolean; locale: string; microphone: "granted" | "denied" | "undetermined"; reason?: "usage-description-missing" | "recognizer-unavailable" | "locale-unsupported" | "on-device-unsupported" | "microphone-denied" | "speech-denied" | "busy" | "engine-failure" | "platform-unsupported"; speech: "granted" | "denied" | "undetermined"; supportsOnDevice: boolean }>
    /** Open the microphone and resolve with the recognized text. Resolves when you call stop(), when maxDurationMs elapses, or when the engine finalizes. For push-to-talk, call recognize() WITHOUT awaiting on press and stop() on release, then await the recognize promise. Result: {transcript, confidence, locale, cancelled, timedOut, onDevice} */
    function recognize(input?: { locale?: string; maxDurationMs?: number; onPartial?: boolean }): Promise<{ cancelled: boolean; confidence: number; locale: string; onDevice: boolean; timedOut: boolean; transcript: string }>
    /** Stop capturing and let the pending recognize() resolve with the final text. Result: boolean */
    function stop(input?: Record<string, never>): Promise<boolean>
    /** Abandon the pending recognize(); it resolves with cancelled:true and an empty transcript. Result: boolean */
    function cancel(input?: Record<string, never>): Promise<boolean>
    /** Poll the in-flight session: elapsed time and the interim transcript so far. Result: {recognizing, elapsedMs, partial, locale} */
    function status(input?: Record<string, never>): Promise<{ elapsedMs: number; locale: string; partial: string; recognizing: boolean }>
  }

  namespace toast {
    /** Show a transient message. Result: boolean */
    function show(input: { message: string }): Promise<boolean>
  }

  namespace tts {
    /** Speak text aloud. Returns as soon as speaking starts (it does not wait for the end). Result: boolean */
    function speak(input: { lang?: string; pitch?: number; rate?: number; text: string }): Promise<boolean>
    /** Stop what this applet is currently speaking. Result: boolean */
    function stop(input?: Record<string, never>): Promise<boolean>
  }

  namespace video {
    /** Play one video full-screen. Two ways to call it. (1) AFTER video.resolve: pass the SAME page url as sourceURL plus the chosen formatID — this is the one you want, because it keeps the request headers and split-stream info that resolve found; passing resolve's raw url instead loses them and sites like Bilibili will answer 403. (2) For a plain direct media URL you already have (mp4/m3u8, not a web page): pass url. resumeFrom continues from a saved position in seconds; presentation 'immersive' (default) takes over the screen, 'embedded' does not. Result: {playing:boolean} */
    function play(input?: { artifactRef?: string; formatID?: string; presentation?: "immersive" | "embedded"; resumeFrom?: number; sourceURL?: string; subtitleURL?: string; title?: string; url?: string }): Promise<{ playing: boolean }>
    /** Play a list of videos starting at startAt, so next/previous walk the list. Use this for episode lists and multi-part videos instead of calling play() again on every part. Result: {playing:boolean, count:integer} */
    function playQueue(input: { items: Array<{ subtitleURL?: string; title?: string; url: string }>; presentation?: "immersive" | "embedded"; resumeFrom?: number; startAt?: number }): Promise<{ count: number; playing: boolean }>
    /** Pause playback. Does nothing if what is playing was not started by your applet. Result: boolean */
    function pause(input?: Record<string, never>): Promise<boolean>
    /** Resume playback. Does nothing if what is playing was not started by your applet. Result: boolean */
    function resume(input?: Record<string, never>): Promise<boolean>
    /** Stop playback and dismiss the player. Only affects playback your applet started. Result: boolean */
    function stop(input?: Record<string, never>): Promise<boolean>
    /** Jump to a position in seconds. Clamped to the video duration by the host. Result: boolean */
    function seek(input: { seconds: number }): Promise<boolean>
    /** Play the next item in the queue. No-op without a queue. Result: boolean */
    function next(input?: Record<string, never>): Promise<boolean>
    /** Play the previous item in the queue. No-op without a queue. Result: boolean */
    function previous(input?: Record<string, never>): Promise<boolean>
    /** Current playback snapshot. mine tells you whether the host is playing something YOUR applet started — check it before showing your own progress UI, because the user may be watching something else entirely. Result: {state:'idle'|'loading'|'playing'|'paused'|'failed', url, title, currentTime, duration, queueIndex, queueCount, mine:boolean, error} */
    function status(input?: Record<string, never>): Promise<{ currentTime: number; duration: number; error?: string; mine: boolean; queueCount: number; queueIndex: number; state: "idle" | "loading" | "playing" | "paused" | "failed"; title?: string; url?: string }>
    /** Start pushing 'video.progress' events (~2Hz) to aibox.events. Strongly preferred over polling status(). Events stop automatically when your applet closes. Result: boolean */
    function subscribe(input?: Record<string, never>): Promise<boolean>
    /** Stop the progress event stream. Result: boolean */
    function unsubscribe(input?: Record<string, never>): Promise<boolean>
    /** Turn a video PAGE url (Bilibili, YouTube, a page with an embedded player, an m3u8…) into playable stream urls, using the host's own extractor stack. Use this instead of reimplementing site parsing in JS. Each returned format carries `playable`: FALSE means this build cannot play that one (DASH split streams need a merge backend that may not be compiled in) — filter on it and never offer the user a quality that would just go black. Pass a playable format's `url` straight to video.play. Result: {ok:boolean, title, uploader, durationSeconds, thumbnailURL, extractor, id, formats:[…]} */
    function resolve(input: { url: string }): Promise<{ durationSeconds?: number; extractor: string; formats: Array<{ bitrate?: number; bytes?: number; fps?: number; height?: number; id: string; kind: "direct" | "hls" | "dash"; playable: boolean; quality: string; url?: string; width?: number }>; id: string; ok: boolean; thumbnailURL?: string; title: string; uploader?: string }>
    /** Open a native video area pinned to the TOP of your page, and play there instead of taking over the whole screen. THIS IS THE ONE YOU WANT for a video app: your page content keeps scrolling underneath (description, episodes, related), the app stays PORTRAIT, and the user gets landscape only by tapping the player's own fullscreen button. Call stage() first, then play(). Playing without a stage takes over the screen in landscape, which is almost never what a page wants. Result: {rendered:boolean, available:boolean, aspect:string, backgroundAudio:boolean, gestureControls:boolean, pictureInPicture:boolean} */
    function stage(input?: { aspect?: string; backgroundAudio?: boolean; gestureControls?: boolean; pictureInPicture?: boolean }): Promise<{ aspect: string; available: boolean; backgroundAudio: boolean; gestureControls: boolean; pictureInPicture: boolean; rendered: boolean }>
    /** Close the video area. Does NOT stop playback — the user may want it to continue as picture-in-picture or background audio. Call video.stop for that. Result: boolean */
    function dismissStage(input?: Record<string, never>): Promise<boolean>
    /** What this build can actually do: `available` = there is a video engine, `resolve` = the extractor stack is compiled in, `dash` = split video/audio streams can be played, `stage` = the in-page video area is supported. Hide the entry points this build cannot honor instead of letting a tap do nothing. Result: {available:boolean, resolve:boolean, dash:boolean, stage:boolean} */
    function availability(input?: Record<string, never>): Promise<{ available: boolean; dash: boolean; resolve: boolean; stage: boolean }>
  }

  namespace vision {
    /** OCR an image resource you own. Pass the handle you got back from picker.photo or picker.file. Returns the text in reading order, newline-separated. Empty text means no readable text was found — that is a normal outcome, not an error, so tell the user rather than retrying. Result: {ok:boolean, text:string, empty:boolean} */
    function recognizeText(input: { handle: string; languages?: Array<string> }): Promise<{ empty: boolean; ok: boolean; text: string }>
    /** Whether on-device text recognition exists in this build. Hide the scan entry point instead of letting a tap do nothing. Result: {available:boolean} */
    function availability(input?: Record<string, never>): Promise<{ available: boolean }>
  }

  // voiceMemos 含保留字方法名，故用 interface + const 而不是 namespace（语义等价）。
  interface VoiceMemosNamespace {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    list(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    get(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    recordStart(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    recordControl(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    recordStatus(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    transcribe(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    transcript(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    play(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    stop(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    seek(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    waveform(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    "import"(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    rename(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    "delete"(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    move(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    favourite(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    summarize(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    actionItems(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    ask(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    cleanTranscript(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    chapters(input?: Record<string, never>): Promise<unknown>
  }
  const voiceMemos: VoiceMemosNamespace

  /**
   * The app's language model, projected into this applet.
   * Requires `ai: true` in the manifest; the user approves once per applet on first use.
   * Cost is metered PER APPLET, so: check availability() before showing AI affordances, keep
   * calls bounded, and ALWAYS have a deterministic fallback — a good applet still works when
   * the model is unavailable, over quota, or slow.
   */
  namespace ai {
    /**
     * Model tier hint. Applets never see or pick a model id — the host maps the intent onto
     * whatever the user configured (and may run it on-device when possible).
     */
    type Intent = "fast" | "balanced" | "reasoning"

    /**
     * Rejection reason. EVERY ai.* rejection message starts with one of these codes, e.g.
     * "aibox/quota-exceeded: daily budget spent". Branch on it and show something readable:
     *   catch (e) { if (String(e.message).startsWith("aibox/quota-exceeded")) … }
     */
    type ErrorCode =
      | "aibox/ai-unavailable"   // no model configured, or the AI capability is not installed
      | "aibox/denied"           // `ai` not declared in the manifest, or the user declined
      | "aibox/quota-exceeded"   // this applet's daily / per-session budget is spent
      | "aibox/timeout"          // exceeded timeoutMs
      | "aibox/busy"             // another call from this applet is still in flight
      | "aibox/too-long"         // prompt or messages over the hard input cap
      | "aibox/invalid-args"     // malformed input (e.g. decide() without a schema)
      | "aibox/schema-invalid"   // output still did not satisfy `schema` after the host retried
      | "aibox/refused"          // the model declined — do NOT retry, use your fallback
      | "aibox/truncated"        // hit maxTokens mid-answer — raise it or shrink the schema
      | "aibox/ai-failed"        // the provider errored (network / server). Retrying later may work.

    interface Message { role: "system" | "user" | "assistant"; content: string }

    interface Availability {
      available: boolean
      /** Why it is unavailable (usually an ErrorCode). Absent when available. */
      reason?: string
      intents: Intent[]
      /**
       * False once the host has seen several consecutive structured-output failures —
       * the configured model probably cannot do tool calling. When false, skip decide()/
       * chooseAction() and run your own logic: chooseAction() will now throw instead of
       * quietly returning fallback moves.
       */
      structuredOutput?: boolean
      /** Human-readable reason when `structuredOutput` is false. */
      structuredOutputReason?: string
    }

    /** Per-applet spend. Read it to degrade gracefully BEFORE you hit aibox/quota-exceeded. */
    interface Usage {
      usedToday: number
      dailyLimit: number
      usedSession: number
      sessionLimit: number
    }

    interface GenerateInput {
      /** Instructions / persona. Keep it byte-identical across turns to hit the prefix cache. */
      system?: string
      /** Single-turn shorthand. Pass either `prompt` or `messages`, not both. */
      prompt?: string
      messages?: Message[]
      intent?: Intent
      maxTokens?: number
      temperature?: number
      timeoutMs?: number
    }

    interface DecideInput {
      system?: string
      prompt: string
      /**
       * JSON Schema for the answer. Putting `enum` on a property is how you make an illegal
       * value structurally impossible instead of merely discouraged.
       */
      schema: JSONValue
      intent?: Intent
      maxTokens?: number
      timeoutMs?: number
    }

    interface Candidate {
      /** Stable id you will match against `Choice.actionId`. */
      id: string
      /** Short human-readable label shown to the model, e.g. "pair of 7s". */
      label?: string
    }

    interface ChooseActionInput {
      /** Invariant rules of the game/task. Keep byte-identical across turns (prefix-cache boundary). */
      rules: string
      /**
       * What changed this turn. NEVER put information the model is not entitled to see in here
       * (an opponent's hidden hand, other users' data) — that is host-level cheating / leakage,
       * and no model can be trusted to ignore what you handed it.
       */
      state: string
      /** The legal moves YOUR code computed. Compiled into an enum, so an out-of-range answer cannot occur. */
      candidates: Candidate[]
      intent?: Intent
      timeoutMs?: number
    }

    interface Choice {
      /** Always one of the `candidates[].id` you passed in. */
      actionId: string
      /** The model's rationale. Untrusted text; never render it verbatim in a game — it leaks hidden state. */
      reason?: string
      /** true = the model failed or was skipped and the host picked a legal candidate for you. */
      fallback: boolean
    }

    /** Cheap probe: is the model usable right now? No consent prompt, no quota spent. */
    function availability(): Promise<Availability>

    /** Legacy one-liner, equivalent to generate({ prompt }). Kept working for existing applets. */
    function complete(prompt: string): Promise<string>

    /** L1 — free-form text. Use when a HUMAN reads the answer. */
    function generate(input: GenerateInput): Promise<string>

    /**
     * L2 — a typed object shaped by `schema`, already parsed (do NOT JSON.parse it).
     * Use when YOUR CODE consumes the answer, so you never have to scrape prose.
     */
    function decide<T = Record<string, unknown>>(input: DecideInput): Promise<T>

    /**
     * L2 — pick exactly one of YOUR candidates. Use this for every "which move / which option"
     * decision instead of asking generate() and parsing: listing the legal moves in a prompt is
     * necessary but NOT sufficient (models routinely answer outside the list), while candidates
     * compiled into an enum make that impossible. Never throws for an unknown id, and degrades
     * to `{ fallback: true }` with a legal move rather than leaving you with no action.
     */
    function chooseAction(input: ChooseActionInput): Promise<Choice>

    /**
     * Streamed text. Same input as generate() plus an optional AbortSignal. The returned object is
     * async-iterable and carries .cancel(); `break` out of the for-await also cancels (so you stop
     * paying for tokens you no longer want). Errors throw from the iterator with the same
     * `aibox/...` codes. Structured output is never streamed — decide()/chooseAction() stay atomic,
     * because half a JSON object is useless to your code.
     *
     *   const s = aibox.ai.generateStream({ prompt, intent: "balanced" })
     *   for await (const delta of s) out.textContent += delta
     */
    function generateStream(input: GenerateInput & { signal?: AbortSignal }): AIStream

    interface AIStream extends AsyncIterable<string> {
      /** Stop generation. Idempotent; safe to call after the stream ended. */
      cancel(): void
      readonly streamId: string
    }

    /** Budget so far for this applet. Gate expensive features on it. */
    function usage(): Promise<Usage>

    // ---- L3 sugar: thin wrappers over generate/decide with tuned prompts. No extra permission. ----

    /** style: e.g. "bullets" | "paragraph" | "tldr". */
    function summarize(text: string, options?: { style?: string; maxWords?: number }): Promise<string>
    /** tone: e.g. "polite" | "concise" | "friendly"; purpose: e.g. "email" | "chat". */
    function rewrite(text: string, options?: { tone?: string; purpose?: string }): Promise<string>
    /** to: BCP-47 tag or a plain language name, e.g. "en" / "Japanese". */
    function translate(text: string, options: { to: string }): Promise<string>
    /** Returns one of `labels` (enum-constrained, so the result is always usable). */
    function classify(text: string, labels: string[]): Promise<string>
    /** fieldsSpec maps field name to a type hint, e.g. { amount: "number", merchant: "string" }. */
    function extract<T = Record<string, unknown>>(text: string, fieldsSpec: Record<string, string>): Promise<T>
  }


  namespace tools {
    /**
     * 宿主 AgentTool 名。宿主虚拟 .aibox/aibox.d.ts 里这里是**按本机 grant 现算**的字面量联合；
     * 市场包编译期没有那份清单，故退化成 string。工具是否可调用仍由运行时 grant 决定。
     */
    type HostToolName = string
    interface HostToolArguments { [name: string]: Record<string, unknown> }
    interface ToolSummary { name: string; description: string; parameters: string[] }
    interface ArtifactRef { uri: string; kind: string; status: string; title?: string; origin?: string }
    interface ToolCallResult {
      ok: boolean
      tool: string
      text: string
      permission: string
      isError: boolean
      progress: string[]
      imageCount: number
      artifacts: ArtifactRef[]
      details?: JSONValue
      error?: string
    }

    function list(input?: { limit?: number }): Promise<ToolSummary[]>
    function search(input: { query: string; limit?: number }): Promise<ToolSummary[]>
    function describe(input: { name: HostToolName }): Promise<{
      name: string; description: string; shortDescription: string; parameters: JSONValue
    }>
    function call(input: { name: HostToolName; arguments?: Record<string, unknown> }): Promise<ToolCallResult>
    function callBatch(input: {
      calls: Array<{ name: HostToolName; arguments?: Record<string, unknown> }>
    }): Promise<ToolCallResult[]>
  }
}

interface Window {
  /** Effective host language, available before the applet's first render. */
  readonly __aiboxEnvironment?: Readonly<{ locale: string; language: string }>
  /** The bridge object. Present in every applet WebView; `undefined` outside one. */
  readonly aibox?: typeof aibox
}

/** 宿主可声明的扩展能力命名空间（manifest.permissions.capabilities 的取值域）。 */
declare type AiboxDeclarableCapability = "audio" | "browser" | "calendar" | "clipboard" | "contacts" | "device" | "download" | "files" | "haptics" | "health" | "location" | "media" | "music" | "notifications" | "open" | "photos" | "picker" | "reminders" | "secrets" | "share" | "shortcuts" | "speech" | "toast" | "tools" | "tts" | "ui" | "video" | "vision" | "voiceMemos"

/** 容器恒可用命名空间：无需也不该写进 manifest.permissions.capabilities。 */
declare type AiboxAlwaysAvailableNamespace = "access" | "action" | "apps" | "chat" | "data" | "db" | "jobs" | "lifecycle" | "list" | "menu" | "navigation" | "overlay" | "resource" | "scene" | "tabs" | "toolbar"

// 本文件**必须**保持为 global script（没有顶层 import/export）——加一行 `export {}` 就会把它变成
// 模块，`declare namespace aibox` 随即只在该模块内可见，全仓的 `aibox.*` 类型一起失效。
