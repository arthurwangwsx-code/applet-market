// Now Playing（§2.1）。**普通独立页**，不是下拉抽屉、不是沉浸 overlay，本页自身没有任何拖拽手势。
// 两个就地切换的形态（专辑 / 歌词）**共享底部控件组**。

import React from 'react'
import Icon from './Icon.jsx'
import { Artwork, ToastCapsule } from './primitives.jsx'
import { Scrubber, TransportBar } from './PlayerControls.jsx'
import Lyrics from './Lyrics.jsx'
import { WHITE } from './theme.js'
import { rgba, sizedArtworkURL, artworkDataURL } from '../lib/artwork.js'

const MAX_COVER = 340

export default function NowPlaying({
  track, status, busy, progress, position, duration, artworkURL, color,
  lyrics, mode, onSetMode, isFavorite, onToggleFavorite, onOpenTrackMenu,
  scrub, onPrevious, onNext, onTogglePlay, onSeekSeconds, onRetry, t,
}) {
  const [controlsHidden, setControlsHidden] = React.useState(false)
  const [toast, setToast] = React.useState(null)
  const toastTimer = React.useRef(null)

  const showToast = (message) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }
  React.useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const toggleMode = () => {
    if (!track) { showToast(t('np.lyricsUnavailable')); return }
    onSetMode(mode === 'lyrics' ? 'album' : 'lyrics')
    if (mode === 'lyrics') setControlsHidden(false)
  }

  const failed = status.playbackState === 'failed'

  return (
    <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Ambient url={artworkURL} color={color} dim={mode === 'lyrics'} />

      <div style={{
        position: 'relative', zIndex: 1, flex: '1 1 auto', minHeight: 0,
        display: 'flex', flexDirection: 'column',
        padding: '12px 20px 20px', color: WHITE.primary,
      }}
      >
        {mode === 'lyrics' ? (
          <>
            <LyricsHeader
              track={track}
              artworkURL={artworkURL}
              isFavorite={isFavorite}
              onToggleFavorite={onToggleFavorite}
              onOpenTrackMenu={onOpenTrackMenu}
              onBack={() => { onSetMode('album'); setControlsHidden(false) }}
              t={t}
            />
            <Lyrics
              payload={lyrics}
              displayTime={position}
              onSeek={onSeekSeconds}
              onUserScroll={setControlsHidden}
              t={t}
            />
          </>
        ) : (
          <>
            <div style={{ flex: '0 1 16px', minHeight: 16 }} />
            <CoverArea
              url={artworkURL}
              playing={status.isPlaying}
              onTap={toggleMode}
              onLyrics={toggleMode}
            />
            <div style={{ height: 24, flex: '0 0 auto' }} />
            <TitleRow
              track={track}
              isFavorite={isFavorite}
              onToggleFavorite={onToggleFavorite}
              onOpenTrackMenu={onOpenTrackMenu}
              t={t}
            />
            <div style={{ flex: '1 1 20px', minHeight: 20 }} />
          </>
        )}

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 20, flex: '0 0 auto',
          maxHeight: controlsHidden ? 0 : 200,
          opacity: controlsHidden ? 0 : 1,
          overflow: 'hidden',
          transform: controlsHidden ? 'translateY(24px)' : 'none',
          transition: 'opacity 0.28s ease-in-out, transform 0.28s ease-in-out, max-height 0.28s ease-in-out',
        }}
        >
          <Scrubber
            progress={progress}
            position={position}
            duration={duration}
            onBegin={scrub.begin}
            onChange={scrub.update}
            onEnd={scrub.end}
          />
          <TransportBar
            isPlaying={status.isPlaying}
            busy={busy}
            disabled={!track}
            onPrevious={onPrevious}
            onToggle={onTogglePlay}
            onNext={onNext}
          />
        </div>
      </div>

      {failed ? <FailureCard status={status} onRetry={onRetry} t={t} /> : null}
      <ToastCapsule message={toast} />
    </div>
  )
}

/** 氛围背景：自下而上 5 层，铺满全屏（含安全区）。 */
function Ambient({ url, color, dim }) {
  const [dataURL, setDataURL] = React.useState(null)
  const target = url ? sizedArtworkURL(url, 200) : null
  React.useEffect(() => {
    let cancelled = false
    setDataURL(null)
    if (!target) return undefined
    artworkDataURL(target).then((value) => { if (!cancelled) setDataURL(value) })
    return () => { cancelled = true }
  }, [target])

  const base = color ? rgba(color, 0.55) : 'rgba(255,107,107,0.55)'
  const mid = color ? rgba(color, 0.16) : 'rgba(255,107,107,0.16)'
  return (
    <div className="mu-ambient">
      {/* ① 纯黑打底：保证任意专辑色下白控件都可读 */}
      <div style={{ background: '#000' }} />
      {/* ② 模糊封面（被有具体尺寸的容器裁住，绝不撑开父级） */}
      {dataURL ? <img className="mu-ambient-blur" src={dataURL} alt="" /> : null}
      {/* ③ 专辑取色线性渐变 top→bottom */}
      <div style={{
        background: `linear-gradient(to bottom, ${base} 0%, ${mid} 55%, rgba(0,0,0,0.35) 100%)`,
        transition: 'background 0.4s ease-in-out',
      }}
      />
      {/* ④ 底部加深（下半屏是控件密集区） */}
      <div style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.5) 100%)' }} />
      {/* ⑤ 歌词态再整体压一层 */}
      <div style={{
        background: 'rgba(0,0,0,0.28)',
        opacity: dim ? 1 : 0,
        transition: 'opacity 0.35s ease-in-out',
      }}
      />
    </div>
  )
}

