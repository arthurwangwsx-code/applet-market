// 行情页（自选）—— 规格 §2。
//
// 三处刻意的视觉细节，别"顺手统一"：
//  · 自选行的**现价是中性 ink 色**，只有涨跌幅 pill 带 13% 半透明底（§15 第 2 条）；
//  · 涨跌幅为 0 用**中性灰**，不是红也不是绿（§15 第 3 条）；
//  · 页脚时间戳带**日期 + 时区缩写**，避免把昨天的快照当今天。

import React from 'react'
import Icon from './Icon.jsx'
import { VirtualList } from './VirtualList.jsx'
import {
  Chip, ChipRow, EmptyState, Menu, PullRefresh, Spinner, SwipeRow,
} from './primitives.jsx'
import { C, RADIUS, SPACE } from './theme.js'
import { formatPercent, formatPrice, formatPriceFor, formatStamp, trendColor, trendTint } from '../lib/format.js'
import { INDEX_ROWS, decimalsFor, resolveSymbol } from '../lib/symbol.js'
import { quoteTTL, resolveDataState, showsCachedBadge } from '../lib/quotes.js'
import { groupLabel } from '../i18n/index.js'

const SORTS = ['manual', 'changeDescending', 'changeAscending']

/** 指数卡：宽 104、padding 12、surface 底、圆角 16。无数据时点位显 `—`、涨跌幅留空。 */
function IndexCard({ row, quote, t, upIsRed, onOpen }) {
  return (
    <button
      type="button"
      className="fin-btn fin-press"
      onClick={() => onOpen(row.canonical)}
      style={{
        width: 104, flex: '0 0 auto', padding: SPACE.s3, background: C.surface,
        borderRadius: RADIUS.card, display: 'flex', flexDirection: 'column', gap: 3,
      }}
    >
      <span className="fin-clamp-1" style={{ fontSize: 12, color: C.muted }}>{t(row.key)}</span>
      <span className="fin-mono" style={{ fontSize: 17, fontWeight: 500, color: C.ink }}>
        {quote ? formatPrice(quote.price, 2) : '—'}
      </span>
      <span className="fin-mono" style={{ fontSize: 12, color: quote ? trendColor(quote.changePct, upIsRed) : 'transparent' }}>
        {quote ? formatPercent(quote.changePct) : ' '}
      </span>
    </button>
  )
}

/** 自选行。现价中性、pill 半透明。 */
function WatchRow({ canonical, name, quote, upIsRed, onOpen }) {
  const symbol = resolveSymbol(canonical)
  const decimals = symbol ? decimalsFor(symbol.market) : 2
  return (
    <button
      type="button"
      className="fin-btn fin-press"
      onClick={() => onOpen(canonical)}
      style={{
        display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%',
        padding: `6px ${SPACE.s4}px`, minHeight: 52, background: C.bg,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto' }}>
        <span className="fin-clamp-1" style={{ fontSize: 16, fontWeight: 500, color: C.ink }}>{name}</span>
        <span className="fin-mono" style={{ fontSize: 12, color: C.muted }}>{canonical}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: '0 0 auto' }}>
        <span className="fin-mono" style={{ fontSize: 16, fontWeight: 500, color: C.ink }}>
          {quote ? formatPrice(quote.price, decimals) : '—'}
        </span>
        <span
          className="fin-mono"
          style={{
            fontSize: 13, fontWeight: 500, color: C.ink,
            padding: '2px 7px', minWidth: 66, textAlign: 'center', borderRadius: 6,
            background: trendTint(quote ? quote.changePct : null, upIsRed),
          }}
        >
          {quote ? formatPercent(quote.changePct) : '—'}
        </span>
      </div>
    </button>
  )
}

/** 页脚「更新于…」。三行互斥语义见 §2.6。 */
function Footer({ ctx, state }) {
  const { t, locale, quotes } = ctx
  const cached = showsCachedBadge(state)
  const stamp = quotes.lastUpdated ? formatStamp(quotes.lastUpdated, locale) : null
  const sourceLabel = quotes.source === 'automatic' ? t('finance.settings.sourceAuto')
    : quotes.source === 'sina' ? 'Sina' : 'Tencent'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      padding: `${SPACE.s5}px ${SPACE.s4}px ${SPACE.s6}px`, fontSize: 12, color: C.muted, textAlign: 'center',
    }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {ctx.refreshing ? <Spinner size={12} color={C.muted} /> : null}
        {stamp ? (cached ? t('finance.updated.cached', stamp) : t('finance.updated', stamp)) : null}
      </span>
      <span>{t('finance.watch.source', sourceLabel)}</span>
      {state === 'partial' ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="exclamationmark.triangle" size={11} />
          {t('finance.quote.partial')}
        </span>
      ) : state === 'failedWithoutData' ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="wifi.exclamationmark" size={11} />
          {t('finance.quote.failed')}
        </span>
      ) : state === 'failedWithCache' ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="wifi.exclamationmark" size={11} />
          {t('finance.quote.stale')}
        </span>
      ) : null}
    </div>
  )
}

