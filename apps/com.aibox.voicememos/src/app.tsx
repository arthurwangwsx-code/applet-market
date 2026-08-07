// 根视图（规格 §1）：3 个底部 Tab（录音 / 文件夹 / 设置）。
//
// **录音界面不是 Tab，是从列表页底部 FAB 弹出的 sheet**，而且「先真正起录成功，才弹面板」。
// FAB 只在列表根页渲染；push 到详情后随根页一起退出视野。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useScene, useTabs } from '@aibox/applet-sdk/react'
import { ActionItemsSheet, AskSheet, CleanUpSheet } from './components/AiSheets.js'
import { FilterSheet, MemoList, applyFilter } from './components/MemoList.js'
import { LibraryTab, SettingsTab, TrashPage } from './components/AppPages.js'
import { MemoDetail } from './components/MemoDetailView.js'
import type { DetailContext } from './components/MemoDetailTypes.js'
import { RecordSheet } from './components/RecordSheet.js'
import { Icon, PushPage } from './components/primitives.js'
import { useSubpageStack } from 'aibox/ui'
import { setNavigationTitle, useHostChrome, useHostMenu, useOverlay } from './lib/shell.js'
import { registerMemoActions } from './lib/actions.js'
import { defaultTitle, exportMarkdown, exportSRT, exportText, fileSlug } from './lib/format.js'
import {
  capabilities,
  haptic,
  listClips,
  loadArtifacts,
  localeTag,
  newID,
  recordStart,
  recorderAvailability,
  saveClip,
  transcribeAvailability,
  transcribeClip,
} from './lib/memos.js'
import {
  actionSheet,
  confirmAlert,
  confirmDestructive,
  copyText,
  promptText,
  shareClipAudio,
  shareFile,
  shareText,
} from './lib/dialogs.js'
import { makeT, type Lang } from './lib/strings.js'
import { useMemoStore } from './lib/store.js'
import { RADIUS, SPACE, alpha, palette as makePalette } from './lib/theme.js'
import {
  DEFAULT_FILTER,
  QUALITY_PRESET,
  filterIsActive,
  type Memo,
  type MemoArtifacts,
  type MemoFilter,
} from './lib/types.js'

type TabID = 'record' | 'library' | 'settings'

type Route = { kind: 'detail'; memo: Memo } | { kind: 'scoped'; scope: 'all' | 'fav' } | { kind: 'trash' }

/** 子页在 history 里的路径。页面自己不读它，只为宿主诊断与 `navigation.getState().url` 可读。 */
function routePath(route: Route): string {
  if (route.kind === 'detail') return `#/memo/${encodeURIComponent(route.memo.id)}`
  if (route.kind === 'scoped') return `#/list/${route.scope}`
  return '#/trash'
}

