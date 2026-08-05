// CSV 导入预览（LedgerCSVImportPreviewView）。
// **绝不「选文件即写库」**：这一页只读、只展示，确认后才落库。

import React from 'react'
import { IconBadge } from './Icon.js'
import { Card, Divider } from './primitives.js'
import { C, SPACE, alpha } from './theme.js'
import { KIND } from '../lib/store.js'
import { money } from '../lib/money.js'
import { shortDate } from '../lib/dates.js'

const PREVIEW_LIMIT = 100

const GLYPH = {
  [KIND.expense]: { icon: 'arrow.up.right', color: '#D9534F' },
  [KIND.income]: { icon: 'arrow.down.left', color: '#2A9D63' },
  [KIND.adjustment]: { icon: 'equal.circle', color: '#2A9D63' },
  [KIND.transferOut]: { icon: 'arrow.left.arrow.right', color: '#2A9D63' },
  [KIND.transferIn]: { icon: 'arrow.left.arrow.right', color: '#2A9D63' },
}

const KIND_LABEL_KEY = {
  [KIND.expense]: 'x.expense',
  [KIND.income]: 'x.income',
  [KIND.adjustment]: 'x.balanceAdjustment',
  [KIND.transferOut]: 'x.transfer',
  [KIND.transferIn]: 'x.transfer',
}

export default function CSVImportPreview({ ctx, draft }) {
  const { t, locale } = ctx
  const rows = draft.rows ?? []
  const problems = draft.problems ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 15, color: C.ink }}>{t('csv.validRows')}</span>
          <div style={{ flex: '1 1 auto' }} />
          <span className="lg-mono" style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>{rows.length}</span>
        </div>
        <Divider />
        <div style={{ display: 'flex', alignItems: 'center', marginTop: SPACE.s2 }}>
          <span style={{ fontSize: 15, color: C.ink }}>{t('csv.problems')}</span>
          <div style={{ flex: '1 1 auto' }} />
          <span
            className="lg-mono"
            style={{ fontSize: 15, fontWeight: 500, color: problems.length > 0 ? C.expense : C.ink }}
          >
            {problems.length}
          </span>
        </div>
      </Card>
      <span style={{ fontSize: 12, color: C.muted, padding: '0 4px', lineHeight: 1.4 }}>
        {t('csv.noWriteFooter')}
      </span>

      {problems.length > 0 ? (
        <>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.muted, padding: '0 4px' }}>
            {t('csv.importProblems')}
          </span>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
              {problems.slice(0, 50).map((problem, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.expense }}>
                    {t('csv.row', problem.row)}
                  </span>
                  <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{problem.message}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      {rows.length > 0 ? (
        <>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.muted, padding: '0 4px' }}>{t('csv.preview')}</span>
          <Card padding={0}>
            {rows.slice(0, PREVIEW_LIMIT).map((row, index) => {
              const glyph = GLYPH[row.kind] ?? GLYPH[KIND.expense]
              return (
                <React.Fragment key={`${row.line}-${row.originalID}`}>
                  {index > 0 ? <Divider inset={50} /> : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s3 }}>
                    <IconBadge
                      name={glyph.icon}
                      size={32}
                      color={glyph.color}
                      background={alpha(glyph.color, 0.16)}
                    />
                    <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="lg-clamp-1" style={{ fontSize: 15, color: C.ink }}>
                        {row.categoryPath || t(KIND_LABEL_KEY[row.kind] ?? 'x.expense')}
                      </span>
                      <span className="lg-clamp-1" style={{ fontSize: 12, color: C.muted }}>
                        {[row.accountName, shortDate(row.occurredOn, locale)].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <span className="lg-mono" style={{ fontSize: 15, color: C.ink }}>
                      {money(row.amountMinor, row.currency)}
                    </span>
                  </div>
                </React.Fragment>
              )
            })}
          </Card>
          {rows.length > PREVIEW_LIMIT ? (
            <span style={{ fontSize: 12, color: C.muted, padding: '0 4px' }}>{t('csv.first100')}</span>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
