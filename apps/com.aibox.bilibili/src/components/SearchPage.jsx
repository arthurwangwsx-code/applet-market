// 搜索页。走 `wbi/search/all/v2` 综合搜索（含视频 / 番剧 / UP 主三组）。
//
// 输入框用受控 input + 显式提交，**不做输入即搜**：每敲一个字发一次带 WBI 签名的请求，
// 既浪费也更容易撞风控。

import React from 'react'
import { VirtualList, useKeyboardInset } from 'aibox/ui'
import VideoCard, { CARD_HEIGHT } from './VideoCard.jsx'
import { EmptyState, Spinner } from './primitives.jsx'
import { C, RADIUS, SPACE } from './theme.js'
import * as api from '../lib/api.js'
import { imageURL, openInBrowser } from '../lib/host.js'
import { formatCount } from '../lib/format.js'

/** 番剧/UP 主这类本应用没做详情的结果，点了交给宿主浏览器，而不是留一个点不动的行。 */
function BangumiRow({ item }) {
  return (
    <div
      className="bl-press"
      onClick={() => openInBrowser(item.url)}
      style={{ display: 'flex', gap: SPACE.s3, padding: `${SPACE.s3}px ${SPACE.s4}px`, alignItems: 'center' }}
    >
      <img
        src={imageURL(item.cover, 60)}
        alt=""
        style={{ width: 60, height: 80, objectFit: 'cover', borderRadius: RADIUS.sm, background: C.surface }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="bl-clamp2" style={{ fontSize: 14, color: C.text }}>{item.title}</div>
        <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>{item.desc}</div>
      </div>
    </div>
  )
}

function UserRow({ item }) {
  return (
    <div
      className="bl-press"
      onClick={() => openInBrowser(`https://space.bilibili.com/${item.mid}`)}
      style={{ display: 'flex', gap: SPACE.s3, padding: `${SPACE.s3}px ${SPACE.s4}px`, alignItems: 'center' }}
    >
      <img
        src={imageURL(item.avatar, 44)}
        alt=""
        style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover', background: C.surface }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: C.text }}>{item.name}</div>
        <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>
          {formatCount(item.fans)}粉丝 · {item.videos}个视频
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ label }) {
  return (
    <div style={{
      padding: `${SPACE.s3}px ${SPACE.s4}px ${SPACE.s2}px`,
      fontSize: 13, fontWeight: 600, color: C.sub, background: C.bg,
    }}>
      {label}
    </div>
  )
}

export default function SearchPage({ onOpen }) {
  const [keyword, setKeyword] = React.useState('')
  const [hot, setHot] = React.useState([])
  const [rows, setRows] = React.useState([])
  const [state, setState] = React.useState('idle')   // idle | loading | ready | error
  const [error, setError] = React.useState('')
  const keyboard = useKeyboardInset()

  React.useEffect(() => { api.hotSearch().then(setHot) }, [])

  const run = React.useCallback(async (text) => {
    const query = String(text || '').trim()
    if (!query) return
    setState('loading')
    setError('')
    try {
      const result = await api.search(query)
      // 三组结果扁平成一条虚拟列表：分组头也是行，这样长结果集照样虚拟滚动。
      const out = []
      if (result.videos.length) {
        out.push({ kind: 'header', id: 'h-video', label: '视频' })
        for (const v of result.videos) out.push({ kind: 'video', id: `v-${v.bvid}`, video: v })
      }
      if (result.bangumi.length) {
        out.push({ kind: 'header', id: 'h-bangumi', label: '番剧' })
        result.bangumi.forEach((b, i) => out.push({ kind: 'bangumi', id: `b-${i}`, item: b }))
      }
      if (result.users.length) {
        out.push({ kind: 'header', id: 'h-user', label: 'UP 主' })
        for (const u of result.users) out.push({ kind: 'user', id: `u-${u.mid}`, item: u })
      }
      setRows(out)
      setState('ready')
    } catch (err) {
      setError(String(err?.message || err))
      setState('error')
    }
  }, [])

  const searchBar = (
    <div style={{ padding: SPACE.s3, background: C.bg, display: 'flex', gap: SPACE.s2 }}>
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); run(keyword) } }}
        placeholder="搜索视频、番剧、UP 主"
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

  let body
  if (state === 'loading') body = <Spinner label="搜索中" />
  else if (state === 'error') {
    body = <EmptyState title="搜索失败" detail={error} actionLabel="重试" onAction={() => run(keyword)} />
  } else if (state === 'ready' && rows.length === 0) {
    body = <EmptyState title="没有找到相关内容" detail="换个关键词试试" />
  } else if (state === 'idle') {
    body = (
      <div style={{ padding: SPACE.s4 }}>
        <div style={{ fontSize: 13, color: C.sub, marginBottom: SPACE.s3 }}>热搜</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.s2 }}>
          {hot.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => { setKeyword(word); run(word) }}
              style={{
                border: 'none', padding: `7px ${SPACE.s3}px`, borderRadius: RADIUS.lg,
                background: C.surface, color: C.text, fontSize: 13,
              }}
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    // 键盘避让：宿主推 keyboardChanged，输入框才不会被挡住（这是「一眼网页」的典型症状之一）。
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, paddingBottom: keyboard.height,
      transition: `padding-bottom ${keyboard.animationMs}ms`,
    }}>
      {searchBar}
      {body ? (
        <div className="bl-scroll" style={{ flex: 1, overflowY: 'auto' }}>{body}</div>
      ) : (
        <VirtualList
          className="bl-scroll"
          style={{ flex: 1 }}
          items={rows}
          keyExtractor={(row) => row.id}
          estimatedRowHeight={CARD_HEIGHT}
          restoreKey="search"
          footer={<div style={{ height: SPACE.s6 }} />}
          renderRow={(row) => {
            if (row.kind === 'header') return <SectionHeader label={row.label} />
            if (row.kind === 'video') return <VideoCard video={row.video} onOpen={onOpen} />
            if (row.kind === 'bangumi') return <BangumiRow item={row.item} />
            return <UserRow item={row.item} />
          }}
        />
      )}
    </div>
  )
}
