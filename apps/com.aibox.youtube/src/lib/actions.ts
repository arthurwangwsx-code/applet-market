// 对外提供的 2 个 AI 动作（search / play）。
//
// `play` 的实现值得说明：它**不自己解析取流**，而是走宿主的 `aibox.video.resolve` + `play`。
// YouTube 的取流是持续对抗（客户端选型、握手 token 每周都在变），把它留在宿主里，
// 一次升级所有消费方同时受益。

import * as innertube from './innertube.js'
import { capabilities, play as hostPlay, resolve } from './host.js'
import type { JSONValue } from '@aibox/applet-sdk'
import { errorMessage, isRecord } from './types.js'

async function search(input: JSONValue): Promise<JSONValue> {
  const query = isRecord(input) ? input.query : ''
  const limit = isRecord(input) ? input.limit : 10
  const q = String(query || '').trim()
  if (!q) return { ok: false, error: 'query is required', text: '需要一个搜索关键词。' }
  try {
    const list = await innertube.search(q)
    const videos = list.slice(0, Math.min(Math.max(1, Number(limit) || 10), 20))
    return {
      ok: true,
      videos: videos.map((v) => ({
        id: v.id,
        title: v.title,
        author: v.author,
        duration: v.durationLabel,
        views: v.viewLabel,
        url: v.url,
      })),
      text: videos.length
        ? videos.map((v, i) => `${i + 1}. ${v.title} — ${v.author}（${v.id}）`).join('\n')
        : `没有搜到与「${q}」相关的视频。`,
    }
  } catch (err: unknown) {
    const message = errorMessage(err)
    return { ok: false, error: message, text: `搜索失败：${message}` }
  }
}

async function play(input: JSONValue): Promise<JSONValue> {
  const url = isRecord(input) ? input.url : ''
  const videoId = isRecord(input) ? input.videoId : ''
  const target =
    String(url || '').trim() || (videoId ? `https://www.youtube.com/watch?v=${String(videoId).trim()}` : '')
  if (!target) return { ok: false, error: 'url or videoId is required', text: '需要一个视频链接或 id。' }

  const caps = await capabilities()
  if (!caps.available) {
    return { ok: false, error: 'no video engine', text: '这个版本没有装视频引擎，播放不了。' }
  }
  if (!caps.resolve) {
    return { ok: false, error: 'no extractor', text: '这个版本没有媒体解析能力，播放不了 YouTube。' }
  }
  try {
    const media = await resolve(target)
    const playable = (media.formats || []).filter((format) => format.playable !== false)
    const firstPlayable = playable[0]
    if (!firstPlayable) {
      return {
        ok: false,
        error: 'no playable format',
        text: caps.dash ? '这个视频没有可播放的清晰度。' : '这个视频只有分离流，而当前版本没有编入合流能力。',
      }
    }
    await hostPlay({ sourceURL: target, formatID: firstPlayable.id })
    return {
      ok: true,
      video: {
        title: media.title || '',
        uploader: media.uploader || '',
        quality: firstPlayable.quality || '',
      },
      text: `正在播放《${media.title || ''}》（${firstPlayable.quality || ''}）。`,
    }
  } catch (err: unknown) {
    const message = errorMessage(err)
    return { ok: false, error: message, text: `播放失败：${message}` }
  }
}

export function registerActions() {
  const api = typeof window !== 'undefined' ? window.aibox : undefined
  if (!api?.action?.register) return false
  api.action.register('search', search)
  api.action.register('play', play)
  return true
}
