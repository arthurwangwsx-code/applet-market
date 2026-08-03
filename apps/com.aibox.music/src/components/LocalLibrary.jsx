// 本地曲库浏览（§2.8）。四种模式：专辑 / 艺人 / 歌曲 / 流派。
//
// 三处平台差异（README 有记）：
//  · **没有封面** —— `music_local` 的条目不带封面字段，本地封面是沙盒 file://，WebView 读不到 → 一律音符占位；
//  · **不能导入文件夹** —— 容器只有单文件 picker，没有目录选择与安全书签持久化（缺口⑧）；
//  · **一次最多 500 条** —— `music_local` 的 limit 上限就是 500，超大曲库拿不全。
//
// 专辑/艺人/流派三种分组**在本地从歌曲列表派生**：`music_local` 的 albums/artists 动作
// 只回计数、不回曲目，派生一次反而更省桥调用，也顺带把流派补齐（工具没有 genres 动作）。

import React from 'react'
import Icon from './Icon.jsx'
import { EmptyState, Segmented, Spinner, VirtualList } from './primitives.jsx'
import { LocalTrackRow } from './rows.jsx'
import { C, SPACE } from './theme.js'
import { music as callMusic } from '../lib/host.js'

const LIMIT = 500
const ROW_HEIGHT = 60

export default function LocalLibrary({ ctx }) {
  const { t, actions } = ctx
  const [mode, setMode] = React.useState('albums')
  const [state, setState] = React.useState({ loading: true, tracks: [], issues: [], scanning: false })
  const [drill, setDrill] = React.useState(null)

  const load = React.useCallback(async ({ scan } = {}) => {
    setState((current) => ({ ...current, loading: current.tracks.length === 0, scanning: !!scan }))
    const result = await callMusic('local', { action: scan ? 'scan' : 'list', limit: LIMIT })
    const payload = result.json || {}
    setState({
      loading: false,
      scanning: false,
      tracks: Array.isArray(payload.tracks) ? payload.tracks : [],
      issues: Array.isArray(payload.scanIssues) ? payload.scanIssues : [],
    })
  }, [])

  React.useEffect(() => { load() }, [load])

  const tracks = state.tracks
  const groups = React.useMemo(() => derive(tracks), [tracks])

  if (state.loading) {
    return <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><Spinner color={C.muted} /></div>
  }

  if (tracks.length === 0) {
    return (
      <div className="mu-scroll">
        <Toolbar t={t} scanning={state.scanning} onRescan={() => load({ scan: true })} />
        {state.scanning
          ? <EmptyState icon="music.note.list" title={t('local.scanning')} />
          : <EmptyState icon="music.note.list" title={t('local.empty')} hint={t('local.emptyHint')} />}
      </div>
    )
  }

  const playFrom = (list, index) => actions.playTrack(list[index], list)

  if (drill) {
    const list = drill.tracks
    return (
      <VirtualList
        items={list.map((track, i) => ({ ...track, key: track.localTrackId || `${i}` }))}
        className="mu-scroll"
        estimatedRowHeight={ROW_HEIGHT}
        header={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `10px ${SPACE.s4}px` }}>
            <button type="button" className="mu-btn mu-press" onClick={() => setDrill(null)} style={{ color: C.accent }}>
              <Icon name="chevron.backward" size={16} color={C.accent} />
            </button>
            <span style={{ fontSize: 17, fontWeight: 600 }}>{drill.title}</span>
          </div>
        )}
        renderRow={(track, index) => (
          <LocalTrackRow
            track={track}
            onClick={() => playFrom(list, index)}
            onLongPress={() => actions.trackMenu(track, { group: list })}
          />
        )}
        footer={<div style={{ height: 24 }} />}
      />
    )
  }

  const rows = mode === 'songs' ? tracks : groups[mode]

  return (
    <VirtualList
      items={mode === 'songs'
        ? tracks.map((track, i) => ({ ...track, key: track.localTrackId || `${i}` }))
        : rows.map((row) => ({ ...row, key: row.title }))}
      className="mu-scroll"
      estimatedRowHeight={mode === 'songs' ? ROW_HEIGHT : (mode === 'albums' ? 68 : 56)}
      header={(
        <>
          <Toolbar t={t} scanning={state.scanning} onRescan={() => load({ scan: true })} />
          {state.issues.length > 0 ? (
            <div style={{
              margin: `0 ${SPACE.s4}px 12px`, padding: 12, borderRadius: 12, display: 'flex', gap: 10,
              background: `color-mix(in srgb, ${C.warning} 10%, transparent)`,
            }}
            >
              <Icon name="externaldrive.badge.exclamationmark" size={18} color={C.warning} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{t('local.unavailableTitle')}</span>
                <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{t('local.unavailableHint')}</span>
              </div>
            </div>
          ) : null}
          <div style={{ padding: `0 ${SPACE.s4}px ${SPACE.s2}px` }}>
            <Segmented
              items={[
                { id: 'albums', title: t('local.albums') },
                { id: 'artists', title: t('local.artists') },
                { id: 'songs', title: t('local.songs') },
                { id: 'genres', title: t('local.genres') },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        </>
      )}
      renderRow={(row, index) => {
        if (mode === 'songs') {
          return (
            <LocalTrackRow
              track={row}
              onClick={() => playFrom(tracks, index)}
              onLongPress={() => actions.trackMenu(row, { group: tracks })}
            />
          )
        }
        return (
          <GroupRow
            row={row}
            mode={mode}
            t={t}
            onClick={() => setDrill({ title: row.title, tracks: row.tracks })}
          />
        )
      }}
      footer={<div style={{ height: 24 }} />}
    />
  )
}

function Toolbar({ t, scanning, onRescan }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: `${SPACE.s2}px ${SPACE.s4}px`,
    }}
    >
      <span style={{ fontSize: 13, color: C.muted }}>{scanning ? t('local.scanning') : t('local.noArtwork')}</span>
      <button type="button" className="mu-btn mu-press" onClick={onRescan} disabled={scanning}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.accent, fontSize: 14, opacity: scanning ? 0.4 : 1 }}
      >
        <Icon name="arrow.clockwise" size={15} color={C.accent} />
        {t('local.rescan')}
      </button>
    </div>
  )
}

