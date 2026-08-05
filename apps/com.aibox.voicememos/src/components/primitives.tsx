// 共享组件 —— 按规格头部的实测值画（InfoChip / ChipsFlow / EmptyStatePlaceholder / CopyButton …）。
// 全部用内联样式：小应用没有构建期 CSS 处理，且深浅色靠 palette 传参而不是媒体查询，
// 这样宿主把有效颜色方案传下来时一次性生效。

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import * as ui from 'aibox/ui'
import { RADIUS, SPACE, alpha, type Palette } from '../lib/theme.js'

/**
 * 图标 —— 画**真** SF Symbol（`applet://symbol/…`，aibox-ui ≥ 1.2.0）。
 *
 * 在宿主上架这条路由之前，这里是一张 emoji 近似表（`mic → 🎙`、`drive → 💾`）。真机上的后果是
 * 「同一个应用里两套图标语言」：宿主外壳（底栏、悬浮条、顶栏）画细线条单色符号，内容区却是彩色 emoji
 * ——2026-08-04 真机反馈「录音状态下的图标没有优化好」正是它。emoji 表**只作为宿主太老时的降级路径**保留。
 *
 * 颜色走 CSS 遮罩而不是 `<img>`：位图不会继承 `currentColor`，而本应用绝大多数调用点都靠外层的
 * `color` 传色（`<div style={{color: palette.orange}}><Icon …/></div>`）。遮罩让这条继承照旧成立，
 * 一个调用点都不用改。
 */
