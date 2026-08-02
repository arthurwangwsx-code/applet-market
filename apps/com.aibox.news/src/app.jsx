// 资讯（com.aibox.news）—— NewsPluginKit 的 React 复刻。
//
// 根职责：装配 store / aggregator / broadcast → 接宿主外壳（tabs / toolbar / menu / browser / tts / ai）
// → 路由子页 → 渲染当前 Tab。宿主能力缺席时全部走自绘降级件（见 components/Shell.jsx）。

import React from 'react'
import { THEME_CSS, C } from './components/theme.js'
import { NavBar, SearchField, TabBar, ToolbarButton } from './components/Shell.jsx'
import FeedPage from './components/FeedPage.jsx'
import SourcesPage from './components/SourcesPage.jsx'
import SavedPage from './components/SavedPage.jsx'
import SettingsPage from './components/SettingsPage.jsx'
import AddSourcePage from './components/AddSourcePage.jsx'
import DiagnosticsPage from './components/DiagnosticsPage.jsx'
import ClusterDetail from './components/ClusterDetail.jsx'
import BroadcastBar, { BroadcastNotice } from './components/BroadcastBar.jsx'
import AIPanel from './components/AIPanel.jsx'
import { fetchSingleSource } from './lib/aggregator.js'
import { getSession, whenReady } from './lib/session.js'
import { registerActions } from './lib/actions.js'
import { openArticle as performOpen, knowledgeMarkdown } from './lib/reading.js'
import {
  capabilities, browserAvailability, aiAvailability, findTool, callTool, onEvent, onNamespaceEvent,
} from './lib/host.js'
import { currentLocale, makeT, onLocaleChanged } from './i18n/index.js'

// 对外提供的 4 个 AI 工具（news_search / read / source / save）+ ⋯ 菜单的朗读动作。
// **模块求值期就注册**：无头执行时页面不挂载任何组件，等 React 副作用就来不及了。
registerActions()

const TABS = [
  { id: 'feed', titleKey: 'news.tab.feed', icon: 'newspaper', selectedIcon: 'newspaper.fill' },
  { id: 'subs', titleKey: 'news.tab.subs', icon: 'dot.radiowaves.up.forward' },
  { id: 'saved', titleKey: 'news.tab.saved', icon: 'bookmark', selectedIcon: 'bookmark.fill' },
]

function useForceRender() {
  const [, setTick] = React.useState(0)
  return React.useCallback(() => setTick((n) => n + 1), [])
}

