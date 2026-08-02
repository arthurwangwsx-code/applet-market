// 持仓页 —— 规格 §10 的可视化面。
//
// 数据诚实性底线（§15 第 7 条）：缺行情或缺汇率的持仓一律**按 0 计并打标**，
// 账户显「当前估值不完整 + 缺失清单」；**诊断/快照/绩效只消费完整估值**——
// 不完整时不出健康分、不写快照，而不是拿半份数据凑一个看起来很像的数字。

import React from 'react'
import Icon from './Icon.jsx'
import { ALLOCATION_COLORS, DonutChart, LineChart } from './Chart.jsx'
import { Card, Chip, ChipRow, EmptyState, PullRefresh, Spinner, Stat } from './primitives.jsx'
import { C, RADIUS, SPACE } from './theme.js'
import {
  formatMinor, formatPercent, formatPrice, formatQuantity, trendColor,
} from '../lib/format.js'
import { accountLabel } from '../i18n/index.js'
import { decimalsFor, resolveSymbol } from '../lib/symbol.js'

function PositionRow({ row, t, upIsRed, onOpen }) {
  const symbol = resolveSymbol(row.position.instrumentSymbol)
  const decimals = symbol ? decimalsFor(symbol.market) : 2
  const currency = row.position.currency
  return (
    <button
      type="button"
      className="fin-btn fin-press"
      onClick={() => onOpen(row.position.instrumentSymbol)}
      style={{
        display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: '9px 0',
        borderBottom: `0.5px solid ${C.line}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto' }}>
        <span className="fin-clamp-1" style={{ fontSize: 15, color: C.ink }}>{row.position.name}</span>
        <span className="fin-mono" style={{ fontSize: 12, color: C.muted }}>
          {formatQuantity(row.position.quantity)} × {formatPrice(row.position.avgCost, decimals)} {currency}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: '0 0 auto' }}>
        <span className="fin-mono" style={{ fontSize: 15, fontWeight: 500 }}>
          {row.priced ? formatMinor(row.marketValueMinor, row.accountCurrency) : '—'}
        </span>
        <span className="fin-mono" style={{ fontSize: 12, color: trendColor(row.unrealizedMinor, upIsRed) }}>
          {row.priced
            ? `${formatMinor(row.unrealizedMinor, row.accountCurrency, { signed: true })} ${formatPercent(row.unrealizedPct)}`
            : t(row.missingQuote ? 'finance.valuation.missingQuote' : 'finance.valuation.missingFX')}
        </span>
      </div>
    </button>
  )
}

export default function PortfolioPage({ ctx }) {
  const { t, ledger, settings, actions, valuation, perf } = ctx
  const scrollRef = React.useRef(null)
  const upIsRed = settings.upIsRed

  const accounts = ledger.accounts.filter((row) => !row.isArchived)
  const account = valuation ? valuation.account : null

  if (accounts.length === 0) {
    return <EmptyState icon="wallet.pass" text={t('finance.portfolio.noAccount')} />
  }
  if (!valuation) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <Spinner size={20} color={C.muted} />
      </div>
    )
  }

  const currency = account.currency
  const rows = valuation.rows.map((row) => ({ ...row, accountCurrency: currency }))
  const allocation = ledger.allocation(valuation)
  const diagnosis = ledger.diagnose(valuation, perf)
  const snapshots = ledger.snapshotsOf(account.id)
  const orders = ledger.ordersOf(account.id, 8)

  const contributor = diagnosis.contributor
  const detractor = diagnosis.detractor

  return (
    <PullRefresh scrollRef={scrollRef} refreshing={ctx.refreshing} onRefresh={() => actions.refresh(true)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4 }}>
        {accounts.length > 1 ? (
          <ChipRow padding={0}>
            {accounts.map((row) => (
              <Chip
                key={row.id}
                label={accountLabel(t, row.name)}
                selected={row.id === account.id}
                onClick={() => actions.selectAccount(row.id)}
              />
            ))}
          </ChipRow>
        ) : null}

        {/* 总览 */}
        <div style={{ background: C.surface, borderRadius: RADIUS.card, padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, color: C.muted }}>{t('finance.portfolio.total')}</span>
            <span className="fin-mono" style={{ fontSize: 32, fontWeight: 500 }}>
              {formatMinor(valuation.totalMinor, currency)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: SPACE.s5, flexWrap: 'wrap' }}>
            <Stat
              label={t('finance.portfolio.pnl')}
              value={formatMinor(valuation.totalPnlMinor, currency, { signed: true })}
              color={trendColor(valuation.totalPnlMinor, upIsRed)}
            />
            <Stat
              label={t('finance.portfolio.return')}
              value={formatPercent(valuation.returnRate)}
              color={trendColor(valuation.returnRate, upIsRed)}
            />
            <Stat
              label={t('finance.portfolio.today')}
              value={formatMinor(valuation.dayMinor, currency, { signed: true })}
              color={trendColor(valuation.dayMinor, upIsRed)}
            />
          </div>
          <div style={{ display: 'flex', gap: SPACE.s5, flexWrap: 'wrap' }}>
            <Stat label={t('finance.portfolio.cash')} value={formatMinor(valuation.cashMinor, currency)} />
            <Stat label={t('finance.portfolio.holdings')} value={formatMinor(valuation.marketValueMinor, currency)} />
            <Stat
              label={t('finance.card.realized')}
              value={formatMinor(valuation.realizedMinor, currency, { signed: true })}
              color={trendColor(valuation.realizedMinor, upIsRed)}
            />
          </div>

          {!valuation.isComplete ? (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 3, padding: `${SPACE.s2}px ${SPACE.s3}px`,
              borderRadius: 10, background: 'color-mix(in srgb, var(--fin-warning) 12%, transparent)',
            }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.warning }}>
                <Icon name="exclamationmark.triangle" size={11} />
                {t('finance.valuation.incomplete')}
              </span>
              {valuation.missingQuotes.length > 0 ? (
                <span style={{ fontSize: 12, color: C.muted }}>
                  {t('finance.valuation.missingQuoteList', valuation.missingQuotes.join(', '))}
                </span>
              ) : null}
              {valuation.missingFX.length > 0 ? (
                <span style={{ fontSize: 12, color: C.muted }}>
                  {t('finance.valuation.missingFXList', valuation.missingFX.join(', '))}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* 操作 */}
        <div style={{ display: 'flex', gap: SPACE.s2 }}>
          {[
            { id: 'cash', icon: 'dollarsign.circle', label: t('finance.cashflow.title'), onClick: actions.openCashFlow },
            { id: 'accounts', icon: 'creditcard', label: t('finance.account.manage'), onClick: actions.openAccounts },
            { id: 'history', icon: 'list.bullet', label: t('finance.portfolio.history'), onClick: actions.openHistory },
          ].map((button) => (
            <button
              key={button.id}
              type="button"
              className="fin-btn fin-press"
              onClick={button.onClick}
              style={{
                flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 4px', background: C.surface, borderRadius: RADIUS.field, color: C.brand,
              }}
            >
              <Icon name={button.icon} size={17} weight="semibold" />
              <span style={{ fontSize: 12 }}>{button.label}</span>
            </button>
          ))}
        </div>

        {/* 收益曲线（快照 ≥ 2 才有意义） */}
        {snapshots.length >= 2 ? (
          <Card title={t('finance.portfolio.curve')}>
            <LineChart values={snapshots.map((row) => row.totalValueMinor / 100)} height={140} upIsRed={upIsRed} />
          </Card>
        ) : null}

        {/* 持仓 */}
        <Card title={t('finance.portfolio.positions')}>
          {rows.length === 0 ? (
            <EmptyState text={t('finance.portfolio.noPositions')} padding={24} />
          ) : rows.map((row) => (
            <PositionRow
              key={row.position.id || row.position.instrumentSymbol}
              row={row}
              t={t}
              upIsRed={upIsRed}
              onOpen={actions.openDetail}
            />
          ))}
        </Card>

        {/* 资产配置 */}
        {allocation.length > 0 ? (
          <Card title={t('finance.alloc.title')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s4 }}>
              <DonutChart
                size={110}
                colors={ALLOCATION_COLORS}
                slices={allocation.map((row) => ({ id: row.market, value: row.marketValueMinor }))}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 auto', minWidth: 0 }}>
                {allocation.map((row, index) => (
                  <div key={row.market} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: 2, flex: '0 0 auto',
                      background: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
                    }}
                    />
                    <span style={{ fontSize: 13, color: C.ink, flex: '1 1 auto' }}>{t(`market.${row.market}`)}</span>
                    <span className="fin-mono" style={{ fontSize: 13, color: C.muted }}>
                      {formatPercent(row.ratio * 100, false)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        {/* 绩效 */}
        <Card title={t('finance.perf.title')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: SPACE.s3 }}>
            <Stat label={t('finance.perf.annualized')} value={formatPercent(perf.annualized)} color={trendColor(perf.annualized, upIsRed)} />
            <Stat label={t('finance.perf.maxdd')} value={formatPercent(perf.maxDrawdown, false)} />
            <Stat label={t('finance.perf.sharpe')} value={formatPrice(perf.sharpe, 2)} />
            <Stat label={t('finance.perf.vol')} value={formatPercent(perf.volatility, false)} />
            <Stat label={t('finance.perf.winrate')} value={formatPercent(perf.winRate, false)} />
            <Stat label={t('finance.perf.trades')} value={perf.closed} />
          </div>
          {!perf.hasEnoughData ? (
            <span style={{ display: 'block', fontSize: 12, color: C.muted, marginTop: SPACE.s2, lineHeight: 1.4 }}>
              {t('finance.perf.accruing')}
            </span>
          ) : null}
        </Card>

        {/* 业绩归因 */}
        {(contributor || detractor) ? (
          <Card title={t('finance.attr.title')}>
            {contributor ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: '4px 0' }}>
                <span className="fin-clamp-1" style={{ fontSize: 15, flex: '1 1 auto' }}>{contributor.position.name}</span>
                <span className="fin-mono" style={{ fontSize: 15, color: trendColor(1, upIsRed) }}>
                  {formatPercent(contributor.unrealizedPct)}
                </span>
              </div>
            ) : null}
            {detractor ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: '4px 0' }}>
                <span className="fin-clamp-1" style={{ fontSize: 15, flex: '1 1 auto' }}>{detractor.position.name}</span>
                <span className="fin-mono" style={{ fontSize: 15, color: trendColor(-1, upIsRed) }}>
                  {formatPercent(detractor.unrealizedPct)}
                </span>
              </div>
            ) : null}
          </Card>
        ) : null}

        {/* 组合诊断：**估值不完整时不展示分数** */}
        <Card title={t('finance.diag.title')}>
          {!diagnosis.isComplete ? (
            <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>{t('finance.diag.incomplete')}</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span className="fin-mono" style={{ fontSize: 34, fontWeight: 500, color: C.brand }}>{diagnosis.score}</span>
                <span style={{ fontSize: 13, color: C.muted }}>{t('finance.diag.scoreUnit')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: SPACE.s3 }}>
                <Stat label={t('finance.diag.cash')} value={formatPercent(diagnosis.cashPct, false)} />
                <Stat label={t('finance.diag.hhi')} value={formatPrice(diagnosis.hhi, 2)} />
                <Stat label={t('finance.diag.topweight')} value={formatPercent(diagnosis.topWeight * 100, false)} />
              </div>
              {diagnosis.flags.length === 0 ? (
                <span style={{ fontSize: 13, color: C.muted }}>{t('finance.diag.healthy')}</span>
              ) : diagnosis.flags.map((flag) => (
                <span key={flag} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.warning }}>
                  <Icon name="exclamationmark.triangle" size={12} />
                  {t(`finance.diag.flag.${flag}`)}
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* 最近成交 */}
        {orders.length > 0 ? (
          <Card
            title={t('finance.portfolio.history')}
            trailing={(
              <button type="button" className="fin-btn fin-press" onClick={actions.openHistory} style={{ fontSize: 12, color: C.brand }}>
                {t('finance.history.viewAll')}
              </button>
            )}
          >
            {orders.map((order) => (
              <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: '6px 0' }}>
                <span style={{
                  fontSize: 12, color: C.onAccent, padding: '1px 6px', borderRadius: 4, flex: '0 0 auto',
                  background: (order.sideRaw === 'buy') === upIsRed ? C.red : C.green,
                }}
                >
                  {t(order.sideRaw === 'buy' ? 'finance.trade.buy' : 'finance.trade.sell')}
                </span>
                <span className="fin-clamp-1" style={{ fontSize: 14, flex: '1 1 auto' }}>{order.name}</span>
                <span className="fin-mono" style={{ fontSize: 13, color: C.muted }}>
                  {formatQuantity(order.quantity)} × {formatPrice(order.price, 2)}
                </span>
              </div>
            ))}
          </Card>
        ) : null}

        <span style={{ fontSize: 12, color: C.muted, textAlign: 'center', paddingBottom: SPACE.s4 }}>
          {t('finance.settings.disclaimer')}
        </span>
      </div>
    </PullRefresh>
  )
}
