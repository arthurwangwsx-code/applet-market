// 记一笔 / 编辑（LedgerEntryView）。同一个面板既是新建也是编辑（传 editing 即编辑）。
// 目标：**3 步内落账**（金额 → 分类 → 保存）。
// 结构：类型分段 → 可滚动区（金额显示 → 分类宫格 / 转账账户 → 元信息）→ 底部计算器键盘。

import React from 'react'
import { currencySymbol } from '../lib/currencies.js'
import { isoDay, parseISODay } from '../lib/dates.js'
import { appendDigit, appendDot, appendOperator, displayValue, tryEvaluateMinor } from '../lib/expression.js'
import { capabilities as hostCaps, scanImageText } from '../lib/host.js'
import { money, plainMajor } from '../lib/money.js'
import { lastAccountID, sortRootCategoriesByRecency } from '../lib/prefs.js'
import { parseReceipt } from '../lib/receipt.js'
import type { LedgerStore } from '../lib/store.js'
import { KIND } from '../lib/store.js'
import type { EntryEditorPayload, LedgerTransaction, LedgerUIContext, TransactionSplit, Translate } from '../types.js'
import Icon from './Icon.js'
import { FieldCard, Menu, Segmented, Toggle } from './primitives.js'
import { alpha, C, fade, RADIUS, SPACE } from './theme.js'

const KEYS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['0', '.', '⌫', '+'],
  ['=', '(', ')', 'C'],
]
const OPERATOR_KEYS = new Set(['+', '−', '×', '÷', '='])

type EntryType = EntryEditorPayload['type']
type EditorMenu = 'account' | 'from' | 'payer' | 'project' | 'refund' | 'to'

interface ReceiptScanOptions {
  t: Translate
  setInput: React.Dispatch<React.SetStateAction<string>>
  setMerchant: React.Dispatch<React.SetStateAction<string>>
  setDay: React.Dispatch<React.SetStateAction<string>>
  amountFilled: boolean
  merchantFilled: boolean
  accountCurrency: string | null
}

/**
 * 扫小票填单。
 *
 * **只填空栏、不覆盖用户已经填的**——用户可能先手输了金额再想扫一下补商家，
 * 把他填的东西冲掉是最容易招致不信任的那种"智能"。
 *
 * 币种认出来但与所选账户不一致时**只提示、不自动改账户**：改账户会连带改掉
 * 余额归属，那是比填错金额更重的副作用，必须由用户点头。
 */
function useReceiptScan({
  t,
  setInput,
  setMerchant,
  setDay,
  amountFilled,
  merchantFilled,
  accountCurrency,
}: ReceiptScanOptions) {
  const [scanning, setScanning] = React.useState(false)
  const [scanHint, setScanHint] = React.useState('')

  const scan = React.useCallback(async () => {
    if (scanning) return
    setScanning(true)
    setScanHint('')
    try {
      const res = await scanImageText()
      if (!res.ok) {
        setScanHint(
          res.reason === 'cancelled' ? '' : res.reason === 'noVision' ? t('entry.scanNoVision') : t('entry.scanFailed'),
        )
        return
      }
      if (res.empty) {
        setScanHint(t('entry.scanEmpty'))
        return
      }
      const parsed = parseReceipt(res.text ?? '')
      const notes: string[] = []
      if (parsed.amount != null && !amountFilled) {
        setInput(String(parsed.amount))
        if (!parsed.amountConfident) notes.push(t('entry.scanCheckAmount'))
      }
      if (parsed.payee && !merchantFilled) setMerchant(parsed.payee)
      if (parsed.date) setDay(isoDay(parsed.date))
      // 币种：只在与所选账户的币种**不同**时说一声，绝不自动换账户 ——
      // 换账户会连带改掉余额归属，那个副作用比填错金额更重，必须用户点头。
      if (parsed.currency && accountCurrency && parsed.currency !== accountCurrency) {
        notes.push(
          t('entry.scanCurrencyMismatch').replace('{found}', parsed.currency).replace('{account}', accountCurrency),
        )
      }
      setScanHint(notes.length ? notes.join(' ') : t('entry.scanDone'))
    } catch {
      setScanHint(t('entry.scanFailed'))
    } finally {
      setScanning(false)
    }
  }, [scanning, t, setInput, setMerchant, setDay, amountFilled, merchantFilled, accountCurrency])

  return { scan, scanning, scanHint }
}

