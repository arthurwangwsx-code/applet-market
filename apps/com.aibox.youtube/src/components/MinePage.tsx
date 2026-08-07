// 「我的」：观看历史 + 播放设置。
//
// 这个应用**没有登录**（YouTube 要 Google OAuth，需要跳外部网页，而容器的导航白名单
// 只放行 `applet://`），所以这一页不是账号页，而是「我看过什么」+「播放怎么表现」。

import React from 'react'
import VideoCard from './VideoCard.js'
import { EmptyState, SectionTitle, SettingSwitch } from './primitives.js'
import { C, SPACE } from './theme.js'
import { loadPref, savePref } from '../lib/host.js'
import { DEFAULTS, loadSettings, updateSetting } from '../lib/settings.js'
import type { VideoSummary } from '../lib/types.js'

const HISTORY_KEY = 'watch-history'

export default function MinePage({ onOpen }: { onOpen: (video: VideoSummary) => void }) {
  const [history, setHistory] = React.useState<VideoSummary[]>([])
  const [settings, setSettings] = React.useState(DEFAULTS)

  React.useEffect(() => {
    loadPref<VideoSummary[]>(HISTORY_KEY, []).then(setHistory)
    loadSettings().then(setSettings)
  }, [])

  return (
    <div className="yt-scroll" style={{ height: '100%', overflowY: 'auto', background: C.bg }}>
      <SectionTitle>最近观看</SectionTitle>
      {history.length === 0 ? (
        <EmptyState title="还没有观看记录" detail="搜索并播放一个视频后会出现在这里。" />
      ) : (
        <>
          {history.slice(0, 30).map((v) => (
            <VideoCard key={v.id} video={v} onOpen={onOpen} />
          ))}
          <div style={{ padding: `${SPACE.s2}px ${SPACE.s4}px` }}>
            <button
              type="button"
              onClick={() => {
                setHistory([])
                savePref(HISTORY_KEY, [])
              }}
              style={{
                border: `1px solid ${C.line}`,
                background: 'transparent',
                color: C.sub,
                borderRadius: 10,
                padding: `7px ${SPACE.s4}px`,
                fontSize: 13,
              }}
            >
              清空记录
            </button>
          </div>
        </>
      )}

      <div style={{ borderTop: `8px solid ${C.surface}` }}>
        <SectionTitle>播放设置</SectionTitle>
        <SettingSwitch
          title="后台播放音频"
          detail="退出应用或回到桌面后，画面暂停但声音继续 —— 想「听视频」时用。"
          value={settings.backgroundAudio}
          onChange={async (v) => setSettings(await updateSetting('backgroundAudio', v))}
        />
        <SettingSwitch
          title="画中画"
          detail="离开应用后保留一个浮窗继续播。与上一项不同：这个留画面、会占住屏幕一角。"
          value={settings.pictureInPicture}
          onChange={async (v) => setSettings(await updateSetting('pictureInPicture', v))}
        />
        <SettingSwitch
          title="手势控制"
          detail="在画面左半边上下滑调亮度、右半边调音量，双击暂停或继续。"
          value={settings.gestureControls}
          onChange={async (v) => setSettings(await updateSetting('gestureControls', v))}
        />
        <div
          style={{
            padding: `${SPACE.s2}px ${SPACE.s4}px ${SPACE.s4}px`,
            fontSize: 11,
            color: C.faint,
            lineHeight: 1.6,
          }}
        >
          改动在下一次点播放时生效。视频在页面顶部内嵌播放、保持竖屏； 要横屏点播放器右下角的全屏按钮。
        </div>
      </div>
      <div style={{ height: SPACE.s6 }} />
    </div>
  )
}
