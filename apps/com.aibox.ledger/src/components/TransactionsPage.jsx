// 明细页（LedgerTransactionsView）。
// 布局：当前项目提示条 → 本月摘要卡 → 筛选条 → 按日分组列表 → 加载更早。

import React from 'react'
import Icon, { IconBadge } from './Icon.js'
import { Card, Chip, Divider, EmptyState, Menu, SwipeRow } from './primitives.js'
// 框架级虚拟列表（随运行时资产内置，不是 npm 包）。本地那份 133 行的同接口兜底已删除——
// 它的文件头写着「等 aibox/ui 上架后换成这一行」，闸门早就放开了，只是没人回头采纳。
import { VirtualList } from 'aibox/ui'
import { C, RADIUS, SPACE, alpha, fade } from './theme.js'
import { KIND } from '../lib/store.js'
import { groupByDay } from '../lib/entries.js'
import { matchesSearch } from '../lib/queries.js'
import { monthlyFlow } from '../lib/reporting.js'
import { addMonths, monthKeyNow, monthStart } from '../lib/dates.js'
import { money } from '../lib/money.js'
import {
  dayExpenseTotal, dayHeaderTitle, entryAmount, entryConversion, entryGlyph, entrySubtitle, entryTitle,
} from '../lib/display.js'

const TONE = { ink: C.ink, muted: C.muted, income: C.income, expense: C.expense }

/** 本月摘要卡：支出（红）｜收入（绿）｜结余（ink，带正负号）。 */
function SummaryCard({ store, t }) {
  const flow = monthlyFlow(store, monthKeyNow())
  const columns = [
    { label: t('x.expense'), text: money(flow.expense, store.baseCode), color: C.expense },
    { label: t('x.income'), text: money(flow.income, store.baseCode), color: C.income },
    { label: t('x.balance'), text: money(flow.net, store.baseCode, { signed: true }), color: C.ink },
  ]
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: SPACE.s3 }}>
        <span style={{ fontSize: 12, color: C.muted }}>{t('tx.thisMonth')}</span>
        <div style={{ flex: '1 1 auto' }} />
        <span
          aria-label={t('tx.baseCurrency', store.baseCode)}
          style={{
            fontSize: 11, fontWeight: 500, color: C.brand, background: fade(C.brand, 10),
            borderRadius: RADIUS.pill, padding: '4px 8px',
          }}
        >
          {store.baseCode}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {columns.map((column, index) => (
          <React.Fragment key={column.label}>
            {index > 0 ? <div style={{ width: 1, height: 32, background: C.line, flex: '0 0 auto' }} /> : null}
            <div style={{
              flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4, padding: '0 4px',
            }}
            >
              <span style={{ fontSize: 12, color: C.muted }}>{column.label}</span>
              <span
                className="lg-mono lg-clamp-1"
                style={{ fontSize: 17, fontWeight: 500, color: column.color, maxWidth: '100%' }}
              >
                {column.text}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </Card>
  )
}

/** 一行流水。整行可点 → 打开编辑面板；左滑删除（仅 canMutate）。 */
export function EntryRow({ store, txn, t, onOpen, onDelete, canMutate }) {
  const glyph = entryGlyph(store, txn)
  const amount = entryAmount(txn)
  const conversion = entryConversion(store, txn, t)
  const subtitle = entrySubtitle(store, txn)

  const body = (
    <button
      type="button"
      className="lg-btn"
      onClick={onOpen}
      style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }}
    >
      <IconBadge name={glyph.icon} size={36} color={glyph.color} background={alpha(glyph.color, 0.16)} />
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span className="lg-clamp-1" style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>
          {entryTitle(store, txn, t)}
        </span>
        {subtitle || txn.source === 'ai' ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <span className="lg-clamp-1" style={{ fontSize: 12, color: C.muted }}>{subtitle}</span>
            {txn.source === 'ai' ? (
              <Icon name="sparkles" size={9} color={C.brand} style={{ flex: '0 0 auto' }} />
            ) : null}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: '0 0 auto' }}>
        <span className="lg-mono" style={{ fontSize: 16, fontWeight: 500, color: TONE[amount.tone] }}>
          {amount.text}
        </span>
        {conversion ? (
          <span className="lg-mono" style={{ fontSize: 10, color: TONE[conversion.tone] }}>{conversion.text}</span>
        ) : null}
      </div>
    </button>
  )

  if (!canMutate) return body
  return (
    <SwipeRow
      trailing={{ label: t('x.delete'), icon: 'trash', destructive: true, fullSwipe: true, onAction: onDelete }}
    >
      {body}
    </SwipeRow>
  )
}

