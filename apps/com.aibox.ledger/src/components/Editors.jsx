// 编辑器合集：账户 / 项目 / 预算 / 成员 / 余额校准 / 汇率。
// 都是 sheet 里的表单，共用 FieldCard + Menu + Toggle 三件套。

import React from 'react'
import Icon from './Icon.jsx'
import { FieldCard, Menu, Toggle } from './primitives.jsx'
import { C, RADIUS, SPACE, alpha, fade } from './theme.js'
import { ACCOUNT_KIND_ORDER, MEMBER_COLORS, PROJECT_COLORS, PROJECT_ICONS } from '../lib/seeds.js'
import { CURRENCY_CATALOG, currencySymbol } from '../lib/currencies.js'
import { money, parseMajorToMinor, plainMajor } from '../lib/money.js'
import { balanceMinor, derivesBalanceFromFlow } from '../lib/balances.js'
import { isoDay, parseISODay } from '../lib/dates.js'
import { formatRate } from '../lib/fx.js'

function Label({ children }) {
  return <span style={{ fontSize: 13, color: C.muted, padding: '0 4px' }}>{children}</span>
}

function Footer({ children }) {
  return <span style={{ fontSize: 12, color: C.muted, padding: '0 4px', lineHeight: 1.4 }}>{children}</span>
}

function TextInput({ value, onChange, placeholder, align = 'right', inputMode }) {
  return (
    <input
      className="lg-field"
      inputMode={inputMode}
      style={{ textAlign: align, fontSize: 15 }}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

/** 账户编辑器（新建 / 编辑）。**已有账户不允许改币种**（会误解释既有金额）。 */
export function AccountEditor({ ctx, editing, onSubmit }) {
  const { store, t } = ctx
  const [name, setName] = React.useState(editing ? editing.name : '')
  const [kind, setKind] = React.useState(editing ? editing.kind : 'cash')
  const [currency, setCurrency] = React.useState(editing ? editing.currency : store.baseCode)
  const [opening, setOpening] = React.useState('')
  const [creditLimit, setCreditLimit] = React.useState(
    editing && editing.creditLimitMinor > 0 ? plainMajor(editing.creditLimitMinor) : '',
  )
  const [includeInNetWorth, setInclude] = React.useState(editing ? editing.includeInNetWorth : true)
  const [menu, setMenu] = React.useState(null)

  // 候选 = 已启用币种 + 目录里其余币种（选到未启用的会在建账时自动登记）。
  const currencyOptions = React.useMemo(() => {
    const enabled = store.currencies.map((row) => row.code)
    const rest = CURRENCY_CATALOG.map((row) => row.code).filter((code) => !enabled.includes(code))
    return [...enabled, ...rest]
  }, [store, store.revision]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    onSubmit.current = () => ({
      name: name.trim(),
      kind,
      currency,
      initialBalanceMinor: parseMajorToMinor(opening) ?? 0,
      creditLimitMinor: parseMajorToMinor(creditLimit) ?? 0,
      includeInNetWorth,
      valid: name.trim().length > 0,
    })
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s2 }}>
      <FieldCard label={t('acc.name')}>
        <TextInput value={name} onChange={setName} />
      </FieldCard>
      <FieldCard label={t('x.type')} onClick={() => setMenu('kind')}>
        <span style={{ fontSize: 15, color: C.ink }}>{t(`acc.kind.${kind}`)}</span>
      </FieldCard>
      <FieldCard label={t('x.currency')} onClick={editing ? undefined : () => setMenu('currency')}>
        <span className="lg-mono" style={{ fontSize: 15, color: editing ? C.muted : C.ink }}>
          {`${currency}  ${currencySymbol(currency)}`}
        </span>
      </FieldCard>

      {!editing ? (
        <>
          <FieldCard label={kind === 'credit' ? t('acc.amountOwed') : t('acc.openingBalance')}>
            <TextInput value={opening} onChange={setOpening} placeholder="0.00" inputMode="decimal" />
          </FieldCard>
          {kind === 'credit' ? <Footer>{t('acc.creditFooter')}</Footer> : null}
        </>
      ) : null}

      {kind === 'credit' ? (
        <FieldCard label={t('acc.creditLimit')}>
          <TextInput value={creditLimit} onChange={setCreditLimit} placeholder="0.00" inputMode="decimal" />
        </FieldCard>
      ) : null}

      <FieldCard label={t('acc.includeInNetWorth')}>
        <Toggle checked={includeInNetWorth} onChange={setInclude} />
      </FieldCard>

      <Menu
        open={menu === 'kind'}
        onClose={() => setMenu(null)}
        items={ACCOUNT_KIND_ORDER.map((row) => ({
          id: row, label: t(`acc.kind.${row}`), selected: kind === row, onSelect: () => setKind(row),
        }))}
      />
      <Menu
        open={menu === 'currency'}
        onClose={() => setMenu(null)}
        items={currencyOptions.map((code) => ({
          id: code, label: `${code}  ${currencySymbol(code)}`, selected: currency === code,
          onSelect: () => setCurrency(code),
        }))}
      />
    </div>
  )
}

