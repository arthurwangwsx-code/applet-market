// 三个 AI 抽屉（规格 §4.11）：待办事项 / 询问这段录音 / 整理文本。

import { useEffect, useState } from 'react'
import { clockString } from '../lib/format'
import { askMemo, cleanTranscript, fetchActionItems, saveArtifacts } from '../lib/memos'
import type { T } from '../lib/strings'
import { RADIUS, SPACE, alpha, type Palette } from '../lib/theme'
import type { ActionItem, ActionItemKind, MemoArtifacts } from '../lib/types'
import { EmptyState, Icon, PrimaryButton, SecondaryButton, Sheet } from './primitives'

export function ActionItemsSheet(props: {
  palette: Palette
  t: T
  open: boolean
  memoID: string
  artifacts: MemoArtifacts | null
  onArtifacts: (value: MemoArtifacts) => void
  onSeek: (seconds: number) => void
  onClose: () => void
}) {
  const { palette, t } = props
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const items = props.artifacts?.actionItems ?? []

  const run = async (force: boolean) => {
    if (!props.artifacts) return
    setBusy(true)
    setFailed(false)
    const next = await fetchActionItems(props.memoID, force)
    setBusy(false)
    if (next.length === 0 && force) setFailed(true)
    const merged: MemoArtifacts = { ...props.artifacts, actionItems: next }
    props.onArtifacts(merged)
    await saveArtifacts(merged)
  }

  // 进入自动提取（若还没提取过）。
  useEffect(() => {
    if (!props.open || !props.artifacts) return
    if (props.artifacts.actionItems.length > 0) return
    void run(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.artifacts?.memoID])

  const toggle = async (id: string) => {
    if (!props.artifacts) return
    const merged: MemoArtifacts = {
      ...props.artifacts,
      actionItems: props.artifacts.actionItems.map((item) => (item.id === id ? { ...item, isDone: !item.isDone } : item)),
    }
    props.onArtifacts(merged)
    // 勾选立即落盘。
    await saveArtifacts(merged)
  }

  const groups: { kind: ActionItemKind; label: string }[] = [
    { kind: 'task', label: t('groupTasks') },
    { kind: 'decision', label: t('groupDecisions') },
    { kind: 'commitment', label: t('groupCommitments') },
  ]

  return (
    <Sheet palette={palette} open={props.open} onClose={props.onClose}>
      <SheetHeader
        palette={palette}
        title={t('actionItems')}
        leading={<SecondaryButton palette={palette} title="" icon="refresh" onClick={() => void run(true)} />}
        onDone={props.onClose}
        doneLabel={t('done')}
      />
      <div style={{ padding: `0 ${SPACE.s4}px ${SPACE.s6}px` }}>
        {busy ? <div style={{ fontSize: 14, color: palette.muted, textAlign: 'center', padding: SPACE.s5 }}>…</div> : null}
        {!busy && items.length === 0 ? (
          failed ? (
            <div style={{ textAlign: 'center', padding: SPACE.s5 }}>
              <div style={{ fontSize: 14, color: palette.muted, marginBottom: SPACE.s3 }}>{t('actionItemsFailed')}</div>
              <PrimaryButton palette={palette} title={t('retry')} onClick={() => void run(true)} />
            </div>
          ) : (
            <EmptyState palette={palette} icon="checklist" text={t('noActionItems')} />
          )
        ) : null}
        {groups.map((group) => {
          const rows = items.filter((item) => item.kind === group.kind)
          if (rows.length === 0) return null
          return (
            <section key={group.kind} style={{ marginTop: SPACE.s4 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: palette.muted, textTransform: 'uppercase', marginBottom: 6 }}>
                {group.label}
              </div>
              {rows.map((item) => (
                <ActionRow
                  key={item.id}
                  palette={palette}
                  item={item}
                  onToggle={() => void toggle(item.id)}
                  onSeek={() => {
                    if (item.sourceTime === undefined) return
                    props.onSeek(item.sourceTime)
                    props.onClose()
                  }}
                />
              ))}
            </section>
          )
        })}
      </div>
    </Sheet>
  )
}

function ActionRow(props: { palette: Palette; item: ActionItem; onToggle: () => void; onSeek: () => void }) {
  const { palette, item } = props
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: SPACE.s2, padding: '8px 0' }}>
      <button
        type="button"
        onClick={props.onToggle}
        style={{ border: 'none', background: 'transparent', color: item.isDone ? palette.accent : palette.muted, cursor: 'pointer', padding: 0, fontSize: 16 }}
        aria-label="Toggle"
      >
        {item.isDone ? '◉' : '○'}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, color: palette.ink, textDecoration: item.isDone ? 'line-through' : 'none' }}>
          {item.text}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          {item.owner ? (
            <span style={{ fontSize: 11, color: palette.accent, background: alpha(palette.accent, 0.18), borderRadius: 999, padding: '2px 8px' }}>
              {item.owner}
            </span>
          ) : null}
          {item.dueHint ? <span style={{ fontSize: 11, color: palette.muted }}>{item.dueHint}</span> : null}
        </div>
      </div>
      {item.sourceTime !== undefined ? (
        <button
          type="button"
          onClick={props.onSeek}
          style={{ border: 'none', background: 'transparent', color: palette.accent, fontSize: 12, cursor: 'pointer', fontFamily: 'ui-monospace, monospace' }}
        >
          {clockString(item.sourceTime)}
        </button>
      ) : null}
    </div>
  )
}