export function Icon({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  const symbols = useSymbolSupport()
  const symbol = SF_SYMBOL[name] ?? name
  const url = symbols ? symbolURL(symbol, size) : ''

  if (url === '') {
    return (
      <span aria-hidden style={{ fontSize: size, lineHeight: 1, color, display: 'inline-block' }}>
        {GLYPH[name] ?? '•'}
      </span>
    )
  }
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        verticalAlign: '-0.125em',
        // `currentColor` = 外层 color；显式 color 传参优先。
        backgroundColor: color ?? 'currentColor',
        WebkitMaskImage: `url("${url}")`,
        maskImage: `url("${url}")`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}

/** 遮罩用的符号 URL。颜色由 CSS 上色，这里只要形状 —— 故一律取纯黑（遮罩只看 alpha）。 */
function symbolURL(symbol: string, size: number): string {
  const build = (ui as { symbolURL?: (name: string, options?: Record<string, unknown>) => string }).symbolURL
  if (typeof build !== 'function') return ''
  // 求比 CSS 尺寸略大的点数：遮罩按 `contain` 缩放，宁可下采样也不要放大糊掉。
  return build(symbol, { size: Math.max(8, Math.round(size * 1.25)), color: '000000' })
}

/**
 * 宿主到底有没有这条符号路由。**探一次、全局共享**：老宿主上 `aibox-ui` 没有 `symbolURL`，
 * 或者有函数但 scheme handler 不认 `/symbol/` → 一律回落 emoji 表。
 *
 * 用 `<img>` 探而不是 fetch：CSP 只放行 `img-src applet:`，`connect-src` 不含它。
 * 遮罩加载失败没有事件可听，所以必须**先探再画**，不能靠 onError 兜底。
 */
type SymbolProbe = 'unknown' | 'probing' | 'ok' | 'missing'
let symbolProbe: SymbolProbe = 'unknown'
const symbolProbeWaiters = new Set<(value: boolean) => void>()

function useSymbolSupport(): boolean {
  const [supported, setSupported] = useState(symbolProbe === 'ok')

  useEffect(() => {
    if (symbolProbe === 'ok' || symbolProbe === 'missing') {
      setSupported(symbolProbe === 'ok')
      return undefined
    }
    symbolProbeWaiters.add(setSupported)
    if (symbolProbe === 'unknown') {
      symbolProbe = 'probing'
      const url = symbolURL('checkmark', 16)
      // 遮罩不可用时**必须**回落 emoji：只有 background-color 而遮罩没生效的话，每个图标都会变成
      // 一个实心色块 —— 比 emoji 难看得多，而且遮罩加载失败没有事件可听、发现不了。
      if (url === '' || !maskSupported()) {
        settleSymbolProbe(false)
      } else {
        const image = new Image()
        image.onload = () => settleSymbolProbe(true)
        image.onerror = () => settleSymbolProbe(false)
        image.src = url
      }
    }
    return () => { symbolProbeWaiters.delete(setSupported) }
  }, [])

  return supported
}

/** 引擎认不认 CSS 遮罩。WebKit 一直认 `-webkit-mask-image`，这里只是不把它当理所当然。 */
function maskSupported(): boolean {
  const api = typeof CSS !== 'undefined' ? CSS : undefined
  if (!api || typeof api.supports !== 'function') return false
  try {
    return api.supports('-webkit-mask-image', 'url("a")') || api.supports('mask-image', 'url("a")')
  } catch {
    return false
  }
}

function settleSymbolProbe(ok: boolean): void {
  symbolProbe = ok ? 'ok' : 'missing'
  const waiters = [...symbolProbeWaiters]
  symbolProbeWaiters.clear()
  waiters.forEach((notify) => notify(ok))
}

/**
 * 短名 → 真 SF Symbol 名。表里没有的名字**原样透传**，所以调用点可以直接写 `star.fill` 这类真名。
 * 键与下面的 emoji 表逐条对齐：降级路径不能因为改了这一层就少画几个图标。
 */
const SF_SYMBOL: Record<string, string> = {
  chevron: 'chevron.right',
  speaker: 'speaker.wave.2',
  star: 'star',
  sparkles: 'sparkles',
  blank: 'square.dashed',
  stop: 'stop.fill',
  check: 'checkmark',
  clipboard: 'doc.on.clipboard',
  share: 'square.and.arrow.up',
  refresh: 'arrow.clockwise',
  swap: 'arrow.left.arrow.right',
  quote: 'quote.opening',
  list: 'list.bullet',
  question: 'questionmark',
  warning: 'exclamationmark.triangle',
  drive: 'internaldrive',
  book: 'book',
  cards: 'rectangle.stack',
  folder: 'folder',
  doc: 'doc.text',
  gear: 'gearshape',
  bubble: 'text.bubble',
  wand: 'wand.and.stars',
  down: 'arrow.down',
  // 走带键就是 ±15 秒，用带数字的那两枚 —— 通用的旋转箭头看不出跳多少。
  gobackward: 'gobackward.15',
  goforward: 'goforward.15',
  photo: 'photo',
  clock: 'clock',
  shield: 'shield',
  lock: 'lock',
  pause: 'pause.fill',
  play: 'play.fill',
  pencil: 'pencil',
  ear: 'ear',
  globe: 'globe',
  lightbulb: 'lightbulb',
  trash: 'trash',
  mic: 'mic.fill',
}

/** 宿主太老（没有 `applet://symbol/`）时的降级字形表。**新代码不要往这里加**。 */
const GLYPH: Record<string, string> = {
  magnifyingglass: '⌕',
  speaker: '🔊',
  tortoise: '🐢',
  star: '☆',
  'star.fill': '★',
  chevron: '›',
  'chevron.down': '⌄',
  'chevron.up': '⌃',
  sparkles: '✦',
  ear: '👂',
  blank: '␣',
  pencil: '✎',
  mic: '🎙',
  stop: '■',
  check: '✓',
  'checkmark.seal': '✅',
  clipboard: '⧉',
  share: '↑',
  trash: '🗑',
  refresh: '↻',
  globe: '🌐',
  swap: '⇄',
  quote: '❝',
  list: '≡',
  lightbulb: '💡',
  question: '?',
  photo: '🖼',
  viewfinder: '⌗',
  warning: '⚠',
  clock: '🕘',
  shield: '🛡',
  drive: '💾',
  play: '▶',
  book: '📖',
  cards: '🃏',
  waveform: '〜',
  'waveform.slash': '⌁',
  folder: '📁',
  doc: '📄',
  gear: '⚙',
  bubble: '💬',
  checklist: '☑',
  wand: '✨',
  down: '⤓',
  gobackward: '↺',
  goforward: '↻',
  'person.2': '👥',
  pause: '⏸',
  lock: '🔒',
}

/** `InfoChip`：图标 11pt + 文字 12pt 单行，padding h9/v4，Capsule。 */
export function InfoChip(props: {
  palette: Palette
  label: string
  icon?: string
  tint?: string
  filled?: boolean
  onClick?: () => void
}) {
  const tint = props.tint ?? props.palette.accent
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 9px',
    borderRadius: RADIUS.pill,
    fontSize: 12,
    lineHeight: '16px',
    whiteSpace: 'nowrap',
    border: 'none',
    cursor: props.onClick ? 'pointer' : 'default',
    color: props.filled ? tint : props.palette.muted,
    background: props.filled ? alpha(tint, 0.14) : props.palette.line,
  }
  const content = (
    <>
      {props.icon ? <Icon name={props.icon} size={11} /> : null}
      <span>{props.label}</span>
    </>
  )
  return props.onClick
    ? <button type="button" style={style} onClick={props.onClick}>{content}</button>
    : <span style={style}>{content}</span>
}

