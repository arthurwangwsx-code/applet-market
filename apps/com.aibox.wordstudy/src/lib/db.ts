// 5 张表 —— 原生是独立 SwiftData 容器 `wordstudy.store`，复刻侧用 `aibox.db` 的 5 个 collection。
// 查询/排序/筛选全在 JS 侧做（数据量几百条，无性能问题）；容量上限逐条对齐规格 §15.7。
//
// 三条纪律：
//  1. **归一化是键的一部分**：`entries`/`vocab` 用 `trim + toLowerCase()`，`history` 额外折叠连续空白。
//  2. **`upsert` 与 `replace` 语义不同，别合并**（规格 §15.1）：前者命中只加计数，后者原位覆盖全字段。
//  3. 桥不在场（普通浏览器里预览）时整层退化成内存实现，页面仍能跑。

import { queryAll, removeMany } from '@aibox/applet-sdk'

import type {
  DailySentence, LookupHistoryItem, TranslationRecord, VocabItem, WordEntry, WordLookupPayload,
} from './types.js'

const COLLECTIONS = {
  entries: 'wordEntries',
  history: 'lookupHistory',
  vocab: 'vocabItems',
  translations: 'translations',
  daily: 'dailySentences',
} as const

/** 物理上限（规格 §15.7）。超限按时间升序删到上限。 */
const LIMITS = { history: 500, translations: 200 }

type Doc = Record<string, unknown> & { _id?: string }

/** `aibox.db` 的入参是裸 JSON 对象；本地强类型 doc 转过去只是形状放宽，不改值。 */
function asDoc(value: object): Doc {
  return value as unknown as Doc
}

const memory = new Map<string, Map<string, Doc>>()

function bridgeDB(): typeof aibox.db | undefined {
  const api = typeof window !== 'undefined' ? window.aibox : undefined
  return api && api.db && typeof api.db.query === 'function' ? api.db : undefined
}

function memoryBucket(collection: string): Map<string, Doc> {
  let bucket = memory.get(collection)
  if (!bucket) {
    bucket = new Map()
    memory.set(collection, bucket)
  }
  return bucket
}

/**
 * 读回一个 collection 的全部文档。
 *
 * **曾经这里写的是 `db.query({ collection, limit: 2000 })`，而宿主的单次上限是 500 且超出不报错**
 * （`min(500, limit)`）——生词本超过 500 个词之后就停止增长，返回值与「真的只有 500 条」
 * 完全不可区分。改用 SDK 的 `queryAll`（分页到表尾）。同一个 bug 在 `com.aibox.voicememos`
 * 里也复制了一份，故修在 SDK 而不是各修各的。
 */
async function all<T extends object>(collection: string): Promise<(T & { _id: string })[]> {
  if (!bridgeDB()) return [...memoryBucket(collection).values()] as unknown as (T & { _id: string })[]
  try {
    return await queryAll<T>(collection)
  } catch {
    return []
  }
}

async function put(collection: string, document: Doc): Promise<void> {
  const db = bridgeDB()
  if (!db) {
    const id = String(document._id ?? cryptoID())
    memoryBucket(collection).set(id, { ...document, _id: id })
    return
  }
  try {
    await db.insert({ collection, document })
  } catch {
    /* 落盘失败不抛到 UI：页面拿到的仍是它刚写进 state 的那份，下次启动才丢。 */
  }
}

async function drop(collection: string, id: string): Promise<void> {
  const db = bridgeDB()
  if (!db) {
    memoryBucket(collection).delete(id)
    return
  }
  try {
    await db.remove({ collection, id })
  } catch {
    /* 同上 */
  }
}

/**
 * 批量删。**不是 `drop` 的循环包装** —— 宿主每条 `remove` 都是一趟「读全表 → 改 → 原子写全表」，
 * 清理 200 条重复历史 = 200 趟全表 IO，中途失败还会停在删了一半的状态。
 * `removeMany` 走宿主的 `removeWhere`，一趟写完（老宿主没有该方法时 SDK 自动退回逐条）。
 */
