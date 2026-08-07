import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// 理财（com.aibox.finance）—— FinancePluginKit 的 React 复刻。
//
// 根职责：装配 store / ledger / quotes / alerts → 接宿主外壳（tabs / toolbar / ai / notifications）
// → 注册 23 个 `finance_*` AI 工具 → 路由子页与弹层 → 跑刷新循环。
// 宿主能力缺席时全部走自绘降级件（见 components/Shell.jsx），不留点了没反应的按钮。
import React from 'react';
import { THEME_CSS } from './components/theme.js';
import { NavBar, StorageBanner, TabBar, ToolbarButton } from './components/Shell.js';
import WatchlistPage from './components/WatchlistPage.js';
import IndustryPage from './components/IndustryPage.js';
import PortfolioPage from './components/PortfolioPage.js';
import SettingsPage, { GroupsSheet } from './components/SettingsPage.js';
import DetailPage from './components/DetailPage.js';
import SearchPage from './components/SearchPage.js';
import TradePanel from './components/TradePanel.js';
import AlertPanel from './components/AlertPanel.js';
import StrategyPage from './components/StrategyPage.js';
import AIPanel, { buildContext } from './components/AIPanel.js';
import { AccountsSheet, CashFlowSheet, HistorySheet } from './components/AccountsPage.js';
import { FinanceStore } from './lib/store.js';
import { Ledger } from './lib/ledger.js';
import { QuoteService } from './lib/quotes.js';
import { AlertStore, isPercentCondition, isUpwardCondition } from './lib/alerts.js';
import { registerTools } from './lib/tools.js';
import { useSubpageStack } from 'aibox/ui';
import { INDEX_ROWS, decimalsFor, resolveSymbol } from './lib/symbol.js';
import { formatPercent, formatPrice } from './lib/format.js';
import { aiAvailability, capabilities, onEvent, onNamespaceEvent, openChat, scheduleNotification } from './lib/host.js';
import { currentLocale, makeT, onLocaleChanged } from './i18n/index.js';
const TABS = [
    { id: 'markets', titleKey: 'finance.tab.markets', icon: 'chart.line.uptrend.xyaxis' },
    { id: 'industry', titleKey: 'finance.tab.industry', icon: 'square.grid.2x2' },
    { id: 'portfolio', titleKey: 'finance.tab.portfolio', icon: 'wallet.pass' },
    { id: 'settings', titleKey: 'finance.tab.settings', icon: 'gearshape' },
];
function useForceRender() {
    const [, setTick] = React.useState(0);
    return React.useCallback(() => setTick((n) => n + 1), []);
}
function useThemeSetup() {
    React.useEffect(() => {
        if (document.getElementById('__finance_css__'))
            return;
        const style = document.createElement('style');
        style.id = '__finance_css__';
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
    const rerender = useForceRender();
    const [locale, setLocale] = React.useState(currentLocale);
    const t = React.useMemo(() => makeT(locale), [locale]);
    const refs = React.useRef(null);
    if (refs.current === null) {
        const store = new FinanceStore();
        refs.current = { store, ledger: new Ledger(), quotes: new QuoteService(), alerts: new AlertStore(store) };
    }
    const { store, ledger, quotes, alerts } = refs.current;
    const [ready, setReady] = React.useState(false);
    const [tab, setTab] = React.useState('markets');
    // 子页栈 = 宿主原生页栈的镜像（框架资产 `aibox/ui`）：进详情走 `aibox.navigation.push`，
    // 返回一律经 popstate 回来，于是最左缘左滑是**系统自己的** interactive pop。
    const subpages = useSubpageStack({ pathFor: routePath, titleFor: (row) => row.title });
    const [sheet, setSheet] = React.useState(null);
    const [aiSession, setAISession] = React.useState(null);
    const [refreshing, setRefreshing] = React.useState(false);
    const [accountID, setAccountID] = React.useState(null);
    const [shell, setShell] = React.useState({ tabsRendered: false, toolbarRendered: false });
    const [hasAI, setHasAI] = React.useState(false);
    React.useEffect(() => {
        const offs = [store.subscribe(rerender), ledger.subscribe(rerender), quotes.subscribe(rerender)];
        return () => offs.forEach((off) => off());
    }, [store, ledger, quotes, rerender]);
    React.useEffect(() => onLocaleChanged(setLocale), []);
    // —— 启动：hydrate 磁盘快照秒显 → 再拉网络 ——
    React.useEffect(() => {
        let cancelled = false;
        const boot = async () => {
            await Promise.all([store.load(), ledger.load()]);
            if (cancelled)
                return;
            const saved = await store.loadQuotes();
            if (cancelled)
                return;
            if (saved)
                quotes.hydrate(saved.rows, saved.lastUpdated);
            quotes.refreshInterval = store.settings.refreshInterval;
            quotes.source = store.settings.quoteSource;
            setAccountID((current) => current || (ledger.primaryAccount() || {}).id || null);
            setReady(true);
        };
        boot();
        return () => {
            cancelled = true;
        };
    }, [store, ledger, quotes]);
    // 设置变化要立刻改写行情服务的 TTL 与故障切换策略。
    React.useEffect(() => {
        quotes.refreshInterval = store.settings.refreshInterval;
        quotes.source = store.settings.quoteSource;
    }, [quotes, store.settings.refreshInterval, store.settings.quoteSource]);
    React.useEffect(() => {
        let cancelled = false;
        const probe = async () => {
            const info = capabilities.ai ? await aiAvailability() : { available: false };
            if (!cancelled)
                setHasAI(!!info.available && capabilities.chat);
        };
        probe();
        return () => {
            cancelled = true;
        };
    }, []);
    // —— 刷新（§2.5）——
    //
    // 每轮的标的 = **7 个指数 + 全部自选**（不只当前可见分组）+ 持仓。
    // 刷完做三件事：① 检查到价提醒并推本地通知 ② 写磁盘快照（节流 20s）③ 更新 lastUpdated。
    const busy = React.useRef(false);
    const refresh = React.useCallback(async (force) => {
        if (busy.current)
            return; // 并发保护：正在刷新时直接返回
        busy.current = true;
        setRefreshing(true);
        try {
            const symbols = [
                ...INDEX_ROWS.map((row) => row.canonical),
                ...store.items.map((row) => row.instrumentSymbol),
                ...ledger.positions.filter((row) => row.quantity > 0).map((row) => row.instrumentSymbol),
            ];
            const result = await quotes.refresh(symbols, { force });
            await quotes.exchangeRates({ force });
            const fired = await alerts.check(result.quotes, Date.now());
            for (const hit of fired) {
                if (!store.settings.notifyAlerts)
                    break;
                const symbol = resolveSymbol(hit.alert.instrumentSymbol);
                const decimals = symbol ? decimalsFor(symbol.market) : 2;
                const current = isPercentCondition(hit.alert.conditionRaw)
                    ? formatPercent(hit.quote.changePct)
                    : formatPrice(hit.quote.price, decimals);
                const target = isPercentCondition(hit.alert.conditionRaw)
                    ? formatPercent(hit.alert.targetPrice)
                    : formatPrice(hit.alert.targetPrice, decimals);
                await scheduleNotification({
                    title: `${hit.alert.name} · ${t('finance.notify.title')}`,
                    body: t(isUpwardCondition(hit.alert.conditionRaw) ? 'finance.notify.above' : 'finance.notify.below', current, target),
                    afterMinutes: 0,
                });
            }
            await store.persistQuotes(quotes.snapshot(), quotes.lastUpdated, { force });
        }
        finally {
            busy.current = false;
            setRefreshing(false);
        }
    }, [store, ledger, quotes, alerts, t]);
    // 进页刷一次；自动刷新开着则按间隔循环。任务 id = 自选串 + 开关 + 间隔，任一变化就重启。
    const watchKey = store.items.map((row) => row.instrumentSymbol).join(',');
    React.useEffect(() => {
        if (!ready)
            return undefined;
        refresh(false);
        if (!store.settings.autoRefresh)
            return undefined;
        const timer = window.setInterval(() => refresh(false), Math.max(10, store.settings.refreshInterval) * 1000);
        return () => window.clearInterval(timer);
    }, [ready, watchKey, store.settings.autoRefresh, store.settings.refreshInterval]); // eslint-disable-line react-hooks/exhaustive-deps
    // 退出/后台时强制落盘最新行情（原生的退出按钮就是先 persistNow 再关小应用）。
    React.useEffect(() => onEvent('lifecycle.background', () => {
        store.persistQuotes(quotes.snapshot(), quotes.lastUpdated, { force: true });
    }), [store, quotes]);
    // —— 宿主外壳接线 ——
    const openSearchRef = React.useRef(null);
    const openAIRef = React.useRef(null);
    // 外壳接线只跑一次，而 reset 要在每次切 Tab 时清掉子页栈 —— 经 ref 取最新那一个。
    const resetRef = React.useRef(subpages.reset);
    resetRef.current = subpages.reset;
    React.useEffect(() => {
        let cancelled = false;
        const offs = [];
        const wire = async () => {
            const api = window.aibox;
            if (api && api.tabs && typeof api.tabs.getState === 'function') {
                try {
                    const state = await api.tabs.getState();
                    if (!cancelled && state && state.rendered) {
                        setShell((current) => ({ ...current, tabsRendered: true }));
                        if (isTabID(state.selected))
                            setTab(state.selected);
                    }
                }
                catch (error) {
                    /* 宿主没这能力：留给自绘 TabBar */
                }
                offs.push(onNamespaceEvent('tabs', 'changed', (payload) => {
                    if (!isRecord(payload))
                        return;
                    // `rendered` 会**在挂载之后翻转**（形态切换、控制器重建都会重发 changed）。
                    // 只在启动那一刻判断一次，自绘 TabBar 就会永远缺席或永远多一条。
                    const rendered = payload.rendered !== false;
                    setShell((current) => current.tabsRendered === rendered ? current : { ...current, tabsRendered: rendered });
                    if (isTabID(payload.selected)) {
                        setTab(payload.selected);
                        resetRef.current();
                    }
                }));
            }
            if (api && api.toolbar && typeof api.toolbar.getState === 'function') {
                try {
                    const state = await api.toolbar.getState();
                    if (!cancelled && state)
                        setShell((current) => ({ ...current, toolbarRendered: state.rendered !== false }));
                }
                catch (error) {
                    /* 同上 */
                }
                offs.push(onNamespaceEvent('toolbar', 'invoke', (payload) => {
                    if (!isRecord(payload))
                        return;
                    if (payload.id === 'search' && openSearchRef.current)
                        openSearchRef.current();
                    if (payload.id === 'ai' && openAIRef.current)
                        openAIRef.current();
                }));
            }
        };
        wire();
        return () => {
            cancelled = true;
            offs.forEach((off) => off && off());
        };
    }, []);
    // 没有 AI 就把 ✨ 隐藏——不留死按钮。
    React.useEffect(() => {
        const api = window.aibox;
        if (api && api.toolbar && typeof api.toolbar.update === 'function') {
            api.toolbar.update({ items: { ai: { hidden: !hasAI } } }).catch(() => { });
        }
    }, [hasAI]);
    // —— 注册 23 个 finance_* 工具 ——
    React.useEffect(() => {
        if (!ready)
            return;
        registerTools({ store, ledger, quotes, alerts });
    }, [ready, store, ledger, quotes, alerts]);
    // —— 路由与动作 ——
    const { push: navigate, back } = subpages;
    const openDetail = React.useCallback((canonical) => {
        const symbol = resolveSymbol(canonical);
        if (!symbol)
            return;
        navigate({ name: 'detail', canonical, symbol, title: store.instrumentName(canonical) });
    }, [navigate, store]);
    const askAI = React.useCallback(async ({ identity, seed }) => {
        const context = buildContext({ t, locale, store, quotes, ledger, settings: store.settings });
        await openChat({ prompt: `${context}\n\n${seed}`, categoryKey: 'finance', autoSend: true, identity });
    }, [t, locale, store, quotes, ledger]);
    const valuation = ready && accountID ? ledger.valuation(accountID, quotes.quoteMap(), quotes.fx) : null;
    const perf = ready && accountID ? ledger.performance(accountID) : null;
    const ctx = React.useMemo(() => ({
        t,
        locale,
        store,
        ledger,
        quotes,
        alerts,
        settings: store.settings,
        accountID,
        valuation,
        perf,
        hasAI,
        refreshing,
        quoteVersion: quotes.lastUpdated,
        actions: {
            navigate,
            back,
            refresh,
            openDetail,
            openSearch: () => setSheet({ name: 'search' }),
            openAccounts: () => setSheet({ name: 'accounts' }),
            openCashFlow: () => setSheet({ name: 'cashflow' }),
            openHistory: () => setSheet({ name: 'history' }),
            openGroups: () => setSheet({ name: 'groups' }),
            openTrade: (canonical, symbol, name) => setSheet({ name: 'trade', canonical, symbol, symbolName: name }),
            openAlert: (canonical, symbol, name) => setSheet({ name: 'alert', canonical, symbol, symbolName: name }),
            openStrategy: (canonical, symbol, name) => setSheet({ name: 'strategy', canonical, symbol, symbolName: name }),
            selectAccount: (id) => setAccountID(id),
            toggleWatch: (canonical, name) => store.isWatched(canonical) ? store.removeWatch(canonical) : store.addWatch(canonical, { name }),
            removeWatch: (canonical) => store.removeWatch(canonical),
            askAI,
            askAboutSymbol: (canonical, name, quote) => setAISession({
                identity: `finance:${canonical}`,
                symbolName: `${name}（${canonical}）${quote ? ` ${formatPrice(quote.price, 2)} ${formatPercent(quote.changePct)}` : ''}`,
            }),
        },
    }), [
        t,
        locale,
        store,
        ledger,
        quotes,
        alerts,
        store.version,
        ledger.version,
        quotes.lastUpdated,
        accountID,
        valuation,
        perf,
        hasAI,
        refreshing,
        navigate,
        back,
        refresh,
        openDetail,
        askAI,
    ]); // eslint-disable-line react-hooks/exhaustive-deps
    openSearchRef.current = ctx.actions.openSearch;
    openAIRef.current = () => setAISession({ identity: 'finance:root' });
    const { route } = subpages;
    const currentTab = TABS.find((row) => row.id === tab) ?? TABS[0];
    const title = route ? route.title : t(currentTab.titleKey);
    React.useEffect(() => {
        document.title = title;
        const api = window.aibox;
        if (api && api.navigation && typeof api.navigation.setTitle === 'function')
            api.navigation.setTitle(title);
    }, [title]);
    const selectTab = (next) => {
        setTab(next);
        subpages.reset();
        const api = window.aibox;
        if (api && api.tabs && typeof api.tabs.select === 'function')
            api.tabs.select(next).catch(() => { });
    };
    const closeSheet = () => setSheet(null);
    const sheetName = sheet ? sheet.name : null;
    return (_jsxs("div", { className: "fin-root", children: [!shell.toolbarRendered ? (_jsx(NavBar, { title: title, onBack: route ? back : undefined, backLabel: t('finance.cancel'), trailing: !route ? (_jsxs(_Fragment, { children: [hasAI ? (_jsx(ToolbarButton, { icon: "sparkles", label: t('finance.ai.title'), onClick: () => openAIRef.current?.() })) : null, _jsx(ToolbarButton, { icon: "magnifyingglass", label: t('finance.search.title'), onClick: ctx.actions.openSearch })] })) : null })) : null, !store.storageHealthy ? _jsx(StorageBanner, { text: t('finance.storage.banner') }) : null, !ready ? (_jsx("div", { className: "fin-scroll" })) : route ? (route.name === 'detail' ? (_jsx(DetailPage, { ctx: ctx, route: route })) : null) : (_jsxs(_Fragment, { children: [tab === 'markets' ? _jsx(WatchlistPage, { ctx: ctx }) : null, tab === 'industry' ? _jsx(IndustryPage, { ctx: ctx }) : null, tab === 'portfolio' ? _jsx(PortfolioPage, { ctx: ctx }) : null, tab === 'settings' ? _jsx(SettingsPage, { ctx: ctx }) : null] })), !shell.tabsRendered ? (_jsx(TabBar, { items: TABS.map((row) => ({ ...row, title: t(row.titleKey) })), selected: tab, onSelect: selectTab })) : (_jsx("div", { style: { height: 'env(safe-area-inset-bottom)', flex: '0 0 auto' } })), _jsx(SearchPage, { ctx: ctx, visible: sheetName === 'search', onClose: closeSheet }), _jsx(AccountsSheet, { ctx: ctx, visible: sheetName === 'accounts', onClose: closeSheet }), _jsx(CashFlowSheet, { ctx: ctx, visible: sheetName === 'cashflow', onClose: closeSheet }), _jsx(HistorySheet, { ctx: ctx, visible: sheetName === 'history', onClose: closeSheet }), _jsx(GroupsSheet, { ctx: ctx, visible: sheetName === 'groups', onClose: closeSheet }), _jsx(TradePanel, { ctx: ctx, visible: sheetName === 'trade', onClose: closeSheet, route: sheet && sheet.name === 'trade' ? { ...sheet, name: sheet.symbolName } : null }), _jsx(AlertPanel, { ctx: ctx, visible: sheetName === 'alert', onClose: closeSheet, route: sheet && sheet.name === 'alert' ? { ...sheet, name: sheet.symbolName } : null }), _jsx(StrategyPage, { ctx: ctx, visible: sheetName === 'strategy', onClose: closeSheet, route: sheet && sheet.name === 'strategy' ? { ...sheet, name: sheet.symbolName } : null }), _jsx(AIPanel, { ctx: ctx, session: aiSession, onClose: () => setAISession(null) })] }));
}
/** 子页在 history 里的路径。页面自己不读它，只为宿主诊断与 `navigation.getState().url` 可读。 */
function routePath(route) {
    return `#/detail/${encodeURIComponent(route.canonical)}`;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function isTabID(value) {
    return TABS.some((tab) => tab.id === value);
}
