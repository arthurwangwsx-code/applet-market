// AI 分析面板（LedgerAIChipsView）。
//
// 与原生的差异（README 有记）：原生走「停靠陪聊 + ledger_* 工具多轮会话」；小应用容器的
// `aibox.ai` 是**单次无工具**的文本能力。所以这里反过来做：**先在本地把真实数据算好**
// （与报表页/预算页同一份 lib），把数据摘要交给模型，模型只负责解读。
// 这样「结论必须钉在真实数据上」这条契约反而更硬——模型没有编数字的机会。

import React from 'react'
import Icon, { IconBadge, Spinner } from './Icon.jsx'
import { Card } from './primitives.jsx'
import { C, RADIUS, SPACE, fade } from './theme.js'
import { buckets } from '../lib/queries.js'
import { budgetPayload, monthFlowTransactions, monthlyFlow } from '../lib/reporting.js'
import { addMonths, monthKeyNow, monthTitle } from '../lib/dates.js'
import { money } from '../lib/money.js'
import { aiGenerate } from '../lib/host.js'

const SCENARIOS = [
  { id: 'review', icon: 'sparkles.rectangle.stack', tint: C.brand, titleKey: 'ai.review', subKey: 'ai.reviewSub' },
  { id: 'budget', icon: 'target', tint: C.info, titleKey: 'ai.budget', subKey: 'ai.budgetSub' },
  { id: 'anomaly', icon: 'exclamationmark.magnifyingglass', tint: C.expense, titleKey: 'ai.anomaly', subKey: 'ai.anomalySub' },
  { id: 'subs', icon: 'repeat.circle', tint: C.insight, titleKey: 'ai.subs', subKey: 'ai.subsSub' },
]

// 给模型的静默系统上下文（不面向用户，不本地化）。
const SYSTEM = 'You are helping the user with their personal ledger. Every number in the DATA block below '
  + 'was computed locally from the real ledger — treat it as ground truth, never invent figures, and never give '
  + 'generic financial advice that is not anchored to this data. Answer in the user\'s language. Be concise.'

const PROMPTS = {
  quick: 'Using the budget status in DATA, tell me how much I can still spend today. One or two sentences.',
  review: 'Review this month\'s spending. Use the category breakdown, daily trend and month-over-month figures in '
    + 'DATA, plus the budget status, then give a short verdict and 2–3 actionable suggestions.',
  budget: 'Check whether my budgets are realistic. Compare each category budget with actual spending in DATA '
    + '(including the recent three-month averages), point out the biggest deviations and suggest adjustments.',
  anomaly: 'Scan for unusual spending. Use the large expenses and month-over-month comparison in DATA and flag '
    + 'anything that stands out against history.',
  subs: 'Tally my recurring and subscription spending. Use the repeated merchants/notes in DATA and total up my '
    + 'fixed monthly costs.',
}

/** 把真实账本算成一段紧凑的数据简报（所有金额都是基准币）。 */
function buildBrief(store, locale, t, scenario) {
  const base = store.baseCode
  const month = monthKeyNow()
  const previous = addMonths(month, -1)
  const labels = { uncategorized: t('x.uncategorized'), noTag: t('x.noTag'), noProject: t('x.noProject') }
  const flow = monthlyFlow(store, month)
  const previousFlow = monthlyFlow(store, previous)
  const payload = budgetPayload(store, month)
  const lines = []

  lines.push(`base_currency: ${base}`)
  lines.push(`month: ${monthTitle(month, locale)}`)
  lines.push(`this_month_expense: ${money(flow.expense, base)}`)
  lines.push(`this_month_income: ${money(flow.income, base)}`)
  lines.push(`last_month_expense: ${money(previousFlow.expense, base)}`)
  lines.push(`budget_limit: ${money(payload.totalLimitMinor, base)}`)
  lines.push(`budget_spent: ${money(payload.totalSpentMinor, base)}`)
  lines.push(`budget_remaining: ${money(payload.remainingMinor, base)}`)
  lines.push(`days_left_in_month: ${payload.daysLeft}`)
  lines.push(`daily_allowance_left: ${money(payload.dailyRemainingMinor, base)}`)

  if (scenario !== 'quick') {
    const rows = monthFlowTransactions(store, month)
    const byCategory = buckets(store, rows, 'byCategory', 'expense', locale, labels)
    lines.push(`categories_this_month: ${byCategory.slice(0, 12)
      .map((row) => `${row.label}=${money(row.amountMinor, base)}(${row.count})`).join(', ') || 'none'}`)
    const byDay = buckets(store, rows, 'byDay', 'expense', locale, labels)
    lines.push(`daily_trend: ${byDay.map((row) => `${row.label}=${money(row.amountMinor, base)}`).join(', ') || 'none'}`)
  }

  if (scenario === 'budget') {
    lines.push(`budget_lines: ${payload.lines
      .map((row) => `${row.name}: spent ${money(row.spentMinor, base)} of ${money(row.limitMinor, base)}`)
      .join(' | ') || 'none'}`)
    const averages = [1, 2, 3].map((back) => {
      const key = addMonths(month, -back)
      return `${monthTitle(key, locale)}=${money(monthlyFlow(store, key).expense, base)}`
    })
    lines.push(`recent_months_expense: ${averages.join(', ')}`)
  }

  if (scenario === 'anomaly') {
    const large = monthFlowTransactions(store, month)
      .filter((txn) => txn.kind === 'expense')
      .sort((a, b) => store.reportingBaseMinor(b) - store.reportingBaseMinor(a))
      .slice(0, 10)
      .map((txn) => `${money(store.reportingBaseMinor(txn), base)} ${txn.merchant
        || (txn.categoryID ? store.categoryPath(txn.categoryID) : '')}`)
    lines.push(`largest_expenses_this_month: ${large.join(' | ') || 'none'}`)
  }

  if (scenario === 'subs') {
    const counter = new Map()
    for (const txn of store.allTransactions().slice(0, 400)) {
      if (txn.kind !== 'expense') continue
      const key = (txn.merchant || txn.note || '').trim().toLowerCase()
      if (key.length === 0) continue
      const row = counter.get(key) ?? { label: txn.merchant || txn.note, count: 0, total: 0 }
      row.count += 1
      row.total += store.reportingBaseMinor(txn)
      counter.set(key, row)
    }
    const repeated = [...counter.values()].filter((row) => row.count >= 2)
      .sort((a, b) => b.total - a.total).slice(0, 12)
    lines.push(`repeated_payees: ${repeated
      .map((row) => `${row.label}×${row.count}=${money(row.total, base)}`).join(' | ') || 'none'}`)
  }

  return lines.join('\n')
}

