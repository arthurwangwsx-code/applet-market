// ✨ 新闻助手 —— **近似实现**（README 有记）。
//
// 原生把这个入口交给宿主的「停靠式会话」：真聊天页、真工具（news_search / news_read）、按 identity
// （首页 "news" / 逐篇 "news:<id>"）持久续聊。小应用侧没有停靠会话 API，只有 `aibox.ai.generate`，
// 因此这里自绘一个轻量对话面板：同样的会话身份分档、同样的系统上下文与三个快捷 chip，
// 但**工具调用换成把当前时间线摘要塞进上下文**，且会话只存在于本次运行（不持久）。

import React from 'react'
import Icon from './Icon.js'
import { Sheet, Spinner } from './primitives.js'
import { C, SPACE } from './theme.js'
import { aiGenerate } from '../lib/host.js'

const QUICK_ACTIONS = [
  { key: 'today', icon: 'newspaper', labelKey: 'news.companion.today', seedKey: 'news.companion.today.p' },
  { key: 'bytopic', icon: 'square.grid.2x2', labelKey: 'news.companion.bytopic', seedKey: 'news.companion.bytopic.p' },
  { key: 'explain', icon: 'questionmark.circle', labelKey: 'news.companion.explain', seedKey: 'news.companion.explain.p' },
]

/** 时间线摘要：替代原生的 news_search 工具调用，让模型有据可依。 */
function timelineDigest(articles, limit = 40) {
  return articles.slice(0, limit)
    .map((article, i) => `${i + 1}. [${article.topic}] ${article.title} — ${article.sourceName}`)
    .join('\n')
}

export default function AIPanel({ ctx, session, onClose }) {
  const [turns, setTurns] = React.useState([])
  const [draft, setDraft] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const scroller = React.useRef(null)
  const seeded = React.useRef(false)

  const send = React.useCallback(async (text) => {
    const prompt = String(text || '').trim()
    if (!prompt || busy) return
    setDraft('')
    setTurns((rows) => [...rows, { role: 'user', text: prompt }])
    setBusy(true)
    const system = [
      ctx.t('news.companion.context'),
      ctx.t('news.ai.replyLang'),
      `Current timeline (most recent first):\n${timelineDigest(ctx.agg.timeline)}`,
    ].join('\n\n')
    try {
      const reply = await aiGenerate({ system, prompt, intent: 'balanced', maxTokens: 1200 })
      setTurns((rows) => [...rows, { role: 'assistant', text: String(reply || '') }])
    } catch (error) {
      const message = String((error && error.message) || error)
      setTurns((rows) => [...rows, { role: 'assistant', text: message.startsWith('aibox/') ? message : ctx.t('news.x.aiUnavailable') }])
    } finally {
      setBusy(false)
    }
  }, [busy, ctx])

  React.useEffect(() => {
    if (!session || seeded.current) return
    seeded.current = true
    if (session.seed) send(session.seed)
  }, [session, send])

  React.useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
  }, [turns, busy])

  return (
    <Sheet visible={!!session} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '78dvh' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: SPACE.s2,
          padding: `${SPACE.s3}px ${SPACE.s4}px`, borderBottom: `0.5px solid ${C.line}`,
        }}
        >
          <Icon name="sparkles" size={16} color={C.brand} />
          <span style={{ flex: '1 1 auto', fontSize: 16, fontWeight: 500, color: C.ink }}>
            {ctx.t('news.companion.title')}
          </span>
          <button
            type="button"
            className="news-btn news-press"
            onClick={onClose}
            aria-label={ctx.t('news.x.close')}
            style={{ color: C.muted, padding: 6 }}
          >
            <Icon name="xmark" size={15} />
          </button>
        </div>

        <div ref={scroller} style={{ flex: '1 1 auto', overflowY: 'auto', padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
          {turns.length === 0 && !busy ? (
            <span style={{ fontSize: 13, color: C.muted }}>{ctx.t('news.companion.context')}</span>
          ) : null}
          {turns.map((turn, i) => (
            <div
              key={i}
              style={{
                alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                padding: `9px ${SPACE.s3}px`,
                borderRadius: 14,
                background: turn.role === 'user' ? C.brand : C.bg,
                color: turn.role === 'user' ? C.onBrand : C.ink,
                fontSize: 15,
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {turn.text}
            </div>
          ))}
          {busy ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 13 }}>
              <Spinner size={14} color={C.brand} />
              {ctx.t('news.x.aiThinking')}
            </div>
          ) : null}
        </div>

        <div className="news-chips" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: `0 ${SPACE.s4}px ${SPACE.s2}px` }}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              className="news-btn news-press"
              onClick={() => send(ctx.t(action.seedKey))}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, flex: '0 0 auto',
                padding: '6px 11px', borderRadius: 999, fontSize: 13, color: C.ink,
                background: 'color-mix(in srgb, var(--news-line) 50%, transparent)',
              }}
            >
              <Icon name={action.icon} size={13} color={C.brand} />
              {ctx.t(action.labelKey)}
            </button>
          ))}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: SPACE.s2,
          padding: `${SPACE.s2}px ${SPACE.s4}px`, borderTop: `0.5px solid ${C.line}`,
        }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') send(draft) }}
            placeholder={ctx.t('news.x.askPlaceholder')}
            style={{
              flex: '1 1 auto', minWidth: 0, border: 0, outline: 'none', background: 'transparent',
              font: 'inherit', fontSize: 15, color: C.ink, padding: '8px 0',
            }}
          />
          <button
            type="button"
            className="news-btn news-press"
            onClick={() => send(draft)}
            disabled={busy || !draft.trim()}
            style={{ color: draft.trim() && !busy ? C.brand : C.muted, fontSize: 15, padding: 6 }}
          >
            {ctx.t('news.x.send')}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
