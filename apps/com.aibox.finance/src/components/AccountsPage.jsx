// 账户管理 / 现金流水 / 交易历史 —— 规格 §9.3 + §10.6 + §12「账户」「历史」段。
//
// 导出走 `aibox.share.file`（宿主没有该能力就整块不渲染入口，不留死按钮）。

import React from 'react'
import Icon from './Icon.js'
import { Card, Field, Row, Segmented, Sheet, SheetHeader, Spinner } from './primitives.js'
import { C, RADIUS, SPACE } from './theme.js'
import { formatMinor, formatPrice, formatQuantity, isoDate } from '../lib/format.js'
import { parseNumberInput, toMinor } from '../lib/money.js'
import { CASH_FLOW_KINDS, isExternalFlow } from '../lib/portfolio.js'
import { accountLabel } from '../i18n/index.js'
import { capabilities, shareFile } from '../lib/host.js'

const CURRENCIES = ['CNY', 'HKD', 'USD']

export function AccountsSheet({ ctx, visible, onClose }) {
  const { t, ledger } = ctx
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState('')
  const [currency, setCurrency] = React.useState('CNY')
  const [initial, setInitial] = React.useState('1000000')
  const [busy, setBusy] = React.useState(false)

  const create = async () => {
    setBusy(true)
    await ledger.createAccount({
      name: name.trim(),
      currency,
      initialCashMinor: toMinor(parseNumberInput(initial) || 0),
    })
    setBusy(false)
    setCreating(false)
    setName('')
  }

  const archived = ledger.accounts.filter((row) => row.isArchived)
  const active = ledger.accounts.filter((row) => !row.isArchived)

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetHeader
        title={t('finance.account.manage')}
        onClose={onClose}
        closeLabel={t('finance.done')}
        trailing={(
          <button
            type="button"
            className="fin-btn fin-press"
            aria-label={t('finance.account.new')}
            onClick={() => setCreating((current) => !current)}
            style={{ color: C.brand }}
          >
            <Icon name="plus" size={17} weight="semibold" />
          </button>
        )}
      />
      <div className="fin-scroll" style={{ padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}>
        {creating ? (
          <Card title={t('finance.account.new')}>
            <Field label={t('finance.account.name')} value={name} onChange={setName} numeric={false} placeholder={t('finance.account.namePlaceholder')} autoFocus />
            <div style={{ padding: '11px 0', display: 'flex', alignItems: 'center', gap: SPACE.s3, borderBottom: `0.5px solid ${C.line}` }}>
              <span style={{ fontSize: 15, flex: '0 0 auto', minWidth: 76 }}>{t('finance.account.currency')}</span>
              <div style={{ flex: '1 1 auto' }}>
                <Segmented value={currency} onChange={setCurrency} items={CURRENCIES.map((id) => ({ id, label: id }))} />
              </div>
            </div>
            <Field label={t('finance.account.initialCash')} value={initial} onChange={setInitial} suffix={currency} />
            <button
              type="button"
              className="fin-btn fin-press"
              disabled={busy}
              onClick={create}
              style={{
                marginTop: SPACE.s3, width: '100%', textAlign: 'center', padding: '11px 0',
                borderRadius: RADIUS.field, background: C.brand, color: C.onAccent, fontSize: 15, fontWeight: 600,
              }}
            >
              {busy ? <Spinner size={16} color={C.onAccent} /> : t('finance.save')}
            </button>
          </Card>
        ) : null}

        <Card>
          {active.map((row, index) => (
            <AccountRow key={row.id} ctx={ctx} account={row} last={index === active.length - 1} />
          ))}
        </Card>

        {archived.length > 0 ? (
          <Card title={t('finance.account.archived')}>
            {archived.map((row, index) => (
              <Row
                key={row.id}
                title={accountLabel(t, row.name)}
                subtitle={row.currency}
                last={index === archived.length - 1}
                accessory={(
                  <button
                    type="button"
                    className="fin-btn fin-press"
                    onClick={() => ledger.updateAccount(row.id, { isArchived: false })}
                    style={{ color: C.brand, fontSize: 13 }}
                  >
                    {t('finance.account.unarchive')}
                  </button>
                )}
              />
            ))}
          </Card>
        ) : null}
      </div>
    </Sheet>
  )
}

