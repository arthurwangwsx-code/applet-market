// For You 发现页（§2.5）。三组横向货架，顺序固定：最近播放 → 为你推荐 → 排行榜。
//
// 与原生的一处结构差异：宿主 `music_recommendations` 把**服务端货架拍平成按类型分组**
// （`{kind, albums, playlists, songs, artists, stations}`），货架标题在工具层就丢了。
// 所以这里按「本地固定的三组 × 类型」排版，拿不到服务端货架名。README 有记。
//
// 数据策略照抄原生三级：会话内存 → 落盘快照秒显（断网也能看）→ 后台拉新，
// **只有非空才覆盖**（无订阅/断网返回空时保留已显示内容，不闪成空态）。

import React from 'react'
import { EmptyState, PullToRefresh, SectionHeader, Artwork, Spinner } from './primitives.js'
import { C, SPACE } from './theme.js'
import { music as callMusic, storage, classifyMusicError } from '../lib/host.js'
import type { MusicAppContext, MusicAvailability, MusicCallResult, MusicItem } from '../lib/types.js'

const SNAPSHOT_KEY = 'music.discovery'
const TTL_MS = 7 * 24 * 3600 * 1000
const KINDS = ['albums', 'playlists', 'songs', 'artists', 'stations'] as const

type Shelf = { kind: string; items: MusicItem[] }
type ShelfGroups = { recent: Shelf[]; forYou: Shelf[]; charts: Shelf[] }
type ShelfResult = { groups: ShelfGroups | null; failure: MusicAvailability | null }
type Snapshot = { at: number; groups: ShelfGroups }

const session: { data: ShelfResult | null } = { data: null }

async function loadShelves({ force }: { force: boolean }): Promise<ShelfResult> {
  if (!force && session.data) return session.data
  const [forYou, recent, charts] = await Promise.all([
    callMusic<Record<string, MusicItem[]>>('recommendations', { kind: 'for_you' }),
    callMusic<Record<string, MusicItem[]>>('recommendations', { kind: 'recently_played' }),
    callMusic<Record<string, MusicItem[]>>('recommendations', { kind: 'charts' }),
  ])
  const groups = {
    recent: normalize(recent),
    forYou: normalize(forYou),
    charts: normalize(charts),
  }
  const empty = Object.values(groups).every((group) => group.length === 0)
  if (empty) {
    const failure = classifyMusicError(forYou.error || recent.error || charts.error)
    return { groups: null, failure }
  }
  session.data = { groups, failure: null }
  storage.set(SNAPSHOT_KEY, { at: Date.now(), groups })
  return session.data
}

function normalize(result: MusicCallResult<Record<string, MusicItem[]>>): Shelf[] {
  if (!result.ok || !result.json) return []
  const payload = result.json
  const out: Shelf[] = []
  KINDS.forEach((kind) => {
    const rows = Array.isArray(payload[kind]) ? payload[kind] : []
    if (rows.length > 0) out.push({ kind, items: rows })
  })
  return out
}