/** 项目编辑器。图标网格 7 列 × 14 个；配色 10 色。 */
export function ProjectEditor({ ctx, editing, onSubmit }) {
  const { store, t } = ctx
  const [name, setName] = React.useState(editing ? editing.name : '')
  const [systemImage, setIcon] = React.useState(editing ? editing.systemImage : 'airplane')
  const [colorHex, setColor] = React.useState(editing ? editing.colorHex : '#3A83D0')
  const [budget, setBudget] = React.useState(
    editing && editing.budgetMinor > 0 ? plainMajor(editing.budgetMinor) : '',
  )
  const [hasDates, setHasDates] = React.useState(!!(editing && (editing.startOn || editing.endOn)))
  const [startOn, setStart] = React.useState(isoDay(editing && editing.startOn ? editing.startOn : Date.now()))
  const [endOn, setEnd] = React.useState(isoDay(editing && editing.endOn ? editing.endOn : Date.now()))
  const [note, setNote] = React.useState(editing ? editing.note : '')
  const [recordInto, setRecordInto] = React.useState(true)

  React.useEffect(() => {
    onSubmit.current = () => ({
      name: name.trim(),
      systemImage,
      colorHex,
      budgetMinor: parseMajorToMinor(budget) ?? 0,
      startOn: hasDates ? parseISODay(startOn) : null,
      endOn: hasDates ? parseISODay(endOn) : null,
      note,
      isActive: editing ? undefined : recordInto,
      valid: name.trim().length > 0,
    })
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
      <FieldCard label={t('prj.name')}>
        <TextInput value={name} onChange={setName} />
      </FieldCard>

      <Label>{t('prj.iconColor')}</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: SPACE.s2 }}>
        {PROJECT_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            className="lg-btn"
            onClick={() => setIcon(icon)}
            style={{
              width: 38, height: 38, borderRadius: 19, justifySelf: 'center',
              background: systemImage === icon ? colorHex : alpha(colorHex, 0.14),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={18} color={systemImage === icon ? C.onAccent : colorHex} />
          </button>
        ))}
      </div>
      <div className="lg-chips">
        {PROJECT_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            className="lg-btn"
            onClick={() => setColor(hex)}
            aria-label={hex}
            style={{
              width: 28, height: 28, borderRadius: 14, background: hex, flex: '0 0 auto',
              outline: colorHex === hex ? `2px solid ${fade(C.ink, 50)}` : 'none', outlineOffset: -3,
            }}
          />
        ))}
      </div>

      <FieldCard label={t('x.budget')}>
        <span className="lg-mono" style={{ fontSize: 15, color: C.muted, marginRight: 4 }}>
          {currencySymbol(store.baseCode)}
        </span>
        <TextInput value={budget} onChange={setBudget} placeholder="0.00" inputMode="decimal" />
      </FieldCard>
      <Footer>{t('prj.budgetFooter', store.baseCode)}</Footer>

      <FieldCard label={t('prj.setDates')}>
        <Toggle checked={hasDates} onChange={setHasDates} />
      </FieldCard>
      {hasDates ? (
        <>
          <FieldCard label={t('prj.start')}>
            <input
              className="lg-field"
              type="date"
              style={{ textAlign: 'right', fontSize: 15 }}
              value={startOn}
              onChange={(event) => setStart(event.target.value)}
            />
          </FieldCard>
          <FieldCard label={t('prj.end')}>
            <input
              className="lg-field"
              type="date"
              min={startOn}
              style={{ textAlign: 'right', fontSize: 15 }}
              value={endOn}
              onChange={(event) => setEnd(event.target.value)}
            />
          </FieldCard>
        </>
      ) : null}

      <FieldCard label={t('x.note')}>
        <TextInput value={note} onChange={setNote} />
      </FieldCard>

      {!editing ? (
        <>
          <FieldCard label={t('prj.recordInto')}>
            <Toggle checked={recordInto} onChange={setRecordInto} />
          </FieldCard>
          <Footer>{t('prj.recordIntoFooter')}</Footer>
        </>
      ) : null}
    </div>
  )
}

