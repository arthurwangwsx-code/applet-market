// 资讯时间线：主题 chip 行（带折叠后计数）+ 左右横扫分页 + 刷新状态条 + 空态 + 长按操作。
// 传 sourceFeed 时复用为单订阅源下钻页（无 chips、无状态条、不回填播报队列）。

import React from 'react'
import Icon from './Icon.js'
import type { IconName } from './Icon.js'
import ArticleList, { buildArticleMenu } from './ArticleList.js'
import { EmptyState, PullRefresh, Spinner } from './primitives.js'
import Pager from './Pager.js'
import type { PagerHandle } from './Pager.js'
import { C, SPACE } from './theme.js'
import { TOPIC_ORDER, topicKey } from '../lib/catalog.js'
import { buckets as computeBuckets, project } from '../lib/projection.js'
import { relative } from '../lib/format.js'
import type { ProjectionOptions } from '../lib/projection.js'
import type { BlockedReason, NewsArticle, NewsContext, NewsFeed, NewsTopic, TimelineItem, Translate } from '../types.js'

const TOPIC_OPTIONS: Array<NewsTopic | null> = [null, ...TOPIC_ORDER]

interface ChipProps {
  label: string
  count: number
  selected: boolean
  onClick: () => void
  innerRef: (node: HTMLButtonElement | null) => void
}
function Chip({ label, count, selected, onClick, innerRef }: ChipProps) {
  return (
    <button
      ref={innerRef}
      type="button"
      className="news-btn news-press"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '7px 12px',
        borderRadius: 999,
        flex: '0 0 auto',
        fontSize: 13,
        fontWeight: selected ? 500 : 400,
        color: selected ? C.onBrand : C.ink,
        background: selected ? C.brand : 'color-mix(in srgb, var(--news-line) 50%, transparent)',
        transition: 'background 220ms ease, color 220ms ease',
      }}
    >
      <span>{label}</span>
      {count > 0 ? (
        <span
          className="news-mono"
          style={{ fontSize: 11, opacity: selected ? 0.82 : 1, color: selected ? C.onBrand : C.muted }}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}

interface TopicChipsProps {
  options: Array<NewsTopic | null>
  selectedIndex: number
  counts: Record<string, number>
  onSelect: (index: number) => void
  t: Translate
}
function TopicChips({ options, selectedIndex, counts, onSelect, t }: TopicChipsProps) {
  const scroller = React.useRef<HTMLDivElement | null>(null)
  const refs = React.useRef<Array<HTMLButtonElement | null>>([])
  React.useEffect(() => {
    const node = refs.current[selectedIndex]
    const host = scroller.current
    if (!node || !host) return
    const target = node.offsetLeft - (host.clientWidth - node.clientWidth) / 2
    host.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [selectedIndex])

  return (
    <div
      ref={scroller}
      className="news-chips"
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: `${SPACE.s2}px ${SPACE.s4}px`,
        background: C.bg,
        flex: '0 0 auto',
        scrollbarWidth: 'none',
      }}
    >
      {options.map((topic, index) => (
        <Chip
          key={topic || 'all'}
          innerRef={(node) => {
            refs.current[index] = node
          }}
          label={t(topicKey(topic))}
          count={counts[topic || 'all'] || 0}
          selected={index === selectedIndex}
          onClick={() => onSelect(index)}
        />
      ))}
    </div>
  )
}

/**
 * 刷新状态条。原生是四态（正在更新 / 尚未更新 / 部分来源需要检查 / 资讯已更新）；
 * 这里补上**第五态「被阻断」**：一条都没抓到且原因是权限 / 域名白名单 / 断网时，
 * 必须如实说出真因并给出修法，而不是含混地记成「尚未更新」——用户会以为是没有新闻。
 */
const BLOCKED_META: Record<BlockedReason, { titleKey: string; hintKey: string; icon: IconName }> = {
  permission: {
    titleKey: 'news.status.blocked.permission',
    hintKey: 'news.status.blocked.permission.hint',
    icon: 'lock.slash',
  },
  blocked: {
    titleKey: 'news.status.blocked.allowlist',
    hintKey: 'news.status.blocked.allowlist.hint',
    icon: 'exclamationmark.triangle',
  },
  offline: { titleKey: 'news.status.blocked.offline', hintKey: 'news.status.blocked.offline.hint', icon: 'wifi.slash' },
}