function CoverArea({ url, playing, onTap, onLyrics }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flex: '0 1 auto', minHeight: 0 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: MAX_COVER,
          aspectRatio: '1 / 1',
          transform: `scale(${playing ? 1 : 0.86})`,
          transition: 'transform 0.45s cubic-bezier(0.2,0.9,0.3,1)',
        }}
      >
        <button
          type="button"
          className="mu-btn mu-press"
          onClick={onTap}
          style={{ display: 'block', width: '100%', height: '100%' }}
        >
          <Artwork
            url={url}
            size="100%"
            radius={16}
            iconSize={64}
            tint="#FFFFFF"
            background="rgba(255,255,255,0.08)"
            shadow={playing ? '0 14px 28px rgba(0,0,0,0.4)' : '0 7px 14px rgba(0,0,0,0.4)'}
            style={{ width: '100%', height: '100%', minWidth: 0 }}
          />
        </button>
        <button
          type="button"
          className="mu-btn mu-press"
          onClick={(event) => { event.stopPropagation(); onLyrics() }}
          aria-label="audioLyricsToggle"
          style={{
            position: 'absolute', right: 12, bottom: 12, width: 44, height: 44, borderRadius: 22,
            background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="quote.bubble.fill" size={18} color={WHITE.primary} />
        </button>
      </div>
    </div>
  )
}

function TitleRow({ track, isFavorite, onToggleFavorite, onOpenTrackMenu, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: '1 1 auto' }}>
        <span className="mu-clamp-1" style={{ fontSize: 22, fontWeight: 700, color: WHITE.primary }}>
          {track ? track.title : t('np.notPlaying')}
        </span>
        {track && track.artist ? (
          <span className="mu-clamp-1" style={{ fontSize: 17, color: WHITE.secondary }}>{track.artist}</span>
        ) : null}
      </div>
      <button type="button" className="mu-btn mu-press" onClick={onToggleFavorite} disabled={!track}
        style={{ opacity: track ? 1 : 0.35, padding: 4 }}
      >
        <Icon name={isFavorite ? 'star.fill' : 'star'} size={24} color={WHITE.primary} />
      </button>
      <button type="button" className="mu-btn mu-press" onClick={onOpenTrackMenu} disabled={!track}
        style={{ opacity: track ? 1 : 0.35, padding: 4 }}
      >
        <Icon name="ellipsis" size={24} color={WHITE.primary} />
      </button>
    </div>
  )
}

function LyricsHeader({ track, artworkURL, isFavorite, onToggleFavorite, onOpenTrackMenu, onBack, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto', paddingBottom: 8 }}>
      <button type="button" className="mu-btn mu-press" onClick={onBack}>
        <Artwork
          url={artworkURL}
          size={52}
          radius={8}
          iconSize={22}
          tint="#FFFFFF"
          background="rgba(255,255,255,0.1)"
        />
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto', marginLeft: 4 }}>
        <span className="mu-clamp-1" style={{ fontSize: 17, fontWeight: 700, color: WHITE.primary }}>
          {track ? track.title : t('np.notPlaying')}
        </span>
        {track && track.artist ? (
          <span className="mu-clamp-1" style={{ fontSize: 13, color: WHITE.secondary }}>{track.artist}</span>
        ) : null}
      </div>
      <button type="button" className="mu-btn mu-press" onClick={onToggleFavorite} style={{ padding: 4 }}>
        <Icon name={isFavorite ? 'star.fill' : 'star'} size={20} color={WHITE.primary} />
      </button>
      <button type="button" className="mu-btn mu-press" onClick={onOpenTrackMenu} style={{ padding: 4 }}>
        <Icon name="ellipsis" size={20} color={WHITE.primary} />
      </button>
    </div>
  )
}

/** 失败态卡片：只有 playbackState == failed 时渲染；loading / buffering 不在这里显示 spinner。 */
function FailureCard({ status, onRetry, t }) {
  const reason = reasonText(status.lastError, t)
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 5, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24, pointerEvents: 'none',
    }}
    >
      <div style={{
        maxWidth: 290, padding: 18, borderRadius: 18, textAlign: 'center', pointerEvents: 'auto',
        background: 'rgba(40,40,40,0.72)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: WHITE.primary,
      }}
      >
        <Icon name="exclamationmark.triangle.fill" size={24} color={WHITE.primary} />
        <span style={{ fontSize: 16, fontWeight: 600 }}>{t('np.playbackFailed')}</span>
        <span style={{ fontSize: 13, lineHeight: 1.4, color: 'rgba(255,255,255,0.8)' }}>{reason}</span>
        <button
          type="button"
          className="mu-btn mu-press"
          onClick={onRetry}
          style={{
            marginTop: 4, padding: '9px 18px', borderRadius: 999,
            background: '#FFFFFF', color: '#000', fontSize: 14, fontWeight: 600,
          }}
        >
          {t('common.tryAgain')}
        </button>
      </div>
    </div>
  )
}

function reasonText(lastError, t) {
  const value = String(lastError || '').toLowerCase()
  if (value.includes('not authorized') || value.includes('access')) return t('err.denied')
  if (value.includes('subscription')) return t('err.noSubscription')
  if (value.includes('not found')) return t('err.notFound')
  return t('err.generic')
}
