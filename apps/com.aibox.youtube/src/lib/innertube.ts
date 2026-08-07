// YouTube 数据层：InnerTube（youtube.com/youtubei/v1）。
//
// ## 为什么是 InnerTube 而不是官方 Data API v3
//
// Data API 要用户自己申请 key，且配额是 10000 units/日、一次 `search.list` 就吃掉 100 ——
// 一天只能搜 100 次。对「刷着玩」的场景等于不可用。InnerTube 是 YouTube 网页端自己在用的接口，
// 免 key、无配额。
//
// ## 两条实测纪律
//
// 1. **`clientVersion` 必须是近期的**。实测 `2.20240101.00.00` 返回一个 2KB 的空壳（HTTP 200，
//    但没有任何结果），换成近期版本就正常。这是最容易误判成「接口废了」的地方。
// 2. **响应体很大**（一次搜索 450–520KB）。`net.fetch` 默认上限 200KB 会**静默截断**，
//    必须显式抬高 maxBytes，否则拿到的 JSON 断在半截、解析直接失败。
//
// **取流不在这里**：拿播放地址走宿主的 `aibox.video.resolve`（它内部有完整的客户端选型与握手），
// 小应用不重造那一套 —— 那是会随 YouTube 对抗策略每周失效的东西。

import { fetchJSON } from './host.js'
import { isRecord } from './types.js'
import type { VideoSummary, YouTubeLocale } from './types.js'

const BASE = 'https://www.youtube.com/youtubei/v1'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** 客户端上下文。`hl`/`gl` 决定返回语言与地区。 */
function context(locale?: YouTubeLocale) {
  return {
    client: {
      clientName: 'WEB',
      // 见文件头纪律 1：这个版本号老了会拿到空结果。
      clientVersion: '2.20241211.01.00',
      hl: locale?.hl || 'zh-CN',
      gl: locale?.gl || 'HK',
    },
  }
}

async function post(path: string, body: Record<string, unknown>, locale?: YouTubeLocale): Promise<unknown> {
  const res = await fetchJSON<unknown>(`${BASE}/${path}?prettyPrint=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ context: context(locale), ...body }),
    // 见文件头纪律 2：默认 200KB 会把搜索结果切断。
    maxBytes: 4 * 1024 * 1024,
  })
  if (!res) throw new Error('YouTube 没有返回数据')
  return res
}

/**
 * 从任意深度的响应里收集某个 renderer。
 *
 * InnerTube 的响应结构**没有稳定契约**：同一份数据可能在 `twoColumnSearchResultsRenderer`
 * 下面，也可能在 `sectionListRenderer` / `richItemRenderer` 里，且会随改版挪位置。
 * 按固定路径取值是这条链路上最脆的写法，所以这里按 key 深度收集。
 */
function collect(node: unknown, key: string, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) collect(item, key, out)
    return out
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === key && isRecord(v)) out.push(v)
    else collect(v, key, out)
  }
  return out
}

/** `{runs:[{text}]}` 或 `{simpleText}` → 纯文本。两种形态在同一份响应里混用。 */
function text(node: unknown): string {
  if (!isRecord(node)) return ''
  if (typeof node.simpleText === 'string') return node.simpleText
  if (Array.isArray(node.runs)) {
    return node.runs.map((run) => (isRecord(run) && typeof run.text === 'string' ? run.text : '')).join('')
  }
  return ''
}

/** "3:10:59" / "12:34" → 秒。 */
function durationSeconds(label: string): number {
  if (!label) return 0
  return String(label)
    .split(':')
    .map((n) => parseInt(n, 10) || 0)
    .reduce((acc, part) => acc * 60 + part, 0)
}

/**
 * 缩略图 URL。
 *
 * **刻意不用响应里给的那条**：那是形如 `hq720.jpg?sqp=…&rs=…&usqp=…` 的**带签名**地址，
 * 会过期，而且长到 base64 进 `applet://image/` 后 URL 相当可观。
 * `i.ytimg.com/vi/<id>/hqdefault.jpg` 是稳定地址，对每个公开视频都存在。
 */
function thumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

/** 一条视频的统一投影。 */
function normalize(renderer: Record<string, unknown>): VideoSummary | null {
  const id = typeof renderer.videoId === 'string' ? renderer.videoId : ''
  if (!id) return null
  return {
    id,
    title: text(renderer.title),
    author: text(renderer.ownerText) || text(renderer.shortBylineText),
    cover: thumbnail(id),
    durationLabel: text(renderer.lengthText),
    duration: durationSeconds(text(renderer.lengthText)),
    viewLabel: text(renderer.viewCountText) || text(renderer.shortViewCountText),
    published: text(renderer.publishedTimeText),
    url: `https://www.youtube.com/watch?v=${id}`,
  }
}

/** 搜索。回视频列表。 */
export async function search(query: string, locale?: YouTubeLocale): Promise<VideoSummary[]> {
  const json = await post('search', { query: String(query || '').trim() }, locale)
  return collect(json, 'videoRenderer')
    .map(normalize)
    .filter((video): video is VideoSummary => video !== null)
}

/**
 * 搜索建议。走 suggestqueries（不是 InnerTube），返回 JSONP，需要自己剥壳。
 * 失败一律回空数组——建议是锦上添花，不该让搜索框开不了。
 */
export async function suggest(prefix: string, _locale?: YouTubeLocale): Promise<string[]> {
  const q = String(prefix || '').trim()
  if (!q) return []
  try {
    const raw = await fetchJSON<string>(
      `https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': UA }, responseType: 'text' },
    )
    // 形如 `window.google.ac.h([" q",[["s1",0],["s2",0]]])`
    const start = String(raw).indexOf('(')
    const end = String(raw).lastIndexOf(')')
    if (start < 0 || end <= start) return []
    const parsed: unknown = JSON.parse(String(raw).slice(start + 1, end))
    const candidates = Array.isArray(parsed) && Array.isArray(parsed[1]) ? parsed[1] : []
    return candidates
      .map((entry) => (Array.isArray(entry) ? entry[0] : undefined))
      .filter((suggestion): suggestion is string => typeof suggestion === 'string')
  } catch {
    return []
  }
}
