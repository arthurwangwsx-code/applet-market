// 「我的」：扫码登录 + 登录后的观看历史。
//
// ## 登录这条链路的形状
//
// 1. `qrcode/generate` 拿到一个一次性 URL；
// 2. 用 `qrURL()` 在**本地**渲染成二维码（内容不出设备 —— 绝不能调第三方二维码服务，
//    那个 URL 谁拿到谁就能登录这个账号）；
// 3. 每 2 秒 `qrcode/poll` 一次；
// 4. 成功时 B 站在**响应头**下发 SESSDATA 等 cookie，宿主的 per-applet cookie 罐自动收下。
//    所以这里没有一行解析 Set-Cookie 的代码 —— 那本来就不该由页面做（多值 Set-Cookie
//    在响应头字典里已被合并成不可靠拆分的逗号串）。
//
// 同一台手机上扫自己屏幕上的码是不行的，所以页面明说：用另一台设备扫，或长按存图后在 B 站 App 里扫。

import React from 'react'
import * as ui from 'aibox/ui'
import { EmptyState, PrimaryButton, SectionTitle, SettingSwitch, Spinner } from './primitives.jsx'
import VideoCard from './VideoCard.jsx'
import { C, RADIUS, SPACE } from './theme.js'
import * as api from '../lib/api.js'
import {
  clearSession, hasSession, imageURL, secretsWritable, toast,
} from '../lib/host.js'
import { formatCount } from '../lib/format.js'
import { DEFAULTS, loadSettings, updateSetting } from '../lib/settings.js'

const POLL_MS = 2000

/**
 * `qrURL` 是 `aibox/ui` **1.3.0** 才有的导出，而市场包会被装到**别人的宿主**上。
 *
 * 所以这里必须是 namespace import + 运行时探测：ESM 的具名导入在导出不存在时会在**链接阶段**
 * 直接报错，整个应用连挂载都到不了 —— 一个「二维码画不出来」的降级，会变成「应用打不开」。
 *
 * 回退实现拼的是同一条 `applet://qr/` URL：老宿主没有那条路由，`<img>` 拿到 404，
 * 页面显示的是「二维码没画出来」而不是白屏——这才是正确的降级形状。
 */
const qrURL = typeof ui.qrURL === 'function'
  ? ui.qrURL
  : (content, options) => {
    const bytes = new TextEncoder().encode(String(content || ''))
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const size = Number((options || {}).size)
    return `applet://localhost/qr/${encoded}${size > 0 ? `?size=${Math.round(size)}` : ''}`
  }

