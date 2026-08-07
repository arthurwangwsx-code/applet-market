// NewsTimelineProjection 的移植：搜索 / 主题 / 隐藏已读过滤 + 按发布时间倒序 + 事件簇折叠。
// 纯值算法，资讯页、订阅源下钻页与收藏页共用。

import { TOPICS } from './catalog.js'
import type { NewsArticle, NewsTopic, TimelineItem } from '../types.js'

export interface ProjectionOptions {
  topic?: NewsTopic | null
  query?: string
  hideRead: boolean
  readKeys: Set<string>
  collapseClusters: boolean
}

/** 过滤（主题 / 已读 / 搜索）+ 按发布时间倒序。 */
export function filteredSorted(
  articles: NewsArticle[],
  { topic, query, hideRead, readKeys }: ProjectionOptions,
): NewsArticle[] {
  const normalizedQuery = String(query || '')
    .trim()
    .toLowerCase()
  const filtered = articles.filter((article) => {
    if (topic && article.topic !== topic) return false
    if (hideRead && readKeys.has(article.id)) return false
    if (!normalizedQuery) return true
    return (
      (article.title || '').toLowerCase().includes(normalizedQuery) ||
      (article.summary || '').toLowerCase().includes(normalizedQuery) ||
      (article.sourceName || '').toLowerCase().includes(normalizedQuery) ||
      (article.author || '').toLowerCase().includes(normalizedQuery)
    )
  })
  filtered.sort((a, b) => b.publishedAt - a.publishedAt)
  return filtered
}

/**
 * 把已排序的文章折叠成时间线条目：同一事件簇收敛成一条（首个成员即 lead，其余进 related）。
 * 入参须已按发布时间倒序。
 */
export function collapse(sorted: NewsArticle[], collapseClusters: boolean): TimelineItem[] {
  if (!collapseClusters) {
    return sorted.map((article) => ({ id: article.id, lead: article, related: [] }))
  }
  const members = new Map<string, NewsArticle[]>()
  const order: string[] = []
  for (const article of sorted) {
    const key = article.clusterID ? `cluster:${article.clusterID}` : `article:${article.id}`
    if (!members.has(key)) {
      members.set(key, [])
      order.push(key)
    }
    members.get(key)?.push(article)
  }
  return order.map((key) => {
    const group = members.get(key) ?? []
    const lead = group[0]
    if (!lead) throw new Error(`Missing cluster lead for ${key}`)
    return { id: lead.id, lead, related: group.slice(1) }
  })
}

export function project(articles: NewsArticle[], options: ProjectionOptions): TimelineItem[] {
  return collapse(filteredSorted(articles, options), options.collapseClusters)
}

/**
 * 单趟构建 per-主题分桶：`all` 桶 = 全部，其余按主题。
 * 过滤与排序**只做一次**，随后一趟分桶、各桶各自折叠——不要退回「每个主题各跑一遍全量 project」。
 */
export function buckets(
  articles: NewsArticle[],
  options: ProjectionOptions,
): Record<'all' | NewsTopic, TimelineItem[]> {
  const base = filteredSorted(articles, { ...options, topic: null })
  const byTopic = new Map<NewsTopic, NewsArticle[]>()
  for (const article of base) {
    if (!byTopic.has(article.topic)) byTopic.set(article.topic, [])
    byTopic.get(article.topic)?.push(article)
  }
  const result = { all: collapse(base, options.collapseClusters) } as Record<'all' | NewsTopic, TimelineItem[]>
  for (const topic of TOPICS) {
    result[topic] = collapse(byTopic.get(topic) || [], options.collapseClusters)
  }
  return result
}