function AccountRow({ ctx, account, last }) {
  const { t, ledger } = ctx
  const [open, setOpen] = React.useState(false)
  const canShare = capabilities.share

  const exportArchive = async () => {
    const archive = ledger.archiveFor(account.id)
    if (!archive) return
    await shareFile({
      filename: `${account.name}-finance-backup.json`,
      content: JSON.stringify(archive, null, 2),
      mimeType: 'application/json',
    })
  }

  return (
    <>
      <Row
        title={accountLabel(t, account.name)}
        subtitle={`${account.currency}${account.isRealCopy ? ` · ${t('finance.account.realCopy')}` : ''}`}
        detail={formatMinor(account.cashMinor, account.currency)}
        onClick={() => setOpen((current) => !current)}
        accessory={<Icon name={open ? 'chevron.down' : 'chevron.right'} size={13} color={C.muted} />}
        last={last && !open}
      />
      {open ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.s2, padding: `${SPACE.s2}px 0 ${SPACE.s3}px` }}>
          {[
            { id: 'reset', label: t('finance.account.reset'), onClick: () => ledger.resetAccount(account.id) },
            { id: 'archive', label: t('finance.account.archive'), onClick: () => ledger.updateAccount(account.id, { isArchived: true }) },
            { id: 'copy', label: t('finance.account.copy'), onClick: () => ledger.copyAccount(account.id) },
            ...(canShare ? [{ id: 'export', label: t('finance.history.export'), onClick: exportArchive }] : []),
            { id: 'delete', label: t('finance.delete'), danger: true, onClick: () => ledger.deleteAccount(account.id) },
          ].map((button) => (
            <button
              key={button.id}
              type="button"
              className="fin-btn fin-press"
              onClick={button.onClick}
              style={{
                padding: '6px 11px', borderRadius: RADIUS.pill, fontSize: 12,
                color: button.danger ? C.danger : C.brand,
                background: 'color-mix(in srgb, var(--fin-muted) 10%, transparent)',
              }}
            >
              {button.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}

/** 现金流水（§10.6）：入金/出金改本金但不计入盈亏；分红/利息/税费计入。 */
export function CashFlowSheet({ ctx, visible, onClose }) {
  const { t, ledger, accountID } = ctx
  const [kind, setKind] = React.useState('deposit')
  const [amount, setAmount] = React.useState('')
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState(null)

  const account = ledger.accountByID(accountID)
  const value = parseNumberInput(amount)
  const canSubmit = account && Number.isFinite(value) && value > 0

  const submit = async () => {
    if (!canSubmit) return
    const result = await ledger.addCashFlow({
      accountID: account.id, kind, amountMinor: toMinor(value), note, source: 'manual',
    })
    if (result.ok) { setAmount(''); setNote(''); setError(null) } else setError(result.error)
  }

  const flows = account ? ledger.cashFlowsOf(account.id, 10) : []

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetHeader title={t('finance.cashflow.title')} onClose={onClose} closeLabel={t('finance.done')} />
      <div className="fin-scroll" style={{ padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.s2 }}>
          {CASH_FLOW_KINDS.map((id) => (
            <button
              key={id}
              type="button"
              className="fin-btn fin-press"
              onClick={() => setKind(id)}
              style={{
                padding: '6px 11px', borderRadius: RADIUS.pill, fontSize: 12,
                color: kind === id ? C.brand : C.muted,
                background: kind === id ? 'color-mix(in srgb, var(--fin-brand) 12%, transparent)' : C.surface,
              }}
            >
              {t(`finance.cashflow.${id}`)}
            </button>
          ))}
        </div>
        <div style={{ background: C.surface, borderRadius: RADIUS.card, padding: `0 ${SPACE.s3}px` }}>
          <Field label={t('finance.cashflow.amount')} value={amount} onChange={setAmount} placeholder="0" suffix={account ? account.currency : ''} />
          <Field label={t('finance.cashflow.note')} value={note} onChange={setNote} numeric={false} placeholder="" />
        </div>
        <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>
          {t(isExternalFlow(kind) ? 'finance.cashflow.externalFoot' : 'finance.cashflow.internalFoot')}
        </span>
        {error ? <span style={{ fontSize: 13, color: C.danger }}>{t(`finance.trade.error.${error}`)}</span> : null}
        <button
          type="button"
          className="fin-btn fin-press"
          disabled={!canSubmit}
          onClick={submit}
          style={{
            textAlign: 'center', padding: '12px 0', borderRadius: RADIUS.field, fontSize: 16, fontWeight: 600,
            color: C.onAccent, background: C.brand, opacity: canSubmit ? 1 : 0.4,
          }}
        >
          {t('finance.save')}
        </button>

        {flows.length > 0 ? (
          <Card title={t('finance.cashflow.history')}>
            {flows.map((flow, index) => (
              <Row
                key={flow.id}
                title={t(`finance.cashflow.${flow.kindRaw}`)}
                subtitle={`${isoDate(flow.occurredAt)}${flow.note ? ` · ${flow.note}` : ''}`}
                detail={formatMinor(flow.amountMinor, flow.currency, { signed: true })}
                detailColor={flow.amountMinor < 0 ? C.danger : C.ink}
                last={index === flows.length - 1}
              />
            ))}
          </Card>
        ) : null}
      </div>
    </Sheet>
  )
}

/** 交易历史（全量流水）。 */
export function HistorySheet({ ctx, visible, onClose }) {
  const { t, ledger, accountID, settings } = ctx
  const [filter, setFilter] = React.useState('all')
  const account = ledger.accountByID(accountID)
  const rows = account
    ? ledger.ordersOf(account.id, 200).filter((row) => filter === 'all' || row.sideRaw === filter)
    : []

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetHeader title={t('finance.portfolio.history')} onClose={onClose} closeLabel={t('finance.done')} />
      <div style={{ padding: `0 ${SPACE.s4}px ${SPACE.s2}px` }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          items={[
            { id: 'all', label: t('finance.history.all') },
            { id: 'buy', label: t('finance.trade.buy') },
            { id: 'sell', label: t('finance.trade.sell') },
          ]}
        />
      </div>
      <div className="fin-scroll" style={{ padding: `0 ${SPACE.s4}px ${SPACE.s6}px` }}>
        {rows.length === 0 ? (
          <span style={{ display: 'block', padding: '40px 0', fontSize: 15, color: C.muted, textAlign: 'center' }}>
            {t('finance.history.empty')}
          </span>
        ) : rows.map((order) => (
          <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: '9px 0', borderBottom: `0.5px solid ${C.line}` }}>
            <span style={{
              fontSize: 12, color: C.onAccent, padding: '1px 6px', borderRadius: 4, flex: '0 0 auto',
              background: (order.sideRaw === 'buy') === settings.upIsRed ? C.red : C.green,
            }}
            >
              {t(order.sideRaw === 'buy' ? 'finance.trade.buy' : 'finance.trade.sell')}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto', minWidth: 0 }}>
              <span className="fin-clamp-1" style={{ fontSize: 14 }}>{order.name}</span>
              <span className="fin-mono" style={{ fontSize: 12, color: C.muted }}>{isoDate(order.tradedAt)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span className="fin-mono" style={{ fontSize: 14 }}>
                {formatQuantity(order.quantity)} × {formatPrice(order.price, 2)}
              </span>
              <span className="fin-mono" style={{ fontSize: 12, color: C.muted }}>
                {formatMinor(order.grossMinor, order.currency)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
