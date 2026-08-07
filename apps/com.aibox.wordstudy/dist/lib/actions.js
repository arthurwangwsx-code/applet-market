// 5 个对 AI 提供的工具（规格 §17）。
//
// 与原生的两点差异（容器现状，规格 §20.8）：
//  ① 工具名不再是常驻的 `word_lookup`，宿主会把它投影成延迟工具 `appact_<hash>`，模型经
//     `tool_search / tool_describe / tool_call` 三步发现 —— 所以 manifest 里的 summary/keywords
//     就是可发现性本身，必须写足关键词。
//  ② `word_vocab_remove` 的"需确认"语义靠 manifest 的 `destructive: true` 表达。
//
// 返回一律**纯文本**（规格 §16），不是裸 JSON —— 模型读文本比读 JSON 稳。
import { registerActions } from 'aibox/sdk';
import { cryptoID, getEntry, listVocab, normalizeTerm, recordHistory, removeVocab, saveTranslation, upsertEntry, upsertVocab, } from './db.js';
import { LookupError, lookupWord, translateText } from './dict.js';
import { formatEntryText, formatVocabList, previewDirection } from './logic.js';
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
/** 注册整表 —— 只有整表注册才能在编译期抓到「漏注册 manifest 声明的 action」。 */
export function registerWordActions(refresh) {
    registerActions({
        async word_lookup(input) {
            const term = text(input?.term);
            if (!term)
                return { ok: false, text: 'Provide the word or phrase to look up.' };
            // 缓存命中直出，零网络零 AI。
            const cached = await getEntry(term);
            if (cached) {
                return {
                    ok: true,
                    text: formatEntryText(cached.payload),
                    word: cached.word,
                    source: cached.source,
                    cached: true,
                };
            }
            try {
                const payload = await lookupWord(term);
                // **写库用 upsertEntry**（命中只加计数），且查询历史 source 标 tool → 实际被丢弃。
                await upsertEntry(term, payload);
                await recordHistory(term, '', 'tool');
                refresh();
                return {
                    ok: true,
                    text: formatEntryText(payload),
                    word: payload.word,
                    source: payload.source ?? 'ai',
                    cached: false,
                };
            }
            catch (error) {
                const reason = error instanceof LookupError ? error.message : String(error);
                return { ok: false, text: `Couldn't look up '${term}' right now: ${reason}` };
            }
        },
        async word_translate(input) {
            const source = text(input?.text);
            if (!source)
                return { ok: false, text: 'Provide the text to translate.' };
            const direction = (text(input?.direction) || 'auto');
            const { from, to } = previewDirection(source, direction);
            try {
                const translated = (await translateText(source, from, to)).trim();
                if (!translated)
                    return { ok: false, text: "Couldn't translate that right now: empty response." };
                // 与 UI 共用同一张翻译历史表。
                await saveTranslation({
                    id: cryptoID(),
                    source,
                    target: translated,
                    srcLang: from,
                    dstLang: to,
                    at: Date.now(),
                    starred: false,
                });
                refresh();
                return { ok: true, text: translated, srcLang: from, dstLang: to };
            }
            catch (error) {
                return { ok: false, text: `Couldn't translate that right now: ${String(error)}` };
            }
        },
        async word_list_vocab(input) {
            const filter = text(input?.filter) || 'all';
            const query = text(input?.query).toLowerCase();
            const rawLimit = typeof input?.limit === 'number' ? input.limit : 50;
            // clamp 到 1..200 —— **下钳到 1**，负数不许透传。
            const limit = Math.min(200, Math.max(1, Math.round(rawLimit)));
            let items = await listVocab(500);
            if (query) {
                items = items.filter((item) => item.text.toLowerCase().includes(query) || (item.brief ?? '').toLowerCase().includes(query));
            }
            // **先截断再筛，是既有行为**（规格 §17.3）。
            items = items.slice(0, limit);
            items = items.filter((item) => matchesFilter(item, filter));
            return { ok: true, text: formatVocabList(items), count: items.length };
        },
        async word_vocab_upsert(input) {
            const term = text(input?.term);
            if (!term)
                return { ok: false, text: 'Provide the word or sentence to save.' };
            const kind = text(input?.kind) === 'sentence' ? 'sentence' : 'word';
            const mastered = typeof input?.mastered === 'boolean' ? input.mastered : undefined;
            const entry = await getEntry(term);
            const existing = (await listVocab(500)).find((item) => item.text === normalizeTerm(term));
            const { item, created } = await upsertVocab({
                term,
                kind,
                brief: entry?.brief ?? '',
                note: entry?.payload.examples[0]?.en ?? null,
                mastered,
            });
            refresh();
            if (created)
                return { ok: true, text: `Saved '${item.text}' to vocabulary.`, created: true };
            if (mastered !== undefined) {
                return {
                    ok: true,
                    text: mastered ? `Marked '${item.text}' as mastered.` : `Marked '${item.text}' as not mastered.`,
                    created: false,
                };
            }
            void existing;
            return { ok: true, text: `'${item.text}' is already in the saved vocabulary.`, created: false };
        },
        async word_vocab_remove(input) {
            const term = text(input?.term);
            if (!term)
                return { ok: false, text: 'Provide the word or sentence to remove.' };
            const removed = await removeVocab(term);
            refresh();
            return {
                ok: true,
                text: removed ? `Removed '${term}' from vocabulary.` : `'${term}' is not in the saved vocabulary.`,
                removed,
            };
        },
    });
}
function matchesFilter(item, filter) {
    switch (filter) {
        case 'word':
            return item.kind === 'word';
        case 'sentence':
            return item.kind === 'sentence';
        case 'mastered':
            return item.masteredAt !== null;
        case 'unmastered':
            return item.masteredAt === null;
        default:
            return true;
    }
}
