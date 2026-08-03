// 播放详情页（规格 §4）。
//
// **4 个 Tab 不是 3 个**：摘要 / 原文 / 校正后 / 翻译，可左右横扫；进度点长在 Tab 标签上、
// 内容区不放第二个 spinner。首次进入默认 Tab：有摘要 → 摘要；否则 → 原文（只判一次）。
//
// 两处相对原生的降级（容器缺口，见 lib/memos.ts 文件头）：
//  · 原文 Tab **没有卡拉OK 逐句高亮、不能点句跳转** —— `memo_get_transcript` 只回 `segmentCount`，
//    不回 segments 数组。渲染成段落纯文本，与原生「已编辑转写」那一支的渲染完全一致。
//  · 宿主录音的 transport 条读不到播放位置（只有 play/stop/seek），所以只有本机剪辑有 scrubber。

import { useEffect, useMemo, useRef, useState } from 'react'
import { correct, summarize, translate, speakerDisplayName, TRANSLATION_LANGS, LANG_NAME, type TranslationLang } from '../lib/ai'
import { clockFlat, clockString, hashText } from '../lib/format'
import {
  askMemo, fetchActionItems, fetchChapters, fetchTranscript, loadArtifacts, playMemo, saveArtifacts,
  seekMemo, startTranscription, stopPlayback,
} from '../lib/memos'
import type { T } from '../lib/strings'
import { RADIUS, SPACE, alpha, speakerPalette, type Palette } from '../lib/theme'
import type {
  ActionItem, Chapter, Memo, MemoArtifacts, MemoTranscript, Settings, SpeakerMode, SummaryTemplate,
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
  onMenu: (context: DetailContext) => void
  onRefresh: () => void
}) {
  const { palette, t, memo } = props
  const [transcript, setTranscript] = useState<MemoTranscript | null>(null)
  const [artifacts, setArtifacts] = useState<MemoArtifacts | null>(null)
  const [tab, setTab] = useState<DetailTab | null>(null)
  const [chaptersBusy, setChaptersBusy] = useState(false)
  const [error, setError] = useState('')

  // 载入转写 + applet 侧衍生产物。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = memo.source === 'library' ? await fetchTranscript(memo.id) : null
      if (cancelled) return
      setTranscript(next)
      const loaded = await loadArtifacts(memo.id, next?.fullText ?? '')
      if (cancelled) return
      setArtifacts(loaded)
      // 首次进入默认 Tab：只判一次，不打断用户后续手动切换。
      setTab((current) => current ?? (loaded.summaryText ? 'summary' : 'original'))
    })()
    return () => { cancelled = true }
  }, [memo.id, memo.source])

  // 转写在跑时轮询（宿主是 @Model 推送即时刷新，容器只能 2s 一轮）。
  useEffect(() => {
    if (memo.source !== 'library') return
    if (transcript?.status !== 'pending' && transcript?.status !== 'inProgress') return
    const timer = window.setInterval(async () => {
      const next = await fetchTranscript(memo.id)
      if (next) setTranscript(next)
      if (next && next.status !== 'pending' && next.status !== 'inProgress') {
        window.clearInterval(timer)
        props.onRefresh()
      }
    }, 2000)
    return () => window.clearInterval(timer)
  }, [memo.id, memo.source, transcript?.status])

  const text = transcript?.fullText ?? ''
  const context: DetailContext = { memo, transcript, artifacts, setArtifacts, text }

  // 详情页自动跑（规格 §13.7）：**只补空、不重复、不覆盖**用户已生成/已改的结果。
  useEffect(() => {
    if (!artifacts || !text.trim()) return
    if (!props.settings.autoSummarize) return
    if (artifacts.summaryStatus !== 'none') return
    void runSummary(context, props.settings.defaultTemplate, setError)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts?.memoID, text, props.settings.autoSummarize])

  if (memo.source === 'local') {
    return (
      <PushPage palette={palette} title={memo.title} onBack={props.onBack} trailing={<MoreButton palette={palette} onClick={() => props.onMenu(context)} />}>
        <LocalClipBody palette={palette} t={t} memo={memo} />
      </PushPage>
    )
  }

  const status = transcript?.status ?? 'none'

  return (
    <PushPage palette={palette} title={memo.title} onBack={props.onBack} trailing={<MoreButton palette={palette} onClick={() => props.onMenu(context)} />}>
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
                  onSeek={(seconds) => void seekMemo({ seconds })}
                  onGenerateChapters={async () => {
                    if (!artifacts) return
                    setChaptersBusy(true)
                    const next = await fetchChapters(memo.id, artifacts.chapters.length > 0)
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
                  onClick={async () => {
                    await startTranscription(memo.id, localeArg(props.settings))
                    const next = await fetchTranscript(memo.id)
                    if (next) setTranscript(next)
                  }}
                />
              </div>
            ) : null}
          </Centered>
        ) : null}

        <TransportBar palette={palette} t={t} memo={memo} />
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
}

