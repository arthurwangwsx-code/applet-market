// 录音库列表页（规格 §2）+ 筛选抽屉（§2.3）。
//
// 行布局逐条对齐：34×34 左圆标（有音频 accent / 无音频 muted，图标 waveform / doc）、
// 标题行（标题 + 收藏星 + 处理中徽标）、元信息行（日期 · 时长 [· 仅保留文稿]）、摘录行。
// **列表行没有左滑操作**，只有长按菜单（重命名/删除都在里面，不重复暴露）。

import { useMemo } from 'react'
import { clockString, shortDate } from '../lib/format'
import type { T } from '../lib/strings'
import { RADIUS, SPACE, alpha, favouriteTint, type Palette } from '../lib/theme'
import { DEFAULT_FILTER, filterIsActive, type Memo, type MemoFilter } from '../lib/types'
import { Icon, SecondaryButton, Sheet } from './primitives'

export function MemoList(props: {
  palette: Palette
  t: T
  dark: boolean
  memos: Memo[]
  query: string
  filter: MemoFilter
  scoped: boolean
  onOpen: (memo: Memo) => void
  onMenu: (memo: Memo) => void
  onClearFilter: () => void
  busyIDs: Record<string, string>
}) {
  const { palette, t } = props
  const rows = useMemo(() => applyFilter(props.memos, props.filter, props.query), [props.memos, props.filter, props.query])

  if (rows.length === 0) {
    const filtered = props.query.trim() !== '' || filterIsActive(props.filter)
    if (filtered && props.memos.length > 0) {
      return (
        <div style={{ padding: `${SPACE.s8}px ${SPACE.s5}px`, textAlign: 'center' }}>
          <Icon name="magnifyingglass" size={40} color={palette.accent} />
          <div style={{ fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }}>{t('noMatchTitle')}</div>
          <div style={{ fontSize: 14, color: palette.muted, marginTop: 6 }}>{t('noMatchBody')}</div>
          {filterIsActive(props.filter) ? (
            <div style={{ marginTop: SPACE.s4 }}>
              <SecondaryButton palette={palette} title={t('clearFilter')} onClick={props.onClearFilter} />
            </div>
          ) : null}
        </div>
      )
    }
    return (
      <div style={{ padding: `${SPACE.s8}px ${SPACE.s5}px`, textAlign: 'center' }}>
        <Icon name="mic" size={40} color={palette.accent} />
        <div style={{ fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }}>{t('emptyTitle')}</div>
        <div style={{ fontSize: 14, color: palette.muted, marginTop: 6 }}>
          {props.scoped ? t('emptyScopedBody') : t('emptyBody')}
        </div>
      </div>
    )
  }

  return (
    <div>
      {rows.map((memo) => (
        <MemoRow
          key={`${memo.source}:${memo.id}`}
          palette={palette}
          t={t}
          dark={props.dark}
          memo={memo}
          busy={props.busyIDs[`${memo.source}:${memo.id}`]}
          onOpen={() => props.onOpen(memo)}
          onMenu={() => props.onMenu(memo)}
        />
      ))}
    </div>
  )
}

