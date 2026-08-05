// 应用级数据仓 —— 一份 state + 一个 `refresh()`。
// 页面只读这份快照，写操作走 db.ts 后 `refresh()` 重拉，避免多处各自缓存导致的不一致。

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listEntries, listHistory, listTranslations, listVocab } from './db.js'
import type { LookupHistoryItem, TranslationRecord, VocabItem, WordEntry } from './types.js'

export interface WordStore {
  ready: boolean
  vocab: VocabItem[]
  history: LookupHistoryItem[]
  translations: TranslationRecord[]
  entries: WordEntry[]
  cachedWords: Set<string>
  entryOf: (word: string) => WordEntry | null
  refresh: () => void
}

export function useWordStore(): WordStore {
  const [ready, setReady] = useState(false)
  const [vocab, setVocab] = useState<VocabItem[]>([])
  const [history, setHistory] = useState<LookupHistoryItem[]>([])
  const [translations, setTranslations] = useState<TranslationRecord[]>([])
  const [entries, setEntries] = useState<WordEntry[]>([])
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // 取数上限逐条对齐规格 §15.7：生词本 500、历史 50、翻译 50。
      const [nextVocab, nextHistory, nextTranslations, nextEntries] = await Promise.all([
        listVocab(500),
        listHistory(50),
        listTranslations(50),
        listEntries(),
      ])
      if (cancelled) return
      setVocab(nextVocab)
      setHistory(nextHistory)
      setTranslations(nextTranslations)
      setEntries(nextEntries)
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [tick])

  const cachedWords = useMemo(() => new Set(entries.map((entry) => entry.word)), [entries])
  const entryOf = useCallback(
    (word: string) => entries.find((entry) => entry.word === word.trim().toLowerCase()) ?? null,
    [entries],
  )

  return { ready, vocab, history, translations, entries, cachedWords, entryOf, refresh }
}
