import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// 记账（com.aibox.ledger）—— LedgerPluginKit 的 React 复刻。
//
// 根职责：打开账本（含首启种子）→ 接宿主外壳（tabs / toolbar / menu / ui / picker / share / ai）
// → 路由五个 Tab 与详情页 → 托管全部弹层 → 把 8 个 `ledger_*` 工具注册给 AI。
//
// 两条贯穿全局的纪律：
//  1. **写失败必须显式失败**：任何写完都看 `store.lastMutationSucceeded`，失败就切只读、
//     挂顶部横幅、隐藏 FAB、禁用写入口，绝不吞掉异常后照常刷新 UI；
//  2. **没有的能力就不渲染入口**：AI / 文件选择 / 分享 都先探测。
import React from 'react';
import { THEME_CSS, C } from './components/theme.js';
import { FAB, NavBar, ReadOnlyBanner, SearchField, TabBar, ToolbarButton, UndoBar } from './components/Shell.js';
import { Menu } from './components/primitives.js';
import Sheets, { overflowItems } from './components/Sheets.js';
import TransactionsPage from './components/TransactionsPage.js';
import ReportsPage from './components/ReportsPage.js';
import AccountsPage, { AccountDetail } from './components/AccountsPage.js';
import BudgetPage from './components/BudgetPage.js';
import ProjectsPage from './components/ProjectsPage.js';
import ProjectDetail from './components/ProjectDetail.js';
import { KIND, LedgerStore } from './lib/store.js';
import { deleteEntry, purgeEntry, recordEntry, recordTransfer, restoreEntry, updateEntry } from './lib/entries.js';
import { activateProject, addCurrency, addMember, applyFetchedRates, archiveAccount, removeMember, setBaseCurrency, updateProject, } from './lib/entities.js';
import { recordSettlement } from './lib/split.js';
import { fetchRates } from './lib/fx.js';
import { exportCSV, exportFilename, parseImport } from './lib/csv.js';
import { monthKeyNow } from './lib/dates.js';
import { rememberAccount, rememberCategory } from './lib/prefs.js';
import { money } from './lib/money.js';
import { aiAvailability, capabilities, httpGetJSON, nativeAlert, nativeConfirm, onNamespaceEvent, pickTextFile, shareFile, tapFeedback, } from './lib/host.js';
import { registerLedgerActions } from './lib/register-actions.js';
import { useSubpageStack } from 'aibox/ui';
import { currentLocale, makeT, onLocaleChanged } from './i18n/index.js';
const TABS = [
    { id: 'transactions', titleKey: 'tab.transactions', icon: 'list.bullet.rectangle' },
    { id: 'reports', titleKey: 'tab.reports', icon: 'chart.pie' },
    { id: 'accounts', titleKey: 'tab.accounts', icon: 'wallet.pass', selectedIcon: 'wallet.pass.fill' },
    { id: 'budget', titleKey: 'tab.budget', icon: 'target' },
    { id: 'projects', titleKey: 'tab.projects', icon: 'folder', selectedIcon: 'folder.fill' },
];
const FAB_LABEL = {
    transactions: 'fab.addEntry',
    reports: 'fab.addEntry',
    accounts: 'fab.addAccount',
    budget: 'fab.setBudget',
    projects: 'fab.newProject',
};
function useThemeSetup() {
    React.useEffect(() => {
        if (document.getElementById('__ledger_css__'))
            return;
        const style = document.createElement('style');
        style.id = '__ledger_css__';
        style.textContent = THEME_CSS;
        document.head.appendChild(style);
    }, []);
    React.useEffect(() => {
        const query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        const apply = () => {
            document.documentElement.setAttribute('data-prefers-color-scheme', query && query.matches ? 'dark' : 'light');
        };
        apply();
        if (query && query.addEventListener) {
            query.addEventListener('change', apply);
            return () => query.removeEventListener('change', apply);
        }
        return undefined;
    }, []);
}
export default function App() {
    useThemeSetup();
    const [, setTick] = React.useState(0);
    const rerender = React.useCallback(() => setTick((n) => n + 1), []);
    const [locale, setLocale] = React.useState(currentLocale);
    const t = React.useMemo(() => makeT(locale), [locale]);
    // 子页标题在 push 那一刻要用最新的翻译函数，而 push 回调是稳定的 —— 经 ref 取值。
    const tRef = React.useRef(t);
    tRef.current = t;
    const storeRef = React.useRef(new LedgerStore());
    const store = storeRef.current;
    const [ready, setReady] = React.useState(false);
    const [tab, setTab] = React.useState('transactions');
    // 子页栈 = 宿主原生页栈的镜像（框架资产 `aibox/ui`）：进详情走 `aibox.navigation.push`，
    // 返回一律经 popstate 回来，于是最左缘左滑是**系统自己的** interactive pop。
    const subpages = useSubpageStack({
        pathFor: routePath,
        titleFor: (row) => routeTitle(row, storeRef.current, tRef.current),
    });
    const { route } = subpages;
    const setRoute = subpages.push;
    const [query, setQuery] = React.useState('');
    const [monthKey, setMonthKey] = React.useState(monthKeyNow);
    const [sheet, setSheet] = React.useState(null);
    const [menuItems, setMenuItems] = React.useState(null);
    const [undo, setUndo] = React.useState(null);
    const [shell, setShell] = React.useState({ tabs: false, toolbar: false, search: false });
    const [caps, setCaps] = React.useState({ ai: false, picker: false, share: false });
    const submitRef = React.useRef(() => ({ valid: false }));
    React.useEffect(() => {
        const unsubscribe = store.subscribe(rerender);
        return () => {
            unsubscribe();
        };
    }, [store, rerender]);
    React.useEffect(() => onLocaleChanged(setLocale), []);
    // 启动：**先拿到 locale 再开库** —— 首启种子分类/账户名按当时的 App 内语言物化，之后永不回灌。
    React.useEffect(() => {
        let cancelled = false;
        const boot = async () => {
            await store.open(currentLocale());
            if (!cancelled)
                setReady(true);
        };
        boot();
        return () => {
            cancelled = true;
        };
    }, [store]);
    // 能力探测：拿不到就整块不渲染入口。
    React.useEffect(() => {
        let cancelled = false;
        const probe = async () => {
            const ai = capabilities.ai ? await aiAvailability() : { available: false };
            if (cancelled)
                return;
            setCaps({
                ai: !!ai.available,
                picker: capabilities.picker && capabilities.resource,
                share: capabilities.shareFile || capabilities.shareText,
            });
        };
        probe();
        return () => {
            cancelled = true;
        };
    }, []);
    const labels = React.useMemo(() => ({
        uncategorized: t('x.uncategorized'),
        noTag: t('x.noTag'),
        noProject: t('x.noProject'),
    }), [t]);
    // 8 个 AI 工具（延迟工具，headless 可用）。
    const contextRef = React.useRef({ store, locale, labels });
    contextRef.current = { store, locale, labels };
    React.useEffect(() => registerLedgerActions(() => contextRef.current), []);
    // —— 写操作：**每一步都看 lastMutationSucceeded** ——
    const failIfNeeded = React.useCallback(async () => {
        if (store.lastMutationSucceeded)
            return true;
        await nativeAlert({ title: t('ent.saveFailedTitle'), message: t('ent.saveFailedBody') });
        return false;
    }, [store, t]);
    const doExport = React.useCallback(async () => {
        const outcome = await shareFile({
            filename: exportFilename(),
            content: exportCSV(store),
            mimeType: 'text/csv',
        });
        if (outcome === 'text')
            await nativeAlert({ title: t('menu.exportCSV'), message: t('csv.exportedAsText') });
    }, [store, t]);
    const doImport = React.useCallback(async () => {
        const picked = await pickTextFile(['text/csv', 'public.comma-separated-values-text', '.csv']);
        if (!picked.ok)
            return;
        setSheet({ kind: 'csvPreview', draft: parseImport(picked.text, store) });
    }, [store]);
    // 外壳接线只跑一次，而 reset 要在每次切 Tab 时清掉子页栈 —— 经 ref 取最新那一个。
    const resetRef = React.useRef(subpages.reset);
    resetRef.current = subpages.reset;
    // 宿主外壳接线。
    React.useEffect(() => {
        let cancelled = false;
        const offs = [];
        const wire = async () => {
            const api = window.aibox;
            if (api && api.tabs && typeof api.tabs.getState === 'function') {
                try {
                    const state = await api.tabs.getState();
                    if (!cancelled && state && state.rendered) {
                        setShell((current) => ({ ...current, tabs: true }));
                        if (isTabID(state.selected))
                            setTab(state.selected);
                    }
                }
                catch (error) {
                    /* 宿主没这能力：留给自绘 TabBar */
                }
                offs.push(onNamespaceEvent('tabs', 'changed', (state) => {
                    if (!state)
                        return;
                    // `rendered` 会**在挂载之后翻转**（形态切换、控制器重建都会重发 changed）。
                    // 只在启动那一刻判断一次，自绘 TabBar 就会永远缺席或永远多一条。
                    const rendered = state.rendered !== false;
                    setShell((current) => (current.tabs === rendered ? current : { ...current, tabs: rendered }));
                    if (isTabID(state.selected)) {
                        setTab(state.selected);
                        resetRef.current();
                    }
                }));
            }
            if (api && api.toolbar && typeof api.toolbar.getState === 'function') {
                try {
                    const state = await api.toolbar.getState();
                    if (!cancelled && state) {
                        setShell((current) => ({
                            ...current,
                            toolbar: state.rendered !== false,
                            search: !!(state.search && state.search.rendered),
                        }));
                    }
                }
                catch (error) {
                    /* 同上 */
                }
                offs.push(onNamespaceEvent('toolbar', 'searchChanged', (payload) => {
                    setQuery(String((payload && payload.query) || ''));
                }));
            }
        };
        wire();
        return () => {
            cancelled = true;
            offs.forEach((off) => off && off());
        };
    }, []);
    // ⋯ 菜单里的四项经 manifest.actions + scene.menu 落到这些回调（每轮重注册，闭包总是最新的）。
    React.useEffect(() => {
        const api = window.aibox;
        if (!api || !api.action || typeof api.action.register !== 'function')
            return;
        api.action.register('openAI', () => {
            setSheet({ kind: 'ai' });
            return null;
        });
        api.action.register('exportCSV', () => {
            doExport();
            return null;
        });
        api.action.register('importCSV', () => {
            doImport();
            return null;
        });
        api.action.register('openRecentlyDeleted', () => {
            setSheet({ kind: 'recentlyDeleted' });
            return null;
        });
    });
    // 顶栏标题 + ⋯ 菜单项的显示状态。
    React.useEffect(() => {
        const api = window.aibox;
        const current = TABS.find((row) => row.id === tab) ?? TABS[0];
        const title = route ? routeTitle(route, store, t) : t(current.titleKey);
        document.title = title;
        if (api && api.navigation && typeof api.navigation.setTitle === 'function')
            api.navigation.setTitle(title);
        if (api && api.menu && typeof api.menu.update === 'function') {
            api.menu
                .update({
                items: {
                    openAI: { hidden: !caps.ai },
                    exportCSV: { hidden: !caps.share },
                    importCSV: { hidden: !caps.picker, enabled: store.canMutate },
                },
            })
                .catch(() => { });
        }
    }, [tab, route, caps, store, store.revision, t]); // eslint-disable-line react-hooks/exhaustive-deps
    const actions = React.useMemo(() => ({
        setQuery,
        setMonthKey,
        showMenu: (items) => setMenuItems(items),
        editEntry: (txn) => setSheet({ kind: 'entry', editing: txn }),
        deleteEntry: async (txn) => {
            const result = await deleteEntry(store, txn.id);
            // 删除失败不显示撤销条（不能把「没删掉」伪装成「删掉了」）。
            if (!result.ok) {
                await failIfNeeded();
                return;
            }
            // ⚠️ 撤销条**没有自动消失定时器** —— 只有点「撤销」才收起，照抄原生。
            setUndo({ id: txn.id });
        },
        restoreEntry: async (txn) => {
            await restoreEntry(store, txn.id);
            await failIfNeeded();
        },
        purgeEntry: async (txn) => {
            const confirmed = await nativeConfirm({
                title: t('del.permanentlyQ'),
                message: t('del.permanentlyBody'),
                confirmTitle: t('del.permanently'),
                destructive: true,
            });
            if (confirmed === false)
                return;
            await purgeEntry(store, txn.id);
            await failIfNeeded();
        },
        clearCurrentProject: async () => {
            await activateProject(store, null);
            await failIfNeeded();
        },
        activateProject: async (project) => {
            await activateProject(store, project.id);
            await failIfNeeded();
        },
        archiveProject: async (project, archived) => {
            await updateProject(store, project.id, { isArchived: archived });
            await failIfNeeded();
        },
        editProject: (project) => setSheet({ kind: 'project', editing: project }),
        openProject: (project) => setRoute({ name: 'project', id: project.id }),
        recordIntoProject: async (project) => {
            // 点「记账到此项目」会**先把该项目设为「当前项目」**再打开记一笔（副作用照抄原生）。
            await activateProject(store, project.id);
            setSheet({ kind: 'entry', editing: null });
        },
        openAccount: (account) => setRoute({ name: 'account', id: account.id }),
        editAccount: (account) => setSheet({ kind: 'account', editing: account }),
        archiveAccount: async (account) => {
            await archiveAccount(store, account.id, true);
            await failIfNeeded();
        },
        reconcileAccount: (account) => setSheet({ kind: 'reconcile', account }),
        openCurrencies: () => setSheet({ kind: 'currencies' }),
        openAddCurrency: () => setSheet({ kind: 'addCurrency' }),
        addCurrency: async (code) => {
            await addCurrency(store, code);
            if (!(await failIfNeeded()))
                return;
            // 添加后自动触发一次在线刷新（拿不到就静默留空，UI 显示「缺汇率」）。
            const rates = await fetchRates(store.baseCode, httpGetJSON);
            if (rates)
                await applyFetchedRates(store, rates);
            setSheet({ kind: 'currencies' });
        },
        editRate: (code) => setSheet({ kind: 'rate', code }),
        setBaseCurrency: async (code) => {
            await setBaseCurrency(store, code);
            await failIfNeeded();
        },
        refreshRates: async () => {
            const rates = await fetchRates(store.baseCode, httpGetJSON);
            if (!rates)
                return false;
            const applied = await applyFetchedRates(store, rates);
            return applied.ok;
        },
        editBudget: (categoryID) => setSheet({ kind: 'budget', categoryID }),
        addMember: async (project) => {
            // 项目还没有「我」成员时，先自动创建一个名为「我 / Me」的 isMe 成员，再弹编辑器。
            if (store.projectMembers(project.id).length === 0) {
                await addMember(store, project.id, { name: t('prj.meName'), isMe: true });
                if (!(await failIfNeeded()))
                    return;
            }
            setSheet({ kind: 'member', projectID: project.id, editing: null });
        },
        editMember: (member) => setSheet({ kind: 'member', projectID: member.projectID, editing: member }),
        removeMember: async (member) => {
            await removeMember(store, member.id);
            await failIfNeeded();
        },
        settleUp: async (project, row) => {
            const from = store.member(row.fromMemberID);
            const to = store.member(row.toMemberID);
            const confirmed = await nativeConfirm({
                title: t('prj.recordSettlement', from ? from.name : '', to ? to.name : '', money(row.amountMinor, store.baseCode)),
                message: t('prj.settleConfirm'),
                confirmTitle: t('prj.settle'),
            });
            if (confirmed === false)
                return;
            await recordSettlement(store, project.id, row.fromMemberID, row.toMemberID, row.amountMinor);
            await failIfNeeded();
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
                });
                if (!result.ok) {
                    await nativeAlert({ title: t('ent.saveFailedTitle'), message: t('ent.saveFailedBody') });
                    return false;
                }
                return true;
            }
            if (payload.type === 'transfer' && !payload.toAccountID) {
                await nativeAlert({ title: t('ent.saveFailedTitle'), message: t('ent.saveFailedBody') });
                return false;
            }
            const transferDestinationID = payload.toAccountID ?? '';
            const result = payload.type === 'transfer'
                ? await recordTransfer(store, {
                    fromAccountID: payload.accountID,
                    toAccountID: transferDestinationID,
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
                });
            if (!result.ok) {
                await nativeAlert({ title: t('ent.saveFailedTitle'), message: t('ent.saveFailedBody') });
                return false;
            }
            rememberAccount(payload.type, payload.accountID);
            if (payload.categoryID)
                rememberCategory(payload.type === 'income' ? 'income' : 'expense', payload.categoryID);
            tapFeedback();
            return true;
        },
    }), [store, t, failIfNeeded]);
    const canMutate = store.canMutate;
    const ctx = React.useMemo(() => ({
        store,
        t,
        locale,
        query,
        monthKey,
        canMutate,
        actions,
        labels,
        storeRevision: store.revision,
    }), [store, store.revision, t, locale, query, monthKey, canMutate, actions, labels]); // eslint-disable-line react-hooks/exhaustive-deps
    const currentTab = TABS.find((row) => row.id === tab) ?? TABS[0];
    // FAB 隐藏条件：只读，或「在项目 Tab 且已 push 进项目详情页」（详情页底部有自己的主按钮）。
    const showFAB = canMutate && !(tab === 'projects' && route && route.name === 'project');
    const onFAB = () => {
        if (tab === 'accounts')
            setSheet({ kind: 'account', editing: null });
        else if (tab === 'budget')
            setSheet({ kind: 'budget', categoryID: null });
        else if (tab === 'projects')
            setSheet({ kind: 'project', editing: null });
        else
            setSheet({ kind: 'entry', editing: null });
    };
    const selectTab = (next) => {
        setTab(next);
        subpages.reset();
        const api = window.aibox;
        if (api && api.tabs && typeof api.tabs.select === 'function')
            api.tabs.select(next).catch(() => { });
    };
    return (_jsxs("div", { className: "lg-root", children: [!shell.toolbar ? (_jsx(NavBar, { title: route ? routeTitle(route, store, t) : t(currentTab.titleKey), onBack: route ? subpages.back : undefined, backLabel: t('x.close'), trailing: !route && !shell.toolbar ? (_jsxs(_Fragment, { children: [caps.ai ? (_jsx(ToolbarButton, { icon: "sparkles", label: t('menu.ai'), onClick: () => setSheet({ kind: 'ai' }) })) : null, _jsx(ToolbarButton, { icon: "ellipsis", label: t('x.moreActions'), tint: C.ink, onClick: () => setMenuItems(overflowItems({ t, caps, canMutate, setSheet, doExport, doImport })) })] })) : null })) : null, !canMutate && ready ? _jsx(ReadOnlyBanner, { title: t('readonly.title'), body: t('readonly.body') }) : null, !route && !shell.search && tab === 'transactions' ? (_jsx(SearchField, { value: query, onChange: setQuery, placeholder: t('tx.search') })) : null, !ready ? (_jsx("div", { className: "lg-scroll" })) : route ? (route.name === 'account' ? (_jsx(AccountDetail, { ctx: ctx, accountID: route.id })) : (_jsx(ProjectDetail, { ctx: ctx, projectID: route.id }))) : (_jsxs(_Fragment, { children: [tab === 'transactions' ? _jsx(TransactionsPage, { ctx: ctx }) : null, tab === 'reports' ? _jsx(ReportsPage, { ctx: ctx }) : null, tab === 'accounts' ? _jsx(AccountsPage, { ctx: ctx }) : null, tab === 'budget' ? _jsx(BudgetPage, { ctx: ctx }) : null, tab === 'projects' ? _jsx(ProjectsPage, { ctx: ctx }) : null] })), undo ? (_jsx(UndoBar, { message: t('tx.deleted'), actionLabel: t('tx.undo'), bottomOffset: shell.tabs ? 8 : 68, onUndo: async () => {
                    await restoreEntry(store, undo.id);
                    setUndo(null);
                } })) : null, showFAB ? _jsx(FAB, { label: t(FAB_LABEL[tab]), onClick: onFAB }) : null, !shell.tabs ? (_jsx(TabBar, { items: TABS.map((row) => ({ ...row, title: t(row.titleKey) })), selected: tab, onSelect: selectTab })) : (_jsx("div", { style: { height: 'env(safe-area-inset-bottom)', background: C.bg, flex: '0 0 auto' } })), _jsx(Menu, { open: !!menuItems, onClose: () => setMenuItems(null), items: menuItems ?? [] }), _jsx(Sheets, { sheet: sheet, setSheet: setSheet, ctx: ctx, submitRef: submitRef, failIfNeeded: failIfNeeded })] }));
}
/** 子页在 history 里的路径。页面自己不读它，只为宿主诊断与 `navigation.getState().url` 可读。 */
function routePath(route) {
    if (!route)
        return '#/';
    return `#/${route.name}/${encodeURIComponent(route.id || '')}`;
}
function routeTitle(route, store, t) {
    if (!route)
        return '';
    if (route.name === 'account')
        return store.account(route.id)?.name ?? t('tab.accounts');
    return store.project(route.id)?.name ?? t('tab.projects');
}
function isTabID(value) {
    return (value === 'transactions' ||
        value === 'reports' ||
        value === 'accounts' ||
        value === 'budget' ||
        value === 'projects');
}
