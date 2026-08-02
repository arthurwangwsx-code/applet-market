// 对外动作（AI / 自动化 / 快捷指令可调用）。
//
// 刻意**不**重复宿主已有的 19 个 `music_*` 工具——那些是原生 AiBoxMusicKit 提供的，
// 重复声明只会造成重名混淆。这里只声明「宿主工具覆盖不到」的编排型能力：
//  · nowPlayingSummary —— 一次调用拿到 状态 + 队列摘要 + 定时器 + 歌词可用性（省 3 趟工具调用）
//  · playMostPlayed    —— 按**本应用自己的播放历史**排名起播（没有任何宿主工具能读播放历史）
//  · resumeLast        —— 回到本应用记的上次播放位置（没有任何宿主工具能读它）
//
// 硬要求：全部 **headless 可跑** —— 只依赖 `aibox.music.*` 与 `aibox.storage`，
// 不读任何 React state；「歌词当前行」这类依赖页面内存的，直接如实回 null 并说明原因。

import { music as callMusic, storage } from './host.js'
import { readLyricsPayload, currentLineIndex } from './lyrics.js'
import { playArgs } from './format.js'

async function readStatus() {
  const result = await callMusic('status', {})
  return (result.ok && result.json) ? result.json : null
}

/** 当前播放摘要。read / idempotent / headless。 */
export async function nowPlayingSummary() {
  const [statusResult, queueResult, timerResult] = await Promise.all([
    callMusic('status', {}),
    callMusic('queue', { action: 'list' }),
    callMusic('sleepTimer', { action: 'status' }),
  ])
  const status = (statusResult.ok && statusResult.json) ? statusResult.json : null
  if (!status) {
    return { ok: false, message: statusResult.error || 'Music engine unavailable.' }
  }
  const rows = Array.isArray(queueResult.json) ? queueResult.json : []
  const index = Number(status.currentIndex)
  const upNext = rows
    .filter((row) => Number(row.index) > index)
    .slice(0, 5)
    .map((row) => ({ title: row.title, artist: row.artist || null, index: row.index }))

  let lyrics = { available: false, synced: false, currentLine: null, note: null }
  if (status.currentTrack) {
    const payload = readLyricsPayload(await callMusic('lyrics', {}))
    const line = payload.synced
      ? currentLineIndex(payload.lines, Number(status.currentTime) || 0)
      : -1
    lyrics = {
      available: payload.state === 'ok',
      synced: payload.synced,
      currentLine: line >= 0 ? payload.lines[line].text : null,
      // 如实说明：宿主 `music_lyrics` 返回的是剥掉时间轴的纯文本，所以当前行通常拿不到。
      note: payload.synced ? null : 'The host returns lyrics without a timeline, so the current line is unknown.',
    }
  }

  return {
    ok: true,
    isPlaying: !!status.isPlaying,
    playbackState: status.playbackState || 'idle',
    track: status.currentTrack || null,
    positionSeconds: Math.max(0, Math.floor(Number(status.currentTime) || 0)),
    durationSeconds: Math.max(0, Math.floor(Number(status.duration) || 0)),
    queueCount: Number(status.queueCount) || 0,
    currentIndex: Number.isFinite(index) ? index : -1,
    upNext,
    repeatMode: status.repeatMode || 'off',
    isShuffled: !!status.isShuffled,
    volume: Number(status.volume),
    sleepTimer: timerResult.ok ? String(timerResult.text || '').trim() : null,
    lyrics,
  }
}

/** 按本应用的播放历史排名起播。write / mediaPlayback / headless。 */
export async function playMostPlayed(input) {
  const limit = Math.max(1, Math.min(50, Number(input && input.limit) || 20))
  const history = await storage.get('music.playHistory')
  const rows = Array.isArray(history) ? history.filter((row) => row && row.track) : []
  if (rows.length === 0) {
    return { ok: false, queued: 0, startedWith: null, message: 'No play history yet — play something first.' }
  }
  const ranked = rows
    .slice()
    .sort((a, b) => (b.count - a.count) || (b.lastPlayed - a.lastPlayed))
    .slice(0, limit)
    .map((row) => playArgs(row.track))
  const first = ranked[0]
  const result = await callMusic('play', { ...first, queue: ranked })
  return {
    ok: result.ok,
    queued: result.ok ? ranked.length : 0,
    startedWith: result.ok ? (first.title || null) : null,
    message: result.ok ? `Playing ${ranked.length} most-played tracks.` : String(result.error || 'Playback failed.'),
  }
}

/** 接着上次继续听。write / mediaPlayback / headless。 */
export async function resumeLast() {
  const ui = await storage.get('music.uiState')
  const track = ui && ui.lastTrack
  if (!track || !track.title) {
    return { ok: false, track: null, positionSeconds: 0, message: 'No previous track recorded.' }
  }
  const position = Math.max(0, Math.floor(Number(ui.lastPosition) || 0))

  // 已经在放同一首就只补 seek，不重新起播（重新起播会打断，且会重置队列）。
  const status = await readStatus()
  const same = status && status.currentTrack
    && (String(status.currentTrack.musicItemId || status.currentTrack.url || '')
      === String(track.musicItemId || track.url || ''))
  if (same) {
    if (position > 1) await callMusic('seek', { seconds: position })
    if (!status.isPlaying) await callMusic('transport', { action: 'resume' })
    return { ok: true, track, positionSeconds: position, message: 'Resumed the current track.' }
  }

  const result = await callMusic('play', playArgs(track))
  if (!result.ok) {
    return { ok: false, track, positionSeconds: position, message: String(result.error || 'Playback failed.') }
  }
  if (position > 1) await callMusic('seek', { seconds: position })
  return { ok: true, track, positionSeconds: position, message: `Resumed “${track.title}” at ${position}s.` }
}

/** manifest.actions 里声明的 name → 处理器。app.jsx 启动时逐个 register。 */
export const ACTION_HANDLERS = {
  nowPlayingSummary,
  playMostPlayed,
  resumeLast,
}
