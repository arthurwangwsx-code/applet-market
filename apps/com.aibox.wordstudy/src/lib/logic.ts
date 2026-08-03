// 纯函数层：意图识别 / 联想索引 / Leitner 调度 / 出题 / 跟读评分 / 文本格式化。
// 全部照抄规格 §11 §12 §7.6 §13.3 §16 —— 这些是"重进同一会话不能换题""判对规则"这类
// 会被用户逐条对比的行为，任何"顺手优化"都会被看成缺陷。

import { WORDS_SEED } from './seed'
import type {
  ExerciseKind, LangCode, LookupHistoryItem, PronunciationScore, ReviewExercise, ReviewGrade,
  Suggestion, TranslateDirection, VocabItem, WordEntry, WordLookupPayload,
} from './types'

// —— §11.2 意图识别（纯函数） ——

const CJK = /[一-鿿㐀-䶿]/
const PUNCT = /[.,!?;:。！？；：]/
/** 白名单：字母 ∪ 空格 ∪ `-` ∪ `'` ∪ `’`。**数字不在里面** —— `covid19` 会被判成翻译。 */
const LOOKUP_CHARS = /^[\p{L} \-'’]+$/u

/** 六条判据**全部**成立才算查词，否则翻译。 */
export function resolveIntent(input: string): 'lookup' | 'translate' {
  const text = String(input ?? '').trim()
  if (!text) return 'lookup'
  if (CJK.test(text)) return 'translate'
  if (/[\r\n]/.test(text)) return 'translate'
  if ([...text].length > 48) return 'translate'
  if (text.split(/\s+/).filter(Boolean).length > 5) return 'translate'
  if (!LOOKUP_CHARS.test(text)) return 'translate'
  if (PUNCT.test(text)) return 'translate'
  return 'lookup'
}

/** 翻译语向的脚本预判：含 CJK → 中译英，否则英译中。 */
export function previewDirection(text: string, direction: TranslateDirection): { from: LangCode; to: LangCode } {
  if (direction === 'zhToEn') return { from: 'zh', to: 'en' }
  if (direction === 'enToZh') return { from: 'en', to: 'zh' }
  return CJK.test(String(text ?? '')) ? { from: 'zh', to: 'en' } : { from: 'en', to: 'zh' }
}

// —— §11.1 联想索引（全程本地零网络） ——

/**
 * 三路**按优先级顺序**合并，按 `term.toLowerCase()` 去重，总数满 8 条立即停。
 * 只做前缀匹配，没有模糊 / 编辑距离 / 分词。
 *
 * **有意改良**（规格 §11.1 已知瑕疵）：生词本那一路原生把 `isCached` 硬编码成 true，
 * 收藏过但没查过的词会误标"已缓存"。这里改成真实判断。
 */
export function suggest(input: {
  prefix: string
  history: LookupHistoryItem[]
  vocab: VocabItem[]
  cachedWords: Set<string>
}): Suggestion[] {
  const prefix = String(input.prefix ?? '').trim().toLowerCase()
  if (!prefix) return []
  const out: Suggestion[] = []
  const seen = new Set<string>()

  const push = (term: string, brief: string) => {
    if (out.length >= 8) return
    const key = term.toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push({ term, brief, isCached: input.cachedWords.has(key) })
  }

  for (const item of input.history.slice(0, 200)) {
    if (out.length >= 8) break
    if (item.term.toLowerCase().startsWith(prefix)) push(item.term, item.brief)
  }
  for (const item of input.vocab.slice(0, 200)) {
    if (out.length >= 8) break
    if (item.text.toLowerCase().startsWith(prefix)) push(item.text, item.brief)
  }
  for (const item of WORDS_SEED) {
    if (out.length >= 8) break
    if (item.word.startsWith(prefix)) push(item.word, item.brief)
  }
  return out
}

// —— §12 Leitner 调度（精确规则，照抄） ——

/** 下标 = 盒号，共 6 个盒（0..5）。 */
export const INTERVAL_DAYS = [1, 2, 4, 7, 15, 30]
/** 每日复习队列上限。 */
export const DAILY_REVIEW_LIMIT = 30

export function nextBox(box: number, grade: ReviewGrade): number {
  if (grade === 'forgot') return 0
  if (grade === 'fuzzy') return Math.min(Math.max(box, 0), 5)
  return Math.min(box + 1, 5)
}

/** 无论哪种自评都会重排到期时间（"模糊"也会顺延一个同长度的间隔）。 */
export function scheduleNext(box: number, grade: ReviewGrade, now = Date.now()): { box: number; nextReviewAt: number } {
  const box2 = nextBox(box, grade)
  const days = INTERVAL_DAYS[Math.min(Math.max(box2, 0), 5)]
  return { box: box2, nextReviewAt: now + days * 86_400_000 }
}

/** `nextReviewAt == null` → 立即到期（从未复习过）。 */
export function isDue(nextReviewAt: number | null, now = Date.now()): boolean {
  return nextReviewAt === null || nextReviewAt <= now
}

/** 到期条数（提醒条的数字）**不受每日 30 上限影响**。 */
export function dueCount(items: VocabItem[], now = Date.now()): number {
  return items.filter((item) => item.masteredAt === null && isDue(item.nextReviewAt, now)).length
}

/** 今日队列：到期 → 按 nextReviewAt 升序（null 排最前）→ 截 30 条。 */
export function dueQueue(items: VocabItem[], now = Date.now()): VocabItem[] {
  return items
    .filter((item) => item.masteredAt === null && isDue(item.nextReviewAt, now))
    .sort((a, b) => (a.nextReviewAt ?? -Infinity) - (b.nextReviewAt ?? -Infinity))
    .slice(0, DAILY_REVIEW_LIMIT)
}

/** 明日预告（完成页用，纯展示）。 */
export function tomorrowPreview(items: VocabItem[], now = Date.now()): number {
  return Math.max(0, dueCount(items, now + 86_400_000) - dueCount(items, now))
}

// —— §7.6 出题（纯函数，可照抄） ——

const KINDS: ExerciseKind[] = ['listening', 'cloze', 'spelling']

/** **按队列位置轮换**，不是随机 —— 重进同一会话时题目必须一模一样。 */
export function preferredKind(index: number): ExerciseKind {
  return KINDS[((index % 3) + 3) % 3]
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 挖空：字母数字边界，避免把 `lean` 从 `clean` 里挖掉；短语和连字符仍可挖。
 * 命中第一处，替换成 8 个下划线。
 */
export function blankOut(context: string, term: string): string | null {
  if (!context || !term) return null
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, 'iu')
  if (!pattern.test(context)) return null
  return context.replace(pattern, '________')
}

export function planExercise(input: {
  index: number
  item: VocabItem
  entry: WordEntry | null
}): ReviewExercise {
  const term = input.item.text
  const contexts = [
    ...(input.item.note && input.item.note.trim() ? [input.item.note.trim()] : []),
    ...((input.entry?.payload.examples ?? []).map((example) => example.en).filter(Boolean)),
  ]
  const kind = preferredKind(input.index)

  if (kind === 'listening') return { kind: 'listening', answer: term, prompt: null }

  const firstBlank = () => {
    for (const context of contexts) {
      const blanked = blankOut(context, term)
      if (blanked) return blanked
    }
    return null
  }

  if (kind === 'cloze') {
    const prompt = firstBlank()
    // 一条都挖不动就降级为 spelling。
    if (prompt) return { kind: 'cloze', answer: term, prompt }
    return { kind: 'spelling', answer: term, prompt: spellingPrompt(input.item, firstBlank) }
  }
  return { kind: 'spelling', answer: term, prompt: spellingPrompt(input.item, firstBlank) }
}

function spellingPrompt(item: VocabItem, firstBlank: () => string | null): string | null {
  const brief = (item.brief ?? '').trim()
  if (brief) return brief
  return firstBlank()
}

/** 判对：两边做同一套归一后严格相等。**只去首尾句读**，不删词面本身的符号（`C++` / `e-mail` 保持）。 */
export function isCorrect(response: string, answer: string): boolean {
  return normalizeAnswer(response) === normalizeAnswer(answer)
}

function normalizeAnswer(text: string): string {
  let value = String(text ?? '').trim().replace(/\s+/g, ' ')
  value = value.replace(/^[.,!?;:，。！？；：]+/, '').replace(/[.,!?;:，。！？；：]+$/, '')
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// —— §13.3 跟读评分（LCS，纯函数，照抄） ——

function normalizeWords(text: string): string[] {
  return String(text ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
}

/**
 * 是「识别文本 vs 目标文本」的逐词对齐，**不是音素级发音评分**。
 * 维度只有一个：命中率百分比 + 逐词命中/漏读。
 */
export function scorePronunciation(target: string, recognized: string): PronunciationScore {
  const T = normalizeWords(target)
  if (T.length === 0) return { percent: 0, words: [] }
  const R = normalizeWords(recognized)
  if (R.length === 0) return { percent: 0, words: T.map((text) => ({ text, matched: false })) }

  const n = T.length
  const m = R.length
  // dp[i][j] = 从 T[i..] 与 R[j..] 起的 LCS 长度（从后往前填）。
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = T[i] === R[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const matched = new Set<number>()
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (T[i] === R[j]) {
      matched.add(i)
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1
    else j += 1
  }
  return {
    percent: Math.round((matched.size / n) * 100),
    words: T.map((text, index) => ({ text, matched: matched.has(index) })),
  }
}

// —— §16 模型友好纯文本（工具返回 + 复制词条 + 分享共用这一份） ——

export function formatEntryText(payload: WordLookupPayload): string {
  const blocks: string[] = []
  if (payload.corrected && payload.corrected.trim()) {
    blocks.push(`Did you mean "${payload.corrected}"? Showing results for "${payload.word}".`)
  }

  const phonetics = [
    payload.phoneticUK ? `UK /${payload.phoneticUK}/` : '',
    payload.phoneticUS ? `US /${payload.phoneticUS}/` : '',
  ].filter(Boolean)
  blocks.push([payload.word, ...phonetics].join(' '))

  const senses = payload.senses
    .map((sense) => [sense.pos, sense.glosses.join('；')].filter(Boolean).join(' '))
    .filter(Boolean)
  if (senses.length) blocks.push(senses.join('\n'))

  if (payload.forms.length) {
    blocks.push(`Forms: ${payload.forms.map((form) => `${form.label} ${form.value}`).join(', ')}`)
  }
  if (payload.examples.length) {
    blocks.push(`Examples:\n${payload.examples.map((e) => `- ${[e.en, e.zh].filter(Boolean).join(' ')}`).join('\n')}`)
  }
  const related: string[] = []
  if (payload.synonyms.length) related.push(`Synonyms: ${payload.synonyms.join(', ')}`)
  // 反义紧跟近义，中间不空行。
  if (payload.antonyms.length) related.push(`Antonyms: ${payload.antonyms.join(', ')}`)
  if (related.length) blocks.push(related.join('\n'))

  if (payload.memoryTip && payload.memoryTip.trim()) blocks.push(`Memory tip: ${payload.memoryTip}`)
  if (payload.examTags.length) blocks.push(`Exam tags: ${payload.examTags.join(', ')}`)
  return blocks.join('\n\n')
}

/** `yyyy-MM-dd`（本地时区）。每日一句的键、生词本导出的日期都用它。 */
export function dateKeyOf(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `word_list_vocab` 的返回文本。 */
export function formatVocabList(items: VocabItem[]): string {
  if (items.length === 0) return 'No saved vocabulary matches.'
  return items
    .map((item, index) => {
      const brief = item.brief && item.brief.trim() ? ` — ${item.brief}` : ''
      const mastered = item.masteredAt ? ', mastered' : ''
      return `${index + 1}. ${item.text}${brief} (added ${dateKeyOf(new Date(item.addedAt))}${mastered})`
    })
    .join('\n')
}

/** 空 payload：抓取/AI 都失败时用它渲染，页面不会崩。 */
export function emptyPayload(word: string): WordLookupPayload {
  return {
    word,
    corrected: null,
    phoneticUK: null,
    phoneticUS: null,
    senses: [],
    forms: [],
    examTags: [],
    frequency: null,
    examples: [],
    synonyms: [],
    antonyms: [],
    memoryTip: null,
    source: null,
  }
}