export default function AIPanel({ ctx }) {
  const { store, t, locale } = ctx
  const [running, setRunning] = React.useState(null)
  const [answers, setAnswers] = React.useState({})

  const run = async (scenario) => {
    setRunning(scenario)
    try {
      const text = await aiGenerate({
        system: SYSTEM,
        prompt: `${PROMPTS[scenario]}\n\nDATA:\n${buildBrief(store, locale, t, scenario)}`,
        intent: scenario === 'quick' ? 'fast' : 'balanced',
        maxTokens: scenario === 'quick' ? 200 : 700,
      })
      setAnswers((current) => ({ ...current, [scenario]: String(text ?? '').trim() || t('ai.failed') }))
    } catch (error) {
      setAnswers((current) => ({ ...current, [scenario]: t('ai.failed') }))
    } finally {
      setRunning(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}>
      {/* 快问快答卡：结果就地回显，不离开记账页。 */}
      <Card>
        <button
          type="button"
          className="lg-btn"
          onClick={() => run('quick')}
          disabled={running !== null}
          style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%' }}
        >
          <IconBadge name="bolt.fill" size={38} color={C.brand} background={fade(C.brand, 14)} />
          <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>{t('ai.quickQuestion')}</span>
            <span style={{ fontSize: 12, color: C.muted }}>{t('ai.quickSub')}</span>
          </div>
          {running === 'quick'
            ? <Spinner size={18} color={C.brand} />
            : <Icon name="arrow.right.circle" size={18} color={C.brand} />}
        </button>
        {answers.quick ? (
          <div style={{
            marginTop: SPACE.s3, background: fade(C.brand, 8), borderRadius: RADIUS.field,
            padding: SPACE.s3, fontSize: 14, color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap',
          }}
          >
            {answers.quick}
          </div>
        ) : null}
      </Card>

      <div>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.muted, padding: '0 4px' }}>{t('ai.deepAnalysis')}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3, marginTop: SPACE.s2 }}>
          {SCENARIOS.map((scenario) => (
            <Card key={scenario.id}>
              <button
                type="button"
                className="lg-btn"
                onClick={() => run(scenario.id)}
                disabled={running !== null}
                style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%' }}
              >
                <IconBadge
                  name={scenario.icon}
                  size={38}
                  color={scenario.tint}
                  background={fade(scenario.tint, 14)}
                />
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>{t(scenario.titleKey)}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{t(scenario.subKey)}</span>
                </div>
                {running === scenario.id
                  ? <Spinner size={16} color={C.brand} />
                  : <Icon name="chevron.right" size={13} color={C.muted} />}
              </button>
              {answers[scenario.id] ? (
                <div style={{
                  marginTop: SPACE.s3, background: fade(C.brand, 8), borderRadius: RADIUS.field,
                  padding: SPACE.s3, fontSize: 14, color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}
                >
                  {answers[scenario.id]}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
