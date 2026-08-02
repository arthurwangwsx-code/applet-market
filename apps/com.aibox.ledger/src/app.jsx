// 记账（com.aibox.ledger）—— LedgerPluginKit 的 React 复刻。
//
// 根职责：打开账本（含首启种子）→ 接宿主外壳（tabs / toolbar / menu / ui / picker / share / ai）
// → 路由五个 Tab 与详情页 → 托管全部弹层 → 把 8 个 `ledger_*` 工具注册给 AI。
//
// 两条贯穿全局的纪律：
//  1. **写失败必须显式失败**：任何写完都看 `store.lastMutationSucceeded`，失败就切只读、
//     挂顶部横幅、隐藏 FAB、禁用写入口，绝不吞掉异常后照常刷新 UI；
//  2. **没有的能力就不渲染入口**：AI / 文件选择 / 分享 都先探测。

import React from 'react'
import { THEME_CSS, C, SPACE } from './components/theme.js'
import { FAB, NavBar, ReadOnlyBanner, SearchField, TabBar, ToolbarButton, UndoBar } from './components/Shell.jsx'
import { Menu, Sheet, SheetButton } from './components/primitives.jsx'
import TransactionsPage from './components/TransactionsPage.jsx'
import ReportsPage from './components/ReportsPage.jsx'
import AccountsPage, { AccountDetail } from './components/AccountsPage.jsx'
import BudgetPage from './components/BudgetPage.jsx'
import ProjectsPage from './components/ProjectsPage.jsx'
import ProjectDetail from './components/ProjectDetail.jsx'
import EntryEditor from './components/EntryEditor.jsx'
import SplitEditor from './components/SplitEditor.jsx'
import CurrencyManager from './components/CurrencyManager.jsx'
import RecentlyDeleted from './components/RecentlyDeleted.jsx'
import CSVImportPreview from './components/CSVImportPreview.jsx'
import AIPanel from './components/AIPanel.jsx'
import {
  AccountEditor, BudgetEditor, MemberEditor, ProjectEditor, RateEditor, ReconcileSheet,
} from './components/Editors.jsx'
import { KIND, LedgerStore } from './lib/store.js'
import {
  deleteEntry, purgeEntry, recordEntry, recordTransfer, restoreEntry, updateEntry,
} from './lib/entries.js'
import {
  activateProject, addCurrency, addMember, applyFetchedRates, archiveAccount, createAccount,
  createProject, removeMember, setBaseCurrency, setRate, updateAccount, updateMember,
  updateProject, upsertBudget,
} from './lib/entities.js'
import { setBalance } from './lib/balances.js'
import { recordSettlement } from './lib/split.js'
import { fetchRates } from './lib/fx.js'
import { exportCSV, exportFilename, parseImport, performImport } from './lib/csv.js'
import { monthKeyNow } from './lib/dates.js'
import { rememberAccount, rememberCategory } from './lib/prefs.js'
import { money } from './lib/money.js'
import {
  aiAvailability, capabilities, httpGetJSON, nativeAlert, nativeConfirm, onNamespaceEvent,
  pickTextFile, shareFile, tapFeedback,
} from './lib/host.js'
import { registerLedgerActions } from './lib/register-actions.js'
import { currentLocale, makeT, onLocaleChanged } from './i18n/index.js'

const TABS = [
  { id: 'transactions', titleKey: 'tab.transactions', icon: 'list.bullet.rectangle' },
  { id: 'reports', titleKey: 'tab.reports', icon: 'chart.pie' },
  { id: 'accounts', titleKey: 'tab.accounts', icon: 'wallet.pass', selectedIcon: 'wallet.pass.fill' },
  { id: 'budget', titleKey: 'tab.budget', icon: 'target' },
  { id: 'projects', titleKey: 'tab.projects', icon: 'folder', selectedIcon: 'folder.fill' },
]

const FAB_LABEL = {
  transactions: 'fab.addEntry',
  reports: 'fab.addEntry',
  accounts: 'fab.addAccount',
  budget: 'fab.setBudget',
  projects: 'fab.newProject',
}

