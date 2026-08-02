// 队列页（§2.4）。最多三段：正在播放 / 即将播放 / 最常播放。
// 「即将播放」= currentIndex+1 到末尾——**已播过的不显示**（与 Apple Music 一致）。
//
// 拖拽排序：宿主 `music_queue action=move` 一次只能移一步（缺口⑪ 没有批量重排），
// 所以这里在拖动过程中只做本地乐观重排，**松手时只发一次 move(from,to)**，再用真值对账。

import React from 'react'
import Icon from './Icon.jsx'
import { EmptyState, ListHeader, SwipeRow } from './primitives.jsx'
import { QueueRow } from './rows.jsx'
import { C, SPACE } from './theme.js'

const ROW = 52

export default function QueuePage({ ctx }) {
  const { t, music, store, actions } = ctx
  const [editing, setEditing] = React.useState(false)
  const [drag, setDrag] = React.useState(null)

  const tracks = music.queue.tracks
  const index = Number(music.status.currentIndex)
  const current = (index >= 0 && index < tracks.length) ? tracks[index] : null
  const upNext = index >= 0 ? tracks.slice(index + 1) : tracks.slice()
  const currentKey = current ? (current.musicItemId ? `am:${current.musicItemId}` : `url:${current.url}`) : null
  const mostPlayed = store.mostPlayed(8, currentKey)

  const ordered = React.useMemo(() => {
    if (!drag) return upNext
    const list = upNext.slice()
    const [moved] = list.splice(drag.from, 1)
    list.splice(drag.to, 0, moved)
    return list
  }, [upNext, drag])

  if (tracks.length === 0 && mostPlayed.length === 0) {
    return (
      <div className="mu-scroll">
        <EmptyState icon="music.note.list" title={t('queue.empty')} hint={t('queue.emptyHint')} />
      </div>
    )
  }

  return (
    <div className="mu-scroll">
      {upNext.length > 0 ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: `8px ${SPACE.s4}px 0` }}>
          <button
            type="button"
            className="mu-btn mu-press"
            onClick={() => setEditing(!editing)}
            style={{ fontSize: 16, fontWeight: 600, color: C.accent }}
          >
            {editing ? t('common.done') : t('common.edit')}
          </button>
        </div>
      ) : null}

      {current ? (
        <>
          <ListHeader>{t('queue.nowPlaying')}</ListHeader>
          <QueueRow
            track={current}
            isCurrent
            isPlaying={music.status.isPlaying}
            onClick={() => actions.playQueueIndex(index)}
          />
        </>
      ) : null}

      {upNext.length > 0 ? (
        <>
          <ListHeader>{t('queue.playingNext')}</ListHeader>
          <div style={{ position: 'relative' }}>
            {ordered.map((track, position) => {
              const absolute = index + 1 + position
              const row = (
                <QueueRow
                  track={track}
                  isCurrent={false}
                  isPlaying={false}
                  onClick={editing ? undefined : () => actions.playQueueIndex(absolute)}
                  onLongPress={() => actions.trackMenu(track, { queueIndex: absolute })}
                  trailing={editing ? (
                    <span
                      className="mu-press"
                      style={{ padding: '6px 2px 6px 10px', color: C.muted, touchAction: 'none' }}
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId)
                        setDrag({ from: position, to: position, startY: event.clientY })
                      }}
                      onPointerMove={(event) => {
                        setDrag((state) => {
                          if (!state) return state
                          const delta = Math.round((event.clientY - state.startY) / ROW)
                          const to = Math.max(0, Math.min(upNext.length - 1, state.from + delta))
                          return to === state.to ? state : { ...state, to }
                        })
                      }}
                      onPointerUp={() => {
                        setDrag((state) => {
                          if (state && state.from !== state.to) {
                            actions.moveQueue(index + 1 + state.from, index + 1 + state.to)
                          }
                          return null
                        })
                      }}
                      onPointerCancel={() => setDrag(null)}
                    >
                      <Icon name="line.3.horizontal" size={18} />
                    </span>
                  ) : undefined}
                />
              )
              return (
                <SwipeRow
                  key={`${track.id || track.title}-${absolute}`}
                  actionLabel={t('common.remove')}
                  onAction={() => actions.removeQueue(absolute)}
                >
                  {row}
                </SwipeRow>
              )
            })}
          </div>
        </>
      ) : null}

      {mostPlayed.length > 0 ? (
        <>
          <ListHeader>{t('queue.mostPlayed')}</ListHeader>
          {mostPlayed.map((row) => (
            <QueueRow
              key={row.key}
              track={row.track}
              isCurrent={false}
              isPlaying={false}
              onClick={() => actions.playTrack(row.track, mostPlayed.map((item) => item.track))}
              onLongPress={() => actions.trackMenu(row.track)}
              trailing={(
                <button
                  type="button"
                  className="mu-btn mu-press"
                  onClick={(event) => { event.stopPropagation(); actions.addToQueue(row.track) }}
                  style={{ padding: '6px 2px 6px 10px', color: C.accent }}
                >
                  <Icon name="text.append" size={15} />
                </button>
              )}
            />
          ))}
        </>
      ) : null}

      <div style={{ height: 24 }} />
    </div>
  )
}
