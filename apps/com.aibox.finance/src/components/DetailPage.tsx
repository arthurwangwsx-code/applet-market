// 详情页 —— 规格 §3。
//
// 与自选行相反，这里的**现价按涨跌着色**（38pt medium）。行情时间是 **Provider 原始串直出**
// （腾讯 A 股是 `20260803150001` 这种），刻意不格式化——它是「这份数据到底多新」的唯一证据。

import React from 'react'
import Icon from './Icon.js'
import FundamentalsView from './FundamentalsView.js'
import { AreaLineChart, SubChart } from './Chart.js'
import { Card, Menu, PullRefresh, Spinner, Stat } from './primitives.js'
import { C, RADIUS, SPACE } from './theme.js'
import {
  formatChange,
  formatCompact,
  formatCompactCurrency,
  formatPercent,
  formatPrice,
  toLots,
  trendColor,
} from '../lib/format.js'
import { boll, kdj, macd, sma } from '../lib/indicators.js'
import { decimalsFor } from '../lib/symbol.js'
import type { Candle, CandlePeriod, DetailRoute, FinanceContext, PriceLevel, Quote, Translate } from '../lib/types.js'

const PERIODS: CandlePeriod[] = ['5m', '15m', '30m', '60m', 'day', 'week', 'month']
type Indicator = 'MA' | 'BOLL' | 'MACD' | 'KDJ' | 'VOL'
const INDICATORS: Indicator[] = ['MA', 'BOLL', 'MACD', 'KDJ', 'VOL']
const CANDLE_COUNT = 160

function periodLabel(t: Translate, period: CandlePeriod): string {
  // 分钟档**原样英文，不本地化**（与原生一致）。
  if (period === 'day' || period === 'week' || period === 'month') return t(`finance.period.${period}`)
  return period
}

/** 主图叠加线（MA / BOLL）。暖机期是 null，Chart 会自动断开不画点。 */
function overlaysFor(indicator: Indicator, closes: number[]) {
  if (indicator === 'MA') {
    return [
      { id: 'ma5', values: sma(closes, 5), color: C.amber },
      { id: 'ma20', values: sma(closes, 20), color: C.blue },
    ]
  }
  if (indicator === 'BOLL') {
    const bands = boll(closes, 20, 2)
    return [
      { id: 'mid', values: bands.mid, color: C.muted },
      { id: 'upper', values: bands.upper, color: C.amber },
      { id: 'lower', values: bands.lower, color: C.blue },
    ]
  }
  return []
}

function SubIndicator({ indicator, candles, upIsRed }: { indicator: Indicator; candles: Candle[]; upIsRed: boolean }) {
  const closes = candles.map((row) => row.close)
  if (indicator === 'MACD') {
    const result = macd(closes)
    return (
      <SubChart
        bars={result.hist}
        upIsRed={upIsRed}
        lines={[
          { id: 'dif', values: result.dif, color: C.amber },
          { id: 'dea', values: result.dea, color: C.blue },
        ]}
      />
    )
  }
  if (indicator === 'KDJ') {
    const result = kdj(candles)
    return (
      <SubChart
        lines={[
          { id: 'k', values: result.k, color: C.amber },
          { id: 'd', values: result.d, color: C.blue },
          { id: 'j', values: result.j, color: C.brand },
        ]}
      />
    )
  }
  if (indicator === 'VOL') {
    return (
      <SubChart
        bars={candles.map((row) => row.volume)}
        barColors={candles.map((row) => (row.close >= row.open === upIsRed ? C.red : C.green))}
      />
    )
  }
  return null
}

