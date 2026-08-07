// 搜索页（§2.6）。范围切换 Apple Music / 资料库，防抖 300ms，结果分五段。
//
// 与原生的两处差异（宿主缺口，见 README）：
//  · **没有实时建议** —— 原生用 `MusicCatalogSearchSuggestionsRequest`，宿主未投影，这里不渲染建议行；
//  · 「资料库」范围走 `music_library` 的分类浏览 + 本地过滤，不是服务端的资料库搜索。

import React from 'react'
import Icon from './Icon.js'
import { EmptyState, ListHeader, Segmented, Spinner, SwipeRow } from './primitives.js'
import { useRowGestures } from 'aibox/ui'
import { CollectionRow, SongRow } from './rows.js'
import { C, SPACE } from './theme.js'
import { music as callMusic, classifyMusicError, openURL } from '../lib/host.js'
import type { MusicAppContext, MusicAvailability, MusicItem, MusicTrack } from '../lib/types.js'

const DEBOUNCE_MS = 300

/** 手势层的行身份。歌曲与合集的 id 空间可能撞车，故带类型前缀。 */
function rowKey(kind: string, item: MusicItem | null | undefined): string {
  if (!item) return ''
  return `${kind}:${item.musicItemId || item.localTrackId || item.url || item.title || ''}`
}

type SearchScope = 'catalog' | 'library'
type SearchResult = { songs: MusicItem[]; albums: MusicItem[]; artists: MusicItem[]; playlists: MusicItem[] }
type IndexedRow = { kind: 'song' | 'item'; item: MusicItem }

