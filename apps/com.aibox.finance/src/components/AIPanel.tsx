// AI 面板 —— 规格 §13.1 / §13.2 / §13.3。
//
// 容器没有「停靠式会话」，所以走原生自己就有的**降级路径**：把上下文 + 种子 prompt
// 交给宿主聊天页开一个新会话（`aibox.chat.open`）。宿主连 AI 都没有时，
// ✨ 入口与本面板**整块不渲染**（在 app.jsx 里由 `hasAI` 门控）。

import React from 'react'
import Icon from './Icon.js'
import { Sheet, SheetHeader, Spinner } from './primitives.js'
import { C, RADIUS, SPACE } from './theme.js'
import { formatPercent, formatPrice, formatStamp } from '../lib/format.js'
import { INDEX_ROWS, decimalsFor, resolveSymbol } from '../lib/symbol.js'
import { quoteTTL, resolveDataState } from '../lib/quotes.js'
import { accountLabel } from '../i18n/index.js'
import type { AISession, FinanceContext } from '../lib/types.js'

const ROOT_CHIPS = ['market', 'review', 'watch', 'compare', 'explain']
const DETAIL_CHIPS = [
  { id: 'trend', icon: 'chart.line.uptrend.xyaxis' },
  { id: 'risk', icon: 'exclamationmark.triangle' },
  { id: 'peers', icon: 'arrow.left.arrow.right' },
  { id: 'metrics', icon: 'questionmark.circle' },
]

/**
 * 上下文构造（§13.3）。六个部分顺序固定：指数 / 自选 / 组合 / 行情时间 / 来源 / 数据质量。
 * 核心约束是明确告诉模型：**这是页面快照不是实时承诺**；只有页面数值或刚拉的 finance_* 结果
 * 算事实；要区分事实与推断；要保留来源与时间限定；仅供研究与模拟。
 */
type BuildContextInput = Pick<FinanceContext, 't' | 'locale' | 'store' | 'quotes' | 'ledger' | 'settings'>

export function buildContext(ctx: BuildContextInput): string {
  const { t, locale, store, quotes, ledger, settings } = ctx
  const missingQuotes: string[] = []

  const indices = INDEX_ROWS.map((row) => {
    const quote = quotes.quote(row.canonical)
    if (!quote) {
      missingQuotes.push(row.canonical)
      return null
    }
    return `${t(row.key)} ${formatPrice(quote.price, 2)} ${formatPercent(quote.changePct)}`
  })
    .filter(Boolean)
    .join('\n')

  const watch = store.items
    .slice(0, 20)
    .map((item) => {
      const canonical = item.instrumentSymbol
      const quote = quotes.quote(canonical)
      const symbol = resolveSymbol(canonical)
      const decimals = symbol ? decimalsFor(symbol.market) : 2
      if (!quote) missingQuotes.push(canonical)
      return `${store.instrumentName(canonical)} [${canonical}] ${quote ? formatPrice(quote.price, decimals) : '—'} ${quote ? formatPercent(quote.changePct) : '—'}`
    })
    .join('\n')

  const portfolio = ledger.accounts
    .filter((row) => !row.isArchived)
    .slice(0, 8)
    .map((account) => {
      const valuation = ledger.valuation(account.id, quotes.quoteMap(), quotes.fx)
      const label = `${accountLabel(t, account.name)} (${account.currency})`
      if (!valuation || !valuation.isComplete) return `${label}: —`
      const holdings = valuation.rows
        .slice(0, 12)
        .map((row) => `${row.position.name} [${row.position.instrumentSymbol}] ×${row.position.quantity}`)
        .join(', ')
      return `${label} ${(valuation.totalMinor / 100).toFixed(2)}; ${holdings}`
    })
    .join('\n')

  const stamp = quotes.lastUpdated ? formatStamp(quotes.lastUpdated, locale) : '—'
  const sourceLabel =
    quotes.source === 'automatic' ? t('finance.settings.sourceAuto') : quotes.source === 'sina' ? 'Sina' : 'Tencent'

  const state = resolveDataState({
    failed: quotes.lastFailed,
    lastUpdated: quotes.lastUpdated,
    refreshing: false,
    missingCount: quotes.missingSymbols.length,
    ttlMs: quoteTTL(settings.refreshInterval),
    now: Date.now(),
  })
  const quality = []
  if (state === 'failedWithCache' || state === 'failedWithoutData') quality.push(t('finance.ai.data.failed'))
  else if (state === 'partial') quality.push(t('finance.quote.partial'))
  else if (state === 'cached') quality.push(t('finance.ai.data.cached'))
  else quality.push(t('finance.ai.data.fresh'))
  const missing = [...new Set(missingQuotes)].sort()
  if (missing.length > 0) quality.push(t('finance.valuation.missingQuoteList', missing.join(', ')))

  const header =
    locale === 'zh-Hans'
      ? '以下是理财页面此刻的快照，不是实时承诺。只有下面的数值、或你刚用 finance_* 工具拉到的结果，才算事实；其余一律说明是推断。回答时保留数据来源与时间限定。仅供研究与模拟，不构成投资建议。'
      : 'The following is a snapshot of the finance page right now, not a live guarantee. Only the values below — or results you just pulled with the finance_* tools — count as facts; label everything else as inference. Keep the source and time qualifier in your answer. Research and simulation only; not investment advice.'

  return [
    header,
    `\n[Indices]\n${indices || '—'}`,
    `\n[Watchlist]\n${watch || '—'}`,
    `\n[Portfolio]\n${portfolio || '—'}`,
    `\n[Quote time] ${stamp}`,
    `\n[Source] ${sourceLabel}`,
    `\n[Data quality] ${quality.join('; ')}`,
  ].join('\n')
}