/** 五档：先卖五→卖一（asks 取前 5 后 reverse），再买一→买五。量 = 原始量 ÷ 100（手）。 */
function OrderBook({
  quote,
  t,
  upIsRed,
  decimals,
}: {
  quote: Quote
  t: Translate
  upIsRed: boolean
  decimals: number
}) {
  const asks = (quote.asks ?? []).slice(0, 5).reverse()
  const bids = (quote.bids ?? []).slice(0, 5)
  const line = (row: PriceLevel, kind: 'ask' | 'bid', index: number) => (
    <div key={`${kind}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: C.muted, flex: '0 0 auto' }}>
        {t(kind === 'ask' ? 'finance.book.ask' : 'finance.book.bid')}
      </span>
      <span style={{ flex: '1 1 auto' }} />
      <span className="fin-mono" style={{ fontSize: 15, color: (kind === 'ask') === upIsRed ? C.green : C.red }}>
        {formatPrice(row.price, decimals)}
      </span>
      <span
        className="fin-mono"
        style={{ fontSize: 12, color: C.muted, width: 70, textAlign: 'right', flex: '0 0 auto' }}
      >
        {toLots(row.volume)}
      </span>
    </div>
  )
  return (
    <Card title={t('finance.orderbook')}>
      {asks.map((row, index) => line(row, 'ask', index))}
      {bids.map((row, index) => line(row, 'bid', index))}
    </Card>
  )
}

export default function DetailPage({ ctx, route }: { ctx: FinanceContext; route: DetailRoute }) {
  const { t, quotes, settings, store, actions } = ctx
  const { canonical, symbol } = route
  const decimals = decimalsFor(symbol.market)
  const upIsRed = settings.upIsRed

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [period, setPeriod] = React.useState<CandlePeriod>('day')
  const [adjust, setAdjust] = React.useState<'qfq' | 'hfq'>('qfq')
  const [indicator, setIndicator] = React.useState<Indicator>('MA')
  const [candles, setCandles] = React.useState<Candle[]>([])
  const [chartLoading, setChartLoading] = React.useState(true)
  const [quoteFailed, setQuoteFailed] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)

  const quote = quotes.quote(canonical)
  const isMinute = period !== 'day' && period !== 'week' && period !== 'month'
  // 复权菜单**只在「非分钟级 且 非基金」时出现**。
  const showsAdjust = !isMinute && symbol.market !== 'fund'

  // 进页：先用缓存秒显（避免价格闪 0），再拉行情。
  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      const result = await quotes.refresh([canonical], { force: false })
      if (cancelled) return
      setQuoteFailed(result.failed)
      const fresh = result.quotes[canonical]
      if (fresh) store.noteInstrument(canonical, fresh)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [canonical, quotes, store])

  // K 线：拿到空结果时**保留上一份 candles**（不清空图）。
  React.useEffect(() => {
    let cancelled = false
    setChartLoading(true)
    const run = async () => {
      const rows = await quotes.candles(symbol, period, adjust, CANDLE_COUNT, { force: false })
      if (cancelled) return
      if (rows.length > 0) setCandles(rows)
      setChartLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [symbol, period, adjust, quotes])

  const refresh = React.useCallback(async () => {
    setRefreshing(true)
    const [result, rows] = await Promise.all([
      quotes.refresh([canonical], { force: true }),
      quotes.candles(symbol, period, adjust, CANDLE_COUNT, { force: true }),
    ])
    setQuoteFailed(result.failed)
    if (rows.length > 0) setCandles(rows)
    setRefreshing(false)
  }, [canonical, symbol, period, adjust, quotes])

  const closes = candles.map((row) => row.close)
  const name = (quote && quote.name) || store.instrumentName(canonical)
  const watched = store.isWatched(canonical)
  const hasSub = indicator === 'MACD' || indicator === 'KDJ' || indicator === 'VOL'

  const stats = [
    { key: 'open', label: t('finance.stat.open'), value: quote ? formatPrice(quote.open, decimals) : '—' },
    { key: 'high', label: t('finance.stat.high'), value: quote ? formatPrice(quote.high, decimals) : '—' },
    { key: 'low', label: t('finance.stat.low'), value: quote ? formatPrice(quote.low, decimals) : '—' },
    {
      key: 'prevClose',
      label: t('finance.stat.prevClose'),
      value: quote ? formatPrice(quote.prevClose, decimals) : '—',
    },
  ]
  if (quote) {
    // 条件格：数据存在才渲染（不要一排「—」占位）。
    if (quote.amount)
      stats.push({
        key: 'amount',
        label: t('finance.stat.amount'),
        value: formatCompactCurrency(quote.amount, quote.currency),
      })
    if (quote.turnover)
      stats.push({ key: 'turnover', label: t('finance.stat.turnover'), value: formatPercent(quote.turnover, false) })
    if ((quote.pe ?? 0) > 0) stats.push({ key: 'pe', label: t('finance.stat.pe'), value: formatPrice(quote.pe, 2) })
    if ((quote.pb ?? 0) > 0) stats.push({ key: 'pb', label: t('finance.stat.pb'), value: formatPrice(quote.pb, 2) })
    // 总市值原始单位是「亿」。
    if ((quote.marketCap ?? 0) > 0)
      stats.push({ key: 'mktcap', label: t('finance.stat.mktcap'), value: formatCompact((quote.marketCap ?? 0) * 1e8) })
    if (quote.amplitude)
      stats.push({ key: 'amplitude', label: t('finance.stat.amplitude'), value: formatPercent(quote.amplitude, false) })
  }

  // 提醒入口住在这一排，不住顶栏：详情页改由**宿主**画顶栏（原生子页栈接管返回），
  // 自绘顶栏只在没有宿主顶栏的形态下出现，把入口挂在那儿等于「有时有、有时没有」。
  const actionButtons: Array<{ id: string; icon: string; label: string; disabled?: boolean; onClick: () => unknown }> =
    [
      {
        id: 'watch',
        icon: watched ? 'star.fill' : 'star',
        label: t(watched ? 'finance.action.watching' : 'finance.action.watch'),
        onClick: () => actions.toggleWatch(canonical, name),
      },
      {
        id: 'alert',
        icon: 'bell',
        label: t('finance.alert.title'),
        onClick: () => actions.openAlert(canonical, symbol, name),
      },
      {
        id: 'trade',
        icon: 'arrow.left.arrow.right',
        label: t('finance.action.trade'),
        disabled: !quote,
        onClick: () => actions.openTrade(canonical, symbol, name),
      },
      {
        id: 'strategy',
        icon: 'function',
        label: t('finance.action.strategy'),
        onClick: () => actions.openStrategy(canonical, symbol, name),
      },
    ]
  if (ctx.hasAI) {
    actionButtons.push({
      id: 'ai',
      icon: 'sparkles',
      label: t('finance.action.ai'),
      onClick: () => actions.askAboutSymbol(canonical, name, quote),
    })
  }

  return (
    <PullRefresh scrollRef={scrollRef} refreshing={refreshing} onRefresh={refresh}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4 }}>
        {/* 头部 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.s2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22, fontWeight: 500 }}>{name}</span>
            <span className="fin-mono" style={{ fontSize: 13, color: C.muted }}>
              {canonical}
            </span>
            {quote && quote.isEstimate ? (
              <span
                style={{
                  fontSize: 12,
                  color: C.muted,
                  padding: '1px 6px',
                  borderRadius: RADIUS.pill,
                  background: 'color-mix(in srgb, var(--fin-muted) 12%, transparent)',
                }}
              >
                {t('finance.estimate')}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              className="fin-mono"
              style={{
                fontSize: 38,
                fontWeight: 500,
                color: quote ? trendColor(quote.changePct, upIsRed) : C.ink,
                lineHeight: 1.05,
              }}
            >
              {quote ? formatPrice(quote.price, decimals) : '—'}
            </span>
            {quote ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="fin-mono" style={{ fontSize: 15, color: trendColor(quote.changePct, upIsRed) }}>
                  {formatChange(quote.change, decimals)}
                </span>
                <span className="fin-mono" style={{ fontSize: 15, color: trendColor(quote.changePct, upIsRed) }}>
                  {formatPercent(quote.changePct)}
                </span>
              </div>
            ) : null}
          </div>
          {quote && quote.time ? (
            <span className="fin-mono" style={{ fontSize: 12, color: C.muted }}>
              {quote.time}
            </span>
          ) : null}
          {quoteFailed ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.muted }}>
              <Icon name="wifi.exclamationmark" size={11} />
              {t('finance.quote.stale')}
            </span>
          ) : null}
        </div>

        {/* 周期 / 复权 / 指标 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s4, flexWrap: 'wrap' }}>
          <Menu
            icon="clock"
            label={periodLabel(t, period)}
            value={period}
            items={PERIODS.map((id) => ({ id, label: periodLabel(t, id) }))}
            onSelect={setPeriod}
          />
          {showsAdjust ? (
            <Menu
              icon="arrow.triangle.2.circlepath"
              label={t(`finance.chart.${adjust}`)}
              value={adjust}
              items={[
                { id: 'qfq', label: t('finance.chart.qfq') },
                { id: 'hfq', label: t('finance.chart.hfq') },
              ]}
              onSelect={setAdjust}
            />
          ) : null}
          <Menu
            icon="function"
            label={indicator}
            value={indicator}
            items={INDICATORS.map((id) => ({ id, label: id }))}
            onSelect={setIndicator}
          />
        </div>

        {/* 图表 */}
        {candles.length > 1 ? (
          <div>
            <AreaLineChart values={closes} overlays={overlaysFor(indicator, closes)} height={200} upIsRed={upIsRed} />
            {hasSub ? (
              <div style={{ marginTop: SPACE.s2 }}>
                <SubIndicator indicator={indicator} candles={candles} upIsRed={upIsRed} />
              </div>
            ) : null}
          </div>
        ) : chartLoading ? (
          <div
            style={{
              height: 200,
              background: C.surface,
              borderRadius: RADIUS.card,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spinner size={22} color={C.muted} />
          </div>
        ) : (
          <div
            style={{
              height: 200,
              background: C.surface,
              borderRadius: RADIUS.card,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon name="chart.line.downtrend.xyaxis" size={28} color={C.muted} />
            <span style={{ fontSize: 15, color: C.muted }}>{t('finance.chart.unavailable')}</span>
            <button
              type="button"
              className="fin-btn fin-press"
              onClick={refresh}
              style={{ color: C.brand, fontSize: 15 }}
            >
              {t('finance.retry')}
            </button>
          </div>
        )}

        {/* 操作行（4 个等宽按钮，brand 前景色） */}
        <div style={{ display: 'flex', gap: SPACE.s2 }}>
          {actionButtons.map((button) => (
            <button
              key={button.id}
              type="button"
              className="fin-btn fin-press"
              disabled={button.disabled}
              onClick={button.onClick}
              style={{
                flex: '1 1 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 4px',
                background: C.surface,
                borderRadius: RADIUS.field,
                color: C.brand,
                opacity: button.disabled ? 0.4 : 1,
              }}
            >
              <Icon name={button.icon} size={17} weight="semibold" />
              <span style={{ fontSize: 12 }}>{button.label}</span>
            </button>
          ))}
        </div>

        {/* 指标网格：3 列 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: SPACE.s3 }}>
          {stats.map((row) => (
            <Stat key={row.key} label={row.label} value={row.value} />
          ))}
        </div>

        {/* 五档盘口（仅 A 股有 bids/asks 时） */}
        {quote && (quote.bids?.length ?? 0) > 0 && (quote.asks?.length ?? 0) > 0 ? (
          <OrderBook quote={quote} t={t} upIsRed={upIsRed} decimals={decimals} />
        ) : null}

        {/* 基本面（**仅 A 股**渲染） */}
        <FundamentalsView ctx={ctx} symbol={symbol} />
      </div>
    </PullRefresh>
  )
}