/** 主题：CSS 变量注入 + 把有效颜色方案同步给 antd-mobile 的暗色开关。 */
function useThemeSetup() {
  React.useEffect(() => {
    if (document.getElementById('__news_css__')) return
    const style = document.createElement('style')
    style.id = '__news_css__'
    style.textContent = THEME_CSS
    document.head.appendChild(style)
  }, [])
  React.useEffect(() => {
    const query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const apply = () => {
      const dark = query ? query.matches : false
      document.documentElement.setAttribute('data-prefers-color-scheme', dark ? 'dark' : 'light')
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
  const rerender = useForceRender()

  const [locale, setLocale] = React.useState(currentLocale)
  const t = React.useMemo(() => makeT(locale), [locale])

  // 与 AI 工具共用同一份状态（lib/session.js 的模块级单例），UI 只是它的一个消费方。
  const session = getSession()
  const { store, agg, broadcast } = session

  const [ready, setReady] = React.useState(false)
  const [tab, setTab] = React.useState('feed')
  const [query, setQuery] = React.useState('')
  const [stack, setStack] = React.useState([])
  const [aiSession, setAISession] = React.useState(null)
  const [now, setNow] = React.useState(() => Date.now())
  const [shell, setShell] = React.useState({ tabsRendered: false, toolbarRendered: false, searchRendered: false })
  const [caps, setCaps] = React.useState({ hasAI: false, hasTTS: false, hasKB: false, browserModes: [] })

  // —— 订阅三个模型的变化 ——
  React.useEffect(() => {
    const offs = [store.subscribe(rerender), agg.subscribe(rerender), broadcast.subscribe(rerender)]
    return () => offs.forEach((off) => off())
  }, [store, agg, broadcast, rerender])

  // —— 语言：跟随宿主有效 UI 语言，切换时重渲染而不重载 ——
  React.useEffect(() => onLocaleChanged(setLocale), [])

  // —— 相对时间每分钟走一步 ——
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  // —— 启动：hydrate 快照秒显 → 按 TTL 静默刷新（stale-while-revalidate）——
  React.useEffect(() => {
    let cancelled = false
    const boot = async () => {
      await whenReady()
      if (cancelled) return
      setReady(true)
      if (store.settings.autoRefresh) agg.refresh({ force: false })
    }
    boot()
    return () => { cancelled = true }
  }, [store, agg])

  // —— 能力探测：拿不到就整块不渲染入口，不留「点了没反应」的按钮 ——
  React.useEffect(() => {
    let cancelled = false
    const probe = async () => {
      const [ai, browser, kb] = await Promise.all([
        capabilities.ai ? aiAvailability() : Promise.resolve({ available: false }),
        browserAvailability(),
        capabilities.tools ? findTool('vault_create') : Promise.resolve(false),
      ])
      if (cancelled) return
      setCaps({
        hasAI: !!ai.available,
        hasTTS: capabilities.tts,
        hasKB: !!kb,
        browserModes: browser.modes,
      })
    }
    probe()
    return () => { cancelled = true }
  }, [])

  const openAI = React.useCallback((article) => {
    // 没有 AI 权限时整个 ✨ 入口不渲染；这里再兜一层，防宿主事件把面板顶出来。
    if (!caps.hasAI) return
    setAISession(article
      ? { identity: `news:${article.id}`, seed: t('news.ai.analyze', article.title, article.url) }
      : { identity: 'news', seed: null })
  }, [caps.hasAI, t])

  const toggleBroadcast = React.useCallback(() => {
    if (broadcast.active) broadcast.stop({ userInitiated: true })
    else broadcast.start(session.visibleArticles)
  }, [broadcast, session])

  // —— 宿主外壳接线 ——
  const openAIRef = React.useRef(openAI)
  openAIRef.current = openAI

  React.useEffect(() => {
    let cancelled = false
    const offs = []
    const wire = async () => {
      const api = window.aibox
      if (api && api.tabs && typeof api.tabs.getState === 'function') {
        try {
          const state = await api.tabs.getState()
          if (!cancelled && state && state.rendered) {
            setShell((current) => ({ ...current, tabsRendered: true }))
            if (state.selected) setTab(state.selected)
          }
        } catch (error) { /* 宿主没这能力：留给自绘 TabBar */ }
        offs.push(onNamespaceEvent('tabs', 'changed', (state) => {
          if (state && state.selected) { setTab(state.selected); setStack([]) }
        }))
      }
      if (api && api.toolbar && typeof api.toolbar.getState === 'function') {
        try {
          const state = await api.toolbar.getState()
          if (!cancelled && state) {
            setShell((current) => ({
              ...current,
              toolbarRendered: state.rendered !== false,
              searchRendered: !!(state.search && state.search.rendered),
            }))
          }
        } catch (error) { /* 同上 */ }
        offs.push(onNamespaceEvent('toolbar', 'invoke', (payload) => {
          if (payload && payload.id === 'ai') openAIRef.current(null)
        }))
        offs.push(onNamespaceEvent('toolbar', 'searchChanged', (payload) => {
          setQuery(String((payload && payload.query) || ''))
        }))
      }
      // ⋯ 菜单里的「朗读 / 停止朗读」经 manifest.actions + scene.menu 落到 lib/actions.js 的
      // `toggleBroadcast`（已在模块求值期注册），这里不再重复注册。
      offs.push(onEvent('lifecycle.background', () => { agg.persistNow() }))
    }
    wire()
    return () => { cancelled = true; offs.forEach((off) => off && off()) }
  }, [agg])

  // —— 顶栏标题与四态右上角 ——
  const showBroadcast = tab === 'feed' && caps.hasTTS && agg.timeline.length > 0
  React.useEffect(() => {
    const api = window.aibox
    const current = TABS.find((row) => row.id === tab) || TABS[0]
    const title = stack.length > 0 ? routeTitle(stack[stack.length - 1], t) : t(current.titleKey)
    document.title = title
    if (api && api.navigation && typeof api.navigation.setTitle === 'function') api.navigation.setTitle(title)
    if (api && api.toolbar && typeof api.toolbar.update === 'function') {
      api.toolbar.update({ items: { ai: { hidden: !caps.hasAI }, more: { hidden: !showBroadcast } } }).catch(() => {})
    }
    if (api && api.menu && typeof api.menu.update === 'function') {
      api.menu.update({
        items: {
          listen: {
            hidden: !showBroadcast,
            title: t(broadcast.active ? 'news.action.stopListening' : 'news.action.listen'),
          },
        },
      }).catch(() => {})
    }
  }, [tab, stack, caps.hasAI, showBroadcast, broadcast.active, t])

  const readKeys = React.useMemo(() => store.readKeys, [store, store.version]) // eslint-disable-line react-hooks/exhaustive-deps
  const savedKeys = React.useMemo(() => store.savedKeys, [store, store.version]) // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = React.useCallback((route) => setStack((rows) => [...rows, route]), [])
  const back = React.useCallback(() => setStack((rows) => rows.slice(0, -1)), [])

  const ctx = React.useMemo(() => ({
    t,
    locale,
    now,
    store,
    agg,
    broadcast,
    settings: store.settings,
    storeVersion: store.version,
    readVersion: store.version,
    readKeys,
    savedKeys,
    query,
    searchRendered: shell.searchRendered,
    hasAI: caps.hasAI,
    hasTTS: caps.hasTTS,
    hasKnowledgeCapture: caps.hasKB,
    speakingId: broadcast.active && broadcast.current ? broadcast.current.id : null,
    actions: {
      navigate,
      back,
      refresh: (force) => agg.refresh({ force }),
      setVisibleArticles: (list) => { session.visibleArticles = list },
      fetchSource: async (feed) => {
        const result = await fetchSingleSource(feed, store.settings)
        return result.articles
      },
      openArticle: (article) => performOpen(article, { store, settings: store.settings }),
      openCluster: (item) => navigate({ name: 'cluster', title: item.lead.title, articles: [item.lead, ...item.related] }),
      toggleSaved: (article) => (store.savedKeys.has(article.id) ? store.unsave(article.id) : store.save(article)),
      unsave: (id) => store.unsave(id),
      toggleRead: (article) => (store.readKeys.has(article.id) ? store.markUnread(article.id) : store.markRead(article)),
      removeHistory: (key) => store.removeHistory(key),
      analyze: (article) => openAI(article),
      askAI: (seed) => setAISession({ identity: 'news', seed }),
      listenFrom: (article, sequence) => broadcast.startFrom(article, sequence),
      saveToKnowledgeBase: async (article) => {
        const result = await callTool('vault_create', {
          name: String(article.title || 'news').slice(0, 80),
          content: knowledgeMarkdown(article),
        })
        // 已知运行时缺口：Toast.show 渲染为空 → 反馈统一走自绘提示条。
        broadcast.showNotice(result && result.ok !== false ? 'news.x.savedToKB' : 'news.x.saveKBFailed')
      },
      updateSettings: (patch) => store.updateSettings(patch),
      clearContentCache: () => store.clearContentCache(),
      addFeed: (input) => store.addFeed(input),
      removeFeed: (id) => store.removeFeed(id),
      setFeedEnabled: (id, enabled) => store.setFeedEnabled(id, enabled),
      moveFeed: (id, direction) => store.moveFeed(id, direction),
    },
  }), [t, locale, now, store, agg, broadcast, store.version, agg.timelineRevision, query,
    shell.searchRendered, caps.hasAI, caps.hasTTS, caps.hasKB, readKeys, savedKeys,
    navigate, back, openAI, broadcast.active, broadcast.index]) // eslint-disable-line react-hooks/exhaustive-deps

  const route = stack.length > 0 ? stack[stack.length - 1] : null
  const currentTab = TABS.find((row) => row.id === tab) || TABS[0]

  const selectTab = (next) => {
    setTab(next)
    setStack([])
    const api = window.aibox
    if (api && api.tabs && typeof api.tabs.select === 'function') api.tabs.select(next).catch(() => {})
  }

  return (
    <div className="news-root">
      {(!shell.toolbarRendered || route) ? (
        <NavBar
          title={route ? routeTitle(route, t) : t(currentTab.titleKey)}
          onBack={route ? back : undefined}
          backLabel={t('news.x.back')}
          trailing={!route && !shell.toolbarRendered ? (
            <>
              {caps.hasAI ? (
                <ToolbarButton icon="sparkles" label={t('news.companion.title')} onClick={() => openAI(null)} />
              ) : null}
              {showBroadcast ? (
                <ToolbarButton
                  icon={broadcast.active ? 'stop.circle.fill' : 'speaker.wave.2'}
                  label={t(broadcast.active ? 'news.action.stopListening' : 'news.action.listen')}
                  onClick={toggleBroadcast}
                />
              ) : null}
            </>
          ) : null}
        />
      ) : null}

      {!route && !shell.searchRendered && tab === 'feed' ? (
        <SearchField value={query} onChange={setQuery} placeholder={t('news.search.prompt')} />
      ) : null}

      {!ready ? <div className="news-scroll" /> : (route ? renderRoute(route, ctx) : (
        <>
          {tab === 'feed' ? <FeedPage ctx={ctx} /> : null}
          {tab === 'subs' ? <SourcesPage ctx={ctx} /> : null}
          {tab === 'saved' ? <SavedPage ctx={ctx} /> : null}
        </>
      ))}

      <BroadcastNotice messageKey={broadcast.noticeKey} t={t} onDismiss={() => broadcast.dismissNotice()} />
      <BroadcastBar
        broadcast={broadcast}
        t={t}
        onOpenCurrent={() => { if (broadcast.current) ctx.actions.openArticle(broadcast.current) }}
      />

      {!shell.tabsRendered ? (
        <TabBar
          items={TABS.map((row) => ({ ...row, title: t(row.titleKey) }))}
          selected={tab}
          onSelect={selectTab}
        />
      ) : (
        <div style={{ height: 'env(safe-area-inset-bottom)', background: C.bg, flex: '0 0 auto' }} />
      )}

      <AIPanel ctx={ctx} session={aiSession} onClose={() => setAISession(null)} />
    </div>
  )
}

function routeTitle(route, t) {
  switch (route.name) {
    case 'settings': return t('news.settings.title')
    case 'addSource': return t('news.add.nav')
    case 'diagnostics': return t('news.diagnostics.title')
    case 'cluster': return t('news.cluster.title')
    case 'source': return route.feed.title
    default: return ''
  }
}

function renderRoute(route, ctx) {
  switch (route.name) {
    case 'settings': return <SettingsPage ctx={ctx} />
    case 'addSource': return <AddSourcePage ctx={ctx} />
    case 'diagnostics': return <DiagnosticsPage ctx={ctx} />
    case 'cluster': return <ClusterDetail ctx={ctx} cluster={route} />
    case 'source': return <FeedPage ctx={ctx} sourceFeed={route.feed} />
    default: return null
  }
}
