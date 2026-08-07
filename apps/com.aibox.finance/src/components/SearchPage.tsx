// 搜索页（sheet）—— 规格 §6。
//
// 两条容易做错的时序：
//  · query 变化后**防抖 300ms** 才发请求，结果落地后再批量拉这些结果的行情；
//  · **搜索历史在「点开详情」时记入**，不是敲键时，也不是点加自选时（§15 第 10 条）。

import React from 'react'
import { VirtualList } from 'aibox/ui'
import Icon from './Icon.js'
import { EmptyState, Sheet, SheetHeader, Spinner } from './primitives.js'
import { SearchField } from './Shell.js'
import { C, SPACE } from './theme.js'
import { formatPercent, formatPriceFor, trendColor } from '../lib/format.js'
import { HOT_SEEDS } from '../lib/store.js'
import { parseStrict, resolveSymbol } from '../lib/symbol.js'
import * as tencent from '../lib/providers/tencent.js'
import * as fund from '../lib/providers/fund.js'
import type { FinanceContext, Market, SearchItem } from '../lib/types.js'

const DEBOUNCE_MS = 300
const MARKET_ORDER: Market[] = ['ashare', 'hk', 'us', 'fund']
type DisplayHit = Pick<SearchItem, 'symbol' | 'market' | 'name'> & { code?: string }
type SearchRow =
  | { kind: 'header'; id: string; label: string; action?: 'clear' }
  | { kind: 'hit'; id: string; hit: DisplayHit }

/** 股票/场内基金走腾讯联想；场外基金走本地全量目录过滤。结果按 canonical 去重。 */
export async function searchInstruments(query: unknown): Promise<SearchItem[]> {
  const text = String(query || '').trim()
  if (!text) return []
  const [listed, funds] = await Promise.all([tencent.search(text), fund.search(text, 20)])
  const seen = new Set<string>()
  const out: SearchItem[] = []
  for (const row of [...listed, ...funds]) {
    if (seen.has(row.symbol)) continue
    seen.add(row.symbol)
    out.push(row)
  }
  return out
}

function ResultRow({ hit, ctx, onOpen }: { hit: DisplayHit; ctx: FinanceContext; onOpen: (hit: DisplayHit) => void }) {
  const { t, store, quotes, settings } = ctx
  const quote = quotes.quote(hit.symbol)
  const watched = store.isWatched(hit.symbol)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: `8px ${SPACE.s4}px`, minHeight: 52 }}>
      <button
        type="button"
        className="fin-btn fin-press"
        onClick={() => onOpen(hit)}
        style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, flex: '1 1 auto', minWidth: 0 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto' }}>
          <span className="fin-clamp-1" style={{ fontSize: 15, color: C.ink }}>
            {hit.name}
          </span>
          <span className="fin-mono" style={{ fontSize: 12, color: C.muted }}>
            {hit.symbol} · {t(`market.${hit.market}`)}
          </span>
        </div>
        {/* 价格块**仅在缓存里已有行情时渲染**——没有就整块不出，不占位。 */}
        {quote ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: '0 0 auto' }}>
            <span className="fin-mono" style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>
              {formatPriceFor(quote.price, hit.market)}
            </span>
            <span className="fin-mono" style={{ fontSize: 12, color: trendColor(quote.changePct, settings.upIsRed) }}>
              {formatPercent(quote.changePct)}
            </span>
          </div>
        ) : null}
      </button>
      <button
        type="button"
        className="fin-btn fin-press"
        aria-label={t(watched ? 'finance.action.watching' : 'finance.action.watch')}
        onClick={() => ctx.actions.toggleWatch(hit.symbol, hit.name)}
        style={{ flex: '0 0 auto', color: watched ? (settings.upIsRed ? C.red : C.green) : C.brand }}
      >
        <Icon name={watched ? 'checkmark.circle.fill' : 'plus.circle'} size={22} />
      </button>
    </div>
  )
}

