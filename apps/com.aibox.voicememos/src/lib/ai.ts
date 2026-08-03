// applet 侧的 AI 产物：模板摘要 / 说话人校正 / 翻译。
//
// 为什么这三样在这里做而不是调宿主工具（规格 §17.2 缺口⑫）：
//  · **摘要**：宿主 `memo_summarize` 没有模板参数，只出通用摘要；6 个模板是原生详情页的一等交互，
//    所以模板那 5 个走 `aibox.ai.generate` + 原生同一套 outputGuide。
//  · **校正**：宿主**没有**校正工具（`cleanTranscript` 是破坏性 Clean Up，不是非破坏的 correctedText）。
//  · **翻译**：宿主也没有；结果存进 applet 自己的 db。
//
// 两条从原生照搬的纪律：
//  · **JSON 提取器必须用半开区间** —— 闭区间会在「模型返回纯 JSON、结尾就是 `}`」时越界，
//    这正是历史上「校正一返回就崩、永远不成功」的根因；JS 里不会 trap，但会切掉最后一个字符
//    导致 parse 必失败，症状同样是"永远不成功"。
//  · **AI 报的秒数一律不信**（原生靠 startPhrase 回查原始 segments）。容器拿不到 segments，
//    所以复刻版的校正段**不带时间戳**，而不是把模型编的秒数当真显示出来。

import { normalizeError } from '@aibox/applet-sdk'
import type { CorrectionTurn, SpeakerMode, SummaryTemplate } from './types'

/** 长文本截断口径，与原生一致（8000 字符）。 */
const MAX_CHARS = 8000

const ai = () => {
  const bridge = typeof window !== 'undefined' ? window.aibox : undefined
  return bridge?.ai && typeof bridge.ai.generate === 'function' ? bridge.ai : undefined
}

export class AiError extends Error {}

function clip(text: string): string {
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text
}

/** 从模型回复里找第一个 `{`/`[` 到最后一个 `}`/`]` 的子串。**半开区间**，见文件头。 */
export function extractJSON<T>(raw: string): T | null {
  let text = String(raw ?? '').trim()
  if (text.startsWith('```')) {
    const lines = text.split('\n')
    if (lines[0]?.startsWith('```')) lines.shift()
    if (lines[lines.length - 1]?.startsWith('```')) lines.pop()
    text = lines.join('\n')
  }
  const objectStart = text.indexOf('{')
  const objectEnd = text.lastIndexOf('}')
  const arrayStart = text.indexOf('[')
  const arrayEnd = text.lastIndexOf(']')
  let slice = text
  if (arrayStart >= 0 && arrayEnd > arrayStart && (objectStart < 0 || arrayStart < objectStart)) {
    slice = text.slice(arrayStart, arrayEnd + 1)
  } else if (objectStart >= 0 && objectEnd > objectStart) {
    slice = text.slice(objectStart, objectEnd + 1)
  }
  try {
    return JSON.parse(slice) as T
  } catch {
    return null
  }
}

async function generate(input: { system?: string; prompt: string; maxTokens?: number; temperature?: number }): Promise<string> {
  const api = ai()
  if (!api) throw new AiError('aibox/ai-unavailable')
  try {
    return await api.generate({ ...input, intent: 'balanced' })
  } catch (error) {
    throw new AiError(normalizeError(error).message)
  }
}

// —— 摘要模板（规格 §13.5） ——

/** 公共 guide：GFM Markdown、`##` 段标题 + `-` 列表、忠实简洁、没内容就整段省略、用转录原文的语言。 */
const COMMON_GUIDE =
  'Write GFM Markdown using "##" section headings and "-" lists. Be faithful and concise. '
  + 'Omit a whole section when the transcript has nothing for it. Answer in the language of the transcript.'

const TEMPLATE_GUIDE: Record<SummaryTemplate, { system: string; guide: string }> = {
  general: {
    system: 'You summarize spoken recordings faithfully.',
    guide: 'Write a 2-3 sentence overview paragraph, then a "## Key Points" section with short bullets.',
  },
  meeting: {
    system: 'You write meeting minutes.',
    guide: 'Sections: "## Overview", "## Discussion", "## Decisions", "## Action Items" '
      + '(only tasks that were explicitly stated, as "- [ ] task — owner (due)"), "## Open Questions".',
  },
  interview: {
    system: 'You write interview debriefs.',
    guide: 'Sections: "## Candidate", "## Strengths", "## Concerns", "## Notable Q&A", "## Overall".',
  },
  oneOnOne: {
    system: 'You write 1:1 notes.',
    guide: 'Sections: "## Context", "## Feedback & Asks", "## Agreements", "## Next Steps".',
  },
  lecture: {
    system: 'You write lecture notes.',
    guide: 'Sections: "## Overview", "## Key Concepts", "## Conclusions", "## To Review".',
  },
  podcast: {
    system: 'You write podcast show notes.',
    guide: 'Sections: "## Overview", "## Topics", "## Quotes", "## Takeaways".',
  },
}

export interface SummaryResult {
  text: string
  points: string[]
}

/**
 * 生成摘要。
 * `general` 走结构化输出（一次调用同时出 abstract + points，页面把 points 渲染成关键点列表）；
 * 其余 5 个模板产出结构化 Markdown（`points` 为空，由 Markdown 渲染器展示）。
 */