export default function AIPanel({
  ctx,
  session,
  onClose,
}: {
  ctx: FinanceContext
  session: AISession | null
  onClose: () => void
}) {
  const { t, locale, actions } = ctx
  const [text, setText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const visible = !!session

  React.useEffect(() => {
    if (visible) setText('')
  }, [visible])
  if (!ctx.hasAI || !session) return null

  const send = async (seed?: string) => {
    const body = String(seed || text).trim()
    if (!body) return
    setBusy(true)
    // 种子 = base + 语言指令；systemContext 走 buildContext。
    await actions.askAI({
      identity: session.identity,
      seed: `${body}\n\n${t('finance.ai.replyLang')}`,
    })
    setBusy(false)
    onClose()
  }

  const detail = session.symbolName
  const chips: Array<{ id: string; icon?: string; label: string; seed: string }> = detail
    ? DETAIL_CHIPS.map((row) => ({
        id: row.id,
        icon: row.icon,
        label: t(`finance.ai.quick.${row.id}`),
        seed: t(`finance.ai.quick.${row.id}.seed`, detail),
      }))
    : ROOT_CHIPS.map((id) => ({
        id,
        label: t(`finance.ai.chip.${id}`),
        seed: t(`finance.ai.chip.${id}.seed`),
      }))

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetHeader
        title={detail ? t('finance.companion.title') : t('finance.ai.title')}
        onClose={onClose}
        closeLabel={t('finance.done')}
      />
      <div
        className="fin-scroll"
        style={{ padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}
      >
        <span style={{ fontSize: 15, color: C.muted }}>{t('finance.ai.header')}</span>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: SPACE.s2,
            background: C.surface,
            borderRadius: RADIUS.field,
            padding: SPACE.s3,
          }}
        >
          <textarea
            className="fin-field"
            rows={2}
            value={text}
            placeholder={t('finance.ai.ask.placeholder')}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            style={{ resize: 'none', lineHeight: 1.4, maxHeight: 96 }}
          />
          <button
            type="button"
            className="fin-btn fin-press"
            aria-label={t('finance.ai.ask.send')}
            disabled={!text.trim() || busy}
            onClick={() => send()}
            style={{ color: C.brand, opacity: text.trim() && !busy ? 1 : 0.35, flex: '0 0 auto' }}
          >
            {busy ? <Spinner size={22} color={C.brand} /> : <Icon name="arrow.up.circle.fill" size={26} />}
          </button>
        </div>

        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="fin-btn fin-press"
            onClick={() => send(chip.seed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.s3,
              background: C.surface,
              borderRadius: RADIUS.field,
              padding: SPACE.s4,
            }}
          >
            {chip.icon ? <Icon name={chip.icon} size={17} color={C.brand} /> : null}
            <span style={{ flex: '1 1 auto', fontSize: 15 }}>{chip.label}</span>
            <Icon name="chevron.right" size={13} color={C.brand} />
          </button>
        ))}

        <span style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: `${SPACE.s2}px 0 ${SPACE.s4}px` }}>
          {t('finance.settings.disclaimer')}
        </span>
      </div>
    </Sheet>
  )
}