/** 预算编辑器（detent 360）。 */
export function BudgetEditor({ ctx, monthKey, categoryID, onSubmit }) {
  const { store, t } = ctx
  const existing = store.budgets.find(
    (row) => row.monthKey === monthKey && (row.categoryID ?? null) === (categoryID ?? null),
  )
  const [scope, setScope] = React.useState(categoryID ?? null)
  const [limit, setLimit] = React.useState(existing && existing.limitMinor > 0 ? plainMajor(existing.limitMinor) : '')
  const [carryover, setCarryover] = React.useState(existing ? !!existing.carryover : false)
  const [menu, setMenu] = React.useState(false)
  const roots = store.rootCategories('expense')

  React.useEffect(() => {
    onSubmit.current = () => ({
      monthKey, categoryID: scope, limitMinor: parseMajorToMinor(limit) ?? 0, carryover, valid: true,
    })
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s2 }}>
      <FieldCard label={t('bud.budgetFor')} onClick={() => setMenu(true)}>
        <span style={{ fontSize: 15, color: C.ink }}>
          {scope ? (store.category(scope)?.name ?? t('bud.overallTotal')) : t('bud.overallTotal')}
        </span>
      </FieldCard>
      <FieldCard label={t('bud.limit')}>
        <TextInput value={limit} onChange={setLimit} placeholder="0.00" inputMode="decimal" />
      </FieldCard>
      <FieldCard label={t('bud.rollOverUnspent')}>
        <Toggle checked={carryover} onChange={setCarryover} />
      </FieldCard>
      <Footer>{t('bud.zeroRemoves')}</Footer>

      <Menu
        open={menu}
        onClose={() => setMenu(false)}
        items={[
          { id: 'total', label: t('bud.overallTotal'), selected: !scope, onSelect: () => setScope(null) },
          ...roots.map((row) => ({
            id: row.id, label: row.name, selected: scope === row.id, onSelect: () => setScope(row.id),
          })),
        ]}
      />
    </div>
  )
}

