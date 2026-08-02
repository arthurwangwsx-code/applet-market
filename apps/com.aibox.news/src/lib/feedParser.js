// FeedParser 的移植：RSS 2.0 / RDF(RSS 1.0) / Atom 三格式统一解析成文章数组。
// 原生用 XMLParser（SAX，shouldProcessNamespaces=false）；这里用浏览器内建 DOMParser，
// 但**刻意复刻 SAX 的事件顺序与缓冲语义**：
//   · 前序处理属性（Atom <link href>、<enclosure url>、<media:* url>）；
//   · 后序处理文本，且元素的「文本」只取**最后一个子元素之后**的文本节点
//     —— 这正是 SAX 缓冲在 didEndElement 时刻的内容（每个 start/end 都会清空缓冲）。
// 不支持 JSON Feed（与原生一致；JSON 只走 NewsData.io 那条路径）。

import { plain, firstImageURL, stableKey } from './text.js'
import { parseDate } from './dates.js'

export const MAX_ITEMS_PER_FEED = 60

function tailText(element) {
  let buffer = ''
  for (const node of element.childNodes) {
    if (node.nodeType === 1) buffer = ''
    else if (node.nodeType === 3 || node.nodeType === 4) buffer += node.nodeValue || ''
  }
  return buffer.trim()
}

function emptyItem() {
  return { title: '', link: '', summary: '', content: '', author: '', date: '', category: '', guid: '', image: '' }
}

function parseXML(xml) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const failed = doc.getElementsByTagName('parsererror').length > 0
  return failed ? null : doc
}

/**
 * 桥的响应体上限是 200KB，超长 feed 会被**截断**成不闭合的 XML。
 * 这里把内容剪到最后一条完整的 item/entry，再补上闭合标签重试一次——
 * 否则一个大 feed 会整份丢失（而不是少几条）。
 */
function repairTruncatedXML(xml) {
  const lower = xml.toLowerCase()
  const candidates = [
    { close: '</item>', tail: '</channel></rss>' },
    { close: '</entry>', tail: '</feed>' },
  ]
  for (const { close, tail } of candidates) {
    const at = lower.lastIndexOf(close)
    if (at < 0) continue
    const head = xml.slice(0, at + close.length)
    const attempt = parseXML(`${head}${tail}`)
    if (attempt) return attempt
    const rdfAttempt = parseXML(`${head}</rdf:RDF>`)
    if (rdfAttempt) return rdfAttempt
  }
  return null
}

/**
 * @param {string} xml feed 原文
 * @param {{sourceID:string, sourceName:string, topic:string}} source 源上下文（身份/主题盖到每篇）
 * @param {number} now 无 pubDate 时的兜底时间（毫秒）
 */
export function parseFeed(xml, source, now = Date.now(), max = MAX_ITEMS_PER_FEED) {
  const text = String(xml || '').replace(/^﻿/, '').trim()
  if (!text) return []

  const doc = parseXML(text) || repairTruncatedXML(text)
  if (!doc || !doc.documentElement) return []

  const nodes = []
  for (const tag of ['item', 'entry']) {
    const found = doc.getElementsByTagName(tag)
    for (let i = 0; i < found.length; i += 1) nodes.push(found[i])
  }
  // getElementsByTagName 已经是文档序；两轮合并后按文档位置重排，保证 RSS+Atom 混排时顺序不乱。
  nodes.sort((a, b) => {
    const relation = a.compareDocumentPosition(b)
    if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1
    if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1
    return 0
  })

  const articles = []
  for (const node of nodes) {
    if (articles.length >= max) break
    const item = emptyItem()
    const state = { inAuthor: false }
    walk(node, item, state, node)
    const article = commit(item, source, now)
    if (article) articles.push(article)
  }
  return articles
}

function walk(element, item, state, root) {
  handleStart(element, item, state, root)
  for (const child of element.children) walk(child, item, state, root)
  handleEnd(element, item, state, root)
}

function handleStart(element, item, state, root) {
  const name = element.nodeName.toLowerCase()
  if (element === root) return
  switch (name) {
    case 'author':
      state.inAuthor = true
      break
    case 'link': {
      // Atom：href 属性（rel=alternate 或无 rel 视为正文链接）。RSS 的 <link> 走文本，见 handleEnd。
      const href = element.getAttribute('href')
      if (href) {
        const rel = element.getAttribute('rel') || 'alternate'
        if (rel === 'alternate' && !item.link) item.link = href
      }
      break
    }
    case 'enclosure': {
      const url = element.getAttribute('url')
      const type = element.getAttribute('type')
      if (!item.image && url && (type === null || type.startsWith('image'))) item.image = url
      break
    }
    case 'media:content':
    case 'media:thumbnail':
    case 'media:image': {
      const url = element.getAttribute('url')
      if (!item.image && url) item.image = url
      break
    }
    default:
      break
  }
}

function handleEnd(element, item, state, root) {
  if (element === root) return
  const name = element.nodeName.toLowerCase()
  const text = tailText(element)
  switch (name) {
    case 'title':
      if (!item.title) item.title = plain(text)
      break
    case 'link':
      if (!item.link && text) item.link = text
      break
    case 'description':
    case 'summary':
      if (!item.summary) item.summary = text
      break
    case 'content:encoded':
    case 'content':
    case 'content:html':
      if (!item.content) item.content = text
      break
    case 'pubdate':
    case 'published':
    case 'updated':
    case 'dc:date':
    case 'date':
    case 'issued':
      if (!item.date) item.date = text
      break
    case 'dc:creator':
    case 'creator':
      if (!item.author) item.author = plain(text)
      break
    case 'author':
      state.inAuthor = false
      if (!item.author && text) item.author = plain(text)
      break
    case 'name':
      if (state.inAuthor && !item.author) item.author = text
      break
    case 'category':
    case 'dc:subject':
      if (!item.category) item.category = plain(text)
      break
    case 'guid':
    case 'id':
      if (!item.guid) item.guid = text
      break
    default:
      break
  }
}

function commit(item, source, now) {
  const title = item.title.trim()
  const url = item.link.trim()
  if (!title && !url) return null

  const contentHTML = item.content ? item.content : null
  const rawSummary = item.summary ? item.summary : item.content
  const summary = plain(rawSummary).slice(0, 400)
  const parsed = parseDate(item.date)
  const publishedAt = parsed ? parsed.getTime() : now
  let image = item.image ? item.image : null
  if (!image) image = firstImageURL(item.content ? item.content : item.summary)

  return {
    id: stableKey(url, item.guid, title),
    title: title || summary.slice(0, 80),
    url,
    summary,
    contentHTML,
    author: item.author,
    sourceID: source.sourceID,
    sourceName: source.sourceName,
    topic: source.topic,
    imageURL: image,
    publishedAt,
    fetchedAt: now,
    clusterID: null,
  }
}
