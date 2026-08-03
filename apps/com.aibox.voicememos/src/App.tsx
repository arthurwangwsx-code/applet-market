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
import { Icon, PushPage, SecondaryButton } from './components/primitives'
import { registerMemoActions } from './lib/actions'
import { clockString, defaultTitle, exportMarkdown, exportSRT, exportText, fileSlug, byteSize } from './lib/format'
import {
  capabilities, deleteClip, deleteMemo, fetchTranscript, hostRecordStart, listClips, loadArtifacts,
  newID, recordStart, recorderAvailability, renameMemo, saveClip, seekMemo, startTranscription,
  toggleFavourite,
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
  | { kind: 'root' }
  | { kind: 'detail'; memo: Memo }
  | { kind: 'scoped'; scope: 'all' | 'fav' | 'local' }
  | { kind: 'trash' }

export default function App() {
  const scene = useScene()
  const locale = useLocale()
  const tabs = useTabs()
  const store = useMemoStore()

  const lang: Lang = locale.language.startsWith('zh') ? 'zh' : 'en'
  const t = useMemo(() => makeT(lang), [lang])
  const dark = scene?.appearance.effectiveColorScheme === 'dark'
  const hostAccent = scene?.appearance.accentColor ?? null
  const palette = useMemo(() => {
    const base = makePalette(Boolean(dark))
    return hostAccent ? { ...base, accent: hostAccent } : base
  }, [dark, hostAccent])

  const [tab, setTab] = useState<TabID>('record')
  const [route, setRoute] = useState<Route>({ kind: 'root' })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MemoFilter>(DEFAULT_FILTER)
  const [filterOpen, setFilterOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [recorder, setRecorder] = useState<{ available: boolean; reason: string; background: boolean } | null>(null)
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

  // 能力探测：录音不可用就把 FAB 整个藏掉，不留一个点了报错的按钮。
  useEffect(() => {
    void (async () => setRecorder(await recorderAvailability()))()
  }, [])

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
      setDraftTitle('')
      setRecordOpen(true)
    } finally {
      setStarting(false)
    }
  }, [recorder, starting, store.settings.quality, t])

  const openMenu = useCallback(async (memo: Memo) => {
    const actions: { id: string; title: string; destructive?: boolean }[] = [
      { id: 'rename', title: t('rename') },
      { id: 'fav', title: memo.isFavourite ? t('unfavourite') : t('favourite') },
    ]
    if (memo.source === 'library' && !memo.hasTranscript && memo.hasAudio) {
      actions.push({ id: 'transcribe', title: t('startTranscription') })
    }
    if (memo.source === 'library' && memo.hasTranscript) actions.push({ id: 'copy', title: t('copyTranscript') })
    if (memo.source === 'local') actions.push({ id: 'share', title: t('shareAudio') })
    actions.push({ id: 'delete', title: memo.source === 'local' ? t('moveToTrash') : t('deletePermanently'), destructive: true })

    const picked = await actionSheet(actions)
    if (!picked) return
    const key = `${memo.source}:${memo.id}`

    if (picked === 'rename') {
      const next = await promptText(t('renamePrompt'), memo.title)
      if (!next) return
      if (memo.source === 'library') await renameMemo(memo.id, next)
      else {
        const clip = (await listClips()).find((item) => item.id === memo.id)
        if (clip) await saveClip({ ...clip, title: next })
      }
      store.refresh()
      return
    }
    if (picked === 'fav') {
      if (memo.source === 'library') await toggleFavourite(memo.id)
      else {
        const clip = (await listClips()).find((item) => item.id === memo.id)
        if (clip) await saveClip({ ...clip, isFavourite: !clip.isFavourite })
      }
      store.refresh()
      return
    }
    if (picked === 'transcribe') {
      setBusyIDs((current) => ({ ...current, [key]: t('transcribing') }))
      await startTranscription(memo.id, store.settings.transcribeLocale === 'auto' ? undefined : store.settings.transcribeLocale)
      setRoute({ kind: 'detail', memo })
      setBusyIDs((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
      return
    }
    if (picked === 'copy') {
      const transcript = await fetchTranscript(memo.id)
      if (transcript?.fullText) await copyText(transcript.fullText)
      return
    }
    if (picked === 'share') {
      // 本机剪辑分享的是**音频文件本身**（`share.file` 收 base64）。
      await shareClipAudio(memo)
      return
    }
    if (picked === 'delete') {
      const ok = await confirmDestructive(
        memo.source === 'local' ? t('trashConfirmTitle') : t('deleteConfirmTitle'),
        memo.source === 'local' ? t('moveToTrash') : t('deletePermanently'),
        t('cancel'),
      )
      if (!ok) return
      if (memo.source === 'local') {
        const clip = (await listClips()).find((item) => item.id === memo.id)
        // 本机剪辑走**软删**（可恢复），与原生「移到最近删除」同语义。
        if (clip) await saveClip({ ...clip, isTrashed: true, trashedAt: Date.now() })
      } else {
        // ⚠️ 宿主只有硬删（`memo_delete`）—— 没有 `memo_trash` 工具投影，所以录音库条目不可恢复。
        await deleteMemo(memo.id)
      }
      store.refresh()
      if (route.kind === 'detail') setRoute({ kind: 'root' })
    }
  }, [t, store, route.kind])

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
  const scopedMemos = route.kind === 'scoped'
    ? route.scope === 'fav'
      ? rootMemos.filter((memo) => memo.isFavourite)
      : route.scope === 'local'
        ? rootMemos.filter((memo) => memo.source === 'local')
        : rootMemos
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

          {!store.libraryAvailable ? (
            <div style={{ margin: `${SPACE.s3}px ${SPACE.s4}px 0`, background: alpha(palette.orange, 0.12), borderRadius: RADIUS.field, padding: SPACE.s3, fontSize: 12, color: palette.orange }}>
              <Icon name="warning" size={12} /> {t('libraryUnavailable')}
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
              onOpen={(memo) => setRoute({ kind: 'detail', memo })}
              onMenu={openMenu}
              onClearFilter={() => setFilter(DEFAULT_FILTER)}
            />
            <div style={{ height: 96 }} />
          </main>

          {/* FAB 只在列表根页渲染。录音能力不可用时整块不出现。 */}
          {recorder?.available ? (
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
            onScope={(scope) => setRoute({ kind: 'scoped', scope })}
            onTrash={() => setRoute({ kind: 'trash' })}
            onHostRecord={async () => {
              // 宿主录音**会把全屏录音页顶到前台盖住小应用** —— 这是它 effect 为 presentation 的后果，
              // 也是本应用另外自带一套应用内录音的原因。
              await hostRecordStart(defaultTitle(t('newRecording'), locale.locale))
              store.refresh()
            }}
            libraryAvailable={store.libraryAvailable}
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

      {route.kind === 'detail' ? (
        <MemoDetail
          palette={palette}
          t={t}
          dark={Boolean(dark)}
          memo={route.memo}
          settings={store.settings}
          onBack={() => setRoute({ kind: 'root' })}
          onMenu={openDetailMenu}
          onRefresh={store.refresh}
        />
      ) : null}

      {route.kind === 'scoped' ? (
        <PushPage palette={palette} title={t('titleRecordings')} onBack={() => setRoute({ kind: 'root' })}>
          <MemoList
            palette={palette}
            t={t}
            dark={Boolean(dark)}
            memos={scopedMemos}
            query=""
            filter={DEFAULT_FILTER}
            scoped
            busyIDs={busyIDs}
            onOpen={(memo) => setRoute({ kind: 'detail', memo })}
            onMenu={openMenu}
            onClearFilter={() => undefined}
          />
        </PushPage>
      ) : null}

      {route.kind === 'trash' ? (
        <TrashPage
          palette={palette}
          t={t}
          store={store}
          onBack={() => setRoute({ kind: 'root' })}
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
        artifacts={detailArtifacts}
        onArtifacts={(value) => {
          setDetailArtifacts(value)
          detailContext.current?.setArtifacts(value)
        }}
        onSeek={(seconds) => void seekMemo({ seconds })}
        onClose={() => setSheet(null)}
      />
      <AskSheet palette={palette} t={t} open={sheet === 'ask'} memoID={detailContext.current?.memo.id ?? ''} onClose={() => setSheet(null)} />
      <CleanUpSheet
        palette={palette}
        t={t}
        open={sheet === 'cleanUp'}
        memoID={detailContext.current?.memo.id ?? ''}
        onClose={() => setSheet(null)}
        onApplied={store.refresh}
      />
    </div>
  )
}

// —— 文件夹 Tab（智能列表段可实现，用户文件夹段不行） ——

function LibraryTab(props: {
  palette: Palette
  t: T
  memos: Memo[]
  trashCount: number
  libraryAvailable: boolean
  onScope: (scope: 'all' | 'fav' | 'local') => void
  onTrash: () => void
  onHostRecord: () => void
}) {
  const { palette, t } = props
  const rows: { id: 'all' | 'fav' | 'local'; icon: string; label: string; badge: number }[] = [
    { id: 'all', icon: 'waveform', label: t('smartAllRecordings'), badge: props.memos.length },
    { id: 'fav', icon: 'star.fill', label: t('smartFavourites'), badge: props.memos.filter((memo) => memo.isFavourite).length },
    { id: 'local', icon: 'mic', label: t('smartLocalClips'), badge: props.memos.filter((memo) => memo.source === 'local').length },
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

      {props.libraryAvailable ? (
        <div style={{ padding: `${SPACE.s5}px ${SPACE.s4}px 0` }}>
          <SecondaryButton palette={palette} title={t('recordIntoLibrary')} icon="mic" onClick={props.onHostRecord} />
        </div>
      ) : null}

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
}) {
  const { palette, t } = props
  const trashed = props.store.clips.filter((clip) => clip.isTrashed)
  return (
    <PushPage
      palette={palette}
      title={t('recentlyDeleted')}
      onBack={props.onBack}
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
