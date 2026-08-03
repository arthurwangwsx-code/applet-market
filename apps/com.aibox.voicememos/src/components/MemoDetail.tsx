// 播放详情页（规格 §4）。
//
// **4 个 Tab 不是 3 个**：摘要 / 原文 / 校正后 / 翻译，可左右横扫；进度点长在 Tab 标签上、
// 内容区不放第二个 spinner。首次进入默认 Tab：有摘要 → 摘要；否则 → 原文（只判一次）。
//
// ## 2.0.0：1.x 的两处降级都没有了
// 1.x 的这个页面是**分叉**的：宿主录音走"有转写、但读不到播放位置、也拿不到 segments"的一支，
// 本机剪辑走"能精确播放、但没有任何转写路径"的另一支。哪一支都不完整。
//
// 宿主补上 `aibox.audio.transcribe` 之后分叉消失，两半的长处合到同一个页面上：
//  · 转写来自 `aibox.audio.transcribe`，**带时间戳分段** → 原文 Tab 可以点句跳转、章节可以定位；
//  · 播放是页面自己的 `<audio>` → 有真 scrubber、有已播时间、进度与波形逐帧同步。

import { useEffect, useMemo, useRef, useState } from 'react'
import { correct, summarize, translate, speakerDisplayName, TRANSLATION_LANGS, LANG_NAME, type TranslationLang } from '../lib/ai'
import { clockFlat, clockString, hashText } from '../lib/format'
import { chapters as generateChapters } from '../lib/ai'
import {
  listClips, loadArtifacts, localeTag, saveArtifacts, saveClip, transcribeClip,
} from '../lib/memos'
import type { T } from '../lib/strings'
import { RADIUS, SPACE, alpha, speakerPalette, type Palette } from '../lib/theme'
import type {
  ActionItem, Chapter, Memo, MemoArtifacts, MemoTranscript, Settings, SpeakerMode, SummaryTemplate,
  TranscriptSegment,
} from '../lib/types'
import { EmptyState, Icon, PrimaryButton, PushPage, SecondaryButton, Sheet } from './primitives'

type DetailTab = 'summary' | 'original' | 'corrected' | 'translation'

const TEMPLATES: SummaryTemplate[] = ['general', 'meeting', 'interview', 'oneOnOne', 'lecture', 'podcast']

