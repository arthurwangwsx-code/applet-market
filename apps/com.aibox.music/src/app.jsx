// 音乐（com.aibox.music）—— AiBoxMusicKit 的 React 复刻。
//
// 根职责：装配 store / MusicController → 接宿主外壳（tabs / toolbar / navigation / 动作注册）
// → 路由子页 → 渲染当前 Tab + mini 播放条。
//
// ⚠️ 架构裁决：**遥控宿主播放引擎 `aibox.music.*`，绝不用 `aibox.media` 自持引擎**。
// 播放、锁屏 NowPlaying、remote command、后台续播、中断恢复全部留在原生侧；
// 播放队列同理留在原生（`music_queue`），本应用不维护影子队列。
// 依据：docs/capabilities/applet/framework-capabilities.md §3.6 / §3.6.1。

import React from 'react'
import { THEME_CSS } from './components/theme.js'
import { Header, Notice, TabBar } from './components/Shell.jsx'
import NowPlaying from './components/NowPlaying.jsx'
import MiniBar from './components/MiniBar.jsx'
import QueuePage from './components/QueuePage.jsx'
import ForYouPage from './components/ForYouPage.jsx'
import SearchPage from './components/SearchPage.jsx'
import LibraryPage from './components/LibraryPage.jsx'
import LocalLibrary from './components/LocalLibrary.jsx'
import SettingsPage from './components/SettingsPage.jsx'
import EffectsPage from './components/EffectsPage.jsx'
import OptionsMenu, { OptionPicker } from './components/OptionsMenu.jsx'
import { CollectionDetail, CategoryList } from './components/DetailPage.jsx'
import { FavoritesSheet, HistorySheet } from './components/Sheets.jsx'
import { MusicStore } from './lib/store.js'
import { MusicController } from './lib/music.js'
import { fetchLyrics } from './lib/lyrics.js'
import { backfillArtworkURL, artworkDataURL, dominantColor, sizedArtworkURL } from './lib/artwork.js'
import { playArgs, stableKey } from './lib/format.js'
import {
  actionSheet, confirm, haptics, music as callMusic, openURL,
  onEvent, onNamespaceEvent, registerAction, setNavigationTitle, shareText, tabs, toolbar,
} from './lib/host.js'
import { ACTION_HANDLERS } from './lib/actions.js'
import { currentLocale, makeT, onLocaleChanged } from './i18n/index.js'

const TABS = [
  { id: 'forYou', titleKey: 'tab.forYou', icon: 'sparkles' },
  { id: 'search', titleKey: 'tab.search', icon: 'magnifyingglass' },
  { id: 'player', titleKey: 'tab.player', icon: 'play.circle' },
  { id: 'queue', titleKey: 'tab.queue', icon: 'list.bullet' },
  { id: 'albums', titleKey: 'tab.albums', icon: 'square.stack' },
]

