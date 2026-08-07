// 项目页（LedgerProjectsView）。
// 「项目」= 正交于分类/账户/标签的分组维度：一笔可以同时属于项目 + 分类 + 账户 + 标签。

import React from 'react'
import { IconBadge } from './Icon.js'
import { Card, Divider, EmptyState, SectionHeader, useLongPress } from './primitives.js'
import { C, RADIUS, SPACE, alpha, fade } from './theme.js'
import { projectSpentMinor } from '../lib/split.js'
import { money, moneyCompact } from '../lib/money.js'
import { mediumDayDate } from '../lib/dates.js'
import type { LedgerUIContext, Project, Translate } from '../types.js'

export default function ProjectsPage({ ctx }: { ctx: LedgerUIContext }) {
  const { store, t, canMutate } = ctx
  const active = store.projects.filter((row) => !row.isArchived).sort((a, b) => a.sortOrder - b.sortOrder)
  const archived = store.projects.filter((row) => row.isArchived).sort((a, b) => a.sortOrder - b.sortOrder)

  if (active.length === 0 && archived.length === 0) {
    return (
      <div className="lg-scroll" style={{ flex: '1 1 auto', padding: SPACE.s4 }}>
        <EmptyState icon="folder.badge.plus" title={t('prj.emptyTitle')} body={t('prj.emptyBody')} />
      </div>
    )
  }

  return (
    <div className="lg-scroll" style={{ flex: '1 1 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 96 }}>
        {active.length > 0 ? (
          <Card padding={0}>
            {active.map((project, index) => (
              <React.Fragment key={project.id}>
                {index > 0 ? <Divider inset={60} /> : null}
                <ProjectRow ctx={ctx} project={project} canMutate={canMutate} />
              </React.Fragment>
            ))}
          </Card>
        ) : null}

        {archived.length > 0 ? (
          <div>
            <SectionHeader>{t('x.archived')}</SectionHeader>
            <Card padding={0}>
              {archived.map((project, index) => (
                <React.Fragment key={project.id}>
                  {index > 0 ? <Divider inset={60} /> : null}
                  <ProjectRow ctx={ctx} project={project} canMutate={canMutate} archived />
                </React.Fragment>
              ))}
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function subtitleFor(project: Project, t: Translate, locale: string): string | null {
  const start = project.startOn ? mediumDayDate(project.startOn, locale) : null
  const end = project.endOn ? mediumDayDate(project.endOn, locale) : null
  if (start && end) return `${start} – ${end}`
  if (start) return t('prj.since', start)
  if (end) return null // 只有止 → 不显示副标题
  return project.isActive ? t('prj.ongoing') : null
}

function ProjectRow({
  ctx,
  project,
  canMutate,
  archived = false,
}: {
  ctx: LedgerUIContext
  project: Project
  canMutate: boolean
  archived?: boolean
}) {
  const { store, t, locale, actions } = ctx
  const spent = projectSpentMinor(store, project.id)
  const subtitle = subtitleFor(project, t, locale)

  const longPress = useLongPress(() => {
    if (!canMutate) return
    const items = archived
      ? [
          {
            id: 'restore',
            label: t('x.restore'),
            icon: 'arrow.uturn.backward',
            onSelect: () => actions.archiveProject(project, false),
          },
        ]
      : [
          project.isActive
            ? {
                id: 'clear',
                label: t('prj.clearCurrent'),
                icon: 'circle.slash',
                onSelect: () => actions.clearCurrentProject(),
              }
            : {
                id: 'set',
                label: t('prj.setCurrent'),
                icon: 'checkmark.circle',
                onSelect: () => actions.activateProject(project),
              },
          { id: 'edit', label: t('x.edit'), icon: 'pencil', onSelect: () => actions.editProject(project) },
          {
            id: 'archive',
            label: t('x.archive'),
            icon: 'archivebox',
            destructive: true,
            onSelect: () => actions.archiveProject(project, true),
          },
        ]
    actions.showMenu(items)
  })

  return (
    <button
      type="button"
      className="lg-btn"
      onClick={() => actions.openProject(project)}
      {...longPress}
      style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }}
    >
      <IconBadge
        name={project.systemImage}
        size={40}
        color={project.colorHex}
        background={alpha(project.colorHex, 0.16)}
      />
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span className="lg-clamp-1" style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>
            {project.name}
          </span>
          {project.isActive ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: C.brand,
                background: fade(C.brand, 14),
                borderRadius: RADIUS.pill,
                padding: '1px 6px',
                flex: '0 0 auto',
              }}
            >
              {t('prj.current')}
            </span>
          ) : null}
        </span>
        {subtitle ? (
          <span className="lg-clamp-1" style={{ fontSize: 12, color: C.muted }}>
            {subtitle}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span className="lg-mono" style={{ fontSize: 16, fontWeight: 500, color: C.ink }}>
          {money(spent, store.baseCode)}
        </span>
        {project.budgetMinor > 0 ? (
          <span className="lg-mono" style={{ fontSize: 12, color: C.muted }}>
            {t('prj.of', moneyCompact(project.budgetMinor, store.baseCode))}
          </span>
        ) : null}
      </div>
    </button>
  )
}
