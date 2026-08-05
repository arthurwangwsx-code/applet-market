// 播报提示条 + 播报控制条（对应 NewsBroadcastBar.swift）。跨 Tab 常驻，贴在底栏之上。

import React from 'react'
import Icon from './Icon.js'
import { C, SPACE } from './theme.js'

export function BroadcastNotice({ messageKey, t, onDismiss }) {
  if (!messageKey) return null
  return (
    <button
      type="button"
      className="news-btn news-press"
      onClick={onDismiss}
      style={{
        display: 'flex', alignItems: 'center', gap: SPACE.s2, width: '100%',
        padding: `10px ${SPACE.s4}px`,
        background: C.blur,
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderTop: `0.5px solid ${C.line}`,
      }}
    >
      <Icon name="exclamationmark.triangle.fill" size={15} color={C.warning} />
      <span style={{ flex: '1 1 auto', fontSize: 13, color: C.ink, textAlign: 'left' }}>{t(messageKey)}</span>
      <Icon name="xmark" size={13} color={C.muted} />
    </button>
  )
}

function ControlButton({ icon, size, onClick, disabled, label }) {
  return (
    <button
      type="button"
      className="news-btn news-press"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: disabled ? C.muted : C.ink, opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}

export default function BroadcastBar({ broadcast, t, onOpenCurrent }) {
  if (!broadcast.active) return null
  const current = broadcast.current
  const total = broadcast.items.length
  const position = broadcast.index + 1

  return (
    <div style={{
      flex: '0 0 auto',
      background: C.blur,
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderTop: `0.5px solid ${C.line}`,
    }}
    >
      <div style={{ height: 2, background: 'color-mix(in srgb, var(--news-line) 60%, transparent)' }}>
        <div style={{
          height: 2, width: `${Math.round(broadcast.progress * 100)}%`, background: C.brand,
          transition: 'width 240ms linear',
        }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: `6px ${SPACE.s3}px` }}>
        <button
          type="button"
          className="news-btn news-press"
          onClick={onOpenCurrent}
          aria-label={t('news.broadcast.openCurrent')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '1 1 auto', minWidth: 0 }}
        >
          <Icon name="speaker.wave.2.fill" size={15} color={C.brand} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, textAlign: 'left' }}>
            <span className="news-clamp-1" style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>
              {current ? current.title : t('news.broadcast.title')}
            </span>
            <span className="news-clamp-1 news-mono" style={{ fontSize: 12, color: C.muted }}>
              {`${position}/${total}${current && current.sourceName ? ` · ${current.sourceName}` : ''}`}
            </span>
          </span>
        </button>
        <ControlButton
          icon="backward.fill"
          size={15}
          disabled={broadcast.index === 0}
          onClick={() => broadcast.previous()}
          label={t('news.broadcast.previous')}
        />
        <ControlButton
          icon={broadcast.playing ? 'pause.fill' : 'play.fill'}
          size={18}
          onClick={() => (broadcast.playing ? broadcast.pause() : broadcast.resume())}
          label={t(broadcast.playing ? 'news.broadcast.pause' : 'news.broadcast.resume')}
        />
        <ControlButton
          icon="forward.fill"
          size={15}
          disabled={broadcast.index >= total - 1}
          onClick={() => broadcast.next()}
          label={t('news.broadcast.next')}
        />
        <ControlButton
          icon="xmark"
          size={15}
          onClick={() => broadcast.stop({ userInitiated: true })}
          label={t('news.broadcast.stop')}
        />
      </div>
    </div>
  )
}