/** 一天一张卡（整组套 ledgerCard(padding: 0)，行间 Divider 左缩进 52）。 */
function DayGroup({ store, group, t, locale, onOpen, onDelete, canMutate }) {
  const total = dayExpenseTotal(store, group.rows)
  return (
    <div style={{ marginBottom: SPACE.s4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', padding: `0 4px ${SPACE.s2}px` }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>
          {dayHeaderTitle(group.day, locale, t)}
        </span>
        <div style={{ flex: '1 1 auto' }} />
        {total ? <span className="lg-mono" style={{ fontSize: 12, color: C.muted }}>{total}</span> : null}
      </div>
      <Card padding={0}>
        {group.rows.map((txn, index) => (
          <React.Fragment key={txn.id}>
            {index > 0 ? <Divider inset={52} /> : null}
            <EntryRow
              store={store}
              txn={txn}
              t={t}
              locale={locale}
              canMutate={canMutate}
              onOpen={() => onOpen(txn)}
              onDelete={() => onDelete(txn)}
            />
          </React.Fragment>
        ))}
      </Card>
    </div>
  )
}

export default function TransactionsPage({ ctx }) {
  const { store, t, locale, query, actions, canMutate } = ctx
  const [visibleMonths, setVisibleMonths] = React.useState(3)
  const [typeFilter, setTypeFilter] = React.useState('all')
  const [accountFilter, setAccountFilter] = React.useState(null)
  const [projectFilter, setProjectFilter] = React.useState(null)
  const [menu, setMenu] = React.useState(null)

  const currentProject = store.currentProject()
  const accounts = store.activeAccounts()
  const projects = store.activeProjects()

  // 分段加载（不是分页）：只查「当前月往前数第 N 个月的 1 号」之后的全部流水，无上界。
  const since = React.useMemo(() => {
    try {
      return monthStart(addMonths(monthKeyNow(), -(visibleMonths - 1)))
    } catch (error) {
      return null
    }
  }, [visibleMonths])

  const loaded = React.useMemo(() => {
    const all = store.allTransactions()
    // 月份运算失败的兜底：取最近 500 条。
    return since === null ? all.slice(0, 500) : all.filter((txn) => txn.occurredOn >= since)
  }, [store, store.revision, since]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = React.useMemo(() => loaded.filter((txn) => {
    if (typeFilter === 'expense' && txn.kind !== KIND.expense) return false
    if (typeFilter === 'income' && txn.kind !== KIND.income) return false
    if (typeFilter === 'transfer' && txn.kind !== KIND.transferOut && txn.kind !== KIND.transferIn) return false
    if (accountFilter && txn.accountID !== accountFilter) return false
    if (projectFilter && txn.projectID !== projectFilter) return false
    return matchesSearch(store, txn, query)
  }), [loaded, typeFilter, accountFilter, projectFilter, query, store])

  const groups = React.useMemo(() => groupByDay(filtered), [filtered])

  const hasFilter = typeFilter !== 'all' || accountFilter || projectFilter || String(query ?? '').trim().length > 0
  const accountName = accountFilter
    ? (store.account(accountFilter)?.name ?? t('tx.allAccounts'))
    : t('tx.allAccounts')
  const projectName = projectFilter
    ? (store.project(projectFilter)?.name ?? t('tx.allProjects'))
    : t('tx.allProjects')
  const typeLabel = { all: t('x.all'), expense: t('x.expense'), income: t('x.income'), transfer: t('x.transfer') }[typeFilter]

  const clearFilters = () => {
    setTypeFilter('all')
    setAccountFilter(null)
    setProjectFilter(null)
    actions.setQuery('')
  }

  const header = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 0 }}>
      {currentProject ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: SPACE.s2, background: fade(C.brand, 10),
          borderRadius: RADIUS.pill, padding: '8px 12px',
        }}
        >
          <Icon name={currentProject.systemImage || 'folder'} size={12} color={C.brand} />
          <span className="lg-clamp-1" style={{ fontSize: 12, color: C.ink, flex: '1 1 auto' }}>
            {t('tx.recordingInto', currentProject.name)}
          </span>
          {canMutate ? (
            <button
              type="button"
              className="lg-btn"
              aria-label={t('tx.clearCurrentProject')}
              onClick={() => actions.clearCurrentProject()}
            >
              <Icon name="xmark.circle.fill" size={14} color={C.muted} />
            </button>
          ) : null}
        </div>
      ) : null}

      <SummaryCard store={store} t={t} />

      <div className="lg-chips">
        <Chip
          label={typeLabel}
          selected={typeFilter !== 'all'}
          onClick={() => setMenu('type')}
        />
        <Chip label={accountName} selected={!!accountFilter} onClick={() => setMenu('account')} />
        {projects.length > 0 ? (
          <Chip label={projectName} selected={!!projectFilter} onClick={() => setMenu('project')} />
        ) : null}
        {hasFilter ? (
          <button
            type="button"
            className="lg-btn"
            onClick={clearFilters}
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.brand, fontSize: 12, flex: '0 0 auto', padding: '7px 4px' }}
          >
            <Icon name="xmark.circle" size={12} color={C.brand} />
            <span>{t('tx.clearFilters')}</span>
          </button>
        ) : null}
      </div>
    </div>
  )

  const footer = (
    <div style={{ padding: `0 ${SPACE.s4}px`, paddingBottom: 96 }}>
      {groups.length > 0 ? (
        <button
          type="button"
          className="lg-btn"
          onClick={() => setVisibleMonths((count) => count + 3)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
            height: 44, borderRadius: RADIUS.field, background: fade(C.brand, 10), color: C.brand, fontSize: 15,
          }}
        >
          <Icon name="clock.arrow.circlepath" size={15} color={C.brand} />
          <span>{t('tx.loadOlder')}</span>
        </button>
      ) : null}
    </div>
  )

  const empty = loaded.length === 0
    ? <EmptyState icon="tray" title={t('tx.emptyTitle')} body={t('tx.emptyBody')} />
    : <EmptyState icon="line.3.horizontal.decrease.circle" title={t('tx.noMatchTitle')} body={t('tx.noMatchBody')} />

  return (
    <>
      <VirtualList
        className="lg-scroll"
        style={{ flex: '1 1 auto' }}
        items={groups}
        keyExtractor={(group) => group.day}
        estimatedRowHeight={140}
        restoreKey="transactions"
        header={header}
        footer={groups.length === 0
          ? <div style={{ padding: `${SPACE.s6}px ${SPACE.s4}px 96px` }}>{empty}</div>
          : footer}
        renderRow={(group) => (
          <div style={{ padding: `0 ${SPACE.s4}px` }}>
            <DayGroup
              store={store}
              group={group}
              t={t}
              locale={locale}
              canMutate={canMutate}
              onOpen={actions.editEntry}
              onDelete={actions.deleteEntry}
            />
          </div>
        )}
      />

      <Menu
        open={menu === 'type'}
        onClose={() => setMenu(null)}
        items={[
          { id: 'all', label: t('x.all'), selected: typeFilter === 'all', onSelect: () => setTypeFilter('all') },
          { id: 'expense', label: t('x.expense'), selected: typeFilter === 'expense', onSelect: () => setTypeFilter('expense') },
          { id: 'income', label: t('x.income'), selected: typeFilter === 'income', onSelect: () => setTypeFilter('income') },
          { id: 'transfer', label: t('x.transfer'), selected: typeFilter === 'transfer', onSelect: () => setTypeFilter('transfer') },
        ]}
      />
      <Menu
        open={menu === 'account'}
        onClose={() => setMenu(null)}
        items={[
          { id: 'all', label: t('tx.allAccounts'), selected: !accountFilter, onSelect: () => setAccountFilter(null) },
          ...accounts.map((account) => ({
            id: account.id, label: account.name, selected: accountFilter === account.id,
            onSelect: () => setAccountFilter(account.id),
          })),
        ]}
      />
      <Menu
        open={menu === 'project'}
        onClose={() => setMenu(null)}
        items={[
          { id: 'all', label: t('tx.allProjects'), selected: !projectFilter, onSelect: () => setProjectFilter(null) },
          ...projects.map((project) => ({
            id: project.id, label: project.name, selected: projectFilter === project.id,
            onSelect: () => setProjectFilter(project.id),
          })),
        ]}
      />
    </>
  )
}
