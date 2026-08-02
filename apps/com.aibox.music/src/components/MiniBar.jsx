// mini 播放条（§3.3）。**只在非 Now Playing tab 出现**，且必须有当前曲目。
// 手势：整条支持**上滑展开** —— 拖拽超过 25px 即切到 Now Playing（不只是点击）。

import React from 'react'
import Icon from './Icon.jsx'
import { Artwork, Spinner } from './primitives.jsx'
import { C } from './theme.js'

export default function MiniBar({ track, isPlaying, busy, progress, onOpen, onToggle, onNext, t }) {
  const start = React.useRef(null)
  const [lift, setLift] = React.useState(0)
  if (!track) return null

  return (
    <div
      aria-label="audioMiniBar"
      style={{
        flex: '0 0 auto', padding: '0 12px 4px',
        transform: `translateY(${-lift}px)`,
        transition: start.current ? 'none' : 'transform 0.18s ease-out',
      }}
      onPointerDown={(event) => { start.current = { y: event.clientY, moved: false } }}
      onPointerMove={(event) => {
        if (!start.current) return
        const delta = event.clientY - start.current.y
        if (delta < -3) start.current.moved = true
        setLift(Math.max(0, Math.min(40, -delta)))
      }}
      onPointerUp={(event) => {
        const info = start.current
        start.current = null
        setLift(0)
        if (!info) return
        // translation.height < -25 即展开（与原生同阈值）
        if (event.clientY - info.y < -25) onOpen()
      }}
      onPointerCancel={() => { start.current = null; setLift(0) }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
        borderRadius: 16, background: C.glass,
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 4px 10px rgba(0,0,0,0.12)', position: 'relative', overflow: 'hidden',
      }}
      >
        <button
          type="button"
          className="mu-btn mu-press"
          onClick={onOpen}
          style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 auto', minWidth: 0 }}
        >
          <Artwork url={track.artworkUrl} size={40} radius={7} iconSize={16} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 1 auto' }}>
            <span className="mu-clamp-1" style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
              {track.title || t('np.notPlaying')}
            </span>
            {track.artist ? (
              <span className="mu-clamp-1" style={{ fontSize: 12, color: C.muted }}>{track.artist}</span>
            ) : null}
          </div>
        </button>

        <button
          type="button"
          className="mu-btn mu-press"
          onClick={onToggle}
          style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}
        >
          {busy ? <Spinner size={18} color={C.ink} /> : <Icon name={isPlaying ? 'pause.fill' : 'play.fill'} size={22} />}
        </button>
        <button
          type="button"
          className="mu-btn mu-press"
          onClick={onNext}
          style={{ width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}
        >
          <Icon name="forward.fill" size={18} />
        </button>

        {/* 底部 2pt 进度线 */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: `color-mix(in srgb, ${C.muted} 18%, transparent)` }}>
          <div style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, height: '100%', background: C.accent }} />
        </div>
      </div>
    </div>
  )
}