function useThemeSetup() {
  React.useEffect(() => {
    if (document.getElementById('__music_css__')) return
    const style = document.createElement('style')
    style.id = '__music_css__'
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
  const [, forceRender] = React.useReducer((n) => n + 1, 0)

  const [locale, setLocale] = React.useState(currentLocale)
  const t = React.useMemo(() => makeT(locale), [locale])

  const refs = React.useRef(null)
  if (refs.current === null) {
    const store = new MusicStore()
    refs.current = { store, music: new MusicController({ store }) }
  }
  const { store, music } = refs.current

  const [tab, setTab] = React.useState('player')
  const [stack, setStack] = React.useState([])
  const [sheet, setSheet] = React.useState(null)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [picker, setPicker] = React.useState(null)
  const [query, setQuery] = React.useState('')
  const [shell, setShell] = React.useState({ tabsRendered: false, toolbarRendered: false, searchRendered: false })
  const [mode, setMode] = React.useState('album')
  const [lyrics, setLyrics] = React.useState({ state: 'none', synced: false, lines: [] })
  const [artwork, setArtwork] = React.useState({ url: null, color: null })
  const [favorites, setFavorites] = React.useState({ loading: true, rows: [] })
  const [notice, setNotice] = React.useState(null)

  // —— 订阅两个模型 ——
  React.useEffect(() => {
    const offs = [store.subscribe(forceRender), music.subscribe(forceRender)]
    return () => offs.forEach((off) => off())
  }, [store, music])

  React.useEffect(() => onLocaleChanged(setLocale), [])

  // —— 启动 ——
  React.useEffect(() => {
    let cancelled = false
    const boot = async () => {
      await store.load()
      if (cancelled) return
      setTab(store.ui.selectedTab || 'player')
      music.start()
      music.refreshSleepTimer()
      music.refreshEffects()
    }
    boot()
    return () => { cancelled = true; music.stop() }
  }, [store, music])

  // —— 页面不可见时停轮询（锁屏/后台的媒体 UI 是原生那一面，与本页无关）——
  React.useEffect(() => {
    const apply = () => music.setVisible(!document.hidden)
    document.addEventListener('visibilitychange', apply)
    const off = onEvent('lifecycle.background', () => { store.flushNow(); music.setVisible(false) })
    const offForeground = onEvent('lifecycle.foreground', () => music.setVisible(true))
    return () => {
      document.removeEventListener('visibilitychange', apply)
      if (off) off()
      if (offForeground) offForeground()
    }
  }, [music, store])

  // —— 10Hz 插值 tick：只在播放页可见且真的在走时才跑 ——
  const playing = music.status.isPlaying
  React.useEffect(() => {
    if (tab !== 'player' && !showMiniFor(tab, music.currentTrack)) return undefined
    if (stack.length > 0) return undefined
    if (!playing) return undefined
    const timer = setInterval(forceRender, 100)
    return () => clearInterval(timer)
  }, [tab, stack.length, playing, music])

  // —— 对外动作（AI / 自动化）——
  React.useEffect(() => {
    Object.keys(ACTION_HANDLERS).forEach((name) => registerAction(name, ACTION_HANDLERS[name]))
  }, [])

  // —— 宿主外壳接线 ——
  React.useEffect(() => {
    let cancelled = false
    const offs = []
    const wire = async () => {
      const state = await tabs.getState()
      if (!cancelled && state && state.rendered) {
        setShell((current) => ({ ...current, tabsRendered: true }))
        // 默认落在 Now Playing（5 个 tab 的正中间），不是资料库。
        tabs.select(store.ui.selectedTab || 'player')
      }
      offs.push(onNamespaceEvent('tabs', 'changed', (payload) => {
        if (payload && payload.selected) {
          haptics.selection()
          setTab(payload.selected)
          setStack([])
          setMode('album')
        }
      }))
      const bar = await toolbar.getState()
      if (!cancelled && bar) {
        setShell((current) => ({
          ...current,
          toolbarRendered: bar.rendered !== false,
          searchRendered: !!(bar.search && bar.search.rendered),
        }))
      }
      offs.push(onNamespaceEvent('toolbar', 'invoke', (payload) => {
        if (payload && payload.id === 'more') setMenuOpen(true)
      }))
      offs.push(onNamespaceEvent('toolbar', 'searchChanged', (payload) => {
        setQuery(String((payload && payload.query) || ''))
      }))
    }
    wire()
    return () => { cancelled = true; offs.forEach((off) => off && off()) }
  }, [store])

  // —— 顶栏标题 ——
  React.useEffect(() => {
    const route = stack[stack.length - 1]
    const title = route ? routeTitle(route, t) : tabTitle(tab, music.status.queueCount, t)
    document.title = title || t('common.music')
    setNavigationTitle(title)
  }, [tab, stack, music.status.queueCount, t])

  React.useEffect(() => { store.setSelectedTab(tab) }, [tab, store])

  // —— 当前曲变化：封面 → 主色 → 歌词 ——
  const trackKey = music.trackKey
  const current = music.currentTrack
  React.useEffect(() => {
    let cancelled = false
    setArtwork({ url: store.artworkURL(current), color: null })
    if (!current) { setLyrics({ state: 'none', synced: false, lines: [] }); return undefined }
    const run = async () => {
      let url = store.artworkURL(current)
      if (!url) url = await backfillArtworkURL(current, { store, music: callMusic })
      if (cancelled || !url) return
      setArtwork((state) => ({ ...state, url }))
      const data = await artworkDataURL(sizedArtworkURL(url, 200))
      if (cancelled || !data) return
      const color = await dominantColor(data)
      if (!cancelled) setArtwork((state) => ({ ...state, color }))
    }
    run()
    return () => { cancelled = true }
  }, [trackKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // —— 歌词：**可见性门** —— 歌词面不可见时不取词，避免一打开播放器就急着拉网络。
  React.useEffect(() => {
    if (!current || mode !== 'lyrics' || tab !== 'player') return undefined
    let cancelled = false
    setLyrics({ state: 'loading', synced: false, lines: [] })
    fetchLyrics(callMusic, current).then((payload) => { if (!cancelled) setLyrics(payload) })
    return () => { cancelled = true }
  }, [trackKey, mode, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // —— 收藏列表 ——
  const refreshFavorites = React.useCallback(async () => {
    const result = await callMusic('library', { action: 'list_favorites' })
    const rows = Array.isArray(result.json) ? result.json : []
    rows.forEach((row) => store.rememberArtwork(row))
    setFavorites({ loading: false, rows })
  }, [store])
  React.useEffect(() => { refreshFavorites() }, [refreshFavorites])

  const showNotice = React.useCallback((message) => {
    setNotice(message)
    setTimeout(() => setNotice(null), 2600)
  }, [])

  const navigate = React.useCallback((route) => setStack((rows) => [...rows, route]), [])
  const back = React.useCallback(() => setStack((rows) => rows.slice(0, -1)), [])

  const selectTab = React.useCallback((next) => {
    haptics.selection()
    setTab(next)
    setStack([])
    setMode('album')
    tabs.select(next)
  }, [])

  const favoriteKeys = React.useMemo(
    () => new Set(favorites.rows.map((row) => stableKey(row)).filter(Boolean)),
    [favorites.rows],
  )

  const toggleFavorite = React.useCallback(async (track, next) => {
    if (!track) return
    const key = stableKey(track)
    const on = next === undefined ? !favoriteKeys.has(key) : next
    haptics.impact('light')
    await callMusic('library', { action: on ? 'favorite' : 'unfavorite', ...playArgs(track) })
    refreshFavorites()
  }, [favoriteKeys, refreshFavorites])

  const actions = React.useMemo(() => ({
    navigate,
    back,
    notice: showNotice,
    openSheet: setSheet,
    pickOption: setPicker,
    playTrack: (track, group) => music.play(track, group),
    playQueueIndex: (index) => {
      const track = music.queue.tracks[index]
      if (track) music.play(track, music.queue.tracks)
    },
    addToQueue: (track) => music.addToQueue(track),
    removeQueue: (index) => music.removeFromQueue(index),
    moveQueue: (from, to) => music.moveInQueue(from, to),
    shufflePlay: async (tracks) => {
      // 「随机」= 先开启随机模式，再从第一首起播（与原生同序）。
      await music.setShuffle(true)
      if (tracks && tracks.length > 0) music.play(tracks[0], tracks)
    },
    openCollection: (item) => {
      store.rememberArtwork(item)
      navigate({ name: 'collection', item })
    },
    playCollection: async (item) => {
      const result = await callMusic('album', { action: 'play', id: item.musicItemId })
      if (!result.ok) showNotice(result.error || t('err.generic'))
      music.refreshStatus()
    },
    toggleFavorite,
    shareCurrent: async () => {
      const track = music.currentTrack
      if (!track) return
      const link = store.externalURL(track)
      await shareText([track.title, track.artist].filter(Boolean).join(' — '), link || undefined)
    },
    confirmClear: async (message, run) => {
      const ok = await confirm({
        title: message,
        confirmTitle: t('common.clear'),
        cancelTitle: t('common.cancel'),
        destructive: true,
      })
      if (ok) run()
    },
    confirmDestructive: async ({ title, message, confirmTitle, onConfirm }) => {
      const ok = await confirm({ title, message, confirmTitle, cancelTitle: t('common.cancel'), destructive: true })
      if (ok) onConfirm()
    },
    trackMenu: async (track, options = {}) => {
      const key = stableKey(track)
      const isFavorite = favoriteKeys.has(key)
      const link = store.externalURL(track)
      const picked = await actionSheet({
        title: track.title,
        actions: [
          { id: 'play', title: t('common.play') },
          { id: 'queue', title: t('common.addToQueue') },
          { id: 'favorite', title: isFavorite ? t('common.removeFromFavorites') : t('common.addToFavorites') },
          ...(link ? [{ id: 'open', title: t('common.openInAppleMusic') }] : []),
          ...(options.queueIndex !== undefined
            ? [{ id: 'remove', title: t('common.remove'), role: 'destructive' }] : []),
          { id: 'cancel', title: t('common.cancel'), role: 'cancel' },
        ],
      })
      if (picked === 'play') music.play(track, options.group)
      else if (picked === 'queue') music.addToQueue(track)
      else if (picked === 'favorite') toggleFavorite(track, !isFavorite)
      else if (picked === 'open' && link) openURL(link)
      else if (picked === 'remove') music.removeFromQueue(options.queueIndex)
    },
    collectionMenu: async (item) => {
      const picked = await actionSheet({
        title: item.title || item.name,
        actions: [
          { id: 'play', title: t('common.play') },
          ...(item.url ? [{ id: 'open', title: t('common.openInAppleMusic') }] : []),
          { id: 'cancel', title: t('common.cancel'), role: 'cancel' },
        ],
      })
      if (picked === 'play') {
        const result = await callMusic('album', { action: 'play', id: item.musicItemId })
        if (!result.ok) showNotice(result.error || t('err.generic'))
      } else if (picked === 'open' && item.url) openURL(item.url)
    },
  }), [music, store, navigate, back, showNotice, t, toggleFavorite, favoriteKeys])

  const ctx = React.useMemo(() => ({
    t,
    locale,
    store,
    music,
    actions,
    favorites: favorites.rows,
    favoritesLoading: favorites.loading,
    externalURL: current ? store.externalURL(current) : null,
    version: music.version + store.version,
  }), [t, locale, store, music, actions, favorites, current, music.version, store.version]) // eslint-disable-line react-hooks/exhaustive-deps

  const route = stack[stack.length - 1] || null
  const showMini = showMiniFor(tab, current) && !route

  return (
    <div className="mu-root">
      {(!shell.toolbarRendered || route) ? (
        <Header
          title={route ? routeTitle(route, t) : tabTitle(tab, music.status.queueCount, t)}
          onBack={route ? back : undefined}
          onMenu={route ? undefined : () => setMenuOpen(true)}
          transparent={!route && tab === 'player'}
        />
      ) : null}

      {route ? renderRoute(route, ctx) : (
        <>
          {tab === 'player' ? (
            <NowPlaying
              track={current}
              status={music.status}
              busy={music.isBusy}
              progress={music.displayProgress()}
              position={music.displayTime()}
              duration={music.status.duration}
              artworkURL={artwork.url}
              color={artwork.color}
              lyrics={lyrics}
              mode={mode}
              onSetMode={(next) => { haptics.selection(); setMode(next) }}
              isFavorite={favoriteKeys.has(stableKey(current))}
              onToggleFavorite={() => toggleFavorite(current)}
              onOpenTrackMenu={() => current && actions.trackMenu(current)}
              scrub={{
                begin: (ratio) => music.beginScrub(ratio),
                update: (ratio) => music.updateScrub(ratio),
                end: () => music.endScrub(),
              }}
              onPrevious={() => music.transport('previous')}
              onNext={() => music.transport('next')}
              onTogglePlay={() => music.togglePlayPause()}
              onSeekSeconds={(seconds) => music.seekTo(seconds)}
              onRetry={() => music.retry()}
              t={t}
            />
          ) : null}
          {tab === 'forYou' ? <ForYouPage ctx={ctx} /> : null}
          {tab === 'search' ? (
            <SearchPage ctx={ctx} query={query} onQueryChange={setQuery} searchRendered={shell.searchRendered} />
          ) : null}
          {tab === 'queue' ? <QueuePage ctx={ctx} /> : null}
          {tab === 'albums' ? <LibraryPage ctx={ctx} /> : null}
        </>
      )}

      <Notice message={notice} />

      {showMini ? (
        <MiniBar
          track={{ ...current, artworkUrl: artwork.url }}
          isPlaying={music.status.isPlaying}
          busy={music.isBusy}
          progress={music.displayProgress()}
          onOpen={() => selectTab('player')}
          onToggle={() => music.togglePlayPause()}
          onNext={() => music.transport('next')}
          t={t}
        />
      ) : null}

      {!shell.tabsRendered ? (
        <TabBar items={TABS} selected={tab} onSelect={selectTab} t={t} />
      ) : (
        <div style={{ height: 'env(safe-area-inset-bottom)', flex: '0 0 auto' }} />
      )}

      <OptionsMenu open={menuOpen} onClose={() => setMenuOpen(false)} tab={tab} ctx={ctx} />
      <OptionPicker request={picker} onClose={() => setPicker(null)} />
      <FavoritesSheet open={sheet === 'favorites'} onClose={() => setSheet(null)} ctx={ctx} />
      <HistorySheet open={sheet === 'history'} onClose={() => setSheet(null)} ctx={ctx} />
    </div>
  )
}

/** mini 播放条**只在非 Now Playing tab** 出现，且必须有当前曲目。 */
function showMiniFor(tab, track) {
  return tab !== 'player' && !!track
}

function tabTitle(tab, queueCount, t) {
  if (tab === 'player') return ''
  if (tab === 'queue') return queueCount > 0 ? t('nav.queueCount', queueCount) : t('tab.queue')
  const row = TABS.find((item) => item.id === tab)
  return row ? t(row.titleKey) : ''
}

function routeTitle(route, t) {
  switch (route.name) {
    case 'settings': return t('settings.title')
    case 'effects': return t('effects.title')
    case 'local': return t('local.title')
    case 'category': return route.title
    case 'collection': return route.item.title || route.item.name || ''
    default: return ''
  }
}

function renderRoute(route, ctx) {
  switch (route.name) {
    case 'settings': return <SettingsPage ctx={ctx} />
    case 'effects': return <EffectsPage ctx={ctx} />
    case 'local': return <LocalLibrary ctx={ctx} />
    case 'category': return <CategoryList ctx={ctx} route={route} />
    case 'collection': return <CollectionDetail ctx={ctx} item={route.item} />
    default: return null
  }
}
