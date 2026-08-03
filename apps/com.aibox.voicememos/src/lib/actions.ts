// 7 个对 AI 提供的工具。
//
// 与宿主自带的 24 个 `memo_*` 的关系：**这一组不是复制，是补齐**。它们经 applet action 通道投影成
// 延迟工具（`appact_<hash>`，模型经 `tool_search / tool_describe / tool_call` 三步发现），
// 每一条都做宿主工具做不到的事：
//  · `memo_list` —— 合并**本机剪辑**（宿主工具完全看不到 applet 私有录音）
//  · `memo_summarize` —— 带**模板**（宿主 `memo_summarize` 只有通用摘要，没有模板参数）
//  · `memo_export` —— 结构化 Markdown / 文本 / SRT（宿主没有导出工具）
//  · `memo_transcript` —— 优先返回本应用的**校正稿**（宿主没有校正工具）
//  · 其余三条是直通宿主工具的稳定入口，让模型只认一套工具名。

import { registerActions } from '@aibox/applet-sdk'
import { summarize } from './ai'
import { clockString, exportMarkdown, exportSRT, exportText, hashText, shortDate } from './format'
import {
  askMemo, clipToMemo, fetchActionItems, fetchTranscript, listClips, listLibrary, loadArtifacts,
  saveArtifacts, startTranscription,
} from './memos'
import type { Memo, SummaryTemplate } from './types'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function allMemos(): Promise<Memo[]> {
  const [library, clips] = await Promise.all([listLibrary(), listClips()])
  return [...library, ...clips.filter((clip) => !clip.isTrashed).map(clipToMemo)]
    .sort((a, b) => b.createdAt - a.createdAt)
}

async function findMemo(id: string): Promise<Memo | null> {
  return (await allMemos()).find((memo) => memo.id === id) ?? null
}

/** 取一条录音的可读文稿：优先本应用的校正稿，否则宿主转写。 */
async function readableTranscript(memo: Memo): Promise<{ text: string; status: string; corrected: boolean }> {
  if (memo.source === 'local') return { text: '', status: 'none', corrected: false }
  const transcript = await fetchTranscript(memo.id)
  const artifacts = await loadArtifacts(memo.id, transcript?.fullText ?? '')
  if (artifacts.correctionTurns.length) {
    return {
      text: artifacts.correctionTurns.map((turn) => (turn.speaker ? `${turn.speaker}: ${turn.text}` : turn.text)).join('\n\n'),
      status: transcript?.status ?? 'none',
      corrected: true,
    }
  }
  return { text: transcript?.fullText ?? '', status: transcript?.status ?? 'none', corrected: false }
}