export default function SearchPage({
  ctx,
  visible,
  onClose,
}: {
  ctx: FinanceContext
  visible: boolean
  onClose: () => void
}) {
  const { t, store, quotes, actions } = ctx
  const [query, setQuery] = React.useState('')
  const [hits, setHits] = React.useState<SearchItem[]>([])
  const [searching, setSearching] = React.useState(false)

  // 进页即批量预取「热门 + 历史」的行情，用于行内显示价格。
  React.useEffect(() => {
    if (!visible) return
    const seeds = [...HOT_SEEDS.map((row) => row.symbol), ...store.recent]
    if (seeds.length > 0) quotes.refresh(seeds, { force: false })
  }, [visible, store.recent, quotes])

  // 防抖 300ms → 搜索 → 写结果 → 再批量拉行情（拿到后行自动重渲）。
  React.useEffect(() => {
    const text = query.trim()
    if (!text) {
      setHits([])
      setSearching(false)
      return undefined
    }
    setSearching(true)
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const rows = await searchInstruments(text)
      if (cancelled) return
      setHits(rows)
      setSearching(false)
      if (rows.length > 0)
        quotes.refresh(
          rows.map((row) => row.symbol),
          { force: false },
        )
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, quotes])

  const open = React.useCallback(
    (hit: DisplayHit) => {
      // 只有真正打开详情才记入历史。
      store.noteRecent(hit.symbol)
      onClose()
      actions.openDetail(hit.symbol)
    },
    [store, onClose, actions],
  )

  // 空态：历史搜索 + 热门；有 query 时按市场分组（固定顺序 A股→港股→美股→基金）。
  const rows = React.useMemo(() => {
    const out: SearchRow[] = []
    if (!query.trim()) {
      const recent = store.recent
        .map((canonical) => {
          const symbol = resolveSymbol(canonical)
          return symbol ? { symbol: canonical, market: symbol.market, name: store.instrumentName(canonical) } : null
        })
        .filter((row): row is DisplayHit => row !== null)
      if (recent.length > 0) {
        out.push({ kind: 'header', id: 'h-recent', label: t('finance.search.recent'), action: 'clear' })
        for (const hit of recent) out.push({ kind: 'hit', id: `r-${hit.symbol}`, hit })
      }
      out.push({ kind: 'header', id: 'h-hot', label: t('finance.search.hot') })
      for (const seed of HOT_SEEDS) {
        const symbol = parseStrict(seed.symbol)
        out.push({
          kind: 'hit',
          id: `hot-${seed.symbol}`,
          hit: {
            symbol: seed.symbol,
            market: symbol ? symbol.market : 'ashare',
            name: store.instrumentName(seed.symbol) === seed.symbol ? seed.name : store.instrumentName(seed.symbol),
          },
        })
      }
      return out
    }
    for (const market of MARKET_ORDER) {
      const group = hits.filter((row) => row.market === market)
      if (group.length === 0) continue
      out.push({ kind: 'header', id: `h-${market}`, label: t(`market.${market}`) })
      for (const hit of group) out.push({ kind: 'hit', id: hit.symbol, hit })
    }
    return out
  }, [query, hits, store.recent, store.version, t]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="92dvh">
      <SheetHeader title={t('finance.search.title')} onClose={onClose} closeLabel={t('finance.done')} />
      <SearchField value={query} onChange={setQuery} placeholder={t('finance.search.prompt')} autoFocus />
      <VirtualList
        className="fin-scroll"
        style={{ flex: '1 1 auto', minHeight: 220 }}
        items={rows}
        estimatedRowHeight={52}
        empty={
          query.trim() && !searching ? (
            <EmptyState text={t('finance.search.none')} padding={40} />
          ) : searching ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Spinner size={20} color={C.muted} />
            </div>
          ) : null
        }
        footer={<div style={{ height: SPACE.s6 }} />}
        renderRow={(row) => {
          if (row.kind === 'header') {
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.s2,
                  padding: `${SPACE.s3}px ${SPACE.s4}px 4px`,
                  fontSize: 13,
                  color: C.muted,
                }}
              >
                <span style={{ flex: '1 1 auto' }}>{row.label}</span>
                {row.action === 'clear' ? (
                  <button
                    type="button"
                    className="fin-btn fin-press"
                    onClick={() => store.clearRecent()}
                    style={{ color: C.brand, fontSize: 12 }}
                  >
                    {t('finance.search.clear')}
                  </button>
                ) : null}
              </div>
            )
          }
          return <ResultRow hit={row.hit} ctx={ctx} onOpen={open} />
        }}
      />
    </Sheet>
  )
}
