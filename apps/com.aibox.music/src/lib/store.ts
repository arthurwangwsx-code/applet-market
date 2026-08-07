// 本应用自己的持久化（`aibox.storage`）。
//
// 边界很重要：**播放队列不在这里**——它是原生的（跨 App 重启恢复 + 锁屏控制都依赖那一份），
// 自己再存一份会和 `music_queue` 打架。这里只存宿主 19 个工具**没有**投影出来的东西：
//  · 播放历史（原生存在偏好里，没有任何工具能读 → 队列页「最常播放」与播放历史页只能靠本地记）
//  · 搜索历史（同上，`music_search` 不带历史读写）
//  · UI 恢复点（选中 tab、上次播放曲目与位置）
//  · 封面 URL 映射（`music_status.currentTrack` 不带 artworkUrl，见 README 差异 ⑤）

import { stableKey, playArgs } from './format.js'
import { storage } from './host.js'
import type {
  ArtworkEntry,
  MusicCollection,
  MusicPreferences,
  MusicSearchHistory,
  MusicTrack,
  MusicUIState,
  PlayHistoryRow,
  TabID,
} from './types.js'

const KEYS = {
  ui: 'music.uiState',
  history: 'music.playHistory',
  search: 'music.searchHistory',
  artwork: 'music.artworkMap',
  prefs: 'music.prefs',
}

const LIMITS = {
  history: 500,
  recentQueries: 10,
  recentTracks: 15,
  artwork: 400,
}

export class MusicStore {
  ui: MusicUIState
  history: PlayHistoryRow[]
  search: MusicSearchHistory
  artwork: Record<string, ArtworkEntry>
  prefs: MusicPreferences
  version: number
  private readonly listeners: Set<() => void>
  private loaded: boolean
  private flushTimer: ReturnType<typeof setTimeout> | null
  private readonly dirty: Set<string>