/** 成员编辑器（detent 320）。8 色横向圆点。 */
export function MemberEditor({ ctx, editing, order, onSubmit }) {
  const { t } = ctx
  const [name, setName] = React.useState(editing ? editing.name : '')
  const [isMe, setIsMe] = React.useState(editing ? !!editing.isMe : false)
  const [colorHex, setColor] = React.useState(
    editing ? editing.colorHex : MEMBER_COLORS[(order ?? 0) % MEMBER_COLORS.length],
  )

  React.useEffect(() => {
    onSubmit.current = () => ({ name: name.trim(), isMe, colorHex, valid: name.trim().length > 0 })
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
      <FieldCard label={t('x.name')}>
        <TextInput value={name} onChange={setName} />
      </FieldCard>
      <FieldCard label={t('prj.thisIsMe')}>
        <Toggle checked={isMe} onChange={setIsMe} />
      </FieldCard>
      <Label>{t('x.color')}</Label>
      <div className="lg-chips">
        {MEMBER_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            className="lg-btn"
            onClick={() => setColor(hex)}
            aria-label={hex}
            style={{
              width: 28, height: 28, borderRadius: 14, background: hex, flex: '0 0 auto',
              outline: colorHex === hex ? `2px solid ${fade(C.ink, 50)}` : 'none', outlineOffset: -3,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/** 余额校准（detent 320）。 */
export function ReconcileSheet({ ctx, account, onSubmit }) {
  const { store, t } = ctx
  const current = balanceMinor(store, account)
  const [text, setText] = React.useState(() => plainMajor(current))
  const target = parseMajorToMinor(text)
  const delta = target === null ? 0 : target - current
  const flows = derivesBalanceFromFlow(account)

  React.useEffect(() => {
    onSubmit.current = () => ({ targetMinor: target, valid: target !== null })
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 15, color: C.muted }}>{t('acc.currentBalance')}</span>
        <div style={{ flex: '1 1 auto' }} />
        <span className="lg-mono" style={{ fontSize: 16, fontWeight: 500, color: C.ink }}>
          {money(current, account.currency)}
        </span>
      </div>
      <span style={{ fontSize: 15, color: C.muted }}>{t('acc.actualBalance')}</span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: SPACE.s2, background: C.surface,
        border: `1px solid ${C.line}`, borderRadius: RADIUS.field, padding: SPACE.s3,
      }}
      >
        <span style={{ fontSize: 20, fontWeight: 500, color: C.muted }}>{currencySymbol(account.currency)}</span>
        <input
          className="lg-field lg-mono"
          inputMode="decimal"
          style={{ fontSize: 22, fontWeight: 500 }}
          placeholder="0.00"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      {delta !== 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon
            name={delta > 0 ? 'arrow.up.right' : 'arrow.down.left'}
            size={13}
            color={delta > 0 ? C.income : C.expense}
          />
          <span style={{ fontSize: 13, color: C.muted }}>
            {flows
              ? t('acc.calibrationEntry', money(delta, account.currency, { signed: true }))
              : t('acc.snapshotEntry')}
          </span>
        </div>
      ) : null}
    </div>
  )
}

/** 汇率编辑（detent 280）。保存即标记 manual（在线刷新不再覆盖）。 */
export function RateEditor({ ctx, code, onSubmit }) {
  const { store, t } = ctx
  const row = store.currencyRow(code)
  const [text, setText] = React.useState(() => (row && row.rateConfigured ? formatRate(row.rateToBase) : ''))
  const value = Number(text)
  const valid = Number.isFinite(value) && value > 0

  React.useEffect(() => {
    onSubmit.current = () => ({ code, rate: value, valid })
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
      <span style={{ fontSize: 15, color: C.muted }}>{t('cur.rateQuestion', code, store.baseCode)}</span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: SPACE.s2, background: C.surface,
        border: `1px solid ${C.line}`, borderRadius: RADIUS.field, padding: SPACE.s3,
      }}
      >
        <span className="lg-mono" style={{ fontSize: 18, fontWeight: 500, color: C.ink }}>{`1 ${code}  =`}</span>
        <input
          className="lg-field lg-mono"
          inputMode="decimal"
          style={{ fontSize: 20, fontWeight: 500 }}
          placeholder="0.0000"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <span className="lg-mono" style={{ fontSize: 18, fontWeight: 500, color: C.muted }}>{store.baseCode}</span>
      </div>
    </div>
  )
}
