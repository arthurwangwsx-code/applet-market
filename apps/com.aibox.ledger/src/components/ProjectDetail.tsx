// 项目详情（LedgerProjectDetailView）+ 成员与 AA 结算区块（LedgerMemberSettleSection）。

import React from 'react'
import Icon, { IconBadge } from './Icon.js'
import { Card, Divider, EmptyState, ProgressBar, useLongPress } from './primitives.js'
import { ChartLegend, DonutChart } from './Charts.js'
import { C, RADIUS, SPACE, alpha, fade } from './theme.js'
import { KIND } from '../lib/store.js'
import { buckets, filterTransactions } from '../lib/queries.js'
import { memberBalances, projectIncomeMinor, projectSpentMinor, settlementPlan } from '../lib/split.js'
import { money, moneyCompact } from '../lib/money.js'
import { mediumDayDate, shortDate } from '../lib/dates.js'
import { entryPathTitle } from '../lib/display.js'
import type { LedgerTransaction, LedgerUIContext, Member, MenuItem, Project } from '../types.js'

export default function ProjectDetail({ ctx, projectID }: { ctx: LedgerUIContext; projectID: string }) {
  const { store, t, locale, actions, canMutate } = ctx
  const project = store.project(projectID)
  if (!project) {
    return (
      <div className="lg-scroll" style={{ flex: '1 1 auto', padding: SPACE.s4 }}>
        <EmptyState icon="folder" title={t('prj.notFoundTitle')} body={t('prj.notFoundBody')} />
      </div>
    )
  }

  const spent = projectSpentMinor(store, project.id)
  const income = projectIncomeMinor(store, project.id)
  const flowRows = filterTransactions(store, { projectID: project.id })
  const allRows = filterTransactions(store, { projectID: project.id, includeNonFlow: true }).slice(0, 50)
  const labels = { uncategorized: t('x.uncategorized'), noTag: t('x.noTag'), noProject: t('x.noProject') }
  const categoryBuckets = buckets(store, flowRows, 'byCategory', 'expense', locale, labels)
  const ratio = project.budgetMinor > 0 ? Math.max(0, Math.min(1, spent / project.budgetMinor)) : 0
  const over = project.budgetMinor > 0 && spent > project.budgetMinor
  const dateRange =
    project.startOn || project.endOn
      ? [
          project.startOn ? mediumDayDate(project.startOn, locale) : '',
          project.endOn ? mediumDayDate(project.endOn, locale) : '',
        ]
          .filter(Boolean)
          .join(' – ')
      : null

  return (
    <div className="lg-scroll" style={{ flex: '1 1 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 96 }}>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE.s2 }}>
            <IconBadge
              name={project.systemImage}
              size={52}
              color={project.colorHex}
              background={alpha(project.colorHex, 0.16)}
            />
            <span style={{ fontSize: 12, color: C.muted }}>{t('prj.spent')}</span>
            <span className="lg-mono" style={{ fontSize: 32, fontWeight: 500, color: C.ink }}>
              {money(spent, store.baseCode)}
            </span>
            <div
              style={{
                display: 'flex',
                gap: SPACE.s5,
                marginTop: SPACE.s2,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <Stat label={t('prj.entries')} value={String(flowRows.length)} />
              {income > 0 ? <Stat label={t('x.income')} value={moneyCompact(income, store.baseCode)} /> : null}
              {dateRange ? <Stat label={t('prj.dates')} value={dateRange} /> : null}
            </div>
          </div>
        </Card>

        {project.budgetMinor > 0 ? (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: SPACE.s3 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{t('x.budget')}</span>
              <div style={{ flex: '1 1 auto' }} />
              <span className="lg-mono" style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>
                {`${money(spent, store.baseCode)} / ${money(project.budgetMinor, store.baseCode)}`}
              </span>
            </div>
            <ProgressBar progress={ratio} height={10} color={over ? C.expense : C.brand} />
            <div style={{ marginTop: SPACE.s2, fontSize: 12, color: over ? C.expense : C.muted }}>
              {over
                ? t('prj.overBy', money(spent - project.budgetMinor, store.baseCode))
                : t('prj.left', money(project.budgetMinor - spent, store.baseCode))}
            </div>
          </Card>
        ) : null}

        {categoryBuckets.length > 0 ? (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: SPACE.s3 }}>
              {t('rep.byCategory')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s4 }}>
              <DonutChart buckets={categoryBuckets} size={150} />
              <ChartLegend buckets={categoryBuckets} currency={store.baseCode} />
            </div>
          </Card>
        ) : null}

        <MemberSettleSection ctx={ctx} project={project} />

        <Card padding={0}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.muted,
              padding: `${SPACE.s4}px ${SPACE.s4}px ${SPACE.s2}px`,
            }}
          >
            {t('prj.entries')}
          </div>
          {allRows.length === 0 ? (
            <div
              style={{ padding: `0 ${SPACE.s4}px ${SPACE.s4}px`, fontSize: 15, color: C.muted, textAlign: 'center' }}
            >
              {t('prj.noEntries')}
            </div>
          ) : (
            allRows.map((txn, index) => (
              <React.Fragment key={txn.id}>
                {index > 0 ? <Divider inset={SPACE.s4} /> : null}
                <ProjectEntryRow ctx={ctx} txn={txn} canMutate={canMutate} />
              </React.Fragment>
            ))
          )}
        </Card>

        {canMutate ? (
          <button
            type="button"
            className="lg-btn"
            onClick={() => actions.recordIntoProject(project)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              height: 50,
              borderRadius: RADIUS.field,
              background: C.brand,
              color: C.onAccent,
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            <Icon name="checkmark.circle.fill" size={18} color={C.onAccent} />
            <span>{t('prj.recordInto')}</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
      <span className="lg-mono" style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>
        {value}
      </span>
    </div>
  )
}

function ProjectEntryRow({
  ctx,
  txn,
  canMutate,
}: {
  ctx: LedgerUIContext
  txn: LedgerTransaction
  canMutate: boolean
}) {
  const { store, t, locale, actions } = ctx
  const longPress = useLongPress(() => {
    if (!canMutate) return
    actions.showMenu([
      {
        id: 'delete',
        label: t('x.delete'),
        icon: 'trash',
        destructive: true,
        onSelect: () => actions.deleteEntry(txn),
      },
    ])
  })
  const title = txn.categoryID
    ? entryPathTitle(store, txn, t)
    : txn.note && txn.note.trim().length > 0
      ? txn.note.trim()
      : shortDate(txn.occurredOn, locale)
  const subtitle = [shortDate(txn.occurredOn, locale), txn.note]
    .filter((piece) => piece && String(piece).trim().length > 0)
    .join(' · ')
  const tone = txn.kind === KIND.income ? C.income : txn.kind === KIND.expense ? C.ink : C.muted
  const text =
    txn.kind === KIND.income
      ? money(txn.amountMinor, txn.currency, { signed: true })
      : txn.kind === KIND.expense
        ? money(-txn.amountMinor, txn.currency)
        : money(txn.amountMinor, txn.currency)

  return (
    <button
      type="button"
      className="lg-btn"
      onClick={() => actions.editEntry(txn)}
      {...longPress}
      style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="lg-clamp-1" style={{ fontSize: 15, color: C.ink }}>
          {title}
        </span>
        <span className="lg-clamp-1" style={{ fontSize: 12, color: C.muted }}>
          {subtitle}
        </span>
      </div>
      <span className="lg-mono" style={{ fontSize: 15, fontWeight: 500, color: tone }}>
        {text}
      </span>
    </button>
  )
}

/** 成员与分摊区块 —— 整块一张卡。 */
function MemberSettleSection({ ctx, project }: { ctx: LedgerUIContext; project: Project }) {
  const { store, t, actions, canMutate } = ctx
  const members = store.projectMembers(project.id)
  const others = members.filter((row) => !row.isMe)
  const net = React.useMemo(
    () => memberBalances(store, project.id),
    [store, store.revision, project.id], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const plan = React.useMemo(
    () => settlementPlan(store, project.id),
    [store, store.revision, project.id], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: SPACE.s3 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{t('prj.membersSplit')}</span>
        <div style={{ flex: '1 1 auto' }} />
        {canMutate ? (
          <button
            type="button"
            className="lg-btn"
            aria-label={t('prj.addMember')}
            onClick={() => actions.addMember(project)}
          >
            <Icon name="person.badge.plus" size={15} color={C.brand} />
          </button>
        ) : null}
      </div>

      {others.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
          <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>{t('prj.membersIntro')}</span>
          {canMutate ? (
            <button
              type="button"
              className="lg-btn"
              onClick={() => actions.addMember(project)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                height: 44,
                borderRadius: RADIUS.field,
                background: fade(C.brand, 12),
                color: C.brand,
                fontSize: 15,
              }}
            >
              <Icon name="person.2.badge.plus" size={16} color={C.brand} />
              <span>{t('prj.addMembers')}</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
          {members.map((member) => (
            <MemberRow key={member.id} ctx={ctx} member={member} amount={net[member.id] ?? 0} canMutate={canMutate} />
          ))}
          <Divider />
          {plan.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="checkmark.seal.fill" size={13} color={C.income} />
              <span style={{ fontSize: 13, color: C.muted }}>{t('prj.allSettled')}</span>
            </div>
          ) : (
            <>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: C.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {t('prj.settleUp')}
              </span>
              {plan.map((row) => {
                const from = store.member(row.fromMemberID)
                const to = store.member(row.toMemberID)
                return (
                  <div
                    key={`${row.fromMemberID}-${row.toMemberID}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span className="lg-clamp-1" style={{ fontSize: 14, color: C.ink }}>
                      {from ? from.name : '—'}
                    </span>
                    <Icon name="arrow.right" size={11} color={C.muted} />
                    <span className="lg-clamp-1" style={{ fontSize: 14, color: C.ink }}>
                      {to ? to.name : '—'}
                    </span>
                    <span
                      className="lg-mono"
                      style={{ fontSize: 14, fontWeight: 500, color: C.brand, flex: '1 1 auto' }}
                    >
                      {money(row.amountMinor, store.baseCode)}
                    </span>
                    {canMutate ? (
                      <button
                        type="button"
                        className="lg-btn"
                        onClick={() => actions.settleUp(project, row)}
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: C.onAccent,
                          background: C.brand,
                          borderRadius: RADIUS.pill,
                          padding: '5px 12px',
                          flex: '0 0 auto',
                        }}
                      >
                        {t('prj.settle')}
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </Card>
  )
}

function MemberRow({
  ctx,
  member,
  amount,
  canMutate,
}: {
  ctx: LedgerUIContext
  member: Member
  amount: number
  canMutate: boolean
}) {
  const { store, t, actions } = ctx
  const longPress = useLongPress(() => {
    if (!canMutate) return
    const items: MenuItem[] = [
      { id: 'edit', label: t('x.edit'), icon: 'pencil', onSelect: () => actions.editMember(member) },
    ]
    if (!member.isMe) {
      items.push({
        id: 'remove',
        label: t('x.remove'),
        icon: 'person.badge.minus',
        destructive: true,
        onSelect: () => actions.removeMember(member),
      })
    }
    actions.showMenu(items)
  })
  const tone = amount > 0 ? C.income : amount < 0 ? C.expense : C.muted
  const initial = (member.name || '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <div {...longPress} style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          flex: '0 0 auto',
          background: alpha(member.colorHex, 0.18),
          color: member.colorHex,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {initial}
      </div>
      <span className="lg-clamp-1" style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>
        {member.name}
      </span>
      {member.isMe ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: C.muted,
            background: fade(C.muted, 12),
            borderRadius: RADIUS.pill,
            padding: '1px 6px',
            flex: '0 0 auto',
          }}
        >
          {t('prj.me')}
        </span>
      ) : null}
      <div style={{ flex: '1 1 auto' }} />
      <span className="lg-mono" style={{ fontSize: 14, fontWeight: 500, color: tone }}>
        {amount === 0 ? money(0, store.baseCode) : money(amount, store.baseCode, { signed: true })}
      </span>
    </div>
  )
}
