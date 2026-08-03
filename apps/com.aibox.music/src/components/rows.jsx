// 各页共用的行：队列行 / 歌曲行 / 合集行 / 曲目行（本地曲库与详情）。
// 行尺寸、字号与图标严格按规格 §2.4 / §2.6 / §2.8 / §2.11。

import React from 'react'
import Icon from './Icon.jsx'
import { Artwork, useLongPress } from './primitives.jsx'
import { C, SPACE } from './theme.js'
import { duration as fmtDuration, losslessBadge, trackSubtitle } from '../lib/format.js'

/** 队列行（§2.4）：36×36 封面；当前行叠 waveform / play.fill，标题用 accent。 */
export function QueueRow({ track, isCurrent, isPlaying, onClick, onLongPress, trailing, rowId }) {
  const press = useLongPress(() => onLongPress && onLongPress())
  return (
    <div
      className="mu-press"
      data-row-id={rowId}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `6px ${SPACE.s4}px` }}
      {...press.bind}
      onClick={() => { if (!press.consumed() && onClick) onClick() }}
    >
      <div style={{ position: 'relative' }}>
        <Artwork
          url={track.artworkUrl}
          size={36}
          radius={6}
          iconSize={16}
          tint={isCurrent ? C.accent : C.muted}
          background={isCurrent
            ? `color-mix(in srgb, ${C.accent} 12%, transparent)`
            : `color-mix(in srgb, ${C.line} 50%, transparent)`}
        />
        {isCurrent ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.28)', borderRadius: 6,
          }}
          >
            <Icon name={isPlaying ? 'waveform' : 'play.fill'} size={isPlaying ? 14 : 12} color={C.accent} />
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 1 auto' }}>
        <span
          className="mu-clamp-1"
          style={{ fontSize: 13, fontWeight: isCurrent ? 500 : 400, color: isCurrent ? C.accent : C.ink }}
        >
          {track.title}
        </span>
        {track.artist ? <span className="mu-clamp-1" style={{ fontSize: 11, color: C.muted }}>{track.artist}</span> : null}
      </div>
      {Number(track.duration) > 0 ? (
        <span className="mu-mono" style={{ fontSize: 11, color: C.muted }}>{fmtDuration(track.duration)}</span>
      ) : null}
      {trailing}
    </div>
  )
}

/** 搜索/收藏里的歌曲行（§2.6）：40×40 封面 + 右侧 play.circle.fill。 */
export function SongRow({ track, onClick, onLongPress, trailing, artworkSize = 40, rowId }) {
  const press = useLongPress(() => onLongPress && onLongPress())
  return (
    <div
      className="mu-press"
      aria-label="audioSongRow"
      data-row-id={rowId}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `6px ${SPACE.s4}px` }}
      {...press.bind}
      onClick={() => { if (!press.consumed() && onClick) onClick() }}
    >
      <Artwork url={track.artworkUrl} size={artworkSize} radius={6} iconSize={16} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 1 auto' }}>
        <span className="mu-clamp-1" style={{ fontSize: 14, color: C.ink }}>{track.title}</span>
        {track.artist ? <span className="mu-clamp-1" style={{ fontSize: 11, color: C.muted }}>{track.artist}</span> : null}
      </div>
      {trailing !== undefined ? trailing : <Icon name="play.circle.fill" size={22} color={C.accent} />}
    </div>
  )
}

/** 合集行（艺人 / 专辑 / 歌单）：44×44 封面，**艺人是圆形**。 */
export function CollectionRow({ item, onClick, onLongPress, rowId }) {
  const press = useLongPress(() => onLongPress && onLongPress())
  const circular = item.type === 'artist'
  return (
    <div
      className="mu-press"
      aria-label="audioCollectionRow"
      data-row-id={rowId}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `8px ${SPACE.s4}px` }}
      {...press.bind}
      onClick={() => { if (!press.consumed() && onClick) onClick() }}
    >
      <Artwork url={item.artworkUrl} size={44} radius={circular ? 22 : 6} iconSize={18} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 1 auto' }}>
        <span className="mu-clamp-1" style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>
          {item.title || item.name}
        </span>
        {item.artist || item.curator ? (
          <span className="mu-clamp-1" style={{ fontSize: 11, color: C.muted }}>{item.artist || item.curator}</span>
        ) : null}
      </div>
      <Icon name="chevron.right" size={13} color={C.muted} />
    </div>
  )
}

/** 本地曲库的曲目行（§2.8）：44 封面 + 「艺人 · 专辑」+ 音质标签。 */
export function LocalTrackRow({ track, onClick, onLongPress }) {
  const press = useLongPress(() => onLongPress && onLongPress())
  const badge = losslessBadge(track.codec)
  return (
    <div
      className="mu-press"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `6px ${SPACE.s4}px`, height: 60 }}
      {...press.bind}
      onClick={() => { if (!press.consumed() && onClick) onClick() }}
    >
      <Artwork url={track.artworkUrl} size={44} radius={8} iconSize={14} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto' }}>
        <span className="mu-clamp-1" style={{ fontSize: 15, color: C.ink }}>{track.title}</span>
        <span className="mu-clamp-1" style={{ fontSize: 12, color: C.muted }}>{trackSubtitle(track)}</span>
      </div>
      {badge ? (
        <span style={{
          fontSize: 9, color: C.accent, padding: '2px 5px', borderRadius: 999,
          background: `color-mix(in srgb, ${C.accent} 12%, transparent)`, flex: '0 0 auto',
        }}
        >
          {badge}
        </span>
      ) : null}
    </div>
  )
}

/** 专辑/歌单详情里的曲目行（§2.11）：序号 + 标题/艺人 + 时长。 */
export function NumberedTrackRow({ index, track, onClick, onLongPress, numberWidth = 28 }) {
  const press = useLongPress(() => onLongPress && onLongPress())
  return (
    <div
      className="mu-press"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `10px ${SPACE.s4}px` }}
      {...press.bind}
      onClick={() => { if (!press.consumed() && onClick) onClick() }}
    >
      <span className="mu-mono" style={{ fontSize: 13, color: C.muted, width: numberWidth, textAlign: 'right' }}>
        {index + 1}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 1 auto' }}>
        <span className="mu-clamp-1" style={{ fontSize: 14, color: C.ink }}>{track.title}</span>
        {track.artist ? <span className="mu-clamp-1" style={{ fontSize: 11, color: C.muted }}>{track.artist}</span> : null}
      </div>
      {Number(track.duration) > 0 ? (
        <span className="mu-mono" style={{ fontSize: 11, color: C.muted }}>{fmtDuration(track.duration)}</span>
      ) : null}
    </div>
  )
}

export function Divider({ inset = 16 }) {
  return <div style={{ height: 0.5, background: C.line, marginLeft: inset }} />
}