/** `ChipsFlow` = FlowLayout(spacing 6, lineSpacing 6)。 */
export function ChipsFlow({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
}

/** `EmptyStatePlaceholder`：图标 26pt muted×0.7 + 文案 13pt muted 居中，纵向 padding 18。 */
export function EmptyState(props: { palette: Palette; icon: string; text: string }) {
  return (
    <div style={{ padding: '18px 16px', textAlign: 'center', color: props.palette.muted }}>
      <div style={{ opacity: 0.7 }}><Icon name={props.icon} size={26} /></div>
      <div style={{ fontSize: 13, marginTop: SPACE.s2 }}>{props.text}</div>
    </div>
  )
}

/** `CopyButton`：点击后 1.5s 内变 ✓ + 绿色 + "已复制"。 */
export function CopyButton(props: { palette: Palette; label: string; copiedLabel: string; onCopy: () => Promise<boolean> | boolean }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => setDone(false), 1500)
    return () => clearTimeout(timer)
  }, [done])
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent',
        padding: 0, fontSize: 12, fontWeight: 500, cursor: 'pointer',
        color: done ? props.palette.green : props.palette.accent,
      }}
      onClick={async () => { if (await props.onCopy()) setDone(true) }}
    >
      <Icon name={done ? 'check' : 'clipboard'} size={12} />
      {done ? props.copiedLabel : props.label}
    </button>
  )
}

/** 区头：12pt medium muted 大写。 */
export function SectionHeader(props: { palette: Palette; title: string; trailing?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.s2 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: props.palette.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {props.title}
      </div>
      {props.trailing}
    </div>
  )
}

/** 主按钮（borderedProminent 等价物）。 */
export function PrimaryButton(props: {
  palette: Palette
  title: string
  disabled?: boolean
  busy?: boolean
  block?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={props.disabled || props.busy}
      onClick={props.onClick}
      style={{
        border: 'none',
        borderRadius: RADIUS.field,
        padding: '11px 18px',
        fontSize: 15,
        fontWeight: 500,
        width: props.block ? '100%' : undefined,
        color: props.palette.onAccent,
        background: props.palette.accent,
        opacity: props.disabled || props.busy ? 0.45 : 1,
        cursor: props.disabled || props.busy ? 'default' : 'pointer',
      }}
    >
      {props.busy ? '…' : props.title}
    </button>
  )
}

/** 次按钮（.bordered 等价物）。 */
export function SecondaryButton(props: {
  palette: Palette
  title: string
  icon?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border: `1px solid ${props.palette.line}`,
        borderRadius: RADIUS.field,
        padding: '8px 14px',
        fontSize: 13,
        background: 'transparent',
        color: props.palette.accent,
        opacity: props.disabled ? 0.4 : 1,
        cursor: props.disabled ? 'default' : 'pointer',
      }}
    >
      {props.icon ? <Icon name={props.icon} size={12} /> : null}
      {props.title}
    </button>
  )
}

