import type { CSSProperties, ReactNode } from 'react'
import type { MusicController } from './music.js'
import type { MusicStore } from './store.js'

export type Translate = (key: string, ...args: Array<string | number>) => string

export type TabID = 'forYou' | 'search' | 'player' | 'queue' | 'albums'
export type RepeatMode = 'off' | 'one' | 'all'
export type PlaybackState = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'failed'
export type MusicAvailability = 'unknown' | 'none' | 'denied' | 'noSubscription' | 'cancelled' | 'notFound' | 'error'

/** 宿主音乐工具在搜索、队列、本地曲库与状态接口间共用的曲目模型。 */
export interface MusicTrack {
  id?: string
  musicItemId?: string
  localTrackId?: string
  url?: string
  title?: string
  artist?: string
  album?: string
  artworkUrl?: string | null
  duration?: number
  codec?: string
  genre?: string
  source?: string
  index?: number
  isCurrent?: boolean
}

export interface MusicCollection {
  id?: string
  musicItemId?: string
  url?: string
  title?: string
  name?: string
  artist?: string
  curator?: string
  artworkUrl?: string | null
  type?: string
  subtitle?: string
  source?: string
}

export interface MusicItem extends MusicTrack, MusicCollection {}

export interface QueueTrack extends MusicTrack {
  id: string
  isCurrent?: boolean
}

export interface QueueState {
  tracks: QueueTrack[]
  currentIndex: number
  shuffledTrackIDs: string[]
}

export interface MusicStatus {
  isPlaying: boolean
  playbackState: PlaybackState
  currentTime: number
  duration: number
  volume: number
  repeatMode: RepeatMode
  isShuffled: boolean
  queueCount: number
  currentIndex: number
  currentTrack: MusicTrack | null
  lastError: string | null
}

export interface EqualizerBand {
  index?: number
  frequencyHz?: number
  frequency?: number
  hz?: number
  gain?: number
  gainDB?: number
}

export interface MusicEffects {
  enabled: boolean
  appliesToCurrentTrack?: boolean
  rate: number
  preset?: string | null
  preampDB?: number
  bands?: EqualizerBand[]
}

export interface SleepTimerState {
  active: boolean
  text: string | null
  endOfTrack?: boolean
  remaining?: number | null
}

export interface MusicUIState {
  selectedTab: TabID
  lastTrack: MusicTrack | null
  lastPosition: number
}

export interface PlayHistoryRow {
  key: string
  track: MusicTrack
  count: number
  lastPlayed: number
}

export interface SearchTrackRow {
  key: string
  track: MusicTrack
}

export interface MusicSearchHistory {
  queries: string[]
  tracks: SearchTrackRow[]
}

export interface ArtworkEntry {
  art: string | null
  link: string | null
}

export interface MusicPreferences {
  autoDownloadLyrics: boolean
  translateLang: string | null
}

export interface LyricsLine {
  time: number | null
  text: string
  translation: string | null
}

export interface LyricsPayload {
  state: 'loading' | 'ok' | 'none'
  synced: boolean
  lines: LyricsLine[]
  source?: string | null
}

export interface RGBColor {
  r: number
  g: number
  b: number
}

export type MusicMethod =
  | 'search'
  | 'play'
  | 'transport'
  | 'status'
  | 'queue'
  | 'album'
  | 'get'
  | 'library'
  | 'local'
  | 'lyrics'
  | 'seek'
  | 'volume'
  | 'repeat'
  | 'shuffle'
  | 'sleepTimer'
  | 'recommendations'
  | 'effects'
  | 'playlist'
  | 'deletePlaylist'

export interface MusicCallResult<T = unknown> {
  ok: boolean
  text: string
  json: T | null
  details?: unknown
  error: string | null
}

export type MusicCall = <T = unknown>(
  method: MusicMethod,
  args?: Record<string, unknown>,
) => Promise<MusicCallResult<T>>

export interface CollectionRoute {
  name: 'collection'
  item: MusicCollection
}

export interface CategoryRoute {
  name: 'category'
  id?: string
  title: string
  items: Array<MusicTrack | MusicCollection>
}

export interface SimpleRoute {
  name: 'settings' | 'effects' | 'local'
}

export type MusicRoute = CollectionRoute | CategoryRoute | SimpleRoute

export interface OptionRequest {
  title?: string
  options: Array<{ id: string; title: string }>
  selected?: string | null
  onPick: (value: string) => void
}

export interface TrackMenuOptions {
  queueIndex?: number
  group?: MusicTrack[]
}

export interface MusicActions {
  navigate: (route: MusicRoute) => void
  back: () => void
  notice: (message: string) => void
  openSheet: (sheet: 'favorites' | 'history' | null) => void
  pickOption: (request: OptionRequest | null) => void
  playTrack: (track: MusicTrack, group?: MusicTrack[]) => void
  playQueueIndex: (index: number) => void
  addToQueue: (track: MusicTrack) => void
  removeQueue: (index: number) => void
  moveQueue: (from: number, to: number) => void
  shufflePlay: (tracks: MusicTrack[]) => Promise<void>
  openCollection: (item: MusicCollection) => void
  playCollection: (item: MusicCollection) => Promise<void>
  toggleFavorite: (track: MusicTrack | null, next?: boolean) => Promise<void>
  shareCurrent: () => Promise<void>
  confirmClear: (message: string, run: () => void) => Promise<void>
  confirmDestructive: (request: {
    title: string
    message?: string
    confirmTitle: string
    onConfirm: () => void | Promise<void>
  }) => Promise<void>
  trackMenu: (track: MusicTrack, options?: TrackMenuOptions) => Promise<void>
  collectionMenu: (item: MusicCollection) => Promise<void>
}

export interface MusicAppContext {
  t: Translate
  locale: string
  store: MusicStore
  music: MusicController
  actions: MusicActions
  favorites: MusicTrack[]
  favoritesLoading: boolean
  externalURL: string | null
  version: number
}

export interface TabItem {
  id: TabID
  titleKey: string
  icon: string
}

export interface CommonChildrenProps {
  children?: ReactNode
  style?: CSSProperties
}