export function MemoDetail(props: {
  palette: Palette
  t: T
  dark: boolean
  memo: Memo
  settings: Settings
  onBack: () => void
  /** 自绘 ⋯ 的入口。宿主有系统菜单时不再渲染那颗按钮，本回调也就不会被调到。 */
  onMenu: (context: DetailContext) => void
  /**
   * 持续上报当前详情上下文。系统 ⋯ 菜单由宿主绘制，弹出那一刻不经过页面 ——
   * 哪几项该可见必须**提前**配好，不能等用户点了才算。
   */
  onContext?: (context: DetailContext | null) => void
  /** 宿主有系统 ⋯ 菜单。true = 不画页内那颗 ⋯（否则真机上是「系统 ⋯ 旁边挂个假 ⋯」）。 */
  hostMenu?: boolean
  onRefresh: () => void
  /** 把「播放器指令入口」交给根视图（宿主侧的控件点击经它落到真 `<audio>`）。 */
  registerPlayerCommand?: (handler: ((command: string) => void) | null) => void
  /** 宿主画了导航栏（返回键 + 标题）就不自绘。 */
  chrome?: boolean
}) {
  const { palette, t, memo } = props
  const [transcript, setTranscript] = useState<MemoTranscript | null>(null)
  const [artifacts, setArtifacts] = useState<MemoArtifacts | null>(null)
  const [tab, setTab] = useState<DetailTab | null>(null)
  const [chaptersBusy, setChaptersBusy] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [error, setError] = useState('')
  /** 播放器的 seek 出口。章节 / 分段点击都经它跳转——1.x 这条线在宿主播放器上根本不存在。 */
  const seekRef = useRef<((seconds: number) => void) | null>(null)

  // 载入转写 + applet 侧衍生产物。转写现在长在剪辑记录上，不再有第二个数据源。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const clip = (await listClips()).find((item) => item.id === memo.id)
      if (cancelled) return
      const next: MemoTranscript | null = clip?.transcriptText
        ? {
            status: clip.transcriptStatus ?? 'completed',
            fullText: clip.transcriptText,
            locale: clip.transcriptLocale ?? '',
            isEdited: false,
            segmentCount: clip.transcriptSegments?.length ?? 0,
          }
        : clip
          ? { status: clip.transcriptStatus ?? 'none', fullText: '', locale: '', isEdited: false, segmentCount: 0 }
          : null
      setTranscript(next)
      setSegments(clip?.transcriptSegments ?? [])
      const loaded = await loadArtifacts(memo.id, next?.fullText ?? '')
      if (cancelled) return
      setArtifacts(loaded)
      // 首次进入默认 Tab：只判一次，不打断用户后续手动切换。
      setTab((current) => current ?? (loaded.summaryText ? 'summary' : 'original'))
    })()
    return () => { cancelled = true }
  }, [memo.id])

  const text = transcript?.fullText ?? ''
  const context: DetailContext = {
    memo, transcript, artifacts, setArtifacts, text, segments,
    seek: (seconds) => seekRef.current?.(seconds),
  }

  // 上报给根视图配系统 ⋯ 菜单。**按签名而不是按 context 触发**：context 每帧重建，
  // 直接进依赖数组就是每帧过一次桥。签名里只放真正影响菜单可见性的几件事。
  const contextRef = useRef(context)
  contextRef.current = context
  const onContextRef = useRef(props.onContext)
  onContextRef.current = props.onContext
  const menuSignature = `${memo.id}|${text.trim() ? 1 : 0}|${artifacts?.summaryText ? 1 : 0}`
  useEffect(() => {
    onContextRef.current?.(contextRef.current)
  }, [menuSignature])
  // 离开详情页把菜单项收回去 —— 留着的话在列表页点 ⋯ 会看到一整排「对哪条录音操作？」的孤儿项。
  useEffect(() => () => { onContextRef.current?.(null) }, [])

  /** 转写这一条录音。同步等待到出结果——宿主侧每个 applet 同时只允许一条，排队没有意义。 */
  const runTranscription = async () => {
    const clip = (await listClips()).find((item) => item.id === memo.id)
    if (!clip?.handle || transcribing) return
    setTranscribing(true)
    setError('')
    const outcome = await transcribeClip(clip.handle, localeTag(props.settings.transcribeLocale))
    setTranscribing(false)
    if (!outcome.ok) {
      setTranscript({ status: 'failed', fullText: '', locale: '', isEdited: false, segmentCount: 0 })
      setError(outcome.error)
      const latest = (await listClips()).find((item) => item.id === memo.id) ?? clip
      await saveClip({ ...latest, transcriptStatus: 'failed' })
      return
    }
    const latest = (await listClips()).find((item) => item.id === memo.id) ?? clip
    await saveClip({
      ...latest,
      transcriptText: outcome.text,
      transcriptLocale: outcome.locale,
      transcriptSegments: outcome.segments,
      transcriptStatus: 'completed',
    })
    setTranscript({
      status: 'completed', fullText: outcome.text, locale: outcome.locale,
      isEdited: false, segmentCount: outcome.segments.length,
    })
    setSegments(outcome.segments)
    props.onRefresh()
  }

  // 详情页自动跑（规格 §13.7）：**只补空、不重复、不覆盖**用户已生成/已改的结果。
  useEffect(() => {
    if (!artifacts || !text.trim()) return
    if (!props.settings.autoSummarize) return
    if (artifacts.summaryStatus !== 'none') return
    void runSummary(context, props.settings.defaultTemplate, setError)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts?.memoID, text, props.settings.autoSummarize])

  const status = transcribing ? 'inProgress' : (transcript?.status ?? 'none')

  return (
    <PushPage
      palette={palette}
      title={memo.title}
      onBack={props.onBack}
      chrome={props.chrome}
      trailing={props.hostMenu ? undefined : <MoreButton palette={palette} onClick={() => props.onMenu(context)} />}
      footer={
        <ClipPlayer
          palette={palette}
          t={t}
          memo={memo}
          onSeekReady={(seek) => { seekRef.current = seek }}
          registerPlayerCommand={props.registerPlayerCommand}
        />
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {!memo.hasAudio ? (
          <div style={{ background: alpha(palette.orange, 0.1), padding: `${SPACE.s3}px ${SPACE.s4}px` }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: palette.orange }}>
              <Icon name="waveform.slash" size={13} /> {t('audioRemovedTitle')}
            </div>
            <div style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>{t('audioRemovedBody')}</div>
          </div>
        ) : null}

        {status === 'completed' ? (
          <>
            <TabStrip palette={palette} t={t} tab={tab ?? 'original'} artifacts={artifacts} onChange={setTab} />
            <div style={{ flex: 1, padding: `${SPACE.s3}px ${SPACE.s5}px ${SPACE.s6}px` }}>
              {(tab ?? 'original') === 'summary' ? (
                <SummaryTab palette={palette} t={t} context={context} settings={props.settings} onError={setError} />
              ) : null}
              {(tab ?? 'original') === 'original' ? (
                <OriginalTab
                  palette={palette}
                  t={t}
                  transcript={transcript}
                  chapters={artifacts?.chapters ?? []}
                  chaptersBusy={chaptersBusy}
                  hasAudio={memo.hasAudio}
                  onSeek={(seconds) => seekRef.current?.(seconds)}
                  onGenerateChapters={async () => {
                    if (!artifacts) return
                    setChaptersBusy(true)
                    // 秒数用真实分段回查校准，不信模型编的时间戳（见 lib/ai.ts chapters 注释）。
                    const next = await generateChapters(text, segments).catch(() => [] as Chapter[])
                    setChaptersBusy(false)
                    const merged = { ...artifacts, chapters: next, sourceHash: hashText(text) }
                    setArtifacts(merged)
                    await saveArtifacts(merged)
                  }}
                />
              ) : null}
              {(tab ?? 'original') === 'corrected' ? (
                <CorrectedTab palette={palette} t={t} dark={props.dark} context={context} onError={setError} />
              ) : null}
              {(tab ?? 'original') === 'translation' ? (
                <TranslationTab palette={palette} t={t} context={context} onError={setError} />
              ) : null}
              {error ? <div style={{ fontSize: 13, color: palette.red, marginTop: SPACE.s3 }}>{error}</div> : null}
            </div>
          </>
        ) : null}

        {status === 'pending' || status === 'inProgress' ? (
          <Centered>
            <div style={{ fontSize: 17, fontWeight: 600, color: palette.ink }}>{t('transcribingTitle')}</div>
            <div style={{ fontSize: 14, color: palette.muted, marginTop: 6 }}>{t('transcribingBody')}</div>
          </Centered>
        ) : null}

        {status === 'none' || status === 'failed' ? (
          <Centered>
            <Icon name={status === 'failed' ? 'warning' : 'bubble'} size={46} color={palette.accent} />
            <div style={{ fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }}>
              {status === 'failed' ? t('transcribeFailedTitle') : t('noTranscriptTitle')}
            </div>
            <div style={{ fontSize: 14, color: palette.muted, marginTop: 6, maxWidth: 300 }}>
              {status === 'failed' ? t('transcribeFailedBody') : t('noTranscriptBody')}
            </div>
            {memo.hasAudio ? (
              <div style={{ marginTop: SPACE.s5 }}>
                <PrimaryButton
                  palette={palette}
                  title={status === 'failed' ? t('retry') : t('transcribeAction')}
                  onClick={() => void runTranscription()}
                />
              </div>
            ) : null}
          </Centered>
        ) : null}

      </div>
    </PushPage>
  )
}