function RefreshStatusRow({ ctx, onOpenDiagnostics }: { ctx: NewsContext; onOpenDiagnostics?: () => void }) {
  const { agg, t, locale, now } = ctx
  const unsuccessful = agg.lastReport ? agg.unsuccessfulSourceCount : 0
  const blockedReason = agg.isRefreshing ? null : agg.blockedReason
  const blocked = blockedReason ? BLOCKED_META[blockedReason] : null

  let titleKey = 'news.status.ready'
  if (agg.isRefreshing) titleKey = 'news.status.refreshing'
  else if (blocked) titleKey = blocked.titleKey
  else if (!agg.lastUpdated) titleKey = 'news.status.notUpdated'
  else if (unsuccessful > 0) titleKey = 'news.status.partial'

  let icon: IconName = 'checkmark.circle'
  if (blocked) icon = blocked.icon
  else if (!agg.lastUpdated) icon = 'clock.badge.questionmark'
  else if (unsuccessful > 0) icon = 'exclamationmark.triangle'
  const color = blocked ? C.danger : unsuccessful > 0 ? C.orange : C.brand

  return (
    <button
      type="button"
      className="news-btn news-press"
      onClick={onOpenDiagnostics}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: `10px ${SPACE.s4}px`,
        background: 'color-mix(in srgb, var(--news-line) 12%, transparent)',
      }}
    >
      <span style={{ width: 20, display: 'flex', justifyContent: 'center' }}>
        {agg.isRefreshing ? <Spinner size={16} color={C.muted} /> : <Icon name={icon} size={16} color={color} />}
      </span>
      <span
        style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto', minWidth: 0, textAlign: 'left' }}
      >
        <span style={{ fontSize: 12, color: blocked ? C.danger : C.ink }}>{t(titleKey)}</span>
        {blocked ? (
          <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.35 }}>{t(blocked.hintKey)}</span>
        ) : agg.lastUpdated ? (
          <span style={{ fontSize: 12, color: C.muted }}>
            {t('news.status.updated', relative(agg.lastUpdated, locale, now), agg.successfulSourceCount)}
          </span>
        ) : null}
      </span>
      <Icon name="chevron.right" size={12} color={C.muted} style={{ opacity: 0.6 }} />
    </button>
  )
}

const BLOCKED_EMPTY: Record<BlockedReason, { icon: IconName; key: string }> = {
  permission: { icon: 'lock.slash', key: 'news.empty.blocked.permission' },
  blocked: { icon: 'exclamationmark.triangle', key: 'news.empty.blocked.allowlist' },
  offline: { icon: 'wifi.slash', key: 'news.empty.blocked.offline' },
}

function emptyDescriptor({
  refreshing,
  query,
  topic,
  timelineEmpty,
  blockedReason,
}: {
  refreshing: boolean
  query: string
  topic: NewsTopic | null
  timelineEmpty: boolean
  blockedReason: BlockedReason | null
}): { icon: IconName; key: string } {
  if (refreshing) return { icon: 'arrow.triangle.2.circlepath', key: 'news.empty.loading' }
  // 一条都没有 **且** 抓取整体被阻断时，空态必须说真因 —— 说「还没有新闻，下拉刷新」
  // 等于把「没权限」谎报成「没内容」，用户会一直下拉一个永远不会成功的刷新。
  if (timelineEmpty && blockedReason) return BLOCKED_EMPTY[blockedReason]
  if (String(query || '').trim()) return { icon: 'magnifyingglass', key: 'news.empty.search' }
  if (topic && !timelineEmpty) return { icon: 'tray', key: 'news.empty.topic' }
  return { icon: 'newspaper', key: 'news.empty.feed' }
}

