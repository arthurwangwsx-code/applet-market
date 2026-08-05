// 视频详情页：播放 + 简介 + 分P/合集 + 相关推荐。
//
// ## 播放这条链路的三个关键决定
//
// 1. **不在页面里放 `<video>`。** secure CSP 的 `media-src` 不含 https，放了就是黑屏；
//    退一步就算开 loose 模式，WebView 的媒体一退后台就停、锁屏没有卡片、没有画中画。
//    所以走 `aibox.video.play` 遥控宿主的 AVPlayer（framework-capabilities §3.6 的裁决）。
// 2. **取流用 `fnval=1`（MP4）不是 DASH。** DASH 是音视频分离流，AVPlayer 放不了。
// 3. **续播位置存本地。** 宿主的播放器不知道「这是哪个视频的第几次观看」，
//    所以由本应用按 bvid+cid 记进度，起播时传 `resumeFrom`。

import React from 'react'
import { EmptyState, PrimaryButton, Spinner, StatItem } from './primitives.js'
import VideoCard from './VideoCard.js'
import { C, RADIUS, SPACE } from './theme.js'
import * as api from '../lib/api.js'
import {
  closeStage, copyText, haptic, imageURL, loadPref, onVideoProgress, openInBrowser,
  openStage, playVideo, savePref, share, toast, videoReadiness,
} from '../lib/host.js'
import { formatCount, formatDate, formatDuration } from '../lib/format.js'
import { loadSettings } from '../lib/settings.js'

const PROGRESS_KEY = 'watch-progress'

