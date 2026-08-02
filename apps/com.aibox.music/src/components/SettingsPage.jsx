// 设置页（§2.15）。卡片段 + 行高 56 + 分隔线左缩进 16。
//
// 与原生的差异（README 有记）：
//  · 「默认循环模式 / 默认随机播放」在原生是**偏好键**（AudioRepeatMode / AudioShuffle），
//    宿主没有读写偏好的工具 → 这里直接作用于**当前播放器**，并在段脚注如实说明；
//  · 「歌词源」整段做不了 —— lrclib / 网易云 / QQ 的顺序与开关只在原生模块里，无任何工具投影；
//  · 「歌词翻译」整段不渲染 —— 需要 AI 文本能力，本应用 manifest 里 `ai: false`，
//    没有能力就**不渲染入口**（留个点了没反应的开关比没有更糟）。

import React from 'react'
import { Card, Chevron, IconTile, ListHeader, Row } from './primitives.jsx'
import { C, SPACE } from './theme.js'
import { percent } from '../lib/format.js'

const REPEAT_MODES = ['off', 'one', 'all']

export default function SettingsPage({ ctx }) {
  const { t, music, store, actions } = ctx
  const status = music.status
  const [volume, setVolume] = React.useState(status.volume)

  React.useEffect(() => { setVolume(status.volume) }, [status.volume])

  const repeatLabel = {
    off: t('menu.repeatOff'), one: t('menu.repeatOne'), all: t('menu.repeatAll'),
  }[status.repeatMode] || t('menu.repeatOff')

  return (
    <div className="mu-scroll">
      <ListHeader>{t('settings.playback')}</ListHeader>
      <Card>
        <Row
          title={t('settings.repeatMode')}
          detail={repeatLabel}
          accessory={<Chevron />}
          onClick={() => actions.pickOption({
            title: t('settings.repeatMode'),
            options: REPEAT_MODES.map((mode) => ({
              id: mode,
              title: { off: t('menu.repeatOff'), one: t('menu.repeatOne'), all: t('menu.repeatAll') }[mode],
            })),
            selected: status.repeatMode,
            onPick: (mode) => music.setRepeat(mode),
          })}
        />
        <Row
          title={t('settings.shuffle')}
          accessory={<Switch value={status.isShuffled} onChange={(value) => music.setShuffle(value)} />}
          last
        />
      </Card>
      <Footnote>{t('settings.playbackNote')}</Footnote>

      <ListHeader>{t('settings.audioOutput')}</ListHeader>
      <Card>
        <div style={{ padding: `12px ${SPACE.s4}px` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
            <span style={{ fontSize: 16 }}>{t('settings.volume')}</span>
            <span className="mu-mono" style={{ fontSize: 15, color: C.muted }}>{percent(volume)}</span>
          </div>
          <input
            className="mu-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            onPointerUp={() => music.setVolume(volume)}
            onKeyUp={() => music.setVolume(volume)}
          />
        </div>
      </Card>
      <Footnote>{t('settings.volumeHint')}</Footnote>

      <ListHeader>{t('settings.lyrics')}</ListHeader>
      <Card>
        <Row
          title={t('settings.autoDownloadLyrics')}
          accessory={(
            <Switch
              value={store.prefs.autoDownloadLyrics}
              onChange={(value) => store.setPref({ autoDownloadLyrics: value })}
            />
          )}
          last
        />
      </Card>
      <Footnote>{t('settings.autoDownloadHint')}</Footnote>
      <Footnote>{t('settings.lyricsSourcesNote')}</Footnote>

      <ListHeader>{t('settings.playbackQueue')}</ListHeader>
      <Card>
        <Row
          title={t('settings.currentQueue')}
          detail={status.queueCount > 0 ? t('lib.trackCount', status.queueCount) : t('settings.queueEmpty')}
        />
        <Row
          title={t('settings.clearQueue')}
          danger
          disabled={status.queueCount === 0}
          onClick={() => actions.confirmDestructive({
            title: t('settings.clearQueueTitle'),
            message: t('settings.clearQueueBody'),
            confirmTitle: t('settings.clearQueueConfirm'),
            onConfirm: () => music.clearQueue(),
          })}
          last
        />
      </Card>

      <ListHeader>{t('settings.audioEffects')}</ListHeader>
      <Card>
        <Row
          leading={<IconTile name="slider.horizontal.3" size={30} radius={7} iconSize={14} />}
          title={t('effects.title')}
          accessory={<Chevron />}
          onClick={() => actions.navigate({ name: 'effects' })}
          last
        />
      </Card>

      <ListHeader>{t('settings.about')}</ListHeader>
      <Footnote>{t('settings.aboutBody')}</Footnote>
      <div style={{ height: 24 }} />
    </div>
  )
}

function Footnote({ children }) {
  return (
    <div style={{ padding: `6px ${SPACE.s5}px ${SPACE.s2}px`, fontSize: 12, color: C.muted, lineHeight: 1.45 }}>
      {children}
    </div>
  )
}

/** 自绘开关：antd-mobile 的 Switch 可用，但这里统一视觉令牌，避免两套圆角与色板。 */
export function Switch({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      className="mu-btn mu-press"
      disabled={disabled}
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        width: 51, height: 31, borderRadius: 16, flex: '0 0 auto', position: 'relative',
        background: value ? C.accent : `color-mix(in srgb, ${C.muted} 32%, transparent)`,
        transition: 'background 0.2s ease-out', opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: value ? 22 : 2, width: 27, height: 27, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s ease-out',
      }}
      />
    </button>
  )
}
