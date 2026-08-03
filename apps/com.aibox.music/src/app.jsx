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
  actionSheet, confirm, haptics, music as callMusic, openURL, overlay,
  onEvent, onNamespaceEvent, registerAction, setNavigationTitle, shareText, tabs, toolbar,
} from './lib/host.js'
import { ACTION_HANDLERS } from './lib/actions.js'
import { useSubpageStack } from 'aibox/ui'
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
  // 子页标题在 push 那一刻要用最新的翻译函数，而 push 回调是稳定的 —— 经 ref 取值。
  const tRef = React.useRef(t)
  tRef.current = t

  const refs = React.useRef(null)
  if (refs.current === null) {
    const store = new MusicStore()
    refs.current = { store, music: new MusicController({ store }) }
  }
  const { store, music } = refs.current

  const [tab, setTab] = React.useState('player')
  // 子页栈 = 宿主原生页栈的镜像（框架资产 `aibox/ui`）：进详情走 `aibox.navigation.push`，
  // 返回一律经 popstate 回来，于是最左缘左滑是**系统自己的** interactive pop。
  const subpages = useSubpageStack({
    pathFor: routePath,
    titleFor: (row) => routeTitle(row, tRef.current),
  })
  const { stack } = subpages
  const [sheet, setSheet] = React.useState(null)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [picker, setPicker] = React.useState(null)
  const [query, setQuery] = React.useState('')
  const [shell, setShell] = React.useState({
    tabsRendered: false, toolbarRendered: false, searchRendered: false, overlayRendered: false,
  })
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

  // 外壳接线只跑一次，而 reset 要在每次切 Tab 时清掉子页栈 —— 经 ref 取最新那一个。
  const resetRef = React.useRef(subpages.reset)
  resetRef.current = subpages.reset

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
        if (!payload) return
        // `rendered` 会**在挂载之后翻转**（形态切换、控制器重建都会重发 changed）。
        // 只在启动那一刻判断一次，自绘 TabBar 就会永远缺席或永远多一条。
        const rendered = payload.rendered !== false
        setShell((current) => (current.tabsRendered === rendered
          ? current : { ...current, tabsRendered: rendered }))
        if (payload.selected) {
          haptics.selection()
          setTab(payload.selected)
          resetRef.current()
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
      // `more` 在 manifest 里是 `role:"hostMenu"` 的**位置标记**、不是按钮：它不渲染、
      // 也永不发 `toolbar.invoke`。菜单内容改由 `scene.menu` 声明，宿主用原生 Menu 画。
      // 自绘 ⋯（没有宿主顶栏的形态）仍走 OptionsMenu，见下面的 Header。
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

  const { push: navigate, back } = subpages

  const selectTab = React.useCallback((next) => {
    haptics.selection()
    setTab(next)
    resetRef.current()
    setMode('album')
    tabs.select(next)
  }, [])

  // —— 悬浮层（`aibox.overlay`）：迷你播放条交给宿主画 ——
  //
  // 为什么不再自绘：自绘的条挂在页面内容流末尾，宿主底栏是另一层 `safeAreaInset` ——
  // 两层各算各的安全区，结果就是用户看到的「迷你播放器被底栏压住大半」。
  // 交给宿主后底栏与 bar 叠进**同一个** inset（自下而上：底栏 → bar），压不到彼此是结构性的。
  // 宿主没画（card/sheet/drawer 形态）时 `rendered:false`，下面照旧渲染 `<MiniBar>`。
  const overlayInvoke = React.useRef(null)
  overlayInvoke.current = (event) => {
    const controlID = event && event.controlId
    if (controlID === 'toggle') { haptics.impact('light'); music.togglePlayPause(); return }
    if (controlID === 'next') { haptics.impact('light'); music.transport('next'); return }
    // 点条本体 = 展开到「正在播放」页（与原生 mini 条同语义）。
    selectTab('player')
  }

  React.useEffect(() => {
    let cancelled = false
    const offs = []
    const wire = async () => {
      const state = await overlay.getState()
      if (cancelled) return
      const rendered = !!(state && state.rendered)
      setShell((current) => (current.overlayRendered === rendered
        ? current : { ...current, overlayRendered: rendered }))
      offs.push(onNamespaceEvent('overlay', 'invoke', (payload) => {
        if (overlayInvoke.current) overlayInvoke.current(payload || {})
      }))
      // `rendered` 会在挂载之后翻转（形态切换、控制器重建都会重发 changed）——
      // 只在启动那一刻判断一次，自绘迷你条就会永远缺席或永远多一条（tabs 那条同款教训）。
      offs.push(onNamespaceEvent('overlay', 'changed', (payload) => {
        const next = !!(payload && payload.rendered)
        setShell((current) => (current.overlayRendered === next
          ? current : { ...current, overlayRendered: next }))
      }))
    }
    wire()
    return () => { cancelled = true; offs.forEach((off) => off && off()) }
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

  // 「加入歌单」——对标原生 `AudioAddToPlaylistSheet`：列歌单 → 原生选择器 → `add_tracks`。
  // 走的是既有的 `music_playlist` 工具，不需要新宿主能力。
  const addToPlaylist = React.useCallback(async (track) => {
    const listed = await callMusic('playlist', { action: 'list' })
    const rows = (listed.json && Array.isArray(listed.json.playlists)) ? listed.json.playlists : []
    if (rows.length === 0) { showNotice(t('common.noPlaylists')); return }
    const picked = await actionSheet({
      title: t('common.pickPlaylist'),
      actions: [
        ...rows.slice(0, 20).map((row) => ({
          id: String(row.musicItemId || row.id || ''),
          title: row.title || row.name || '',
        })).filter((row) => row.id && row.title),
        { id: 'cancel', title: t('common.cancel'), role: 'cancel' },
      ],
    })
    if (!picked || picked === 'cancel') return
    const result = await callMusic('playlist', { action: 'add_tracks', id: picked, tracks: [playArgs(track)] })
    showNotice(result.ok ? t('common.addedToPlaylist') : (result.error || t('err.generic')))
  }, [t, showNotice])

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
      // Apple Music 曲目才有「加入资料库 / 加入歌单」（本地曲目在服务端没有对应条目）——
      // 与原生 AudioTrackActionsMenu 的 `track.source.isAppleMusic` 分支同判据。
      const isCatalog = !!track.musicItemId
      const picked = await actionSheet({
        title: track.title,
        actions: [
          { id: 'play', title: t('common.play') },
          { id: 'queue', title: t('common.addToQueue') },
          { id: 'favorite', title: isFavorite ? t('common.removeFromFavorites') : t('common.addToFavorites') },
          ...(isCatalog ? [
            { id: 'addToLibrary', title: t('common.addToLibrary') },
            { id: 'addToPlaylist', title: t('common.addToPlaylist') },
          ] : []),
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
      else if (picked === 'addToLibrary') {
        const result = await callMusic('library', { action: 'add_to_library', ...playArgs(track) })
        showNotice(result.ok ? t('common.addedToLibrary') : (result.error || t('err.generic')))
      } else if (picked === 'addToPlaylist') {
        await addToPlaylist(track)
      }
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
  }), [music, store, navigate, back, showNotice, t, toggleFavorite, favoriteKeys, addToPlaylist])

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

  const { route } = subpages
  const showMini = showMiniFor(tab, current) && !route

  // 悬浮层的展示态。**只能改展示状态**（合同 §2.5.3）：id、层数、控件都是 manifest 冻结的。
  // 进度按 1% 量化后再比较——`displayProgress()` 每 100ms 变一次，不量化就是每秒 10 次过桥。
  const overlayProgress = Math.round(Math.max(0, Math.min(1, music.displayProgress())) * 100) / 100
  const overlaySignature = [
    shell.overlayRendered, showMini, current ? current.title : '', current ? current.artist : '',
    music.status.isPlaying, overlayProgress,
  ].join('')
  const overlaySent = React.useRef(null)
  React.useEffect(() => {
    if (!shell.overlayRendered) return
    if (overlaySent.current === overlaySignature) return
    overlaySent.current = overlaySignature
    overlay.update({
      player: {
        hidden: !showMini,
        title: (current && current.title) || t('np.notPlaying'),
        subtitle: (current && current.artist) || null,
        progress: overlayProgress,
        controls: { toggle: { active: !!music.status.isPlaying } },
      },
    })
  }, [overlaySignature]) // eslint-disable-line react-hooks/exhaustive-deps

  // —— 宿主 ⋯ 菜单（scene.menu）——
  //
  // 这些行以前是自绘面板（web 菜单），于是顶栏出现**两个 ⋯**：`more` 没标 `role:"hostMenu"`，
  // 宿主把它当普通按钮画在前面、再画自己的 ⋯。现在菜单内容整体迁进 `scene.menu`，
  // `more` 退化成位置标记，右上角只剩一个 ⋯，而且是系统原生 Menu。
  //
  // 每轮重注册：处理器要闭包到最新的 music / navigate / actions。
  React.useEffect(() => {
    registerAction('toggleShuffle', () => { music.setShuffle(!music.status.isShuffled); return null })
    registerAction('setRepeat', (mode) => { music.setRepeat(String(mode || 'off')); return null })
    registerAction('setSleepTimer', (input) => {
      const value = input || {}
      if (value.mode === 'off') music.cancelSleepTimer()
      else if (value.mode === 'endOfTrack') music.setSleepTimerEndOfTrack()
      else music.setSleepTimer(Math.max(1, Number(value.minutes) || 0))
      return null
    })
    registerAction('openEffects', () => { navigate({ name: 'effects' }); return null })
    registerAction('openSettings', () => { navigate({ name: 'settings' }); return null })
    registerAction('shareCurrent', () => { actions.shareCurrent(); return null })
  })

  // 原生菜单项没有「勾选态」「右侧详情」两个字段，只能覆盖 title / icon / enabled / hidden。
  // 所以：勾选用 `icon: 'checkmark'` 表达（就是系统菜单的写法），当前值并进标题。
  const menuStatus = music.status
  const sleepTimer = music.sleepTimer
  const externalURL = current ? store.externalURL(current) : null
  React.useEffect(() => {
    const api = window.aibox
    if (!api || !api.menu || typeof api.menu.update !== 'function') return
    // 播放相关的几项只在「正在播放」页出现（照抄原生 AiBoxMusicKit 的 ⋯ 菜单）。
    const isPlayer = tab === 'player' && !route
    const repeatValue = {
      off: t('menu.repeatOff'), one: t('menu.repeatOne'), all: t('menu.repeatAll'),
    }[menuStatus.repeatMode] || t('menu.repeatOff')
    const timerValue = sleepTimer.endOfTrack
      ? t('menu.stopAfterSong')
      : (sleepTimer.remaining !== null && sleepTimer.remaining !== undefined
        ? t('menu.stopIn', `${Math.floor(sleepTimer.remaining / 60)}:${String(sleepTimer.remaining % 60).padStart(2, '0')}`)
        : t('menu.notSet'))
    api.menu.update({
      items: {
        shuffle: { hidden: !isPlayer, icon: menuStatus.isShuffled ? 'checkmark' : 'shuffle' },
        repeat: {
          hidden: !isPlayer,
          icon: menuStatus.repeatMode === 'one' ? 'repeat.1' : 'repeat',
          title: `${t('menu.repeat')} · ${repeatValue}`,
        },
        repeatOff: { icon: menuStatus.repeatMode === 'off' ? 'checkmark' : null },
        repeatOne: { icon: menuStatus.repeatMode === 'one' ? 'checkmark' : null },
        repeatAll: { icon: menuStatus.repeatMode === 'all' ? 'checkmark' : null },
        sleepTimer: { hidden: !isPlayer, title: `${t('menu.sleepTimer')} · ${timerValue}` },
        sleepOff: { hidden: !sleepTimer.active },
        audioEffects: { hidden: !isPlayer },
        shareTrack: { hidden: !isPlayer || !externalURL },
      },
    }).catch(() => {})
  }, [tab, route, t, externalURL, menuStatus.isShuffled, menuStatus.repeatMode,
    sleepTimer.active, sleepTimer.endOfTrack, sleepTimer.remaining])

  return (
    <div className="mu-root">
      {/* 宿主画了顶栏就**不再自绘** —— 子页也不自绘：宿主在 `webDepth > 0` 时自己就有返回键，
          ⋯ 也由宿主的原生 Menu 画。没有宿主顶栏时（fullscreen 形态 / 无宿主）才补上这一条。 */}
      {!shell.toolbarRendered ? (
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

      {/* 宿主画了悬浮层就**不再自绘**迷你条 —— 两条一起出现就是「第二条底栏」。
          `rendered:false`（card/sheet/drawer 形态、声明越界）时这条降级路径必须还在。 */}
      {showMini && !shell.overlayRendered ? (
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

/** 子页在 history 里的路径。页面自己不读它，只为宿主诊断与 `navigation.getState().url` 可读。 */
function routePath(route) {
  if (!route) return '#/'
  if (route.name === 'collection') return `#/collection/${encodeURIComponent((route.item && route.item.musicItemId) || '')}`
  if (route.name === 'category') return `#/category/${encodeURIComponent(route.id || '')}`
  return `#/${route.name}`
}

function routeTitle(route, t) {
  if (!route) return ''
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