/** 转写 locale 三级优先：设置里显式指定 → 该录音已存 locale → App 内语言。**绝不裸用系统区域**。 */
function localeArg(settings: Settings): string | undefined {
  if (settings.transcribeLocale === 'auto') return undefined
  return settings.transcribeLocale
}

function MoreButton(props: { palette: Palette; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{ border: 'none', background: 'transparent', color: props.palette.accent, fontSize: 17, cursor: 'pointer', width: 44, height: 44 }}
      aria-label="More"
    >
      ⋯
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

function TransportBar(props: { palette: Palette; t: T; memo: Memo }) {
  const { palette, t, memo } = props
  const [playing, setPlaying] = useState(false)

  if (!memo.hasAudio) {
    return (
      <div style={{ background: alpha(palette.surface, 0.9), padding: `${SPACE.s3}px ${SPACE.s5}px ${SPACE.s4}px`, textAlign: 'center' }}>
        <Icon name="waveform.slash" size={20} color={palette.muted} />
        <div style={{ fontSize: 13, color: palette.muted, marginTop: 4 }}>{t('audioRemovedTitle')}</div>
        <div style={{ fontSize: 12, color: palette.muted }}>{t('audioRemovedBody')}</div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: alpha(palette.surface, 0.9), padding: `${SPACE.s3}px ${SPACE.s5}px ${SPACE.s4}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE.s3,
      }}
    >
      {/* 宿主播放器**读不到当前位置**（只有 play/stop/seek），所以这里没有 scrubber、没有已播时间。 */}
      <button
        type="button"
        onClick={() => void seekMemo({ seconds: -15 })}
        style={iconButton(palette)}
        aria-label="-15s"
      >
        <Icon name="gobackward" size={21} />
      </button>
      <button
        type="button"
        onClick={async () => {
          await playMemo(memo.id)
          setPlaying((value) => !value)
        }}
        style={{
          width: 50, height: 50, borderRadius: 25, border: 'none', background: palette.accent,
          color: palette.onAccent, fontSize: 20, cursor: 'pointer',
        }}
        aria-label="Play"
      >
        <Icon name={playing ? 'pause' : 'play'} size={20} />
      </button>
      <button
        type="button"
        onClick={() => void seekMemo({ seconds: 15 })}
        style={iconButton(palette)}
        aria-label="+15s"
      >
        <Icon name="goforward" size={21} />
      </button>
      <button
        type="button"
        onClick={async () => {
          await stopPlayback()
          setPlaying(false)
        }}
        style={iconButton(palette)}
        aria-label="Stop"
      >
        <Icon name="stop" size={17} />
      </button>
    </div>
  )
}

function iconButton(palette: Palette): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 18, border: 'none', background: 'transparent',
    color: palette.ink, cursor: 'pointer',
  }
}

// —— 本机剪辑详情（精确播放 + 静态波形，这是宿主录音做不到的那一半） ——

function LocalClipBody(props: { palette: Palette; t: T; memo: Memo }) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s5 }}>
      <div style={{ fontSize: 13, color: palette.muted }}>{t('localClipNote').replace(/\*\*/g, '')}</div>

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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE.s3 }}>
        <span style={{ fontSize: 12, color: palette.muted, minWidth: 38, fontFamily: 'ui-monospace, monospace' }}>
          {clockFlat(position)}
        </span>
        <button
          type="button"
          onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, position - 15) }}
          style={iconButton(palette)}
          aria-label="-15s"
        >
          <Icon name="gobackward" size={21} />
        </button>
        <button
          type="button"
          onClick={() => {
            const audio = audioRef.current
            if (!audio) return
            if (playing) audio.pause()
            else void audio.play()
            setPlaying(!playing)
          }}
          style={{
            width: 50, height: 50, borderRadius: 25, border: 'none', background: palette.accent,
            color: palette.onAccent, fontSize: 20, cursor: 'pointer',
          }}
          aria-label="Play"
        >
          <Icon name={playing ? 'pause' : 'play'} size={20} />
        </button>
        <button
          type="button"
          onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(duration, position + 15) }}
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

    if (props.peaks.length === 0) {
      context.fillStyle = 'rgba(255,255,255,0.18)'
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
      context.fillStyle = x + barWidth / 2 <= played ? props.palette.accent : 'rgba(255,255,255,0.18)'
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

export { fetchActionItems, askMemo }
export type { ActionItem }