function useThemeSetup() {
  React.useEffect(() => {
    if (document.getElementById('__ledger_css__')) return
    const style = document.createElement('style')
    style.id = '__ledger_css__'
    style.textContent = THEME_CSS
    document.head.appendChild(style)
  }, [])
  React.useEffect(() => {
    const query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const apply = () => {
      document.documentElement.setAttribute('data-prefers-color-scheme', query && query.matches ? 'dark' : 'light')
    }
    apply()
    if (query && query.addEventListener) {
      query.addEventListener('change', apply)
      return () => query.removeEventListener('change', apply)
    }
    return undefined
  }, [])
}

export default function App() {
  useThemeSetup()
  const [, setTick] = React.useState(0)
  const rerender = React.useCallback(() => setTick((n) => n + 1), [])

  const [locale, setLocale] = React.useState(currentLocale)
  const t = React.useMemo(() => makeT(locale), [locale])

  const storeRef = React.useRef(null)
  if (storeRef.current === null) storeRef.current = new LedgerStore()
  const store = storeRef.current

  const [ready, setReady] = React.useState(false)
  const [tab, setTab] = React.useState('transactions')
  const [route, setRoute] = React.useState(null)
  const [query, setQuery] = React.useState('')
  const [monthKey, setMonthKey] = React.useState(monthKeyNow)
  const [sheet, setSheet] = React.useState(null)
  const [menuItems, setMenuItems] = React.useState(null)
  const [undo, setUndo] = React.useState(null)
  const [shell, setShell] = React.useState({ tabs: false, toolbar: false, search: false })
  const [caps, setCaps] = React.useState({ ai: false, picker: false, share: false })

  const submitRef = React.useRef(() => ({ valid: false }))

  React.useEffect(() => store.subscribe(rerender), [store, rerender])
  React.useEffect(() => onLocaleChanged(setLocale), [])

  // 启动：**先拿到 locale 再开库** —— 首启种子分类/账户名按当时的 App 内语言物化，之后永不回灌。
  React.useEffect(() => {
    let cancelled = false
    const boot = async () => {
      await store.open(currentLocale())
      if (!cancelled) setReady(true)
    }
    boot()
    return () => { cancelled = true }
  }, [store])

  // 能力探测：拿不到就整块不渲染入口。
  React.useEffect(() => {
    let cancelled = false
    const probe = async () => {
      const ai = capabilities.ai ? await aiAvailability() : { available: false }
      if (cancelled) return
      setCaps({
        ai: !!ai.available,
        picker: capabilities.picker && capabilities.resource,
        share: capabilities.shareFile || capabilities.shareText,
      })
    }
    probe()
    return () => { cancelled = true }
  }, [])

  const labels = React.useMemo(() => ({
    uncategorized: t('x.uncategorized'), noTag: t('x.noTag'), noProject: t('x.noProject'),
  }), [t])

  // 8 个 AI 工具（延迟工具，headless 可用）。
  const contextRef = React.useRef(null)
  contextRef.current = { store, locale, labels }
  React.useEffect(() => registerLedgerActions(() => contextRef.current), [])

  // —— 写操作：**每一步都看 lastMutationSucceeded** ——

  const failIfNeeded = React.useCallback(async () => {
    if (store.lastMutationSucceeded) return true
    await nativeAlert({ title: t('ent.saveFailedTitle'), message: t('ent.saveFailedBody') })
    return false
  }, [store, t])

  const doExport = React.useCallback(async () => {
    const outcome = await shareFile({
      filename: exportFilename(),
      content: exportCSV(store),
      mimeType: 'text/csv',
    })
    if (outcome === 'text') await nativeAlert({ title: t('menu.exportCSV'), message: t('csv.exportedAsText') })
  }, [store, t])

  const doImport = React.useCallback(async () => {
    const picked = await pickTextFile(['text/csv', 'public.comma-separated-values-text', '.csv'])
    if (!picked.ok) return
    setSheet({ kind: 'csvPreview', draft: parseImport(picked.text, store) })
  }, [store])

  // 宿主外壳接线。
  React.useEffect(() => {
    let cancelled = false
    const offs = []
    const wire = async () => {
      const api = window.aibox
      if (api && api.tabs && typeof api.tabs.getState === 'function') {
        try {
          const state = await api.tabs.getState()
          if (!cancelled && state && state.rendered) {
            setShell((current) => ({ ...current, tabs: true }))
            if (state.selected) setTab(state.selected)
          }
        } catch (error) { /* 宿主没这能力：留给自绘 TabBar */ }
        offs.push(onNamespaceEvent('tabs', 'changed', (state) => {
          if (state && state.selected) { setTab(state.selected); setRoute(null) }
        }))
      }
      if (api && api.toolbar && typeof api.toolbar.getState === 'function') {
        try {
          const state = await api.toolbar.getState()
          if (!cancelled && state) {
            setShell((current) => ({
              ...current,
              toolbar: state.rendered !== false,
              search: !!(state.search && state.search.rendered),
            }))
          }
        } catch (error) { /* 同上 */ }
        offs.push(onNamespaceEvent('toolbar', 'searchChanged', (payload) => {
          setQuery(String((payload && payload.query) || ''))
        }))
      }
    }
    wire()
    return () => { cancelled = true; offs.forEach((off) => off && off()) }
  }, [])

  // ⋯ 菜单里的四项经 manifest.actions + scene.menu 落到这些回调（每轮重注册，闭包总是最新的）。
  React.useEffect(() => {
    const api = window.aibox
    if (!api || !api.action || typeof api.action.register !== 'function') return
    api.action.register('openAI', () => { setSheet({ kind: 'ai' }); return null })
    api.action.register('exportCSV', () => { doExport(); return null })
    api.action.register('importCSV', () => { doImport(); return null })
    api.action.register('openRecentlyDeleted', () => { setSheet({ kind: 'recentlyDeleted' }); return null })
  })

  // 顶栏标题 + ⋯ 菜单项的显示状态。
  React.useEffect(() => {
    const api = window.aibox
    const current = TABS.find((row) => row.id === tab) ?? TABS[0]
    const title = route ? routeTitle(route, store, t) : t(current.titleKey)
    document.title = title
    if (api && api.navigation && typeof api.navigation.setTitle === 'function') api.navigation.setTitle(title)
    if (api && api.menu && typeof api.menu.update === 'function') {
      api.menu.update({
        items: {
          openAI: { hidden: !caps.ai },
          exportCSV: { hidden: !caps.share },
          importCSV: { hidden: !caps.picker, enabled: store.canMutate },
        },
      }).catch(() => {})
    }
  }, [tab, route, caps, store, store.revision, t]) // eslint-disable-line react-hooks/exhaustive-deps

  const actions = React.useMemo(() => ({
    setQuery,
    setMonthKey,
    showMenu: (items) => setMenuItems(items),
    editEntry: (txn) => setSheet({ kind: 'entry', editing: txn }),

    deleteEntry: async (txn) => {
      const result = await deleteEntry(store, txn.id)
      // 删除失败不显示撤销条（不能把「没删掉」伪装成「删掉了」）。
      if (!result.ok) { await failIfNeeded(); return }
      // ⚠️ 撤销条**没有自动消失定时器** —— 只有点「撤销」才收起，照抄原生。
      setUndo({ id: txn.id })
    },
    restoreEntry: async (txn) => { await restoreEntry(store, txn.id); await failIfNeeded() },
    purgeEntry: async (txn) => {
      const confirmed = await nativeConfirm({
        title: t('del.permanentlyQ'),
        message: t('del.permanentlyBody'),
        confirmTitle: t('del.permanently'),
        destructive: true,
      })
      if (confirmed === false) return
      await purgeEntry(store, txn.id)
      await failIfNeeded()
    },

    clearCurrentProject: async () => { await activateProject(store, null); await failIfNeeded() },
    activateProject: async (project) => { await activateProject(store, project.id); await failIfNeeded() },
    archiveProject: async (project, archived) => {
      await updateProject(store, project.id, { isArchived: archived })
      await failIfNeeded()
    },
    editProject: (project) => setSheet({ kind: 'project', editing: project }),
    openProject: (project) => setRoute({ name: 'project', id: project.id }),
    recordIntoProject: async (project) => {
      // 点「记账到此项目」会**先把该项目设为「当前项目」**再打开记一笔（副作用照抄原生）。
      await activateProject(store, project.id)
      setSheet({ kind: 'entry', editing: null })
    },

    openAccount: (account) => setRoute({ name: 'account', id: account.id }),
    editAccount: (account) => setSheet({ kind: 'account', editing: account }),
    archiveAccount: async (account) => { await archiveAccount(store, account.id, true); await failIfNeeded() },
    reconcileAccount: (account) => setSheet({ kind: 'reconcile', account }),

    openCurrencies: () => setSheet({ kind: 'currencies' }),
    openAddCurrency: () => setSheet({ kind: 'addCurrency' }),
    addCurrency: async (code) => {
      await addCurrency(store, code)
      if (!(await failIfNeeded())) return
      // 添加后自动触发一次在线刷新（拿不到就静默留空，UI 显示「缺汇率」）。
      const rates = await fetchRates(store.baseCode, httpGetJSON)
      if (rates) await applyFetchedRates(store, rates)
      setSheet({ kind: 'currencies' })
    },
    editRate: (code) => setSheet({ kind: 'rate', code }),
    setBaseCurrency: async (code) => { await setBaseCurrency(store, code); await failIfNeeded() },
    refreshRates: async () => {
      const rates = await fetchRates(store.baseCode, httpGetJSON)
      if (!rates) return false
      const applied = await applyFetchedRates(store, rates)
      return applied.ok
    },

    editBudget: (categoryID) => setSheet({ kind: 'budget', categoryID }),

    addMember: async (project) => {
      // 项目还没有「我」成员时，先自动创建一个名为「我 / Me」的 isMe 成员，再弹编辑器。
      if (store.projectMembers(project.id).length === 0) {
        await addMember(store, project.id, { name: t('prj.meName'), isMe: true })
        if (!(await failIfNeeded())) return
      }
      setSheet({ kind: 'member', projectID: project.id, editing: null })
    },
    editMember: (member) => setSheet({ kind: 'member', projectID: member.projectID, editing: member }),
    removeMember: async (member) => { await removeMember(store, member.id); await failIfNeeded() },
    settleUp: async (project, row) => {
      const from = store.member(row.fromMemberID)
      const to = store.member(row.toMemberID)
      const confirmed = await nativeConfirm({
        title: t('prj.recordSettlement', from ? from.name : '', to ? to.name : '',
          money(row.amountMinor, store.baseCode)),
        message: t('prj.settleConfirm'),
        confirmTitle: t('prj.settle'),
      })
      if (confirmed === false) return
      await recordSettlement(store, project.id, row.fromMemberID, row.toMemberID, row.amountMinor)
      await failIfNeeded()
    },
    openSplitEditor: (request) => setSheet({ kind: 'split', request }),

    saveEntry: async (payload, editing) => {
      if (editing) {
        const result = await updateEntry(store, editing.id, {
          amountMinor: payload.amountMinor,
          calculationExpression: payload.calculationExpression,
          categoryID: payload.categoryID,
          accountID: payload.accountID,
          projectID: payload.projectID,
          payerMemberID: payload.payerMemberID,
          split: payload.split,
          merchant: payload.merchant,
          note: payload.note,
          occurredOn: payload.occurredOn,
          tags: payload.tags,
          reimbursable: payload.reimbursable,
          refundOfID: payload.refundOfID,
        })
        if (!result.ok) {
          await nativeAlert({ title: t('ent.saveFailedTitle'), message: t('ent.saveFailedBody') })
          return false
        }
        return true
      }
      const result = payload.type === 'transfer'
        ? await recordTransfer(store, {
          fromAccountID: payload.accountID,
          toAccountID: payload.toAccountID,
          amountMinor: payload.amountMinor,
          occurredOn: payload.occurredOn,
          note: payload.note,
          merchant: payload.merchant,
          tags: payload.tags,
          projectID: payload.projectID,
          calculationExpression: payload.calculationExpression,
        })
        : await recordEntry(store, {
          kind: payload.type === 'income' ? KIND.income : KIND.expense,
          amountMinor: payload.amountMinor,
          calculationExpression: payload.calculationExpression,
          categoryID: payload.categoryID,
          accountID: payload.accountID,
          projectID: payload.projectID,
          payerMemberID: payload.payerMemberID,
          split: payload.split,
          merchant: payload.merchant,
          note: payload.note,
          occurredOn: payload.occurredOn,
          tags: payload.tags,
          reimbursable: payload.reimbursable,
          refundOfID: payload.refundOfID,
        })
      if (!result.ok) {
        await nativeAlert({ title: t('ent.saveFailedTitle'), message: t('ent.saveFailedBody') })
        return false
      }
      rememberAccount(payload.type, payload.accountID)
      if (payload.categoryID) rememberCategory(payload.type === 'income' ? 'income' : 'expense', payload.categoryID)
      tapFeedback()
      return true
    },
  }), [store, t, failIfNeeded])

  const canMutate = store.canMutate
  const ctx = React.useMemo(() => ({
    store, t, locale, query, monthKey, canMutate, actions, labels, storeRevision: store.revision,
  }), [store, store.revision, t, locale, query, monthKey, canMutate, actions, labels]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentTab = TABS.find((row) => row.id === tab) ?? TABS[0]
  // FAB 隐藏条件：只读，或「在项目 Tab 且已 push 进项目详情页」（详情页底部有自己的主按钮）。
  const showFAB = canMutate && !(tab === 'projects' && route && route.name === 'project')

  const onFAB = () => {
    if (tab === 'accounts') setSheet({ kind: 'account', editing: null })
    else if (tab === 'budget') setSheet({ kind: 'budget', categoryID: null })
    else if (tab === 'projects') setSheet({ kind: 'project', editing: null })
    else setSheet({ kind: 'entry', editing: null })
  }

  const selectTab = (next) => {
    setTab(next)
    setRoute(null)
    const api = window.aibox
    if (api && api.tabs && typeof api.tabs.select === 'function') api.tabs.select(next).catch(() => {})
  }

  return (
    <div className="lg-root">
      {(!shell.toolbar || route) ? (
        <NavBar
          title={route ? routeTitle(route, store, t) : t(currentTab.titleKey)}
          onBack={route ? () => setRoute(null) : undefined}
          backLabel={t('x.close')}
          trailing={!route && !shell.toolbar ? (
            <>
              {caps.ai ? (
                <ToolbarButton icon="sparkles" label={t('menu.ai')} onClick={() => setSheet({ kind: 'ai' })} />
              ) : null}
              <ToolbarButton
                icon="ellipsis"
                label={t('x.moreActions')}
                tint={C.ink}
                onClick={() => setMenuItems(overflowItems({ t, caps, canMutate, setSheet, doExport, doImport }))}
              />
            </>
          ) : null}
        />
      ) : null}

      {!canMutate && ready ? <ReadOnlyBanner title={t('readonly.title')} body={t('readonly.body')} /> : null}

      {!route && !shell.search && tab === 'transactions' ? (
        <SearchField value={query} onChange={setQuery} placeholder={t('tx.search')} />
      ) : null}

      {!ready ? <div className="lg-scroll" /> : (route ? (
        route.name === 'account'
          ? <AccountDetail ctx={ctx} accountID={route.id} />
          : <ProjectDetail ctx={ctx} projectID={route.id} />
      ) : (
        <>
          {tab === 'transactions' ? <TransactionsPage ctx={ctx} /> : null}
          {tab === 'reports' ? <ReportsPage ctx={ctx} /> : null}
          {tab === 'accounts' ? <AccountsPage ctx={ctx} /> : null}
          {tab === 'budget' ? <BudgetPage ctx={ctx} /> : null}
          {tab === 'projects' ? <ProjectsPage ctx={ctx} /> : null}
        </>
      ))}

      {undo ? (
        <UndoBar
          message={t('tx.deleted')}
          actionLabel={t('tx.undo')}
          bottomOffset={shell.tabs ? 8 : 68}
          onUndo={async () => { await restoreEntry(store, undo.id); setUndo(null) }}
        />
      ) : null}

      {showFAB ? <FAB label={t(FAB_LABEL[tab])} onClick={onFAB} /> : null}

      {!shell.tabs ? (
        <TabBar
          items={TABS.map((row) => ({ ...row, title: t(row.titleKey) }))}
          selected={tab}
          onSelect={selectTab}
        />
      ) : (
        <div style={{ height: 'env(safe-area-inset-bottom)', background: C.bg, flex: '0 0 auto' }} />
      )}

      <Menu open={!!menuItems} onClose={() => setMenuItems(null)} items={menuItems ?? []} />
      {renderSheet({ sheet, setSheet, ctx, submitRef, store, t, failIfNeeded })}
    </div>
  )
}

function routeTitle(route, store, t) {
  if (route.name === 'account') return store.account(route.id)?.name ?? t('tab.accounts')
  return store.project(route.id)?.name ?? t('tab.projects')
}

/** ⋯ 菜单固定顺序：AI 分析（仅有 AI 时）/ 导出 CSV / 导入 CSV / 最近删除。 */
function overflowItems({ t, caps, canMutate, setSheet, doExport, doImport }) {
  const items = []
  if (caps.ai) items.push({ id: 'ai', label: t('menu.ai'), icon: 'sparkles', onSelect: () => setSheet({ kind: 'ai' }) })
  if (caps.share) items.push({ id: 'export', label: t('menu.exportCSV'), icon: 'square.and.arrow.up', onSelect: doExport })
  if (caps.picker && canMutate) {
    items.push({ id: 'import', label: t('menu.importCSV'), icon: 'square.and.arrow.down', onSelect: doImport })
  }
  items.push({
    id: 'deleted', label: t('menu.recentlyDeleted'), icon: 'trash',
    onSelect: () => setSheet({ kind: 'recentlyDeleted' }),
  })
  return items
}

/** 全部弹层集中在根上，一一对应原生的「根级弹层清单」。 */
function renderSheet({ sheet, setSheet, ctx, submitRef, store, t, failIfNeeded }) {
  if (!sheet) return null
  const close = () => setSheet(null)

  const formSheet = ({ title, detent, body, onSave, saveLabel }) => (
    <Sheet
      open
      onClose={close}
      title={title}
      detent={detent}
      leading={<SheetButton onClick={close}>{t('x.cancel')}</SheetButton>}
      trailing={<SheetButton bold onClick={onSave}>{saveLabel ?? t('x.save')}</SheetButton>}
    >
      {body}
    </Sheet>
  )

  switch (sheet.kind) {
    case 'entry':
      return (
        <div className="lg-backdrop" onClick={(event) => { if (event.target === event.currentTarget) close() }}>
          <div className="lg-sheet" style={{ height: 'calc(100dvh - 40px)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', padding: `${SPACE.s3}px ${SPACE.s4}px`,
              borderBottom: `1px solid ${C.line}`, flex: '0 0 auto',
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
        body: <AccountEditor ctx={ctx} editing={sheet.editing} onSubmit={submitRef} />,
        onSave: async () => {
          const value = submitRef.current()
          if (!value.valid) return
          if (sheet.editing) await updateAccount(store, sheet.editing.id, value)
          else await createAccount(store, value)
          if (await failIfNeeded()) close()
        },
      })

    case 'project':
      return formSheet({
        title: sheet.editing ? t('prj.edit') : t('prj.new'),
        body: <ProjectEditor ctx={ctx} editing={sheet.editing} onSubmit={submitRef} />,
        onSave: async () => {
          const value = submitRef.current()
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
        body: <BudgetEditor ctx={ctx} monthKey={ctx.monthKey} categoryID={sheet.categoryID} onSubmit={submitRef} />,
        onSave: async () => {
          const value = submitRef.current()
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
            onSubmit={submitRef}
          />
        ),
        onSave: async () => {
          const value = submitRef.current()
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
        body: <ReconcileSheet ctx={ctx} account={sheet.account} onSubmit={submitRef} />,
        onSave: async () => {
          const value = submitRef.current()
          if (!value.valid) return
          await setBalance(store, sheet.account, value.targetMinor)
          if (await failIfNeeded()) close()
        },
      })

    case 'rate':
      return formSheet({
        title: sheet.code,
        detent: 280,
        body: <RateEditor ctx={ctx} code={sheet.code} onSubmit={submitRef} />,
        onSave: async () => {
          const value = submitRef.current()
          if (!value.valid) return
          await setRate(store, value.code, value.rate)
          if (await failIfNeeded()) setSheet({ kind: 'currencies' })
        },
      })

    case 'split':
      return formSheet({
        title: t('ent.split'),
        body: <SplitEditor ctx={ctx} request={sheet.request} onSubmit={submitRef} />,
        saveLabel: t('x.done'),
        onSave: () => {
          const value = submitRef.current()
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
          trailing={<SheetButton bold onClick={close}>{t('x.done')}</SheetButton>}
        >
          <RecentlyDeleted ctx={ctx} />
        </Sheet>
      )

    case 'csvPreview': {
      const draft = sheet.draft
      // **仅当「有效行非空 且 问题数为 0」才可点**。
      const importable = (draft.rows ?? []).length > 0 && (draft.problems ?? []).length === 0
      return (
        <Sheet
          open
          onClose={close}
          title={t('csv.title')}
          leading={<SheetButton onClick={close}>{t('x.cancel')}</SheetButton>}
          trailing={(
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
          )}
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
          trailing={<SheetButton bold onClick={close}>{t('x.done')}</SheetButton>}
        >
          <AIPanel ctx={ctx} />
        </Sheet>
      )

    default:
      return null
  }
}