export default function EntryEditor({
  ctx,
  editing,
  onClose,
}: {
  ctx: LedgerUIContext
  editing: LedgerTransaction | null
  onClose: () => void
}) {
  const { store, t, actions, canMutate } = ctx
  const isEditing = !!editing

  const initialType: EntryType = editing
    ? editing.kind === KIND.income
      ? 'income'
      : editing.kind === KIND.transferOut || editing.kind === KIND.transferIn
        ? 'transfer'
        : 'expense'
    : 'expense'

  const [type, setType] = React.useState(initialType)
  const [input, setInput] = React.useState(() => {
    if (!editing) return ''
    // 编辑载入：金额框优先填原始表达式，没有才填纯金额。
    return editing.calculationExpression || plainMajor(editing.amountMinor)
  })
  const [categoryID, setCategoryID] = React.useState<string | null>(editing ? editing.categoryID : null)
  const [expandedRoot, setExpandedRoot] = React.useState<string | null>(() => {
    if (!editing || !editing.categoryID) return null
    const category = store.category(editing.categoryID)
    return category && category.parentID ? category.parentID : null
  })
  const [accountID, setAccountID] = React.useState<string | null>(() =>
    editing ? editing.accountID : lastAccountID(store, 'expense'),
  )
  const [toAccountID, setToAccountID] = React.useState<string | null>(() => {
    if (!editing || !editing.transferPeerID) return null
    const peer = store.transaction(editing.transferPeerID)
    if (!peer) return null
    return editing.kind === KIND.transferOut ? peer.accountID : editing.accountID
  })
  const [fromAccountID, setFromAccountID] = React.useState<string | null>(() => {
    if (!editing || !editing.transferPeerID) return lastAccountID(store, 'transfer')
    const peer = store.transaction(editing.transferPeerID)
    if (!peer) return editing.accountID
    return editing.kind === KIND.transferOut ? editing.accountID : peer.accountID
  })
  const [projectID, setProjectID] = React.useState<string | null>(() =>
    editing ? editing.projectID : (store.currentProject()?.id ?? null),
  )
  const [payerMemberID, setPayerMemberID] = React.useState<string | null>(editing ? editing.payerMemberID : null)
  const [split, setSplit] = React.useState<TransactionSplit | null>(editing ? editing.split : null)
  const [merchant, setMerchant] = React.useState(editing ? (editing.merchant ?? '') : '')
  const [note, setNote] = React.useState(editing ? editing.note : '')
  const [day, setDay] = React.useState(() => isoDay(editing ? editing.occurredOn : Date.now()))
  const [tags, setTags] = React.useState(editing ? (editing.tags ?? []).join(', ') : '')
  const [reimbursable, setReimbursable] = React.useState(editing ? !!editing.reimbursable : false)

  // 扫小票填单。当前所选账户的币种用于「票面币种与账户不符」的提示。
  const scanAccountID = type === 'transfer' ? fromAccountID : accountID
  const scanCurrency = React.useMemo(() => {
    const acct = scanAccountID ? store.account(scanAccountID) : null
    return acct ? acct.currency : null
  }, [store, scanAccountID])
  const receipt = useReceiptScan({
    t,
    setInput,
    setMerchant,
    setDay,
    amountFilled: String(input || '').trim().length > 0,
    merchantFilled: String(merchant || '').trim().length > 0,
    accountCurrency: scanCurrency,
  })
  const [refundOfID, setRefundOfID] = React.useState<string | null>(editing ? editing.refundOfID : null)
  const [expanded, setExpanded] = React.useState(false)
  const [menu, setMenu] = React.useState<EditorMenu | null>(null)
  const [bounce, setBounce] = React.useState(false)

  const accounts = store.activeAccounts()
  const projects = store.activeProjects()
  const kind = type === 'income' ? 'income' : 'expense'
  const roots = React.useMemo(
    () => sortRootCategoriesByRecency(store, store.rootCategories(kind), kind),
    [store, store.revision, kind], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const children = expandedRoot ? store.childCategories(expandedRoot) : []

  const minor = tryEvaluateMinor(input)
  const account = store.account(accountID)
  const fromAccount = store.account(fromAccountID)
  const toAccount = store.account(toAccountID)
  const currency =
    type === 'transfer'
      ? fromAccount
        ? fromAccount.currency
        : store.baseCode
      : account
        ? account.currency
        : store.baseCode
  const accent = type === 'income' ? C.income : type === 'expense' ? C.expense : C.brand
  const hasOperator = /[+\-−*×/÷()]/.test(input)

  const transferRateMissing =
    type === 'transfer' &&
    fromAccount &&
    toAccount &&
    fromAccount.currency !== toAccount.currency &&
    (!store.hasUsableRate(fromAccount.currency) || !store.hasUsableRate(toAccount.currency))

  const canSave =
    canMutate &&
    minor !== null &&
    minor > 0 &&
    (type === 'transfer'
      ? !!(fromAccount && toAccount && fromAccount.id !== toAccount.id && !transferRateMissing)
      : !!(account && store.hasUsableRate(account.currency)))

  const projectMembers = projectID ? store.projectMembers(projectID) : []
  const hasOtherMembers = projectMembers.some((row) => !row.isMe)

  // 切类型：清空已选分类与展开态、按类型取上次账户、非收入清空退款关联、重算 AA 默认值。
  const changeType = (next: EntryType) => {
    if (isEditing) return
    setType(next)
    setCategoryID(null)
    setExpandedRoot(null)
    if (next === 'transfer') setFromAccountID(lastAccountID(store, 'transfer'))
    else setAccountID(lastAccountID(store, next === 'income' ? 'income' : 'expense'))
    if (next !== 'income') setRefundOfID(null)
    setPayerMemberID(null)
    setSplit(null)
  }

  const press = (key: string) => {
    if (key === 'C') {
      setInput('')
      return
    }
    if (key === '⌫') {
      setInput((text) => text.slice(0, -1))
      return
    }
    if (key === '=') {
      try {
        setInput(displayValue(input))
      } catch {
        /* 求值失败时原样保留 */
      }
      return
    }
    if (key === '(' || key === ')') {
      setInput((text) => text + key)
      return
    }
    if (OPERATOR_KEYS.has(key)) {
      setInput((text) => appendOperator(text, key))
      return
    }
    if (key === '.') {
      setInput((text) => appendDot(text))
      return
    }
    setInput((text) => appendDigit(text, key))
  }

  const payload = (): EntryEditorPayload => ({
    type,
    amountMinor: minor ?? 0,
    calculationExpression: hasOperator ? input : null,
    categoryID: type === 'transfer' ? null : categoryID,
    accountID: (type === 'transfer' ? fromAccountID : accountID) ?? '',
    toAccountID,
    projectID,
    payerMemberID,
    split,
    merchant: merchant.trim().length > 0 ? merchant.trim() : null,
    note,
    occurredOn: parseISODay(day) ?? Date.now(),
    tags: tags
      .split(',')
      .map((piece) => piece.trim())
      .filter((piece) => piece.length > 0),
    reimbursable,
    refundOfID,
  })

  const submit = async (again: boolean) => {
    const ok = await actions.saveEntry(payload(), editing)
    if (!ok) return
    if (!again) {
      onClose()
      return
    }
    // 「保存并再记」：清空 金额/商家/备注/标签/可报销/退款关联，**保留** 类型/分类/账户/日期/项目。
    setInput('')
    setMerchant('')
    setNote('')
    setTags('')
    setReimbursable(false)
    setRefundOfID(null)
    setBounce(true)
    window.setTimeout(() => setBounce(false), 250)
  }

  const refundCandidates = React.useMemo(() => {
    if (type !== 'income') return []
    return store
      .allTransactions()
      .filter((txn) => txn.kind === KIND.expense && (!editing || txn.id !== editing.id))
      .slice(0, 30)
  }, [store, store.revision, type, editing]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: `${SPACE.s3}px ${SPACE.s4}px 0` }}>
        <Segmented
          value={type}
          onChange={changeType}
          disabled={isEditing}
          items={[
            { id: 'expense', label: t('x.expense') },
            { id: 'income', label: t('x.income') },
            { id: 'transfer', label: t('x.transfer') },
          ]}
        />
      </div>

      <div className="lg-scroll" style={{ flex: '1 1 auto', padding: SPACE.s4 }}>
        {/* 金额显示区 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, marginBottom: SPACE.s4 }}
        >
          {hasOperator && input.length > 0 ? (
            <span className="lg-mono lg-clamp-1" style={{ fontSize: 15, color: C.muted }}>
              {input}
            </span>
          ) : null}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 4,
              transform: bounce ? 'scale(1.06)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 500, color: accent, opacity: 0.7 }}>
              {currencySymbol(currency)}
            </span>
            <span className="lg-mono lg-clamp-1" style={{ fontSize: 40, fontWeight: 500, color: accent }}>
              {minor === null ? (input.length > 0 ? input : '0') : input.length === 0 ? '0' : displaySafe(input)}
            </span>
          </div>
        </div>

        {type === 'transfer' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s2, marginBottom: SPACE.s4 }}>
            <FieldCard icon="arrow.up.right" label={t('ent.from')} onClick={() => setMenu('from')}>
              <span style={{ fontSize: 15, color: C.ink }}>{fromAccount ? fromAccount.name : '—'}</span>
            </FieldCard>
            <FieldCard icon="arrow.down.left" label={t('ent.to')} onClick={() => setMenu('to')}>
              <span style={{ fontSize: 15, color: C.ink }}>{toAccount ? toAccount.name : '—'}</span>
            </FieldCard>
            {transferRateMissing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.expense }}>
                <Icon name="exclamationmark.triangle.fill" size={12} color={C.expense} />
                <span>{t('ent.transferRateNeeded')}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ marginBottom: SPACE.s4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: `${SPACE.s3}px ${SPACE.s2}px` }}>
              {roots.map((root) => {
                const selected = categoryID === root.id || (categoryID && store.rootCategoryID(categoryID) === root.id)
                return (
                  <button
                    key={root.id}
                    type="button"
                    className="lg-btn"
                    onClick={() => {
                      const kids = store.childCategories(root.id)
                      setCategoryID(root.id)
                      setExpandedRoot(kids.length > 0 ? root.id : null)
                    }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        background: selected ? root.colorHex : alpha(root.colorHex, 0.14),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={root.systemImage} size={20} color={selected ? C.onAccent : root.colorHex} />
                    </div>
                    <span
                      className="lg-clamp-1"
                      style={{ fontSize: 12, color: C.ink, maxWidth: '100%', textAlign: 'center' }}
                    >
                      {root.name}
                    </span>
                  </button>
                )
              })}
            </div>
            {children.length > 0 ? (
              <div className="lg-chips" style={{ marginTop: SPACE.s3 }}>
                {children.map((child) => {
                  const selected = categoryID === child.id
                  return (
                    <button
                      key={child.id}
                      type="button"
                      className="lg-btn"
                      onClick={() => setCategoryID(child.id)}
                      style={{
                        flex: '0 0 auto',
                        padding: '8px 12px',
                        borderRadius: RADIUS.pill,
                        fontSize: 15,
                        background: selected ? C.brand : C.surface,
                        color: selected ? C.onAccent : C.ink,
                        border: selected ? 'none' : `1px solid ${C.line}`,
                      }}
                    >
                      {child.name}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        )}

        {/* 元信息区 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s2 }}>
          {type !== 'transfer' ? (
            <FieldCard icon="wallet.pass" label={t('x.account')} onClick={() => setMenu('account')}>
              <span style={{ fontSize: 15, color: C.ink }}>{account ? account.name : '—'}</span>
            </FieldCard>
          ) : null}

          {projects.length > 0 ? (
            <FieldCard icon="folder" label={t('x.project')} onClick={() => setMenu('project')}>
              <span style={{ fontSize: 15, color: C.ink }}>
                {projectID ? (store.project(projectID)?.name ?? t('x.noProject')) : t('x.noProject')}
              </span>
            </FieldCard>
          ) : null}

          {type === 'expense' && hasOtherMembers ? (
            <>
              <FieldCard icon="person.badge.plus" label={t('ent.paidBy')} onClick={() => setMenu('payer')}>
                <span style={{ fontSize: 15, color: C.ink }}>
                  {payerMemberID ? (store.member(payerMemberID)?.name ?? t('prj.meName')) : t('prj.meName')}
                </span>
              </FieldCard>
              <FieldCard
                icon="person.2.badge.plus"
                label={t('ent.split')}
                onClick={() => {
                  if (!projectID) return
                  actions.openSplitEditor({
                    projectID,
                    payerMemberID,
                    totalBaseMinor: store.toBaseMinor(minor ?? 0, currency),
                    split,
                    onDone: setSplit,
                  })
                }}
              >
                <span style={{ fontSize: 15, color: C.muted }}>
                  {split && (split.shares ?? []).length > 0
                    ? `${t(`ent.${split.mode}`)} · ${t('ent.people', split.shares.length)}`
                    : t('ent.notSplit')}
                </span>
              </FieldCard>
            </>
          ) : null}

          <FieldCard icon="storefront" label={t('ent.merchant')}>
            <input
              className="lg-field lg-clamp-1"
              style={{ textAlign: 'right', fontSize: 15 }}
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
            />
          </FieldCard>

          {/* 扫小票。**能力缺席就整条不渲染**——留一个点了没反应的按钮比没有更糟。
              识别全程在设备上（Vision），图片不上传、不进模型。 */}
          {hostCaps.vision ? (
            <FieldCard icon="doc.text.viewfinder" label={t('entry.scanLabel')}>
              <button
                type="button"
                className="lg-press"
                onClick={receipt.scan}
                disabled={receipt.scanning || !canMutate}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: C.brand,
                  fontSize: 15,
                  padding: 0,
                }}
              >
                {receipt.scanning ? t('entry.scanning') : t('entry.scanAction')}
              </button>
            </FieldCard>
          ) : null}
          {receipt.scanHint ? (
            <div
              style={{
                padding: '6px 14px 0',
                fontSize: 12,
                color: C.muted,
                lineHeight: 1.5,
              }}
            >
              {receipt.scanHint}
            </div>
          ) : null}

          <FieldCard icon="calendar" label={t('x.date')}>
            <input
              className="lg-field"
              type="date"
              style={{ textAlign: 'right', fontSize: 15 }}
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />
          </FieldCard>

          <FieldCard icon="text.alignleft" label={t('x.note')}>
            <input
              className="lg-field"
              style={{ textAlign: 'right', fontSize: 15 }}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FieldCard>

          {type !== 'transfer' ? (
            <>
              <button
                type="button"
                className="lg-btn"
                onClick={() => setExpanded((value) => !value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: `${SPACE.s2}px 4px`,
                  color: C.muted,
                  fontSize: 14,
                }}
              >
                <Icon name="slider.horizontal.3" size={14} color={C.muted} />
                <span>{t('ent.moreDetails')}</span>
                <Icon name={expanded ? 'chevron.up' : 'chevron.down'} size={10} color={C.muted} />
              </button>
              {expanded ? (
                <>
                  <FieldCard icon="tag" label={t('ent.tags')}>
                    <input
                      className="lg-field"
                      style={{ textAlign: 'right', fontSize: 15 }}
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                    />
                  </FieldCard>
                  <FieldCard icon="briefcase" label={t('ent.reimbursable')}>
                    <Toggle checked={reimbursable} onChange={setReimbursable} />
                  </FieldCard>
                  {type === 'income' && refundCandidates.length > 0 ? (
                    <FieldCard
                      icon="arrow.uturn.left.circle.fill"
                      label={t('ent.refundOf')}
                      onClick={() => setMenu('refund')}
                    >
                      <span className="lg-clamp-1" style={{ fontSize: 15, color: C.ink }}>
                        {refundOfID ? refundLabel(store, refundOfID, t) : t('ent.notLinked')}
                      </span>
                    </FieldCard>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* 计算器键盘 */}
      <div
        style={{
          background: C.surface,
          borderTop: `1px solid ${C.line}`,
          flex: '0 0 auto',
          padding: `${SPACE.s2}px ${SPACE.s2}px calc(${SPACE.s2}px + env(safe-area-inset-bottom))`,
        }}
      >
        {KEYS.map((row) => (
          <div key={row.join('')} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {row.map((key) => (
              <button
                key={key}
                type="button"
                className="lg-btn"
                onClick={() => press(key)}
                style={{
                  flex: '1 1 0',
                  height: 44,
                  borderRadius: RADIUS.field,
                  background: OPERATOR_KEYS.has(key) ? fade(C.brand, 12) : C.bg,
                  color: C.ink,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: key === 'C' ? 20 : 24,
                  fontWeight: 500,
                }}
              >
                {key === '⌫' ? <Icon name="delete.left" size={20} color={C.ink} /> : key}
              </button>
            ))}
          </div>
        ))}

        <div style={{ display: 'flex', gap: SPACE.s2, marginTop: SPACE.s2 }}>
          {!isEditing ? (
            <button
              type="button"
              className="lg-btn"
              disabled={!canSave}
              onClick={() => submit(true)}
              style={{
                flex: '1 1 0',
                height: 48,
                borderRadius: RADIUS.field,
                background: fade(C.brand, 14),
                color: C.brand,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 500,
                opacity: canSave ? 1 : 0.5,
              }}
            >
              {t('ent.saveAndNew')}
            </button>
          ) : null}
          <button
            type="button"
            className="lg-btn"
            disabled={!canSave}
            onClick={() => submit(false)}
            style={{
              flex: '1 1 0',
              height: 48,
              borderRadius: RADIUS.field,
              background: canSave ? C.brand : fade(C.muted, 25),
              color: C.onAccent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            {isEditing ? t('x.update') : t('x.save')}
          </button>
        </div>
      </div>

      <Menu
        open={menu === 'account'}
        onClose={() => setMenu(null)}
        items={accounts.map((row) => ({
          id: row.id,
          label: row.name,
          selected: accountID === row.id,
          onSelect: () => setAccountID(row.id),
        }))}
      />
      <Menu
        open={menu === 'from'}
        onClose={() => setMenu(null)}
        items={accounts.map((row) => ({
          id: row.id,
          label: row.name,
          selected: fromAccountID === row.id,
          onSelect: () => setFromAccountID(row.id),
        }))}
      />
      <Menu
        open={menu === 'to'}
        onClose={() => setMenu(null)}
        items={accounts.map((row) => ({
          id: row.id,
          label: row.name,
          selected: toAccountID === row.id,
          onSelect: () => setToAccountID(row.id),
        }))}
      />
      <Menu
        open={menu === 'project'}
        onClose={() => setMenu(null)}
        items={[
          { id: 'none', label: t('x.noProject'), selected: !projectID, onSelect: () => setProjectID(null) },
          ...projects.map((row) => ({
            id: row.id,
            label: row.name,
            selected: projectID === row.id,
            onSelect: () => setProjectID(row.id),
          })),
        ]}
      />
      <Menu
        open={menu === 'payer'}
        onClose={() => setMenu(null)}
        items={projectMembers.map((row) => ({
          id: row.id,
          label: row.name,
          selected: payerMemberID === row.id,
          onSelect: () => setPayerMemberID(row.id),
        }))}
      />
      <Menu
        open={menu === 'refund'}
        onClose={() => setMenu(null)}
        items={[
          { id: 'none', label: t('ent.notLinked'), selected: !refundOfID, onSelect: () => setRefundOfID(null) },
          ...refundCandidates.map((row) => ({
            id: row.id,
            label: refundLabel(store, row.id, t),
            selected: refundOfID === row.id,
            onSelect: () => setRefundOfID(row.id),
          })),
        ]}
      />
    </div>
  )
}

function displaySafe(input: string): string {
  try {
    return displayValue(input)
  } catch {
    return input
  }
}

function refundLabel(store: LedgerStore, id: string, t: Translate): string {
  const txn = store.transaction(id)
  if (!txn) return t('ent.notLinked')
  const name =
    txn.merchant || (txn.categoryID ? store.category(txn.categoryID)?.name : null) || txn.note || t('x.expense')
  return `${name} · ${money(txn.amountMinor, txn.currency)}`
}
