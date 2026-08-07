// 文章列表 + 长按菜单 + 可选左滑删除。资讯页 / 事件簇详情 / 订阅源下钻 / 收藏页共用。
// 长按菜单的**项与顺序**按 spec §2.5 / §4：条件不满足则整项不出现。

import React from 'react'
import type { ReactNode } from 'react'
import ArticleRow from './ArticleRow.js'
import { useLongPress } from '@aibox/applet-sdk/react'
import { ActionSheet, SwipeRow, useIncremental } from './primitives.js'
import type { ActionSheetItem } from './primitives.js'
import { C, SPACE } from './theme.js'
import type { NewsArticle, NewsContext, TimelineItem } from '../types.js'

export type ArticleMenuFactory = (
  article: NewsArticle,
  item: TimelineItem,
  sequence: TimelineItem[],
) => ActionSheetItem[]
interface SwipeConfig {
  label: string
  onAction: (article: NewsArticle) => void | Promise<void>
}

function Item({
  article,
  item,
  ctx,
  menuFor,
  swipe,
  sequence,
}: {
  article: NewsArticle
  item: TimelineItem
  ctx: NewsContext
  menuFor: ArticleMenuFactory
  swipe?: SwipeConfig
  sequence: TimelineItem[]
}) {
  const [menu, setMenu] = React.useState(false)
  const actions = menu ? menuFor(article, item, sequence) : []
  const press = useLongPress({ onLongPress: () => setMenu(true), onTap: () => ctx.actions.openArticle(article) })

  const body = (
    <div className="news-press" style={{ padding: `0 ${SPACE.s4}px`, background: C.surface }} {...press}>
      <ArticleRow
        article={article}
        isRead={ctx.readKeys.has(article.id)}
        relatedCount={item ? item.related.length : 0}
        isSaved={ctx.savedKeys.has(article.id)}
        isSpeaking={ctx.speakingId === article.id}
        locale={ctx.locale}
        t={ctx.t}
        now={ctx.now}
      />
      <div style={{ height: 0, borderBottom: `0.5px solid ${C.line}` }} />
    </div>
  )

  return (
    <>
      {swipe ? (
        <SwipeRow actionLabel={swipe.label} onAction={() => swipe.onAction(article)}>
          {body}
        </SwipeRow>
      ) : (
        body
      )}
      <ActionSheet
        visible={menu}
        title={article.title}
        actions={actions}
        cancelLabel={ctx.t('news.action.cancel')}
        onClose={() => setMenu(false)}
      />
    </>
  )
}

/**
 * @param items    时间线条目 `{ id, lead, related }`；或直接给 articles
 * @param menuFor  (article, item, sequence) => ActionSheet actions
 * @param swipe    `{ label, onAction }`，不给则无左滑
 */
export default function ArticleList({
  items,
  ctx,
  menuFor,
  swipe,
  header,
  footer,
}: {
  items: TimelineItem[]
  ctx: NewsContext
  menuFor: ArticleMenuFactory
  swipe?: SwipeConfig
  header?: ReactNode
  footer?: ReactNode
}) {
  const { visible, sentinel, hasMore } = useIncremental(items, 30)
  return (
    <div>
      {header}
      {visible.map((entry) => (
        <Item
          key={entry.id}
          article={entry.lead}
          item={entry}
          ctx={ctx}
          menuFor={menuFor}
          swipe={swipe}
          sequence={items}
        />
      ))}
      <div ref={sentinel} style={{ height: hasMore ? 24 : 0 }} />
      {footer}
    </div>
  )
}

/** 时间线 / 订阅源下钻 / 事件簇详情的长按菜单构造器。 */
export function buildArticleMenu(
  ctx: NewsContext,
  { includeRelated = true, includeCluster = true }: { includeRelated?: boolean; includeCluster?: boolean } = {},
): ArticleMenuFactory {
  return (article, item, sequence) => {
    const actions: ActionSheetItem[] = []
    if (includeRelated && includeCluster && item && item.related.length > 0) {
      actions.push({
        key: 'related',
        icon: 'rectangle.stack',
        label: ctx.t('news.action.relatedReports'),
        onSelect: () => ctx.actions.openCluster(item),
      })
    }
    if (ctx.hasAI) {
      actions.push({
        key: 'analyze',
        icon: 'sparkles',
        label: ctx.t('news.action.analyze'),
        onSelect: () => ctx.actions.analyze(article),
      })
    }
    if (ctx.hasTTS) {
      actions.push({
        key: 'listen',
        icon: 'speaker.wave.2',
        label: ctx.t('news.action.listen'),
        onSelect: () =>
          ctx.actions.listenFrom(
            article,
            sequence.map((row) => row.lead),
          ),
      })
    }
    const saved = ctx.savedKeys.has(article.id)
    actions.push({
      key: 'save',
      icon: saved ? 'bookmark.slash' : 'bookmark',
      label: ctx.t(saved ? 'news.action.unsave' : 'news.action.save'),
      onSelect: () => ctx.actions.toggleSaved(article),
    })
    const read = ctx.readKeys.has(article.id)
    actions.push({
      key: 'read',
      icon: read ? 'circle' : 'checkmark.circle',
      label: ctx.t(read ? 'news.action.markUnread' : 'news.action.markRead'),
      onSelect: () => ctx.actions.toggleRead(article),
    })
    if (ctx.hasKnowledgeCapture) {
      actions.push({
        key: 'kb',
        icon: 'books.vertical',
        label: ctx.t('Save to Knowledge Base'),
        onSelect: () => ctx.actions.saveToKnowledgeBase(article),
      })
    }
    return actions
  }
}
