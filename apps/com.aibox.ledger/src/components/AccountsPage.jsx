// 资产页（LedgerAccountsView）+ 账户详情（LedgerAccountDetailView）。
// 整页共用**一份**余额快照，净资产卡与每行都从它派生。

import React from 'react'
import Icon, { IconBadge } from './Icon.js'
import { Card, Divider, EmptyState, SectionHeader, useLongPress } from './primitives.js'
import { C, RADIUS, SPACE, alpha, fade } from './theme.js'
import { ACCOUNT_KIND_ORDER } from '../lib/seeds.js'
import { balancesByAccount, netWorth, balanceMinor } from '../lib/balances.js'
import { money } from '../lib/money.js'
import { shortDate } from '../lib/dates.js'
import { KIND } from '../lib/store.js'
import { entryPathTitle } from '../lib/display.js'

export default function AccountsPage({ ctx }) {
  const { store, t, actions, canMutate } = ctx
  const balances = React.useMemo(
    () => balancesByAccount(store),
    [store, store.revision], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const worth = React.useMemo(() => netWorth(store, balances), [store, balances])
  const grouped = ACCOUNT_KIND_ORDER
    .map((kind) => ({ kind, rows: store.activeAccounts().filter((account) => account.kind === kind) }))
    .filter((group) => group.rows.length > 0)

  return (
    <div className="lg-scroll" style={{ flex: '1 1 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 96 }}>
        {/* 净资产头卡：brand 实底，金额恒带正负号。 */}
        <div style={{
          background: C.brand, borderRadius: RADIUS.card, padding: SPACE.s5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}
        >
          <span style={{ fontSize: 12, color: C.onAccent, opacity: 0.8 }}>{t('acc.netWorth')}</span>
          <span className="lg-mono" style={{ fontSize: 32, fontWeight: 500, color: C.onAccent }}>
            {money(worth.net, store.baseCode, { signed: true })}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s5, marginTop: SPACE.s2 }}>
            <Column label={t('acc.assets')} value={money(worth.assets, store.baseCode)} />
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.3)' }} />
            <Column label={t('acc.liabilities')} value={money(worth.liabilities, store.baseCode)} />
          </div>
        </div>

        {grouped.length === 0 ? (
          <EmptyState icon="wallet.pass" title={t('fab.addAccount')} />
        ) : grouped.map((group) => (
          <div key={group.kind}>
            <SectionHeader>{t(`acc.kind.${group.kind}`)}</SectionHeader>
            <Card padding={0}>
              {group.rows.map((account, index) => (
                <React.Fragment key={account.id}>
                  {index > 0 ? <Divider inset={52} /> : null}
                  <AccountRow
                    ctx={ctx}
                    account={account}
                    balance={balances[account.id] ?? 0}
                    canMutate={canMutate}
                  />
                </React.Fragment>
              ))}
            </Card>
          </div>
        ))}

        <button
          type="button"
          className="lg-btn"
          onClick={actions.openCurrencies}
          style={{
            display: 'flex', alignItems: 'center', gap: SPACE.s3, height: 46, padding: `0 ${SPACE.s4}px`,
            background: C.surface, border: `1px solid ${C.line}`, borderRadius: RADIUS.field,
          }}
        >
          <Icon name="coloncurrencysign.arrow.circlepath" size={15} color={C.muted} />
          <span style={{ flex: '1 1 auto', fontSize: 15, color: C.ink }}>{t('acc.currencies')}</span>
          <span className="lg-mono" style={{ fontSize: 14, color: C.muted }}>{store.baseCode}</span>
          <Icon name="chevron.right" size={12} color={C.muted} />
        </button>
      </div>
    </div>
  )
}

function Column({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 12, color: C.onAccent, opacity: 0.8 }}>{label}</span>
      <span className="lg-mono" style={{ fontSize: 16, fontWeight: 500, color: C.onAccent }}>{value}</span>
    </div>
  )
}

function AccountRow({ ctx, account, balance, canMutate }) {
  const { store, t, actions } = ctx
  const foreign = account.currency !== store.baseCode
  const longPress = useLongPress(() => {
    if (!canMutate) return
    actions.showMenu([
      { id: 'reconcile', label: t('acc.adjustBalance'), icon: 'equal.circle', onSelect: () => actions.reconcileAccount(account) },
      { id: 'edit', label: t('x.edit'), icon: 'pencil', onSelect: () => actions.editAccount(account) },
      { id: 'archive', label: t('x.archive'), icon: 'archivebox', destructive: true, onSelect: () => actions.archiveAccount(account) },
    ])
  })

  return (
    <button
      type="button"
      className="lg-btn"
      onClick={() => actions.openAccount(account)}
      {...longPress}
      style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }}
    >
      <IconBadge
        name={account.iconName}
        size={36}
        color={account.colorHex}
        background={alpha(account.colorHex, 0.16)}
      />
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span className="lg-clamp-1" style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>{account.name}</span>
          {foreign ? (
            <span
              className="lg-mono"
              style={{
                fontSize: 10, fontWeight: 500, color: C.muted, background: fade(C.muted, 12),
                borderRadius: RADIUS.pill, padding: '1px 5px', flex: '0 0 auto',
              }}
            >
              {account.currency}
            </span>
          ) : null}
        </span>
        {account.kind === 'credit' && account.creditLimitMinor > 0 ? (
          <span style={{ fontSize: 12, color: C.muted }}>
            {t('acc.limit', money(account.creditLimitMinor, account.currency))}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span className="lg-mono" style={{ fontSize: 16, fontWeight: 500, color: balance < 0 ? C.expense : C.ink }}>
          {money(balance, account.currency)}
        </span>
        {foreign ? (
          <span className="lg-mono" style={{ fontSize: 12, color: C.muted }}>
            ≈ {money(store.toBaseMinor(balance, account.currency), store.baseCode)}
          </span>
        ) : null}
      </div>
    </button>
  )
}