export default function App() {
  const scene = useScene()
  const locale = useLocale()
  const tabs = useTabs()
  const store = useMemoStore()

  const lang: Lang = locale.language.startsWith('zh') ? 'zh' : 'en'
  const t = useMemo(() => makeT(lang), [lang])
  // 子页标题在 push 那一刻要用最新的翻译函数，而 push 回调是稳定的 —— 经 ref 取值。
  const tRef = useRef(t)
  tRef.current = t
  const dark = scene?.appearance.effectiveColorScheme === 'dark'
  const hostAccent = scene?.appearance.accentColor ?? null
  const palette = useMemo(() => {
    const base = makePalette(Boolean(dark))
    return hostAccent ? { ...base, accent: hostAccent } : base
  }, [dark, hostAccent])

  const [tab, setTab] = useState<TabID>('record')
  // 子页栈 = 宿主原生页栈的镜像（`presentation.subpages`）。进详情走 `aibox.navigation.push`，
  // 返回一律经 popstate 回来，于是最左缘左滑是**系统自己的** interactive pop、能实时看到上一页。
  // 用户要求：「页面导航要用系统的，这样回退才是最自然的。另外，菜单的标题要在阅读页面自己定义。」
  // —— 标题由 `titleFor` 在 push 那一刻交给宿主，宿主记进标题栈，返回时自动还原。
  const subpages = useSubpageStack<Route>({
    pathFor: routePath,
    titleFor: (row) => routeTitle(row, tRef.current),
  })
  const route = subpages.route
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MemoFilter>(DEFAULT_FILTER)
  const [filterOpen, setFilterOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [recorder, setRecorder] = useState<{ available: boolean; reason: string; background: boolean } | null>(null)
  /**
   * 转写能力探测。`null` = 还没探完。
   * **`engine-missing` 与 `needs-model-download` 的正确 UI 完全相反**：前者要把整个转写入口藏掉
   * （这个壳里没有转写引擎，点了只会失败），后者要照常显示（第一次点会下模型再转）。
   * 所以这里存的是整个结构而不是一个布尔。
   */
  const [transcription, setTranscription] = useState<{ available: boolean; state: string; engine: boolean } | null>(
    null,
  )
  /**
   * 起录在飞。**首次使用必然要等几秒** —— `recordStart` 要等 iOS 的麦克风授权框被回答才 resolve，
   * 这期间不锁按钮的话，第二下点击会拿到 `aibox/busy` 并弹一个假的失败提示。
   */
  const [starting, setStarting] = useState(false)
  const [busyIDs, setBusyIDs] = useState<Record<string, string>>({})
  const [sheet, setSheet] = useState<'actionItems' | 'ask' | 'cleanUp' | null>(null)
  const detailContext = useRef<DetailContext | null>(null)
  const [detailArtifacts, setDetailArtifacts] = useState<MemoArtifacts | null>(null)
  /** 系统 ⋯ 菜单的可见性输入。**只存这两个布尔**，不把整个 context 塞进 state —— 那东西每帧重建，
   *  进了 state 就是一条自触发的重渲染环。 */
  const [detailMenuState, setDetailMenuState] = useState<{ hasText: boolean; hasSummary: boolean } | null>(null)

  // 切 Tab = **整条子页栈作废**（原生语义：底栏是页栈的兄弟，切过去看到的是那一栏自己的根页）。
  // 只 setTab 不退栈的话，人在详情页切 Tab 会看到「底栏高亮变了、页面纹丝不动」——
  // 因为详情页是盖在根视图上的一层，根视图换了哪个 Tab 它都盖着（2026-08-04 真机反馈）。
  useEffect(() => {
    if (!tabs.rendered || !tabs.selected || tabs.selected === tab) return
    setTab(tabs.selected as TabID)
    subpages.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.selected, tabs.rendered])

  // 宿主画了导航栏（含返回键与 ⋯）就**不再自绘** —— 两条顶栏叠起来是这一轮反复出现的形状。
  const hostChrome = useHostChrome()

  // 顶栏标题：根页用 Tab 名，子页用页面自己定义的标题（用户明确要求「标题要在阅读页面自己定义」）。
  useEffect(() => {
    const title = route ? routeTitle(route, t) : tabTitle(tab, t)
    document.title = title
    setNavigationTitle(title)
  }, [route, tab, t])

  // —— 悬浮层（`aibox.overlay`）——
  //
  // 用户 2026-08-03 真机反馈：「录音按钮以及播放详情页的控制应该是悬浮的。目前需要直接滚动到
  // 最下面才能看到。」录音键是**跨页面常驻的控制**，属于 overlay 而不是页面内容。宿主把它和底栏叠进
  // 同一个 safeAreaInset 并扣掉自己的高度，所以它压不到最后一行、也压不到底栏。
  // `rendered:false` 时下面照旧渲染页内 FAB。
  //
  // ⚠️ **播放条不再走 overlay。** 那一轮把详情页的播放控制搬上悬浮层，是为了解决「要滚到最底才看得到」；
  // 但悬浮条要等页面第一次交互才起得来，于是进详情页只剩一条光进度条、连暂停都没有
  //（2026-08-04 反馈）。播放器现在钉在 `PushPage` 的 footer 里（滚动区之外），同样一直可见，
  // 而且**不依赖另一层是否就位**。声明保留在 manifest 里，但页面不再驱动它 ——
  // 音频元素随详情页卸载即停，跨页面的播放条本来也控不到任何东西。
  const beginRecordingRef = useRef<() => void>(() => undefined)
  /** 详情页把「播放器指令入口」挂到这里，留给宿主侧的播放控制（锁屏 / 未来的常驻条）使用。 */
  const playerCommandRef = useRef<((command: string) => void) | null>(null)

  const overlay = useOverlay((event) => {
    if (event.id === 'record') {
      beginRecordingRef.current()
      return
    }
    if (event.id === 'player') playerCommandRef.current?.(event.controlId || 'toggle')
  })

  // 录音键的展示态。**只能改展示状态**：id、层数在 manifest 里冻结。
  const recordVisible = Boolean(tab === 'record' && !route && recorder?.available && !recordOpen)
  useEffect(() => {
    if (!overlay.rendered) return
    overlay.update({ record: { hidden: !recordVisible, enabled: !starting } })
  }, [overlay.rendered, recordVisible, starting])

  // 播放条恒隐（见上）。留这条 effect 是为了覆盖「装过旧版、宿主侧还留着展示态」的重入场景。
  useEffect(() => {
    if (!overlay.rendered) return
    if (route?.kind !== 'detail') playerCommandRef.current = null
    overlay.update({ player: { hidden: true } })
  }, [overlay.rendered, route])

  // 能力探测：录音不可用就把 FAB 整个藏掉，不留一个点了报错的按钮。转写同理。
  useEffect(() => {
    void (async () => setRecorder(await recorderAvailability()))()
  }, [])

  useEffect(() => {
    void (async () => setTranscription(await transcribeAvailability(localeTag(store.settings.transcribeLocale))))()
  }, [store.settings.transcribeLocale])

  /** 入口该不该出现：引擎在场就出现，哪怕此刻还要下模型。引擎不在场（或宿主太老）一律不渲染。 */
  const transcribable = Boolean(transcription?.engine)

  /**
   * 转一段录音，落进它自己的 clip 记录。
   * 转写是分钟级重活且宿主侧每个 applet 同时只允许一条，所以这里**不并发**、行上转圈到结束为止。
   */
  const runTranscription = useCallback(
    async (memo: Memo) => {
      const clip = (await listClips()).find((item) => item.id === memo.id)
      if (!clip?.handle) return
      setBusyIDs((current) => ({ ...current, [memo.id]: t('transcribing') }))
      await saveClip({ ...clip, transcriptStatus: 'inProgress' })
      store.refresh()
      const outcome = await transcribeClip(clip.handle, localeTag(store.settings.transcribeLocale))
      const latest = (await listClips()).find((item) => item.id === memo.id) ?? clip
      if (outcome.ok) {
        await saveClip({
          ...latest,
          transcriptText: outcome.text,
          transcriptLocale: outcome.locale,
          transcriptSegments: outcome.segments,
          transcriptStatus: 'completed',
        })
      } else {
        await saveClip({ ...latest, transcriptStatus: 'failed' })
        await confirmAlert(t('transcribeFailedTitle'), errorText(t, outcome.error))
        // 失败可能是「授权刚被拒」或「模型装不上」——重新探一次，别让入口一直摆在那儿。
        setTranscription(await transcribeAvailability(localeTag(store.settings.transcribeLocale)))
      }
      setBusyIDs((current) => {
        const next = { ...current }
        delete next[memo.id]
        return next
      })
      store.refresh()
    },
    [store, t],
  )

  const exportLabels = useMemo(
    () => ({
      createdAt: t('labelCreatedAt'),
      duration: t('labelDuration'),
      summary: t('tabSummary'),
      corrected: t('tabCorrected'),
      transcript: t('tabOriginal'),
      chapters: t('chapters'),
      actionItems: t('actionItems'),
      translation: t('tabTranslation'),
    }),
    [t],
  )

  useEffect(() => {
    registerMemoActions(store.refresh, locale.locale, exportLabels)
  }, [store.refresh, locale.locale, exportLabels])

  const beginRecording = useCallback(async () => {
    if (!recorder?.available || starting) return
    setStarting(true)
    const preset = QUALITY_PRESET[store.settings.quality]
    try {
      // 「先真正起录成功，才弹面板」—— 权限被拒时不弹空面板。
      const result = await recordStart(preset)
      if (!result.started) {
        await confirmAlert(t('recordFailedTitle'), errorText(t, result.error))
        setRecorder(await recorderAvailability())
        return
      }
      // 起录成功给一次 medium 触感（权限被拒的早退路径上面已经 return 了，不给）。
      void haptic('medium')
      setDraftTitle('')
      setRecordOpen(true)
    } finally {
      setStarting(false)
    }
  }, [recorder, starting, store.settings.quality, t])
  beginRecordingRef.current = () => {
    void beginRecording()
  }

  /**
   * 一条录音的行级动作。**原生上下文菜单（`aibox.list.*`）与自绘 action sheet 共用这一份**——
   * 两条路各写一遍处理器，就是「同一条录音从不同入口长按看到不一样的行为」的来源。
   */
  const runRowAction = useCallback(
    async (memo: Memo, picked: string) => {
      if (picked === 'rename') {
        const next = await promptText(t('renamePrompt'), memo.title)
        if (!next) return
        const clip = (await listClips()).find((item) => item.id === memo.id)
        if (clip) await saveClip({ ...clip, title: next })
        store.refresh()
        return
      }
      if (picked === 'fav') {
        const clip = (await listClips()).find((item) => item.id === memo.id)
        if (clip) await saveClip({ ...clip, isFavourite: !clip.isFavourite })
        store.refresh()
        return
      }
      if (picked === 'transcribe') {
        await runTranscription(memo)
        return
      }
      if (picked === 'copy') {
        const clip = (await listClips()).find((item) => item.id === memo.id)
        if (clip?.transcriptText) await copyText(clip.transcriptText)
        return
      }
      if (picked === 'share') {
        // 分享的是**音频文件本身**（`share.file` 收 base64）。
        await shareClipAudio(memo)
        return
      }
      if (picked === 'delete') {
        const ok = await confirmDestructive(t('trashConfirmTitle'), t('moveToTrash'), t('cancel'))
        if (!ok) return
        const clip = (await listClips()).find((item) => item.id === memo.id)
        // 软删（可恢复），与原生「移到最近删除」同语义。
        if (clip) await saveClip({ ...clip, isTrashed: true, trashedAt: Date.now() })
        store.refresh()
        if (route?.kind === 'detail') subpages.back()
      }
    },
    [t, store, route, runTranscription, subpages],
  )

  /** 自绘长按菜单（手势层 `rendered:false` 时的降级路径）。动作集与原生上下文菜单逐条一致。 */
  const openMenu = useCallback(
    async (memo: Memo) => {
      const actions: { id: string; title: string; destructive?: boolean }[] = [
        { id: 'rename', title: t('rename') },
        { id: 'fav', title: memo.isFavourite ? t('unfavourite') : t('favourite') },
      ]
      // 转写入口只在**能转**的时候出现。`engine-missing` 那一档整条不渲染——
      // 一个点了只会弹「这个构建没有转写引擎」的菜单项，比没有这一项更糟。
      if (!memo.hasTranscript && transcribable) actions.push({ id: 'transcribe', title: t('startTranscription') })
      if (memo.hasTranscript) actions.push({ id: 'copy', title: t('copyTranscript') })
      actions.push({ id: 'share', title: t('shareAudio') })
      actions.push({ id: 'delete', title: t('moveToTrash'), destructive: true })
      const picked = await actionSheet(actions)
      if (picked) await runRowAction(memo, picked)
    },
    [t, transcribable, runRowAction],
  )

  /**
   * 详情页菜单的**动作半边**。系统 ⋯ 菜单（`menu.invoke`）与自绘 action sheet 共用这一份 ——
   * 两条路各写一遍处理器，就是「同一条录音从不同入口点同一个菜单项、行为不一样」的来源。
   */
  const runDetailAction = useCallback(
    async (picked: string) => {
      const context = detailContext.current
      if (!context) return
      const memo = context.memo

      if (picked === 'actionItems') return setSheet('actionItems')
      if (picked === 'ask') return setSheet('ask')
      if (picked === 'cleanUp') return setSheet('cleanUp')
      if (picked === 'shareTranscript') return void shareText(context.text)
      if (picked === 'shareSummary') return void shareText(context.artifacts?.summaryText ?? '')
      if (picked === 'rename') return void openMenu(memo)

      if (picked.startsWith('export')) {
        const payload = {
          memo,
          locale: locale.locale,
          summary: context.artifacts?.summaryText ?? '',
          transcript: context.text,
          correctionTurns: context.artifacts?.correctionTurns ?? [],
          chapters: context.artifacts?.chapters ?? [],
          actionItems: context.artifacts?.actionItems ?? [],
          translation: context.artifacts?.translationText ?? '',
          labels: exportLabels,
        }
        const format = picked === 'exportMd' ? 'md' : picked === 'exportTxt' ? 'txt' : 'srt'
        const body =
          format === 'srt' ? exportSRT(payload) : format === 'txt' ? exportText(payload) : exportMarkdown(payload)
        await shareFile(`${fileSlug(memo.title)}-${newID().slice(0, 6)}.${format}`, body)
      }
    },
    [locale.locale, exportLabels, openMenu],
  )

  // —— 系统 ⋯ 菜单（`aibox.menu`）——
  //
  // 用户 2026-08-04 真机反馈：「音频播放页面的标题和菜单并没有使用系统的，这个需要去对接一下。」
  // 菜单项在 manifest `scene.menu` 里冻结身份，这里只改**展示态**；点击经 `menu.invoke` 落到
  // 与自绘 sheet 同一份 `runDetailAction`。
  const hostMenu = useHostMenu((id) => {
    void runDetailAction(id)
  })

  /**
   * 详情页把「菜单要按什么决定可见性」交上来。**必须持续上报，不能等用户点了 ⋯ 才知道** ——
   * 系统菜单是宿主画的，弹出那一刻不再经过页面，可见性得提前配好。
   */
  const publishDetailContext = useCallback((context: DetailContext | null) => {
    detailContext.current = context
    setDetailArtifacts(context?.artifacts ?? null)
    setDetailMenuState(
      context ? { hasText: Boolean(context.text.trim()), hasSummary: Boolean(context.artifacts?.summaryText) } : null,
    )
  }, [])

  useEffect(() => {
    if (!hostMenu.declared) return
    const open = detailMenuState !== null
    const text = open && detailMenuState.hasText
    const exportable = text && capabilities.shareFile
    hostMenu.update({
      actionItems: { hidden: !text },
      ask: { hidden: !text },
      cleanUp: { hidden: !text },
      shareTranscript: { hidden: !text },
      shareSummary: { hidden: !(text && detailMenuState.hasSummary) },
      exportMd: { hidden: !exportable },
      exportTxt: { hidden: !exportable },
      exportSrt: { hidden: !exportable },
      rename: { hidden: !open },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostMenu.declared, detailMenuState])

  /** 自绘详情菜单 —— 宿主没有系统 ⋯ 菜单（`declared:false`）时的降级路径，动作集逐条一致。 */
  const openDetailMenu = useCallback(
    async (context: DetailContext) => {
      publishDetailContext(context)
      const hasText = Boolean(context.text.trim())
      const actions: { id: string; title: string; destructive?: boolean }[] = []
      if (hasText) {
        actions.push({ id: 'actionItems', title: t('actionItems') })
        actions.push({ id: 'ask', title: t('askTitle') })
        actions.push({ id: 'cleanUp', title: t('cleanUp'), destructive: true })
        actions.push({ id: 'shareTranscript', title: t('shareTranscript') })
        if (context.artifacts?.summaryText) actions.push({ id: 'shareSummary', title: t('shareSummary') })
        if (capabilities.shareFile) {
          actions.push({ id: 'exportMd', title: t('exportMarkdown') })
          actions.push({ id: 'exportTxt', title: t('exportText') })
          actions.push({ id: 'exportSrt', title: t('exportSRT') })
        }
      }
      actions.push({ id: 'rename', title: t('rename') })
      const picked = await actionSheet(actions)
      if (picked) await runDetailAction(picked)
    },
    [t, publishDetailContext, runDetailAction],
  )

  const rootMemos = store.memos
  // 2.0.0 只剩一个来源，「本机剪辑」这一段等同于「全部」，故智能列表只留 全部 / 收藏。
  const scopedMemos =
    route?.kind === 'scoped' ? (route.scope === 'fav' ? rootMemos.filter((memo) => memo.isFavourite) : rootMemos) : []

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: palette.bg,
        color: palette.ink,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {tab === 'record' ? (
        <>
          <div
            style={{ display: 'flex', gap: SPACE.s2, alignItems: 'center', padding: `${SPACE.s3}px ${SPACE.s4}px 0` }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              enterKeyHint="search"
              style={{
                flex: 1,
                borderRadius: 10,
                border: 'none',
                padding: '9px 12px',
                fontSize: 16,
                background: palette.surface,
                color: palette.ink,
              }}
            />
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 8,
                color: filterIsActive(filter) ? palette.accent : palette.muted,
              }}
              aria-label={t('filter')}
            >
              <Icon name="list" size={18} />
            </button>
          </div>

          {transcription && !transcription.engine ? (
            <div
              style={{
                margin: `${SPACE.s3}px ${SPACE.s4}px 0`,
                background: alpha(palette.orange, 0.12),
                borderRadius: RADIUS.field,
                padding: SPACE.s3,
                fontSize: 12,
                color: palette.orange,
              }}
            >
              <Icon name="warning" size={12} /> {t('transcribeUnavailable')}
            </div>
          ) : null}

          <main style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <MemoList
              palette={palette}
              t={t}
              dark={Boolean(dark)}
              memos={rootMemos}
              query={query}
              filter={filter}
              scoped={false}
              busyIDs={busyIDs}
              onOpen={(memo) => subpages.push({ kind: 'detail', memo })}
              onMenu={openMenu}
              onAction={(memo, actionId) => {
                void runRowAction(memo, actionId)
              }}
              onClearFilter={() => setFilter(DEFAULT_FILTER)}
            />
            <div style={{ height: 96 }} />
          </main>

          {/* FAB 只在列表根页渲染。录音能力不可用时整块不出现。
              宿主画了悬浮层就交给它 —— 页内 FAB 是 `rendered:false` 的降级路径（合同 §2.5.5）。 */}
          {recorder?.available && !overlay.rendered ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                justifyContent: 'center',
                paddingBottom: `calc(${tabs.rendered ? 16 : 74}px + env(safe-area-inset-bottom))`,
                pointerEvents: 'none',
              }}
            >
              <button
                type="button"
                disabled={starting}
                onClick={() => void beginRecording()}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  border: 'none',
                  cursor: starting ? 'default' : 'pointer',
                  opacity: starting ? 0.55 : 1,
                  background: palette.red,
                  color: '#FFFFFF',
                  fontSize: 18,
                  pointerEvents: 'auto',
                  boxShadow: '0 3px 6px rgba(0,0,0,0.18)',
                }}
                aria-label={t('record')}
              >
                <Icon name="mic" size={18} />
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === 'library' ? (
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <LibraryTab
            palette={palette}
            t={t}
            memos={rootMemos}
            trashCount={store.clips.filter((clip) => clip.isTrashed).length}
            onScope={(scope) => subpages.push({ kind: 'scoped', scope })}
            onTrash={() => subpages.push({ kind: 'trash' })}
          />
        </main>
      ) : null}

      {tab === 'settings' ? (
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <SettingsTab
            palette={palette}
            t={t}
            dark={Boolean(dark)}
            settings={store.settings}
            onChange={store.updateSettings}
            clips={store.clips}
          />
        </main>
      ) : null}

      {!tabs.rendered ? (
        <nav
          style={{
            display: 'flex',
            borderTop: `1px solid ${palette.line}`,
            background: palette.surface,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {(['record', 'library', 'settings'] as TabID[]).map((id) => (
            // 与宿主底栏同一条语义：切 Tab = 整条子页栈作废（见上面 tabs.selected 那条 effect）。
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id)
                subpages.reset()
              }}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                padding: '10px 0 12px',
                fontSize: 11,
                cursor: 'pointer',
                color: tab === id ? palette.accent : palette.muted,
              }}
            >
              <div style={{ fontSize: 18, lineHeight: '22px' }}>
                <Icon name={id === 'record' ? 'mic' : id === 'library' ? 'folder' : 'gear'} size={18} />
              </div>
              {t(id === 'record' ? 'tabRecord' : id === 'library' ? 'tabFolders' : 'tabSettings')}
            </button>
          ))}
        </nav>
      ) : null}

      {route?.kind === 'detail' ? (
        <MemoDetail
          palette={palette}
          t={t}
          dark={Boolean(dark)}
          memo={route.memo}
          settings={store.settings}
          onBack={subpages.back}
          onMenu={openDetailMenu}
          onContext={publishDetailContext}
          hostMenu={hostMenu.declared}
          onRefresh={store.refresh}
          registerPlayerCommand={(handler) => {
            playerCommandRef.current = handler
          }}
          chrome={!hostChrome}
        />
      ) : null}

      {route?.kind === 'scoped' ? (
        <PushPage palette={palette} title={routeTitle(route, t)} onBack={subpages.back} chrome={!hostChrome}>
          <MemoList
            palette={palette}
            t={t}
            dark={Boolean(dark)}
            memos={scopedMemos}
            query=""
            filter={DEFAULT_FILTER}
            scoped
            busyIDs={busyIDs}
            regionId="memos.scoped"
            onOpen={(memo) => subpages.push({ kind: 'detail', memo })}
            onMenu={openMenu}
            onAction={(memo, actionId) => {
              void runRowAction(memo, actionId)
            }}
            onClearFilter={() => undefined}
          />
        </PushPage>
      ) : null}

      {route?.kind === 'trash' ? (
        <TrashPage palette={palette} t={t} store={store} onBack={subpages.back} chrome={!hostChrome} />
      ) : null}

      <FilterSheet
        palette={palette}
        t={t}
        open={filterOpen}
        filter={filter}
        onChange={setFilter}
        onClose={() => setFilterOpen(false)}
      />

      <RecordSheet
        palette={palette}
        t={t}
        open={recordOpen}
        title={draftTitle}
        onTitleChange={setDraftTitle}
        backgroundSupported={Boolean(recorder?.background)}
        onCancel={() => setRecordOpen(false)}
        onFinish={async (clip) => {
          setRecordOpen(false)
          if (clip.discarded) return
          await saveClip({
            id: newID(),
            // 默认标题必须在进持久层前解析成用户语言的真实文案。
            title: draftTitle.trim() || defaultTitle(t('newRecording'), locale.locale),
            createdAt: Date.now(),
            durationMs: clip.durationMs,
            handle: clip.handle,
            url: clip.url,
            byteCount: clip.byteCount,
            isFavourite: false,
            isTrashed: false,
            trashedAt: null,
            interrupted: clip.interrupted,
          })
          store.refresh()
        }}
      />

      <ActionItemsSheet
        palette={palette}
        t={t}
        open={sheet === 'actionItems'}
        memoID={detailContext.current?.memo.id ?? ''}
        transcript={detailContext.current?.text ?? ''}
        artifacts={detailArtifacts}
        onArtifacts={(value) => {
          setDetailArtifacts(value)
          detailContext.current?.setArtifacts(value)
        }}
        onSeek={(seconds) => detailContext.current?.seek?.(seconds)}
        onClose={() => setSheet(null)}
      />
      <AskSheet
        palette={palette}
        t={t}
        open={sheet === 'ask'}
        transcript={detailContext.current?.text ?? ''}
        onClose={() => setSheet(null)}
      />
      <CleanUpSheet
        palette={palette}
        t={t}
        open={sheet === 'cleanUp'}
        memoID={detailContext.current?.memo.id ?? ''}
        transcript={detailContext.current?.text ?? ''}
        onClose={() => setSheet(null)}
        onApplied={store.refresh}
      />
    </div>
  )
}

/** 子页标题 —— 阅读页自己定义（用户要求），push 那一刻交给宿主，返回时宿主自动还原上一层。 */
function routeTitle(route: Route, t: T): string {
  if (route.kind === 'detail') return route.memo.title
  if (route.kind === 'scoped') return route.scope === 'fav' ? t('smartFavourites') : t('smartAllRecordings')
  return t('recentlyDeleted')
}

function tabTitle(tab: TabID, t: T): string {
  if (tab === 'library') return t('tabFolders')
  if (tab === 'settings') return t('tabSettings')
  return t('titleVoiceMemos')
}

type T = ReturnType<typeof makeT>

function errorText(t: T, reason: string): string {
  const value = reason.toLowerCase()
  if (value.includes('denied') || value.includes('microphone-denied')) return t('micDenied')
  if (value.includes('busy')) return t('micBusy')
  return t('recorderUnavailable')
}

export { applyFilter, loadArtifacts }
