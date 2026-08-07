// 交易面板 —— 规格 §10.1 / §10.2 的输入面。
//
// 跨币种时**必须显示成交汇率与折算金额**：这是「为什么扣了这么多钱」的唯一解释。
// 拿不到汇率就**不允许下单**（绝不用 1 兜底），按钮禁用并说明缺汇率。

import React from 'react'
import { Field, Segmented, Sheet, SheetHeader, Stat } from './primitives.js'
import { C, RADIUS, SPACE } from './theme.js'
import { formatMinor, formatPrice } from '../lib/format.js'
import { grossMinorOf, parseNumberInput, roundHalfAway, toMinor } from '../lib/money.js'
import { currencyOf, decimalsFor } from '../lib/symbol.js'
import { accountLabel } from '../i18n/index.js'
import type { FinanceContext, InstrumentPanelRoute, TradeSide } from '../lib/types.js'

export default function TradePanel({
  ctx,
  route,
  visible,
  onClose,
}: {
  ctx: FinanceContext
  route: InstrumentPanelRoute | null
  visible: boolean
  onClose: () => void
}) {
  const { t, ledger, quotes, settings } = ctx
  const { canonical, symbol, name } = route || {}
  const [side, setSide] = React.useState<TradeSide>('buy')
  const [accountID, setAccountID] = React.useState<string | null>(null)
  const [qty, setQty] = React.useState('')
  const [price, setPrice] = React.useState('')
  const [fee, setFee] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const quote = canonical ? quotes.quote(canonical) : null
  const accounts = ledger.accounts.filter((row) => !row.isArchived)
  const account = ledger.accountByID(accountID) || accounts[0] || null
  const instrumentCurrency = symbol ? currencyOf(symbol) : 'CNY'
  const decimals = symbol ? decimalsFor(symbol.market) : 2

  // 价格默认取现价。
  React.useEffect(() => {
    if (!visible) return
    setSide('buy')
    setError(null)
    setQty('')
    setFee('')
    setPrice(quote ? String(formatPrice(quote.price, decimals)) : '')
    setAccountID((current) => current || (accounts[0] ? accounts[0].id : null))
  }, [visible, canonical]) // eslint-disable-line react-hooks/exhaustive-deps

  const rate = account ? ledger.fxRateFor(instrumentCurrency, account.currency, quotes.fx) : null
  const quantity = parseNumberInput(qty)
  const unitPrice = parseNumberInput(price)
  const feeMinor = Math.max(0, toMinor(parseNumberInput(fee) || 0))

  let grossMinor = null
  let settledMinor = null
  let cashAfter = null
  if (quantity !== null && unitPrice !== null && quantity > 0 && unitPrice > 0 && rate && account) {
    try {
      grossMinor = grossMinorOf(quantity, unitPrice)
      settledMinor = roundHalfAway(grossMinor * rate)
      cashAfter =
        side === 'buy' ? account.cashMinor - settledMinor - feeMinor : account.cashMinor + settledMinor - feeMinor
    } catch (caught) {
      grossMinor = null
    }
  }

  const position = account
    ? ledger.positions.find((row) => row.accountID === account.id && row.instrumentSymbol === canonical)
    : null
  const canSubmit =
    !!account &&
    !!rate &&
    quantity !== null &&
    unitPrice !== null &&
    quantity > 0 &&
    unitPrice > 0 &&
    !busy &&
    (side === 'buy' ? cashAfter !== null && cashAfter >= 0 : position && position.quantity >= quantity - 1e-9)

  const submit = async () => {
    if (!canSubmit || !account || !rate || !symbol || !canonical || quantity === null || unitPrice === null) return
    setBusy(true)
    setError(null)
    const payload = {
      accountID: account.id,
      symbol: canonical,
      name,
      market: symbol.market,
      currency: instrumentCurrency,
      quantity,
      price: unitPrice,
      fxRate: rate,
      feeMinor,
      source: 'manual',
    }
    const result = side === 'buy' ? await ledger.buy(payload) : await ledger.sell(payload)
    setBusy(false)
    if (result.ok) {
      onClose()
      return
    }
    setError(result.error ?? 'unknown')
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetHeader title={name || ''} onClose={onClose} closeLabel={t('finance.cancel')} />
      <div
        className="fin-scroll"
        style={{ padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}
      >
        <Segmented
          value={side}
          onChange={(next) => {
            setSide(next)
            setError(null)
          }}
          items={[
            { id: 'buy', label: t('finance.trade.buy') },
            { id: 'sell', label: t('finance.trade.sell') },
          ]}
        />

        {accounts.length > 1 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.s2 }}>
            {accounts.map((row) => (
              <button
                key={row.id}
                type="button"
                className="fin-btn fin-press"
                onClick={() => setAccountID(row.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: RADIUS.pill,
                  fontSize: 12,
                  color: row.id === account?.id ? C.brand : C.muted,
                  background:
                    row.id === account?.id ? 'color-mix(in srgb, var(--fin-brand) 12%, transparent)' : C.surface,
                }}
              >
                {accountLabel(t, row.name)}
              </button>
            ))}
          </div>
        ) : null}

        <div style={{ background: C.surface, borderRadius: RADIUS.card, padding: `0 ${SPACE.s3}px` }}>
          <Field label={t('finance.trade.qty')} value={qty} onChange={setQty} placeholder="0" autoFocus />
          <Field
            label={t('finance.trade.price')}
            value={price}
            onChange={setPrice}
            placeholder="0"
            suffix={instrumentCurrency}
          />
          <Field
            label={t('finance.trade.fee')}
            value={fee}
            onChange={setFee}
            placeholder="0"
            suffix={account ? account.currency : ''}
          />
        </div>

        {account ? (
          <div
            style={{
              background: C.surface,
              borderRadius: RADIUS.card,
              padding: SPACE.s3,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.s3,
            }}
          >
            {instrumentCurrency !== account.currency ? (
              <div style={{ display: 'flex', gap: SPACE.s5, flexWrap: 'wrap' }}>
                <Stat label={t('finance.trade.settleCcy')} value={account.currency} />
                <Stat label={t('finance.trade.fxRate')} value={rate ? formatPrice(rate, 4) : '—'} />
                <Stat
                  label={t('finance.trade.settledAmount')}
                  value={settledMinor !== null ? formatMinor(settledMinor, account.currency) : '—'}
                />
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: SPACE.s5, flexWrap: 'wrap' }}>
              <Stat
                label={t(side === 'buy' ? 'finance.trade.cost' : 'finance.trade.proceeds')}
                value={
                  settledMinor !== null
                    ? formatMinor(side === 'buy' ? settledMinor + feeMinor : settledMinor - feeMinor, account.currency)
                    : '—'
                }
              />
              <Stat label={t('finance.trade.cash')} value={formatMinor(account.cashMinor, account.currency)} />
              <Stat
                label={t('finance.trade.cashAfter')}
                value={cashAfter !== null ? formatMinor(cashAfter, account.currency) : '—'}
                color={cashAfter !== null && cashAfter < 0 ? C.danger : undefined}
              />
            </div>
            {side === 'sell' && position ? (
              <span style={{ fontSize: 12, color: C.muted }}>
                {t('finance.portfolio.positions')} {position.quantity}
              </span>
            ) : null}
          </div>
        ) : null}

        {!rate ? <span style={{ fontSize: 13, color: C.warning }}>{t('finance.trade.error.invalidRate')}</span> : null}
        {error ? <span style={{ fontSize: 13, color: C.danger }}>{t(`finance.trade.error.${error}`)}</span> : null}

        <button
          type="button"
          className="fin-btn fin-press"
          disabled={!canSubmit}
          onClick={submit}
          style={{
            textAlign: 'center',
            padding: '13px 0',
            borderRadius: RADIUS.field,
            fontSize: 16,
            fontWeight: 600,
            color: C.onAccent,
            opacity: canSubmit ? 1 : 0.4,
            background: (side === 'buy') === settings.upIsRed ? C.red : C.green,
          }}
        >
          {t('finance.trade.confirm')}
        </button>
        <span style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>{t('finance.settings.disclaimer')}</span>
      </div>
    </Sheet>
  )
}
