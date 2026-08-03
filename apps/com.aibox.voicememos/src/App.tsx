// 根视图（规格 §1）：3 个底部 Tab（录音 / 文件夹 / 设置）。
//
// **录音界面不是 Tab，是从列表页底部 FAB 弹出的 sheet**，而且「先真正起录成功，才弹面板」。
// FAB 只在列表根页渲染；push 到详情后随根页一起退出视野。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useScene, useTabs } from '@aibox/applet-sdk/react'
import { ActionItemsSheet, AskSheet, CleanUpSheet } from './components/AiSheets'
import { FilterSheet, MemoList, Toggle, applyFilter } from './components/MemoList'
import { MemoDetail, type DetailContext } from './components/MemoDetail'
import { RecordSheet } from './components/RecordSheet'
import { Icon, PushPage } from './components/primitives'
import { setNavigationTitle, useOverlay, useSubpageStack } from './lib/shell'
import { registerMemoActions } from './lib/actions'
import { clockString, defaultTitle, exportMarkdown, exportSRT, exportText, fileSlug, byteSize } from './lib/format'
import {
  capabilities, deleteClip, haptic, listClips, loadArtifacts, localeTag, newID, recordStart,
  recorderAvailability, saveClip, transcribeAvailability, transcribeClip,
} from './lib/memos'
import { makeT, type Lang } from './lib/strings'
import { useMemoStore } from './lib/store'
import { RADIUS, SPACE, alpha, brandTint, palette as makePalette, type Palette } from './lib/theme'
import {
  DEFAULT_FILTER, QUALITY_PRESET, filterIsActive, type Memo, type MemoArtifacts, type MemoFilter,
  type Settings, type SummaryTemplate,
} from './lib/types'

type TabID = 'record' | 'library' | 'settings'

