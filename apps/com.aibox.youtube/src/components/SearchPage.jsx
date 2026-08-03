// 搜索页 —— 这个应用的主页。
//
// 为什么以搜索为主页而不是「首页推荐」：InnerTube 的首页/热门（`FEwhat_to_watch` / `FEtrending`）
// 实测要么 400、要么回一份没有视频条目的空壳，那需要登录态。与其做一个永远空着的推荐页，
// 不如把搜索放在正中，再用「最近观看」补上回访路径。

import React from 'react'
import { VirtualList, useKeyboardInset, useListGestures } from 'aibox/ui'
import VideoCard, { CARD_HEIGHT } from './VideoCard.jsx'
import { EmptyState, Spinner } from './primitives.jsx'
import { C, RADIUS, SPACE } from './theme.js'
import * as innertube from '../lib/innertube.js'
import { copyText, haptic, loadPref, openInBrowser, savePref, share, toast } from '../lib/host.js'

const RECENT_KEY = 'recent-queries'
const HISTORY_KEY = 'watch-history'

const ROW_ACTIONS = [
  { id: 'share', title: '分享', icon: 'square.and.arrow.up' },
  { id: 'copy', title: '复制链接', icon: 'link' },
  { id: 'web', title: '用浏览器打开', icon: 'safari' },
]

export default function SearchPage({ onOpen }) {
  const [keyword, setKeyword] = React.useState('')
  const [items, setItems] = React.useState([])
  const [state, setState] = React.useState('idle')   // idle | loading | ready | error
  const [error, setError] = React.useState('')
  const [needsPermission, setNeedsPermission] = React.useState(false)
  const [recent, setRecent] = React.useState([])
  const [history, setHistory] = React.useState([])
  const keyboard = useKeyboardInset()

  React.useEffect(() => {
    loadPref(RECENT_KEY, []).then((r) => setRecent(r || []))
    loadPref(HISTORY_KEY, []).then((h) => setHistory(h || []))
  }, [])

  const run = React.useCallback(async (text) => {
    const query = String(text || '').trim()
    if (!query) return
    setState('loading')
    setError('')
    setNeedsPermission(false)
    try {
      const list = await innertube.search(query)
      setItems(list)
      setState('ready')
      loadPref(RECENT_KEY, []).then((prev) => {
        const next = [query, ...(prev || []).filter((q) => q !== query)].slice(0, 10)
        setRecent(next)
        savePref(RECENT_KEY, next)
      }).catch(() => {})
    } catch (err) {
      setNeedsPermission(!!err?.permission)
      setError(String(err?.message || err))
      setState('error')
    }
  }, [])

  const handleAction = React.useCallback(async ({ rowId, actionId }) => {
    const video = items.find((v) => v.id === rowId) || history.find((v) => v.id === rowId)
    if (!video) return
    haptic('light')
    if (actionId === 'share') await share(video.title, video.url)
    else if (actionId === 'copy') { await copyText(video.url); toast('链接已复制') }
    else if (actionId === 'web') await openInBrowser(video.url)
  }, [items, history])

  const gestures = useListGestures('yt-results', { contextMenu: ROW_ACTIONS, onAction: handleAction })

  const bar = (
    <div style={{ padding: SPACE.s3, background: C.bg, display: 'flex', gap: SPACE.s2 }}>
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); run(keyword) } }}
        placeholder="搜索 YouTube"
        enterKeyHint="search"
        style={{
          flex: 1, border: 'none', outline: 'none',
          padding: `9px ${SPACE.s3}px`, borderRadius: RADIUS.md,
          background: C.surface, color: C.text, fontSize: 14,
        }}
      />
      <button
        type="button"
        onClick={() => run(keyword)}
        style={{
          border: 'none', padding: `0 ${SPACE.s4}px`, borderRadius: RADIUS.md,
          background: C.brand, color: '#fff', fontSize: 14,
        }}
      >
        搜索
      </button>
    </div>
  )

  function Chips({ title, values, onPick }) {
    if (!values.length) return null
    return (
      <div style={{ padding: `0 ${SPACE.s4}px ${SPACE.s4}px` }}>
        <div style={{ fontSize: 13, color: C.sub, marginBottom: SPACE.s2 }}>{title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.s2 }}>
          {values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onPick(v)}
              style={{
                border: 'none', padding: `7px ${SPACE.s3}px`, borderRadius: RADIUS.lg,
                background: C.surface, color: C.text, fontSize: 13,
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    )
  }

  let body = null
  if (state === 'loading') body = <Spinner label="搜索中" />
  else if (state === 'error') {
    body = (
      <EmptyState
        title={needsPermission ? '还没有联网权限' : '搜索失败'}
        detail={error}
        actionLabel={needsPermission ? '我已开启，重新搜索' : '重试'}
        onAction={() => run(keyword)}
      />
    )
  } else if (state === 'ready' && items.length === 0) {
    body = <EmptyState title="没有找到相关视频" detail="换个关键词试试" />
  } else if (state === 'idle') {
    body = (
      <div style={{ paddingTop: SPACE.s2 }}>
        <Chips title="最近搜索" values={recent} onPick={(q) => { setKeyword(q); run(q) }} />
        {history.length ? (
          <div>
            <div style={{ padding: `0 ${SPACE.s4}px ${SPACE.s2}px`, fontSize: 13, color: C.sub }}>
              最近观看
            </div>
            {history.slice(0, 12).map((v) => (
              <VideoCard key={v.id} video={v} onOpen={onOpen} />
            ))}
          </div>
        ) : null}
        {!recent.length && !history.length ? (
          <EmptyState title="搜点什么吧" detail="YouTube 的首页需要登录，所以这里以搜索为主。" />
        ) : null}
      </div>
    )
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', background: C.bg,
      paddingBottom: keyboard.height,
      transition: `padding-bottom ${keyboard.animationMs}ms`,
    }}>
      {bar}
      {body ? (
        <div className="yt-scroll" style={{ flex: 1, overflowY: 'auto' }}>{body}</div>
      ) : (
        <VirtualList
          className="yt-scroll"
          style={{ flex: 1 }}
          regionId="yt-results"
          items={items}
          keyExtractor={(v) => v.id}
          estimatedRowHeight={CARD_HEIGHT}
          restoreKey="yt-results"
          footer={<div style={{ height: SPACE.s6 }} />}
          onVisibleRowsChange={gestures.onVisibleRowsChange}
          renderRow={(video) => <VideoCard video={video} onOpen={onOpen} />}
        />
      )}
    </div>
  )
}