export default function ForYouPage({ ctx }: { ctx: MusicAppContext }) {
  const { t, actions, store } = ctx
  const [state, setState] = React.useState<{
    loading: boolean
    groups: ShelfGroups | null
    failure: MusicAvailability | null
  }>({ loading: true, groups: null, failure: null })
  const [refreshing, setRefreshing] = React.useState(false)
  const [expanding, setExpanding] = React.useState<string | null>(null)

  const run = React.useCallback(async (force: boolean) => {
    const snapshot = force ? null : await storage.get<Snapshot>(SNAPSHOT_KEY)
    if (snapshot && snapshot.groups && Date.now() - Number(snapshot.at || 0) < TTL_MS) {
      setState({ loading: false, groups: snapshot.groups, failure: null })
    }
    const result = await loadShelves({ force })
    setState((current) => {
      if (!result.groups) {
        return { loading: false, groups: current.groups, failure: result.failure }
      }
      return { loading: false, groups: result.groups, failure: null }
    })
  }, [])

  React.useEffect(() => {
    run(false)
  }, [run])

  const onRefresh = async () => {
    setRefreshing(true)
    await run(true)
    setRefreshing(false)
  }

  const openItem = async (item: MusicItem) => {
    if (item.type === 'station') {
      // 电台在宿主侧**没有任何工具投影**，小应用做不了无尽流。如实说明，不假装能播。
      actions.notice(t('forYou.stationUnsupported'))
      return
    }
    setExpanding(item.musicItemId ?? null)
    await actions.openCollection(item)
    setExpanding(null)
  }

  const groups = state.groups
  const sections = groups
    ? [
        { id: 'recent', title: t('forYou.recentlyPlayed'), size: 132, shelves: groups.recent },
        { id: 'forYou', title: t('forYou.forYou'), size: 164, shelves: groups.forYou },
        { id: 'charts', title: t('forYou.charts'), size: 132, shelves: groups.charts },
      ].filter((section) => section.shelves && section.shelves.length > 0)
    : []

  return (
    <PullToRefresh onRefresh={onRefresh} refreshing={refreshing}>
      {state.loading && !groups ? (
        <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
          <Spinner color={C.muted} />
        </div>
      ) : null}

      {sections.length === 0 && !state.loading ? (
        <EmptyState
          icon={state.failure === 'denied' ? 'lock' : 'sparkles'}
          title={state.failure === 'denied' ? t('search.notAuthorized') : t('forYou.empty')}
          hint={state.failure === 'denied' ? t('search.notAuthorizedHint') : t('forYou.emptyHint')}
          top={80}
        />
      ) : null}

      {sections.map((section) => (
        <div key={section.id} style={{ paddingBottom: SPACE.s5 }}>
          <SectionHeader>{section.title}</SectionHeader>
          {section.shelves.map((shelf) => (
            <div
              key={`${section.id}-${shelf.kind}`}
              className="mu-hrow"
              style={{ display: 'flex', gap: 12, padding: `0 ${SPACE.s4}px 4px` }}
            >
              {shelf.items.map((item) => (
                <Card
                  key={`${item.musicItemId}-${item.type}`}
                  item={item}
                  size={section.size}
                  busy={expanding === item.musicItemId}
                  onClick={() => {
                    store.rememberArtwork(item)
                    openItem(item)
                  }}
                  onLongPress={() => actions.collectionMenu(item)}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
      <div style={{ height: 24 }} />
    </PullToRefresh>
  )
}

function Card({
  item,
  size,
  busy,
  onClick,
  onLongPress,
}: {
  item: MusicItem
  size: number
  busy: boolean
  onClick: () => void
  onLongPress: () => void
}) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  return (
    <button
      type="button"
      className="mu-btn mu-press"
      onClick={onClick}
      onPointerDown={() => {
        timer.current = setTimeout(onLongPress, 500)
      }}
      onPointerUp={() => {
        if (timer.current) clearTimeout(timer.current)
      }}
      onPointerCancel={() => {
        if (timer.current) clearTimeout(timer.current)
      }}
      style={{ width: size, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ position: 'relative' }}>
        <Artwork url={item.artworkUrl} size={size} radius={12} iconSize={28} shadow="0 3px 6px rgba(0,0,0,0.18)" />
        {busy ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 12,
              background: 'rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spinner size={22} color="#fff" />
          </div>
        ) : null}
      </div>
      <span
        className="mu-clamp-1"
        style={{ fontSize: 13, fontWeight: 500, color: C.ink, width: size, textAlign: 'left' }}
      >
        {item.title || item.name}
      </span>
      {item.artist ? (
        <span className="mu-clamp-1" style={{ fontSize: 11, color: C.muted, width: size, textAlign: 'left' }}>
          {item.artist}
        </span>
      ) : null}
    </button>
  )
}
