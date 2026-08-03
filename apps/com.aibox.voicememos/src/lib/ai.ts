// applet 侧的全部 AI 产物：模板摘要 / 待办 / 章节 / 问答 / 转写整理 / 说话人校正 / 翻译。
//
// **2.0.0 起这里是唯一一条 AI 路径**（1.x 有一半走宿主 `memo_*` 工具）。这不是为了"自己造轮子"，
// 判据很清楚：模型路由、配额、并发闸、超时、结构化输出是**机制**，两个应用只可能有同一个正确答案
// ——那已经在 `aibox.ai` 里了；而"摘要用哪个模板、待办抽到多细、章节切多长、什么语气"是**策略**，
// 两个应用可以有不同的、都对的答案 —— 那就该归应用。
//
// 1.x 的现场记录本身就是证据：即便宿主工具在场，摘要 / 校正 / 翻译三样也早就绕开它们了，
// 因为「宿主 `memo_summarize` 没有模板参数」「宿主没有非破坏的校正」「宿主没有翻译」。
// 2.0.0 只是把剩下的待办 / 章节 / 问答 / 整理也搬到同一条路上，顺带让整个应用不再依赖任何宿主模块。
//
// 两条从原生照搬的纪律：
//  · **JSON 提取器必须用半开区间** —— 闭区间会在「模型返回纯 JSON、结尾就是 `}`」时越界，
//    这正是历史上「校正一返回就崩、永远不成功」的根因；JS 里不会 trap，但会切掉最后一个字符
//    导致 parse 必失败，症状同样是"永远不成功"。
//  · **AI 报的秒数一律不信**（原生靠 startPhrase 回查原始 segments）。容器拿不到 segments，
//    所以复刻版的校正段**不带时间戳**，而不是把模型编的秒数当真显示出来。

import { normalizeError } from '@aibox/applet-sdk'
import type { ActionItem, ActionItemKind, Chapter, CorrectionTurn, SpeakerMode, SummaryTemplate } from './types'

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


// —— 待办 / 章节 / 问答 / 转写整理（2.0.0 从宿主 memo_* 工具搬过来） ——

/**
 * 抽待办。**只抽真的被说出口的**——模型最爱干的事就是把"我们应该考虑一下"升格成一条任务，
 * 于是列表里全是没人认领的幻觉条目。提示词里把这条写死，并要求 owner/due 只在原话里出现时才填。
 */
export async function actionItems(transcript: string): Promise<ActionItem[]> {
  const text = clip(transcript.trim())
  if (!text) throw new AiError('empty-transcript')
  const raw = await generate({
    system: 'You extract commitments from spoken recordings. You never invent tasks that were not actually stated.',
    prompt: 'Output ONLY a JSON array (no markdown fences, no explanation) shaped exactly like:\n'
      + '[{"text":"the task as stated","kind":"task|decision|commitment","owner":"who, only if named","dueHint":"when, only if stated"}]\n'
      + 'Rules: include an item ONLY if the speaker actually committed to it, decided it, or assigned it. '
      + 'Leave owner/dueHint out entirely when the recording does not say. Return [] when there is nothing. '
      + 'Use the language of the transcript.\n\nTranscript:\n' + text,
    maxTokens: 900,
    temperature: 0.2,
  })
  const parsed = extractJSON<Record<string, unknown>[]>(raw)
  if (!Array.isArray(parsed)) return []
  const kinds: ActionItemKind[] = ['task', 'decision', 'commitment']
  return parsed
    .map((item, index) => {
      const kind = String(item.kind ?? 'task') as ActionItemKind
      return {
        id: `item-${index}`,
        text: String(item.text ?? '').trim(),
        kind: kinds.includes(kind) ? kind : 'task',
        isDone: false,
        owner: item.owner ? String(item.owner) : undefined,
        dueHint: item.dueHint ? String(item.dueHint) : undefined,
      }
    })
    .filter((item) => item.text)
}

/**
 * 切章节。秒数用**转写分段**校准而不是信模型：模型报的时间戳几乎总是编的
 * （原生实现靠 startPhrase 回查原始 segments，这里同理）。没有分段时退回模型给的秒数，
 * 但那时章节只用于阅读定位，点击跳转本来也不可用。
 */
export async function chapters(transcript: string, segments: { text: string; start: number }[]): Promise<Chapter[]> {
  const text = clip(transcript.trim())
  if (!text) throw new AiError('empty-transcript')
  const raw = await generate({
    system: 'You segment spoken recordings into chapters.',
    prompt: 'Output ONLY a JSON array (no markdown fences) shaped exactly like:\n'
      + '[{"title":"short chapter title","startPhrase":"the first few words actually spoken at the start of this chapter"}]\n'
      + 'Rules: 3-8 chapters for a normal recording, fewer for a short one. startPhrase MUST be copied verbatim '
      + 'from the transcript. Use the language of the transcript.\n\nTranscript:\n' + text,
    maxTokens: 700,
    temperature: 0.3,
  })
  const parsed = extractJSON<Record<string, unknown>[]>(raw)
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item) => ({
      title: String(item.title ?? '').trim(),
      start: locateStart(String(item.startPhrase ?? ''), segments),
    }))
    .filter((chapter) => chapter.title)
}

/** 用 startPhrase 在分段里回查真实秒数；查不到回 0（章节仍可读，只是点了不跳）。 */
function locateStart(phrase: string, segments: { text: string; start: number }[]): number {
  const needle = phrase.trim().toLowerCase()
  if (!needle || segments.length === 0) return 0
  const hit = segments.find((segment) => segment.text.toLowerCase().includes(needle.slice(0, 24)))
  return hit ? Math.max(0, Math.floor(hit.start)) : 0
}

/** 只用转录内容回答；转录里没有就明说没有，不要去别处找答案。 */
export async function ask(transcript: string, question: string): Promise<string> {
  const text = clip(transcript.trim())
  if (!text) throw new AiError('empty-transcript')
  if (!question.trim()) throw new AiError('empty-question')
  const answer = await generate({
    system: 'You answer questions about one recording using ONLY its transcript. '
      + 'If the transcript does not contain the answer, say so plainly instead of guessing.',
    prompt: `Question: ${question.trim()}\n\nTranscript:\n${text}`,
    maxTokens: 700,
    temperature: 0.2,
  })
  return answer.trim()
}

/**
 * 转写整理：去口水词、补标点、分段。
 * ⚠️ 与宿主的 `memo_clean_transcript` 有一处**关键差别**：宿主那条是破坏性的（直接改写 fullText
 * 并置 isEdited，之后所有 AI 产物作废）。这里产出的是**另一份文本**，原始转写一个字都不动——
 * 用户随时可以切回去看原文。
 */
export async function cleanTranscript(transcript: string): Promise<string> {
  const text = clip(transcript.trim())
  if (!text) throw new AiError('empty-transcript')
  const cleaned = await generate({
    system: 'You clean up raw speech-to-text output.',
    prompt: 'Remove filler words and false starts, fix punctuation and capitalization, and break the text into '
      + 'paragraphs. Do NOT summarize, reorder, translate or add anything that was not said. '
      + 'Output only the cleaned text.\n\nTranscript:\n' + text,
    maxTokens: 2000,
    temperature: 0.2,
  })
  return cleaned.trim()
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