interface TopicPageProps {
  items: TimelineItem[]
  ctx: NewsContext
  topic: NewsTopic | null
  isSource: boolean
  loadingSource: boolean
  onRefresh: () => void | Promise<unknown>
  refreshing: boolean
  showStatus: boolean
  onOpenDiagnostics?: () => void
}
function TopicPage({
  items,
  ctx,
  topic,
  isSource,
  loadingSource,
  onRefresh,
  refreshing,
  showStatus,
  onOpenDiagnostics,
}: TopicPageProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const menuFor = React.useMemo(() => buildArticleMenu(ctx, { includeCluster: !isSource }), [ctx, isSource])
  const descriptor = emptyDescriptor({
    refreshing: isSource ? loadingSource : ctx.agg.isRefreshing,
    query: ctx.query,
    topic,
    timelineEmpty: ctx.agg.timeline.length === 0,
    // 单源下钻页有自己的抓取链路，不套用整条时间线的阻断判定。
    blockedReason: isSource ? null : ctx.agg.blockedReason,
  })

  return (
    <PullRefresh onRefresh={onRefresh} refreshing={refreshing} scrollRef={scrollRef}>
      {showStatus ? <RefreshStatusRow ctx={ctx} onOpenDiagnostics={onOpenDiagnostics} /> : null}
      {items.length === 0 ? (
        <EmptyState icon={descriptor.icon} text={ctx.t(descriptor.key)} />
      ) : (
        <ArticleList items={items} ctx={ctx} menuFor={menuFor} />
      )}
      <div style={{ height: 24 }} />
    </PullRefresh>
  )
}

export default function FeedPage({ ctx, sourceFeed }: { ctx: NewsContext; sourceFeed?: NewsFeed }) {
  const isSource = !!sourceFeed
  const [topicIndex, setTopicIndex] = React.useState(0)
  const [sourceArticles, setSourceArticles] = React.useState<NewsArticle[]>([])
  const [loadingSource, setLoadingSource] = React.useState(false)
  const pagerRef = React.useRef<PagerHandle | null>(null)

  const options: ProjectionOptions = {
    query: ctx.query,
    hideRead: ctx.settings.hideRead,
    readKeys: ctx.readKeys,
    collapseClusters: ctx.settings.collapseClusters,
  }

  const buckets = React.useMemo(() => {
    if (isSource) return null
    return computeBuckets(ctx.agg.timeline, options)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ctx.agg.timeline,
    ctx.agg.timelineRevision,
    ctx.query,
    ctx.settings.hideRead,
    ctx.settings.collapseClusters,
    ctx.readVersion,
    isSource,
  ])

  const sourceItems = React.useMemo(() => {
    if (!isSource) return []
    return project(sourceArticles, { ...options, topic: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceArticles, ctx.query, ctx.settings.hideRead, ctx.settings.collapseClusters, ctx.readVersion, isSource])

  const counts = React.useMemo(() => {
    if (!buckets) return {}
    const out: Record<string, number> = {}
    for (const [key, rows] of Object.entries(buckets)) out[key] = rows.length
    return out
  }, [buckets])

  const selectedTopic = TOPIC_OPTIONS[topicIndex] ?? null

  // 回填「用户此刻看到的那串文章」——顶栏播报按钮据此建队列。只取 lead，只有资讯 Tab 回填。
  React.useEffect(() => {
    if (isSource || !buckets) return
    ctx.actions.setVisibleArticles((buckets[selectedTopic || 'all'] || []).map((entry) => entry.lead))
  }, [buckets, selectedTopic, isSource]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSource = React.useCallback(async () => {
    if (!isSource) return
    setLoadingSource(true)
    const result = await ctx.actions.fetchSource(sourceFeed!)
    setSourceArticles(result)
    setLoadingSource(false)
  }, [isSource, sourceFeed]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    loadSource()
  }, [loadSource])

  if (isSource) {
    return (
      <TopicPage
        items={sourceItems}
        ctx={ctx}
        topic={null}
        isSource
        loadingSource={loadingSource}
        refreshing={loadingSource}
        onRefresh={loadSource}
        showStatus={false}
      />
    )
  }

  return (
    <>
      <TopicChips
        options={TOPIC_OPTIONS}
        selectedIndex={topicIndex}
        counts={counts}
        onSelect={(index) => {
          if (pagerRef.current) pagerRef.current.slideTo(index)
          else setTopicIndex(index)
        }}
        t={ctx.t}
      />
      <Pager
        ref={pagerRef}
        count={TOPIC_OPTIONS.length}
        index={topicIndex}
        onIndex={setTopicIndex}
        renderPage={(index) => {
          const topic = TOPIC_OPTIONS[index] ?? null
          return (
            <TopicPage
              items={(buckets && buckets[topic || 'all']) || []}
              ctx={ctx}
              topic={topic}
              isSource={false}
              loadingSource={false}
              refreshing={ctx.agg.isRefreshing}
              onRefresh={() => ctx.actions.refresh(true)}
              showStatus={ctx.settings.showRefreshStatus}
              onOpenDiagnostics={() => ctx.actions.navigate({ name: 'diagnostics' })}
            />
          )
        }}
      />
    </>
  )
}
