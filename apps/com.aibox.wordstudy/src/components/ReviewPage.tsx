// 复习流（规格 §7）。三态：空 / 卡片流 / 完成页。
//
// 两条必须守住：
//  · 题型按**队列下标轮换**（index % 3），不是随机 —— 中断续跑重进时题目必须一模一样；
//  · 会话锚点存的是**词面数组**（不是对象）+ 当前下标。

import { useEffect, useMemo, useState } from 'react'
import { loadAnchor, saveAnchor, saveReview } from '../lib/db.js'
import { haptic, speak } from '../lib/host.js'
import { dueQueue, isCorrect, planExercise, scheduleNext, tomorrowPreview } from '../lib/logic.js'
import type { T } from '../lib/strings.js'
import type { WordStore } from '../lib/store.js'
import { RADIUS, SPACE, alpha, type Palette } from '../lib/theme.js'
import type { ExerciseKind, ReviewGrade, VocabItem } from '../lib/types.js'
import { Icon, PrimaryButton, PushPage } from './primitives.js'

export function ReviewPage(props: {
  palette: Palette
  t: T
  store: WordStore
  onBack: () => void
  onOpenWord: (word: string) => void
}) {
  const { palette, t, store } = props
  const [queue, setQueue] = useState<VocabItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [answer, setAnswer] = useState('')
  const [verdict, setVerdict] = useState<boolean | null>(null)
  const [reviewed, setReviewed] = useState(0)
  const [tomorrow, setTomorrow] = useState(0)
  const [finished, setFinished] = useState(false)

  // 中断续跑：有锚点 → 按词面重新取回条目、下标取 min(存的下标, 队列长度)；否则新拉一批并写锚点。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const anchor = await loadAnchor()
      if (cancelled) return
      if (anchor && anchor.terms.length) {
        const byTerm = new Map(store.vocab.map((item) => [item.text, item]))
        const restored = anchor.terms.map((term) => byTerm.get(term)).filter(Boolean) as VocabItem[]
        if (restored.length) {
          setQueue(restored)
          setIndex(Math.min(anchor.index, restored.length))
          return
        }
      }
      const fresh = dueQueue(store.vocab)
      setQueue(fresh)
      setIndex(0)
      if (fresh.length) await saveAnchor({ terms: fresh.map((item) => item.text), index: 0 })
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = queue && index < queue.length ? queue[index] : null
  const exercise = useMemo(
    () => (current ? planExercise({ index, item: current, entry: store.entryOf(current.text) }) : null),
    [current, index, store.entryOf],
  )
  const entry = current ? store.entryOf(current.text) : null

  const grade = async (value: ReviewGrade) => {
    if (!current || !queue) return
    const next = scheduleNext(current.box, value)
    await saveReview(current.text, next.box, next.nextReviewAt)
    void haptic('light')
    setReviewed((count) => count + 1)
    setFlipped(false)
    setAnswer('')
    setVerdict(null)
    const nextIndex = index + 1
    if (nextIndex >= queue.length) {
      // 下标走完 → 清空续跑锚点 + 算一次明日预告，进完成页。
      await saveAnchor(null)
      store.refresh()
      setTomorrow(tomorrowPreview(store.vocab))
      setFinished(true)
      return
    }
    setIndex(nextIndex)
    await saveAnchor({ terms: queue.map((item) => item.text), index: nextIndex })
    store.refresh()
  }

  if (queue === null)
    return (
      <PushPage palette={palette} title={t('reviewTitle')} onBack={props.onBack}>
        <div />
      </PushPage>
    )

  if (finished) {
    return (
      <PushPage palette={palette} title={t('reviewTitle')} onBack={props.onBack}>
        <Centered>
          <Icon name="checkmark.seal" size={48} color={palette.green} />
          <div style={{ fontSize: 17, fontWeight: 500, color: palette.ink, marginTop: SPACE.s3 }}>
            {t('reviewDoneCount', { n: reviewed })}
          </div>
          {tomorrow > 0 ? (
            <div style={{ fontSize: 13, color: palette.muted, marginTop: 6 }}>
              {t('reviewTomorrow', { n: tomorrow })}
            </div>
          ) : null}
          <div style={{ marginTop: SPACE.s5 }}>
            <PrimaryButton palette={palette} title={t('done')} onClick={props.onBack} />
          </div>
        </Centered>
      </PushPage>
    )
  }

  if (queue.length === 0 || !current || !exercise) {
    return (
      <PushPage palette={palette} title={t('reviewTitle')} onBack={props.onBack}>
        <Centered>
          <Icon name="checkmark.seal" size={40} color={palette.green} />
          <div style={{ fontSize: 15, fontWeight: 500, color: palette.ink, marginTop: SPACE.s3 }}>
            {t('reviewEmpty')}
          </div>
        </Centered>
      </PushPage>
    )
  }

  return (
    <PushPage palette={palette} title={t('reviewTitle')} onBack={props.onBack}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
          padding: `${SPACE.s4}px 0 ${SPACE.s5}px`,
        }}
      >
        <div style={{ padding: `0 ${SPACE.s5}px` }}>
          <div style={{ height: 4, borderRadius: 2, background: palette.line, overflow: 'hidden' }}>
            <div style={{ width: `${(index / queue.length) * 100}%`, height: '100%', background: palette.accent }} />
          </div>
          <div style={{ fontSize: 12, color: palette.muted, marginTop: 6 }}>
            {index + 1} / {queue.length}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            margin: `0 ${SPACE.s5}px`,
            minHeight: 220,
            background: palette.surface,
            borderRadius: RADIUS.card,
            padding: SPACE.s5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACE.s3,
          }}
        >
          {!flipped ? (
            <>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: palette.accent,
                }}
              >
                <Icon name={kindIcon(exercise.kind)} size={12} /> {kindLabel(t, exercise.kind)}
              </div>
              {exercise.kind === 'listening' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void speak(current.text, 'us')}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: palette.accent,
                      fontSize: 52,
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                    aria-label={t('speakAloud')}
                  >
                    <Icon name="speaker" size={52} />
                  </button>
                  <div style={{ fontSize: 14, color: palette.muted, textAlign: 'center' }}>{t('listeningHint')}</div>
                </>
              ) : (
                <div
                  style={{
                    fontSize: exercise.kind === 'cloze' ? 18 : 16,
                    fontWeight: 500,
                    color: palette.ink,
                    textAlign: 'center',
                  }}
                >
                  {exercise.prompt ?? t('promptFallback')}
                </div>
              )}
              <input
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || !answer.trim()) return
                  setVerdict(isCorrect(answer, exercise.answer))
                  setFlipped(true)
                }}
                placeholder={t('answerPlaceholder')}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: 10,
                  border: `1px solid ${palette.line}`,
                  padding: '10px 12px',
                  fontSize: 16,
                  background: palette.bg,
                  color: palette.ink,
                }}
              />
            </>
          ) : (
            <>
              {verdict !== null ? (
                <div style={{ fontSize: 13, fontWeight: 500, color: verdict ? palette.green : palette.orange }}>
                  <Icon name={verdict ? 'check' : 'refresh'} size={13} />{' '}
                  {verdict ? t('answerCorrect') : t('answerKeepPracticing')}
                </div>
              ) : null}
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2 }}>
                <span style={{ fontSize: 28, fontWeight: 500, color: palette.ink }}>{current.text}</span>
                <button
                  type="button"
                  onClick={() => void speak(current.text, 'us')}
                  style={{ border: 'none', background: 'transparent', color: palette.accent, cursor: 'pointer' }}
                  aria-label={t('speakAloud')}
                >
                  <Icon name="speaker" size={18} />
                </button>
              </div>
              {entry?.phoneticUK ? (
                <div style={{ fontSize: 14, color: palette.muted }}>/{entry.phoneticUK}/</div>
              ) : null}
              <div style={{ height: 1, background: palette.line, width: '100%' }} />
              {current.brief ? (
                <div style={{ fontSize: 16, color: palette.ink, textAlign: 'center' }}>{current.brief}</div>
              ) : null}
              {entry?.examTags.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {entry.examTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 12,
                        color: palette.muted,
                        background: palette.line,
                        borderRadius: 999,
                        padding: '4px 9px',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {current.note ? (
                <div
                  style={{
                    width: '100%',
                    background: alpha(palette.accent, 0.08),
                    borderRadius: RADIUS.field,
                    padding: SPACE.s3,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 500, color: palette.muted }}>{t('savedContext')}</div>
                  <div style={{ fontSize: 14, color: palette.ink, marginTop: 4 }}>{current.note}</div>
                </div>
              ) : null}
              {current.kind === 'word' ? (
                <button
                  type="button"
                  onClick={() => props.onOpenWord(current.text)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: palette.accent,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {t('viewFullDetail')}
                </button>
              ) : null}
            </>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {!flipped ? (
          <div style={{ padding: `0 ${SPACE.s5}px`, display: 'flex', flexDirection: 'column', gap: SPACE.s2 }}>
            <PrimaryButton
              palette={palette}
              title={t('checkAnswer')}
              block
              disabled={!answer.trim()}
              onClick={() => {
                setVerdict(isCorrect(answer, exercise.answer))
                setFlipped(true)
              }}
            />
            <button
              type="button"
              onClick={() => {
                setVerdict(null)
                setFlipped(true)
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: palette.muted,
                fontSize: 14,
                padding: 8,
                cursor: 'pointer',
              }}
            >
              {t('showAnswer')}
            </button>
          </div>
        ) : (
          <div style={{ padding: `0 ${SPACE.s5}px`, display: 'flex', gap: SPACE.s3 }}>
            <GradeButton
              palette={palette}
              label={t('gradeForgot')}
              tint={palette.red}
              onClick={() => void grade('forgot')}
            />
            <GradeButton
              palette={palette}
              label={t('gradeFuzzy')}
              tint={palette.orange}
              onClick={() => void grade('fuzzy')}
            />
            <GradeButton
              palette={palette}
              label={t('gradeKnow')}
              tint={palette.green}
              onClick={() => void grade('know')}
            />
          </div>
        )}
      </div>
    </PushPage>
  )
}

function GradeButton(props: { palette: Palette; label: string; tint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        flex: 1,
        border: 'none',
        borderRadius: RADIUS.field,
        padding: '12px 0',
        fontSize: 14,
        fontWeight: 500,
        color: props.tint,
        background: alpha(props.tint, 0.12),
        cursor: 'pointer',
      }}
    >
      {props.label}
    </button>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}

function kindLabel(t: T, kind: ExerciseKind): string {
  if (kind === 'listening') return t('exerciseListening')
  if (kind === 'cloze') return t('exerciseCloze')
  return t('exerciseSpelling')
}

function kindIcon(kind: ExerciseKind): string {
  if (kind === 'listening') return 'ear'
  if (kind === 'cloze') return 'blank'
  return 'pencil'
}
