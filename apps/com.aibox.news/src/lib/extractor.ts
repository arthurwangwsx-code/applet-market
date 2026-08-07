// ArticleExtractor 的移植：整块删 script/style/nav/header/footer → 剥标签 → 解实体 → 折叠空白 → 截断 8000。

import { plain } from './text.js'

export const MAX_CONTENT_CHARS = 8000
const BLOCK_TAGS = ['script', 'style', 'nav', 'header', 'footer']

/** 删除 `<tag …>…</tag>` 整块（含内容）；找不到闭合就删到文末。 */
function stripBlocks(input: string, tag: string) {
  let out = input
  const open = `<${tag}`
  const close = `</${tag}>`
  for (;;) {
    const start = out.toLowerCase().indexOf(open)
    if (start < 0) break
    const end = out.toLowerCase().indexOf(close, start + open.length)
    if (end >= 0) {
      out = out.slice(0, start) + out.slice(end + close.length)
    } else {
      out = out.slice(0, start)
      break
    }
  }
  return out
}

export function extract(html: unknown, maxChars = MAX_CONTENT_CHARS) {
  let source = String(html || '')
  for (const tag of BLOCK_TAGS) source = stripBlocks(source, tag)
  return plain(source).slice(0, maxChars)
}