export function AskSheet(props: {
  palette: Palette
  t: T
  open: boolean
  memoID: string
  onClose: () => void
}) {
  const { palette, t } = props
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (props.open) return
    setQuestion('')
    setAnswer('')
  }, [props.open])

  const send = async (text: string) => {
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    setAnswer('')
    const result = await askMemo(props.memoID, value)
    setBusy(false)
    setAnswer(result.ok && result.text ? result.text : t('askFailed'))
  }

  const starters = [t('askStarter1'), t('askStarter2'), t('askStarter3')]

  return (
    <Sheet palette={palette} open={props.open} onClose={props.onClose}>
      <SheetHeader palette={palette} title={t('askTitle')} onDone={props.onClose} doneLabel={t('done')} />
      <div style={{ padding: `0 ${SPACE.s4}px ${SPACE.s4}px` }}>
        {!answer && !busy ? (
          <>
            <div style={{ fontSize: 14, color: palette.muted, marginBottom: SPACE.s3 }}>{t('askHint')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {starters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  // 点击即作为真实提问发送。
                  onClick={() => void send(starter)}
                  style={{
                    border: 'none', borderRadius: 999, padding: '8px 12px', fontSize: 13,
                    color: palette.accent, background: alpha(palette.accent, 0.15), cursor: 'pointer',
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {busy ? <div style={{ fontSize: 14, color: palette.muted, padding: SPACE.s5, textAlign: 'center' }}>{t('askThinking')}</div> : null}

        {answer ? (
          <div style={{ background: palette.surface, borderRadius: RADIUS.field, padding: SPACE.s4, fontSize: 15, lineHeight: 1.6, color: palette.ink, whiteSpace: 'pre-wrap' }}>
            {answer}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: SPACE.s2, padding: `0 ${SPACE.s4}px ${SPACE.s5}px` }}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void send(question) }}
          placeholder={t('askPlaceholder')}
          style={{
            flex: 1, borderRadius: RADIUS.field, border: `1px solid ${palette.line}`, padding: '10px 12px',
            fontSize: 15, background: palette.surface, color: palette.ink,
          }}
        />
        <PrimaryButton palette={palette} title="↑" busy={busy} disabled={!question.trim()} onClick={() => void send(question)} />
      </div>
    </Sheet>
  )
}

export function CleanUpSheet(props: {
  palette: Palette
  t: T
  open: boolean
  memoID: string
  onClose: () => void
  onApplied: () => void
}) {
  const { palette, t } = props
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <Sheet palette={palette} open={props.open} onClose={props.onClose}>
      <SheetHeader palette={palette} title={t('cleanUp')} onDone={props.onClose} doneLabel={t('cancel')} />
      <div style={{ padding: `0 ${SPACE.s4}px ${SPACE.s6}px` }}>
        {/* ⚠️ Clean Up 是**破坏性**的：直接改写宿主的 fullText 并作废全部 AI 产物。 */}
        <div style={{ background: alpha(palette.orange, 0.1), borderRadius: RADIUS.field, padding: SPACE.s3, fontSize: 13, color: palette.orange }}>
          <Icon name="warning" size={13} /> {t('cleanUpWarning')}
        </div>
        {failed ? <div style={{ fontSize: 14, color: palette.muted, marginTop: SPACE.s3 }}>{t('cleanUpFailed')}</div> : null}
        <div style={{ marginTop: SPACE.s4 }}>
          <PrimaryButton
            palette={palette}
            title={t('cleanUpKeep')}
            block
            busy={busy}
            onClick={async () => {
              setBusy(true)
              setFailed(false)
              const result = await cleanTranscript(props.memoID)
              setBusy(false)
              if (!result.ok) {
                setFailed(true)
                return
              }
              props.onApplied()
              props.onClose()
            }}
          />
        </div>
      </div>
    </Sheet>
  )
}

function SheetHeader(props: {
  palette: Palette
  title: string
  leading?: React.ReactNode
  onDone: () => void
  doneLabel: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: SPACE.s4 }}>
      {props.leading}
      <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: props.palette.ink }}>{props.title}</div>
      <button
        type="button"
        onClick={props.onDone}
        style={{ border: 'none', background: 'transparent', color: props.palette.accent, fontSize: 15, cursor: 'pointer' }}
      >
        {props.doneLabel}
      </button>
    </div>
  )
}
