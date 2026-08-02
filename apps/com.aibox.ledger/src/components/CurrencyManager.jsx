// 币种与汇率（LedgerCurrencyManagerView）+ 添加币种。
// 行排序：**基准币置顶**，其余按币种码升序。

import React from 'react'
import Icon, { Spinner } from './Icon.jsx'
import { Card, Divider, useLongPress } from './primitives.jsx'
import { C, RADIUS, SPACE, fade } from './theme.js'
import { CURRENCY_CATALOG, currencySymbol } from '../lib/currencies.js'
import { formatRate } from '../lib/fx.js'

export default function CurrencyManager({ ctx, mode = 'list' }) {
  const { store, t, actions, canMutate } = ctx
  const [refreshing, setRefreshing] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  const rows = React.useMemo(() => {
    const list = [...store.currencies]
    list.sort((a, b) => {
      if (a.isBase !== b.isBase) return a.isBase ? -1 : 1
      return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0)
    })
    return list
  }, [store, store.revision]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    setRefreshing(true)
    const ok = await actions.refreshRates()
    setRefreshing(false)
    setFailed(!ok)
  }

  if (mode === 'add') {
    const enabled = new Set(store.currencies.map((row) => row.code))
    const available = CURRENCY_CATALOG.filter((row) => !enabled.has(row.code))
    return (
      <Card padding={0}>
        {available.length === 0 ? (
          <div style={{ padding: SPACE.s4, fontSize: 15, color: C.muted }}>—</div>
        ) : available.map((row, index) => (
          <React.Fragment key={row.code}>
            {index > 0 ? <Divider inset={SPACE.s4} /> : null}
            <button
              type="button"
              className="lg-btn"
              onClick={() => actions.addCurrency(row.code)}
              style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }}
            >
              <span className="lg-mono" style={{ fontSize: 15, fontWeight: 500, color: C.ink, minWidth: 66 }}>
                {`${row.code} ${row.symbol}`}
              </span>
              <span className="lg-clamp-1" style={{ fontSize: 15, color: C.muted, flex: '1 1 auto', minWidth: 0 }}>
                {t(`cur.${row.code}`)}
              </span>
              <Icon name="arrow.right.circle" size={17} color={C.brand} />
            </button>
          </React.Fragment>
        ))}
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: '0 4px' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.muted, flex: '1 1 auto' }}>
          {t('cur.header', store.baseCode)}
        </span>
        {canMutate ? (
          <>
            <button type="button" className="lg-btn" onClick={() => actions.openAddCurrency()} aria-label={t('cur.add')}>
              <Icon name="plus" size={16} color={C.brand} />
            </button>
            <button type="button" className="lg-btn" onClick={refresh} disabled={refreshing} aria-label={t('cur.refresh')}>
              {refreshing ? <Spinner size={15} color={C.brand} /> : <Icon name="arrow.clockwise" size={15} color={C.brand} />}
            </button>
          </>
        ) : null}
      </div>

      <Card padding={0}>
        {rows.map((row, index) => (
          <React.Fragment key={row.code}>
            {index > 0 ? <Divider inset={SPACE.s4} /> : null}
            <CurrencyRow ctx={ctx} row={row} canMutate={canMutate} />
          </React.Fragment>
        ))}
      </Card>

      <span style={{ fontSize: 12, color: C.muted, padding: '0 4px', lineHeight: 1.4 }}>
        {t('cur.footer', store.baseCode)}
      </span>
      {failed ? (
        <span style={{ fontSize: 12, color: C.expense, padding: '0 4px', lineHeight: 1.4 }}>
          {t('cur.refreshFailed')}
        </span>
      ) : null}
    </div>
  )
}

function CurrencyRow({ ctx, row, canMutate }) {
  const { store, t, actions } = ctx
  const longPress = useLongPress(() => {
    if (!canMutate || row.isBase) return
    actions.showMenu([
      { id: 'base', label: t('cur.setAsBase'), icon: 'star', onSelect: () => actions.setBaseCurrency(row.code) },
    ])
  })

  return (
    <button
      type="button"
      className="lg-btn"
      onClick={() => { if (!row.isBase && canMutate) actions.editRate(row.code) }}
      {...longPress}
      style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="lg-mono" style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>
            {`${row.code} ${currencySymbol(row.code)}`}
          </span>
          {row.isBase ? (
            <span style={{
              fontSize: 10, fontWeight: 500, color: C.brand, background: fade(C.brand, 14),
              borderRadius: RADIUS.pill, padding: '1px 6px',
            }}
            >
              {t('cur.base')}
            </span>
          ) : null}
        </span>
        <span className="lg-clamp-1" style={{ fontSize: 12, color: C.muted }}>{t(`cur.${row.code}`)}</span>
      </div>
      {row.isBase ? (
        <span className="lg-mono" style={{ fontSize: 15, color: C.muted }}>1</span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="lg-mono" style={{ fontSize: 15, color: row.rateConfigured ? C.ink : C.expense }}>
            {row.rateConfigured
              ? `1 ${row.code} = ${formatRate(row.rateToBase)} ${store.baseCode}`
              : t('tx.rateNeeded')}
          </span>
          {row.manualRate ? <span style={{ fontSize: 12, color: C.muted }}>{t('cur.manual')}</span> : null}
        </div>
      )}
    </button>
  )
}
