// 根级弹层清单 —— 一一对应原生的「根视图弹层」那一组：
// 记一笔 / AI 面板 / 账户编辑器 / 项目编辑器 / 预算编辑器 / 成员编辑器 / 余额校准 /
// 汇率编辑 / 币种管理 / 添加币种 / CSV 导入预览 / 最近删除。
//
// 每个「保存」都在写完之后看 `store.lastMutationSucceeded`（经 failIfNeeded）——
// 写失败时弹层**不关闭**，也不假装成功。

import React from 'react'
import { Sheet, SheetButton } from './primitives.js'
import { C, SPACE } from './theme.js'
import EntryEditor from './EntryEditor.js'
import SplitEditor from './SplitEditor.js'
import CurrencyManager from './CurrencyManager.js'
import RecentlyDeleted from './RecentlyDeleted.js'
import CSVImportPreview from './CSVImportPreview.js'
import AIPanel from './AIPanel.js'
import { AccountEditor, BudgetEditor, MemberEditor, ProjectEditor, RateEditor, ReconcileSheet } from './Editors.js'
import type {
  AccountFormValue,
  BudgetFormValue,
  MemberFormValue,
  ProjectFormValue,
  RateFormValue,
  ReconcileFormValue,
} from './Editors.js'
import {
  addMember,
  createAccount,
  createProject,
  setRate,
  updateAccount,
  updateMember,
  updateProject,
  upsertBudget,
} from '../lib/entities.js'
import { setBalance } from '../lib/balances.js'
import { performImport } from '../lib/csv.js'
import { nativeAlert } from '../lib/host.js'
import type { LedgerSheetState, LedgerUIContext, MenuItem, TransactionSplit, Translate } from '../types.js'

type SheetSetter = React.Dispatch<React.SetStateAction<LedgerSheetState | null>>
type BaseSubmitRef = React.MutableRefObject<() => { valid: boolean }>

interface OverflowItemsProps {
  t: Translate
  caps: { ai: boolean; share: boolean; picker: boolean }
  canMutate: boolean
  setSheet: SheetSetter
  doExport: () => Promise<void>
  doImport: () => Promise<void>
}

interface SheetsProps {
  sheet: LedgerSheetState | null
  setSheet: SheetSetter
  ctx: LedgerUIContext
  submitRef: BaseSubmitRef
  failIfNeeded: () => Promise<boolean>
}

interface FormSheetProps {
  title: string
  detent?: number
  body: React.ReactNode
  onSave: () => void | Promise<void>
  saveLabel?: string
}

/** ⋯ 菜单固定顺序：AI 分析（仅有 AI 时）/ 导出 CSV / 导入 CSV / 最近删除。 */
export function overflowItems({ t, caps, canMutate, setSheet, doExport, doImport }: OverflowItemsProps): MenuItem[] {
  const items: MenuItem[] = []
  if (caps.ai) items.push({ id: 'ai', label: t('menu.ai'), icon: 'sparkles', onSelect: () => setSheet({ kind: 'ai' }) })
  if (caps.share)
    items.push({ id: 'export', label: t('menu.exportCSV'), icon: 'square.and.arrow.up', onSelect: doExport })
  if (caps.picker && canMutate) {
    items.push({ id: 'import', label: t('menu.importCSV'), icon: 'square.and.arrow.down', onSelect: doImport })
  }
  items.push({
    id: 'deleted',
    label: t('menu.recentlyDeleted'),
    icon: 'trash',
    onSelect: () => setSheet({ kind: 'recentlyDeleted' }),
  })
  return items
}

