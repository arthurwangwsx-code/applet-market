// 三个半浮层：跟读评分（§8）/ 相册查词（§9）/ AI 单词伴侣（§3.5 的最小可用替代）。

import { useEffect, useRef, useState } from 'react'
import {
  cancelRecognizing, lookUpFromPhoto, partialTranscript, probeSpeech, recognize, shareWordContext,
  stopRecognizing, type SpeechUnavailable,
} from '../lib/host'
import { scorePronunciation } from '../lib/logic'
import type { T } from '../lib/strings'
import { RADIUS, SPACE, alpha, type Palette } from '../lib/theme'
import type { PronunciationScore } from '../lib/types'
import { EmptyState, Icon, PrimaryButton, SecondaryButton, Sheet } from './primitives'

// —— §8 跟读评分 ——

type PracticeState = 'idle' | 'requestingPermission' | 'recording' | 'scoring' | 'result' | 'unavailable'

export function PracticeSheet(props: {
  palette: Palette
  t: T
  open: boolean
  sentence: string
  onClose: () => void
}) {
  const { palette, t } = props
  const [state, setState] = useState<PracticeState>('idle')
  const [score, setScore] = useState<PronunciationScore | null>(null)
  const [reason, setReason] = useState<SpeechUnavailable | null>(null)
  const [detail, setDetail] = useState('')
  const [partial, setPartial] = useState('')
  const pending = useRef<ReturnType<typeof recognize> | null>(null)

  useEffect(() => {
    if (!props.open) return
    setState('idle')
    setScore(null)
    setPartial('')
    void (async () => {
      const probe = await probeSpeech('en-US')
      if (!probe.available) {
        setReason(probe.reason)
        setDetail(probe.detail)
        setState('unavailable')
      }
    })()
    // sheet 消失时取消录音。
    return () => { void cancelRecognizing() }
  }, [props.open])

  // 录音中轮询中间文本，让用户看到"在听"。
  useEffect(() => {
    if (state !== 'recording') return
    const timer = window.setInterval(async () => setPartial(await partialTranscript()), 400)
    return () => window.clearInterval(timer)
  }, [state])

  const start = async () => {
    setState('requestingPermission')
    setPartial('')
    // 按住说话：**不 await** 地发起，松手再 stop + await。
    pending.current = recognize('en-US', 15_000)
    setState('recording')
  }

  const finish = async () => {
    setState('scoring')
    await stopRecognizing()
    const result = await pending.current
    pending.current = null
    if (!result || result.error) {
      setReason('engineError')
      setDetail(result?.error ?? '')
      setState('unavailable')
      return
    }
    setScore(scorePronunciation(props.sentence, result.transcript))
    setState('result')
  }

  return (
    <Sheet palette={palette} open={props.open} onClose={props.onClose}>
      <div style={{ display: 'flex', alignItems: 'center', padding: SPACE.s4 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 500, color: palette.ink }}>
          <Icon name="mic" size={15} /> {t('practiceTitle')}
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={props.onClose} style={{ border: 'none', background: 'transparent', color: palette.accent, fontSize: 15, cursor: 'pointer' }}>
          {t('done')}
        </button>
      </div>

      <div style={{ padding: `0 ${SPACE.s5}px`, fontSize: 17, fontWeight: 500, color: palette.ink, textAlign: 'center' }}>
        {props.sentence}
      </div>

      <div style={{ padding: `${SPACE.s6}px ${SPACE.s5}px ${SPACE.s6}px`, textAlign: 'center' }}>
        {state === 'idle' ? (
          <>
            <button
              type="button"
              onClick={start}
              style={{ border: 'none', background: 'transparent', color: palette.accent, cursor: 'pointer', lineHeight: 1 }}
              aria-label={t('practiceTapToStart')}
            >
              <Icon name="mic" size={64} />
            </button>
            <div style={{ fontSize: 12, color: palette.muted, marginTop: SPACE.s3 }}>{t('practiceTapToStart')}</div>
          </>
        ) : null}

        {state === 'requestingPermission' || state === 'scoring' ? (
          <div style={{ fontSize: 12, color: palette.muted }}>
            {state === 'scoring' ? t('practiceScoring') : '…'}
          </div>
        ) : null}

        {state === 'recording' ? (
          <>
            <button
              type="button"
              onClick={finish}
              style={{ border: 'none', background: 'transparent', color: palette.red, cursor: 'pointer', lineHeight: 1 }}
              aria-label={t('practiceRecording')}
            >
              <Icon name="stop" size={64} />
            </button>
            <div style={{ fontSize: 12, color: palette.muted, marginTop: SPACE.s3 }}>{t('practiceRecording')}</div>
            {partial ? <div style={{ fontSize: 13, color: palette.muted, marginTop: 6 }}>{partial}</div> : null}
          </>
        ) : null}

        {state === 'result' && score ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, alignItems: 'center' }}>
            <div style={{ fontSize: 40, fontWeight: 500, color: scoreColor(palette, score.percent) }}>{score.percent}%</div>
            {/* ⚠️ 文案刻意声明这是**文本匹配**，不是音素级发音评分 —— 复刻时别改成"发音得分"。 */}
            <div style={{ fontSize: 12, color: palette.muted }}>{t('practiceMatchLabel')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {score.words.map((word, index) => (
                <span
                  key={`${word.text}-${index}`}
                  style={{
                    fontSize: 14, fontWeight: 500, borderRadius: 999, padding: '5px 10px',
                    color: word.matched ? palette.green : palette.red,
                    background: alpha(word.matched ? palette.green : palette.red, 0.12),
                  }}
                >
                  {word.text}
                </span>
              ))}
            </div>
            <SecondaryButton palette={palette} title={t('practiceRetry')} icon="refresh" onClick={() => setState('idle')} />
          </div>
        ) : null}

        {state === 'unavailable' ? (
          <div>
            <Icon name="warning" size={32} color={palette.muted} />
            <div style={{ fontSize: 13, color: palette.muted, marginTop: SPACE.s3 }}>
              {unavailableText(t, reason, detail)}
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  )
}