export interface DetailContext {
  memo: Memo
  transcript: MemoTranscript | null
  artifacts: MemoArtifacts | null
  setArtifacts: (value: MemoArtifacts) => void
  text: string
  /** 带时间戳的转写分段。2.0.0 才有——1.x 的宿主工具只回 `segmentCount`。 */
  segments: TranscriptSegment[]
  /** 跳到某一秒。接的是页面自己的 `<audio>`，所以是真的精确跳转。 */
  seek: (seconds: number) => void
}

function MoreButton(props: { palette: Palette; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{ border: 'none', background: 'transparent', color: props.palette.accent, fontSize: 17, cursor: 'pointer', width: 44, height: 44 }}
      aria-label="More"
    >
      <Icon name="ellipsis" size={17} />
    </button>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      {children}
    </div>
  )
}

/** 4 个 Tab 的胶囊栏。进度点长在标签上；**原文 Tab 永不显示进度点**。 */
function TabStrip(props: {
  palette: Palette
  t: T
  tab: DetailTab
  artifacts: MemoArtifacts | null
  onChange: (tab: DetailTab) => void
}) {
  const { palette, t } = props
  const items: { id: DetailTab; label: string; busy: boolean }[] = [
    { id: 'summary', label: t('tabSummary'), busy: props.artifacts?.summaryStatus === 'generating' },
    { id: 'original', label: t('tabOriginal'), busy: false },
    { id: 'corrected', label: t('tabCorrected'), busy: props.artifacts?.correctionStatus === 'generating' },
    { id: 'translation', label: t('tabTranslation'), busy: props.artifacts?.translationStatus === 'generating' },
  ]
  return (
    <div style={{ padding: `${SPACE.s2}px ${SPACE.s4}px 4px` }}>
      <div style={{ display: 'flex', background: palette.surface, borderRadius: 999, padding: 4 }}>
        {items.map((item) => {
          const active = props.tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => props.onChange(item.id)}
              style={{
                flex: 1, border: 'none', borderRadius: 999, padding: '7px 4px', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                color: active ? palette.onAccent : palette.muted,
                background: active ? palette.accent : 'transparent',
                whiteSpace: 'nowrap', overflow: 'hidden',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
              {item.busy ? <span style={{ fontSize: 10 }}>•</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// —— 摘要 Tab（§4.8） ——

async function runSummary(context: DetailContext, template: SummaryTemplate, onError: (message: string) => void): Promise<void> {
  const base = context.artifacts
  if (!base || !context.text.trim()) return
  context.setArtifacts({ ...base, summaryStatus: 'generating', summaryTemplate: template })
  try {
    const result = await summarize(context.text, template)
    const next: MemoArtifacts = {
      ...base,
      summaryText: result.text,
      summaryPoints: result.points,
      summaryTemplate: template,
      summaryStatus: 'ready',
      sourceHash: hashText(context.text),
    }
    context.setArtifacts(next)
    await saveArtifacts(next)
  } catch (error) {
    onError(String(error))
    context.setArtifacts({ ...base, summaryStatus: 'failed', summaryTemplate: template })
  }
}

function SummaryTab(props: { palette: Palette; t: T; context: DetailContext; settings: Settings; onError: (message: string) => void }) {
  const { palette, t, context } = props
  const [picking, setPicking] = useState(false)
  const artifacts = context.artifacts
  if (!artifacts) return null
  const busy = artifacts.summaryStatus === 'generating'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}>
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={() => setPicking(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 999,
            padding: '7px 11px', fontSize: 12, fontWeight: 500, cursor: busy ? 'default' : 'pointer',
            color: palette.accent, background: alpha(palette.accent, 0.1), opacity: busy ? 0.5 : 1,
          }}
        >
          <Icon name="sparkles" size={12} /> {templateLabel(t, artifacts.summaryTemplate)}
        </button>
      </div>

      {busy ? <div style={{ fontSize: 14, color: palette.muted, textAlign: 'center' }}>{t('summarizing')}</div> : null}

      {!busy && artifacts.summaryText ? (
        <>
          {artifacts.summaryStatus === 'stale' ? (
            <div style={{ fontSize: 12, color: palette.muted }}>
              <Icon name="clock" size={11} /> {t('stale')} — {t('staleTranscriptChanged')}
            </div>
          ) : null}
          <Markdown palette={palette} text={artifacts.summaryText} />
          {artifacts.summaryPoints.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {artifacts.summaryPoints.map((point, index) => (
                <li key={index} style={{ fontSize: 15, color: palette.ink }}>{point}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {!busy && !artifacts.summaryText ? (
        artifacts.summaryStatus === 'failed' || artifacts.summaryStatus === 'stale' ? (
          <Centered>
            <Icon name="warning" size={38} color={palette.orange} />
            <div style={{ fontSize: 14, color: palette.muted, marginTop: SPACE.s3 }}>{t('summaryFailed')}</div>
          </Centered>
        ) : (
          <Centered>
            <Icon name="sparkles" size={40} color={palette.accent} />
            <div style={{ fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }}>{t('noSummaryTitle')}</div>
            <div style={{ fontSize: 14, color: palette.muted, marginTop: 6 }}>{t('noSummaryBody')}</div>
          </Centered>
        )
      ) : null}

      <Sheet palette={palette} open={picking} onClose={() => setPicking(false)}>
        {TEMPLATES.map((template) => (
          <button
            key={template}
            type="button"
            onClick={() => {
              setPicking(false)
              // 点任一项 = 立即用该模板（重新）生成。
              void runSummary(context, template, props.onError)
            }}
            style={{
              display: 'flex', width: '100%', alignItems: 'center', border: 'none', background: 'transparent',
              padding: `12px ${SPACE.s4}px`, fontSize: 15, color: palette.ink, cursor: 'pointer',
              borderBottom: `1px solid ${palette.line}`,
            }}
          >
            <span style={{ flex: 1, textAlign: 'left' }}>{templateLabel(t, template)}</span>
            {artifacts.summaryTemplate === template ? <Icon name="check" size={14} color={palette.accent} /> : null}
          </button>
        ))}
      </Sheet>
    </div>
  )
}

function templateLabel(t: T, template: SummaryTemplate): string {
  const map: Record<SummaryTemplate, Parameters<T>[0]> = {
    general: 'templateGeneral',
    meeting: 'templateMeeting',
    interview: 'templateInterview',
    oneOnOne: 'templateOneOnOne',
    lecture: 'templateLecture',
    podcast: 'templatePodcast',
  }
  return t(map[template])
}

// —— 原文 Tab（§4.3 的可实现子集） ——

function OriginalTab(props: {
  palette: Palette
  t: T
  transcript: MemoTranscript | null
  chapters: Chapter[]
  chaptersBusy: boolean
  hasAudio: boolean
  onSeek: (seconds: number) => void
  onGenerateChapters: () => void
}) {
  const { palette, t } = props
  const paragraphs = useMemo(
    () => (props.transcript?.fullText ?? '').split(/\n+/).map((line) => line.trim()).filter(Boolean),
    [props.transcript?.fullText],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}>
      {props.transcript?.isEdited ? (
        <div style={{ fontSize: 12, color: palette.muted }}><Icon name="pencil" size={11} /> {t('edited')}</div>
      ) : null}

      {props.chaptersBusy ? (
        <div style={{ background: palette.surface, borderRadius: RADIUS.field, padding: SPACE.s4, fontSize: 14, color: palette.muted }}>
          {t('findingChapters')}
        </div>
      ) : props.chapters.length ? (
        <div style={{ background: palette.surface, borderRadius: RADIUS.field, padding: SPACE.s4 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: palette.accent, marginBottom: SPACE.s2 }}>
            <Icon name="list" size={13} /> {t('chapters')}
          </div>
          {props.chapters.map((chapter, index) => (
            <button
              key={`${chapter.title}-${index}`}
              type="button"
              disabled={!props.hasAudio}
              onClick={() => props.onSeek(chapter.start)}
              style={{
                display: 'flex', width: '100%', alignItems: 'center', gap: SPACE.s3, border: 'none',
                background: 'transparent', padding: '7px 0', cursor: props.hasAudio ? 'pointer' : 'default',
              }}
            >
              <span style={{ flex: 1, textAlign: 'left', fontSize: 15, color: palette.ink }}>{chapter.title}</span>
              <span style={{ fontSize: 12, color: palette.muted, fontFamily: 'ui-monospace, monospace' }}>
                {clockString(chapter.start)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <SecondaryButton palette={palette} title={t('chapters')} icon="list" onClick={props.onGenerateChapters} />
      )}

      {paragraphs.length === 0 ? (
        <EmptyState palette={palette} icon="bubble" text={t('noTranscriptBody')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
          {paragraphs.map((paragraph, index) => (
            <p key={index} style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: palette.ink, userSelect: 'text' }}>
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// —— 校正后 Tab（§4.9） ——

function CorrectedTab(props: { palette: Palette; t: T; dark: boolean; context: DetailContext; onError: (message: string) => void }) {
  const { palette, t, context } = props
  const artifacts = context.artifacts
  const [mode, setMode] = useState<SpeakerMode>(artifacts?.correctionMode ?? 'auto')
  const [count, setCount] = useState(Math.max(2, artifacts?.correctionSpeakers.length ?? 2))
  const [names, setNames] = useState<string[]>(artifacts?.correctionSpeakers ?? ['', ''])
  if (!artifacts) return null

  const busy = artifacts.correctionStatus === 'generating'
  const colors = speakerPalette(props.dark)

  const run = async () => {
    const base = context.artifacts
    if (!base) return
    // 运行中底色 50% 但**不禁用** —— 上次崩溃会把状态卡在 generating，禁用会让用户永远无法重试。
    context.setArtifacts({ ...base, correctionStatus: 'generating', correctionMode: mode })
    try {
      const turns = await correct({
        transcript: context.text,
        mode,
        speakers: names.slice(0, count).map((name, index) => name.trim() || `Speaker ${index + 1}`),
      })
      const next: MemoArtifacts = {
        ...base,
        correctionTurns: turns,
        correctionStatus: 'ready',
        correctionMode: mode,
        correctionSpeakers: names.slice(0, count),
        sourceHash: hashText(context.text),
      }
      context.setArtifacts(next)
      await saveArtifacts(next)
    } catch (error) {
      props.onError(String(error))
      context.setArtifacts({ ...base, correctionStatus: 'failed', correctionMode: mode })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, flexWrap: 'wrap' }}>
        <Icon name="person.2" size={13} color={palette.muted} />
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as SpeakerMode)}
          style={{ border: `1px solid ${palette.line}`, borderRadius: 8, padding: '6px 8px', fontSize: 13, background: palette.surface, color: palette.ink }}
        >
          <option value="none">{t('speakerModeNone')}</option>
          <option value="auto">{t('speakerModeAuto')}</option>
          <option value="named">{t('speakerModeNamed')}</option>
        </select>
        {mode === 'named' ? (
          <input
            type="number"
            min={2}
            max={6}
            value={count}
            onChange={(event) => {
              const value = Math.min(6, Math.max(2, Number(event.target.value) || 2))
              setCount(value)
              setNames((current) => {
                const next = [...current]
                while (next.length < value) next.push('')
                return next.slice(0, value)
              })
            }}
            style={{ width: 56, border: `1px solid ${palette.line}`, borderRadius: 8, padding: '6px 8px', fontSize: 13, background: palette.surface, color: palette.ink }}
          />
        ) : null}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          disabled={!context.text.trim()}
          onClick={run}
          style={{
            border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 500,
            color: palette.onAccent, background: palette.accent, cursor: 'pointer',
            opacity: busy ? 0.5 : context.text.trim() ? 1 : 0.4,
          }}
        >
          <Icon name={artifacts.correctionTurns.length ? 'refresh' : 'sparkles'} size={12} />{' '}
          {artifacts.correctionTurns.length ? t('recorrectAction') : t('correctAction')}
        </button>
      </div>

      {mode === 'named' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {new Array(count).fill(0).map((_, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, background: palette.surface, borderRadius: 8, padding: '6px 10px' }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: colors[index % colors.length] }} />
              <input
                value={names[index] ?? ''}
                onChange={(event) => setNames((current) => {
                  const next = [...current]
                  next[index] = event.target.value
                  return next
                })}
                placeholder={t('speakerName', { n: index + 1 })}
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: palette.ink, outline: 'none' }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {busy ? <div style={{ fontSize: 14, color: palette.muted, textAlign: 'center' }}>{t('correcting')}</div> : null}

      {!busy && artifacts.correctionTurns.length ? (
        <>
          {artifacts.correctionStatus === 'stale' ? (
            <div style={{ fontSize: 12, color: palette.muted }}><Icon name="warning" size={11} /> {t('staleTranscriptChanged')}</div>
          ) : null}
          <div style={{ fontSize: 11, color: palette.muted }}>{t('correctionNoTimestamps')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
            {artifacts.correctionTurns.map((turn, index) => {
              const previous = artifacts.correctionTurns[index - 1]
              // 同一说话人连续发言只在第一段显示说话人标。
              const showSpeaker = Boolean(turn.speaker) && previous?.speaker !== turn.speaker
              const color = colors[turn.colorIndex % colors.length]
              return (
                <div key={index} style={{ background: palette.surface, borderRadius: 12, padding: SPACE.s3 }}>
                  {showSpeaker ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 5, background: color }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color }}>
                        {speakerDisplayName(turn.speaker, index, t('speakerName', { n: '{n}' }))}
                      </span>
                    </div>
                  ) : null}
                  <div style={{ fontSize: 17, lineHeight: 1.5, color: palette.ink, userSelect: 'text' }}>{turn.text}</div>
                </div>
              )
            })}
          </div>
        </>
      ) : null}

      {!busy && artifacts.correctionTurns.length === 0 ? (
        artifacts.correctionStatus === 'failed' ? (
          <Centered>
            <Icon name="warning" size={38} color={palette.orange} />
            <div style={{ fontSize: 14, color: palette.muted, marginTop: SPACE.s3 }}>{t('correctionFailed')}</div>
          </Centered>
        ) : (
          <Centered>
            <Icon name="wand" size={40} color={palette.accent} />
            <div style={{ fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }}>{t('noCorrectionTitle')}</div>
            <div style={{ fontSize: 14, color: palette.muted, marginTop: 6 }}>{t('noCorrectionBody')}</div>
          </Centered>
        )
      ) : null}
    </div>
  )
}

// —— 翻译 Tab（§4.10） ——

function TranslationTab(props: { palette: Palette; t: T; context: DetailContext; onError: (message: string) => void }) {
  const { palette, t, context } = props
  const artifacts = context.artifacts
  const [lang, setLang] = useState<TranslationLang>((artifacts?.translationLang as TranslationLang) ?? 'en')
  const [bilingual, setBilingual] = useState(artifacts?.translationBilingual ?? false)
  if (!artifacts) return null
  const busy = artifacts.translationStatus === 'generating'
  // **源文优先级**：校正稿非空 → 用校正稿；否则原始转写。
  const source = artifacts.correctionTurns.length
    ? artifacts.correctionTurns.map((turn) => turn.text).join('\n\n')
    : context.text

  const run = async () => {
    const base = context.artifacts
    if (!base) return
    context.setArtifacts({ ...base, translationStatus: 'generating', translationLang: lang, translationBilingual: bilingual })
    try {
      const text = await translate({ text: source, lang, bilingual })
      const next: MemoArtifacts = {
        ...base,
        translationText: text,
        translationLang: lang,
        translationBilingual: bilingual,
        translationStatus: 'ready',
        sourceHash: hashText(context.text),
      }
      context.setArtifacts(next)
      await saveArtifacts(next)
    } catch (error) {
      props.onError(String(error))
      context.setArtifacts({ ...base, translationStatus: 'failed', translationLang: lang })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, flexWrap: 'wrap' }}>
        <Icon name="globe" size={13} color={palette.muted} />
        <select
          value={lang}
          onChange={(event) => setLang(event.target.value as TranslationLang)}
          style={{ border: `1px solid ${palette.line}`, borderRadius: 8, padding: '6px 8px', fontSize: 13, background: palette.surface, color: palette.ink }}
        >
          {TRANSLATION_LANGS.map((code) => <option key={code} value={code}>{LANG_NAME[code]}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          disabled={!source.trim()}
          onClick={run}
          style={{
            border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 500,
            color: palette.onAccent, background: palette.accent, cursor: 'pointer',
            opacity: busy ? 0.5 : source.trim() ? 1 : 0.4,
          }}
        >
          <Icon name={artifacts.translationText ? 'refresh' : 'globe'} size={12} />{' '}
          {artifacts.translationText ? t('retranslateAction') : t('translateAction')}
        </button>
      </div>

      <div style={{ display: 'flex', background: palette.surface, borderRadius: 999, padding: 3 }}>
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => setBilingual(value)}
            style={{
              flex: 1, border: 'none', borderRadius: 999, padding: '6px 0', fontSize: 13, cursor: 'pointer',
              color: bilingual === value ? palette.onAccent : palette.muted,
              background: bilingual === value ? palette.accent : 'transparent',
            }}
          >
            {value ? t('bilingual') : t('translationOnly')}
          </button>
        ))}
      </div>

      {busy ? <div style={{ fontSize: 14, color: palette.muted, textAlign: 'center' }}>{t('translating')}</div> : null}

      {!busy && artifacts.translationText ? (
        <>
          {artifacts.translationStatus === 'stale' ? (
            <div style={{ fontSize: 12, color: palette.muted }}><Icon name="warning" size={11} /> {t('staleTranscriptChanged')}</div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
            {artifacts.translationText.split(/\n+/).filter(Boolean).map((paragraph, index) => (
              <p key={index} style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: palette.ink, userSelect: 'text' }}>
                {paragraph}
              </p>
            ))}
          </div>
        </>
      ) : null}

      {!busy && !artifacts.translationText ? (
        <Centered>
          <Icon name="globe" size={40} color={palette.accent} />
          <div style={{ fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }}>{t('noTranslationTitle')}</div>
          <div style={{ fontSize: 14, color: palette.muted, marginTop: 6 }}>{t('noTranslationBody')}</div>
        </Centered>
      ) : null}
    </div>
  )
}

// —— transport 条（§4.5） ——

function iconButton(palette: Palette): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 18, border: 'none', background: 'transparent',
    color: palette.ink, cursor: 'pointer',
  }
}

// —— 播放器（静态波形 + 精确 scrubber + 15s 跳转） ——
//
// 2.0.0 起这是**唯一**的播放器。1.x 还有一条遥控宿主播放器的分支，它读不到当前位置
//（`memo_play/stop/seek` 只有这三下），所以那条线上既没有 scrubber 也没有已播时间，
// 章节和分段点击更是无从跳起。现在音频字节就在手上，这些全部是真的。

/**
 * 详情页播放器。**钉在页底**（`PushPage` 的 `footer`，滚动区之外），所以文稿多长它都在。
 *
 * 它曾经住在滚动内容的末尾 + 靠宿主悬浮条补救「看不到」：结果是长文稿要滚到底才够得着，而悬浮条
 * 又要等第一次交互才起来 —— 两条路一起失灵，播放区只剩一条光进度条。钉死是根治：不依赖另一层就位。
 */
function ClipPlayer(props: {
  palette: Palette
  t: T
  memo: Memo
  /** 把 seek 出口交给页面（章节 / 分段点击经它跳转）。 */
  onSeekReady: (seek: (seconds: number) => void) => void
  registerPlayerCommand?: (handler: ((command: string) => void) | null) => void
}) {
  const { palette, t, memo } = props
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(memo.duration)
  const [playing, setPlaying] = useState(false)
  const [peaks, setPeaks] = useState<number[]>([])

  // 静态波形：有音频字节就能 1:1 移植原生那套 peak + 自身最大值归一化。
  useEffect(() => {
    if (!memo.url) return
    let cancelled = false
    void (async () => {
      const samples = await decodePeaks(memo.url as string, 240)
      if (!cancelled) setPeaks(samples)
    })()
    return () => { cancelled = true }
  }, [memo.url])

  // seek 出口只在挂载时交一次；`currentTime` 的写入是即时的，不需要 state 中转。
  useEffect(() => {
    props.onSeekReady((seconds) => {
      const audio = audioRef.current
      if (!audio) return
      const value = Math.max(0, seconds)
      audio.currentTime = value
      setPosition(value)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) } else { void audio.play(); setPlaying(true) }
  }
  const skip = (delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    const value = Math.max(0, Math.min(duration || audio.duration || 0, position + delta))
    audio.currentTime = value
    setPosition(value)
  }
  // overlay 上的控件点击落到这里。处理器每轮重挂（要闭包到最新的 playing / position）。
  useEffect(() => {
    if (!props.registerPlayerCommand) return undefined
    props.registerPlayerCommand((command) => {
      if (command === 'toggle') toggle()
      else if (command === 'back15') skip(-15)
      else if (command === 'forward15') skip(15)
    })
    return () => props.registerPlayerCommand?.(null)
  })

  // 钉在页底的一条，底下是滚动内容 —— 背景**必须不透明**（原来是 `alpha(surface, 0.9)`，
  // 那是它还长在内容流末尾时的写法，钉住之后半透明会让文稿从波形底下透出来）。
  // 上沿一条发丝线，与原生贴底工具条同款。
  // ⚠️ `paddingBottom` 写在 `padding` 简写**之后** —— 反过来会被简写整个覆盖掉，安全区就白留了。
  const dock = (top: number): React.CSSProperties => ({
    background: palette.surface,
    borderTop: `1px solid ${palette.line}`,
    padding: `${top}px ${SPACE.s5}px ${SPACE.s3}px`,
    paddingBottom: `calc(${SPACE.s3}px + env(safe-area-inset-bottom))`,
  })

  if (!memo.hasAudio) {
    return (
      <div style={{ ...dock(SPACE.s3), textAlign: 'center' }}>
        <Icon name="waveform.slash" size={20} color={palette.muted} />
        <div style={{ fontSize: 13, color: palette.muted, marginTop: 4 }}>{t('audioRemovedTitle')}</div>
        <div style={{ fontSize: 12, color: palette.muted }}>{t('audioRemovedBody')}</div>
      </div>
    )
  }

  return (
    <div style={{ ...dock(SPACE.s4), display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
      <StaticWaveform palette={palette} peaks={peaks} progress={duration > 0 ? position / duration : 0} />

      <audio
        ref={audioRef}
        src={memo.url}
        preload="metadata"
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration
          if (Number.isFinite(value) && value > 0) setDuration(value)
        }}
        onEnded={() => setPlaying(false)}
        style={{ display: 'none' }}
      />

      <input
        type="range"
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.1}
        value={position}
        onChange={(event) => {
          const value = Number(event.target.value)
          setPosition(value)
          if (audioRef.current) audioRef.current.currentTime = value
        }}
        style={{ width: '100%', accentColor: palette.accent }}
      />

      {/* 走带键**常驻**。
          这里曾经是「宿主画了悬浮播放条就把页内走带键整排 display:none」，理由是「两排播放键是控件重复」。
          真机上的结果却是：进详情页只剩一条光秃秃的进度条，**没有任何播放/暂停可点**——悬浮条要等
          第一次交互才起来（2026-08-04 反馈「音频播放板块没有暂停控制，只有在滑动进度条时才会出现播放控制」）。
          判据因此改了：播放区是这一页的**主体控件**，它不能依赖另一层是否就位。悬浮条是「滚走了/离开页面
          仍能控」的补充，不是它的替身；两者同时在场是原生播放页的常态（详情页走带 + 锁屏/迷你条）。 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE.s3 }}>
        <span style={{ fontSize: 12, color: palette.muted, minWidth: 38, fontFamily: 'ui-monospace, monospace' }}>
          {clockFlat(position)}
        </span>
        {/* 三颗键一律走 `skip` / `toggle` —— 与悬浮条上的控件**同一份实现**。各写一遍的代价是
            「页内点暂停停了、悬浮条上的图标还是播放中」这类两处状态对不上的毛病。 */}
        <button
          type="button"
          onClick={() => skip(-15)}
          style={iconButton(palette)}
          aria-label="-15s"
        >
          <Icon name="gobackward" size={21} />
        </button>
        <button
          type="button"
          onClick={toggle}
          style={{
            width: 50, height: 50, borderRadius: 25, border: 'none', background: palette.accent,
            color: palette.onAccent, fontSize: 20, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label={playing ? t('pause') : t('play')}
        >
          <Icon name={playing ? 'pause' : 'play'} size={20} color={palette.onAccent} />
        </button>
        <button
          type="button"
          onClick={() => skip(15)}
          style={iconButton(palette)}
          aria-label="+15s"
        >
          <Icon name="goforward" size={21} />
        </button>
        <span style={{ fontSize: 12, color: palette.muted, minWidth: 38, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
          -{clockFlat(Math.max(0, duration - position))}
        </span>
      </div>
    </div>
  )
}

/**
 * 静态波形（规格 §11.3）：中心锚定、圆角 = barWidth/2、**已播/未播分色**、samples 为空时画一条基线
 * （行绝不塌陷）。
 */
function StaticWaveform(props: { palette: Palette; peaks: number[]; progress: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)

    // 未播放段的颜色**必须来自 palette**。这里曾经硬编码 `rgba(255,255,255,0.18)`（只在深色底上成立），
    // 浅色模式下整条未播放波形是白底白条 = 看不见：屏幕上只剩已播的那一小截蓝色，看着像「波形只画了 1/5」
    // （2026-08-04 真机截图的形状）。基线同理。
    const idle = alpha(props.palette.muted, 0.32)

    if (props.peaks.length === 0) {
      context.fillStyle = idle
      context.fillRect(0, height / 2 - 0.75, width, 1.5)
      return
    }
    const barWidth = 3
    const gap = Math.max(1, barWidth * 0.5)
    const stride = barWidth + gap
    const barCount = Math.max(1, Math.min(props.peaks.length, Math.floor(width / stride)))
    const played = props.progress * width
    const mid = height / 2
    for (let index = 0; index < barCount; index += 1) {
      const value = props.peaks[Math.floor((index / barCount) * props.peaks.length)] ?? 0
      const barHeight = Math.max(height * 0.06, value * height)
      const x = index * stride
      context.fillStyle = x + barWidth / 2 <= played ? props.palette.accent : idle
      // `roundRect` 在 iOS 17 的 WKWebView 上存在，但保留矩形兜底：少一个圆角好过整条波形不画。
      const round = (context as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect
      if (typeof round === 'function') {
        context.beginPath()
        round.call(context, x, mid - barHeight / 2, barWidth, barHeight, barWidth / 2)
        context.fill()
      } else {
        context.fillRect(x, mid - barHeight / 2, barWidth, barHeight)
      }
    }
  }, [props.peaks, props.progress, props.palette])
  return <canvas ref={ref} style={{ width: '100%', height: 72, display: 'block' }} />
}

/** peak + **自身最大值归一化**（与原生 `MemoWaveformExtractor` 同一套算法）。 */
async function decodePeaks(url: string, buckets: number): Promise<number[]> {
  try {
    const response = await fetch(url)
    const bytes = await response.arrayBuffer()
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    if (!Ctor) return []
    const context = new Ctor()
    const buffer = await context.decodeAudioData(bytes)
    const channel = buffer.getChannelData(0)
    const size = Math.max(1, Math.floor(channel.length / buckets))
    const peaks: number[] = []
    for (let index = 0; index < buckets; index += 1) {
      let peak = 0
      const start = index * size
      for (let offset = 0; offset < size && start + offset < channel.length; offset += 1) {
        const value = Math.abs(channel[start + offset])
        if (value > peak) peak = value
      }
      peaks.push(peak)
    }
    void context.close()
    const max = Math.max(...peaks, 0.0001)
    return peaks.map((value) => value / max)
  } catch {
    return []
  }
}

/** 极简 Markdown 渲染（`##` 段标题 + `-` 列表 + 段落）—— 模板摘要产出的就是这三种形态。 */
function Markdown(props: { palette: Palette; text: string }) {
  const blocks = props.text.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {blocks.map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return null
        if (trimmed.startsWith('## ')) {
          return (
            <div key={index} style={{ fontSize: 15, fontWeight: 600, color: props.palette.accent, marginTop: 8 }}>
              {trimmed.slice(3)}
            </div>
          )
        }
        if (trimmed.startsWith('# ')) {
          return <div key={index} style={{ fontSize: 17, fontWeight: 700, color: props.palette.ink }}>{trimmed.slice(2)}</div>
        }
        if (trimmed.startsWith('- ')) {
          return (
            <div key={index} style={{ fontSize: 15, color: props.palette.ink, paddingLeft: 14, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 2 }}>•</span>
              {stripBold(trimmed.slice(2))}
            </div>
          )
        }
        return <p key={index} style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: props.palette.ink }}>{stripBold(trimmed)}</p>
      })}
    </div>
  )
}

function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}

export type { ActionItem }
