// NewsDedup 的移植：① 稳定键精确去重；② 标题 SimHash 近似去重（跨源转载，汉明 ≤ 3）。
// 去重只除「近乎同一篇」；同一事件的不同报道留给聚类，不在此丢。

import { simhash, hamming, isZeroHash } from './text.js'

export const NEAR_THRESHOLD = 3

/** 保序去重，返回 `{ articles, removed }`（removed 供诊断页的「去重数量」）。 */
export function dedupe(articles, nearThreshold = NEAR_THRESHOLD) {
  const seenKeys = new Set()
  const keptHashes = []
  const kept = []

  for (const article of articles) {
    if (seenKeys.has(article.id)) continue
    const hash = simhash(article.title)
    if (!isZeroHash(hash) && keptHashes.some((other) => hamming(other, hash) <= nearThreshold)) {
      seenKeys.add(article.id)
      continue
    }
    seenKeys.add(article.id)
    keptHashes.push(hash)
    kept.push(article)
  }
  return { articles: kept, removed: articles.length - kept.length }
}