/** 卡片容器。 */
export function Card(props: { palette: Palette; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: props.palette.surface,
        borderRadius: RADIUS.card,
        padding: SPACE.s4,
        ...props.style,
      }}
    >
      {props.children}
    </div>
  )
}

/** 列表行。点整行触发 onClick，右侧可放独立控件（如朗读按钮，不冒泡）。 */
export function Row(props: {
  palette: Palette
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  onLongPress?: () => void
}) {
  const timer = useState<{ id: number | null }>({ id: null })[0]
  const start = () => {
    if (!props.onLongPress) return
    timer.id = window.setTimeout(() => props.onLongPress?.(), 550)
  }
  const cancel = () => {
    if (timer.id !== null) {
      window.clearTimeout(timer.id)
      timer.id = null
    }
  }
  return (
    <div
      role={props.onClick ? 'button' : undefined}
      onClick={props.onClick}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(event) => {
        if (!props.onLongPress) return
        event.preventDefault()
        props.onLongPress()
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: SPACE.s3,
        padding: '10px 16px',
        cursor: props.onClick ? 'pointer' : 'default',
        borderBottom: `1px solid ${props.palette.line}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: props.palette.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {props.title}
        </div>
        {props.subtitle ? (
          <div style={{ fontSize: 12, color: props.palette.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {props.subtitle}
          </div>
        ) : null}
      </div>
      {props.trailing}
    </div>
  )
}

/** 朗读按钮（生词本行 / 复习卡 / 音标 chip 共用）。 */
export function SpeakButton(props: { palette: Palette; onClick: () => void; size?: number }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        props.onClick()
      }}
      style={{
        border: 'none', background: 'transparent', color: props.palette.accent,
        padding: 6, cursor: 'pointer', lineHeight: 1,
      }}
      aria-label="Speak"
    >
      <Icon name="speaker" size={props.size ?? 16} />
    </button>
  )
}

/** 半浮层（sheet）。原生是 `presentationDetents([.medium])`，这里用底部抽屉近似。 */
export function Sheet(props: { palette: Palette; open: boolean; onClose: () => void; children: ReactNode }) {
  if (!props.open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.35)',
      }}
      onClick={props.onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%', maxHeight: '86dvh', overflowY: 'auto',
          background: props.palette.bg,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
          <div style={{ width: 36, height: 5, borderRadius: 3, background: props.palette.line }} />
        </div>
        {props.children}
      </div>
    </div>
  )
}

/** 全屏 push 页（原生是 NavigationStack push；这里用同层覆盖 + 左上返回）。 */
export function PushPage(props: {
  palette: Palette
  title: string
  onBack: () => void
  trailing?: ReactNode
  children: ReactNode
  /**
   * 是否自绘顶栏。**宿主画了导航栏时必须传 false** —— 接上 `presentation.subpages` 之后
   * 宿主有自己的返回键与标题（标题由 `navigation.push({title})` 交上去），再画一条就是两条顶栏，
   * 而且那个自绘的 `‹` 会变成一颗位置怪异的孤零零把手。
   */
  chrome?: boolean
  /**
   * 钉在页面底边的一条（播放器、批量操作栏之类）。**在滚动区之外** —— 放进 `children` 就得滚到最底
   * 才看得到，长文稿页面上等于「功能藏起来了」（2026-08-04 真机反馈）。
   */
  footer?: ReactNode
}) {
  const chrome = props.chrome !== false
  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 20, background: props.palette.bg,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {chrome ? (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: SPACE.s2, padding: '10px 12px',
          borderBottom: `1px solid ${props.palette.line}`, background: props.palette.bg,
        }}
      >
        <button
          type="button"
          onClick={props.onBack}
          style={{ border: 'none', background: 'transparent', color: props.palette.accent, fontSize: 17, cursor: 'pointer', padding: '4px 8px' }}
          aria-label="Back"
        >
          ‹
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: props.palette.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {props.title}
        </div>
        {props.trailing}
      </div>
      ) : null}
      {!chrome && props.trailing ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px 0' }}>{props.trailing}</div>
      ) : null}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{props.children}</div>
      {props.footer}
    </div>
  )
}