type Route =
  | { kind: 'detail'; memo: Memo }
  | { kind: 'scoped'; scope: 'all' | 'fav' }
  | { kind: 'trash' }

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
  const [transcription, setTranscription] = useState<{ available: boolean; state: string; engine: boolean } | null>(null)
  /**
   * 起录在飞。**首次使用必然要等几秒** —— `recordStart` 要等 iOS 的麦克风授权框被回答才 resolve，
   * 这期间不锁按钮的话，第二下点击会拿到 `aibox/busy` 并弹一个假的失败提示。
   */
  const [starting, setStarting] = useState(false)
  const [busyIDs, setBusyIDs] = useState<Record<string, string>>({})
  const [sheet, setSheet] = useState<'actionItems' | 'ask' | 'cleanUp' | null>(null)
  const detailContext = useRef<DetailContext | null>(null)
  const [detailArtifacts, setDetailArtifacts] = useState<MemoArtifacts | null>(null)

  useEffect(() => {
    if (tabs.rendered && tabs.selected && tabs.selected !== tab) setTab(tabs.selected as TabID)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.selected, tabs.rendered])

  // 宿主画了导航栏（含返回键与 ⋯）就**不再自绘** —— 两条顶栏叠起来是这一轮反复出现的形状。
  const [hostChrome, setHostChrome] = useState(false)
  useEffect(() => {
    const api = (window as any).aibox
    if (!api?.toolbar?.getState) return
    void api.toolbar.getState()
      .then((state: any) => setHostChrome(!!(state && state.rendered)))
      .catch(() => undefined)
  }, [])

  // 顶栏标题：根页用 Tab 名，子页用页面自己定义的标题（用户明确要求「标题要在阅读页面自己定义」）。
  useEffect(() => {
    const title = route ? routeTitle(route, t) : tabTitle(tab, t)
    document.title = title
    setNavigationTitle(title)
  }, [route, tab, t])

  // —— 悬浮层（`aibox.overlay`）——
  //
  // 用户 2026-08-03 真机反馈：「录音按钮以及播放详情页的控制应该是悬浮的。目前需要直接滚动到
  // 最下面才能看到。」录音键与播放条都是**跨页面常驻的控制**，属于 overlay 而不是页面内容。
  // 宿主把它和底栏叠进同一个 safeAreaInset（自下而上：底栏 → bar → button）并扣掉自己的高度，
  // 所以它压不到最后一行、也压不到底栏。`rendered:false` 时下面照旧渲染页内 FAB 与页内控制条。
  const beginRecordingRef = useRef<() => void>(() => undefined)
  /** 详情页把「播放器指令入口」挂到这里；overlay 上的控件点击经它转成真正的 audio 操作。 */
  const playerCommandRef = useRef<((command: string) => void) | null>(null)

  const overlay = useOverlay((event) => {
    if (event.id === 'record') { beginRecordingRef.current(); return }
    if (event.id === 'player') playerCommandRef.current?.(event.controlId || 'toggle')
  })

  // 录音键的展示态。**只能改展示状态**：id、层数在 manifest 里冻结。
  const recordVisible = Boolean(tab === 'record' && !route && recorder?.available && !recordOpen)
  useEffect(() => {
    if (!overlay.rendered) return
    overlay.update({ record: { hidden: !recordVisible, enabled: !starting } })
  }, [overlay.rendered, recordVisible, starting])

  // 离开详情页时把播放条收起来（详情页自己在卸载时也发一次，这里是兜底）。
  useEffect(() => {
    if (!overlay.rendered || route?.kind === 'detail') return
    playerCommandRef.current = null
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
  const runTranscription = useCallback(async (memo: Memo) => {
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
  }, [store, t])

  const exportLabels = useMemo(() => ({
    createdAt: t('labelCreatedAt'),
    duration: t('labelDuration'),
    summary: t('tabSummary'),
    corrected: t('tabCorrected'),
    transcript: t('tabOriginal'),
    chapters: t('chapters'),
    actionItems: t('actionItems'),
    translation: t('tabTranslation'),
  }), [t])

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
  beginRecordingRef.current = () => { void beginRecording() }

  /**
   * 一条录音的行级动作。**原生上下文菜单（`aibox.list.*`）与自绘 action sheet 共用这一份**——
   * 两条路各写一遍处理器，就是「同一条录音从不同入口长按看到不一样的行为」的来源。
   */
  const runRowAction = useCallback(async (memo: Memo, picked: string) => {
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
  }, [t, store, route, runTranscription, subpages])

  /** 自绘长按菜单（手势层 `rendered:false` 时的降级路径）。动作集与原生上下文菜单逐条一致。 */
  const openMenu = useCallback(async (memo: Memo) => {
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
  }, [t, transcribable, runRowAction])

  const openDetailMenu = useCallback(async (context: DetailContext) => {
    detailContext.current = context
    setDetailArtifacts(context.artifacts)
    const memo = context.memo
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
    if (!picked) return

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
      const body = format === 'srt' ? exportSRT(payload) : format === 'txt' ? exportText(payload) : exportMarkdown(payload)
      await shareFile(`${fileSlug(memo.title)}-${newID().slice(0, 6)}.${format}`, body)
    }
  }, [t, locale.locale, exportLabels, openMenu])

  const rootMemos = store.memos
  // 2.0.0 只剩一个来源，「本机剪辑」这一段等同于「全部」，故智能列表只留 全部 / 收藏。
  const scopedMemos = route?.kind === 'scoped'
    ? route.scope === 'fav' ? rootMemos.filter((memo) => memo.isFavourite) : rootMemos
    : []

  return (
    <div
      style={{
        position: 'relative', minHeight: '100dvh', background: palette.bg, color: palette.ink,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {tab === 'record' ? (
        <>
          <div style={{ display: 'flex', gap: SPACE.s2, alignItems: 'center', padding: `${SPACE.s3}px ${SPACE.s4}px 0` }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              enterKeyHint="search"
              style={{
                flex: 1, borderRadius: 10, border: 'none', padding: '9px 12px', fontSize: 16,
                background: palette.surface, color: palette.ink,
              }}
            />
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer', padding: 8,
                color: filterIsActive(filter) ? palette.accent : palette.muted,
              }}
              aria-label={t('filter')}
            >
              <Icon name="list" size={18} />
            </button>
          </div>

          {transcription && !transcription.engine ? (
            <div style={{ margin: `${SPACE.s3}px ${SPACE.s4}px 0`, background: alpha(palette.orange, 0.12), borderRadius: RADIUS.field, padding: SPACE.s3, fontSize: 12, color: palette.orange }}>
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
              onAction={(memo, actionId) => { void runRowAction(memo, actionId) }}
              onClearFilter={() => setFilter(DEFAULT_FILTER)}
            />
            <div style={{ height: 96 }} />
          </main>

          {/* FAB 只在列表根页渲染。录音能力不可用时整块不出现。
              宿主画了悬浮层就交给它 —— 页内 FAB 是 `rendered:false` 的降级路径（合同 §2.5.5）。 */}
          {recorder?.available && !overlay.rendered ? (
            <div
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                display: 'flex', justifyContent: 'center',
                paddingBottom: `calc(${tabs.rendered ? 16 : 74}px + env(safe-area-inset-bottom))`,
                pointerEvents: 'none',
              }}
            >
              <button
                type="button"
                disabled={starting}
                onClick={() => void beginRecording()}
                style={{
                  width: 48, height: 48, borderRadius: 24, border: 'none',
                  cursor: starting ? 'default' : 'pointer', opacity: starting ? 0.55 : 1,
                  background: palette.red, color: '#FFFFFF', fontSize: 18, pointerEvents: 'auto',
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
          <SettingsTab palette={palette} t={t} dark={Boolean(dark)} settings={store.settings} onChange={store.updateSettings} clips={store.clips} />
        </main>
      ) : null}

      {!tabs.rendered ? (
        <nav style={{ display: 'flex', borderTop: `1px solid ${palette.line}`, background: palette.surface, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {(['record', 'library', 'settings'] as TabID[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                flex: 1, border: 'none', background: 'transparent', padding: '10px 0 12px', fontSize: 11,
                cursor: 'pointer', color: tab === id ? palette.accent : palette.muted,
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
          onRefresh={store.refresh}
          overlayRendered={overlay.rendered}
          overlayUpdate={overlay.update}
          registerPlayerCommand={(handler) => { playerCommandRef.current = handler }}
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
            onAction={(memo, actionId) => { void runRowAction(memo, actionId) }}
            onClearFilter={() => undefined}
          />
        </PushPage>
      ) : null}

      {route?.kind === 'trash' ? (
        <TrashPage
          palette={palette}
          t={t}
          store={store}
          onBack={subpages.back}
          chrome={!hostChrome}
        />
      ) : null}

      <FilterSheet palette={palette} t={t} open={filterOpen} filter={filter} onChange={setFilter} onClose={() => setFilterOpen(false)} />

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
      <AskSheet palette={palette} t={t} open={sheet === 'ask'} transcript={detailContext.current?.text ?? ''} onClose={() => setSheet(null)} />
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

// —— 文件夹 Tab（智能列表段可实现，用户文件夹段不行） ——

function LibraryTab(props: {
  palette: Palette
  t: T
  memos: Memo[]
  trashCount: number
  onScope: (scope: 'all' | 'fav') => void
  onTrash: () => void
}) {
  const { palette, t } = props
  const rows: { id: 'all' | 'fav'; icon: string; label: string; badge: number }[] = [
    { id: 'all', icon: 'waveform', label: t('smartAllRecordings'), badge: props.memos.length },
    { id: 'fav', icon: 'star.fill', label: t('smartFavourites'), badge: props.memos.filter((memo) => memo.isFavourite).length },
  ]
  return (
    <div style={{ padding: `${SPACE.s4}px 0` }}>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => props.onScope(row.id)}
          style={{
            display: 'flex', width: '100%', alignItems: 'center', gap: SPACE.s3, border: 'none',
            background: 'transparent', padding: `12px ${SPACE.s4}px`, cursor: 'pointer',
            borderBottom: `1px solid ${palette.line}`,
          }}
        >
          <Icon name={row.icon} size={16} color={palette.accent} />
          <span style={{ flex: 1, textAlign: 'left', fontSize: 16, color: palette.ink }}>{row.label}</span>
          <span style={{ fontSize: 14, color: palette.muted }}>{row.badge}</span>
          <Icon name="chevron" size={14} color={palette.muted} />
        </button>
      ))}

      <button
        type="button"
        onClick={props.onTrash}
        style={{
          display: 'flex', width: '100%', alignItems: 'center', gap: SPACE.s3, border: 'none',
          background: 'transparent', padding: `12px ${SPACE.s4}px`, cursor: 'pointer',
          borderBottom: `1px solid ${palette.line}`, marginTop: SPACE.s4,
        }}
      >
        <Icon name="trash" size={16} color={palette.accent} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 16, color: palette.ink }}>{t('recentlyDeleted')}</span>
        <span style={{ fontSize: 14, color: palette.muted }}>{props.trashCount}</span>
        <Icon name="chevron" size={14} color={palette.muted} />
      </button>

      <div style={{ padding: `${SPACE.s4}px ${SPACE.s4}px`, fontSize: 12, color: palette.muted }}>
        {t('foldersUnavailable')}
      </div>
    </div>
  )
}

// —— 最近删除（只覆盖本机剪辑：宿主没有 `memo_trash` 工具投影） ——

function TrashPage(props: {
  palette: Palette
  t: T
  store: ReturnType<typeof useMemoStore>
  onBack: () => void
  chrome?: boolean
}) {
  const { palette, t } = props
  const trashed = props.store.clips.filter((clip) => clip.isTrashed)
  return (
    <PushPage
      palette={palette}
      title={t('recentlyDeleted')}
      onBack={props.onBack}
      chrome={props.chrome}
      trailing={
        trashed.length ? (
          <button
            type="button"
            onClick={async () => {
              const ok = await confirmDestructive(t('emptyTrashConfirmTitle'), t('emptyTrash'), t('cancel'))
              if (!ok) return
              for (const clip of trashed) await deleteClip(clip.id)
              props.store.refresh()
            }}
            style={{ border: 'none', background: 'transparent', color: palette.red, fontSize: 15, cursor: 'pointer', padding: 8 }}
          >
            {t('emptyTrash')}
          </button>
        ) : undefined
      }
    >
      {trashed.length === 0 ? (
        <div style={{ padding: `${SPACE.s8}px ${SPACE.s5}px`, textAlign: 'center' }}>
          <Icon name="trash" size={40} color={palette.muted} />
          <div style={{ fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }}>{t('trashEmptyTitle')}</div>
          <div style={{ fontSize: 14, color: palette.muted, marginTop: 6 }}>{t('trashEmptyBody')}</div>
        </div>
      ) : (
        <>
          {trashed.map((clip) => (
            <div
              key={clip.id}
              style={{
                display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: `10px ${SPACE.s4}px`,
                borderBottom: `1px solid ${palette.line}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: palette.ink }}>{clip.title}</div>
                <div style={{ fontSize: 12, color: palette.muted }}>{clockString(clip.durationMs / 1000)}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await saveClip({ ...clip, isTrashed: false, trashedAt: null })
                  props.store.refresh()
                }}
                style={{ border: 'none', background: 'transparent', color: palette.accent, fontSize: 18, cursor: 'pointer' }}
                aria-label={t('restore')}
              >
                <Icon name="gobackward" size={18} />
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirmDestructive(t('deleteConfirmTitle'), t('deletePermanently'), t('cancel'))
                  if (!ok) return
                  await deleteClip(clip.id)
                  props.store.refresh()
                }}
                style={{ border: 'none', background: 'transparent', color: palette.red, fontSize: 16, cursor: 'pointer' }}
                aria-label={t('deletePermanently')}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          <div style={{ padding: SPACE.s4, fontSize: 12, color: palette.muted }}>{t('trashFooter')}</div>
        </>
      )}
    </PushPage>
  )
}

// —— 设置 Tab ——

function SettingsTab(props: {
  palette: Palette
  t: T
  dark: boolean
  settings: Settings
  clips: ReturnType<typeof useMemoStore>['clips']
  onChange: (patch: Partial<Settings>) => void
}) {
  const { palette, t, settings } = props
  const bytes = props.clips.reduce((sum, clip) => sum + clip.byteCount, 0)
  const templates: SummaryTemplate[] = ['general', 'meeting', 'interview', 'oneOnOne', 'lecture', 'podcast']
  const templateLabels: Record<SummaryTemplate, string> = {
    general: t('templateGeneral'),
    meeting: t('templateMeeting'),
    interview: t('templateInterview'),
    oneOnOne: t('templateOneOnOne'),
    lecture: t('templateLecture'),
    podcast: t('templatePodcast'),
  }

  return (
    <div style={{ padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3 }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: alpha(brandTint(props.dark), 0.15), color: brandTint(props.dark), fontSize: 20,
          }}
        >
          <Icon name="mic" size={20} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: palette.ink }}>{t('titleVoiceMemos')}</div>
          <div style={{ fontSize: 12, color: palette.muted }}>{t('settingsAI')} · {t('settingsRecording')}</div>
        </div>
      </div>

      <section>
        <div style={{ fontSize: 12, fontWeight: 500, color: palette.muted, textTransform: 'uppercase', marginBottom: 6 }}>
          {t('settingsRecording')}
        </div>
        <Picker
          palette={palette}
          label={t('transcribeLanguage')}
          value={settings.transcribeLocale}
          options={[
            { value: 'auto', label: t('localeAuto') },
            { value: 'zh_CN', label: t('localeZh') },
            { value: 'en_US', label: t('localeEn') },
          ]}
          onChange={(value) => props.onChange({ transcribeLocale: value as Settings['transcribeLocale'] })}
        />
        <div style={{ fontSize: 12, color: palette.muted, margin: '4px 0 10px' }}>{t('transcribeLanguageHint')}</div>
        <Picker
          palette={palette}
          label={t('quality')}
          value={settings.quality}
          options={[
            { value: 'high', label: t('qualityHigh') },
            { value: 'medium', label: t('qualityMedium') },
            { value: 'low', label: t('qualityLow') },
          ]}
          onChange={(value) => props.onChange({ quality: value as Settings['quality'] })}
        />
        <div style={{ fontSize: 12, color: palette.muted, marginTop: 4 }}>{t('qualityHint')}</div>
      </section>

      <section>
        <div style={{ fontSize: 12, fontWeight: 500, color: palette.muted, textTransform: 'uppercase', marginBottom: 6 }}>
          {t('settingsAI')}
        </div>
        <Toggle palette={palette} label={t('autoTranscribe')} value={settings.autoTranscribe} onChange={(value) => props.onChange({ autoTranscribe: value })} />
        <Toggle
          palette={palette}
          label={t('autoSummarize')}
          hint={t('autoSummarizeHint')}
          value={settings.autoSummarize}
          onChange={(value) => props.onChange({ autoSummarize: value })}
        />
        <Picker
          palette={palette}
          label={t('defaultTemplate')}
          value={settings.defaultTemplate}
          options={templates.map((template) => ({ value: template, label: templateLabels[template] }))}
          onChange={(value) => props.onChange({ defaultTemplate: value as SummaryTemplate })}
        />
      </section>

      <section>
        <div style={{ fontSize: 12, fontWeight: 500, color: palette.muted, textTransform: 'uppercase', marginBottom: 6 }}>
          {t('settingsStorage')}
        </div>
        <StatRow palette={palette} label={t('clipCount')} value={String(props.clips.length)} />
        <StatRow palette={palette} label={t('clipBytes')} value={byteSize(bytes)} />
        <div style={{ fontSize: 12, color: palette.muted, marginTop: 8 }}>{t('hostSettingsNote')}</div>
      </section>
    </div>
  )
}

function Picker(props: {
  palette: Palette
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: '10px 0', fontSize: 15, color: props.palette.ink }}>
      <span style={{ flex: 1 }}>{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        style={{
          border: `1px solid ${props.palette.line}`, borderRadius: 8, padding: '6px 8px', fontSize: 14,
          background: props.palette.surface, color: props.palette.ink,
        }}
      >
        {props.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function StatRow(props: { palette: Palette; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0', fontSize: 15, color: props.palette.ink }}>
      <span style={{ flex: 1 }}>{props.label}</span>
      <span style={{ color: props.palette.muted, fontSize: 14 }}>{props.value}</span>
    </div>
  )
}

// —— 宿主对话框 / 分享的薄封装 ——

type T = ReturnType<typeof makeT>

function errorText(t: T, reason: string): string {
  const value = reason.toLowerCase()
  if (value.includes('denied') || value.includes('microphone-denied')) return t('micDenied')
  if (value.includes('busy')) return t('micBusy')
  return t('recorderUnavailable')
}

async function actionSheet(actions: { id: string; title: string; destructive?: boolean }[]): Promise<string | null> {
  const bridge = typeof window !== 'undefined' ? window.aibox : undefined
  if (!bridge?.ui || actions.length === 0) return null
  try {
    const result = await bridge.ui.actionSheet({
      actions: actions.map((action) => ({
        id: action.id,
        title: action.title,
        role: action.destructive ? 'destructive' : 'default',
      })),
    })
    return result.cancelled ? null : result.actionId
  } catch {
    return null
  }
}

async function confirmDestructive(title: string, confirmTitle: string, cancelTitle: string): Promise<boolean> {
  const bridge = typeof window !== 'undefined' ? window.aibox : undefined
  if (!bridge?.ui) return true
  try {
    const result = await bridge.ui.confirm({
      title,
      actions: [
        { id: 'cancel', title: cancelTitle, role: 'cancel' },
        { id: 'ok', title: confirmTitle, role: 'destructive' },
      ],
    })
    return !result.cancelled && result.actionId === 'ok'
  } catch {
    return false
  }
}

async function confirmAlert(title: string, message: string): Promise<void> {
  const bridge = typeof window !== 'undefined' ? window.aibox : undefined
  if (!bridge?.ui) return
  try {
    await bridge.ui.alert({ title, message })
  } catch {
    /* 弹不出来就算了，不该因为提示失败再抛一次 */
  }
}

async function promptText(title: string, defaultValue: string): Promise<string | null> {
  const bridge = typeof window !== 'undefined' ? window.aibox : undefined
  if (!bridge?.ui) return null
  try {
    const result = await bridge.ui.prompt({ title, defaultValue })
    const value = (result.value ?? '').trim()
    return result.cancelled || !value ? null : value
  } catch {
    return null
  }
}

async function copyText(text: string): Promise<void> {
  const bridge = typeof window !== 'undefined' ? window.aibox : undefined
  if (!bridge?.clipboard) return
  try {
    await bridge.clipboard.write({ text })
  } catch {
    /* 授权被拒 */
  }
}

async function shareText(text: string): Promise<void> {
  const bridge = typeof window !== 'undefined' ? window.aibox : undefined
  if (!bridge?.share || !text.trim()) return
  try {
    await bridge.share.text({ text })
  } catch {
    /* 用户取消分享面板不是错误 */
  }
}

async function shareFile(filename: string, content: string): Promise<void> {
  const bridge = typeof window !== 'undefined' ? window.aibox : undefined
  if (!bridge?.share || typeof bridge.share.file !== 'function' || !content.trim()) return
  try {
    await bridge.share.file({ filename, content, mimeType: filename.endsWith('.srt') ? 'application/x-subrip' : 'text/plain' })
  } catch {
    /* 同上 */
  }
}

/** 本机剪辑分享的是音频本体：从 applet URL 取字节 → base64 → `share.file`。 */
async function shareClipAudio(memo: Memo): Promise<void> {
  const bridge = typeof window !== 'undefined' ? window.aibox : undefined
  if (!bridge?.share || typeof bridge.share.file !== 'function' || !memo.url) return
  try {
    const response = await fetch(memo.url)
    const buffer = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let index = 0; index < buffer.length; index += 1) binary += String.fromCharCode(buffer[index])
    await bridge.share.file({
      filename: `${fileSlug(memo.title)}.m4a`,
      content: btoa(binary),
      mimeType: 'audio/mp4',
      encoding: 'base64',
    })
  } catch {
    /* 超过 10MB 上限或取消 */
  }
}

export { applyFilter, loadArtifacts }