export async function summarize(transcript: string, template: SummaryTemplate): Promise<SummaryResult> {
  const text = clip(transcript.trim())
  if (!text) throw new AiError('empty-transcript')

  if (template === 'general') {
    const raw = await generate({
      system: TEMPLATE_GUIDE.general.system,
      prompt: 'Output ONLY a single JSON object (no markdown fences, no explanation) shaped exactly like:\n'
        + '{"abstract":"2-3 sentence summary","points":["short key point", "..."]}\n'
        + 'Answer in the language of the transcript.\n\nTranscript:\n' + text,
      maxTokens: 900,
      temperature: 0.3,
    })
    const parsed = extractJSON<{ abstract?: unknown; points?: unknown }>(raw)
    if (parsed && typeof parsed.abstract === 'string' && parsed.abstract.trim()) {
      return {
        text: parsed.abstract.trim(),
        points: Array.isArray(parsed.points) ? parsed.points.map((item) => String(item)).filter(Boolean) : [],
      }
    }
    // 结构化失败就回落成散文，不把用户扔进空态。
    return { text: raw.trim(), points: [] }
  }

  const spec = TEMPLATE_GUIDE[template]
  const body = await generate({
    system: spec.system,
    prompt: `${COMMON_GUIDE}\n${spec.guide}\n\nTranscript:\n${text}`,
    maxTokens: 1400,
    temperature: 0.3,
  })
  return { text: body.trim(), points: [] }
}

// —— 说话人校正（规格 §4.9） ——

/** 固定 6 色，按 colorIndex 取模。 */
export const SPEAKER_COLOR_COUNT = 6

export async function correct(input: {
  transcript: string
  mode: SpeakerMode
  speakers: string[]
}): Promise<CorrectionTurn[]> {
  const text = clip(input.transcript.trim())
  if (!text) throw new AiError('empty-transcript')

  const speakerRule =
    input.mode === 'none'
      ? 'Do NOT attribute speakers; return a single turn per paragraph with an empty "speaker".'
      : input.mode === 'named'
        ? `There are exactly ${input.speakers.length} speakers named: ${input.speakers.join(', ')}. `
          + 'Use those exact names.'
        : 'Identify how many distinct speakers there are and label them "S1", "S2", … in order of first appearance.'

  const raw = await generate({
    system: 'You clean up raw speech-recognition transcripts.',
    prompt: 'Fix recognition errors, restore punctuation and casing, and split the text into speaker turns. '
      + 'Preserve meaning and language exactly — do not summarize, do not add or remove content. '
      + `${speakerRule}\n`
      + 'Output ONLY a JSON array (no markdown fences, no explanation) shaped exactly like:\n'
      + '[{"speaker":"S1","text":"..."}]\n\nTranscript:\n' + text,
    maxTokens: 2400,
    temperature: 0.2,
  })

  const parsed = extractJSON<{ speaker?: unknown; text?: unknown }[]>(raw)
  if (!Array.isArray(parsed)) throw new AiError('unparseable')
  const order: string[] = []
  const turns: CorrectionTurn[] = []
  for (const item of parsed) {
    const body = String(item?.text ?? '').trim()
    if (!body) continue
    const speaker = String(item?.speaker ?? '').trim()
    if (speaker && !order.includes(speaker)) order.push(speaker)
    turns.push({
      speaker,
      colorIndex: speaker ? order.indexOf(speaker) % SPEAKER_COLOR_COUNT : 0,
      text: body,
    })
  }
  if (turns.length === 0) throw new AiError('empty-result')
  return turns
}

/** AI 给的 label 若形如 `S1`（S + 纯数字）或为空 → 本地化成「说话人 N」；否则用真名。 */
export function speakerDisplayName(label: string, index: number, template: string): string {
  const trimmed = label.trim()
  if (!trimmed) return template.replace('{n}', String(index + 1))
  const match = /^S(\d+)$/i.exec(trimmed)
  if (match) return template.replace('{n}', match[1])
  return trimmed
}

// —— 翻译（规格 §4.10 / §13.5） ——

/** 8 种目标语言。语言名用英文保证模型认得（`ja → Japanese`）。 */
export const TRANSLATION_LANGS = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru'] as const
export type TranslationLang = (typeof TRANSLATION_LANGS)[number]

const LANG_NAME: Record<TranslationLang, string> = {
  zh: 'Chinese', en: 'English', ja: 'Japanese', ko: 'Korean',
  fr: 'French', de: 'German', es: 'Spanish', ru: 'Russian',
}

/** 分块 4000（与原生一致），纯文本输出。 */
const TRANSLATE_CHUNK = 4000

export async function translate(input: {
  text: string
  lang: TranslationLang
  bilingual: boolean
}): Promise<string> {
  const source = input.text.trim()
  if (!source) throw new AiError('empty-transcript')
  const name = LANG_NAME[input.lang]
  const guide = input.bilingual
    ? `Translate paragraph by paragraph: output each source paragraph on one line, then its ${name} translation `
      + 'on the next line, then a blank line. Do not add any other commentary.'
    : `Output ONLY the ${name} translation, preserving paragraph breaks.`

  const chunks: string[] = []
  for (let index = 0; index < source.length; index += TRANSLATE_CHUNK) {
    chunks.push(source.slice(index, index + TRANSLATE_CHUNK))
  }
  const parts: string[] = []
  for (const chunk of chunks) {
    parts.push((await generate({ prompt: `${guide}\n\n${chunk}`, maxTokens: 2400, temperature: 0.2 })).trim())
  }
  return parts.join('\n\n')
}

export { LANG_NAME }