export default function SearchPage({
  ctx,
  query,
  onQueryChange,
  searchRendered,
}: {
  ctx: MusicAppContext
  query: string
  onQueryChange: (query: string) => void
  searchRendered: boolean
}) {
  const { t, store, actions } = ctx
  const [scope, setScope] = React.useState<SearchScope>('catalog')
  const [state, setState] = React.useState<{
    loading: boolean
    result: SearchResult | null
    failure: MusicAvailability | null
  }>({ loading: false, result: null, failure: null })

  React.useEffect(() => {
    const value = String(query || '').trim()
    if (!value) {
      setState({ loading: false, result: null, failure: null })
      return undefined
    }
    setState((current) => ({ ...current, loading: true }))
    const timer = setTimeout(async () => {
      const result = await callMusic<Partial<SearchResult>>('search', {
        query: value,
        types: ['song', 'album', 'artist', 'playlist'],
        limit: 12,
        ...(scope === 'library' ? { source: 'local' } : {}),
      })
      if (!result.ok) {
        setState({ loading: false, result: null, failure: classifyMusicError(result.error) })
        return
      }
      const raw = result.json || {}
      const payload: SearchResult = {
        songs: Array.isArray(raw.songs) ? raw.songs : [],
        albums: Array.isArray(raw.albums) ? raw.albums : [],
        artists: Array.isArray(raw.artists) ? raw.artists : [],
        playlists: Array.isArray(raw.playlists) ? raw.playlists : [],
      }
      ;(['songs', 'albums', 'artists', 'playlists'] as Array<keyof SearchResult>).forEach((kind) => {
        ;(payload[kind] || []).forEach((row) => store.rememberArtwork(row))
      })
      setState({ loading: false, result: payload, failure: null })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, scope, store])

  const submit = () => {
    const value = String(query || '').trim()
    if (value) store.recordQuery(value)
  }

  const playSong = (track: MusicTrack, group: MusicTrack[]) => {
    submit()
    store.recordSearchTrack(track)
    actions.playTrack(track, group)
  }

  const result = state.result
  const songs = result?.songs || []
  const albums = result?.albums || []
  const artists = result?.artists || []
  const playlists = result?.playlists || []
  const hasResults = songs.length + albums.length + artists.length + playlists.length > 0

  // 顶级结果：歌曲第 1 + 艺人第 1 + 专辑第 1，不足 3 条补歌单第 1，最多 3 条。
  const top = [songs[0], artists[0], albums[0]].filter((item): item is MusicItem => Boolean(item)).slice(0, 3)
  if (top.length < 3 && playlists[0]) top.push(playlists[0])

  // —— 原生行手势（`aibox.list.*`）——
  //
  // 结果里歌曲行与合集行的可用动作不同，但**身份必须一次声明完**（合同同 `aibox.menu`：
  // 只能改显示状态、不能增删 id）。所以四项都声明，用逐行 `rowOverrides` 把不适用的那几项藏掉——
  // 这正是 `rowOverrides` 存在的理由，不要靠给每种行各配一个 region。
  const rowIndex = React.useMemo(() => {
    const map = new Map<string, IndexedRow>()
    songs.forEach((item) => map.set(rowKey('song', item), { kind: 'song', item }))
    ;[...artists, ...albums, ...playlists].forEach((item) => map.set(rowKey('item', item), { kind: 'item', item }))
    // 「顶级结果」里的那几条会**同时**出现在下面的分段里 —— 同一个 `data-row-id` 出现两次
    // 就是两份矩形争同一个身份（宿主只认最后一份，菜单会弹在错误的那一行）。给它们独立后缀。
    top.forEach((item) => {
      const kind = item.type === 'song' ? 'song' : 'item'
      map.set(`${rowKey(kind, item)}#top`, { kind, item })
    })
    return map
  }, [songs, artists, albums, playlists, top])

  const openExternal = (item: MusicItem) => {
    const link = item.url || store.externalURL(item)
    if (link) openURL(link)
  }

  const gestures = useRowGestures('search.results', {
    contextMenu: [
      { id: 'play', title: t('common.play'), icon: 'play.fill' },
      { id: 'queue', title: t('common.addToQueue'), icon: 'text.append' },
      { id: 'favorite', title: t('common.addToFavorites'), icon: 'heart' },
      { id: 'open', title: t('common.openInAppleMusic'), icon: 'arrow.up.forward.app' },
    ],
    rowOverrides: (rowId) => {
      const row = rowIndex.get(rowId)
      if (!row) return null
      const hasLink = !!(row.item && (row.item.url || store.externalURL(row.item)))
      return {
        queue: { hidden: row.kind !== 'song' },
        favorite: { hidden: row.kind !== 'song' },
        open: { hidden: !hasLink },
      }
    },
    onAction: ({ rowId, actionId }) => {
      const row = rowIndex.get(rowId)
      if (!row) return
      if (row.kind === 'song') {
        if (actionId === 'play') playSong(row.item, songs)
        else if (actionId === 'queue') actions.addToQueue(row.item)
        else if (actionId === 'favorite') actions.toggleFavorite(row.item, true)
        else if (actionId === 'open') openExternal(row.item)
        return
      }
      if (actionId === 'play') actions.playCollection(row.item)
      else if (actionId === 'open') openExternal(row.item)
    },
  })

  return (
    <div className="mu-scroll">
      {!searchRendered ? (
        <div style={{ padding: `${SPACE.s2}px ${SPACE.s4}px 0` }}>
          <input
            value={query}
            placeholder={t('search.placeholder')}
            autoCorrect="off"
            autoCapitalize="none"
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
            style={{
              width: '100%',
              border: 0,
              outline: 'none',
              borderRadius: 10,
              background: `color-mix(in srgb, ${C.muted} 12%, transparent)`,
              padding: '9px 12px',
              fontSize: 16,
              color: C.ink,
            }}
          />
        </div>
      ) : null}

      <div style={{ padding: `${SPACE.s2}px ${SPACE.s4}px` }}>
        <Segmented
          items={[
            { id: 'catalog', title: t('search.scopeCatalog') },
            { id: 'library', title: t('search.scopeLibrary') },
          ]}
          value={scope}
          onChange={setScope}
        />
      </div>

      {state.loading ? (
        <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
          <Spinner color={C.muted} />
        </div>
      ) : null}

      {!state.loading && state.failure === 'denied' ? (
        <EmptyState icon="lock" title={t('search.notAuthorized')} hint={t('search.notAuthorizedHint')} />
      ) : null}

      {!state.loading && state.failure === 'noSubscription' ? (
        <div style={{ display: 'flex', gap: 8, padding: `8px ${SPACE.s4}px`, alignItems: 'flex-start' }}>
          <Icon name="info.circle" size={15} color={C.accent} />
          <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{t('search.noSubBanner')}</span>
        </div>
      ) : null}

      {!state.loading && String(query || '').trim() && !hasResults && !state.failure ? (
        <EmptyState icon="magnifyingglass" title={t('search.noResults', String(query).trim())} />
      ) : null}

      {hasResults ? (
        <div {...gestures.regionProps}>
          {top.length > 0 ? (
            <>
              <ListHeader>{t('search.topResults')}</ListHeader>
              {top.map((item) =>
                item.type === 'song' ? (
                  <SongRow
                    key={`top-${item.musicItemId}`}
                    rowId={`${rowKey('song', item)}#top`}
                    track={item}
                    onClick={() => playSong(item, songs)}
                    onLongPress={gestures.rendered ? undefined : () => actions.trackMenu(item, { group: songs })}
                  />
                ) : (
                  <CollectionRow
                    key={`top-${item.type}-${item.musicItemId}`}
                    rowId={`${rowKey('item', item)}#top`}
                    item={item}
                    onClick={() => {
                      submit()
                      actions.openCollection(item)
                    }}
                    onLongPress={gestures.rendered ? undefined : () => actions.collectionMenu(item)}
                  />
                ),
              )}
            </>
          ) : null}

          <Group
            title={t('search.artists')}
            items={artists}
            render={(item) => (
              <CollectionRow
                key={item.musicItemId}
                rowId={rowKey('item', item)}
                item={item}
                onClick={() => {
                  submit()
                  actions.openCollection(item)
                }}
                onLongPress={gestures.rendered ? undefined : () => actions.collectionMenu(item)}
              />
            )}
          />

          <Group
            title={t('search.songs')}
            items={songs}
            render={(item) => (
              <SongRow
                key={item.musicItemId || item.localTrackId}
                rowId={rowKey('song', item)}
                track={item}
                onClick={() => playSong(item, songs)}
                onLongPress={gestures.rendered ? undefined : () => actions.trackMenu(item, { group: songs })}
              />
            )}
          />

          <Group
            title={t('search.albums')}
            items={albums}
            render={(item) => (
              <CollectionRow
                key={item.musicItemId}
                rowId={rowKey('item', item)}
                item={item}
                onClick={() => {
                  submit()
                  actions.openCollection(item)
                }}
                onLongPress={gestures.rendered ? undefined : () => actions.collectionMenu(item)}
              />
            )}
          />

          <Group
            title={t('search.playlists')}
            items={playlists}
            render={(item) => (
              <CollectionRow
                key={item.musicItemId}
                rowId={rowKey('item', item)}
                item={item}
                onClick={() => {
                  submit()
                  actions.openCollection(item)
                }}
                onLongPress={gestures.rendered ? undefined : () => actions.collectionMenu(item)}
              />
            )}
          />
        </div>
      ) : null}

      {!String(query || '').trim() && !state.loading ? <History ctx={ctx} onPick={onQueryChange} /> : null}

      <div style={{ height: 24 }} />
    </div>
  )
}

function Group({
  title,
  items,
  render,
}: {
  title: React.ReactNode
  items: MusicItem[]
  render: (item: MusicItem, index: number) => React.ReactNode
}) {
  if (!items || items.length === 0) return null
  return (
    <>
      <ListHeader>{title}</ListHeader>
      {items.map(render)}
    </>
  )
}

function History({ ctx, onPick }: { ctx: MusicAppContext; onPick: (query: string) => void }) {
  const { t, store, actions } = ctx
  const queries = store.search.queries
  const tracks = store.search.tracks

  if (queries.length === 0 && tracks.length === 0) {
    return <EmptyState icon="magnifyingglass" title={t('search.emptyTitle')} hint={t('search.emptyHint')} />
  }

  return (
    <>
      {queries.length > 0 ? (
        <>
          <ListHeader
            trailing={
              <button
                type="button"
                className="mu-btn mu-press"
                onClick={() => actions.confirmClear(t('search.clearConfirm'), () => store.clearQueries())}
                style={{ fontSize: 12, fontWeight: 500, color: C.accent }}
              >
                {t('common.clear')}
              </button>
            }
          >
            {t('search.recentSearches')}
          </ListHeader>
          {queries.map((row) => (
            <SwipeRow key={row} actionLabel={t('common.delete')} onAction={() => store.removeQuery(row)}>
              <button
                type="button"
                className="mu-btn mu-press"
                onClick={() => onPick(row)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: `10px ${SPACE.s4}px` }}
              >
                <Icon name="clock.arrow.circlepath" size={16} color={C.muted} />
                <span className="mu-clamp-1" style={{ flex: '1 1 auto', fontSize: 15, color: C.ink }}>
                  {row}
                </span>
                <Icon name="arrow.up.left" size={12} color={C.muted} />
              </button>
            </SwipeRow>
          ))}
        </>
      ) : null}

      {tracks.length > 0 ? (
        <>
          <ListHeader
            trailing={
              <button
                type="button"
                className="mu-btn mu-press"
                onClick={() => actions.confirmClear(t('search.clearConfirm'), () => store.clearSearchTracks())}
                style={{ fontSize: 12, fontWeight: 500, color: C.accent }}
              >
                {t('common.clear')}
              </button>
            }
          >
            {t('search.recentTracks')}
          </ListHeader>
          {tracks.map((row) => (
            <SwipeRow key={row.key} actionLabel={t('common.remove')} onAction={() => store.removeSearchTrack(row.key)}>
              <SongRow
                track={row.track}
                onClick={() =>
                  actions.playTrack(
                    row.track,
                    tracks.map((item) => item.track),
                  )
                }
                onLongPress={() => actions.trackMenu(row.track)}
              />
            </SwipeRow>
          ))}
        </>
      ) : null}
    </>
  )
}