/** 账户详情：余额卡 → 动作条 → 最近 30 条。 */
export function AccountDetail({ ctx, accountID }) {
  const { store, t, locale, actions, canMutate } = ctx
  const account = store.account(accountID)
  if (!account) {
    return (
      <div className="lg-scroll" style={{ flex: '1 1 auto', padding: SPACE.s4 }}>
        <EmptyState icon="wallet.pass" title={t('acc.unavailableTitle')} body={t('acc.unavailableBody')} />
      </div>
    )
  }
  const balance = balanceMinor(store, account)
  const foreign = account.currency !== store.baseCode
  const usable = store.hasUsableRate(account.currency)
  const recent = store.allTransactions().filter((txn) => txn.accountID === account.id).slice(0, 30)

  return (
    <div className="lg-scroll" style={{ flex: '1 1 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 96 }}>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE.s2 }}>
            <IconBadge
              name={account.iconName}
              size={52}
              color={account.colorHex}
              background={alpha(account.colorHex, 0.16)}
            />
            <span style={{ fontSize: 12, color: C.muted }}>{t('acc.currentBalance')}</span>
            <span className="lg-mono" style={{ fontSize: 32, fontWeight: 500, color: balance < 0 ? C.expense : C.ink }}>
              {money(balance, account.currency)}
            </span>
            {foreign && usable ? (
              <span className="lg-mono" style={{ fontSize: 15, color: C.muted }}>
                ≈ {money(store.toBaseMinor(balance, account.currency), store.baseCode)}
              </span>
            ) : null}
            {foreign && !usable ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.expense }}>
                <Icon name="exclamationmark.triangle.fill" size={12} color={C.expense} />
                {t('acc.rateNeededTotals')}
              </span>
            ) : null}
            <span style={{ fontSize: 12, color: C.muted }}>
              {`${account.currency} · ${t(`acc.kind.${account.kind}`)}`}
              {account.includeInNetWorth ? '' : ` · ${t('acc.excludedFromNetWorth')}`}
            </span>
          </div>
        </Card>

        <div style={{ display: 'flex', gap: SPACE.s3, opacity: canMutate ? 1 : 0.45 }}>
          <ActionButton
            icon="pencil"
            label={t('acc.edit')}
            disabled={!canMutate}
            onClick={() => actions.editAccount(account)}
          />
          <ActionButton
            icon="equal.circle"
            label={t('acc.adjustBalance')}
            disabled={!canMutate}
            onClick={() => actions.reconcileAccount(account)}
          />
        </div>

        <div>
          <SectionHeader>{t('acc.recentEntries')}</SectionHeader>
          {recent.length === 0 ? (
            <Card><span style={{ fontSize: 15, color: C.muted }}>{t('acc.noEntries')}</span></Card>
          ) : (
            <Card padding={0}>
              {recent.map((txn, index) => (
                <React.Fragment key={txn.id}>
                  {index > 0 ? <Divider inset={48} /> : null}
                  <button
                    type="button"
                    className="lg-btn"
                    onClick={() => actions.editEntry(txn)}
                    style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }}
                  >
                    <IconBadge
                      name={txn.categoryID ? (store.category(txn.categoryID)?.systemImage ?? 'tag') : 'tag'}
                      size={32}
                      color={txn.categoryID ? (store.category(txn.categoryID)?.colorHex ?? C.muted) : C.muted}
                      background={fade(C.muted, 14)}
                    />
                    <span className="lg-clamp-1" style={{ flex: '1 1 auto', minWidth: 0, fontSize: 15, color: C.ink }}>
                      {entryPathTitle(store, txn, t)}
                    </span>
                    <span className="lg-mono" style={{ fontSize: 12, color: C.muted }}>
                      {shortDate(txn.occurredOn, locale)}
                    </span>
                    <span
                      className="lg-mono"
                      style={{ fontSize: 15, fontWeight: 500, color: txn.kind === KIND.income ? C.income : C.ink }}
                    >
                      {money(txn.kind === KIND.income ? txn.amountMinor : -txn.amountMinor, txn.currency,
                        { signed: txn.kind === KIND.income })}
                    </span>
                  </button>
                </React.Fragment>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionButton({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      className="lg-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: '1 1 0', height: 44, borderRadius: RADIUS.field, background: fade(C.brand, 10),
        color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15,
      }}
    >
      <Icon name={icon} size={15} color={C.brand} />
      <span>{label}</span>
    </button>
  )
}
