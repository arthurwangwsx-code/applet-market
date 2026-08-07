// 订阅页：首段「设置 / 添加订阅源」两行 + 按分类分组的源列表（只显示有源的分类）。
// 源行：左主题图标 + 三行文字（源名 / kind · endpoint / 状态）+ 右侧 chevron 与开关。
// 点行下钻该源文章列表；长按 = 上移 / 下移 / 删除；左滑 = 删除。内置源也能删。

import React from 'react'
import Icon from './Icon.js'
import type { IconName } from './Icon.js'
import { useLongPress } from '@aibox/applet-sdk/react'
import { ActionSheet, Card, Row, SectionHeader, SwipeRow, Toggle } from './primitives.js'
import { C, SPACE } from './theme.js'
import { TOPIC_ICON, TOPIC_ORDER, topicKey } from '../lib/catalog.js'
import { relative } from '../lib/format.js'
import type { NewsContext, NewsFeed, NewsTopic, SourceRefreshState } from '../types.js'

function statusFor(
  feed: NewsFeed,
  state: SourceRefreshState | undefined,
  ctx: NewsContext,
): { icon: IconName; text: string; color: string } {
  if (!feed.enabled) return { icon: 'pause.circle', text: ctx.t('news.source.paused'), color: C.muted }
  if (state) {
    if (state.status === 'success') {
      return { icon: 'checkmark.circle', text: ctx.t('news.source.updatedItems', state.itemCount), color: C.brand }
    }
    if (state.status === 'failed') {
      return { icon: 'exclamationmark.circle', text: ctx.t('news.source.failed'), color: C.danger }
    }
    return { icon: 'minus.circle', text: ctx.t('news.source.noItems'), color: C.orange }
  }
  if (!feed.lastFetched) return { icon: 'clock', text: ctx.t('news.source.never'), color: C.muted }
  return { icon: 'clock', text: relative(feed.lastFetched, ctx.locale, ctx.now), color: C.muted }
}

function SourceRow({
  feed,
  ctx,
  state,
  last,
}: {
  feed: NewsFeed
  ctx: NewsContext
  state?: SourceRefreshState
  last: boolean
}) {
  const [menu, setMenu] = React.useState(false)
  const status = statusFor(feed, state, ctx)
  const press = useLongPress({
    onLongPress: () => setMenu(true),
    onTap: () => ctx.actions.navigate({ name: 'source', feed }),
  })

  return (
    <>
      <SwipeRow actionLabel={ctx.t('news.action.delete')} onAction={() => ctx.actions.removeFeed(feed.id)}>
        <div
          className="news-press"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.s3,
            padding: `10px ${SPACE.s4}px`,
            background: C.surface,
            borderBottom: last ? 'none' : `0.5px solid ${C.line}`,
          }}
          {...press}
        >
          <span style={{ width: 22, display: 'flex', justifyContent: 'center', flex: '0 0 auto' }}>
            <Icon name={(TOPIC_ICON[feed.topic] || 'newspaper') as IconName} size={14} color={C.brand} />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto', minWidth: 0 }}>
            <span className="news-clamp-1" style={{ fontSize: 15, color: C.ink }}>
              {feed.title}
            </span>
            <span className="news-clamp-1" style={{ fontSize: 12, color: C.muted }}>
              {`${feed.kind} · ${feed.endpoint}`}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: status.color }}>
              <Icon name={status.icon} size={12} />
              {status.text}
            </span>
          </span>
          <Icon name="chevron.right" size={12} color={C.muted} />
          <Toggle
            checked={feed.enabled}
            label={feed.title}
            onChange={(next: boolean) => ctx.actions.setFeedEnabled(feed.id, next)}
          />
        </div>
      </SwipeRow>
      <ActionSheet
        visible={menu}
        title={feed.title}
        cancelLabel={ctx.t('news.action.cancel')}
        onClose={() => setMenu(false)}
        actions={[
          {
            key: 'up',
            icon: 'arrow.up',
            label: ctx.t('news.action.moveUp'),
            onSelect: () => ctx.actions.moveFeed(feed.id, -1),
          },
          {
            key: 'down',
            icon: 'arrow.down',
            label: ctx.t('news.action.moveDown'),
            onSelect: () => ctx.actions.moveFeed(feed.id, 1),
          },
          {
            key: 'delete',
            icon: 'trash',
            label: ctx.t('news.action.delete'),
            danger: true,
            onSelect: () => ctx.actions.removeFeed(feed.id),
          },
        ]}
      />
    </>
  )
}

export default function SourcesPage({ ctx }: { ctx: NewsContext }) {
  const statesByID = React.useMemo(() => {
    const map = new Map<string, SourceRefreshState>()
    const report = ctx.agg.lastReport
    if (report) for (const state of report.sourceStates) map.set(state.id, state)
    return map
  }, [ctx.agg.lastReport, ctx.agg.timelineRevision]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = React.useMemo(() => {
    const byTopic = new Map<NewsTopic, NewsFeed[]>()
    for (const feed of ctx.store.feeds) {
      if (!byTopic.has(feed.topic)) byTopic.set(feed.topic, [])
      byTopic.get(feed.topic)?.push(feed)
    }
    return TOPIC_ORDER.filter((topic) => (byTopic.get(topic) || []).length > 0).map((topic) => ({
      topic,
      feeds: [...(byTopic.get(topic) ?? [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    }))
  }, [ctx.store.feeds, ctx.storeVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="news-scroll">
      <div style={{ height: SPACE.s3 }} />
      <Card>
        <Row
          icon="gearshape"
          title={ctx.t('news.subs.settings')}
          onClick={() => ctx.actions.navigate({ name: 'settings' })}
        />
        <Row
          icon="plus.circle"
          iconColor={C.brand}
          title={ctx.t('news.add.nav')}
          onClick={() => ctx.actions.navigate({ name: 'addSource' })}
          last
        />
      </Card>

      {groups.map((group) => (
        <div key={group.topic}>
          <SectionHeader>{ctx.t(topicKey(group.topic))}</SectionHeader>
          <Card>
            {group.feeds.map((feed, i) => (
              <SourceRow
                key={feed.id}
                feed={feed}
                ctx={ctx}
                state={statesByID.get(feed.id)}
                last={i === group.feeds.length - 1}
              />
            ))}
          </Card>
        </div>
      ))}
      <div style={{ height: 32 }} />
    </div>
  )
}
