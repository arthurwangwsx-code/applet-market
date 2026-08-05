// 收藏页：顶部两个子 Tab（收藏 / 历史记录，可左右横扫切换）+ 搜索 + 左滑删除。
// 收藏按 savedAt 倒序；历史按 readAt 倒序、UI 取前 200 条且只显示带展示字段的记录。
// 长按菜单没有「相关报道」。

import React from 'react'
import ArticleList from './ArticleList.js'
import { EmptyState } from './primitives.js'
import Pager from './Pager.js'
import { SearchField } from './Shell.js'
import { C, SPACE } from './theme.js'
import { HISTORY_UI_LIMIT } from '../lib/store.js'

function Segmented({ options, index, onSelect }) {
  return (
    <div style={{ padding: `${SPACE.s2}px ${SPACE.s4}px`, flex: '0 0 auto', background: C.bg }}>
      <div style={{
        display: 'flex', padding: 2, borderRadius: 9,
        background: 'color-mix(in srgb, var(--news-line) 45%, transparent)',
      }}
      >
        {options.map((option, i) => (
          <button
            key={option}
            type="button"
            className="news-btn news-press"
            onClick={() => onSelect(i)}
            style={{
              flex: '1 1 0', textAlign: 'center', padding: '6px 0', borderRadius: 7,
              fontSize: 13, fontWeight: i === index ? 600 : 400,
              color: C.ink,
              background: i === index ? C.surface : 'transparent',
              boxShadow: i === index ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
              transition: 'background 180ms ease',
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function matches(text, query) {
  return String(text || '').toLowerCase().includes(query)
}

export default function SavedPage({ ctx }) {
  const [index, setIndex] = React.useState(0)
  const pagerRef = React.useRef(null)
  const [localQuery, setLocalQuery] = React.useState('')
  // 宿主搜索框是资讯页语义的；收藏页在宿主 search 不可用时自绘一个，可用时复用同一个 query。
  const query = ctx.searchRendered ? ctx.query : localQuery
  const normalized = query.trim().toLowerCase()

  const savedItems = React.useMemo(() => {
    const rows = [...ctx.store.saved].sort((a, b) => b.savedAt - a.savedAt)
    const filtered = normalized
      ? rows.filter((row) => matches(row.title, normalized) || matches(row.summary, normalized)
        || matches(row.sourceName, normalized) || matches(row.author, normalized))
      : rows
    return filtered.map((row) => ({ id: row.id, lead: toArticle(row), related: [] }))
  }, [ctx.store.saved, ctx.storeVersion, normalized]) // eslint-disable-line react-hooks/exhaustive-deps

  const historyItems = React.useMemo(() => {
    const rows = [...ctx.store.read]
      .filter((row) => row.title || row.url)
      .sort((a, b) => b.readAt - a.readAt)
      .slice(0, HISTORY_UI_LIMIT)
    const filtered = normalized
      ? rows.filter((row) => matches(row.title, normalized) || matches(row.sourceName, normalized))
      : rows
    return filtered.map((row) => ({ id: row.articleKey, lead: historyToArticle(row), related: [] }))
  }, [ctx.store.read, ctx.storeVersion, normalized]) // eslint-disable-line react-hooks/exhaustive-deps

  const menuFor = React.useCallback((article) => {
    const actions = []
    if (ctx.hasAI) {
      actions.push({ key: 'analyze', icon: 'sparkles', label: ctx.t('news.action.analyze'), onSelect: () => ctx.actions.analyze(article) })
    }
    if (ctx.hasTTS) {
      actions.push({ key: 'listen', icon: 'speaker.wave.2', label: ctx.t('news.action.listen'), onSelect: () => ctx.actions.listenFrom(article, [article]) })
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
      actions.push({ key: 'kb', icon: 'books.vertical', label: ctx.t('Save to Knowledge Base'), onSelect: () => ctx.actions.saveToKnowledgeBase(article) })
    }
    return actions
  }, [ctx])

  const renderPage = (page) => {
    const items = page === 0 ? savedItems : historyItems
    if (items.length === 0) {
      const icon = normalized ? 'magnifyingglass' : (page === 0 ? 'bookmark' : 'clock.arrow.circlepath')
      const key = normalized ? 'news.empty.search' : (page === 0 ? 'news.empty.saved' : 'news.empty.history')
      return <div className="news-scroll"><EmptyState icon={icon} text={ctx.t(key)} /></div>
    }
    return (
      <div className="news-scroll">
        <ArticleList
          items={items}
          ctx={ctx}
          menuFor={menuFor}
          swipe={page === 0
            ? { label: ctx.t('news.action.unsave'), onAction: (article) => ctx.actions.unsave(article.id) }
            : { label: ctx.t('news.action.delete'), onAction: (article) => ctx.actions.removeHistory(article.id) }}
        />
        <div style={{ height: 24 }} />
      </div>
    )
  }

  return (
    <>
      <Segmented
        options={[ctx.t('news.saved.favorites'), ctx.t('news.saved.history')]}
        index={index}
        onSelect={(next) => { if (pagerRef.current) pagerRef.current.slideTo(next); else setIndex(next) }}
      />
      {ctx.searchRendered ? null : (
        <SearchField value={localQuery} onChange={setLocalQuery} placeholder={ctx.t('news.search.prompt')} />
      )}
      <Pager ref={pagerRef} count={2} index={index} onIndex={setIndex} renderPage={renderPage} />
    </>
  )
}

function toArticle(row) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    summary: row.summary || '',
    contentHTML: null,
    author: row.author || '',
    sourceID: '',
    sourceName: row.sourceName || '',
    topic: row.topic || 'top',
    imageURL: row.imageURL || null,
    publishedAt: row.publishedAt || 0,
    fetchedAt: row.savedAt || 0,
    clusterID: null,
  }
}

function historyToArticle(row) {
  return {
    id: row.articleKey,
    title: row.title,
    url: row.url,
    summary: '',
    contentHTML: null,
    author: '',
    sourceID: '',
    sourceName: row.sourceName || '',
    topic: row.topic || 'top',
    imageURL: row.imageURL || null,
    publishedAt: row.publishedAt || 0,
    fetchedAt: row.readAt || 0,
    clusterID: null,
  }
}
