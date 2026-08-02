// 预算页（LedgerBudgetView）。月份状态提到根视图，所以 FAB 建的预算落在当前查看月。

import React from 'react'
import Icon from './Icon.jsx'
import { Card, EmptyState, MonthBar, ProgressBar } from './primitives.jsx'
import { C, SPACE } from './theme.js'
import { budgetPayload } from '../lib/reporting.js'
import { addMonths, monthKeyNow, monthTitle } from '../lib/dates.js'
import { money } from '../lib/money.js'

export default function BudgetPage({ ctx }) {
  const { store, t, locale, actions, monthKey } = ctx
  const payload = React.useMemo(
    () => budgetPayload(store, monthKey),
    [store, store.revision, monthKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const over = payload.remainingMinor < 0
  const hasBudget = payload.totalLimitMinor > 0
  const progress = hasBudget ? Math.min(1.2, payload.totalSpentMinor / payload.totalLimitMinor) : 0

  return (
    <div className="lg-scroll" style={{ flex: '1 1 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 96 }}>
        <MonthBar
          title={monthTitle(monthKey, locale)}
          onPrevious={() => actions.setMonthKey(addMonths(monthKey, -1))}
          onNext={() => actions.setMonthKey(addMonths(monthKey, 1))}
          nextDisabled={monthKey >= monthKeyNow()}
        />

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: hasBudget ? SPACE.s3 : 0 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>{monthTitle(monthKey, locale)}</span>
            <div style={{ flex: '1 1 auto' }} />
            {hasBudget ? (
              <button type="button" className="lg-btn" onClick={() => actions.editBudget(null)} aria-label={t('x.edit')}>
                <Icon name="pencil" size={13} color={C.muted} />
              </button>
            ) : null}
          </div>

          {hasBudget ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s2 }}>
              <span className="lg-mono" style={{ fontSize: 30, fontWeight: 500, color: over ? C.expense : C.brand }}>
                {money(Math.abs(payload.remainingMinor), store.baseCode)}
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>
                {over ? t('bud.overBudget') : t('bud.leftToSpend')}
              </span>
              {payload.totalCarriedMinor > 0 ? (
                <span style={{ fontSize: 12, color: C.brand }}>
                  {t('bud.includesCarried', money(payload.totalCarriedMinor, store.baseCode))}
                </span>
              ) : null}
              <ProgressBar progress={progress} height={10} color={over ? C.expense : C.brand} minWidth={6} />
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: C.muted }}>
                <span className="lg-mono">
                  {`${money(payload.totalSpentMinor, store.baseCode)} / ${money(payload.totalLimitMinor, store.baseCode)}`}
                </span>
                <div style={{ flex: '1 1 auto' }} />
                <span className="lg-mono">
                  {t('bud.perDay', money(payload.dailyRemainingMinor, store.baseCode))}
                </span>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 15, color: C.muted }}>{t('bud.noTotal')}</span>
          )}
        </Card>

        {payload.lines.length === 0 && !hasBudget ? (
          <EmptyState icon="target" title={t('bud.emptyTitle')} body={t('bud.emptyBody')} />
        ) : null}

        {payload.lines.length > 0 ? (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: SPACE.s3 }}>
              {t('bud.categoryBudgets')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}>
              {payload.lines.map((line) => {
                const lineOver = line.spentMinor > line.limitMinor
                const ratio = line.limitMinor > 0 ? Math.min(1.5, line.spentMinor / line.limitMinor) : 0
                return (
                  <button
                    key={line.categoryID}
                    type="button"
                    className="lg-btn"
                    onClick={() => actions.editBudget(line.categoryID)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, width: '100%' }}>
                      <span style={{
                        width: 9, height: 9, borderRadius: 4.5, flex: '0 0 auto',
                        background: line.colorHex || C.brand,
                      }}
                      />
                      <span className="lg-clamp-1" style={{ fontSize: 15, color: C.ink, flex: '1 1 auto', minWidth: 0 }}>
                        {line.name}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span className="lg-mono" style={{ fontSize: 12, color: lineOver ? C.expense : C.muted }}>
                          {`${money(line.spentMinor, store.baseCode)} / ${money(line.limitMinor, store.baseCode)}`}
                        </span>
                        {line.carriedMinor > 0 ? (
                          <span className="lg-mono" style={{ fontSize: 10, color: C.brand }}>
                            {t('bud.rollover', money(line.carriedMinor, store.baseCode))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ width: '100%' }}>
                      <ProgressBar
                        progress={ratio}
                        height={7}
                        color={lineOver ? C.expense : (line.colorHex || C.brand)}
                        minWidth={4}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
