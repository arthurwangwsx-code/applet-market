// 首页：推荐 / 热门 / 排行 三段共用一条虚拟列表。
//
// 用 `aibox/ui` 的 VirtualList 而不是自己 map：排行榜一次回 100 条带封面，
// 全量渲染 ≈ 1000+ DOM 节点，滚动必掉帧。它同时负责把可见行矩形喂给原生手势层
// （`useListGestures`），长按菜单才能落在正确的行上。

import React from 'react'
import { VirtualList, useListGestures } from 'aibox/ui'
import type { RowGestureEvent } from 'aibox/ui'
import VideoCard, { CARD_HEIGHT } from './VideoCard.js'
import { Segmented, Spinner, EmptyState } from './primitives.js'
import { C, SPACE } from './theme.js'
import * as api from '../lib/api.js'
import { copyText, haptic, openInBrowser, share, toast } from '../lib/host.js'
import type { AppletRequestError, VideoSummary } from '../lib/types.js'
import { errorMessage } from '../lib/types.js'

const SOURCES = [
  { id: 'recommend', label: '推荐' },
  { id: 'popular', label: '热门' },
  { id: 'ranking', label: '排行榜' },
] as const

type SourceID = (typeof SOURCES)[number]['id']
type FeedState = 'loading' | 'ready' | 'error'

function isSourceID(value: string): value is SourceID {
  return SOURCES.some((item) => item.id === value)
}

/** 长按菜单。身份是静态的，可用性按行覆盖——这条纪律与宿主 `aibox.menu` 一致。 */
const ROW_ACTIONS = [
  { id: 'share', title: '分享', icon: 'square.and.arrow.up' },
  { id: 'copy', title: '复制链接', icon: 'link' },
  { id: 'web', title: '用浏览器打开', icon: 'safari' },
]

export default function FeedPage({ onOpen }: { onOpen: (video: VideoSummary) => void }) {
  const [source, setSource] = React.useState<SourceID>('recommend')
  const [items, setItems] = React.useState<VideoSummary[]>([])
  const [state, setState] = React.useState<FeedState>('loading')
  const [error, setError] = React.useState('')
  // 权限没开与网络挂了是两种错：前者「重试」按钮点一万次也没用，得让用户去能力中心。
  const [needsPermission, setNeedsPermission] = React.useState(false)
  const freshIdx = React.useRef(1)

  const load = React.useCallback(async (kind: SourceID, append = false) => {
    if (!append) {
      setState('loading')
      setError('')
    }
    try {
      let next: VideoSummary[] = []
      if (kind === 'recommend') {
        next = await api.recommend(append ? (freshIdx.current += 1) : (freshIdx.current = 1))
      } else if (kind === 'popular') {
        next = await api.popular(1)
      } else {
        next = await api.ranking(0)
      }
      setItems((prev) => {
        if (!append) return next
        // 推荐流会重复推同一条，按 bvid 去重，否则 VirtualList 的 key 会撞。
        const seen = new Set(prev.map((v) => v.bvid))
        return prev.concat(next.filter((v) => !seen.has(v.bvid)))
      })
      setState('ready')
    } catch (err: unknown) {
      // 追加失败不该把已有列表清空——用户正在看的东西不能因为下一页挂了就消失。
      if (append) {
        toast('没有更多了')
        return
      }
      setNeedsPermission(err instanceof Error && !!(err as AppletRequestError).permission)
      setError(errorMessage(err))
      setState('error')
    }
  }, [])

  React.useEffect(() => {
    load(source)
  }, [source, load])

  const handleAction = React.useCallback(
    async ({ rowId, actionId }: RowGestureEvent) => {
      const video = items.find((v) => v.bvid === rowId)
      if (!video) return
      const url = `https://www.bilibili.com/video/${video.bvid}`
      haptic('light')
      if (actionId === 'share') await share(video.title, url)
      else if (actionId === 'copy') {
        await copyText(url)
        toast('链接已复制')
      } else if (actionId === 'web') await openInBrowser(url)
    },
    [items],
  )

  // 原生长按菜单。宿主不支持时 rendered=false，此时不装降级件——
  // 分享/复制在详情页都有入口，列表上少一个长按菜单不构成功能缺失。
  const gestures = useListGestures('feed', {
    contextMenu: ROW_ACTIONS,
    onAction: handleAction,
  })

  const header = (
    <Segmented
      items={SOURCES}
      value={source}
      onChange={(value) => {
        if (isSourceID(value)) setSource(value)
      }}
    />
  )

  if (state === 'error') {
    return (
      <div style={{ height: '100%', background: C.bg }}>
        {header}
        <EmptyState
          title={needsPermission ? '还没有联网权限' : '加载失败'}
          detail={error}
          actionLabel={needsPermission ? '我已开启，重新加载' : '重试'}
          onAction={() => load(source)}
        />
      </div>
    )
  }

  return (
    <VirtualList
      className="bl-scroll"
      style={{ height: '100%', background: C.bg }}
      regionId="feed"
      items={items}
      keyExtractor={(v) => v.bvid}
      estimatedRowHeight={CARD_HEIGHT}
      restoreKey={`feed:${source}`}
      header={header}
      empty={state === 'loading' ? <Spinner /> : <EmptyState title="这里还没有内容" />}
      footer={<div style={{ height: SPACE.s6 }} />}
      onVisibleRowsChange={gestures.onVisibleRowsChange}
      onEndReached={() => {
        if (source === 'recommend' && state === 'ready') load('recommend', true)
      }}
      renderRow={(video) => <VideoCard video={video} onOpen={onOpen} />}
    />
  )
}
