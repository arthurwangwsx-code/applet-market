// 详情页固定播放器：静态波形、精确 scrubber 与 15 秒跳转。

import { useEffect, useMemo, useRef, useState } from 'react'
import { clockFlat, clockString } from '../lib/format.js'
import type { T } from '../lib/strings.js'
import { RADIUS, SPACE, alpha, type Palette } from '../lib/theme.js'
import type { Memo } from '../lib/types.js'
import { Icon } from './primitives.js'

// —— transport 条（§4.5） ——

function iconButton(palette: Palette): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 18,
    border: 'none',
    background: 'transparent',
    color: palette.ink,
    cursor: 'pointer',
  }
}

// —— 播放器（静态波形 + 精确 scrubber + 15s 跳转） ——
//
// 2.0.0 起这是**唯一**的播放器。1.x 还有一条遥控宿主播放器的分支，它读不到当前位置
//（`memo_play/stop/seek` 只有这三下），所以那条线上既没有 scrubber 也没有已播时间，
// 章节和分段点击更是无从跳起。现在音频字节就在手上，这些全部是真的。

/**
 * 详情页播放器。**钉在页底**（`PushPage` 的 `footer`，滚动区之外），所以文稿多长它都在。
 *
 * 它曾经住在滚动内容的末尾 + 靠宿主悬浮条补救「看不到」：结果是长文稿要滚到底才够得着，而悬浮条
 * 又要等第一次交互才起来 —— 两条路一起失灵，播放区只剩一条光进度条。钉死是根治：不依赖另一层就位。
 */
