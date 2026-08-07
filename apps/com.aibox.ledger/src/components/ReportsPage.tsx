// 报表页（LedgerReportsView）+ 下钻列表（LedgerFilteredTransactionsView）。
// 布局：月份条 → 收支切换 → 总额卡 →（占比卡）→（趋势卡）→（排行卡）。

import React from 'react'
import Icon, { IconBadge } from './Icon.js'
import { Card, Divider, EmptyState, MonthBar, Segmented } from './primitives.js'
import { ChartLegend, DonutChart, TimeBarChart, bucketColor } from './Charts.js'
import { C, SPACE, alpha } from './theme.js'
import { KIND } from '../lib/store.js'
import { buckets } from '../lib/queries.js'
import { monthFlowTransactions } from '../lib/reporting.js'
import { addMonths, monthKeyNow, monthTitle, shortDate } from '../lib/dates.js'
import { money } from '../lib/money.js'
import { entryPathTitle } from '../lib/display.js'
import type { FlowKind, LedgerUIContext, ReportBucket } from '../types.js'

export default function ReportsPage({ ctx }: { ctx: LedgerUIContext }) {
  const { store, t, locale, actions } = ctx
  const [monthKey, setMonthKey] = React.useState(monthKeyNow)
  const [metric, setMetric] = React.useState<FlowKind>('expense')
  const [drill, setDrill] = React.useState<ReportBucket | null>(null)

  const rows = React.useMemo(
    () => monthFlowTransactions(store, monthKey),
    [store, store.revision, monthKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const labels = { uncategorized: t('x.uncategorized'), noTag: t('x.noTag'), noProject: t('x.noProject') }
  const categoryBuckets = React.useMemo(
    () => buckets(store, rows, 'byCategory', metric, locale, labels),
    [store, rows, metric, locale], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const dayBuckets = React.useMemo(
    () => buckets(store, rows, 'byDay', metric, locale, labels),
    [store, rows, metric, locale], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const total = categoryBuckets.reduce((sum, bucket) => sum + bucket.amountMinor, 0)
  const isEmpty = rows.length === 0

  if (drill) {
    return <DrillDown ctx={ctx} monthKey={monthKey} metric={metric} bucket={drill} onBack={() => setDrill(null)} />
  }

  return (
    <div className="lg-scroll" style={{ flex: '1 1 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 96 }}>
        <MonthBar
          title={monthTitle(monthKey, locale)}
          onPrevious={() => setMonthKey((key) => addMonths(key, -1))}
          onNext={() => setMonthKey((key) => addMonths(key, 1))}
          nextDisabled={monthKey >= monthKeyNow()}
        />
        <Segmented
          value={metric}
          onChange={setMetric}
          items={[
            { id: 'expense', label: t('x.expense') },
            { id: 'income', label: t('x.income') },
          ]}
        />

        {isEmpty ? (
          <EmptyState icon="chart.pie" title={t('rep.emptyTitle')} body={t('rep.emptyBody')} />
        ) : (
          <>
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: C.muted }}>
                  {metric === 'expense' ? t('rep.totalSpending') : t('rep.totalIncome')}
                </span>
                <span
                  className="lg-mono"
                  style={{ fontSize: 30, fontWeight: 500, color: metric === 'expense' ? C.expense : C.income }}
                >
                  {money(total, store.baseCode)}
                </span>
              </div>
            </Card>

            {categoryBuckets.length > 0 ? (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: SPACE.s3 }}>
                  {t('rep.byCategory')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s4 }}>
                  <DonutChart buckets={categoryBuckets} size={150} />
                  <ChartLegend buckets={categoryBuckets} currency={store.baseCode} />
                </div>
              </Card>
            ) : null}

            {dayBuckets.length >= 2 ? (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: SPACE.s3 }}>
                  {t('rep.dailyTrend')}
                </div>
                <TimeBarChart
                  buckets={dayBuckets}
                  currency={store.baseCode}
                  height={170}
                  color={metric === 'expense' ? C.expense : C.income}
                />
              </Card>
            ) : null}

            {categoryBuckets.length > 0 ? (
              <Card padding={0}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: C.muted,
                    padding: `${SPACE.s4}px ${SPACE.s4}px ${SPACE.s2}px`,
                  }}
                >
                  {t('rep.ranking')}
                </div>
                {categoryBuckets.slice(0, 10).map((bucket, index) => (
                  <React.Fragment key={bucket.key}>
                    {index > 0 ? <Divider inset={SPACE.s4} /> : null}
                    <button
                      type="button"
                      className="lg-btn"
                      onClick={() => setDrill(bucket)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.s3,
                        width: '100%',
                        padding: `11px ${SPACE.s4}px`,
                      }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 4.5,
                          flex: '0 0 auto',
                          background: bucketColor(bucket, index),
                        }}
                      />
                      <span
                        className="lg-clamp-1"
                        style={{ fontSize: 15, color: C.ink, flex: '1 1 auto', minWidth: 0 }}
                      >
                        {bucket.label}
                      </span>
                      {total > 0 ? (
                        <span className="lg-mono" style={{ fontSize: 12, color: C.muted }}>
                          {Math.round((Math.abs(bucket.amountMinor) / Math.abs(total)) * 100)}%
                        </span>
                      ) : null}
                      <span className="lg-mono" style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>
                        {money(Math.abs(bucket.amountMinor), store.baseCode)}
                      </span>
                      <Icon name="chevron.right" size={10} color={C.muted} />
                    </button>
                  </React.Fragment>
                ))}
              </Card>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

/** 下钻列表：该月 + metric 对应 kind +（若来自分类桶）一级分类或其子分类。 */
function DrillDown({
  ctx,
  monthKey,
  metric,
  bucket,
  onBack,
}: {
  ctx: LedgerUIContext
  monthKey: number
  metric: FlowKind
  bucket: ReportBucket
  onBack: () => void
}) {
  const { store, t, locale, actions } = ctx
  const rows = React.useMemo(
    () =>
      monthFlowTransactions(store, monthKey).filter((txn) => {
        if (metric === 'expense' && txn.kind !== KIND.expense) return false
        if (metric === 'income' && txn.kind !== KIND.income) return false
        if (bucket.key === '__uncat__') return !txn.categoryID
        const root = store.rootCategoryID(txn.categoryID)
        return txn.categoryID === bucket.key || root === bucket.key
      }),
    [store, store.revision, monthKey, metric, bucket],
  ) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="lg-scroll" style={{ flex: '1 1 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3, padding: SPACE.s4, paddingBottom: 96 }}>
        <button
          type="button"
          className="lg-btn"
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.brand, fontSize: 15 }}
        >
          <Icon name="chevron.left" size={14} color={C.brand} />
          <span>{monthTitle(monthKey, locale)}</span>
        </button>

        {rows.length === 0 ? (
          <EmptyState icon="list.bullet.rectangle" title={t('tx.noMatchTitle')} body={t('rep.drillEmptyBody')} />
        ) : (
          <>
            <Card padding={0}>
              {rows.map((txn, index) => {
                const category = txn.categoryID ? store.category(txn.categoryID) : null
                const color = category ? category.colorHex : C.brand
                return (
                  <React.Fragment key={txn.id}>
                    {index > 0 ? <Divider inset={48} /> : null}
                    <button
                      type="button"
                      className="lg-btn"
                      onClick={() => actions.editEntry(txn)}
                      style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }}
                    >
                      <IconBadge
                        name={category ? category.systemImage || 'tag' : 'tag'}
                        size={34}
                        color={color}
                        background={category ? alpha(category.colorHex, 0.16) : undefined}
                        style={
                          category ? undefined : { background: 'color-mix(in srgb, var(--lg-brand) 16%, transparent)' }
                        }
                      />
                      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="lg-clamp-1" style={{ fontSize: 15, color: C.ink }}>
                          {entryPathTitle(store, txn, t)}
                        </span>
                        <span className="lg-clamp-1" style={{ fontSize: 12, color: C.muted }}>
                          {[store.account(txn.accountID)?.name, txn.note].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span className="lg-mono" style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>
                          {money(txn.kind === KIND.income ? txn.amountMinor : -txn.amountMinor, txn.currency, {
                            signed: txn.kind === KIND.income,
                          })}
                        </span>
                        <span className="lg-mono" style={{ fontSize: 10, color: C.muted }}>
                          {shortDate(txn.occurredOn, locale)}
                        </span>
                      </div>
                    </button>
                  </React.Fragment>
                )
              })}
            </Card>
            <span style={{ fontSize: 12, color: C.muted, padding: '0 4px', lineHeight: 1.4 }}>
              {t('rep.drillFooter')}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
