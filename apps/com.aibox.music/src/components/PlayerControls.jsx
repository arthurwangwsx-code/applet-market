// 进度条（AudioScrubber，§2.2）与走带条（AudioTransportBar，§2.3）。
// 两者在 Now Playing 的专辑态与歌词态**共享**，间距 20。

import React from 'react'
import Icon from './Icon.js'
import { Spinner } from './primitives.js'
import { WHITE } from './theme.js'
import { elapsed, remaining } from '../lib/format.js'

const METRICS = {
  regular: { idle: 4, active: 8, knob: 12, knobActive: 16, font: 11, gap: 6 },
  compact: { idle: 3, active: 6, knob: 9, knobActive: 13, font: 10, gap: 4 },
}

/**
 * 可拖动进度条。
 * · 按下即进入拖动态（轨道加粗 easeOut 0.12）
 * · onChanged：本地覆盖进度 = clamp(x / width, 0, 1)，duration ≤ 0 时忽略
 * · onEnded：锁定到松手位置 → 触感 → seek → 0.3 秒后交还真实时间（防 seek 生效前回跳闪烁）
 */
export function Scrubber({
  progress, position, duration, onBegin, onChange, onEnd, compact = false, accent = WHITE.primary,
  foreground = WHITE.primary,
}) {
  const metrics = compact ? METRICS.compact : METRICS.regular
  const [dragging, setDragging] = React.useState(false)
  const ref = React.useRef(null)

  const ratioFor = (clientX) => {
    const element = ref.current
    if (!element) return 0
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  const usable = Number(duration) > 0
  const height = dragging ? metrics.active : metrics.idle
  const knob = dragging ? metrics.knobActive : metrics.knob

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: metrics.gap, width: '100%' }}>
      <div
        ref={ref}
        className="mu-press"
        style={{ height: 24, display: 'flex', alignItems: 'center', position: 'relative', touchAction: 'none' }}
        onPointerDown={(event) => {
          if (!usable) return
          event.currentTarget.setPointerCapture(event.pointerId)
          setDragging(true)
          onBegin(ratioFor(event.clientX))
        }}
        onPointerMove={(event) => {
          if (!dragging) return
          onChange(ratioFor(event.clientX))
        }}
        onPointerUp={() => {
          if (!dragging) return
          setDragging(false)
          onEnd()
        }}
        onPointerCancel={() => {
          if (!dragging) return
          setDragging(false)
          onEnd()
        }}
      >
        <div style={{
          position: 'absolute', left: 0, right: 0, height,
          borderRadius: height / 2,
          // 未播放轨用「跟随前景基色的四级弱化色」，不写死灰色。
          background: `color-mix(in srgb, ${foreground} 26%, transparent)`,
          transition: 'height 0.12s ease-out',
        }}
        />
        <div style={{
          position: 'absolute', left: 0, width: `${Math.max(0, Math.min(1, progress)) * 100}%`, height,
          borderRadius: height / 2, background: accent, transition: 'height 0.12s ease-out',
        }}
        />
        <div style={{
          position: 'absolute', left: `${Math.max(0, Math.min(1, progress)) * 100}%`,
          width: knob, height: knob, marginLeft: -knob / 2, borderRadius: '50%',
          background: '#FFFFFF', boxShadow: '0 1px 2.5px rgba(0,0,0,0.25)',
          transition: 'width 0.12s ease-out, height 0.12s ease-out',
        }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="mu-mono" style={{ fontSize: metrics.font, fontWeight: 500, color: WHITE.secondary }}>
          {elapsed(position)}
        </span>
        <span className="mu-mono" style={{ fontSize: metrics.font, fontWeight: 500, color: WHITE.secondary }}>
          {remaining(position, duration)}
        </span>
      </div>
    </div>
  )
}

/**
 * 走带条：三键等分宽度。
 * · 忙态（loading / buffering）在**播放键位置**显示 spinner，其余时候显示 play/pause
 * · 无曲目时三键全部禁用
 * · 随机 / 循环 / 音效 / 定时器**不在这里**，全在顶栏 ⋯
 */
export function TransportBar({ isPlaying, busy, disabled, onPrevious, onToggle, onNext, compact = false }) {
  const side = compact ? 22 : 30
  const play = compact ? 30 : 44
  const hit = play + 26
  const color = WHITE.primary
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <TransportButton disabled={disabled} onClick={onPrevious} size={side} color={color} name="backward.fill" />
      <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          className="mu-btn mu-press"
          disabled={disabled}
          onClick={onToggle}
          style={{
            width: hit, height: hit, display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: disabled ? 0.35 : 1, color,
          }}
        >
          {busy
            ? <Spinner size={play * 0.7} color={color} />
            : <Icon name={isPlaying ? 'pause.fill' : 'play.fill'} size={play} color={color} />}
        </button>
      </div>
      <TransportButton disabled={disabled} onClick={onNext} size={side} color={color} name="forward.fill" />
    </div>
  )
}

function TransportButton({ name, size, color, disabled, onClick }) {
  return (
    <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'center' }}>
      <button
        type="button"
        className="mu-btn mu-press"
        disabled={disabled}
        onClick={onClick}
        style={{
          width: size + 22, height: size + 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: disabled ? 0.35 : 1, color,
        }}
      >
        <Icon name={name} size={size} color={color} />
      </button>
    </div>
  )
}
