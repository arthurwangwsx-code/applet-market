// 查词三级降级链（规格 §10.1，顺序不可换）：
//   ① 本地缓存 WordEntry（命中直出，零网络）
//   ② 有道词典移动版网页抓取
//   ③ AI 单发生成 JSON
// ②③ 之间静默切换、用户无感知；抓取环节的任何失败都不抛给上层，直接进 AI 兜底。
import { fetchText, normalizeError } from 'aibox/sdk';
import { emptyPayload } from './logic.js';
/** 有道结果页很容易超过桥的 200KB 默认截断 —— **必须显式传 maxBytes**，否则例句区解析不出来且不报错。 */
const YOUDAO_MAX_BYTES = 2_000_000;
/** 容器固定 30s 超时，原生是 8s。查词卡 30 秒体验很差 → 页面侧自己套一个 8s 的竞速。 */
const LOOKUP_TIMEOUT_MS = 8_000;
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
function timeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('aibox/timeout: lookup timed out')), ms);
        promise.then((value) => {
            clearTimeout(timer);
            resolve(value);
        }, (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}
// —— ② 有道抓取 ——
function text(node) {
    return (node?.textContent ?? '').trim();
}
/**
 * 解析有道结果页。
 * `.ec.dict-module`（音标）与 `.simple.dict-module`（释义）是**平级两个区块，不是父子**；
 * `.sents_con` 又是第三个平级区块 —— 别用 `.dict-module` 笼统扫，会混进网络释义与短语。
 * `data-v-*` 是 Vue scoped-style 哈希、会变，选择器绝不能依赖它。
 */
export function parseYoudao(html, word) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const simple = doc.querySelector('.simple.dict-module');
    // 找不到简明词典根 → 直接放弃这个数据源。
    if (!simple)
        return null;
    const senses = [];
    simple.querySelectorAll('.word-exp').forEach((node) => {
        const gloss = text(node.querySelector('.trans'));
        if (!gloss)
            return; // 释义为空则跳过该条
        senses.push({ pos: text(node.querySelector('.pos')), glosses: [gloss] });
    });
    // 一条释义都没解出来 → 返回 null。
    if (senses.length === 0)
        return null;
    let phoneticUK = null;
    let phoneticUS = null;
    doc.querySelectorAll('.ec.dict-module .per-phone').forEach((node) => {
        // 标签 = 该元素的**第一个子元素**的文本（不是直接文本节点）。
        const label = text(node.firstElementChild);
        const ipa = text(node.querySelector('.phonetic')).replace(/^[/\s]+|[/\s]+$/g, '');
        if (!ipa)
            return;
        if (label.includes('英'))
            phoneticUK = ipa;
        else if (label.includes('美'))
            phoneticUS = ipa;
    });
    const examTags = [];
    simple.querySelectorAll('.exam_type-value').forEach((node) => {
        const value = text(node);
        if (value)
            examTags.push(value);
    });
    const forms = [];
    simple.querySelectorAll('.m-word-wfs-cell').forEach((node) => {
        const label = text(node.querySelector('.wfs-name'));
        const value = text(node.querySelector('.wordLine'));
        if (label && value)
            forms.push({ label, value });
    });
    const examples = [];
    doc.querySelectorAll('.sents_con .mcols').forEach((node) => {
        if (examples.length >= 3)
            return; // 最多取 3 条
        const en = text(node.querySelector('.word-cont p.wordLine'));
        const zh = text(node.querySelector('.word-cont p.grey'));
        if (en && zh)
            examples.push({ en, zh });
    });
    return {
        // `word` 用**用户查的那个词**，不是页面解析出的。
        word,
        corrected: null,
        phoneticUK,
        phoneticUS,
        senses,
        forms,
        examTags,
        frequency: null,
        examples,
        synonyms: [],
        antonyms: [],
        memoryTip: null,
        source: 'youdao',
    };
}
async function scrapeYoudao(word) {
    let url;
    try {
        url = `https://dict.youdao.com/result?word=${encodeURIComponent(word)}&lang=en`;
    }
    catch {
        return null; // 编码失败则跳过该站点
    }
    try {
        const html = await timeout(fetchText(url, { headers: { 'User-Agent': MOBILE_UA }, maxBytes: YOUDAO_MAX_BYTES, allowTruncated: true }), LOOKUP_TIMEOUT_MS);
        return parseYoudao(html, word);
    }
    catch {
        // 网络 / 超时 / 非 2xx / 解析抛错一律不抛给上层，静默切到 AI。
        return null;
    }
}
// —— §14.4 AI 返回的宽容 JSON 解析（照抄） ——
export function lenientJSON(raw) {
    let text = String(raw ?? '').trim();
    if (text.startsWith('```')) {
        const lines = text.split('\n');
        if (lines[0]?.startsWith('```'))
            lines.shift();
        if (lines[lines.length - 1]?.startsWith('```'))
            lines.pop();
        text = lines.join('\n');
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start)
        text = text.slice(start, end + 1);
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
// —— ③ AI 兜底 ——
/** 查词 prompt（恒英文，规格 §14.1 原文照抄）。 */
function lookupPrompt(word) {
    return `You are a bilingual English/Chinese dictionary generator. Given an English word or short phrase, output ONLY a single JSON object (no markdown fences, no explanation, no extra text) with exactly this shape:

{
  "word": "the normalized word or phrase",
  "corrected": null or "a spelling-corrected suggestion if the input looks misspelled",
  "phoneticUK": null or "IPA transcription, no slashes",
  "phoneticUS": null or "IPA transcription, no slashes",
  "senses": [ { "pos": "part-of-speech abbreviation like vi. / n. / adj.", "glosses": ["Chinese gloss", "..."] } ],
  "forms": [ { "label": "Chinese label like 过去式", "value": "inflected form" } ],
  "examTags": ["exam tags in Chinese like CET-4, CET-6, 考研, 雅思, 托福 — omit if not applicable"],
  "frequency": null or an integer 1-5 for how common the word is,
  "examples": [ { "en": "English example sentence", "zh": "Chinese translation" } ] (2-3 items),
  "synonyms": ["English synonym", "..."],
  "antonyms": ["English antonym", "..."],
  "memoryTip": null or "a short Chinese mnemonic using word roots, sound association, or imagery"
}

Word to look up: ${word}`;
}
function array(value, map) {
    if (!Array.isArray(value))
        return [];
    const out = [];
    for (const raw of value) {
        if (!raw || typeof raw !== 'object')
            continue;
        const mapped = map(raw);
        if (mapped)
            out.push(mapped);
    }
    return out;
}
function strings(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}
function optionalString(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    return text ? text : null;
}
/** 把 AI 的宽容 JSON 归一成 payload。缺字段一律走默认值，不因为一处缺失整条失败。 */
export function payloadFromAI(raw, fallbackWord) {
    const frequency = typeof raw.frequency === 'number' && Number.isFinite(raw.frequency) ? Math.round(raw.frequency) : null;
    return {
        word: optionalString(raw.word) ?? fallbackWord,
        corrected: optionalString(raw.corrected),
        phoneticUK: optionalString(raw.phoneticUK),
        phoneticUS: optionalString(raw.phoneticUS),
        senses: array(raw.senses, (item) => {
            const glosses = strings(item.glosses);
            if (glosses.length === 0)
                return null;
            return { pos: String(item.pos ?? '').trim(), glosses };
        }),
        forms: array(raw.forms, (item) => {
            const label = String(item.label ?? '').trim();
            const value = String(item.value ?? '').trim();
            return label && value ? { label, value } : null;
        }),
        examTags: strings(raw.examTags),
        frequency,
        examples: array(raw.examples, (item) => {
            const en = String(item.en ?? '').trim();
            if (!en)
                return null;
            return { en, zh: String(item.zh ?? '').trim() };
        }),
        synonyms: strings(raw.synonyms),
        antonyms: strings(raw.antonyms),
        memoryTip: optionalString(raw.memoryTip),
        source: null,
    };
}
function ai() {
    const api = typeof window !== 'undefined' ? window.aibox : undefined;
    return api?.ai && typeof api.ai.generate === 'function' ? api.ai : undefined;
}
export class LookupError extends Error {
}
/**
 * 查词（不含缓存层，缓存由调用方管）。抓取优先，AI 只是兜底。
 * 抓取成功时 `synonyms/antonyms/memoryTip/frequency/corrected` 五个字段天然为空 —— 页面要能优雅缺省。
 */
export async function lookupWord(word) {
    const term = String(word ?? '').trim();
    if (!term)
        throw new LookupError('Provide the word or phrase to look up.');
    const scraped = await scrapeYoudao(term);
    if (scraped)
        return scraped;
    const api = ai();
    if (!api)
        throw new LookupError('No AI provider is configured for the selected model.');
    let raw;
    try {
        raw = await api.generate({ prompt: lookupPrompt(term), maxTokens: 900, temperature: 0.3, intent: 'balanced' });
    }
    catch (error) {
        throw new LookupError(normalizeError(error).message);
    }
    const parsed = lenientJSON(raw);
    if (!parsed)
        throw new LookupError("The AI response couldn't be parsed.");
    const payload = payloadFromAI(parsed, term);
    if (payload.senses.length === 0)
        throw new LookupError("The AI response couldn't be parsed.");
    return payload;
}
// —— 翻译 ——
const LANG_NAME = { en: 'English', zh: 'Chinese' };
function translatePrompt(text, from, to) {
    return (`Translate the text below from ${LANG_NAME[from]} to ${LANG_NAME[to]}. ` +
        `Output ONLY the translation — no explanation, no quotes, no markdown.\n\nText: ${text}`);
}
/**
 * 流式翻译。**system 提示是空串。**
 * 收尾细节：某些 provider 不发增量、只在结束时给整段 —— 若全程一个增量都没收到但最终文本非空，
 * 补发一次整段（否则页面会一片空白）。
 */
export async function translateStream(input) {
    const api = ai();
    if (!api)
        throw new LookupError('No AI provider is configured for the selected model.');
    const prompt = translatePrompt(input.text, input.from, input.to);
    if (typeof api.generateStream === 'function') {
        let received = false;
        let full = '';
        const stream = api.generateStream({ prompt, maxTokens: 2000, temperature: 0.2, intent: 'balanced' });
        for await (const delta of stream) {
            if (!delta)
                continue;
            received = true;
            full += delta;
            input.onDelta(delta);
        }
        if (!received && full.trim())
            input.onDelta(full);
        return full;
    }
    const full = await api.generate({ prompt, maxTokens: 2000, temperature: 0.2, intent: 'balanced' });
    input.onDelta(full);
    return full;
}
/** 非流式翻译（工具路径用：把整个流 drain 成一段文本一次性返回）。 */
export async function translateText(text, from, to) {
    const api = ai();
    if (!api)
        throw new LookupError('No AI provider is configured for the selected model.');
    return api.generate({
        prompt: translatePrompt(text, from, to),
        maxTokens: 2000,
        temperature: 0.2,
        intent: 'balanced',
    });
}
// —— 每日一句 ——
function dailyPrompt(dateKey) {
    return `Output ONLY a single JSON object (no markdown fences, no explanation) with exactly this shape:
{ "en": "a well-known, inspiring or thought-provoking English quotation, 10-25 words", "zh": "an accurate, natural Chinese translation", "author": "the quotation's author (in Chinese if well-known)" }

Pick a quotation that feels fresh, not one of the most overused ones. Today's date: ${dateKey}.`;
}
/** AI 生成每日一句。失败返回 null（调用方落种子兜底，静默不报错）。 */
export async function generateDaily(dateKey) {
    const api = ai();
    if (!api)
        return null;
    try {
        const raw = await api.generate({ prompt: dailyPrompt(dateKey), maxTokens: 200, temperature: 0.9, intent: 'fast' });
        const parsed = lenientJSON(raw);
        if (!parsed)
            return null;
        const en = String(parsed.en ?? '').trim();
        if (!en)
            return null;
        return { en, zh: String(parsed.zh ?? '').trim(), author: String(parsed.author ?? '').trim() };
    }
    catch {
        return null;
    }
}
export { emptyPayload };