export default function Sheets({ sheet, setSheet, ctx, submitRef, failIfNeeded }: SheetsProps) {
  if (!sheet) return null
  const { store, t } = ctx
  const close = () => setSheet(null)

  const formSheet = ({ title, detent, body, onSave, saveLabel }: FormSheetProps) => (
    <Sheet
      open
      onClose={close}
      title={title}
      detent={detent}
      leading={<SheetButton onClick={close}>{t('x.cancel')}</SheetButton>}
      trailing={
        <SheetButton bold onClick={onSave}>
          {saveLabel ?? t('x.save')}
        </SheetButton>
      }
    >
      {body}
    </Sheet>
  )

  switch (sheet.kind) {
    case 'entry':
      // 记一笔是全高面板（自带底部计算器键盘），不走通用 formSheet。
      return (
        <div
          className="lg-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <div className="lg-sheet" style={{ height: 'calc(100dvh - 40px)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: `${SPACE.s3}px ${SPACE.s4}px`,
                borderBottom: `1px solid ${C.line}`,
                flex: '0 0 auto',
              }}
            >
              <SheetButton onClick={close}>{t('x.cancel')}</SheetButton>
              <span style={{ flex: '1 1 auto', textAlign: 'center', fontSize: 16, fontWeight: 500 }}>
                {sheet.editing ? t('ent.edit') : t('ent.new')}
              </span>
              <span style={{ minWidth: 44 }} />
            </div>
            <EntryEditor ctx={ctx} editing={sheet.editing} onClose={close} />
          </div>
        </div>
      )

    case 'account':
      return formSheet({
        title: sheet.editing ? t('acc.edit') : t('acc.new'),
        body: (
          <AccountEditor
            ctx={ctx}
            editing={sheet.editing}
            onSubmit={submitRef as React.MutableRefObject<() => AccountFormValue>}
          />
        ),
        onSave: async () => {
          const value = (submitRef as React.MutableRefObject<() => AccountFormValue>).current()
          if (!value.valid) return
          if (sheet.editing) await updateAccount(store, sheet.editing.id, value)
          else await createAccount(store, value)
          if (await failIfNeeded()) close()
        },
      })

    case 'project':
      return formSheet({
        title: sheet.editing ? t('prj.edit') : t('prj.new'),
        body: (
          <ProjectEditor
            ctx={ctx}
            editing={sheet.editing}
            onSubmit={submitRef as React.MutableRefObject<() => ProjectFormValue>}
          />
        ),
        onSave: async () => {
          const value = (submitRef as React.MutableRefObject<() => ProjectFormValue>).current()
          if (!value.valid) return
          if (sheet.editing) await updateProject(store, sheet.editing.id, value)
          else await createProject(store, value)
          if (await failIfNeeded()) close()
        },
      })

    case 'budget':
      return formSheet({
        title: t('x.budget'),
        detent: 360,
        body: (
          <BudgetEditor
            ctx={ctx}
            monthKey={ctx.monthKey}
            categoryID={sheet.categoryID}
            onSubmit={submitRef as React.MutableRefObject<() => BudgetFormValue>}
          />
        ),
        onSave: async () => {
          const value = (submitRef as React.MutableRefObject<() => BudgetFormValue>).current()
          await upsertBudget(store, value.monthKey, value.categoryID, value.limitMinor, value.carryover)
          if (await failIfNeeded()) close()
        },
      })

    case 'member':
      return formSheet({
        title: sheet.editing ? t('prj.editMember') : t('prj.newMember'),
        detent: 320,
        body: (
          <MemberEditor
            ctx={ctx}
            editing={sheet.editing}
            order={store.projectMembers(sheet.projectID).length}
            onSubmit={submitRef as React.MutableRefObject<() => MemberFormValue>}
          />
        ),
        onSave: async () => {
          const value = (submitRef as React.MutableRefObject<() => MemberFormValue>).current()
          if (!value.valid) return
          if (sheet.editing) await updateMember(store, sheet.editing.id, value)
          else await addMember(store, sheet.projectID, value)
          if (await failIfNeeded()) close()
        },
      })

    case 'reconcile':
      return formSheet({
        title: sheet.account.name,
        detent: 320,
        body: (
          <ReconcileSheet
            ctx={ctx}
            account={sheet.account}
            onSubmit={submitRef as React.MutableRefObject<() => ReconcileFormValue>}
          />
        ),
        onSave: async () => {
          const value = (submitRef as React.MutableRefObject<() => ReconcileFormValue>).current()
          if (!value.valid || value.targetMinor === null) return
          await setBalance(store, sheet.account, value.targetMinor)
          if (await failIfNeeded()) close()
        },
      })

    case 'rate':
      return formSheet({
        title: sheet.code,
        detent: 280,
        body: (
          <RateEditor ctx={ctx} code={sheet.code} onSubmit={submitRef as React.MutableRefObject<() => RateFormValue>} />
        ),
        onSave: async () => {
          const value = (submitRef as React.MutableRefObject<() => RateFormValue>).current()
          if (!value.valid) return
          await setRate(store, value.code, value.rate)
          if (await failIfNeeded()) setSheet({ kind: 'currencies' })
        },
      })

    case 'split':
      return formSheet({
        title: t('ent.split'),
        saveLabel: t('x.done'),
        body: (
          <SplitEditor
            ctx={ctx}
            request={sheet.request}
            onSubmit={submitRef as React.MutableRefObject<() => { split: TransactionSplit | null; valid: boolean }>}
          />
        ),
        onSave: () => {
          const value = (
            submitRef as React.MutableRefObject<() => { split: TransactionSplit | null; valid: boolean }>
          ).current()
          if (!value.valid) return
          sheet.request.onDone(value.split)
          close()
        },
      })

    case 'currencies':
      return (
        <Sheet
          open
          onClose={close}
          title={t('acc.currencies')}
          leading={<SheetButton onClick={close}>{t('x.done')}</SheetButton>}
        >
          <CurrencyManager ctx={ctx} />
        </Sheet>
      )

    case 'addCurrency':
      return (
        <Sheet
          open
          onClose={() => setSheet({ kind: 'currencies' })}
          title={t('cur.add')}
          leading={<SheetButton onClick={() => setSheet({ kind: 'currencies' })}>{t('x.cancel')}</SheetButton>}
        >
          <CurrencyManager ctx={ctx} mode="add" />
        </Sheet>
      )

    case 'recentlyDeleted':
      return (
        <Sheet
          open
          onClose={close}
          title={t('menu.recentlyDeleted')}
          trailing={
            <SheetButton bold onClick={close}>
              {t('x.done')}
            </SheetButton>
          }
        >
          <RecentlyDeleted ctx={ctx} />
        </Sheet>
      )

    case 'csvPreview': {
      const draft = sheet.draft
      // 「导入」**仅当「有效行非空 且 问题数为 0」才可点**。
      const importable = (draft.rows ?? []).length > 0 && (draft.problems ?? []).length === 0
      return (
        <Sheet
          open
          onClose={close}
          title={t('csv.title')}
          leading={<SheetButton onClick={close}>{t('x.cancel')}</SheetButton>}
          trailing={
            <SheetButton
              bold
              disabled={!importable}
              onClick={async () => {
                const result = await performImport(store, draft.rows)
                close()
                await nativeAlert({
                  title: t('import.complete'),
                  message: t('import.summary', result.imported, result.skipped, result.failed),
                })
              }}
            >
              {t('csv.import')}
            </SheetButton>
          }
        >
          <CSVImportPreview ctx={ctx} draft={draft} />
        </Sheet>
      )
    }

    case 'ai':
      return (
        <Sheet
          open
          onClose={close}
          title={t('ai.title')}
          trailing={
            <SheetButton bold onClick={close}>
              {t('x.done')}
            </SheetButton>
          }
        >
          <AIPanel ctx={ctx} />
        </Sheet>
      )

    default:
      return null
  }
}
