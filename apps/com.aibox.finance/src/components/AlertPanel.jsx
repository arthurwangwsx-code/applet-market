// 到价提醒面板 —— 规格 §3 右上 `bell` + §14.2 的诚实降级。
//
// footer 文案如实说明「刷新时检查、App 活跃时生效」：这个容器**没有后台唤醒**，
// 假装能后台盯盘比不做更糟。

import React from 'react'
import Icon from './Icon.js'
import { Field, Row, Segmented, Sheet, SheetHeader, Toggle } from './primitives.js'
import { C, RADIUS, SPACE } from './theme.js'
import { formatPercent, formatPrice } from '../lib/format.js'
import { parseNumberInput } from '../lib/money.js'
import { isPercentCondition } from '../lib/alerts.js'
import { decimalsFor } from '../lib/symbol.js'

const CONDITION_KEYS = {
  above: 'finance.alert.above',
  below: 'finance.alert.below',
  up_pct: 'finance.alert.upPct',
  down_pct: 'finance.alert.downPct',
}

export default function AlertPanel({ ctx, route, visible, onClose }) {
  const { t, alerts, quotes } = ctx
  const { canonical, symbol, name } = route || {}
  const [condition, setCondition] = React.useState('above')
  const [target, setTarget] = React.useState('')
  const quote = canonical ? quotes.quote(canonical) : null
  const decimals = symbol ? decimalsFor(symbol.market) : 2

  React.useEffect(() => {
    if (!visible) return
    setCondition('above')
    setTarget(quote ? formatPrice(quote.price, decimals) : '')
  }, [visible, canonical]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = canonical ? alerts.forSymbol(canonical) : []
  const value = parseNumberInput(target)
  const canSubmit = Number.isFinite(value)

  const submit = async () => {
    if (!canSubmit) return
    await alerts.set({ symbol: canonical, name, condition, targetPrice: value })
    setTarget('')
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetHeader title={t('finance.alert.title')} onClose={onClose} closeLabel={t('finance.done')} />
      <div className="fin-scroll" style={{ padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}>
        <Segmented
          value={condition}
          onChange={setCondition}
          items={Object.keys(CONDITION_KEYS).map((id) => ({ id, label: t(CONDITION_KEYS[id]) }))}
        />
        <div style={{ background: C.surface, borderRadius: RADIUS.card, padding: `0 ${SPACE.s3}px` }}>
          <Field
            label={t('finance.alert.target')}
            value={target}
            onChange={setTarget}
            placeholder="0"
            suffix={isPercentCondition(condition) ? '%' : (quote ? quote.currency : '')}
          />
        </div>
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
          {t('finance.alert.set')}
        </button>
        <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{t('finance.alert.footer')}</span>

        {rows.length > 0 ? (
          <div style={{ background: C.surface, borderRadius: RADIUS.card, padding: `0 ${SPACE.s3}px` }}>
            {rows.map((row, index) => (
              <Row
                key={row.id}
                title={`${t(CONDITION_KEYS[row.conditionRaw])} ${isPercentCondition(row.conditionRaw)
                  ? formatPercent(row.targetPrice)
                  : formatPrice(row.targetPrice, decimals)}`}
                subtitle={row.lastFiredAt ? new Date(row.lastFiredAt).toLocaleString() : null}
                last={index === rows.length - 1}
                accessory={(
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3 }}>
                    <Toggle checked={row.enabled} onChange={(next) => alerts.setEnabled(row.id, next)} label={t('finance.alert.title')} />
                    <button
                      type="button"
                      className="fin-btn fin-press"
                      aria-label={t('finance.alert.delete')}
                      onClick={() => alerts.remove(row.id)}
                      style={{ color: C.danger }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                )}
              />
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: C.muted }}>{t('finance.alert.empty')}</span>
        )}
      </div>
    </Sheet>
  )
}