function scoreColor(palette: Palette, percent: number): string {
  if (percent >= 80) return palette.green
  if (percent >= 50) return palette.orange
  return palette.red
}

function unavailableText(t: T, reason: SpeechUnavailable | null, detail: string): string {
  switch (reason) {
    case 'recognizerUnavailable': return t('speechRecognizerUnavailable')
    case 'onDeviceUnsupported': return t('speechOnDeviceUnsupported')
    case 'micDenied': return t('speechMicDenied')
    case 'speechDenied': return t('speechDenied')
    default: return detail || t('speechRecognizerUnavailable')
  }
}

// —— §9 相册查词 ——

export function PhotoSheet(props: {
  palette: Palette
  t: T
  open: boolean
  onClose: () => void
  onPickWord: (word: string) => void
}) {
  const { palette, t } = props
  const [busy, setBusy] = useState(false)
  const [words, setWords] = useState<string[] | null>(null)
  const [error, setError] = useState<'load' | 'unsupported' | 'empty' | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (props.open) return
    setWords(null)
    setError(null)
    setPreview(null)
  }, [props.open])

  const pick = async () => {
    setBusy(true)
    const result = await lookUpFromPhoto()
    setBusy(false)
    setPreview(result.previewURL)
    setWords(result.words)
    setError(result.error)
  }

  return (
    <Sheet palette={palette} open={props.open} onClose={props.onClose}>
      <div style={{ display: 'flex', alignItems: 'center', padding: SPACE.s4 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: palette.ink }}>{t('photoLookup')}</div>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={props.onClose} style={{ border: 'none', background: 'transparent', color: palette.accent, fontSize: 15, cursor: 'pointer' }}>
          {t('done')}
        </button>
      </div>

      <div style={{ padding: `0 ${SPACE.s5}px ${SPACE.s6}px`, textAlign: 'center' }}>
        {!preview && !words ? (
          <>
            <Icon name="viewfinder" size={48} color={palette.muted} />
            <div style={{ fontSize: 13, color: palette.muted, margin: `${SPACE.s3}px ${SPACE.s6}px ${SPACE.s4}px` }}>
              {t('photoPickHint')}
            </div>
            <PrimaryButton palette={palette} title={t('photoPick')} busy={busy} onClick={pick} />
          </>
        ) : (
          <>
            {preview ? (
              <img src={preview} alt="" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: RADIUS.card, objectFit: 'contain' }} />
            ) : null}
            <div style={{ marginTop: SPACE.s4 }}>
              {error === 'load' ? <div style={{ fontSize: 13, color: palette.muted }}>{t('photoLoadFailed')}</div> : null}
              {error === 'unsupported' ? <div style={{ fontSize: 13, color: palette.muted }}>{t('photoUnsupported')}</div> : null}
              {error === 'empty' ? <div style={{ fontSize: 13, color: palette.muted }}>{t('photoNoText')}</div> : null}
              {!error && words?.length ? (
                <>
                  <div style={{ fontSize: 12, color: palette.muted, marginBottom: SPACE.s2 }}>{t('photoTapWord')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {words.map((word) => (
                      <button
                        key={word}
                        type="button"
                        onClick={() => {
                          props.onPickWord(word)
                          props.onClose()
                        }}
                        style={{
                          border: 'none', borderRadius: 999, padding: '5px 10px', fontSize: 14,
                          color: palette.accent, background: alpha(palette.accent, 0.12), cursor: 'pointer',
                        }}
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div style={{ marginTop: SPACE.s4 }}>
              <SecondaryButton palette={palette} title={t('photoChange')} icon="photo" onClick={pick} />
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

// —— §3.5 AI 单词伴侣 ——

/**
 * 页面内自建的轻量对话面板。
 * 拿不到原生那套「同 identity 复用底层会话 + toolScope 限定 + 会话列表场景徽标」，
 * 但**行为上等价**：5 个 chip 就是 5 个预置 prompt + 词条上下文拼进 system。
 * 差异只在于它不进 App 的会话历史 —— 想进主聊天时点「转到主聊天」。
 */
export function AiCompanion(props: {
  palette: Palette
  t: T
  open: boolean
  word: string
  entryText: string
  seed: string | null
  onClose: () => void
}) {
  const { palette, t } = props
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const seeded = useRef('')

  const system = `The user is looking at this dictionary entry:\n\n${props.entryText}`

  const send = async (text: string) => {
    const value = text.trim()
    if (!value || busy) return
    setInput('')
    setMessages((current) => [...current, { role: 'user', text: value }, { role: 'assistant', text: '' }])
    setBusy(true)
    const bridge = typeof window !== 'undefined' ? window.aibox : undefined
    if (!bridge?.ai) {
      setMessages((current) => replaceLast(current, t('errNoProvider')))
      setBusy(false)
      return
    }
    try {
      if (typeof bridge.ai.generateStream === 'function') {
        let accumulated = ''
        for await (const delta of bridge.ai.generateStream({ system, prompt: value, intent: 'balanced' })) {
          accumulated += delta
          setMessages((current) => replaceLast(current, accumulated))
        }
      } else {
        const reply = await bridge.ai.generate({ system, prompt: value, intent: 'balanced' })
        setMessages((current) => replaceLast(current, reply))
      }
    } catch (error) {
      setMessages((current) => replaceLast(current, String(error)))
    } finally {
      setBusy(false)
    }
  }

  // 带种子进来时自动发一条（原生 `autoSend` 语义）。
  useEffect(() => {
    if (!props.open) {
      setMessages([])
      seeded.current = ''
      return
    }
    if (props.seed && seeded.current !== props.seed) {
      seeded.current = props.seed
      void send(props.seed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.seed])

  const chips: { label: string; seed: string }[] = [
    { label: t('chipSimpler'), seed: `Give me a simpler example sentence for "${props.word}".` },
    { label: t('chipOther'), seed: `Does "${props.word}" have other common meanings or uses I should know about?` },
    { label: t('chipStory'), seed: `Tell me a short, vivid memory story or association to help me remember "${props.word}".` },
    { label: t('chipWrite'), seed: `Help me write my own sentence using "${props.word}", and correct it if needed.` },
    { label: t('chipQuiz'), seed: `Quiz me on "${props.word}" with a couple of quick questions.` },
  ]

  return (
    <Sheet palette={palette} open={props.open} onClose={props.onClose}>
      <div style={{ display: 'flex', alignItems: 'center', padding: SPACE.s4 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 500, color: palette.ink }}>
          <Icon name="sparkles" size={15} color={palette.accent} /> {t('companionTitle')}
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => void shareWordContext(`Tell me more about the English word "${props.word}".`)}
          style={{ border: 'none', background: 'transparent', color: palette.accent, fontSize: 12, cursor: 'pointer' }}
        >
          {t('sendToChat')}
        </button>
        <button type="button" onClick={props.onClose} style={{ border: 'none', background: 'transparent', color: palette.accent, fontSize: 15, cursor: 'pointer', marginLeft: SPACE.s3 }}>
          {t('done')}
        </button>
      </div>

      <div style={{ padding: `0 ${SPACE.s4}px`, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => void send(chip.seed)}
            style={{
              border: 'none', borderRadius: 999, padding: '8px 12px', fontSize: 13, fontWeight: 500,
              color: palette.accent, background: alpha(palette.accent, 0.1), cursor: 'pointer',
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div style={{ padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s3, minHeight: 160 }}>
        {messages.length === 0 ? (
          <EmptyState palette={palette} icon="sparkles" text={t('companionPlaceholder')} />
        ) : null}
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%', borderRadius: 18, padding: '10px 13px', fontSize: 15,
              whiteSpace: 'pre-wrap',
              color: message.role === 'user' ? palette.onAccent : palette.ink,
              background: message.role === 'user' ? palette.accent : palette.surface,
            }}
          >
            {message.text || '…'}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: SPACE.s2, padding: `0 ${SPACE.s4}px ${SPACE.s4}px` }}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void send(input) }}
          placeholder={t('companionPlaceholder')}
          style={{
            flex: 1, borderRadius: RADIUS.field, border: `1px solid ${palette.line}`,
            padding: '10px 12px', fontSize: 15, background: palette.surface, color: palette.ink,
          }}
        />
        <PrimaryButton palette={palette} title="↑" busy={busy} disabled={!input.trim()} onClick={() => void send(input)} />
      </div>
    </Sheet>
  )
}

function replaceLast(
  messages: { role: 'user' | 'assistant'; text: string }[],
  text: string,
): { role: 'user' | 'assistant'; text: string }[] {
  const next = [...messages]
  next[next.length - 1] = { role: 'assistant', text }
  return next
}