export default function MinePage({ onOpen }) {
  const [phase, setPhase] = React.useState('checking')  // checking | guest | qr | signedIn
  const [user, setUser] = React.useState(null)
  const [qr, setQR] = React.useState(null)              // { url, key }
  const [hint, setHint] = React.useState('')
  const [historyList, setHistory] = React.useState([])
  const [canPersist, setCanPersist] = React.useState(true)
  const [settings, setSettings] = React.useState(DEFAULTS)
  const pollTimer = React.useRef(null)

  const refresh = React.useCallback(async () => {
    setPhase('checking')
    // 真值是「罐里有没有 cookie」+「nav 认不认」。**不自己记 isLoggedIn 标志**：
    // cookie 会过期而标志不会，漂移后用户会看到「显示已登录但全是未登录数据」。
    const has = await hasSession()
    if (!has) { setPhase('guest'); return }
    try {
      const me = await api.me()
      if (!me) { setPhase('guest'); return }
      setUser(me)
      setPhase('signedIn')
      api.history().then(setHistory).catch(() => setHistory([]))
    } catch {
      setPhase('guest')
    }
  }, [])

  React.useEffect(() => {
    refresh()
    secretsWritable().then(setCanPersist)
    loadSettings().then(setSettings)
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [refresh])

  const startLogin = React.useCallback(async () => {
    try {
      const code = await api.loginQRCode()
      setQR(code)
      setHint('用另一台设备上的哔哩哔哩 App 扫码')
      setPhase('qr')
      if (pollTimer.current) clearInterval(pollTimer.current)
      pollTimer.current = setInterval(async () => {
        try {
          const res = await api.loginPoll(code.key)
          setHint(res.message)
          if (res.status === 'ok') {
            clearInterval(pollTimer.current)
            pollTimer.current = null
            toast('登录成功')
            refresh()
          } else if (res.status === 'expired') {
            clearInterval(pollTimer.current)
            pollTimer.current = null
          }
        } catch { /* 单次轮询失败不中断，下一拍再试 */ }
      }, POLL_MS)
    } catch (err) {
      toast(`拿不到二维码：${err?.message || err}`)
    }
  }, [refresh])

  const signOut = React.useCallback(async () => {
    await clearSession()
    setUser(null)
    setHistory([])
    setPhase('guest')
    toast('已退出登录')
  }, [])


  /** 播放设置。**登录与否都显示** —— 这些偏好和账号无关，
   *  而未登录恰恰是用户最可能第一次翻到这一页的时候。 */
  const settingsSection = (
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
      <div style={{
        padding: `${SPACE.s2}px ${SPACE.s4}px ${SPACE.s4}px`,
        fontSize: 11, color: C.faint, lineHeight: 1.6,
      }}>
        改动在下一次点播放时生效。视频在页面顶部内嵌播放、保持竖屏；
        要横屏点播放器右下角的全屏按钮。
      </div>
    </div>
  )

  if (phase === 'checking') return <Spinner label="检查登录状态" />

  if (phase === 'qr' && qr) {
    return (
      <div style={{ padding: SPACE.s5, textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', padding: SPACE.s4,
          background: '#fff', borderRadius: RADIUS.lg,
        }}>
          {/* 白底是必需的：二维码在暗色背景上扫不出来 */}
          <img src={qrURL(qr.url, { size: 220, level: 'M' })} alt="登录二维码"
            style={{ width: 220, height: 220, display: 'block' }} />
        </div>
        <div style={{ marginTop: SPACE.s4, fontSize: 14, color: C.text }}>{hint}</div>
        <div style={{ marginTop: SPACE.s2, fontSize: 12, color: C.faint, lineHeight: 1.6 }}>
          同一台手机没法扫自己的屏幕。<br />
          可以长按二维码存进相册，再用哔哩哔哩 App 从相册识别。
        </div>
        <div style={{ marginTop: SPACE.s5, display: 'flex', gap: SPACE.s2 }}>
          <PrimaryButton onClick={startLogin}>换一个二维码</PrimaryButton>
          <button
            type="button"
            onClick={() => { if (pollTimer.current) clearInterval(pollTimer.current); setPhase('guest') }}
            style={{
              border: `1px solid ${C.line}`, background: 'transparent', color: C.sub,
              borderRadius: RADIUS.md, padding: `0 ${SPACE.s4}px`, fontSize: 14, flexShrink: 0,
            }}
          >
            取消
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'guest') {
    return (
      <div className="bl-scroll" style={{ height: '100%', overflowY: 'auto' }}>
        <EmptyState
          title="还没有登录"
          detail={'登录后可以看观看历史、个性化推荐和更高的清晰度。'
            + (canPersist ? '' : '\n注意：这个构建存不住登录态（未签名的模拟器构建），下次启动要重新登录。')}
          actionLabel="扫码登录"
          onAction={startLogin}
        />
        {settingsSection}
        <div style={{ height: SPACE.s6 }} />
      </div>
    )
  }

  return (
    <div className="bl-scroll" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s4 }}>
        {user?.avatar ? (
          <img src={imageURL(user.avatar, 52)} alt=""
            style={{ width: 52, height: 52, borderRadius: 26, objectFit: 'cover', background: C.surface }} />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, color: C.text, fontWeight: 500 }}>{user?.name}</div>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>
            LV{user?.level} · {formatCount(user?.coins || 0)}硬币
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          style={{
            border: `1px solid ${C.line}`, background: 'transparent', color: C.sub,
            borderRadius: RADIUS.md, padding: `6px ${SPACE.s3}px`, fontSize: 13,
          }}
        >
          退出
        </button>
      </div>

      <div style={{ borderTop: `8px solid ${C.surface}`, paddingTop: SPACE.s2 }}>
        <div style={{ padding: `${SPACE.s2}px ${SPACE.s4}px`, fontSize: 13, fontWeight: 600, color: C.sub }}>
          观看历史
        </div>
        {historyList.length === 0 ? (
          <EmptyState title="还没有观看记录" />
        ) : (
          historyList.map((video) => <VideoCard key={video.bvid} video={video} onOpen={onOpen} />)
        )}
      </div>

      {settingsSection}
      <div style={{ height: SPACE.s6 }} />
    </div>
  )
}
