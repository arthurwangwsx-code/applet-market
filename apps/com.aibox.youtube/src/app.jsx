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
import SearchPage from './components/SearchPage.jsx'
import PlayerPage from './components/PlayerPage.jsx'
import { THEME_CSS, C } from './components/theme.js'
import { registerActions } from './lib/actions.js'

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
      document.documentElement.setAttribute(
        'data-prefers-color-scheme', query && query.matches ? 'dark' : 'light')
    }
    apply()
    query?.addEventListener?.('change', apply)
    return () => query?.removeEventListener?.('change', apply)
  }, [])
}

export default function App() {
  useTheme()
  // 播放页走原生页栈：推入动画、边缘返回手势由宿主给。
  const stack = useSubpageStack({
    pathFor: (route) => `#/watch/${route.video.id}`,
    titleFor: (route) => route.video.title || '视频',
  })

  const open = React.useCallback((video) => {
    stack.push({ video })
  }, [stack])

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: C.bg, color: C.text, overflow: 'hidden',
    }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        {stack.route
          ? <PlayerPage video={stack.route.video} onOpen={open} />
          : <SearchPage onOpen={open} />}
      </div>
    </div>
  )
}