async function dropMany(collection: string, ids: readonly string[]): Promise<void> {
  const list = ids.filter(Boolean)
  if (list.length === 0) return
  if (!bridgeDB()) {
    const bucket = memoryBucket(collection)
    for (const id of list) bucket.delete(id)
    return
  }
  try {
    await removeMany(collection, list)
  } catch {
    /* 同 drop：清理失败不打断 UI，下次启动再收敛 */
  }
}

export function cryptoID(): string {
  const c = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// —— 归一化 ——

/** 词条 / 生词本的键归一：trim + 小写。 */
export function normalizeTerm(text: string): string {
  return String(text ?? '').trim().toLowerCase()
}

/** 查询历史的键归一：**按空白切分再用单空格 join**，再小写（折叠连续空白，不是简单 trim）。 */
export function normalizeHistoryTerm(text: string): string {
  return String(text ?? '').split(/\s+/).filter(Boolean).join(' ').toLowerCase()
}

/** 一行简义 = 首个 `sense.pos` + 空格 + 首个 gloss；无 sense 时空串。 */
export function deriveBrief(payload: WordLookupPayload): string {
  const sense = payload.senses[0]
  if (!sense) return ''
  const gloss = sense.glosses[0] ?? ''
  return [sense.pos, gloss].filter(Boolean).join(' ').trim()
}

// —— 词条缓存 ——

type EntryDoc = WordEntry & { _id: string }

export async function getEntry(word: string): Promise<WordEntry | null> {
  const key = normalizeTerm(word)
  if (!key) return null
  const rows = await all<EntryDoc>(COLLECTIONS.entries)
  return rows.find((row) => row.word === key) ?? null
}

export async function listEntries(): Promise<WordEntry[]> {
  return all<EntryDoc>(COLLECTIONS.entries)
}

function entryFrom(word: string, payload: WordLookupPayload, now: number, previous?: EntryDoc): EntryDoc {
  return {
    _id: previous?._id ?? cryptoID(),
    word: normalizeTerm(word),
    brief: deriveBrief(payload),
    phoneticUK: payload.phoneticUK,
    phoneticUS: payload.phoneticUS,
    examTags: payload.examTags,
    payload,
    generatedAt: now,
    lookupCount: (previous?.lookupCount ?? 0) + 1,
    lastLookupAt: now,
    source: payload.source ?? 'ai',
  }
}

/**
 * `word_lookup` 工具用：**命中则只把计数 +1、刷新时间，不覆盖内容**。
 * 与 `replaceEntry` 语义不同，别合并（规格 §15.1）。
 */
export async function upsertEntry(word: string, payload: WordLookupPayload): Promise<WordEntry> {
  const key = normalizeTerm(word)
  const rows = await all<EntryDoc>(COLLECTIONS.entries)
  const previous = rows.find((row) => row.word === key)
  const now = Date.now()
  if (previous) {
    const bumped: EntryDoc = { ...previous, lookupCount: previous.lookupCount + 1, lastLookupAt: now }
    await put(COLLECTIONS.entries, asDoc(bumped))
    return bumped
  }
  const created = entryFrom(word, payload, now)
  await put(COLLECTIONS.entries, asDoc(created))
  return created
}

/**
 * UI 详情页用：**原位覆盖全部字段**（含 source / generatedAt），计数也 +1。
 * 缓存存在但 payload 已损坏时也走它，才能修复坏数据。
 */
export async function replaceEntry(word: string, payload: WordLookupPayload): Promise<WordEntry> {
  const key = normalizeTerm(word)
  const rows = await all<EntryDoc>(COLLECTIONS.entries)
  const previous = rows.find((row) => row.word === key)
  const created = entryFrom(word, payload, Date.now(), previous)
  await put(COLLECTIONS.entries, asDoc(created))
  return created
}

// —— 查询历史 ——

type HistoryDoc = LookupHistoryItem & { _id: string }

/** 最近查询。读之前先跑一次去重清理（保留每个归一词面最近的一条）。 */
export async function listHistory(limit = 50): Promise<LookupHistoryItem[]> {
  const rows = await dedupeHistory()
  return rows.slice(0, limit)
}

async function dedupeHistory(): Promise<HistoryDoc[]> {
  const rows = await all<HistoryDoc>(COLLECTIONS.history)
  rows.sort((a, b) => b.at - a.at)
  const seen = new Set<string>()
  const keep: HistoryDoc[] = []
  const stale: HistoryDoc[] = []
  for (const row of rows) {
    if (seen.has(row.term)) stale.push(row)
    else {
      seen.add(row.term)
      keep.push(row)
    }
  }
  // 物理上限 500，超限按时间升序删到 500。
  // 批量删：逐条 drop 时每条都是一趟「读全表 → 改 → 原子写全表」，清理 200 条重复项 = 200 趟全表 IO，
  // 且中途失败会停在删了一半的状态。`removeMany` 是一趟。
  const overflow = keep.slice(LIMITS.history)
  await dropMany(COLLECTIONS.history, [...stale, ...overflow].map((row) => row._id))
  return keep.slice(0, LIMITS.history)
}

/**
 * 写一条查询历史。
 * **只记录用户主动打开的查词** —— AI 工具触发的查询直接丢弃（`source === 'tool'`），不污染最近查询。
 */
export async function recordHistory(term: string, brief: string, source: 'ui' | 'tool' = 'ui'): Promise<void> {
  if (source === 'tool') return
  const key = normalizeHistoryTerm(term)
  if (!key) return
  const rows = await all<HistoryDoc>(COLLECTIONS.history)
  const previous = rows.find((row) => row.term === key)
  await put(COLLECTIONS.history, {
    _id: previous?._id ?? cryptoID(),
    term: key,
    brief,
    at: Date.now(),
  })
}

export async function removeHistory(term: string): Promise<void> {
  const key = normalizeHistoryTerm(term)
  const rows = await all<HistoryDoc>(COLLECTIONS.history)
  await dropMany(COLLECTIONS.history, rows.filter((item) => item.term === key).map((row) => row._id))
}

export async function clearHistory(): Promise<void> {
  const rows = await all<HistoryDoc>(COLLECTIONS.history)
  await dropMany(COLLECTIONS.history, rows.map((row) => row._id))
}

// —— 生词本 ——

type VocabDoc = VocabItem & { _id: string }

export async function listVocab(limit = 500): Promise<VocabItem[]> {
  const rows = await all<VocabDoc>(COLLECTIONS.vocab)
  rows.sort((a, b) => b.addedAt - a.addedAt)
  return rows.slice(0, limit)
}

export async function getVocab(term: string): Promise<VocabItem | null> {
  const key = normalizeTerm(term)
  const rows = await all<VocabDoc>(COLLECTIONS.vocab)
  return rows.find((row) => row.text === key) ?? null
}

/**
 * 收进生词本 / 更新已掌握标记。
 * `note` 补全规则（三个收藏入口共用）：显式传的语境优先；否则若 `kind === 'word'` 且缓存里有例句，
 * 取第一条英文例句；**已有非空 note 时保留、不覆盖用户笔记**。
 * `mastered` 传 undefined 表示不改。
 */
export async function upsertVocab(input: {
  term: string
  kind?: VocabItem['kind']
  brief?: string
  note?: string | null
  mastered?: boolean
}): Promise<{ item: VocabItem; created: boolean }> {
  const key = normalizeTerm(input.term)
  const rows = await all<VocabDoc>(COLLECTIONS.vocab)
  const previous = rows.find((row) => row.text === key)
  const now = Date.now()
  if (previous) {
    const next: VocabDoc = {
      ...previous,
      brief: input.brief && !previous.brief ? input.brief : previous.brief,
      note: previous.note && previous.note.trim() ? previous.note : (input.note ?? previous.note),
      masteredAt:
        input.mastered === undefined ? previous.masteredAt : input.mastered ? (previous.masteredAt ?? now) : null,
    }
    await put(COLLECTIONS.vocab, asDoc(next))
    return { item: next, created: false }
  }
  const created: VocabDoc = {
    _id: cryptoID(),
    text: key,
    kind: input.kind ?? 'word',
    brief: input.brief ?? '',
    addedAt: now,
    // 新词 box=0、nextReviewAt=null → **立刻到期**，不用先等一轮（规格 §12.4）。
    box: 0,
    nextReviewAt: null,
    reviewCount: 0,
    masteredAt: input.mastered ? now : null,
    note: input.note ?? null,
  }
  await put(COLLECTIONS.vocab, asDoc(created))
  return { item: created, created: true }
}

export async function removeVocab(term: string): Promise<boolean> {
  const key = normalizeTerm(term)
  const rows = await all<VocabDoc>(COLLECTIONS.vocab)
  const hit = rows.find((row) => row.text === key)
  if (!hit) return false
  await drop(COLLECTIONS.vocab, hit._id)
  return true
}

/** 写一次复习结果：盒位 / 到期时间 / 计数。 */
export async function saveReview(term: string, box: number, nextReviewAt: number): Promise<void> {
  const key = normalizeTerm(term)
  const rows = await all<VocabDoc>(COLLECTIONS.vocab)
  const hit = rows.find((row) => row.text === key)
  if (!hit) return
  await put(COLLECTIONS.vocab, asDoc({ ...hit, box, nextReviewAt, reviewCount: hit.reviewCount + 1 }))
}

// —— 翻译历史 ——

type TranslationDoc = TranslationRecord & { _id: string }

export async function listTranslations(limit = 50): Promise<TranslationRecord[]> {
  const rows = await all<TranslationDoc>(COLLECTIONS.translations)
  rows.sort((a, b) => b.at - a.at)
  // 物理上限 200，超限按时间升序删到 200。
  await dropMany(COLLECTIONS.translations, rows.slice(LIMITS.translations).map((row) => row._id))
  return rows.slice(0, limit)
}

export async function getTranslation(id: string): Promise<TranslationRecord | null> {
  const rows = await all<TranslationDoc>(COLLECTIONS.translations)
  return rows.find((row) => row.id === id) ?? null
}

export async function saveTranslation(record: TranslationRecord): Promise<void> {
  const rows = await all<TranslationDoc>(COLLECTIONS.translations)
  const previous = rows.find((row) => row.id === record.id)
  await put(COLLECTIONS.translations, asDoc({ ...record, _id: previous?._id ?? cryptoID() }))
}

export async function removeTranslation(id: string): Promise<void> {
  const rows = await all<TranslationDoc>(COLLECTIONS.translations)
  const hit = rows.find((row) => row.id === id)
  if (hit) await drop(COLLECTIONS.translations, hit._id)
}

export async function clearTranslations(): Promise<void> {
  const rows = await all<TranslationDoc>(COLLECTIONS.translations)
  for (const row of rows) await drop(COLLECTIONS.translations, row._id)
}

// —— 每日一句 ——

type DailyDoc = DailySentence & { _id: string }

export async function getDaily(dateKey: string): Promise<DailySentence | null> {
  const rows = await all<DailyDoc>(COLLECTIONS.daily)
  return rows.find((row) => row.dateKey === dateKey) ?? null
}

/** **幂等**：已存在同 dateKey 则直接返回旧的，不覆盖。 */
export async function saveDaily(sentence: DailySentence): Promise<DailySentence> {
  const existing = await getDaily(sentence.dateKey)
  if (existing) return existing
  await put(COLLECTIONS.daily, asDoc({ ...sentence, _id: cryptoID() }))
  return sentence
}

// —— 复习续跑锚点（存 storage 而非 db：是 UI 状态不是数据） ——

const ANCHOR_KEY = 'review.anchor'

/** 会话锚点存两样：**词面数组**（不是对象）+ 当前下标（规格 §7.5）。 */
export interface ReviewAnchor {
  terms: string[]
  index: number
}

export async function loadAnchor(): Promise<ReviewAnchor | null> {
  const api = typeof window !== 'undefined' ? window.aibox : undefined
  if (!api?.storage) return null
  try {
    const raw = await api.storage.get(ANCHOR_KEY)
    const value = raw as unknown as ReviewAnchor | null
    if (value && typeof value === 'object' && Array.isArray(value.terms)) return value
  } catch {
    /* 读不到就当没有锚点，重新拉一批 */
  }
  return null
}

export async function saveAnchor(anchor: ReviewAnchor | null): Promise<void> {
  const api = typeof window !== 'undefined' ? window.aibox : undefined
  if (!api?.storage) return
  try {
    if (anchor) await api.storage.set(ANCHOR_KEY, anchor as unknown as aibox.JSONValue)
    else await api.storage.remove(ANCHOR_KEY)
  } catch {
    /* 同上 */
  }
}