  constructor() {
    this.ui = { selectedTab: 'player', lastTrack: null, lastPosition: 0 }
    this.history = []
    this.search = { queries: [], tracks: [] }
    this.artwork = {}
    this.prefs = { autoDownloadLyrics: true, translateLang: null }
    this.version = 0
    this.listeners = new Set()
    this.loaded = false
    this.flushTimer = null
    this.dirty = new Set()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notify(): void {
    this.version += 1
    this.listeners.forEach((listener) => listener())
  }

  async load(): Promise<void> {
    const [ui, history, search, artwork, prefs] = await Promise.all([
      storage.get<Partial<MusicUIState>>(KEYS.ui),
      storage.get<PlayHistoryRow[]>(KEYS.history),
      storage.get<Partial<MusicSearchHistory>>(KEYS.search),
      storage.get<Record<string, ArtworkEntry>>(KEYS.artwork),
      storage.get<Partial<MusicPreferences>>(KEYS.prefs),
    ])
    if (ui && typeof ui === 'object') this.ui = { ...this.ui, ...ui }
    if (Array.isArray(history)) this.history = history.filter((row) => row && row.track)
    if (search && typeof search === 'object') {
      this.search = {
        queries: Array.isArray(search.queries) ? search.queries.slice(0, LIMITS.recentQueries) : [],
        tracks: Array.isArray(search.tracks) ? search.tracks.slice(0, LIMITS.recentTracks) : [],
      }
    }
    if (artwork && typeof artwork === 'object') this.artwork = artwork
    if (prefs && typeof prefs === 'object') this.prefs = { ...this.prefs, ...prefs }
    this.loaded = true
    this.notify()
  }

  /** 合并写盘：UI 每次点击都落盘会把桥打满，攒 600ms 一起写。 */
  private schedule(key: string): void {
    this.dirty.add(key)
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      const pending = [...this.dirty]
      this.dirty.clear()
      pending.forEach((name) => {
        if (name === KEYS.ui) storage.set(KEYS.ui, this.ui)
        else if (name === KEYS.history) storage.set(KEYS.history, this.history)
        else if (name === KEYS.search) storage.set(KEYS.search, this.search)
        else if (name === KEYS.artwork) storage.set(KEYS.artwork, this.artwork)
        else if (name === KEYS.prefs) storage.set(KEYS.prefs, this.prefs)
      })
    }, 600)
  }

  /** 立即落盘（进入后台时调用，别把最后一次改动丢在定时器里）。 */
  flushNow(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    this.dirty.clear()
    storage.set(KEYS.ui, this.ui)
    storage.set(KEYS.history, this.history)
    storage.set(KEYS.search, this.search)
    storage.set(KEYS.artwork, this.artwork)
    storage.set(KEYS.prefs, this.prefs)
  }

  // MARK: - UI 恢复点

  setSelectedTab(tab: TabID): void {
    if (this.ui.selectedTab === tab) return
    this.ui.selectedTab = tab
    this.schedule(KEYS.ui)
  }

  /** 记录「上次听到哪」。position 用整数秒即可——宿主本来就只给整数。 */
  setRestorePoint(track: MusicTrack | null, position: unknown): void {
    if (!track) return
    this.ui.lastTrack = playArgs(track)
    this.ui.lastPosition = Math.max(0, Math.floor(Number(position) || 0))
    this.schedule(KEYS.ui)
  }

  setPref(patch: Partial<MusicPreferences>): void {
    this.prefs = { ...this.prefs, ...patch }
    this.schedule(KEYS.prefs)
    this.notify()
  }

  // MARK: - 播放历史（上限 500，超限按「次数 → 最近」升序删最不常用的）

  recordPlay(track: MusicTrack): void {
    const key = stableKey(track)
    if (!key) return
    const now = Date.now()
    const found = this.history.findIndex((row) => row.key === key)
    if (found >= 0) {
      const existing = this.history[found]!
      this.history[found] = {
        ...existing,
        track: playArgs(track),
        count: (existing.count || 0) + 1,
        lastPlayed: now,
      }
    } else {
      this.history.push({ key, track: playArgs(track), count: 1, lastPlayed: now })
    }
    if (this.history.length > LIMITS.history) {
      this.history.sort((a, b) => a.count - b.count || a.lastPlayed - b.lastPlayed)
      this.history = this.history.slice(this.history.length - LIMITS.history)
    }
    this.schedule(KEYS.history)
    this.notify()
  }

  removeHistory(key: string): void {
    this.history = this.history.filter((row) => row.key !== key)
    this.schedule(KEYS.history)
    this.notify()
  }

  clearHistory(): void {
    this.history = []
    this.schedule(KEYS.history)
    this.notify()
  }

  /** 最常播放：按次数降序、同次数按最近降序。 */
  mostPlayed(limit = 8, excludeKey: string | null = null): PlayHistoryRow[] {
    return this.history
      .filter((row) => row.key !== excludeKey)
      .slice()
      .sort((a, b) => b.count - a.count || b.lastPlayed - a.lastPlayed)
      .slice(0, limit)
  }

  /** 最近播放（播放历史页的「最近」分段）。 */
  recentlyPlayed(limit = 60): PlayHistoryRow[] {
    return this.history
      .slice()
      .sort((a, b) => b.lastPlayed - a.lastPlayed)
      .slice(0, limit)
  }

  // MARK: - 搜索历史

  recordQuery(query: unknown): void {
    const value = String(query || '').trim()
    if (!value) return
    this.search.queries = [value]
      .concat(this.search.queries.filter((row) => row !== value))
      .slice(0, LIMITS.recentQueries)
    this.schedule(KEYS.search)
    this.notify()
  }

  removeQuery(query: string): void {
    this.search.queries = this.search.queries.filter((row) => row !== query)
    this.schedule(KEYS.search)
    this.notify()
  }

  clearQueries(): void {
    this.search.queries = []
    this.schedule(KEYS.search)
    this.notify()
  }

  recordSearchTrack(track: MusicTrack): void {
    const key = stableKey(track)
    if (!key) return
    const row = { key, track: playArgs(track) }
    this.search.tracks = [row]
      .concat(this.search.tracks.filter((item) => item.key !== key))
      .slice(0, LIMITS.recentTracks)
    this.schedule(KEYS.search)
    this.notify()
  }

  removeSearchTrack(key: string): void {
    this.search.tracks = this.search.tracks.filter((row) => row.key !== key)
    this.schedule(KEYS.search)
    this.notify()
  }

  clearSearchTracks(): void {
    this.search.tracks = []
    this.schedule(KEYS.search)
    this.notify()
  }

  // MARK: - 封面 URL 映射

  /**
   * 任何带 artworkUrl / url 的结果（搜索 / 推荐 / 资料库 / 详情）都往这里喂一次。
   * 顺带记 Apple Music 页面链接：`music_status.currentTrack` 同样不带 externalURL，
   * 「分享」与「在 Apple Music 打开」都要靠这条旁路。
   */
  rememberArtwork(track: MusicTrack | MusicCollection): void {
    const key = stableKey(track)
    if (!key || !track) return
    const art = track.artworkUrl || null
    const link = typeof track.url === 'string' && /^https?:\/\//i.test(track.url) ? track.url : null
    if (!art && !link) return
    const existing: ArtworkEntry = this.artwork[key] || { art: null, link: null }
    const next = { art: art || existing.art || null, link: link || existing.link || null }
    if (existing.art === next.art && existing.link === next.link) return
    const keys = Object.keys(this.artwork)
    const oldest = keys[0]
    if (keys.length >= LIMITS.artwork && !this.artwork[key] && oldest !== undefined) delete this.artwork[oldest]
    this.artwork[key] = next
    this.schedule(KEYS.artwork)
  }

  entry(track: MusicTrack | null | undefined): ArtworkEntry | null {
    const key = stableKey(track)
    return key ? this.artwork[key] || null : null
  }

  artworkURL(track: MusicTrack | null | undefined): string | null {
    if (track && track.artworkUrl) return track.artworkUrl
    const row = this.entry(track)
    return row ? row.art : null
  }

  /** Apple Music 页面链接（分享 / 在 Apple Music 打开）。 */
  externalURL(track: MusicTrack | null | undefined): string | null {
    const row = this.entry(track)
    return row ? row.link : null
  }
}
