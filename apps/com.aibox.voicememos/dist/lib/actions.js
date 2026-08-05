// 7 个对 AI 提供的工具。
//
// **2.0.0：这一组现在是这些能力的唯一提供者**，而不是宿主 `memo_*` 的补齐层。
// 它们经 applet action 通道投影成延迟工具（`appact_<hash>`，模型经
// `tool_search / tool_describe / tool_call` 三步发现），全部长在本应用自己的数据上。
//
// ⚠️ **代价要说清楚**：延迟工具不进常驻 tools 前缀，模型的可发现性比常驻 `memo_*` 低一档
//（从"一直看得见"变成"搜得到"）。这是「原生模块可退役」的真实代价，不是实现细节——
// 所以每条 action 的 `keywords` 必须写足中英双语，`tool_search` 全靠它命中。
import { registerActions } from '../lib/aibox-sdk.js';
import { actionItems as extractActionItems, ask as askAI, summarize } from './ai.js';
import { clockString, exportMarkdown, exportSRT, exportText, hashText, shortDate } from './format.js';
import { clipToMemo, listClips, loadArtifacts, localeTag, saveArtifacts, saveClip, transcribeClip, } from './memos.js';
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
async function liveClips() {
    return (await listClips()).filter((clip) => !clip.isTrashed);
}
async function allMemos() {
    return (await liveClips()).map(clipToMemo).sort((a, b) => b.createdAt - a.createdAt);
}
async function findClip(id) {
    return (await liveClips()).find((clip) => clip.id === id) ?? null;
}
/** 取一条录音的可读文稿：优先本应用的校正稿，否则原始转写。 */
async function readableTranscript(clip) {
    const raw = clip.transcriptText ?? '';
    const status = clip.transcriptStatus ?? (raw ? 'completed' : 'none');
    const artifacts = await loadArtifacts(clip.id, raw);
    if (artifacts.correctionTurns.length) {
        return {
            text: artifacts.correctionTurns.map((turn) => (turn.speaker ? `${turn.speaker}: ${turn.text}` : turn.text)).join('\n\n'),
            status,
            corrected: true,
        };
    }
    return { text: raw, status, corrected: false };
}
export function registerMemoActions(refresh, locale, labels) {
    registerActions({
        async memo_list(input) {
            const query = text(input?.query).toLowerCase();
            const favOnly = input?.favOnly === true;
            let rows = await allMemos();
            if (favOnly)
                rows = rows.filter((memo) => memo.isFavourite);
            if (query)
                rows = rows.filter((memo) => memo.title.toLowerCase().includes(query));
            if (rows.length === 0)
                return { ok: true, text: 'No recordings match.', count: 0 };
            const lines = rows.map((memo, index) => {
                const flags = [
                    memo.isFavourite ? 'favourite' : '',
                    memo.hasTranscript ? 'transcribed' : '',
                    memo.hasAudio ? '' : 'transcript-only',
                ].filter(Boolean).join(', ');
                return `${index + 1}. ${memo.title} — ${clockString(memo.duration)}, ${shortDate(memo.createdAt, locale)} `
                    + `(${flags}) [id: ${memo.id}]`;
            });
            return { ok: true, text: lines.join('\n'), count: rows.length };
        },
        async memo_transcribe(input) {
            const id = text(input?.id);
            if (!id)
                return { ok: false, text: 'Provide the recording id.' };
            const clip = await findClip(id);
            if (!clip)
                return { ok: false, text: 'Recording not found.' };
            if (clip.transcriptText) {
                return { ok: true, text: `'${clip.title}' is already transcribed. Read it with memo_transcript.` };
            }
            // 2.0.0 起这是**同步**的：`aibox.audio.transcribe` 转完才 resolve，所以不再有
            // 「排进队列了，请稍后轮询」那一套（1.x 的宿主 `memo_transcribe` 是异步排队）。
            const wanted = text(input?.locale);
            const outcome = await transcribeClip(clip.handle, wanted ? wanted.replace('_', '-') : localeTag('auto'));
            if (!outcome.ok)
                return { ok: false, text: `Could not transcribe: ${outcome.error}` };
            await saveClip({
                ...clip,
                transcriptText: outcome.text,
                transcriptLocale: outcome.locale,
                transcriptSegments: outcome.segments,
                transcriptStatus: 'completed',
            });
            refresh();
            return { ok: true, text: outcome.text || `Transcribed '${clip.title}' (no speech detected).` };
        },
        async memo_transcript(input) {
            const id = text(input?.id);
            if (!id)
                return { ok: false, text: 'Provide the recording id.' };
            const clip = await findClip(id);
            if (!clip)
                return { ok: false, text: 'Recording not found.' };
            const readable = await readableTranscript(clip);
            if (!readable.text) {
                return { ok: true, text: `No transcript yet (status: ${readable.status}). Run memo_transcribe first.`, status: readable.status };
            }
            const prefix = readable.corrected ? '(speaker-corrected)\n\n' : '';
            return { ok: true, text: prefix + readable.text, status: readable.status };
        },
        async memo_summarize(input) {
            const id = text(input?.id);
            if (!id)
                return { ok: false, text: 'Provide the recording id.' };
            const clip = await findClip(id);
            if (!clip)
                return { ok: false, text: 'Recording not found.' };
            const readable = await readableTranscript(clip);
            if (!readable.text.trim())
                return { ok: false, text: 'No transcript — run memo_transcribe first.' };
            const template = (text(input?.template) || 'general');
            try {
                const result = await summarize(readable.text, template);
                const artifacts = await loadArtifacts(clip.id, readable.text);
                await saveArtifacts({
                    ...artifacts,
                    summaryText: result.text,
                    summaryPoints: result.points,
                    summaryTemplate: template,
                    summaryStatus: 'ready',
                    sourceHash: hashText(readable.text),
                });
                refresh();
                const body = result.points.length
                    ? `${result.text}\n\n${result.points.map((point) => `- ${point}`).join('\n')}`
                    : result.text;
                return { ok: true, text: body, template };
            }
            catch (error) {
                return { ok: false, text: `Could not summarize: ${String(error)}` };
            }
        },
        async memo_action_items(input) {
            const id = text(input?.id);
            if (!id)
                return { ok: false, text: 'Provide the recording id.' };
            const clip = await findClip(id);
            if (!clip)
                return { ok: false, text: 'Recording not found.' };
            const readable = await readableTranscript(clip);
            if (!readable.text.trim())
                return { ok: false, text: 'No transcript — run memo_transcribe first.' };
            const artifacts = await loadArtifacts(clip.id, readable.text);
            const cached = artifacts.actionItems;
            const items = (!cached.length || input?.force === true)
                ? await extractActionItems(readable.text).catch(() => [])
                : cached;
            if (items !== cached)
                await saveArtifacts({ ...artifacts, actionItems: items, sourceHash: hashText(readable.text) });
            if (items.length === 0)
                return { ok: true, text: 'No action items found.', count: 0 };
            const lines = items.map((item) => {
                const tail = [item.owner, item.dueHint, item.sourceTime !== undefined ? clockString(item.sourceTime) : '']
                    .filter(Boolean).join(' · ');
                return `- [${item.isDone ? 'x' : ' '}] (${item.kind}) ${item.text}${tail ? ` — ${tail}` : ''}`;
            });
            refresh();
            return { ok: true, text: lines.join('\n'), count: items.length };
        },
        async memo_ask(input) {
            const id = text(input?.id);
            const question = text(input?.question);
            if (!id || !question)
                return { ok: false, text: 'Provide both the recording id and a question.' };
            const clip = await findClip(id);
            if (!clip)
                return { ok: false, text: 'Recording not found.' };
            const readable = await readableTranscript(clip);
            if (!readable.text.trim())
                return { ok: false, text: 'No transcript — run memo_transcribe first.' };
            const answer = await askAI(readable.text, question).catch(() => '');
            if (!answer.trim())
                return { ok: false, text: 'No answer.' };
            return { ok: true, text: answer };
        },
        async memo_export(input) {
            const id = text(input?.id);
            if (!id)
                return { ok: false, text: 'Provide the recording id.' };
            const clip = await findClip(id);
            if (!clip)
                return { ok: false, text: 'Recording not found.' };
            const format = (text(input?.format) || 'markdown');
            const artifacts = await loadArtifacts(clip.id, clip.transcriptText ?? '');
            const payload = {
                memo: clipToMemo(clip),
                locale,
                summary: artifacts.summaryText,
                transcript: clip.transcriptText ?? '',
                correctionTurns: artifacts.correctionTurns,
                chapters: artifacts.chapters,
                actionItems: artifacts.actionItems,
                translation: artifacts.translationText,
                labels,
            };
            const body = format === 'srt' ? exportSRT(payload) : format === 'text' ? exportText(payload) : exportMarkdown(payload);
            if (!body.trim())
                return { ok: false, text: 'Nothing to export yet — transcribe the recording first.' };
            return { ok: true, text: body, format };
        },
    });
}