function MemoRow(props: {
  palette: Palette
  t: T
  dark: boolean
  memo: Memo
  busy?: string
  onOpen: () => void
  onMenu: () => void
}) {
  const { palette, t, memo } = props
  const tint = memo.hasAudio ? palette.accent : palette.muted
  let pressTimer: number | null = null
  const startPress = () => { pressTimer = window.setTimeout(props.onMenu, 550) }
  const endPress = () => { if (pressTimer !== null) { window.clearTimeout(pressTimer); pressTimer = null } }

  return (
    <div
      role="button"
      onClick={props.onOpen}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onContextMenu={(event) => { event.preventDefault(); props.onMenu() }}
      style={{
        display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: `8px ${SPACE.s4}px`,
        borderBottom: `1px solid ${palette.line}`, cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 34, height: 34, borderRadius: 17, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: alpha(tint, 0.12), color: tint, fontSize: 14, fontWeight: 600,
        }}
      >
        <Icon name={memo.hasAudio ? 'waveform' : 'doc'} size={14} />
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontSize: 16, fontWeight: 500, color: palette.ink,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {memo.title}
          </span>
          {memo.isFavourite ? <Icon name="star.fill" size={11} color={favouriteTint(props.dark)} /> : null}
          <span style={{ flex: 1, minWidth: 8 }} />
          {props.busy ? (
            <span
              style={{
                fontSize: 11, color: palette.accent, background: alpha(palette.accent, 0.12),
                borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap',
              }}
            >
              {props.busy}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: SPACE.s2, fontSize: 12, color: palette.muted, flexWrap: 'wrap' }}>
          <span>{shortDate(memo.createdAt, 'default')}</span>
          <span>{clockString(memo.duration)}</span>
          {!memo.hasAudio ? <span><Icon name="waveform.slash" size={11} /> {t('transcriptOnly')}</span> : null}
          <span style={{ opacity: 0.8 }}>{memo.source === 'local' ? t('sourceLocal') : t('sourceLibrary')}</span>
        </div>
        {memo.snippet ? (
          <div style={{ fontSize: 12, color: palette.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Icon name="bubble" size={11} /> {memo.snippet}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** 筛选 5 段（规格 §2.3）。日期一律按 `now − N × 86400 秒`。 */
export function applyFilter(memos: Memo[], filter: MemoFilter, query: string): Memo[] {
  const now = Date.now()
  const needle = query.trim().toLowerCase()
  let rows = memos.filter((memo) => {
    if (needle && !memo.title.toLowerCase().includes(needle) && !(memo.snippet ?? '').toLowerCase().includes(needle)) {
      return false
    }
    if (filter.favOnly && !memo.isFavourite) return false
    if (filter.withTranscript && !memo.hasTranscript) return false
    if (filter.source !== 'all' && memo.source !== filter.source) return false
    if (filter.duration === 'under1m' && !(memo.duration < 60)) return false
    if (filter.duration === '1to5m' && !(memo.duration >= 60 && memo.duration <= 300)) return false
    if (filter.duration === 'over5m' && !(memo.duration >= 300)) return false
    const age = now - memo.createdAt
    if (filter.date === 'today' && new Date(memo.createdAt).toDateString() !== new Date(now).toDateString()) return false
    if (filter.date === 'week' && age > 7 * 86_400_000) return false
    if (filter.date === 'month' && age > 30 * 86_400_000) return false
    if (filter.date === 'year' && age > 365 * 86_400_000) return false
    return true
  })
  rows = [...rows].sort((a, b) => {
    switch (filter.sort) {
      case 'oldest': return a.createdAt - b.createdAt
      case 'longest': return b.duration - a.duration
      case 'shortest': return a.duration - b.duration
      case 'name': return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      default: return b.createdAt - a.createdAt
    }
  })
  return rows
}

export function FilterSheet(props: {
  palette: Palette
  t: T
  open: boolean
  filter: MemoFilter
  onChange: (filter: MemoFilter) => void
  onClose: () => void
}) {
  const { palette, t, filter } = props
  const isDefault = JSON.stringify(filter) === JSON.stringify(DEFAULT_FILTER)

  const section = <K extends keyof MemoFilter>(
    title: string,
    key: K,
    options: { value: MemoFilter[K]; label: string }[],
  ) => (
    <section key={String(key)} style={{ marginBottom: SPACE.s4 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: palette.muted, padding: `0 ${SPACE.s4}px 6px`, textTransform: 'uppercase' }}>
        {title}
      </div>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => props.onChange({ ...filter, [key]: option.value })}
          style={{
            display: 'flex', width: '100%', alignItems: 'center', border: 'none', background: 'transparent',
            padding: `10px ${SPACE.s4}px`, fontSize: 15, color: palette.ink, cursor: 'pointer',
            borderBottom: `1px solid ${palette.line}`,
          }}
        >
          <span style={{ flex: 1, textAlign: 'left' }}>{option.label}</span>
          {filter[key] === option.value ? <Icon name="check" size={14} color={palette.accent} /> : null}
        </button>
      ))}
    </section>
  )

  return (
    <Sheet palette={palette} open={props.open} onClose={props.onClose}>
      <div style={{ display: 'flex', alignItems: 'center', padding: SPACE.s4 }}>
        <button
          type="button"
          disabled={isDefault}
          onClick={() => props.onChange(DEFAULT_FILTER)}
          style={{
            border: 'none', background: 'transparent', color: palette.accent, fontSize: 15,
            cursor: isDefault ? 'default' : 'pointer', opacity: isDefault ? 0.4 : 1, padding: 0,
          }}
        >
          {t('reset')}
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 600, color: palette.ink }}>{t('filter')}</div>
        <button
          type="button"
          onClick={props.onClose}
          style={{ border: 'none', background: 'transparent', color: palette.accent, fontSize: 15, cursor: 'pointer', padding: 0 }}
        >
          {t('done')}
        </button>
      </div>

      {section(t('filterDuration'), 'duration', [
        { value: 'any', label: t('durationAny') },
        { value: 'under1m', label: t('durationUnder1m') },
        { value: '1to5m', label: t('duration1to5m') },
        { value: 'over5m', label: t('durationOver5m') },
      ])}
      {section(t('filterDate'), 'date', [
        { value: 'all', label: t('dateAll') },
        { value: 'today', label: t('dateToday') },
        { value: 'week', label: t('dateWeek') },
        { value: 'month', label: t('dateMonth') },
        { value: 'year', label: t('dateYear') },
      ])}
      {section(t('filterSource'), 'source', [
        { value: 'all', label: t('sourceAll') },
        { value: 'library', label: t('sourceLibrary') },
        { value: 'local', label: t('sourceLocal') },
      ])}
      {section(t('filterSort'), 'sort', [
        { value: 'newest', label: t('sortNewest') },
        { value: 'oldest', label: t('sortOldest') },
        { value: 'longest', label: t('sortLongest') },
        { value: 'shortest', label: t('sortShortest') },
        { value: 'name', label: t('sortName') },
      ])}

      <div style={{ padding: `0 ${SPACE.s4}px ${SPACE.s6}px` }}>
        <Toggle palette={palette} label={t('favOnly')} value={filter.favOnly} onChange={(value) => props.onChange({ ...filter, favOnly: value })} />
        <Toggle palette={palette} label={t('withTranscript')} value={filter.withTranscript} onChange={(value) => props.onChange({ ...filter, withTranscript: value })} />
      </div>
    </Sheet>
  )
}

export function Toggle(props: { palette: Palette; label: string; value: boolean; onChange: (value: boolean) => void; hint?: string }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: '10px 0',
        fontSize: 15, color: props.palette.ink, cursor: 'pointer',
      }}
    >
      <span style={{ flex: 1 }}>
        {props.label}
        {props.hint ? <div style={{ fontSize: 12, color: props.palette.muted, marginTop: 2 }}>{props.hint}</div> : null}
      </span>
      <span
        onClick={() => props.onChange(!props.value)}
        style={{
          width: 46, height: 28, borderRadius: 14, position: 'relative', flexShrink: 0,
          background: props.value ? props.palette.green : props.palette.line, transition: 'background 0.15s',
        }}
      >
        <span
          style={{
            position: 'absolute', top: 2, left: props.value ? 20 : 2, width: 24, height: 24, borderRadius: 12,
            background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.15s',
          }}
        />
      </span>
    </label>
  )
}

export { RADIUS }