export function ClipPlayer(props: {
  palette: Palette
  t: T
  memo: Memo
  /** 把 seek 出口交给页面（章节 / 分段点击经它跳转）。 */
  onSeekReady: (seek: (seconds: number) => void) => void
  registerPlayerCommand?: (handler: ((command: string) => void) | null) => void
}) {
  const { palette, t, memo } = props
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(memo.duration)
  const [playing, setPlaying] = useState(false)
  const [peaks, setPeaks] = useState<number[]>([])

  // 静态波形：有音频字节就能 1:1 移植原生那套 peak + 自身最大值归一化。
  useEffect(() => {
    if (!memo.url) return
    let cancelled = false
    void (async () => {
      const samples = await decodePeaks(memo.url as string, 240)
      if (!cancelled) setPeaks(samples)
    })()
    return () => {
      cancelled = true
    }
  }, [memo.url])

  // seek 出口只在挂载时交一次；`currentTime` 的写入是即时的，不需要 state 中转。
  useEffect(() => {
    props.onSeekReady((seconds) => {
      const audio = audioRef.current
      if (!audio) return
      const value = Math.max(0, seconds)
      audio.currentTime = value
      setPosition(value)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      void audio.play()
      setPlaying(true)
    }
  }
  const skip = (delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    const value = Math.max(0, Math.min(duration || audio.duration || 0, position + delta))
    audio.currentTime = value
    setPosition(value)
  }
  // overlay 上的控件点击落到这里。处理器每轮重挂（要闭包到最新的 playing / position）。
  useEffect(() => {
    if (!props.registerPlayerCommand) return undefined
    props.registerPlayerCommand((command) => {
      if (command === 'toggle') toggle()
      else if (command === 'back15') skip(-15)
      else if (command === 'forward15') skip(15)
    })
    return () => props.registerPlayerCommand?.(null)
  })

  // 钉在页底的一条，底下是滚动内容 —— 背景**必须不透明**（原来是 `alpha(surface, 0.9)`，
  // 那是它还长在内容流末尾时的写法，钉住之后半透明会让文稿从波形底下透出来）。
  // 上沿一条发丝线，与原生贴底工具条同款。
  // ⚠️ `paddingBottom` 写在 `padding` 简写**之后** —— 反过来会被简写整个覆盖掉，安全区就白留了。
  const dock = (top: number): React.CSSProperties => ({
    background: palette.surface,
    borderTop: `1px solid ${palette.line}`,
    padding: `${top}px ${SPACE.s5}px ${SPACE.s3}px`,
    paddingBottom: `calc(${SPACE.s3}px + env(safe-area-inset-bottom))`,
  })

  if (!memo.hasAudio) {
    return (
      <div style={{ ...dock(SPACE.s3), textAlign: 'center' }}>
        <Icon name="waveform.slash" size={20} color={palette.muted} />
        <div style={{ fontSize: 13, color: palette.muted, marginTop: 4 }}>{t('audioRemovedTitle')}</div>
        <div style={{ fontSize: 12, color: palette.muted }}>{t('audioRemovedBody')}</div>
      </div>
    )
  }

  return (
    <div style={{ ...dock(SPACE.s4), display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
      <StaticWaveform palette={palette} peaks={peaks} progress={duration > 0 ? position / duration : 0} />

      <audio
        ref={audioRef}
        src={memo.url}
        preload="metadata"
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration
          if (Number.isFinite(value) && value > 0) setDuration(value)
        }}
        onEnded={() => setPlaying(false)}
        style={{ display: 'none' }}
      />

      <input
        type="range"
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.1}
        value={position}
        onChange={(event) => {
          const value = Number(event.target.value)
          setPosition(value)
          if (audioRef.current) audioRef.current.currentTime = value
        }}
        style={{ width: '100%', accentColor: palette.accent }}
      />

      {/* 走带键**常驻**。
          这里曾经是「宿主画了悬浮播放条就把页内走带键整排 display:none」，理由是「两排播放键是控件重复」。
          真机上的结果却是：进详情页只剩一条光秃秃的进度条，**没有任何播放/暂停可点**——悬浮条要等
          第一次交互才起来（2026-08-04 反馈「音频播放板块没有暂停控制，只有在滑动进度条时才会出现播放控制」）。
          判据因此改了：播放区是这一页的**主体控件**，它不能依赖另一层是否就位。悬浮条是「滚走了/离开页面
          仍能控」的补充，不是它的替身；两者同时在场是原生播放页的常态（详情页走带 + 锁屏/迷你条）。 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE.s3 }}>
        <span style={{ fontSize: 12, color: palette.muted, minWidth: 38, fontFamily: 'ui-monospace, monospace' }}>
          {clockFlat(position)}
        </span>
        {/* 三颗键一律走 `skip` / `toggle` —— 与悬浮条上的控件**同一份实现**。各写一遍的代价是
            「页内点暂停停了、悬浮条上的图标还是播放中」这类两处状态对不上的毛病。 */}
        <button type="button" onClick={() => skip(-15)} style={iconButton(palette)} aria-label="-15s">
          <Icon name="gobackward" size={21} />
        </button>
        <button
          type="button"
          onClick={toggle}
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            border: 'none',
            background: palette.accent,
            color: palette.onAccent,
            fontSize: 20,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label={playing ? t('pause') : t('play')}
        >
          <Icon name={playing ? 'pause' : 'play'} size={20} color={palette.onAccent} />
        </button>
        <button type="button" onClick={() => skip(15)} style={iconButton(palette)} aria-label="+15s">
          <Icon name="goforward" size={21} />
        </button>
        <span
          style={{
            fontSize: 12,
            color: palette.muted,
            minWidth: 38,
            textAlign: 'right',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          -{clockFlat(Math.max(0, duration - position))}
        </span>
      </div>
    </div>
  )
}

/**
 * 静态波形（规格 §11.3）：中心锚定、圆角 = barWidth/2、**已播/未播分色**、samples 为空时画一条基线
 * （行绝不塌陷）。
 */
function StaticWaveform(props: { palette: Palette; peaks: number[]; progress: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)

    // 未播放段的颜色**必须来自 palette**。这里曾经硬编码 `rgba(255,255,255,0.18)`（只在深色底上成立），
    // 浅色模式下整条未播放波形是白底白条 = 看不见：屏幕上只剩已播的那一小截蓝色，看着像「波形只画了 1/5」
    // （2026-08-04 真机截图的形状）。基线同理。
    const idle = alpha(props.palette.muted, 0.32)

    if (props.peaks.length === 0) {
      context.fillStyle = idle
      context.fillRect(0, height / 2 - 0.75, width, 1.5)
      return
    }
    const barWidth = 3
    const gap = Math.max(1, barWidth * 0.5)
    const stride = barWidth + gap
    const barCount = Math.max(1, Math.min(props.peaks.length, Math.floor(width / stride)))
    const played = props.progress * width
    const mid = height / 2
    for (let index = 0; index < barCount; index += 1) {
      const value = props.peaks[Math.floor((index / barCount) * props.peaks.length)] ?? 0
      const barHeight = Math.max(height * 0.06, value * height)
      const x = index * stride
      context.fillStyle = x + barWidth / 2 <= played ? props.palette.accent : idle
      // `roundRect` 在 iOS 17 的 WKWebView 上存在，但保留矩形兜底：少一个圆角好过整条波形不画。
      const round = (
        context as CanvasRenderingContext2D & {
          roundRect?: (x: number, y: number, w: number, h: number, r: number) => void
        }
      ).roundRect
      if (typeof round === 'function') {
        context.beginPath()
        round.call(context, x, mid - barHeight / 2, barWidth, barHeight, barWidth / 2)
        context.fill()
      } else {
        context.fillRect(x, mid - barHeight / 2, barWidth, barHeight)
      }
    }
  }, [props.peaks, props.progress, props.palette])
  return <canvas ref={ref} style={{ width: '100%', height: 72, display: 'block' }} />
}

/** peak + **自身最大值归一化**（与原生 `MemoWaveformExtractor` 同一套算法）。 */
async function decodePeaks(url: string, buckets: number): Promise<number[]> {
  try {
    const response = await fetch(url)
    const bytes = await response.arrayBuffer()
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return []
    const context = new Ctor()
    const buffer = await context.decodeAudioData(bytes)
    const channel = buffer.getChannelData(0)
    const size = Math.max(1, Math.floor(channel.length / buckets))
    const peaks: number[] = []
    for (let index = 0; index < buckets; index += 1) {
      let peak = 0
      const start = index * size
      for (let offset = 0; offset < size && start + offset < channel.length; offset += 1) {
        // `?? 0`：内层条件已保证 `start + offset < channel.length`，`?? 0` 只是把它写给类型系统看。
        const value = Math.abs(channel[start + offset] ?? 0)
        if (value > peak) peak = value
      }
      peaks.push(peak)
    }
    void context.close()
    const max = Math.max(...peaks, 0.0001)
    return peaks.map((value) => value / max)
  } catch {
    return []
  }
}