function GroupRow({ row, mode, t, onClick }) {
  const icon = mode === 'artists' ? 'music.mic' : (mode === 'genres' ? 'guitars' : 'square.stack')
  const subtitle = mode === 'artists'
    ? t('local.artistSubtitle', row.albumCount, row.tracks.length)
    : (mode === 'albums' ? row.subtitle : null)
  return (
    <button
      type="button"
      className="mu-btn mu-press"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: `8px ${SPACE.s4}px`, height: '100%' }}
    >
      <div style={{ width: 36, display: 'flex', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color={C.accent} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto' }}>
        <span className="mu-clamp-1" style={{ fontSize: 15, color: C.ink }}>{row.title}</span>
        {subtitle ? <span className="mu-clamp-1" style={{ fontSize: 12, color: C.muted }}>{subtitle}</span> : null}
      </div>
      {mode === 'genres' ? (
        <span className="mu-mono" style={{ fontSize: 13, color: C.muted }}>{row.tracks.length}</span>
      ) : null}
    </button>
  )
}

/** 从歌曲列表派生专辑 / 艺人 / 流派三种分组。展示回退与原生一致。 */
function derive(tracks) {
  const albums = new Map()
  const artists = new Map()
  const genres = new Map()
  tracks.forEach((track) => {
    const albumName = track.album || 'Unknown Album'
    const artistName = track.artist || 'Unknown Artist'
    const genreName = track.genre || null
    if (!albums.has(albumName)) albums.set(albumName, { title: albumName, subtitle: artistName, tracks: [] })
    albums.get(albumName).tracks.push(track)
    if (!artists.has(artistName)) artists.set(artistName, { title: artistName, tracks: [], albumNames: new Set() })
    const artistRow = artists.get(artistName)
    artistRow.tracks.push(track)
    artistRow.albumNames.add(albumName)
    if (genreName) {
      if (!genres.has(genreName)) genres.set(genreName, { title: genreName, tracks: [] })
      genres.get(genreName).tracks.push(track)
    }
  })
  const sortByTitle = (a, b) => String(a.title).localeCompare(String(b.title))
  return {
    albums: [...albums.values()].sort(sortByTitle),
    artists: [...artists.values()]
      .map((row) => ({ ...row, albumCount: row.albumNames.size }))
      .sort(sortByTitle),
    genres: [...genres.values()].sort(sortByTitle),
  }
}
