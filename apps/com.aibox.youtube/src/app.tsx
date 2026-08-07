// YouTube（com.aibox.youtube）—— 搜索、播放，走宿主的解析栈与原生播放器。
//
// ## 这个应用刻意**不做**的事：自己解析取流
//
// YouTube 的取流是持续对抗（客户端选型、visitorData 握手、格式下线），且 >360p 全是
// 音视频分离的 DASH —— WebView 里放不了，纯 JS 也拼不出来。
// 所以播放地址一律经 `aibox.video.resolve` 由宿主给，页面只负责「选哪个清晰度」。
//
// 直接后果是：这个应用能播 1080p60，而一个自己解析的版本只能到 360p。

import React from 'react'
import { useSubpageStack } from 'aibox/ui'
import SearchPage from './components/SearchPage.js'
import PlayerPage from './components/PlayerPage.js'
import MinePage from './components/MinePage.js'
import { THEME_CSS, C } from './components/theme.js'
import { registerActions } from './lib/actions.js'
import type { VideoRoute, VideoSummary } from './lib/types.js'

const bridge = () => (typeof window !== 'undefined' ? window.aibox : undefined)

// 对外提供的 2 个 AI 动作。**模块求值期就注册**：无头执行时页面不挂载任何组件，
// 等 React 副作用就来不及了。
registerActions()

function useTheme() {
  React.useEffect(() => {
    if (!document.getElementById('__yt_css__')) {
      const style = document.createElement('style')
      style.id = '__yt_css__'
      style.textContent = THEME_CSS
      document.head.appendChild(style)
    }
    const query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const apply = () => {
      document.documentElement.setAttribute('data-prefers-color-scheme', query && query.matches ? 'dark' : 'light')
    }
    apply()
    query?.addEventListener?.('change', apply)
    return () => query?.removeEventListener?.('change', apply)
  }, [])
}

const TABS = [
  { id: 'search', label: '搜索' },
  { id: 'mine', label: '我的' },
] as const

type TabID = (typeof TABS)[number]['id']

function isTabID(value: string): value is TabID {
  return TABS.some((item) => item.id === value)
}

/**
 * 底部 Tab。身份在 manifest 里声明（宿主渲染真原生 TabBar），这里只接选中事件。
 * 宿主没渲染出来时回落自绘条——**永远不能只有原生一条路**，否则在不支持的表面上没法切页。
 */
function useTabs(initial: TabID) {
  const [tab, setTab] = React.useState(initial)
  const [native, setNative] = React.useState(false)

  React.useEffect(() => {
    const api = bridge()
    if (!api?.tabs) return undefined
    let off: (() => void) | undefined
    ;(async () => {
      try {
        const state = await api.tabs.getState?.()
        setNative(!!state?.rendered)
        if (state?.selected && isTabID(state.selected)) setTab(state.selected)
      } catch {
        setNative(false)
      }
      try {
        // 事件名是 'changed'，回调收的是整个 State（不是 {id}）。
        off = api.tabs.on?.('changed', (state) => {
          if (state?.selected && isTabID(state.selected)) setTab(state.selected)
          setNative(!!state?.rendered)
        })
      } catch {
        /* 没有事件面就只靠自绘条 */
      }
    })()
    return () => {
      try {
        off?.()
      } catch {
        /* 已卸载 */
      }
    }
  }, [initial])

  const select = React.useCallback((id: TabID) => {
    setTab(id)
    // 桥方法回的是 Promise，同步 try/catch 抓不住 rejection。
    try {
      bridge()
        ?.tabs?.select?.(id)
        ?.catch?.(() => {})
    } catch {
      /* 连命名空间都没有 */
    }
  }, [])

  return { tab, native, select }
}

function FallbackTabBar({ value, onChange }: { value: TabID; onChange: (id: TabID) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        borderTop: `1px solid ${C.line}`,
        background: C.bg,
        paddingBottom: 'env(safe-area-inset-bottom)',
        flexShrink: 0,
      }}
    >
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            padding: '10px 0',
            fontSize: 12,
            color: value === item.id ? C.brand : C.faint,
            fontWeight: value === item.id ? 600 : 400,
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default function App() {
  useTheme()
  const tabs = useTabs('search')
  // 播放页走原生页栈：推入动画、边缘返回手势由宿主给。
  const stack = useSubpageStack<VideoRoute>({
    pathFor: (route) => `#/watch/${route.video.id}`,
    titleFor: (route) => route.video.title || '视频',
  })

  const open = React.useCallback(
    (video: VideoSummary) => {
      stack.push({ video })
    },
    [stack],
  )

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: C.bg,
        color: C.text,
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        {stack.route ? (
          <PlayerPage video={stack.route.video} onOpen={open} />
        ) : tabs.tab === 'mine' ? (
          <MinePage onOpen={open} />
        ) : (
          <SearchPage onOpen={open} />
        )}
      </div>
      {/* 详情页在页栈里时不显示 Tab 条（原生 TabBar 由宿主自己处理显隐） */}
      {!tabs.native && !stack.route ? <FallbackTabBar value={tabs.tab} onChange={tabs.select} /> : null}
    </div>
  )
}