export function registerMemoActions(refresh: () => void, locale: string, labels: {
  createdAt: string
  duration: string
  summary: string
  corrected: string
  transcript: string
  chapters: string
  actionItems: string
  translation: string
}): void {
  registerActions({
    async memo_list(input) {
      const query = text(input?.query).toLowerCase()
      const source = text(input?.source) || 'all'
      const favOnly = input?.favOnly === true
      let rows = await allMemos()
      if (source !== 'all') rows = rows.filter((memo) => memo.source === source)
      if (favOnly) rows = rows.filter((memo) => memo.isFavourite)
      if (query) rows = rows.filter((memo) => memo.title.toLowerCase().includes(query))
      if (rows.length === 0) return { ok: true, text: 'No recordings match.', count: 0 }
      const lines = rows.map((memo, index) => {
        const flags = [
          memo.source === 'local' ? 'on-device' : 'library',
          memo.isFavourite ? 'favourite' : '',
          memo.hasTranscript ? 'transcribed' : '',
          memo.hasAudio ? '' : 'transcript-only',
        ].filter(Boolean).join(', ')
        return `${index + 1}. ${memo.title} — ${clockString(memo.duration)}, ${shortDate(memo.createdAt, locale)} `
          + `(${flags}) [id: ${memo.id}]`
      })
      return { ok: true, text: lines.join('\n'), count: rows.length }
    },

    async memo_transcribe(input) {
      const id = text(input?.id)
      if (!id) return { ok: false, text: 'Provide the recording id.' }
      const memo = await findMemo(id)
      if (!memo) return { ok: false, text: 'Recording not found.' }
      if (memo.source === 'local') {
        return {
          ok: false,
          text: 'On-device clips cannot be transcribed: the container has no path from applet-private audio '
            + 'into transcription. Record into the host library instead.',
        }
      }
      const locale = text(input?.locale)
      const result = await startTranscription(id, locale || undefined)
      refresh()
      return { ok: result.ok, text: result.ok ? result.text || `Transcription queued for '${memo.title}'.` : (result.error ?? 'Failed.') }
    },

    async memo_transcript(input) {
      const id = text(input?.id)
      if (!id) return { ok: false, text: 'Provide the recording id.' }
      const memo = await findMemo(id)
      if (!memo) return { ok: false, text: 'Recording not found.' }
      const readable = await readableTranscript(memo)
      if (!readable.text) {
        return { ok: true, text: `No transcript yet (status: ${readable.status}). Run memo_transcribe first.`, status: readable.status }
      }
      const prefix = readable.corrected ? '(speaker-corrected)\n\n' : ''
      return { ok: true, text: prefix + readable.text, status: readable.status }
    },

    async memo_summarize(input) {
      const id = text(input?.id)
      if (!id) return { ok: false, text: 'Provide the recording id.' }
      const memo = await findMemo(id)
      if (!memo) return { ok: false, text: 'Recording not found.' }
      const readable = await readableTranscript(memo)
      if (!readable.text.trim()) return { ok: false, text: 'No transcript — run memo_transcribe first.' }
      const template = (text(input?.template) || 'general') as SummaryTemplate
      try {
        const result = await summarize(readable.text, template)
        const artifacts = await loadArtifacts(memo.id, readable.text)
        await saveArtifacts({
          ...artifacts,
          summaryText: result.text,
          summaryPoints: result.points,
          summaryTemplate: template,
          summaryStatus: 'ready',
          sourceHash: hashText(readable.text),
        })
        refresh()
        const body = result.points.length
          ? `${result.text}\n\n${result.points.map((point) => `- ${point}`).join('\n')}`
          : result.text
        return { ok: true, text: body, template }
      } catch (error) {
        return { ok: false, text: `Could not summarize: ${String(error)}` }
      }
    },

    async memo_action_items(input) {
      const id = text(input?.id)
      if (!id) return { ok: false, text: 'Provide the recording id.' }
      const memo = await findMemo(id)
      if (!memo || memo.source === 'local') return { ok: false, text: 'Recording not found in the host library.' }
      const items = await fetchActionItems(id, input?.force === true)
      if (items.length === 0) return { ok: true, text: 'No action items found.', count: 0 }
      const lines = items.map((item) => {
        const tail = [item.owner, item.dueHint, item.sourceTime !== undefined ? clockString(item.sourceTime) : '']
          .filter(Boolean).join(' · ')
        return `- [${item.isDone ? 'x' : ' '}] (${item.kind}) ${item.text}${tail ? ` — ${tail}` : ''}`
      })
      refresh()
      return { ok: true, text: lines.join('\n'), count: items.length }
    },

    async memo_ask(input) {
      const id = text(input?.id)
      const question = text(input?.question)
      if (!id || !question) return { ok: false, text: 'Provide both the recording id and a question.' }
      const memo = await findMemo(id)
      if (!memo || memo.source === 'local') return { ok: false, text: 'Recording not found in the host library.' }
      const result = await askMemo(id, question)
      if (!result.ok || !result.text.trim()) return { ok: false, text: result.error ?? 'No answer.' }
      return { ok: true, text: result.text }
    },

    async memo_export(input) {
      const id = text(input?.id)
      if (!id) return { ok: false, text: 'Provide the recording id.' }
      const memo = await findMemo(id)
      if (!memo) return { ok: false, text: 'Recording not found.' }
      const format = (text(input?.format) || 'markdown') as 'markdown' | 'text' | 'srt'
      const transcript = memo.source === 'library' ? await fetchTranscript(memo.id) : null
      const artifacts = await loadArtifacts(memo.id, transcript?.fullText ?? '')
      const payload = {
        memo,
        locale,
        summary: artifacts.summaryText,
        transcript: transcript?.fullText ?? '',
        correctionTurns: artifacts.correctionTurns,
        chapters: artifacts.chapters,
        actionItems: artifacts.actionItems,
        translation: artifacts.translationText,
        labels,
      }
      const body = format === 'srt' ? exportSRT(payload) : format === 'text' ? exportText(payload) : exportMarkdown(payload)
      if (!body.trim()) return { ok: false, text: 'Nothing to export yet — transcribe the recording first.' }
      return { ok: true, text: body, format }
    },
  })
}