export default function DetailPage({ bvid, onOpen }) {
  const [detail, setDetail] = React.useState(null)
  const [state, setState] = React.useState('loading')
  const [error, setError] = React.useState('')
  const [relatedList, setRelated] = React.useState([])
  const [activeCid, setActiveCid] = React.useState(0)
  // `null` = 还没探测出来。**别用 true 当初值**：那会让页面先显示「能播」再跳成「不能播」。
  const [videoState, setVideoState] = React.useState(null)
  const playable = videoState?.ok !== false
  const [busy, setBusy] = React.useState(false)
  // 舞台开着时，视频由**宿主**画在页面顶部，页面自己那块封面就该让位——
  // 否则用户会同时看到「上面在放的视频」和「下面一张静止封面」。
  const [stageOn, setStageOn] = React.useState(false)
  const [descOpen, setDescOpen] = React.useState(false)
  const [progress, setProgress] = React.useState(null)

  React.useEffect(() => {
    let alive = true
    setState('loading')
    ;(async () => {
      try {
        const data = await api.videoDetail(bvid)
        if (!alive) return
        setDetail(data)
        setActiveCid(data.cid)
        setState('ready')
        api.related(bvid).then((list) => { if (alive) setRelated(list) })
      } catch (err) {
        if (!alive) return
        setError(String(err?.message || err))
        setState('error')
      }
    })()
    videoReadiness().then((s) => { if (alive) setVideoState(s) })
    return () => { alive = false }
  }, [bvid])

  // 订阅播放进度。三处刻意的节流——事件是 ~2Hz，而这一页下面挂着 20 条相关推荐：
  //
  //  · **按整秒去重再 setState**：进度条精度只到像素，亚秒级更新看不出差别，
  //    却会让整页每秒重渲两次（播放时用户其实在原生全屏播放器里，这些重渲全是白烧）。
  //  · **续播位置只记在 ref 里**，不是每帧都读写 storage —— 那是每秒两个桥往返。
  //  · 真正落盘放在卸载时（下面那个 effect）。
  //
  // 只认 `mine`：用户切去看别的视频时，不能把不相干的进度写到这条记录上。
  const pendingProgress = React.useRef(null)
  React.useEffect(() => {
    let lastWholeSecond = -1
    const off = onVideoProgress((snapshot) => {
      if (!snapshot?.mine) return
      if (snapshot.currentTime > 5 && snapshot.duration > 0) {
        const ratio = snapshot.currentTime / snapshot.duration
        // 快看完了就不记了——否则下次进来会从片尾开始
        pendingProgress.current = {
          key: `${bvid}:${activeCid}`,
          value: ratio > 0.95 ? 0 : Math.floor(snapshot.currentTime),
        }
      }
      const whole = Math.floor(snapshot.currentTime)
      if (whole === lastWholeSecond) return
      lastWholeSecond = whole
      setProgress(snapshot)
    })
    return off
  }, [bvid, activeCid])

  // 续播位置落盘：离开这一页时写一次。读-改-写要合并进已有的表，不能整表覆盖
  // （否则看第二个视频就会把第一个的进度抹掉）。
  React.useEffect(() => () => {
    const pending = pendingProgress.current
    if (!pending) return
    loadPref(PROGRESS_KEY, {})
      .then((all) => savePref(PROGRESS_KEY, { ...(all || {}), [pending.key]: pending.value }))
      .catch(() => { /* 存不住续播位置不值得打扰用户，也不该变成未处理拒绝 */ })
  }, [])

  // 离开这一页就收起视频区（不停播——转画中画或后台听声都是用户可能想要的）。
  React.useEffect(() => () => { closeStage() }, [])

  const play = React.useCallback(async (cid) => {
    if (!detail || busy) return
    setBusy(true)
    haptic('medium')
    try {
      // **先开舞台再播**：舞台开着时宿主把播放器嵌在页面顶部（保持竖屏、内容照常滚），
      // 否则会接管整屏并转横屏。开舞台是幂等的，重复调只更新参数。
      // 每次起播都重读偏好：用户可能刚在「我的」里改过，不该等重进页面才生效。
      const stage = await openStage(await loadSettings())
      setStageOn(!!stage?.rendered)
      const targetCid = cid || activeCid || detail.cid
      const stream = await api.playURL(bvid, targetCid)
      const saved = await loadPref(PROGRESS_KEY, {})
      const resumeFrom = Number(saved?.[`${bvid}:${targetCid}`]) || 0
      const part = detail.pages.find((p) => p.cid === targetCid)
      await playVideo({
        url: stream.url,
        title: part && detail.pages.length > 1 ? `${detail.title} · ${part.title}` : detail.title,
        resumeFrom,
      })
      setActiveCid(targetCid)
    } catch (err) {
      toast(`播放失败：${err?.message || err}`)
    } finally {
      setBusy(false)
    }
  }, [detail, bvid, activeCid, busy])

  if (state === 'loading') return <Spinner />
  if (state === 'error') {
    return <EmptyState title="打不开这个视频" detail={error} actionLabel="用浏览器打开"
      onAction={() => openInBrowser(`https://www.bilibili.com/video/${bvid}`)} />
  }

  const url = `https://www.bilibili.com/video/${bvid}`

  return (
    <div className="bl-scroll" style={{ height: '100%', overflowY: 'auto', background: C.bg }}>
      {/* 封面 + 播放键。舞台开着时整块隐藏——真正的画面在宿主画的视频区里。 */}
      {stageOn ? null : (
      <div
        onClick={() => playable && play()}
        style={{
          position: 'relative', width: '100%', aspectRatio: '16 / 9',
          background: C.surface, overflow: 'hidden',
        }}
      >
        {detail.cover ? (
          <img src={imageURL(detail.cover, 400)} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : null}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.25)',
        }}>
          <div style={{
            width: 58, height: 58, borderRadius: 29,
            background: 'rgba(0,0,0,0.5)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>
            {busy ? '···' : '▶'}
          </div>
        </div>
        {progress?.mine && progress.duration > 0 ? (
          <div style={{
            position: 'absolute', left: 0, bottom: 0, height: 3,
            width: `${Math.min(100, (progress.currentTime / progress.duration) * 100)}%`,
            background: C.brand,
          }} />
        ) : null}
      </div>
      )}

      {videoState && !videoState.ok ? (
        <div style={{ padding: SPACE.s3, background: C.brandDim, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
          {videoState.reason === 'noBridge'
            ? '这个 App 版本还没有视频播放桥（aibox.video）。需要重新构建安装 App 本体，'
              + '换小应用版本没用。'
            : '这个 App 构建没有链入视频播放器模块（MODULE_VIDEOPLAYER），播不了。'}
          <br />
          只能先用浏览器打开。
        </div>
      ) : null}

      <div style={{ padding: SPACE.s4 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>
          {detail.title}
        </div>
        <div style={{ fontSize: 12, color: C.faint, marginTop: SPACE.s2 }}>
          {formatCount(detail.play)}观看 · {formatDate(detail.pubdate)}
        </div>

        {/* UP 主 */}
        <div
          className="bl-press"
          onClick={() => openInBrowser(`https://space.bilibili.com/${detail.mid}`)}
          style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, marginTop: SPACE.s4 }}
        >
          {detail.avatar ? (
            <img src={imageURL(detail.avatar, 36)} alt=""
              style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover', background: C.surface }} />
          ) : null}
          <div style={{ fontSize: 14, color: C.text }}>{detail.author}</div>
        </div>

        {/* 统计 */}
        <div style={{
          display: 'flex', marginTop: SPACE.s4, padding: `${SPACE.s3}px 0`,
          borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`,
        }}>
          <StatItem label="点赞" value={formatCount(detail.like)} />
          <StatItem label="投币" value={formatCount(detail.coin)} />
          <StatItem label="收藏" value={formatCount(detail.favorite)} />
          <StatItem label="评论" value={formatCount(detail.reply)} />
        </div>

        {/* 简介：默认折叠，长简介会把整页推得很长 */}
        {detail.desc ? (
          <div
            onClick={() => setDescOpen((v) => !v)}
            style={{
              marginTop: SPACE.s3, fontSize: 13, color: C.sub, lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: descOpen ? 'none' : 60, overflow: 'hidden',
            }}
          >
            {detail.desc}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: SPACE.s2, marginTop: SPACE.s4 }}>
          <PrimaryButton onClick={() => play()} disabled={!playable || busy}>
            {busy ? '正在准备…' : '播放'}
          </PrimaryButton>
          <button
            type="button"
            onClick={async () => { await copyText(url); toast('链接已复制') }}
            style={{
              border: `1px solid ${C.line}`, background: 'transparent', color: C.sub,
              borderRadius: RADIUS.md, padding: `0 ${SPACE.s4}px`, fontSize: 14, flexShrink: 0,
            }}
          >
            复制
          </button>
          <button
            type="button"
            onClick={() => share(detail.title, url)}
            style={{
              border: `1px solid ${C.line}`, background: 'transparent', color: C.sub,
              borderRadius: RADIUS.md, padding: `0 ${SPACE.s4}px`, fontSize: 14, flexShrink: 0,
            }}
          >
            分享
          </button>
        </div>
      </div>

      {/* 分P / 合集 */}
      {detail.pages.length > 1 ? (
        <div style={{ paddingBottom: SPACE.s3 }}>
          <div style={{ padding: `0 ${SPACE.s4}px ${SPACE.s2}px`, fontSize: 13, fontWeight: 600, color: C.sub }}>
            选集（{detail.pages.length}）
          </div>
          <div className="bl-scroll" style={{ display: 'flex', gap: SPACE.s2, overflowX: 'auto', padding: `0 ${SPACE.s4}px` }}>
            {detail.pages.map((part) => (
              <button
                key={part.cid}
                type="button"
                onClick={() => play(part.cid)}
                style={{
                  flexShrink: 0, maxWidth: 160, textAlign: 'left',
                  border: 'none', borderRadius: RADIUS.md, padding: SPACE.s2,
                  background: part.cid === activeCid ? C.brandDim : C.surface,
                  color: part.cid === activeCid ? C.brand : C.text, fontSize: 12,
                }}
              >
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  P{part.page} {part.title}
                </div>
                <div style={{ color: C.faint, marginTop: 2 }}>{formatDuration(part.duration)}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 相关推荐。这里刻意不用虚拟列表：最多 40 条且在滚动容器末尾，
          再套一层虚拟滚动反而要处理嵌套滚动，得不偿失。 */}
      {relatedList.length ? (
        <div style={{ borderTop: `8px solid ${C.surface}`, paddingTop: SPACE.s2 }}>
          <div style={{ padding: `${SPACE.s2}px ${SPACE.s4}px`, fontSize: 13, fontWeight: 600, color: C.sub }}>
            相关推荐
          </div>
          {relatedList.slice(0, 20).map((video) => (
            <VideoCard key={video.bvid} video={video} onOpen={onOpen} />
          ))}
        </div>
      ) : null}
      <div style={{ height: SPACE.s6 }} />
    </div>
  )
}