export default function WatchlistPage({ ctx }) {
  const { t, store, quotes, settings, actions } = ctx
  const scrollRef = React.useRef(null)
  const [group, setGroup] = React.useState(null)          // null = 全部
  const [sort, setSort] = React.useState('manual')

  // 分组被删时选中态自动回落到「全部」。
  React.useEffect(() => {
    if (group && !store.groups.some((row) => row.id === group)) setGroup(null)
  }, [group, store.groups, store.version])

  const visibleGroups = React.useMemo(() => {
    const withItems = store.groups
      .filter((row) => store.items.some((item) => item.groupID === row.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return group ? withItems.filter((row) => row.id === group) : withItems
  }, [store.groups, store.items, store.version, group]) // eslint-disable-line react-hooks/exhaustive-deps

  /** 非手动排序：按 changePct 降/升；**有行情的一律排在无行情之前**；都无行情按 sortOrder。 */
  const sortRows = React.useCallback((rows) => {
    if (sort === 'manual') return rows.slice().sort((a, b) => a.sortOrder - b.sortOrder)
    const descending = sort === 'changeDescending'
    return rows.slice().sort((a, b) => {
      const qa = quotes.quote(a.instrumentSymbol)
      const qb = quotes.quote(b.instrumentSymbol)
      if (!qa && !qb) return a.sortOrder - b.sortOrder
      if (!qa) return 1
      if (!qb) return -1
      return descending ? qb.changePct - qa.changePct : qa.changePct - qb.changePct
    })
  }, [sort, quotes, ctx.quoteVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // 扁平化成 VirtualList 的行（分组头也是一行，让长自选也能虚拟滚动）。
  const rows = React.useMemo(() => {
    const out = []
    for (const groupRow of visibleGroups) {
      const items = sortRows(store.items.filter((item) => item.groupID === groupRow.id))
      if (items.length === 0) continue
      out.push({ kind: 'header', id: `h-${groupRow.id}`, label: groupLabel(t, groupRow.name) })
      for (const item of items) out.push({ kind: 'item', id: item.id, item })
    }
    // 没有分组归属的孤儿项也要显示，否则用户会觉得自选丢了。
    const orphans = sortRows(store.items.filter(
      (item) => !store.groups.some((row) => row.id === item.groupID),
    ))
    if (orphans.length > 0 && !group) {
      for (const item of orphans) out.push({ kind: 'item', id: item.id, item })
    }
    return out
  }, [visibleGroups, store.items, store.groups, store.version, sortRows, group, t]) // eslint-disable-line react-hooks/exhaustive-deps

  const dataState = resolveDataState({
    failed: quotes.lastFailed,
    lastUpdated: quotes.lastUpdated,
    refreshing: ctx.refreshing,
    missingCount: quotes.missingSymbols.length,
    ttlMs: quoteTTL(settings.refreshInterval),
    now: Date.now(),
  })

  const header = (
    <>
      <ChipRow style={{ paddingTop: SPACE.s1, paddingBottom: SPACE.s2 }}>
        {INDEX_ROWS.map((row) => (
          <IndexCard
            key={row.canonical}
            row={row}
            quote={quotes.quote(row.canonical)}
            t={t}
            upIsRed={settings.upIsRed}
            onOpen={actions.openDetail}
          />
        ))}
      </ChipRow>
      {store.groups.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, paddingBottom: SPACE.s2 }}>
          <ChipRow style={{ flex: '1 1 auto', minWidth: 0, paddingRight: 0 }}>
            <Chip
              variant="plain"
              label={t('finance.watch.group.all')}
              selected={group === null}
              onClick={() => setGroup(null)}
            />
            {store.groups.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((row) => (
              <Chip
                key={row.id}
                variant="plain"
                label={groupLabel(t, row.name)}
                selected={group === row.id}
                onClick={() => setGroup(row.id)}
              />
            ))}
          </ChipRow>
          {/* 原生把排序放在导航栏 `ellipsis.circle` 菜单里；宿主 toolbar 的 trailing 已被
              ✨/搜索占满（上限 3 项且身份静态），所以这里就近放在分组条右端。 */}
          <div style={{ flex: '0 0 auto', paddingRight: SPACE.s4 }}>
            <Menu
              icon="ellipsis.circle"
              label=""
              trailing={null}
              value={sort}
              items={SORTS.map((id) => ({ id, label: t(`finance.watch.sort.${id}`) }))}
              onSelect={setSort}
              align="right"
            />
          </div>
        </div>
      ) : null}
    </>
  )

  const empty = (
    <EmptyState
      icon="star"
      text={t('finance.watch.empty')}
      actionLabel={t('finance.watch.add')}
      onAction={actions.openSearch}
    />
  )

  return (
    <PullRefresh
      scrollRef={scrollRef}
      refreshing={ctx.refreshing}
      onRefresh={() => actions.refresh(true)}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <VirtualList
        items={rows}
        estimatedRowHeight={52}
        restoreKey="watchlist"
        header={header}
        footer={(quotes.lastUpdated || ctx.refreshing || quotes.lastFailed)
          ? <Footer ctx={ctx} state={dataState} /> : <div style={{ height: SPACE.s6 }} />}
        empty={rows.length === 0 ? empty : null}
        renderRow={(row) => {
          if (row.kind === 'header') {
            return (
              <div style={{ padding: `${SPACE.s3}px ${SPACE.s4}px 4px`, fontSize: 13, color: C.muted }}>
                {row.label}
              </div>
            )
          }
          const canonical = row.item.instrumentSymbol
          return (
            <SwipeRow actionLabel={t('finance.delete')} onAction={() => actions.removeWatch(canonical)}>
              <WatchRow
                canonical={canonical}
                name={store.instrumentName(canonical)}
                quote={quotes.quote(canonical)}
                upIsRed={settings.upIsRed}
                onOpen={actions.openDetail}
              />
            </SwipeRow>
          )
        }}
      />
    </PullRefresh>
  )
}
