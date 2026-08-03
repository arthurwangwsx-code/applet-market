// 领域类型 —— 对齐 WordStudyKit 的值类型（规格 §15）。
// 归一化统一是 `trim + toLowerCase()`；日期一律存 epoch 毫秒（IndexedDB/JSON 友好）。

/** 一条词义：词性 + 若干中文释义。 */
export interface WordSense {
  pos: string
  glosses: string[]
}

/** 词形变化：`过去式 → went`。 */
export interface WordForm {
  label: string
  value: string
}

/** 双语例句。 */
export interface WordExample {
  en: string
  zh: string
}

/**
 * 查词结果负载（规格 §15.2）。
 * 抓取路径拿不到 `corrected/frequency/synonyms/antonyms/memoryTip` —— 这五个只有 AI 路径有，
 * 页面必须能优雅缺省，不能因为空数组就渲染出一个空区块。
 */
export interface WordLookupPayload {
  word: string
  corrected: string | null
  phoneticUK: string | null
  phoneticUS: string | null
  senses: WordSense[]
  forms: WordForm[]
  examTags: string[]
  frequency: number | null
  examples: WordExample[]
  synonyms: string[]
  antonyms: string[]
  memoryTip: string | null
  /** null = AI 生成；`"youdao"` 等 = 抓取站点。 */
  source: string | null
}

/** 词条缓存（规格 §15.1）。`word` 是唯一键。 */
export interface WordEntry {
  word: string
  brief: string
  phoneticUK: string | null
  phoneticUS: string | null
  examTags: string[]
  payload: WordLookupPayload
  generatedAt: number
  lookupCount: number
  lastLookupAt: number
  source: string
}

/** 查询历史（规格 §15.3）。归一化与其它表不同：折叠连续空白后再小写。 */
export interface LookupHistoryItem {
  term: string
  brief: string
  at: number
}

export type VocabKind = 'word' | 'sentence'

/** 生词本条目（规格 §15.4）。`text` 是唯一键。 */
export interface VocabItem {
  text: string
  kind: VocabKind
  brief: string
  addedAt: number
  /** Leitner 盒 0–5。 */
  box: number
  /** null = 立即到期（新收的词不用先等一天）。 */
  nextReviewAt: number | null
  reviewCount: number
  /** 非 null = 已掌握，永久移出复习池。 */
  masteredAt: number | null
  /** 收藏时语境（首条英文例句）。 */
  note: string | null
}

export type LangCode = 'en' | 'zh'
export type TranslateDirection = 'auto' | 'zhToEn' | 'enToZh'

/** 翻译历史（规格 §15.5）。 */
export interface TranslationRecord {
  id: string
  source: string
  target: string
  srcLang: LangCode
  dstLang: LangCode
  at: number
  starred: boolean
}

/** 每日一句（规格 §15.6）。`dateKey` 唯一，保存是幂等的。 */
export interface DailySentence {
  dateKey: string
  en: string
  zh: string
  author: string
}

/** 联想行。 */
export interface Suggestion {
  term: string
  brief: string
  isCached: boolean
}

export type ReviewGrade = 'forgot' | 'fuzzy' | 'know'
export type ExerciseKind = 'listening' | 'cloze' | 'spelling'

/** 一道复习题。`prompt` 为 null 时题面显示兜底提示语。 */
export interface ReviewExercise {
  kind: ExerciseKind
  answer: string
  prompt: string | null
}

/** 跟读评分结果（规格 §13.3）。维度只有命中率，没有音素分。 */
export interface PronunciationScore {
  percent: number
  words: { text: string; matched: boolean }[]
}

/** 英美两种口音。由调用方显式指定，不跟随系统语言。 */
export type Accent = 'uk' | 'us'
