// 策略页（回测 / 定投）—— 规格 §10.11 / §10.12。
// 曲线降采样到 ≤ ~60 点；定投多一条 muted 虚线基准（累计投入）。
// 免责声明常驻：历史模拟不代表未来收益。

import React from 'react'
import { LineChart } from './Chart.js'
import { Card, Field, Segmented, Sheet, SheetHeader, Spinner, Stat } from './primitives.js'
import { C, RADIUS, SPACE } from './theme.js'
import { formatPercent, formatPrice } from '../lib/format.js'
import { parseNumberInput } from '../lib/money.js'
import { backtest, dcaPlan } from '../lib/strategy.js'

const HORIZONS = [
  { id: '6m', count: 130 },
  { id: '1y', count: 250 },
  { id: '2y', count: 500 },
]

export default function StrategyPage({ ctx, route, visible, onClose }) {
  const { t, quotes, settings } = ctx
  const { symbol, name } = route || {}
  const [tab, setTab] = React.useState('backtest')
  const [horizon, setHorizon] = React.useState('1y')
  const [strategy, setStrategy] = React.useState('buyhold')
  const [frequency, setFrequency] = React.useState('monthly')
  const [amount, setAmount] = React.useState('1000')
  const [candles, setCandles] = React.useState([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!visible || !symbol) return undefined
    let cancelled = false
    setLoading(true)
    // 策略页取 750 根日线，本地按 horizon 截取——换档不必重新请求。
    quotes.candles(symbol, 'day', 'qfq', 750, { force: false }).then((rows) => {
      if (cancelled) return
      setCandles(rows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [visible, symbol, quotes])

  const count = (HORIZONS.find((row) => row.id === horizon) || HORIZONS[1]).count
  const window = candles.slice(-count)
  const result = tab === 'backtest'
    ? backtest(window, strategy)
    : dcaPlan(window, { amount: parseNumberInput(amount) || 0, frequency })

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetHeader title={`${name || ''} · ${t('finance.strat.title')}`} onClose={onClose} closeLabel={t('finance.done')} />
      <div className="fin-scroll" style={{ padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          items={[
            { id: 'backtest', label: t('finance.strat.tab.backtest') },
            { id: 'plan', label: t('finance.strat.tab.plan') },
          ]}
        />
        <Segmented
          value={horizon}
          onChange={setHorizon}
          items={HORIZONS.map((row) => ({ id: row.id, label: t(`finance.strat.horizon.${row.id}`) }))}
        />

        {tab === 'backtest' ? (
          <Segmented
            value={strategy}
            onChange={setStrategy}
            items={[
              { id: 'buyhold', label: t('finance.strat.strategy.buyhold') },
              { id: 'macross', label: t('finance.strat.strategy.macross') },
            ]}
          />
        ) : (
          <>
            <Segmented
              value={frequency}
              onChange={setFrequency}
              items={[
                { id: 'monthly', label: t('finance.strat.freq.monthly') },
                { id: 'weekly', label: t('finance.strat.freq.weekly') },
              ]}
            />
            <div style={{ background: C.surface, borderRadius: RADIUS.card, padding: `0 ${SPACE.s3}px` }}>
              <Field label={t('finance.strat.amount')} value={amount} onChange={setAmount} placeholder="1000" />
            </div>
          </>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spinner size={20} color={C.muted} />
          </div>
        ) : !result ? (
          <span style={{ fontSize: 15, color: C.muted, textAlign: 'center', padding: '32px 0' }}>
            {t('finance.strat.empty')}
          </span>
        ) : (
          <>
            <Card>
              <LineChart
                height={130}
                upIsRed={settings.upIsRed}
                values={result.curve.map((row) => row.value)}
                baseline={tab === 'plan' ? result.curve.map((row) => row.base) : undefined}
              />
            </Card>
            <Card>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: SPACE.s3 }}>
                {tab === 'backtest' ? (
                  <>
                    <Stat label={t('finance.strat.m.return')} value={formatPercent(result.totalReturn)} />
                    <Stat label={t('finance.strat.m.buyhold')} value={formatPercent(result.buyHoldReturn)} />
                    <Stat label={t('finance.perf.annualized')} value={formatPercent(result.annualized)} />
                    <Stat label={t('finance.strat.m.maxdd')} value={formatPercent(result.maxDrawdown, false)} />
                    <Stat label={t('finance.perf.sharpe')} value={formatPrice(result.sharpe, 2)} />
                    <Stat label={t('finance.strat.m.trades')} value={result.trades} />
                    <Stat label={t('finance.strat.m.winrate')} value={formatPercent(result.winRate, false)} />
                    <Stat label={t('finance.perf.vol')} value={formatPercent(result.volatility, false)} />
                  </>
                ) : (
                  <>
                    <Stat label={t('finance.strat.m.invested')} value={formatPrice(result.invested, 0)} />
                    <Stat label={t('finance.strat.m.value')} value={formatPrice(result.finalValue, 2)} />
                    <Stat label={t('finance.strat.m.return')} value={formatPercent(result.totalReturn)} />
                    <Stat label={t('finance.strat.m.avgcost')} value={formatPrice(result.avgCost, 2)} />
                    <Stat label={t('finance.strat.m.lumpsum')} value={formatPercent(result.lumpSumReturn)} />
                    <Stat label={t('finance.perf.annualized')} value={formatPercent(result.annualized)} />
                  </>
                )}
              </div>
            </Card>
          </>
        )}

        <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, textAlign: 'center' }}>
          {t('finance.strat.disclaimer')}
        </span>
      </div>
    </Sheet>
  )
}
