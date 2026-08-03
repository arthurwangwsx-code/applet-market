// 本文件由 applet-market/scripts/gen-sdk-types.mjs 生成，请勿手改。
// 真值：
//   · Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletDeveloperSDK+TypeScript.swift（platformTypeScript）
//   · Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletDeveloperSDK.swift（aiTypeScript）
//   · applet-market/docs/api/capabilities.snapshot.json（descriptor 快照，由 gen-api-docs.mjs 抽取）
// 重新生成： npm run sdk:types      漂移检查： npm run sdk:types:check
// 命名空间：44 个（宿主恒有 16 个、可声明 25 个）

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
    }
    function getState(): Promise<State>
    function on(event: "active" | "inactive" | "foreground" | "background" | "memoryWarning", handler: (state: State) => void): () => void
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
    function list(input?: Record<string, never>): Promise<unknown>
    /** Read one applet's action/event contract. Result: {id,name,summary,actions,events} */
    function describe(input: { app: string }): Promise<unknown>
    /** Headlessly invoke a registered action on another applet. Result: {appId,action,result} */
    function invoke(input: { action: string; app: string; input?: unknown; waitMs?: number }): Promise<unknown>
    /** Publish one event declared by the current applet and run matching event automations. Result: {event,accepted,automationsRun} */
    function emit(input: { event: string; payload?: unknown }): Promise<unknown>
  }

  namespace audio {
    /** Probe whether recording can start right now. Never prompts and never opens the microphone — call it on mount and hide the record button when unavailable. Result: {available, microphone, supportsBackgroundRecording, busy, reason} */
    function availability(input?: Record<string, never>): Promise<unknown>
    /** Start recording. Shows no host UI. Fails with aibox/busy if any recording is already running. Result: {started, discarded, format, sampleRate, channels, supportsBackgroundRecording} — started:false with discarded:true means you called recordStop while the permission prompt was still up, so nothing was captured */
    function recordStart(input?: { bitrate?: number; channels?: 1 | 2; format?: "m4a" | "wav"; sampleRate?: number }): Promise<unknown>
    /** Pause the recording. Returns false when there is nothing of yours to pause, or after an interruption (that file is already finalized). Result: boolean */
    function recordPause(input?: Record<string, never>): Promise<unknown>
    /** Resume a paused recording. Result: boolean */
    function recordResume(input?: Record<string, never>): Promise<unknown>
    /** Stop and finalize. Returns an applet resource handle you can play with <audio src=ref.url> or decode with AudioContext. Clips shorter than 500ms are discarded (discarded:true) and nothing is written. Result: {handle, url, name, mimeType, size, durationMs, byteCount, format, sampleRate, channels, interrupted} | {discarded:true, durationMs} */
    function recordStop(input?: Record<string, never>): Promise<unknown>
    /** Discard the recording and delete the file. Nothing is stored. Result: boolean */
    function recordCancel(input?: Record<string, never>): Promise<unknown>
    /** Poll while recording. levels holds the most recent 120 samples (20 Hz, ~6s) already normalized to 0…1 with the same curve the native recorder uses, oldest first — pad the left with zeros and draw the newest at the right edge. Result: {state, recording, paused, interrupted, elapsedMs, byteCount, levels, levelsHz, averageDb, peakDb} */
    function recordStatus(input?: Record<string, never>): Promise<unknown>
    /** Probe whether transcribe() can run for a locale. Never prompts and never transcribes — call it before showing a transcribe button. state tells you WHY it is unavailable: engine-missing (this build has no transcription engine), not-authorized, unsupported-locale, unsupported-os, needs-model-download (transcribe() will download it on first use, so this state is still worth offering). Result: {available, state, locale, engine} — state is one of available | needs-model-download | not-authorized | unsupported-locale | unsupported-os | engine-missing */
    function transcribeAvailability(input?: { locale?: string }): Promise<unknown>
    /** Transcribe an audio resource of YOUR OWN into text plus timestamped segments. Pass the handle from recordStop() or picker.file() — never a file path (you do not have one, and the host resolves the handle itself). Long files take minutes; one transcription per applet at a time. First use may prompt for speech recognition and may download the locale model. Result: {text, locale, segments:[{text, start, duration, end}], segmentCount} — start/duration/end are seconds */
    function transcribe(input: { handle: string; locale?: string; segments?: boolean }): Promise<unknown>
  }

  namespace browser {
    /** Open an http/https URL. mode inApp keeps the user inside the app (default); system uses SFSafari so Safari logins/passkeys apply; external hands off to the default browser app. Unavailable modes degrade inApp → system → external instead of failing. Result: {opened:boolean, mode:string} */
    function open(input: { mode?: "inApp" | "system" | "external"; url: string }): Promise<unknown>
    /** Open a link straight into Reader with content you already extracted, so the host does not fetch and parse it a second time. Result: {opened:boolean, mode:string, reader:boolean} */
    function openArticle(input: { content?: string; excerpt?: string; publishedAt?: string; siteName?: string; title?: string; url: string }): Promise<unknown>
    /** Which modes this host can actually serve right now, and whether Reader exists. Hide entry points the host cannot honor instead of letting a tap do nothing. Result: {modes:string[], reader:boolean} */
    function availability(input?: Record<string, never>): Promise<unknown>
  }

  namespace calendar {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function events(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function subscribe(input?: Record<string, never>): Promise<unknown>
  }

  namespace chat {
    /** Set the collaboration mode for this applet. Result: ConversationBinding */
    function bind(input?: { mode?: "use" | "build" | "diagnose" | "automate" }): Promise<unknown>
    /** Update the compact current-page snapshot without sending a chat message. Result: ContextSnapshot */
    function snapshot(input?: { consoleErrors?: Array<string>; formState?: unknown; pageTitle?: string; route?: string; selectedElement?: Record<string, unknown>; visibleText?: string }): Promise<unknown>
    /** Read the current collaboration binding and compact snapshot. Result: ConversationBinding */
    function context(input?: Record<string, never>): Promise<unknown>
    /** Record a user-selected DOM element for precise AI edits. Result: SelectedElement */
    function selectElement(input: { element: Record<string, unknown> }): Promise<unknown>
    /** Report build/diagnostic progress for the chat card and Studio. Result: CollaborationEnvelope */
    function report(input: { changedFiles?: Array<string>; errors?: Array<string>; message?: string; mode?: "use" | "build" | "diagnose" | "automate"; phase: "idle" | "planning" | "editing" | "running" | "testing" | "completed" | "failed"; progress?: number }): Promise<unknown>
    /** Read the latest collaboration progress envelope. Result: CollaborationEnvelope|null */
    function progress(input?: Record<string, never>): Promise<unknown>
    /** Explicitly hand the current compact snapshot to the docked AI conversation; optionally send a visible suggested prompt. Result: boolean */
    function shareContext(input?: { suggestedPrompt?: string }): Promise<unknown>
  }

  namespace clipboard {
    /** Read clipboard text. Result: string */
    function read(input?: Record<string, never>): Promise<unknown>
    /** Replace clipboard text. Result: boolean */
    function write(input: { text: string }): Promise<unknown>
  }

  namespace contacts {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function find(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function create(input?: Record<string, never>): Promise<unknown>
  }

  namespace data {
    /** Bytes used and remaining across this applet's private data (kv + db + imports). Check it before bulk writes and use it to drive your own eviction policy — the host sets the budget, you decide what to drop. Result: {usedBytes, limitBytes, remainingBytes, layers:{kv,db,imports,other}} */
    function usage(input?: Record<string, never>): Promise<unknown>
    /** Which version last wrote the data on disk versus the version running now. This is the migration hook: when changed is true, migrate from previous to current, then call acknowledgeVersion(). The host knows nothing about your schema. Result: {current, previous, isFirstRun, changed, firstSeenAt?} */
    function version(input?: Record<string, never>): Promise<unknown>
    /** Mark the current version's data as migrated. Idempotent; until you call it, version() keeps reporting the same transition, so a failed migration is retried instead of silently skipped. Result: {current, previous, isFirstRun, changed} */
    function acknowledgeVersion(input?: Record<string, never>): Promise<unknown>
    /** The data snapshot the host captured before the last update, if any. Read it to tell the user a rollback point exists; the host keeps exactly one. Result: {version?, capturedAt?, bytes} | null */
    function snapshot(input?: Record<string, never>): Promise<unknown>
  }

  namespace db {
    /** List collection names. Result: string[] */
    function collections(input?: Record<string, never>): Promise<unknown>
    /** Insert or replace one JSON object; returns metadata including _id. Result: stored document */
    function insert(input: { collection: string; document: Record<string, unknown> }): Promise<unknown>
    /** Read one document by _id. Result: document|null */
    function get(input: { collection: string; id: string }): Promise<unknown>
    /** Patch one document; JSON null removes a field. Result: updated document */
    function update(input: { collection: string; id: string; merge?: boolean; patch: Record<string, unknown> }): Promise<unknown>
    /** Delete one document by _id. Result: boolean */
    function remove(input: { collection: string; id: string }): Promise<unknown>
    /** Query by exact field equality, with stable sorting and pagination. Result: document[] */
    function query(input: { collection: string; descending?: boolean; limit?: number; offset?: number; sortBy?: string; where?: Record<string, unknown> }): Promise<unknown>
    /** Count documents matching exact field equality. Result: number */
    function count(input: { collection: string; where?: Record<string, unknown> }): Promise<unknown>
    /** Delete every document in one collection. Result: boolean */
    function clear(input: { collection: string }): Promise<unknown>
  }

  namespace device {
    /** Read the current device state. Result: {model, systemName, systemVersion, idiom, locale, timeZone, batteryLevel?, batteryState, freeDiskBytes?} */
    function info(input?: Record<string, never>): Promise<unknown>
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
    function impact(input?: { style?: "light" | "medium" | "heavy" | "soft" | "rigid" }): Promise<unknown>
    /** Play a selection tick. Result: boolean */
    function selection(input?: Record<string, never>): Promise<unknown>
    /** Play a success, warning, or error pattern. Result: boolean */
    function notify(input?: { type?: "success" | "warning" | "error" }): Promise<unknown>
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
    function list(input?: Record<string, never>): Promise<unknown>
    /** Create or update an automation. Result: Automation */
    function register(input: { action: string; enabled?: boolean; id?: string; input?: unknown; name?: string; trigger: { at?: string; event?: string; hour?: number; intervalSeconds?: number; kind: "once" | "interval" | "daily" | "event" | "appLaunch" | "appForeground" | "appletOpen"; minute?: number } }): Promise<unknown>
    /** Remove one automation. Result: boolean */
    function remove(input: { id: string }): Promise<unknown>
    /** Run one automation immediately. Result: boolean */
    function run(input: { id: string }): Promise<unknown>
    /** Run every currently due automation for this applet. Result: {count:number} */
    function runDue(input?: Record<string, never>): Promise<unknown>
    /** Read the next calculable due time for every enabled automation. Result: {id,nextAt:string|null}[] */
    function next(input?: Record<string, never>): Promise<unknown>
  }

  namespace list {
    /** Read whether the host actually attached the gesture layer, plus the declared actions of one region. Always readable — this is the degradation probe. Result: {rendered, regions:string[], configured?, contextMenu?, leadingSwipe?, trailingSwipe?, rows?} */
    function getState(input?: { regionId?: string }): Promise<unknown>
    /** Declare the row actions of one region. Identity (ids, role, tint) is fixed here; per-row differences go through setRows overrides. Re-configuring the same regionId replaces the declaration and drops the stale row rectangles. Result: {rendered, regions, configured, contextMenu, leadingSwipe, trailingSwipe, rows} */
    function configure(input: { contextMenu?: Array<{ icon?: string; id: string; role?: "normal" | "destructive"; tint?: "default" | "accent" | "danger"; title: string }>; leadingSwipe?: Array<{ icon?: string; id: string; role?: "normal" | "destructive"; tint?: "default" | "accent" | "danger"; title: string }>; regionId: string; trailingSwipe?: Array<{ icon?: string; id: string; role?: "normal" | "destructive"; tint?: "default" | "accent" | "danger"; title: string }> }): Promise<unknown>
    /** Report the currently VISIBLE row rectangles. rect is [x, y, width, height] in CSS points in viewport coordinates — exactly getBoundingClientRect(); never multiply by devicePixelRatio and never add scrollTop. Rectangles expire after 600ms, so re-report on every scroll frame (VirtualList and useListGestures already do). Per-row 'actions' overrides may change title/icon/enabled/hidden only — never identity. Result: {accepted:boolean, regionId, rows?, generation?, reason?} */
    function setRows(input: { regionId: string; rows: Array<{ actions?: Record<string, unknown>; id: string; rect: Array<number> }> }): Promise<unknown>
    /** Drop a region when its list unmounts. Idempotent. Result: {released:boolean, regionId} */
    function release(input: { regionId: string }): Promise<unknown>
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
    function play(input: { channel?: "music" | "voice" | "sfx" | "ambient"; loop?: boolean; path: string; volume?: number }): Promise<unknown>
    /** Pause one playback handle. Result: boolean */
    function pause(input: { id: string }): Promise<unknown>
    /** Resume one playback handle. Result: boolean */
    function resume(input: { id: string }): Promise<unknown>
    /** Stop one playback handle. Result: boolean */
    function stop(input: { id: string }): Promise<unknown>
    /** Stop all audio, optionally limited to one channel. Result: integer */
    function stopAll(input?: { channel?: "music" | "voice" | "sfx" | "ambient" }): Promise<unknown>
    /** Read playback state for one handle. Result: {id,state,currentTime,duration,channel} */
    function getState(input: { id: string }): Promise<unknown>
  }

  namespace menu {
    /** Read the effective business menu and host-menu policy. Result: {declared,mergePolicy,hostPlacement,hostItems,items} */
    function getState(input?: Record<string, never>): Promise<unknown>
    /** Update title, icon, enabled or hidden for declared item ids; action identity cannot change. Result: menu state */
    function update(input: { items: Record<string, unknown> }): Promise<unknown>
    /** Clear all runtime menu overrides and restore manifest values. Result: menu state */
    function reset(input?: Record<string, never>): Promise<unknown>
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
    function url(input: { url: string }): Promise<unknown>
  }

  namespace overlay {
    /** Read the effective overlay items and whether the host actually rendered them (card/sheet/drawer surfaces do not). Always readable — this is the degradation probe. Result: {declared, rendered, items:[{id,kind,icon,activeIcon,title,subtitle,tint,progress,active,enabled,hidden,controls:[{id,icon,activeIcon,tint,active,enabled}]}]} */
    function getState(input?: Record<string, never>): Promise<unknown>
    /** Update the display state of declared overlay ids: icon, activeIcon, title, subtitle, tint, progress, active, enabled, hidden, and the same fields on declared controls. Layers and controls cannot be added, removed or renamed by id. Result: overlay state */
    function update(input: { items: Record<string, unknown> }): Promise<unknown>
    /** Clear all runtime overlay overrides and restore manifest values. Result: overlay state */
    function reset(input?: Record<string, never>): Promise<unknown>
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

  namespace shortcuts {
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function run(input?: Record<string, never>): Promise<unknown>
    /**  Result: {ok, text, permission, details?, progress, artifacts} */
    function open(input?: Record<string, never>): Promise<unknown>
  }

  namespace speech {
    /** Probe whether recognition can run right now. Never prompts and never opens the microphone — call it on mount and hide the mic button when unavailable. Result: {available, supportsOnDevice, microphone, speech, locale, reason} */
    function availability(input?: { locale?: string }): Promise<unknown>
    /** Open the microphone and resolve with the recognized text. Resolves when you call stop(), when maxDurationMs elapses, or when the engine finalizes. For push-to-talk, call recognize() WITHOUT awaiting on press and stop() on release, then await the recognize promise. Result: {transcript, confidence, locale, cancelled, timedOut, onDevice} */
    function recognize(input?: { locale?: string; maxDurationMs?: number; onPartial?: boolean }): Promise<unknown>
    /** Stop capturing and let the pending recognize() resolve with the final text. Result: boolean */
    function stop(input?: Record<string, never>): Promise<unknown>
    /** Abandon the pending recognize(); it resolves with cancelled:true and an empty transcript. Result: boolean */
    function cancel(input?: Record<string, never>): Promise<unknown>
    /** Poll the in-flight session: elapsed time and the interim transcript so far. Result: {recognizing, elapsedMs, partial, locale} */
    function status(input?: Record<string, never>): Promise<unknown>
  }

  namespace toast {
    /** Show a transient message. Result: boolean */
    function show(input: { message: string }): Promise<unknown>
  }

  namespace tts {
    /** Speak text aloud. Returns as soon as speaking starts (it does not wait for the end). Result: boolean */
    function speak(input: { lang?: string; pitch?: number; rate?: number; text: string }): Promise<unknown>
    /** Stop what this applet is currently speaking. Result: boolean */
    function stop(input?: Record<string, never>): Promise<unknown>
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
declare type AiboxDeclarableCapability = "audio" | "browser" | "calendar" | "clipboard" | "contacts" | "device" | "files" | "haptics" | "health" | "location" | "media" | "music" | "notifications" | "open" | "photos" | "picker" | "reminders" | "share" | "shortcuts" | "speech" | "toast" | "tools" | "tts" | "ui" | "voiceMemos"

/** 容器恒可用命名空间：无需也不该写进 manifest.permissions.capabilities。 */
declare type AiboxAlwaysAvailableNamespace = "access" | "action" | "apps" | "chat" | "data" | "db" | "jobs" | "lifecycle" | "list" | "menu" | "navigation" | "overlay" | "resource" | "scene" | "tabs" | "toolbar"

// 本文件**必须**保持为 global script（没有顶层 import/export）——加一行 `export {}` 就会把它变成
// 模块，`declare namespace aibox` 随即只在该模块内可见，全仓的 `aibox.*` 类型一起失效。
