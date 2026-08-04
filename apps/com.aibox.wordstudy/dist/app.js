var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
import { useState, useEffect, useMemo, useCallback, useRef, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
function bridge() {
  try {
    return typeof window !== "undefined" ? window.aibox : void 0;
  } catch {
    return void 0;
  }
}
__name(bridge, "bridge");
function available(name, method) {
  const host = bridge();
  const ns = host?.[name];
  if (!ns || typeof ns !== "object")
    return false;
  if (!method)
    return true;
  return typeof ns[method] === "function";
}
__name(available, "available");
function useBridgeEvent(namespace, event, handler, enabled = true) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!enabled)
      return void 0;
    const host = bridge();
    const ns = host?.[namespace];
    if (!ns || typeof ns.on !== "function")
      return void 0;
    let unsubscribe;
    try {
      unsubscribe = ns.on(event, (payload) => latest.current(payload));
    } catch {
      return void 0;
    }
    return () => {
      if (typeof unsubscribe === "function") {
        try {
          unsubscribe();
        } catch {
        }
      }
    };
  }, [namespace, event, enabled]);
}
__name(useBridgeEvent, "useBridgeEvent");
function useTabs() {
  const [state, setState] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const host = bridge();
    if (!host?.tabs)
      return void 0;
    host.tabs.getState().then((next) => {
      if (!cancelled)
        setState(next);
    }).catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, []);
  useBridgeEvent("tabs", "changed", (payload) => setState(payload));
  const select = useCallback((id) => {
    const host = bridge();
    if (!host?.tabs)
      return;
    host.tabs.select(id).then(setState).catch(() => void 0);
  }, []);
  const setBadge = useCallback((id, badge) => {
    const host = bridge();
    if (!host?.tabs)
      return;
    host.tabs.update({ items: { [id]: { badge } } }).then(setState).catch(() => void 0);
  }, []);
  return {
    state,
    selected: state?.selected ?? null,
    rendered: Boolean(state?.declared && state?.rendered),
    select,
    setBadge
  };
}
__name(useTabs, "useTabs");
function useLocale() {
  const initial = useMemo(() => {
    if (typeof window === "undefined")
      return { locale: "en", language: "en" };
    const injected = window.__aiboxEnvironment;
    if (injected?.locale)
      return { locale: injected.locale, language: injected.language || injected.locale };
    const navigatorLanguage = typeof navigator !== "undefined" ? navigator.language : "en";
    return { locale: navigatorLanguage, language: navigatorLanguage };
  }, []);
  const [value, setValue] = useState(initial);
  useBridgeEvent("events", "localeChanged", (payload) => {
    const next = payload ?? {};
    if (!next.locale)
      return;
    setValue({ locale: next.locale, language: next.language || next.locale });
  });
  return value;
}
__name(useLocale, "useLocale");
function useScene() {
  const [state, setState] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const host = bridge();
    if (!host?.scene)
      return void 0;
    host.scene.getState().then((next) => {
      if (!cancelled)
        setState(next);
    }).catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, []);
  useBridgeEvent("scene", "changed", (payload) => setState(payload));
  return state;
}
__name(useScene, "useScene");
class AiboxError extends Error {
  static {
    __name(this, "AiboxError");
  }
  code;
  rpcCode;
  data;
  constructor(code, message, options) {
    super(message);
    this.name = "AiboxError";
    this.code = code;
    this.rpcCode = options?.rpcCode;
    this.data = options?.data;
    if (options?.cause !== void 0)
      this.cause = options.cause;
  }
}
function isAiboxError(value) {
  return value instanceof AiboxError;
}
__name(isAiboxError, "isAiboxError");
const CODE_IN_MESSAGE = /\b(aibox\/[a-z][a-z0-9-]*)/;
function normalizeError(value) {
  if (isAiboxError(value))
    return value;
  const raw = value;
  const message = typeof raw?.message === "string" && raw.message ? raw.message : String(value);
  const explicit = typeof raw?.code === "string" && raw.code.startsWith("aibox/") ? raw.code : void 0;
  const parsed = explicit ?? CODE_IN_MESSAGE.exec(message)?.[1] ?? "aibox/internal-error";
  return new AiboxError(parsed, message, {
    rpcCode: typeof raw?.rpcCode === "number" ? raw.rpcCode : void 0,
    data: raw?.data,
    cause: value
  });
}
__name(normalizeError, "normalizeError");
function isAvailable(namespace, method) {
  return available(namespace, method);
}
__name(isAvailable, "isAvailable");
function requireNet() {
  const host = bridge();
  if (!host?.net || typeof host.net.fetch !== "function") {
    throw new AiboxError("aibox/unavailable", 'aibox/unavailable: aibox.net.fetch is not registered. Set "network": true and list hosts in manifest.permissions.networkAllowed — page-level fetch() is blocked by CSP and will never work.');
  }
  return host.net;
}
__name(requireNet, "requireNet");
function assertResponse(url, meta, options) {
  if (!options.allowErrorStatus && (meta.status < 200 || meta.status >= 300)) {
    throw new AiboxError("aibox/upstream-failed", `aibox/upstream-failed: ${meta.status} from ${url}`, { data: meta });
  }
  if (!options.allowTruncated && meta.truncated) {
    throw new AiboxError("aibox/truncated", `aibox/truncated: ${url} returned ${meta.bytes} bytes and was cut off. Raise maxBytes, or pass allowTruncated: true if a partial body is genuinely acceptable.`, { data: meta });
  }
}
__name(assertResponse, "assertResponse");
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1)
    bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64ToBytes, "base64ToBytes");
async function rawFetch(url, responseType, options) {
  const net = requireNet();
  try {
    const response = await net.fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      responseType,
      maxBytes: options.maxBytes
    });
    const meta = {
      status: response.status,
      headers: response.headers ?? {},
      contentType: response.contentType ?? null,
      truncated: Boolean(response.truncated),
      bytes: response.bytes ?? 0
    };
    return { body: response.body, meta };
  } catch (error) {
    throw normalizeError(error);
  }
}
__name(rawFetch, "rawFetch");
async function fetchText(url, options = {}) {
  const encoding = (options.encoding ?? "utf8").toLowerCase();
  const isUTF8 = encoding === "utf8" || encoding === "utf-8";
  const { body, meta } = await rawFetch(url, isUTF8 ? "text" : "base64", options);
  assertResponse(url, meta, options);
  if (isUTF8)
    return typeof body === "string" ? body : String(body ?? "");
  const bytes = base64ToBytes(typeof body === "string" ? body : "");
  try {
    return new TextDecoder(options.encoding).decode(bytes);
  } catch (error) {
    throw new AiboxError("aibox/parse-failed", `aibox/parse-failed: unsupported encoding "${options.encoding}"`, { cause: error });
  }
}
__name(fetchText, "fetchText");
const PAGE = 500;
function requireDB() {
  const host = bridge();
  if (!host?.db || typeof host.db.query !== "function") {
    throw new AiboxError("aibox/unavailable", "aibox/unavailable: aibox.db is not available in this build.");
  }
  return host.db;
}
__name(requireDB, "requireDB");
async function queryAll(collection, options = {}) {
  const db = requireDB();
  const out = [];
  const { where, sortBy, descending, max } = options;
  for (let offset = 0; ; offset += PAGE) {
    const request = { collection, limit: PAGE, offset };
    if (where)
      request.where = where;
    if (sortBy)
      request.sortBy = sortBy;
    if (descending !== void 0)
      request.descending = descending;
    const page = await db.query(request);
    const rows = Array.isArray(page) ? page : [];
    out.push(...rows);
    if (max !== void 0 && out.length >= max)
      return out.slice(0, max);
    if (rows.length < PAGE)
      break;
  }
  return out;
}
__name(queryAll, "queryAll");
async function removeMany(collection, ids) {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  if (unique.length === 0)
    return 0;
  const db = requireDB();
  if (typeof db.removeWhere !== "function") {
    let removed2 = 0;
    for (const id of unique) {
      if (await db.remove({ collection, id }))
        removed2 += 1;
    }
    return removed2;
  }
  const removed = await db.removeWhere({ collection, where: { _id: { $in: unique } } });
  return typeof removed === "number" ? removed : unique.length;
}
__name(removeMany, "removeMany");
function registerActions(handlers) {
  const host = bridge();
  if (!host?.action || typeof host.action.register !== "function")
    return;
  for (const [name, handler] of Object.entries(handlers)) {
    if (typeof handler !== "function")
      continue;
    host.action.register(name, handler);
  }
}
__name(registerActions, "registerActions");
const COLLECTIONS = {
  entries: "wordEntries",
  history: "lookupHistory",
  vocab: "vocabItems",
  translations: "translations",
  daily: "dailySentences"
};
const LIMITS = { history: 500, translations: 200 };
function asDoc(value) {
  return value;
}
__name(asDoc, "asDoc");
const memory = /* @__PURE__ */ new Map();
function bridgeDB() {
  const api2 = typeof window !== "undefined" ? window.aibox : void 0;
  return api2 && api2.db && typeof api2.db.query === "function" ? api2.db : void 0;
}
__name(bridgeDB, "bridgeDB");
function memoryBucket(collection) {
  let bucket = memory.get(collection);
  if (!bucket) {
    bucket = /* @__PURE__ */ new Map();
    memory.set(collection, bucket);
  }
  return bucket;
}
__name(memoryBucket, "memoryBucket");
async function all(collection) {
  if (!bridgeDB()) return [...memoryBucket(collection).values()];
  try {
    return await queryAll(collection);
  } catch {
    return [];
  }
}
__name(all, "all");
async function put(collection, document2) {
  const db = bridgeDB();
  if (!db) {
    const id = String(document2._id ?? cryptoID());
    memoryBucket(collection).set(id, { ...document2, _id: id });
    return;
  }
  try {
    await db.insert({ collection, document: document2 });
  } catch {
  }
}
__name(put, "put");
async function drop(collection, id) {
  const db = bridgeDB();
  if (!db) {
    memoryBucket(collection).delete(id);
    return;
  }
  try {
    await db.remove({ collection, id });
  } catch {
  }
}
__name(drop, "drop");
async function dropMany(collection, ids) {
  const list = ids.filter(Boolean);
  if (list.length === 0) return;
  if (!bridgeDB()) {
    const bucket = memoryBucket(collection);
    for (const id of list) bucket.delete(id);
    return;
  }
  try {
    await removeMany(collection, list);
  } catch {
  }
}
__name(dropMany, "dropMany");
function cryptoID() {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : void 0;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
__name(cryptoID, "cryptoID");
function normalizeTerm(text2) {
  return String(text2 ?? "").trim().toLowerCase();
}
__name(normalizeTerm, "normalizeTerm");
function normalizeHistoryTerm(text2) {
  return String(text2 ?? "").split(/\s+/).filter(Boolean).join(" ").toLowerCase();
}
__name(normalizeHistoryTerm, "normalizeHistoryTerm");
function deriveBrief(payload) {
  const sense = payload.senses[0];
  if (!sense) return "";
  const gloss = sense.glosses[0] ?? "";
  return [sense.pos, gloss].filter(Boolean).join(" ").trim();
}
__name(deriveBrief, "deriveBrief");
async function getEntry(word) {
  const key = normalizeTerm(word);
  if (!key) return null;
  const rows = await all(COLLECTIONS.entries);
  return rows.find((row) => row.word === key) ?? null;
}
__name(getEntry, "getEntry");
async function listEntries() {
  return all(COLLECTIONS.entries);
}
__name(listEntries, "listEntries");
function entryFrom(word, payload, now, previous) {
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
    source: payload.source ?? "ai"
  };
}
__name(entryFrom, "entryFrom");
async function upsertEntry(word, payload) {
  const key = normalizeTerm(word);
  const rows = await all(COLLECTIONS.entries);
  const previous = rows.find((row) => row.word === key);
  const now = Date.now();
  if (previous) {
    const bumped = { ...previous, lookupCount: previous.lookupCount + 1, lastLookupAt: now };
    await put(COLLECTIONS.entries, asDoc(bumped));
    return bumped;
  }
  const created = entryFrom(word, payload, now);
  await put(COLLECTIONS.entries, asDoc(created));
  return created;
}
__name(upsertEntry, "upsertEntry");
async function replaceEntry(word, payload) {
  const key = normalizeTerm(word);
  const rows = await all(COLLECTIONS.entries);
  const previous = rows.find((row) => row.word === key);
  const created = entryFrom(word, payload, Date.now(), previous);
  await put(COLLECTIONS.entries, asDoc(created));
  return created;
}
__name(replaceEntry, "replaceEntry");
async function listHistory(limit = 50) {
  const rows = await dedupeHistory();
  return rows.slice(0, limit);
}
__name(listHistory, "listHistory");
async function dedupeHistory() {
  const rows = await all(COLLECTIONS.history);
  rows.sort((a, b) => b.at - a.at);
  const seen = /* @__PURE__ */ new Set();
  const keep = [];
  const stale = [];
  for (const row of rows) {
    if (seen.has(row.term)) stale.push(row);
    else {
      seen.add(row.term);
      keep.push(row);
    }
  }
  const overflow = keep.slice(LIMITS.history);
  await dropMany(COLLECTIONS.history, [...stale, ...overflow].map((row) => row._id));
  return keep.slice(0, LIMITS.history);
}
__name(dedupeHistory, "dedupeHistory");
async function recordHistory(term, brief, source = "ui") {
  if (source === "tool") return;
  const key = normalizeHistoryTerm(term);
  if (!key) return;
  const rows = await all(COLLECTIONS.history);
  const previous = rows.find((row) => row.term === key);
  await put(COLLECTIONS.history, {
    _id: previous?._id ?? cryptoID(),
    term: key,
    brief,
    at: Date.now()
  });
}
__name(recordHistory, "recordHistory");
async function removeHistory(term) {
  const key = normalizeHistoryTerm(term);
  const rows = await all(COLLECTIONS.history);
  await dropMany(COLLECTIONS.history, rows.filter((item) => item.term === key).map((row) => row._id));
}
__name(removeHistory, "removeHistory");
async function clearHistory() {
  const rows = await all(COLLECTIONS.history);
  await dropMany(COLLECTIONS.history, rows.map((row) => row._id));
}
__name(clearHistory, "clearHistory");
async function listVocab(limit = 500) {
  const rows = await all(COLLECTIONS.vocab);
  rows.sort((a, b) => b.addedAt - a.addedAt);
  return rows.slice(0, limit);
}
__name(listVocab, "listVocab");
async function upsertVocab(input) {
  const key = normalizeTerm(input.term);
  const rows = await all(COLLECTIONS.vocab);
  const previous = rows.find((row) => row.text === key);
  const now = Date.now();
  if (previous) {
    const next = {
      ...previous,
      brief: input.brief && !previous.brief ? input.brief : previous.brief,
      note: previous.note && previous.note.trim() ? previous.note : input.note ?? previous.note,
      masteredAt: input.mastered === void 0 ? previous.masteredAt : input.mastered ? previous.masteredAt ?? now : null
    };
    await put(COLLECTIONS.vocab, asDoc(next));
    return { item: next, created: false };
  }
  const created = {
    _id: cryptoID(),
    text: key,
    kind: input.kind ?? "word",
    brief: input.brief ?? "",
    addedAt: now,
    // 新词 box=0、nextReviewAt=null → **立刻到期**，不用先等一轮（规格 §12.4）。
    box: 0,
    nextReviewAt: null,
    reviewCount: 0,
    masteredAt: input.mastered ? now : null,
    note: input.note ?? null
  };
  await put(COLLECTIONS.vocab, asDoc(created));
  return { item: created, created: true };
}
__name(upsertVocab, "upsertVocab");
async function removeVocab(term) {
  const key = normalizeTerm(term);
  const rows = await all(COLLECTIONS.vocab);
  const hit = rows.find((row) => row.text === key);
  if (!hit) return false;
  await drop(COLLECTIONS.vocab, hit._id);
  return true;
}
__name(removeVocab, "removeVocab");
async function saveReview(term, box, nextReviewAt) {
  const key = normalizeTerm(term);
  const rows = await all(COLLECTIONS.vocab);
  const hit = rows.find((row) => row.text === key);
  if (!hit) return;
  await put(COLLECTIONS.vocab, asDoc({ ...hit, box, nextReviewAt, reviewCount: hit.reviewCount + 1 }));
}
__name(saveReview, "saveReview");
async function listTranslations(limit = 50) {
  const rows = await all(COLLECTIONS.translations);
  rows.sort((a, b) => b.at - a.at);
  await dropMany(COLLECTIONS.translations, rows.slice(LIMITS.translations).map((row) => row._id));
  return rows.slice(0, limit);
}
__name(listTranslations, "listTranslations");
async function getTranslation(id) {
  const rows = await all(COLLECTIONS.translations);
  return rows.find((row) => row.id === id) ?? null;
}
__name(getTranslation, "getTranslation");
async function saveTranslation(record) {
  const rows = await all(COLLECTIONS.translations);
  const previous = rows.find((row) => row.id === record.id);
  await put(COLLECTIONS.translations, asDoc({ ...record, _id: previous?._id ?? cryptoID() }));
}
__name(saveTranslation, "saveTranslation");
async function removeTranslation(id) {
  const rows = await all(COLLECTIONS.translations);
  const hit = rows.find((row) => row.id === id);
  if (hit) await drop(COLLECTIONS.translations, hit._id);
}
__name(removeTranslation, "removeTranslation");
async function clearTranslations() {
  const rows = await all(COLLECTIONS.translations);
  for (const row of rows) await drop(COLLECTIONS.translations, row._id);
}
__name(clearTranslations, "clearTranslations");
async function getDaily(dateKey) {
  const rows = await all(COLLECTIONS.daily);
  return rows.find((row) => row.dateKey === dateKey) ?? null;
}
__name(getDaily, "getDaily");
async function saveDaily(sentence) {
  const existing = await getDaily(sentence.dateKey);
  if (existing) return existing;
  await put(COLLECTIONS.daily, asDoc({ ...sentence, _id: cryptoID() }));
  return sentence;
}
__name(saveDaily, "saveDaily");
const ANCHOR_KEY = "review.anchor";
async function loadAnchor() {
  const api2 = typeof window !== "undefined" ? window.aibox : void 0;
  if (!api2?.storage) return null;
  try {
    const raw = await api2.storage.get(ANCHOR_KEY);
    const value = raw;
    if (value && typeof value === "object" && Array.isArray(value.terms)) return value;
  } catch {
  }
  return null;
}
__name(loadAnchor, "loadAnchor");
async function saveAnchor(anchor) {
  const api2 = typeof window !== "undefined" ? window.aibox : void 0;
  if (!api2?.storage) return;
  try {
    if (anchor) await api2.storage.set(ANCHOR_KEY, anchor);
    else await api2.storage.remove(ANCHOR_KEY);
  } catch {
  }
}
__name(saveAnchor, "saveAnchor");
const DAILY_SEED = [
  { en: "Chance fights ever on the side of the prudent.", zh: "机遇永远站在谨慎者一边。", author: "欧里庇得斯" },
  { en: "The only way to do great work is to love what you do.", zh: "成就伟业的唯一途径就是热爱自己所做的事。", author: "史蒂夫·乔布斯" },
  { en: "It is never too late to be what you might have been.", zh: "成为你本可以成为的人，永远不会太晚。", author: "乔治·艾略特" },
  { en: "The future belongs to those who believe in the beauty of their dreams.", zh: "未来属于那些相信自己梦想之美的人。", author: "埃莉诺·罗斯福" },
  { en: "Well begun is half done.", zh: "良好的开始是成功的一半。", author: "亚里士多德" },
  { en: "Knowledge speaks, but wisdom listens.", zh: "知识在说，智慧在听。", author: "吉米·亨德里克斯" },
  { en: "A journey of a thousand miles begins with a single step.", zh: "千里之行，始于足下。", author: "老子" },
  { en: "Whatever you are, be a good one.", zh: "无论你成为什么样的人，都要做到最好。", author: "亚伯拉罕·林肯" }
];
const WORDS_SEED = [
  { word: "lean", brief: "vi. 倾斜；倚靠；倾向 adj. 瘦的" },
  { word: "learn", brief: "vt. 学习；得知" },
  { word: "leap", brief: "vi. 跳跃；剧增" },
  { word: "leaflet", brief: "n. 传单；小叶" },
  { word: "enforce", brief: "vt. 强迫，强制；实施，执行" },
  { word: "mole", brief: "n. 鼹鼠；色素痣；防波堤" },
  { word: "glove", brief: "n. 手套 vt. 给…戴手套" },
  { word: "blunt", brief: "adj. 钝的，不锋利的；生硬的；直率的" },
  { word: "fort", brief: "n. 堡垒；要塞" },
  { word: "lime", brief: "n. 石灰；酸橙；绿黄色" },
  { word: "verdict", brief: "n. 裁定；结论" },
  { word: "volatile", brief: "adj. 不稳定的；易变的；易怒的" },
  { word: "grounding", brief: "n. 对某学科基本要素的传授；基础" },
  { word: "churn", brief: "vi. 搅动；vt. 搅拌" },
  { word: "pitfall", brief: "n. 陷阱；诱惑" },
  { word: "drift", brief: "n. 漂流，漂移；趋势 vi. 漂流，漂移" },
  { word: "surgery", brief: "n. 外科；外科手术；手术室" },
  { word: "cognition", brief: "n. 认识；认识力；认知" },
  { word: "persona", brief: "n. 人物角色；伪装的外表" },
  { word: "permit", brief: "vi. 许可；允许 vt. 允许；许可" }
];
function stableHash(text2) {
  let hash = 2166136261;
  for (let i = 0; i < text2.length; i += 1) {
    hash ^= text2.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
__name(stableHash, "stableHash");
function seedSentence(dateKey) {
  if (DAILY_SEED.length === 0) return { en: "", zh: "", author: "" };
  return DAILY_SEED[stableHash(dateKey) % DAILY_SEED.length];
}
__name(seedSentence, "seedSentence");
const CJK = /[一-鿿㐀-䶿]/;
const PUNCT = /[.,!?;:。！？；：]/;
const LOOKUP_CHARS = /^[\p{L} \-'’]+$/u;
function resolveIntent(input) {
  const text2 = String(input ?? "").trim();
  if (!text2) return "lookup";
  if (CJK.test(text2)) return "translate";
  if (/[\r\n]/.test(text2)) return "translate";
  if ([...text2].length > 48) return "translate";
  if (text2.split(/\s+/).filter(Boolean).length > 5) return "translate";
  if (!LOOKUP_CHARS.test(text2)) return "translate";
  if (PUNCT.test(text2)) return "translate";
  return "lookup";
}
__name(resolveIntent, "resolveIntent");
function previewDirection(text2, direction) {
  if (direction === "zhToEn") return { from: "zh", to: "en" };
  if (direction === "enToZh") return { from: "en", to: "zh" };
  return CJK.test(String(text2 ?? "")) ? { from: "zh", to: "en" } : { from: "en", to: "zh" };
}
__name(previewDirection, "previewDirection");
function suggest(input) {
  const prefix = String(input.prefix ?? "").trim().toLowerCase();
  if (!prefix) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const push = /* @__PURE__ */ __name((term, brief) => {
    if (out.length >= 8) return;
    const key = term.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ term, brief, isCached: input.cachedWords.has(key) });
  }, "push");
  for (const item of input.history.slice(0, 200)) {
    if (out.length >= 8) break;
    if (item.term.toLowerCase().startsWith(prefix)) push(item.term, item.brief);
  }
  for (const item of input.vocab.slice(0, 200)) {
    if (out.length >= 8) break;
    if (item.text.toLowerCase().startsWith(prefix)) push(item.text, item.brief);
  }
  for (const item of WORDS_SEED) {
    if (out.length >= 8) break;
    if (item.word.startsWith(prefix)) push(item.word, item.brief);
  }
  return out;
}
__name(suggest, "suggest");
const INTERVAL_DAYS = [1, 2, 4, 7, 15, 30];
const DAILY_REVIEW_LIMIT = 30;
function nextBox(box, grade) {
  if (grade === "forgot") return 0;
  if (grade === "fuzzy") return Math.min(Math.max(box, 0), 5);
  return Math.min(box + 1, 5);
}
__name(nextBox, "nextBox");
function scheduleNext(box, grade, now = Date.now()) {
  const box2 = nextBox(box, grade);
  const days = INTERVAL_DAYS[Math.min(Math.max(box2, 0), 5)];
  return { box: box2, nextReviewAt: now + days * 864e5 };
}
__name(scheduleNext, "scheduleNext");
function isDue(nextReviewAt, now = Date.now()) {
  return nextReviewAt === null || nextReviewAt <= now;
}
__name(isDue, "isDue");
function dueCount(items, now = Date.now()) {
  return items.filter((item) => item.masteredAt === null && isDue(item.nextReviewAt, now)).length;
}
__name(dueCount, "dueCount");
function dueQueue(items, now = Date.now()) {
  return items.filter((item) => item.masteredAt === null && isDue(item.nextReviewAt, now)).sort((a, b) => (a.nextReviewAt ?? -Infinity) - (b.nextReviewAt ?? -Infinity)).slice(0, DAILY_REVIEW_LIMIT);
}
__name(dueQueue, "dueQueue");
function tomorrowPreview(items, now = Date.now()) {
  return Math.max(0, dueCount(items, now + 864e5) - dueCount(items, now));
}
__name(tomorrowPreview, "tomorrowPreview");
const KINDS = ["listening", "cloze", "spelling"];
function preferredKind(index) {
  return KINDS[(index % 3 + 3) % 3];
}
__name(preferredKind, "preferredKind");
function escapeRegExp(text2) {
  return text2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
__name(escapeRegExp, "escapeRegExp");
function blankOut(context, term) {
  if (!context || !term) return null;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "iu");
  if (!pattern.test(context)) return null;
  return context.replace(pattern, "________");
}
__name(blankOut, "blankOut");
function planExercise(input) {
  const term = input.item.text;
  const contexts = [
    ...input.item.note && input.item.note.trim() ? [input.item.note.trim()] : [],
    ...(input.entry?.payload.examples ?? []).map((example) => example.en).filter(Boolean)
  ];
  const kind = preferredKind(input.index);
  if (kind === "listening") return { kind: "listening", answer: term, prompt: null };
  const firstBlank = /* @__PURE__ */ __name(() => {
    for (const context of contexts) {
      const blanked = blankOut(context, term);
      if (blanked) return blanked;
    }
    return null;
  }, "firstBlank");
  if (kind === "cloze") {
    const prompt = firstBlank();
    if (prompt) return { kind: "cloze", answer: term, prompt };
    return { kind: "spelling", answer: term, prompt: spellingPrompt(input.item, firstBlank) };
  }
  return { kind: "spelling", answer: term, prompt: spellingPrompt(input.item, firstBlank) };
}
__name(planExercise, "planExercise");
function spellingPrompt(item, firstBlank) {
  const brief = (item.brief ?? "").trim();
  if (brief) return brief;
  return firstBlank();
}
__name(spellingPrompt, "spellingPrompt");
function isCorrect(response, answer) {
  return normalizeAnswer(response) === normalizeAnswer(answer);
}
__name(isCorrect, "isCorrect");
function normalizeAnswer(text2) {
  let value = String(text2 ?? "").trim().replace(/\s+/g, " ");
  value = value.replace(/^[.,!?;:，。！？；：]+/, "").replace(/[.,!?;:，。！？；：]+$/, "");
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
__name(normalizeAnswer, "normalizeAnswer");
function normalizeWords(text2) {
  return String(text2 ?? "").toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);
}
__name(normalizeWords, "normalizeWords");
function scorePronunciation(target, recognized) {
  const T = normalizeWords(target);
  if (T.length === 0) return { percent: 0, words: [] };
  const R = normalizeWords(recognized);
  if (R.length === 0) return { percent: 0, words: T.map((text2) => ({ text: text2, matched: false })) };
  const n = T.length;
  const m = R.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i2 = n - 1; i2 >= 0; i2 -= 1) {
    for (let j2 = m - 1; j2 >= 0; j2 -= 1) {
      dp[i2][j2] = T[i2] === R[j2] ? dp[i2 + 1][j2 + 1] + 1 : Math.max(dp[i2 + 1][j2], dp[i2][j2 + 1]);
    }
  }
  const matched = /* @__PURE__ */ new Set();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (T[i] === R[j]) {
      matched.add(i);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1;
    else j += 1;
  }
  return {
    percent: Math.round(matched.size / n * 100),
    words: T.map((text2, index) => ({ text: text2, matched: matched.has(index) }))
  };
}
__name(scorePronunciation, "scorePronunciation");
function formatEntryText(payload) {
  const blocks = [];
  if (payload.corrected && payload.corrected.trim()) {
    blocks.push(`Did you mean "${payload.corrected}"? Showing results for "${payload.word}".`);
  }
  const phonetics = [
    payload.phoneticUK ? `UK /${payload.phoneticUK}/` : "",
    payload.phoneticUS ? `US /${payload.phoneticUS}/` : ""
  ].filter(Boolean);
  blocks.push([payload.word, ...phonetics].join(" "));
  const senses = payload.senses.map((sense) => [sense.pos, sense.glosses.join("；")].filter(Boolean).join(" ")).filter(Boolean);
  if (senses.length) blocks.push(senses.join("\n"));
  if (payload.forms.length) {
    blocks.push(`Forms: ${payload.forms.map((form) => `${form.label} ${form.value}`).join(", ")}`);
  }
  if (payload.examples.length) {
    blocks.push(`Examples:
${payload.examples.map((e) => `- ${[e.en, e.zh].filter(Boolean).join(" ")}`).join("\n")}`);
  }
  const related = [];
  if (payload.synonyms.length) related.push(`Synonyms: ${payload.synonyms.join(", ")}`);
  if (payload.antonyms.length) related.push(`Antonyms: ${payload.antonyms.join(", ")}`);
  if (related.length) blocks.push(related.join("\n"));
  if (payload.memoryTip && payload.memoryTip.trim()) blocks.push(`Memory tip: ${payload.memoryTip}`);
  if (payload.examTags.length) blocks.push(`Exam tags: ${payload.examTags.join(", ")}`);
  return blocks.join("\n\n");
}
__name(formatEntryText, "formatEntryText");
function dateKeyOf(date = /* @__PURE__ */ new Date()) {
  const pad = /* @__PURE__ */ __name((value) => String(value).padStart(2, "0"), "pad");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
__name(dateKeyOf, "dateKeyOf");
function formatVocabList(items) {
  if (items.length === 0) return "No saved vocabulary matches.";
  return items.map((item, index) => {
    const brief = item.brief && item.brief.trim() ? ` — ${item.brief}` : "";
    const mastered = item.masteredAt ? ", mastered" : "";
    return `${index + 1}. ${item.text}${brief} (added ${dateKeyOf(new Date(item.addedAt))}${mastered})`;
  }).join("\n");
}
__name(formatVocabList, "formatVocabList");
const YOUDAO_MAX_BYTES = 2e6;
const LOOKUP_TIMEOUT_MS = 8e3;
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
function timeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("aibox/timeout: lookup timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
__name(timeout, "timeout");
function text$1(node) {
  return (node?.textContent ?? "").trim();
}
__name(text$1, "text$1");
function parseYoudao(html, word) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const simple = doc.querySelector(".simple.dict-module");
  if (!simple) return null;
  const senses = [];
  simple.querySelectorAll(".word-exp").forEach((node) => {
    const gloss = text$1(node.querySelector(".trans"));
    if (!gloss) return;
    senses.push({ pos: text$1(node.querySelector(".pos")), glosses: [gloss] });
  });
  if (senses.length === 0) return null;
  let phoneticUK = null;
  let phoneticUS = null;
  doc.querySelectorAll(".ec.dict-module .per-phone").forEach((node) => {
    const label = text$1(node.firstElementChild);
    const ipa = text$1(node.querySelector(".phonetic")).replace(/^[/\s]+|[/\s]+$/g, "");
    if (!ipa) return;
    if (label.includes("英")) phoneticUK = ipa;
    else if (label.includes("美")) phoneticUS = ipa;
  });
  const examTags = [];
  simple.querySelectorAll(".exam_type-value").forEach((node) => {
    const value = text$1(node);
    if (value) examTags.push(value);
  });
  const forms = [];
  simple.querySelectorAll(".m-word-wfs-cell").forEach((node) => {
    const label = text$1(node.querySelector(".wfs-name"));
    const value = text$1(node.querySelector(".wordLine"));
    if (label && value) forms.push({ label, value });
  });
  const examples = [];
  doc.querySelectorAll(".sents_con .mcols").forEach((node) => {
    if (examples.length >= 3) return;
    const en = text$1(node.querySelector(".word-cont p.wordLine"));
    const zh = text$1(node.querySelector(".word-cont p.grey"));
    if (en && zh) examples.push({ en, zh });
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
    source: "youdao"
  };
}
__name(parseYoudao, "parseYoudao");
async function scrapeYoudao(word) {
  let url;
  try {
    url = `https://dict.youdao.com/result?word=${encodeURIComponent(word)}&lang=en`;
  } catch {
    return null;
  }
  try {
    const html = await timeout(
      fetchText(url, { headers: { "User-Agent": MOBILE_UA }, maxBytes: YOUDAO_MAX_BYTES, allowTruncated: true }),
      LOOKUP_TIMEOUT_MS
    );
    return parseYoudao(html, word);
  } catch {
    return null;
  }
}
__name(scrapeYoudao, "scrapeYoudao");
function lenientJSON(raw) {
  let text2 = String(raw ?? "").trim();
  if (text2.startsWith("```")) {
    const lines = text2.split("\n");
    if (lines[0]?.startsWith("```")) lines.shift();
    if (lines[lines.length - 1]?.startsWith("```")) lines.pop();
    text2 = lines.join("\n");
  }
  const start = text2.indexOf("{");
  const end = text2.lastIndexOf("}");
  if (start >= 0 && end > start) text2 = text2.slice(start, end + 1);
  try {
    return JSON.parse(text2);
  } catch {
    return null;
  }
}
__name(lenientJSON, "lenientJSON");
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
__name(lookupPrompt, "lookupPrompt");
function array(value, map) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const mapped = map(raw);
    if (mapped) out.push(mapped);
  }
  return out;
}
__name(array, "array");
function strings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}
__name(strings, "strings");
function optionalString(value) {
  const text2 = typeof value === "string" ? value.trim() : "";
  return text2 ? text2 : null;
}
__name(optionalString, "optionalString");
function payloadFromAI(raw, fallbackWord) {
  const frequency = typeof raw.frequency === "number" && Number.isFinite(raw.frequency) ? Math.round(raw.frequency) : null;
  return {
    word: optionalString(raw.word) ?? fallbackWord,
    corrected: optionalString(raw.corrected),
    phoneticUK: optionalString(raw.phoneticUK),
    phoneticUS: optionalString(raw.phoneticUS),
    senses: array(raw.senses, (item) => {
      const glosses = strings(item.glosses);
      if (glosses.length === 0) return null;
      return { pos: String(item.pos ?? "").trim(), glosses };
    }),
    forms: array(raw.forms, (item) => {
      const label = String(item.label ?? "").trim();
      const value = String(item.value ?? "").trim();
      return label && value ? { label, value } : null;
    }),
    examTags: strings(raw.examTags),
    frequency,
    examples: array(raw.examples, (item) => {
      const en = String(item.en ?? "").trim();
      if (!en) return null;
      return { en, zh: String(item.zh ?? "").trim() };
    }),
    synonyms: strings(raw.synonyms),
    antonyms: strings(raw.antonyms),
    memoryTip: optionalString(raw.memoryTip),
    source: null
  };
}
__name(payloadFromAI, "payloadFromAI");
function ai() {
  const api2 = typeof window !== "undefined" ? window.aibox : void 0;
  return api2?.ai && typeof api2.ai.generate === "function" ? api2.ai : void 0;
}
__name(ai, "ai");
class LookupError extends Error {
  static {
    __name(this, "LookupError");
  }
}
async function lookupWord(word) {
  const term = String(word ?? "").trim();
  if (!term) throw new LookupError("Provide the word or phrase to look up.");
  const scraped = await scrapeYoudao(term);
  if (scraped) return scraped;
  const api2 = ai();
  if (!api2) throw new LookupError("No AI provider is configured for the selected model.");
  let raw;
  try {
    raw = await api2.generate({ prompt: lookupPrompt(term), maxTokens: 900, temperature: 0.3, intent: "balanced" });
  } catch (error) {
    throw new LookupError(normalizeError(error).message);
  }
  const parsed = lenientJSON(raw);
  if (!parsed) throw new LookupError("The AI response couldn't be parsed.");
  const payload = payloadFromAI(parsed, term);
  if (payload.senses.length === 0) throw new LookupError("The AI response couldn't be parsed.");
  return payload;
}
__name(lookupWord, "lookupWord");
const LANG_NAME = { en: "English", zh: "Chinese" };
function translatePrompt(text2, from, to) {
  return `Translate the text below from ${LANG_NAME[from]} to ${LANG_NAME[to]}. Output ONLY the translation — no explanation, no quotes, no markdown.

Text: ${text2}`;
}
__name(translatePrompt, "translatePrompt");
async function translateStream(input) {
  const api2 = ai();
  if (!api2) throw new LookupError("No AI provider is configured for the selected model.");
  const prompt = translatePrompt(input.text, input.from, input.to);
  if (typeof api2.generateStream === "function") {
    let received = false;
    let full2 = "";
    const stream = api2.generateStream({ prompt, maxTokens: 2e3, temperature: 0.2, intent: "balanced" });
    for await (const delta of stream) {
      if (!delta) continue;
      received = true;
      full2 += delta;
      input.onDelta(delta);
    }
    if (!received && full2.trim()) input.onDelta(full2);
    return full2;
  }
  const full = await api2.generate({ prompt, maxTokens: 2e3, temperature: 0.2, intent: "balanced" });
  input.onDelta(full);
  return full;
}
__name(translateStream, "translateStream");
async function translateText(text2, from, to) {
  const api2 = ai();
  if (!api2) throw new LookupError("No AI provider is configured for the selected model.");
  return api2.generate({ prompt: translatePrompt(text2, from, to), maxTokens: 2e3, temperature: 0.2, intent: "balanced" });
}
__name(translateText, "translateText");
function dailyPrompt(dateKey) {
  return `Output ONLY a single JSON object (no markdown fences, no explanation) with exactly this shape:
{ "en": "a well-known, inspiring or thought-provoking English quotation, 10-25 words", "zh": "an accurate, natural Chinese translation", "author": "the quotation's author (in Chinese if well-known)" }

Pick a quotation that feels fresh, not one of the most overused ones. Today's date: ${dateKey}.`;
}
__name(dailyPrompt, "dailyPrompt");
async function generateDaily(dateKey) {
  const api2 = ai();
  if (!api2) return null;
  try {
    const raw = await api2.generate({ prompt: dailyPrompt(dateKey), maxTokens: 200, temperature: 0.9, intent: "fast" });
    const parsed = lenientJSON(raw);
    if (!parsed) return null;
    const en = String(parsed.en ?? "").trim();
    if (!en) return null;
    return { en, zh: String(parsed.zh ?? "").trim(), author: String(parsed.author ?? "").trim() };
  } catch {
    return null;
  }
}
__name(generateDaily, "generateDaily");
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(text, "text");
function registerWordActions(refresh) {
  registerActions({
    async word_lookup(input) {
      const term = text(input?.term);
      if (!term) return { ok: false, text: "Provide the word or phrase to look up." };
      const cached = await getEntry(term);
      if (cached) {
        return { ok: true, text: formatEntryText(cached.payload), word: cached.word, source: cached.source, cached: true };
      }
      try {
        const payload = await lookupWord(term);
        await upsertEntry(term, payload);
        await recordHistory(term, "", "tool");
        refresh();
        return {
          ok: true,
          text: formatEntryText(payload),
          word: payload.word,
          source: payload.source ?? "ai",
          cached: false
        };
      } catch (error) {
        const reason = error instanceof LookupError ? error.message : String(error);
        return { ok: false, text: `Couldn't look up '${term}' right now: ${reason}` };
      }
    },
    async word_translate(input) {
      const source = text(input?.text);
      if (!source) return { ok: false, text: "Provide the text to translate." };
      const direction = text(input?.direction) || "auto";
      const { from, to } = previewDirection(source, direction);
      try {
        const translated = (await translateText(source, from, to)).trim();
        if (!translated) return { ok: false, text: "Couldn't translate that right now: empty response." };
        await saveTranslation({
          id: cryptoID(),
          source,
          target: translated,
          srcLang: from,
          dstLang: to,
          at: Date.now(),
          starred: false
        });
        refresh();
        return { ok: true, text: translated, srcLang: from, dstLang: to };
      } catch (error) {
        return { ok: false, text: `Couldn't translate that right now: ${String(error)}` };
      }
    },
    async word_list_vocab(input) {
      const filter = text(input?.filter) || "all";
      const query = text(input?.query).toLowerCase();
      const rawLimit = typeof input?.limit === "number" ? input.limit : 50;
      const limit = Math.min(200, Math.max(1, Math.round(rawLimit)));
      let items = await listVocab(500);
      if (query) {
        items = items.filter(
          (item) => item.text.toLowerCase().includes(query) || (item.brief ?? "").toLowerCase().includes(query)
        );
      }
      items = items.slice(0, limit);
      items = items.filter((item) => matchesFilter$1(item, filter));
      return { ok: true, text: formatVocabList(items), count: items.length };
    },
    async word_vocab_upsert(input) {
      const term = text(input?.term);
      if (!term) return { ok: false, text: "Provide the word or sentence to save." };
      const kind = text(input?.kind) === "sentence" ? "sentence" : "word";
      const mastered = typeof input?.mastered === "boolean" ? input.mastered : void 0;
      const entry = await getEntry(term);
      (await listVocab(500)).find((item2) => item2.text === normalizeTerm(term));
      const { item, created } = await upsertVocab({
        term,
        kind,
        brief: entry?.brief ?? "",
        note: entry?.payload.examples[0]?.en ?? null,
        mastered
      });
      refresh();
      if (created) return { ok: true, text: `Saved '${item.text}' to vocabulary.`, created: true };
      if (mastered !== void 0) {
        return {
          ok: true,
          text: mastered ? `Marked '${item.text}' as mastered.` : `Marked '${item.text}' as not mastered.`,
          created: false
        };
      }
      return { ok: true, text: `'${item.text}' is already in the saved vocabulary.`, created: false };
    },
    async word_vocab_remove(input) {
      const term = text(input?.term);
      if (!term) return { ok: false, text: "Provide the word or sentence to remove." };
      const removed = await removeVocab(term);
      refresh();
      return {
        ok: true,
        text: removed ? `Removed '${term}' from vocabulary.` : `'${term}' is not in the saved vocabulary.`,
        removed
      };
    }
  });
}
__name(registerWordActions, "registerWordActions");
function matchesFilter$1(item, filter) {
  switch (filter) {
    case "word":
      return item.kind === "word";
    case "sentence":
      return item.kind === "sentence";
    case "mastered":
      return item.masteredAt !== null;
    case "unmastered":
      return item.masteredAt === null;
    default:
      return true;
  }
}
__name(matchesFilter$1, "matchesFilter$1");
const api = /* @__PURE__ */ __name(() => typeof window !== "undefined" ? window.aibox : void 0, "api");
async function probeAI() {
  const bridge2 = api();
  if (!bridge2?.ai || typeof bridge2.ai.availability !== "function") return false;
  try {
    return (await bridge2.ai.availability()).available;
  } catch {
    return false;
  }
}
__name(probeAI, "probeAI");
const capabilities = {
  get picker() {
    return isAvailable("picker", "photo");
  },
  get ocr() {
    return isAvailable("photos", "ocr");
  },
  get ai() {
    return isAvailable("ai", "generate");
  }
};
const ACCENT_LANG = { uk: "en-GB", us: "en-US" };
async function speak(text2, accent = "us", rate = "normal") {
  const bridge2 = api();
  const value = String(text2 ?? "").trim();
  if (!bridge2?.tts || !value) return;
  try {
    await bridge2.tts.stop();
  } catch {
  }
  try {
    await bridge2.tts.speak({ text: value, lang: ACCENT_LANG[accent], rate: rate === "slow" ? 0.35 : 0.5 });
  } catch {
  }
}
__name(speak, "speak");
async function probeSpeech(locale = "en-US") {
  const bridge2 = api();
  if (!bridge2?.speech) return { available: false, reason: "recognizerUnavailable", detail: "" };
  try {
    const value = await bridge2.speech.availability({ locale });
    if (value.available) return { available: true, reason: null, detail: "" };
    return { available: false, reason: classifySpeechReason(value.reason ?? ""), detail: value.reason ?? "" };
  } catch (error) {
    const message = normalizeError(error).message;
    return { available: false, reason: classifySpeechReason(message), detail: message };
  }
}
__name(probeSpeech, "probeSpeech");
function classifySpeechReason(raw) {
  const value = raw.toLowerCase();
  if (value.includes("microphone-denied") || value.includes("microphone")) return "micDenied";
  if (value.includes("speech-denied") || value.includes("not-authorized")) return "speechDenied";
  if (value.includes("on-device") || value.includes("ondevice")) return "onDeviceUnsupported";
  if (value.includes("locale") || value.includes("unavailable") || value.includes("unsupported")) {
    return "recognizerUnavailable";
  }
  return "engineError";
}
__name(classifySpeechReason, "classifySpeechReason");
function recognize(locale = "en-US", maxDurationMs = 15e3) {
  const bridge2 = api();
  if (!bridge2?.speech) return Promise.resolve({ transcript: "", cancelled: true, error: "unavailable" });
  return bridge2.speech.recognize({ locale, maxDurationMs, onPartial: true }).then((result) => ({ transcript: result.transcript, cancelled: result.cancelled, error: "" })).catch((error) => ({ transcript: "", cancelled: true, error: normalizeError(error).message }));
}
__name(recognize, "recognize");
async function stopRecognizing() {
  const bridge2 = api();
  if (!bridge2?.speech) return;
  try {
    await bridge2.speech.stop();
  } catch {
  }
}
__name(stopRecognizing, "stopRecognizing");
async function cancelRecognizing() {
  const bridge2 = api();
  if (!bridge2?.speech) return;
  try {
    await bridge2.speech.cancel();
  } catch {
  }
}
__name(cancelRecognizing, "cancelRecognizing");
async function partialTranscript() {
  const bridge2 = api();
  if (!bridge2?.speech) return "";
  try {
    const status = await bridge2.speech.status();
    return status.partial ?? "";
  } catch {
    return "";
  }
}
__name(partialTranscript, "partialTranscript");
async function copyText(text2) {
  const bridge2 = api();
  if (!bridge2?.clipboard) return false;
  try {
    await bridge2.clipboard.write({ text: text2 });
    return true;
  } catch {
    return false;
  }
}
__name(copyText, "copyText");
async function shareText(text2) {
  const bridge2 = api();
  if (!bridge2?.share) return;
  try {
    await bridge2.share.text({ text: text2 });
  } catch {
  }
}
__name(shareText, "shareText");
async function haptic(style = "light") {
  const bridge2 = api();
  if (!bridge2?.haptics) return;
  try {
    await bridge2.haptics.impact({ style });
  } catch {
  }
}
__name(haptic, "haptic");
async function confirm(input) {
  const bridge2 = api();
  if (!bridge2?.ui) return true;
  try {
    const result = await bridge2.ui.confirm({
      title: input.title,
      message: input.message,
      actions: [
        { id: "cancel", title: input.cancelTitle, role: "cancel" },
        { id: "ok", title: input.confirmTitle, role: input.destructive ? "destructive" : "default" }
      ]
    });
    return !result.cancelled && result.actionId === "ok";
  } catch {
    return false;
  }
}
__name(confirm, "confirm");
async function lookUpFromPhoto() {
  const bridge2 = api();
  if (!bridge2?.picker || !bridge2?.photos) return { words: [], error: "unsupported", previewURL: null };
  let handle = "";
  let url = null;
  try {
    const picked = await bridge2.picker.photo({ limit: 1 });
    const first = Array.isArray(picked) ? picked[0] : picked;
    if (!first || typeof first !== "object") return { words: [], error: "load", previewURL: null };
    const ref = first;
    handle = String(ref.handle ?? ref.id ?? "");
    url = ref.url ?? null;
  } catch {
    return { words: [], error: "load", previewURL: null };
  }
  if (!handle) return { words: [], error: "load", previewURL: url };
  let text2 = "";
  for (const args of [{ handle }, { id: handle }, { asset: handle }]) {
    try {
      const result = await bridge2.photos.ocr(args);
      text2 = extractOCRText(result);
      if (text2) break;
    } catch {
    }
  }
  if (!text2) return { words: [], error: "unsupported", previewURL: url };
  const words = tokenizeOCR(text2);
  return { words, error: words.length ? null : "empty", previewURL: url };
}
__name(lookUpFromPhoto, "lookUpFromPhoto");
function extractOCRText(result) {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  const envelope = result;
  if (envelope.ok === false) return "";
  if (typeof envelope.text === "string") return envelope.text;
  return "";
}
__name(extractOCRText, "extractOCRText");
function tokenizeOCR(text2) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const token of String(text2 ?? "").split(/[^\p{L}\p{N}]+/u)) {
    if (token.length < 2) continue;
    if (!new RegExp("\\p{L}", "u").test(token)) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}
__name(tokenizeOCR, "tokenizeOCR");
async function shareWordContext(seed) {
  const bridge2 = api();
  if (!bridge2?.chat || typeof bridge2.chat.shareContext !== "function") return false;
  try {
    await bridge2.chat.shareContext({ suggestedPrompt: seed });
    return true;
  } catch {
    return false;
  }
}
__name(shareWordContext, "shareWordContext");
const TABLE = {
  // 全局 / Tab
  tabTranslate: { zh: "翻译", en: "Translate" },
  tabSearch: { zh: "搜索", en: "Search" },
  tabVocab: { zh: "生词本", en: "Vocabulary" },
  // 搜索页
  searchPlaceholder: { zh: "查询单词或句子", en: "Search a word or sentence" },
  reviewBannerOne: { zh: "今天有 1 个词到期待复习", en: "1 word due for review today" },
  reviewBannerOther: { zh: "今天有 {n} 个词到期待复习", en: "{n} words due for review today" },
  dailyHeader: { zh: "每日一句", en: "SENTENCE OF THE DAY" },
  speakNormal: { zh: "常速", en: "Normal" },
  speakSlow: { zh: "慢速", en: "Slow" },
  recentLookups: { zh: "最近查询", en: "Recent Lookups" },
  translationHistory: { zh: "翻译历史", en: "Translation History" },
  clear: { zh: "清空", en: "Clear" },
  expandAll: { zh: "展开全部", en: "Show all" },
  collapse: { zh: "收起", en: "Show less" },
  emptySearchHint: { zh: "查一个今天遇到的词试试", en: "Look up a word you met today" },
  clearHistoryTitle: { zh: "清空查询历史？", en: "Clear lookup history?" },
  clearTranslationsTitle: { zh: "清空翻译历史？", en: "Clear translation history?" },
  lookupAction: { zh: "查询", en: "Look up" },
  translateAsSentence: { zh: "作为句子翻译", en: "Translate as a sentence" },
  cached: { zh: "已缓存", en: "Cached" },
  copy: { zh: "复制", en: "Copy" },
  copied: { zh: "已复制", en: "Copied" },
  addToVocab: { zh: "加入生词本", en: "Add to vocabulary" },
  delete: { zh: "删除", en: "Delete" },
  speakAloud: { zh: "朗读", en: "Speak" },
  favourite: { zh: "收藏", en: "Favourite" },
  unfavourite: { zh: "取消收藏", en: "Unfavourite" },
  cancel: { zh: "取消", en: "Cancel" },
  photoLookup: { zh: "拍照/相册查词", en: "Look Up from Photo" },
  // 词详情
  regenerate: { zh: "重新生成", en: "Regenerate" },
  copyEntry: { zh: "复制词条", en: "Copy entry" },
  share: { zh: "分享", en: "Share" },
  regenerateFailed: { zh: "更新词条失败，已保留原有版本。", en: "Could not update the entry; the previous version is kept." },
  didYouMean: { zh: "你要找的是不是", en: "Did you mean" },
  sourceAI: { zh: "AI 生成", en: "AI generated" },
  sourceYoudao: { zh: "有道词典", en: "Youdao Dictionary" },
  sourceOther: { zh: "词典来源", en: "Dictionary source" },
  justUpdated: { zh: "刚刚更新", en: "Just updated" },
  sectionSenses: { zh: "释义", en: "Senses" },
  sectionCompanion: { zh: "AI 单词伴侣", en: "AI Word Companion" },
  sectionForms: { zh: "变形", en: "Forms" },
  sectionExamples: { zh: "例句", en: "Examples" },
  sectionMemoryTip: { zh: "AI 助记", en: "AI Memory Tip" },
  sectionRelated: { zh: "近义 / 反义", en: "Synonyms / Antonyms" },
  loadFailed: { zh: "加载失败", en: "Loading failed" },
  retry: { zh: "重试", en: "Retry" },
  starred: { zh: "已收藏", en: "Saved" },
  // AI 伴侣
  companionTitle: { zh: "AI 单词伴侣", en: "AI Word Companion" },
  chipSimpler: { zh: "换个更简单的例句", en: "Simpler example" },
  chipOther: { zh: "还有其他意思吗？", en: "Other meanings?" },
  chipStory: { zh: "讲个记忆小故事", en: "Memory story" },
  chipWrite: { zh: "帮我造句", en: "Help me write a sentence" },
  chipQuiz: { zh: "考考我", en: "Quiz me" },
  companionPlaceholder: { zh: "就这个词随便问…", en: "Ask anything about this word…" },
  sendToChat: { zh: "转到主聊天", en: "Send to main chat" },
  // 翻译
  translateTitle: { zh: "翻译", en: "Translate" },
  autoDetect: { zh: "自动判向", en: "Auto-detect" },
  translateInputPlaceholder: { zh: "输入要翻译的文本", en: "Enter text to translate" },
  translateAction: { zh: "翻译", en: "Translate" },
  translateFailed: { zh: "翻译失败，请重试", en: "Translation failed, please try again" },
  retranslate: { zh: "重新翻译", en: "Translate again" },
  noTranslationRecord: { zh: "查一个今天遇到的词试试", en: "Look up a word you met today" },
  // 生词本
  vocabTitle: { zh: "生词本", en: "Vocabulary" },
  vocabFilterPlaceholder: { zh: "筛选生词", en: "Filter vocabulary" },
  filterVocab: { zh: "筛选生词", en: "Filter" },
  filterAll: { zh: "全部", en: "All" },
  filterWord: { zh: "仅单词", en: "Words only" },
  filterSentence: { zh: "仅句子", en: "Sentences only" },
  filterMastered: { zh: "已掌握", en: "Mastered" },
  filterUnmastered: { zh: "未掌握", en: "Not mastered" },
  sortBy: { zh: "排序", en: "Sort" },
  sortAdded: { zh: "添加时间", en: "Date added" },
  sortAlpha: { zh: "字母顺序", en: "Alphabetical" },
  sortUrgency: { zh: "复习紧急度", en: "Review urgency" },
  examTag: { zh: "考纲标签", en: "Exam tag" },
  allTags: { zh: "全部标签", en: "All tags" },
  vocabEmpty: { zh: "查词时点 ★ 即可收进生词本", en: "Tap ★ while looking up to save a word" },
  vocabCount: { zh: "共 {n} 个生词", en: "{n} saved" },
  markMastered: { zh: "已掌握", en: "Mastered" },
  unmarkMastered: { zh: "取消掌握", en: "Not mastered" },
  // 复习
  reviewTitle: { zh: "复习", en: "Review" },
  reviewEmpty: { zh: "暂时没有到期要复习的词", en: "Nothing is due for review right now" },
  reviewDoneCount: { zh: "本次复习了 {n} 个词", en: "Reviewed {n} words" },
  reviewTomorrow: { zh: "明天还有 {n} 个词到期", en: "{n} more due tomorrow" },
  done: { zh: "完成", en: "Done" },
  exerciseListening: { zh: "听音辨词", en: "Listening" },
  exerciseCloze: { zh: "例句填空", en: "Fill in the Blank" },
  exerciseSpelling: { zh: "看义拼写", en: "Spelling" },
  listeningHint: { zh: "听发音，输入你听到的内容。", en: "Listen and type what you hear." },
  promptFallback: { zh: "输入与提示匹配的单词。", en: "Type the word that matches the hint." },
  answerPlaceholder: { zh: "输入答案", en: "Type your answer" },
  checkAnswer: { zh: "检查答案", en: "Check answer" },
  showAnswer: { zh: "查看答案", en: "Show answer" },
  answerCorrect: { zh: "回答正确", en: "Correct" },
  answerKeepPracticing: { zh: "继续练习", en: "Keep practicing" },
  savedContext: { zh: "收藏时语境", en: "Saved context" },
  viewFullDetail: { zh: "查看完整详情", en: "View full entry" },
  gradeForgot: { zh: "忘记", en: "Forgot" },
  gradeFuzzy: { zh: "模糊", en: "Fuzzy" },
  gradeKnow: { zh: "认识", en: "Know it" },
  // 跟读 / 相册
  practiceTitle: { zh: "跟读练习", en: "Read-aloud practice" },
  practiceTapToStart: { zh: "轻触开始跟读", en: "Tap to start" },
  practiceRecording: { zh: "录音中…轻触结束", en: "Recording… tap to finish" },
  practiceScoring: { zh: "评分中…", en: "Scoring…" },
  practiceMatchLabel: { zh: "语音识别文本匹配度", en: "Speech recognition text match" },
  practiceRetry: { zh: "重试", en: "Try again" },
  speechRecognizerUnavailable: { zh: "此设备暂时无法使用语音识别。", en: "Speech recognition is unavailable on this device." },
  speechOnDeviceUnsupported: { zh: "此设备不支持该语言的本地语音识别。", en: "On-device recognition is not supported for this language." },
  speechMicDenied: { zh: "需要麦克风权限，请在设置中允许。", en: "Microphone access is required. Allow it in Settings." },
  speechDenied: { zh: "需要语音识别权限，请在设置中允许。", en: "Speech recognition access is required. Allow it in Settings." },
  photoPickHint: { zh: "选一张带英文的图片，点其中的词即可查询。", en: "Pick a picture with English text, then tap a word to look it up." },
  photoPick: { zh: "选择照片", en: "Choose photo" },
  photoChange: { zh: "换一张照片", en: "Choose another" },
  photoTapWord: { zh: "点其中的词即可查询", en: "Tap a word to look it up" },
  photoNoText: { zh: "这张图片里没有识别到文字。", en: "No text was recognized in this picture." },
  photoLoadFailed: { zh: "无法加载这张图片。", en: "This picture could not be loaded." },
  photoUnsupported: { zh: "此设备不支持文字识别。", en: "Text recognition is not supported on this device." },
  // 错误
  errNoProvider: { zh: "所选模型未配置 AI 服务商。", en: "No AI provider is configured for the selected model." },
  errUnparseable: { zh: "AI 返回内容无法解析。", en: "The AI response couldn't be parsed." }
};
function makeT(lang) {
  return (key, params) => {
    let value = TABLE[key][lang];
    if (params) {
      for (const [name, replacement] of Object.entries(params)) {
        value = value.split(`{${name}}`).join(String(replacement));
      }
    }
    return value;
  };
}
__name(makeT, "makeT");
function dueBanner(t, lang, count) {
  if (lang === "en" && count === 1) return t("reviewBannerOne");
  return t("reviewBannerOther", { n: count });
}
__name(dueBanner, "dueBanner");
function sourceLabel(t, source) {
  if (source === "youdao") return t("sourceYoudao");
  if (!source || source === "ai") return t("sourceAI");
  return t("sourceOther");
}
__name(sourceLabel, "sourceLabel");
function useWordStore() {
  const [ready, setReady] = useState(false);
  const [vocab, setVocab] = useState([]);
  const [history, setHistory] = useState([]);
  const [translations, setTranslations] = useState([]);
  const [entries, setEntries] = useState([]);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [nextVocab, nextHistory, nextTranslations, nextEntries] = await Promise.all([
        listVocab(500),
        listHistory(50),
        listTranslations(50),
        listEntries()
      ]);
      if (cancelled) return;
      setVocab(nextVocab);
      setHistory(nextHistory);
      setTranslations(nextTranslations);
      setEntries(nextEntries);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);
  const cachedWords = useMemo(() => new Set(entries.map((entry) => entry.word)), [entries]);
  const entryOf = useCallback(
    (word) => entries.find((entry) => entry.word === word.trim().toLowerCase()) ?? null,
    [entries]
  );
  return { ready, vocab, history, translations, entries, cachedWords, entryOf, refresh };
}
__name(useWordStore, "useWordStore");
const SPACE = { s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32 };
const RADIUS = { card: 16, field: 14, pill: 999 };
const LIGHT = {
  ink: "#1B1A16",
  muted: "#68665E",
  line: "rgba(0,0,0,0.08)",
  bg: "#F2F2F7",
  surface: "#FFFFFF",
  accent: "#2D6AE0",
  onAccent: "#FFFFFF",
  green: "#248A5A",
  orange: "#B56B00",
  red: "#D92D20"
};
const DARK = {
  ink: "#EDEBE3",
  muted: "#A6A498",
  line: "rgba(255,255,255,0.14)",
  bg: "#000000",
  surface: "#1C1C1E",
  accent: "#4E88FF",
  onAccent: "#FFFFFF",
  green: "#43C487",
  orange: "#F2A93B",
  red: "#FF6B5F"
};
function palette(dark) {
  return dark ? DARK : LIGHT;
}
__name(palette, "palette");
function alpha(color, value) {
  if (color.startsWith("rgba")) return color;
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${value})`;
}
__name(alpha, "alpha");
function Icon({ name, size = 16, color }) {
  return /* @__PURE__ */ jsx("span", { "aria-hidden": true, style: { fontSize: size, lineHeight: 1, color, display: "inline-block" }, children: GLYPH[name] ?? "•" });
}
__name(Icon, "Icon");
const GLYPH = {
  magnifyingglass: "⌕",
  speaker: "🔊",
  tortoise: "🐢",
  star: "☆",
  "star.fill": "★",
  chevron: "›",
  "chevron.down": "⌄",
  "chevron.up": "⌃",
  sparkles: "✦",
  ear: "👂",
  blank: "␣",
  pencil: "✎",
  mic: "🎙",
  stop: "■",
  check: "✓",
  "checkmark.seal": "✅",
  clipboard: "⧉",
  share: "↑",
  trash: "🗑",
  refresh: "↻",
  globe: "🌐",
  swap: "⇄",
  quote: "❝",
  list: "≡",
  lightbulb: "💡",
  question: "?",
  photo: "🖼",
  viewfinder: "⌗",
  warning: "⚠",
  clock: "🕘",
  shield: "🛡",
  drive: "💾",
  play: "▶",
  book: "📖",
  cards: "🃏"
};
function InfoChip(props) {
  const tint = props.tint ?? props.palette.accent;
  const style = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 9px",
    borderRadius: RADIUS.pill,
    fontSize: 12,
    lineHeight: "16px",
    whiteSpace: "nowrap",
    border: "none",
    cursor: props.onClick ? "pointer" : "default",
    color: props.filled ? tint : props.palette.muted,
    background: props.filled ? alpha(tint, 0.14) : props.palette.line
  };
  const content = /* @__PURE__ */ jsxs(Fragment, { children: [
    props.icon ? /* @__PURE__ */ jsx(Icon, { name: props.icon, size: 11 }) : null,
    /* @__PURE__ */ jsx("span", { children: props.label })
  ] });
  return props.onClick ? /* @__PURE__ */ jsx("button", { type: "button", style, onClick: props.onClick, children: content }) : /* @__PURE__ */ jsx("span", { style, children: content });
}
__name(InfoChip, "InfoChip");
function ChipsFlow({ children }) {
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, children });
}
__name(ChipsFlow, "ChipsFlow");
function EmptyState(props) {
  return /* @__PURE__ */ jsxs("div", { style: { padding: "18px 16px", textAlign: "center", color: props.palette.muted }, children: [
    /* @__PURE__ */ jsx("div", { style: { opacity: 0.7 }, children: /* @__PURE__ */ jsx(Icon, { name: props.icon, size: 26 }) }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: 13, marginTop: SPACE.s2 }, children: props.text })
  ] });
}
__name(EmptyState, "EmptyState");
function SectionHeader(props) {
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.s2 }, children: [
    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: 500, color: props.palette.muted, textTransform: "uppercase", letterSpacing: 0.4 }, children: props.title }),
    props.trailing
  ] });
}
__name(SectionHeader, "SectionHeader");
function PrimaryButton(props) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      disabled: props.disabled || props.busy,
      onClick: props.onClick,
      style: {
        border: "none",
        borderRadius: RADIUS.field,
        padding: "11px 18px",
        fontSize: 15,
        fontWeight: 500,
        width: props.block ? "100%" : void 0,
        color: props.palette.onAccent,
        background: props.palette.accent,
        opacity: props.disabled || props.busy ? 0.45 : 1,
        cursor: props.disabled || props.busy ? "default" : "pointer"
      },
      children: props.busy ? "…" : props.title
    }
  );
}
__name(PrimaryButton, "PrimaryButton");
function SecondaryButton(props) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      disabled: props.disabled,
      onClick: props.onClick,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: `1px solid ${props.palette.line}`,
        borderRadius: RADIUS.field,
        padding: "8px 14px",
        fontSize: 13,
        background: "transparent",
        color: props.palette.accent,
        opacity: props.disabled ? 0.4 : 1,
        cursor: props.disabled ? "default" : "pointer"
      },
      children: [
        props.icon ? /* @__PURE__ */ jsx(Icon, { name: props.icon, size: 12 }) : null,
        props.title
      ]
    }
  );
}
__name(SecondaryButton, "SecondaryButton");
function DueBanner(props) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      onClick: props.onClick,
      style: {
        display: "flex",
        alignItems: "center",
        gap: SPACE.s3,
        width: "100%",
        border: "none",
        background: alpha(props.palette.accent, 0.1),
        color: props.palette.accent,
        borderRadius: RADIUS.field,
        padding: "12px 14px",
        fontSize: 14,
        cursor: "pointer",
        textAlign: "left"
      },
      children: [
        /* @__PURE__ */ jsx(Icon, { name: "cards", size: 16 }),
        /* @__PURE__ */ jsx("span", { style: { flex: 1 }, children: props.text }),
        /* @__PURE__ */ jsx(Icon, { name: "chevron", size: 14 })
      ]
    }
  );
}
__name(DueBanner, "DueBanner");
function Row(props) {
  const timer = useState({ id: null })[0];
  const start = /* @__PURE__ */ __name(() => {
    if (!props.onLongPress) return;
    timer.id = window.setTimeout(() => props.onLongPress?.(), 550);
  }, "start");
  const cancel = /* @__PURE__ */ __name(() => {
    if (timer.id !== null) {
      window.clearTimeout(timer.id);
      timer.id = null;
    }
  }, "cancel");
  return /* @__PURE__ */ jsxs(
    "div",
    {
      role: props.onClick ? "button" : void 0,
      onClick: props.onClick,
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onContextMenu: /* @__PURE__ */ __name((event) => {
        if (!props.onLongPress) return;
        event.preventDefault();
        props.onLongPress();
      }, "onContextMenu"),
      style: {
        display: "flex",
        alignItems: "center",
        gap: SPACE.s3,
        padding: "10px 16px",
        cursor: props.onClick ? "pointer" : "default",
        borderBottom: `1px solid ${props.palette.line}`
      },
      children: [
        /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
          /* @__PURE__ */ jsx("div", { style: { fontSize: 15, fontWeight: 500, color: props.palette.ink, overflow: "hidden", textOverflow: "ellipsis" }, children: props.title }),
          props.subtitle ? /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: props.palette.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: props.subtitle }) : null
        ] }),
        props.trailing
      ]
    }
  );
}
__name(Row, "Row");
function SpeakButton(props) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick: /* @__PURE__ */ __name((event) => {
        event.stopPropagation();
        props.onClick();
      }, "onClick"),
      style: {
        border: "none",
        background: "transparent",
        color: props.palette.accent,
        padding: 6,
        cursor: "pointer",
        lineHeight: 1
      },
      "aria-label": "Speak",
      children: /* @__PURE__ */ jsx(Icon, { name: "speaker", size: props.size ?? 16 })
    }
  );
}
__name(SpeakButton, "SpeakButton");
function Sheet(props) {
  if (!props.open) return null;
  return /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "flex-end",
        background: "rgba(0,0,0,0.35)"
      },
      onClick: props.onClose,
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          onClick: /* @__PURE__ */ __name((event) => event.stopPropagation(), "onClick"),
          style: {
            width: "100%",
            maxHeight: "86dvh",
            overflowY: "auto",
            background: props.palette.bg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: "env(safe-area-inset-bottom)"
          },
          children: [
            /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", padding: "8px 0 2px" }, children: /* @__PURE__ */ jsx("div", { style: { width: 36, height: 5, borderRadius: 3, background: props.palette.line } }) }),
            props.children
          ]
        }
      )
    }
  );
}
__name(Sheet, "Sheet");
function PushPage(props) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        position: "absolute",
        inset: 0,
        zIndex: 20,
        background: props.palette.bg,
        display: "flex",
        flexDirection: "column"
      },
      children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: SPACE.s2,
              padding: "10px 12px",
              borderBottom: `1px solid ${props.palette.line}`,
              background: props.palette.bg
            },
            children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: props.onBack,
                  style: { border: "none", background: "transparent", color: props.palette.accent, fontSize: 17, cursor: "pointer", padding: "4px 8px" },
                  "aria-label": "Back",
                  children: "‹"
                }
              ),
              /* @__PURE__ */ jsx("div", { style: { flex: 1, fontSize: 16, fontWeight: 600, color: props.palette.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: props.title }),
              props.trailing
            ]
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }, children: props.children })
      ]
    }
  );
}
__name(PushPage, "PushPage");
function ReviewPage(props) {
  const { palette: palette2, t, store } = props;
  const [queue, setQueue] = useState(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState(null);
  const [reviewed, setReviewed] = useState(0);
  const [tomorrow, setTomorrow] = useState(0);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const anchor = await loadAnchor();
      if (cancelled) return;
      if (anchor && anchor.terms.length) {
        const byTerm = new Map(store.vocab.map((item) => [item.text, item]));
        const restored = anchor.terms.map((term) => byTerm.get(term)).filter(Boolean);
        if (restored.length) {
          setQueue(restored);
          setIndex(Math.min(anchor.index, restored.length));
          return;
        }
      }
      const fresh = dueQueue(store.vocab);
      setQueue(fresh);
      setIndex(0);
      if (fresh.length) await saveAnchor({ terms: fresh.map((item) => item.text), index: 0 });
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const current = queue && index < queue.length ? queue[index] : null;
  const exercise = useMemo(
    () => current ? planExercise({ index, item: current, entry: store.entryOf(current.text) }) : null,
    [current, index, store.entryOf]
  );
  const entry = current ? store.entryOf(current.text) : null;
  const grade = /* @__PURE__ */ __name(async (value) => {
    if (!current || !queue) return;
    const next = scheduleNext(current.box, value);
    await saveReview(current.text, next.box, next.nextReviewAt);
    void haptic("light");
    setReviewed((count) => count + 1);
    setFlipped(false);
    setAnswer("");
    setVerdict(null);
    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      await saveAnchor(null);
      store.refresh();
      setTomorrow(tomorrowPreview(store.vocab));
      setFinished(true);
      return;
    }
    setIndex(nextIndex);
    await saveAnchor({ terms: queue.map((item) => item.text), index: nextIndex });
    store.refresh();
  }, "grade");
  if (queue === null) return /* @__PURE__ */ jsx(PushPage, { palette: palette2, title: t("reviewTitle"), onBack: props.onBack, children: /* @__PURE__ */ jsx("div", {}) });
  if (finished) {
    return /* @__PURE__ */ jsx(PushPage, { palette: palette2, title: t("reviewTitle"), onBack: props.onBack, children: /* @__PURE__ */ jsxs(Centered, { children: [
      /* @__PURE__ */ jsx(Icon, { name: "checkmark.seal", size: 48, color: palette2.green }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 500, color: palette2.ink, marginTop: SPACE.s3 }, children: t("reviewDoneCount", { n: reviewed }) }),
      tomorrow > 0 ? /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted, marginTop: 6 }, children: t("reviewTomorrow", { n: tomorrow }) }) : null,
      /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s5 }, children: /* @__PURE__ */ jsx(PrimaryButton, { palette: palette2, title: t("done"), onClick: props.onBack }) })
    ] }) });
  }
  if (queue.length === 0 || !current || !exercise) {
    return /* @__PURE__ */ jsx(PushPage, { palette: palette2, title: t("reviewTitle"), onBack: props.onBack, children: /* @__PURE__ */ jsxs(Centered, { children: [
      /* @__PURE__ */ jsx(Icon, { name: "checkmark.seal", size: 40, color: palette2.green }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 15, fontWeight: 500, color: palette2.ink, marginTop: SPACE.s3 }, children: t("reviewEmpty") })
    ] }) });
  }
  return /* @__PURE__ */ jsx(PushPage, { palette: palette2, title: t("reviewTitle"), onBack: props.onBack, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", minHeight: "100%", padding: `${SPACE.s4}px 0 ${SPACE.s5}px` }, children: [
    /* @__PURE__ */ jsxs("div", { style: { padding: `0 ${SPACE.s5}px` }, children: [
      /* @__PURE__ */ jsx("div", { style: { height: 4, borderRadius: 2, background: palette2.line, overflow: "hidden" }, children: /* @__PURE__ */ jsx("div", { style: { width: `${index / queue.length * 100}%`, height: "100%", background: palette2.accent } }) }),
      /* @__PURE__ */ jsxs("div", { style: { fontSize: 12, color: palette2.muted, marginTop: 6 }, children: [
        index + 1,
        " / ",
        queue.length
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          margin: `0 ${SPACE.s5}px`,
          minHeight: 220,
          background: palette2.surface,
          borderRadius: RADIUS.card,
          padding: SPACE.s5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE.s3
        },
        children: !flipped ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: palette2.accent }, children: [
            /* @__PURE__ */ jsx(Icon, { name: kindIcon(exercise.kind), size: 12 }),
            " ",
            kindLabel(t, exercise.kind)
          ] }),
          exercise.kind === "listening" ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: /* @__PURE__ */ __name(() => void speak(current.text, "us"), "onClick"),
                style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 52, cursor: "pointer", lineHeight: 1 },
                "aria-label": t("speakAloud"),
                children: /* @__PURE__ */ jsx(Icon, { name: "speaker", size: 52 })
              }
            ),
            /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, textAlign: "center" }, children: t("listeningHint") })
          ] }) : /* @__PURE__ */ jsx("div", { style: { fontSize: exercise.kind === "cloze" ? 18 : 16, fontWeight: 500, color: palette2.ink, textAlign: "center" }, children: exercise.prompt ?? t("promptFallback") }),
          /* @__PURE__ */ jsx(
            "input",
            {
              value: answer,
              onChange: /* @__PURE__ */ __name((event) => setAnswer(event.target.value), "onChange"),
              onKeyDown: /* @__PURE__ */ __name((event) => {
                if (event.key !== "Enter" || !answer.trim()) return;
                setVerdict(isCorrect(answer, exercise.answer));
                setFlipped(true);
              }, "onKeyDown"),
              placeholder: t("answerPlaceholder"),
              autoCapitalize: "none",
              autoCorrect: "off",
              spellCheck: false,
              enterKeyHint: "done",
              style: {
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 10,
                border: `1px solid ${palette2.line}`,
                padding: "10px 12px",
                fontSize: 16,
                background: palette2.bg,
                color: palette2.ink
              }
            }
          )
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          verdict !== null ? /* @__PURE__ */ jsxs("div", { style: { fontSize: 13, fontWeight: 500, color: verdict ? palette2.green : palette2.orange }, children: [
            /* @__PURE__ */ jsx(Icon, { name: verdict ? "check" : "refresh", size: 13 }),
            " ",
            verdict ? t("answerCorrect") : t("answerKeepPracticing")
          ] }) : null,
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: SPACE.s2 }, children: [
            /* @__PURE__ */ jsx("span", { style: { fontSize: 28, fontWeight: 500, color: palette2.ink }, children: current.text }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: /* @__PURE__ */ __name(() => void speak(current.text, "us"), "onClick"),
                style: { border: "none", background: "transparent", color: palette2.accent, cursor: "pointer" },
                "aria-label": t("speakAloud"),
                children: /* @__PURE__ */ jsx(Icon, { name: "speaker", size: 18 })
              }
            )
          ] }),
          entry?.phoneticUK ? /* @__PURE__ */ jsxs("div", { style: { fontSize: 14, color: palette2.muted }, children: [
            "/",
            entry.phoneticUK,
            "/"
          ] }) : null,
          /* @__PURE__ */ jsx("div", { style: { height: 1, background: palette2.line, width: "100%" } }),
          current.brief ? /* @__PURE__ */ jsx("div", { style: { fontSize: 16, color: palette2.ink, textAlign: "center" }, children: current.brief }) : null,
          entry?.examTags.length ? /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }, children: entry.examTags.map((tag) => /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: palette2.muted, background: palette2.line, borderRadius: 999, padding: "4px 9px" }, children: tag }, tag)) }) : null,
          current.note ? /* @__PURE__ */ jsxs("div", { style: { width: "100%", background: alpha(palette2.accent, 0.08), borderRadius: RADIUS.field, padding: SPACE.s3 }, children: [
            /* @__PURE__ */ jsx("div", { style: { fontSize: 11, fontWeight: 500, color: palette2.muted }, children: t("savedContext") }),
            /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.ink, marginTop: 4 }, children: current.note })
          ] }) : null,
          current.kind === "word" ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: /* @__PURE__ */ __name(() => props.onOpenWord(current.text), "onClick"),
              style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 12, cursor: "pointer" },
              children: t("viewFullDetail")
            }
          ) : null
        ] })
      }
    ),
    /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
    !flipped ? /* @__PURE__ */ jsxs("div", { style: { padding: `0 ${SPACE.s5}px`, display: "flex", flexDirection: "column", gap: SPACE.s2 }, children: [
      /* @__PURE__ */ jsx(
        PrimaryButton,
        {
          palette: palette2,
          title: t("checkAnswer"),
          block: true,
          disabled: !answer.trim(),
          onClick: /* @__PURE__ */ __name(() => {
            setVerdict(isCorrect(answer, exercise.answer));
            setFlipped(true);
          }, "onClick")
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: /* @__PURE__ */ __name(() => {
            setVerdict(null);
            setFlipped(true);
          }, "onClick"),
          style: { border: "none", background: "transparent", color: palette2.muted, fontSize: 14, padding: 8, cursor: "pointer" },
          children: t("showAnswer")
        }
      )
    ] }) : /* @__PURE__ */ jsxs("div", { style: { padding: `0 ${SPACE.s5}px`, display: "flex", gap: SPACE.s3 }, children: [
      /* @__PURE__ */ jsx(GradeButton, { palette: palette2, label: t("gradeForgot"), tint: palette2.red, onClick: /* @__PURE__ */ __name(() => void grade("forgot"), "onClick") }),
      /* @__PURE__ */ jsx(GradeButton, { palette: palette2, label: t("gradeFuzzy"), tint: palette2.orange, onClick: /* @__PURE__ */ __name(() => void grade("fuzzy"), "onClick") }),
      /* @__PURE__ */ jsx(GradeButton, { palette: palette2, label: t("gradeKnow"), tint: palette2.green, onClick: /* @__PURE__ */ __name(() => void grade("know"), "onClick") })
    ] })
  ] }) });
}
__name(ReviewPage, "ReviewPage");
function GradeButton(props) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick: props.onClick,
      style: {
        flex: 1,
        border: "none",
        borderRadius: RADIUS.field,
        padding: "12px 0",
        fontSize: 14,
        fontWeight: 500,
        color: props.tint,
        background: alpha(props.tint, 0.12),
        cursor: "pointer"
      },
      children: props.label
    }
  );
}
__name(GradeButton, "GradeButton");
function Centered({ children }) {
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }, children });
}
__name(Centered, "Centered");
function kindLabel(t, kind) {
  if (kind === "listening") return t("exerciseListening");
  if (kind === "cloze") return t("exerciseCloze");
  return t("exerciseSpelling");
}
__name(kindLabel, "kindLabel");
function kindIcon(kind) {
  if (kind === "listening") return "ear";
  if (kind === "cloze") return "blank";
  return "pencil";
}
__name(kindIcon, "kindIcon");
function SearchPage(props) {
  const { palette: palette2, t, store } = props;
  const [daily, setDaily] = useState(null);
  const [expandHistory, setExpandHistory] = useState(false);
  const [expandTranslations, setExpandTranslations] = useState(false);
  const trimmed = props.query.trim();
  const due = useMemo(() => dueCount(store.vocab), [store.vocab]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const dateKey = dateKeyOf();
      const cached = await getDaily(dateKey);
      if (cancelled) return;
      if (cached) {
        setDaily(cached);
        return;
      }
      setDaily({ dateKey, ...seedSentence(dateKey) });
      const visible = props.surface !== null && props.surface !== "headless";
      if (!props.aiAvailable || !visible) return;
      if (!await probeAI()) return;
      const generated = await generateDaily(dateKey);
      if (cancelled || !generated) return;
      const value = { dateKey, ...generated };
      await saveDaily(value);
      setDaily(value);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.aiAvailable, props.surface]);
  const suggestions = useMemo(
    () => suggest({ prefix: trimmed, history: store.history, vocab: store.vocab, cachedWords: store.cachedWords }),
    [trimmed, store.history, store.vocab, store.cachedWords]
  );
  if (trimmed) {
    return /* @__PURE__ */ jsxs("div", { children: [
      suggestions.map((item) => /* @__PURE__ */ jsx(
        Row,
        {
          palette: palette2,
          title: item.term,
          subtitle: item.brief || void 0,
          onClick: /* @__PURE__ */ __name(() => props.onOpenWord(item.term), "onClick"),
          trailing: item.isCached ? /* @__PURE__ */ jsx(InfoChip, { palette: palette2, label: t("cached"), tint: palette2.green, filled: true }) : void 0
        },
        item.term
      )),
      /* @__PURE__ */ jsx(
        Row,
        {
          palette: palette2,
          title: /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx(Icon, { name: "sparkles", size: 13, color: palette2.accent }),
            " ",
            t("lookupAction"),
            " ",
            /* @__PURE__ */ jsxs("span", { style: { fontWeight: 600 }, children: [
              "“",
              trimmed,
              "”"
            ] })
          ] }),
          onClick: /* @__PURE__ */ __name(() => {
            if (resolveIntent(trimmed) === "translate") props.onTranslateSentence(trimmed);
            else props.onOpenWord(trimmed);
          }, "onClick")
        }
      ),
      /* @__PURE__ */ jsx(
        Row,
        {
          palette: palette2,
          title: /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx(Icon, { name: "globe", size: 13, color: palette2.accent }),
            " ",
            t("translateAsSentence")
          ] }),
          onClick: /* @__PURE__ */ __name(() => props.onTranslateSentence(trimmed), "onClick")
        }
      )
    ] });
  }
  const historyRows = expandHistory ? store.history : store.history.slice(0, 5);
  const translationRows = expandTranslations ? store.translations : store.translations.slice(0, 5);
  const bothEmpty = store.history.length === 0 && store.translations.length === 0;
  return /* @__PURE__ */ jsxs("div", { style: { paddingBottom: SPACE.s6 }, children: [
    due > 0 ? /* @__PURE__ */ jsx("div", { style: { padding: `${SPACE.s3}px ${SPACE.s4}px 0` }, children: /* @__PURE__ */ jsx(DueBanner, { palette: palette2, text: dueBanner(t, props.lang, due), onClick: props.onOpenReview }) }) : null,
    daily && daily.en ? /* @__PURE__ */ jsx("div", { style: { padding: `${SPACE.s4}px ${SPACE.s4}px 4px` }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s2 }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 11, fontWeight: 500, color: palette2.accent, textTransform: "uppercase", letterSpacing: 0.6 }, children: t("dailyHeader") }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 15, fontWeight: 500, color: palette2.ink }, children: daily.en }),
      daily.zh ? /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted }, children: `“${daily.zh}” — ${daily.author}` }) : null,
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: SPACE.s2, marginTop: 2 }, children: [
        /* @__PURE__ */ jsx(InfoChip, { palette: palette2, icon: "speaker", label: t("speakNormal"), onClick: /* @__PURE__ */ __name(() => void speak(daily.en, "us", "normal"), "onClick") }),
        /* @__PURE__ */ jsx(InfoChip, { palette: palette2, icon: "tortoise", label: t("speakSlow"), onClick: /* @__PURE__ */ __name(() => void speak(daily.en, "us", "slow"), "onClick") })
      ] })
    ] }) }) : null,
    bothEmpty ? /* @__PURE__ */ jsx(EmptyState, { palette: palette2, icon: "magnifyingglass", text: t("emptySearchHint") }) : null,
    store.history.length > 0 ? /* @__PURE__ */ jsxs("section", { style: { marginTop: SPACE.s5 }, children: [
      /* @__PURE__ */ jsx("div", { style: { padding: `0 ${SPACE.s4}px` }, children: /* @__PURE__ */ jsx(
        SectionHeader,
        {
          palette: palette2,
          title: t("recentLookups"),
          trailing: /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 11, cursor: "pointer" },
              onClick: /* @__PURE__ */ __name(async () => {
                const ok = await confirm({
                  title: t("clearHistoryTitle"),
                  confirmTitle: t("clear"),
                  cancelTitle: t("cancel"),
                  destructive: true
                });
                if (!ok) return;
                await clearHistory();
                store.refresh();
              }, "onClick"),
              children: t("clear")
            }
          )
        }
      ) }),
      historyRows.map((item) => /* @__PURE__ */ jsx(
        Row,
        {
          palette: palette2,
          title: item.term,
          subtitle: item.brief || void 0,
          onClick: /* @__PURE__ */ __name(() => props.onOpenWord(item.term), "onClick"),
          onLongPress: /* @__PURE__ */ __name(async () => {
            const action = await pickAction(props, [
              { id: "copy", title: t("copy") },
              { id: "save", title: t("addToVocab") },
              { id: "delete", title: t("delete"), destructive: true }
            ]);
            if (action === "copy") await copyText(item.term);
            if (action === "save") {
              await upsertVocab({ term: item.term, brief: item.brief });
              store.refresh();
            }
            if (action === "delete") {
              await removeHistory(item.term);
              store.refresh();
            }
          }, "onLongPress")
        },
        item.term
      )),
      store.history.length > 5 ? /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: /* @__PURE__ */ __name(() => setExpandHistory((value) => !value), "onClick"),
          style: expandStyle(palette2),
          children: [
            expandHistory ? t("collapse") : t("expandAll"),
            " ",
            /* @__PURE__ */ jsx(Icon, { name: expandHistory ? "chevron.up" : "chevron.down", size: 11 })
          ]
        }
      ) : null
    ] }) : null,
    store.translations.length > 0 ? /* @__PURE__ */ jsxs("section", { style: { marginTop: SPACE.s5 }, children: [
      /* @__PURE__ */ jsx("div", { style: { padding: `0 ${SPACE.s4}px` }, children: /* @__PURE__ */ jsx(
        SectionHeader,
        {
          palette: palette2,
          title: t("translationHistory"),
          trailing: /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 11, cursor: "pointer" },
              onClick: /* @__PURE__ */ __name(async () => {
                const ok = await confirm({
                  title: t("clearTranslationsTitle"),
                  confirmTitle: t("clear"),
                  cancelTitle: t("cancel"),
                  destructive: true
                });
                if (!ok) return;
                await clearTranslations();
                store.refresh();
              }, "onClick"),
              children: t("clear")
            }
          )
        }
      ) }),
      translationRows.map((record) => /* @__PURE__ */ jsx(
        Row,
        {
          palette: palette2,
          title: /* @__PURE__ */ jsx("span", { style: { fontSize: 14 }, children: record.source }),
          subtitle: record.target,
          onClick: /* @__PURE__ */ __name(() => props.onOpenTranslation(record.id), "onClick"),
          trailing: record.starred ? /* @__PURE__ */ jsx(Icon, { name: "star.fill", size: 11, color: palette2.accent }) : void 0
        },
        record.id
      )),
      store.translations.length > 5 ? /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: /* @__PURE__ */ __name(() => setExpandTranslations((value) => !value), "onClick"),
          style: expandStyle(palette2),
          children: [
            expandTranslations ? t("collapse") : t("expandAll"),
            " ",
            /* @__PURE__ */ jsx(Icon, { name: expandTranslations ? "chevron.up" : "chevron.down", size: 11 })
          ]
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ jsx(ChipsFlow, { children: null })
  ] });
}
__name(SearchPage, "SearchPage");
function expandStyle(palette2) {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "transparent",
    color: palette2.accent,
    fontSize: 13,
    padding: `10px ${SPACE.s4}px`,
    cursor: "pointer",
    borderBottom: `1px solid ${alpha(palette2.line, 1)}`
  };
}
__name(expandStyle, "expandStyle");
async function pickAction(props, actions) {
  const bridge2 = typeof window !== "undefined" ? window.aibox : void 0;
  if (!bridge2?.ui) return null;
  try {
    const result = await bridge2.ui.actionSheet({
      actions: actions.map((action) => ({
        id: action.id,
        title: action.title,
        role: action.destructive ? "destructive" : "default"
      }))
    });
    return result.cancelled ? null : result.actionId;
  } catch {
    return null;
  }
}
__name(pickAction, "pickAction");
const NATIVE_NAME = { zh: "中文", en: "English" };
const MAX_CHARS = 3e3;
function TranslatePage(props) {
  const { palette: palette2, t, store } = props;
  const [input, setInput] = useState("");
  const [direction, setDirection] = useState("auto");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (props.pending === null) return;
    setInput(props.pending);
    props.onPendingConsumed();
  }, [props.pending]);
  const preview = useMemo(() => previewDirection(input, direction), [input, direction]);
  const overLimit = input.length > MAX_CHARS;
  const run = /* @__PURE__ */ __name(async () => {
    const text2 = input.trim();
    if (!text2 || busy || overLimit) return;
    setBusy(true);
    setOutput("");
    setError("");
    let accumulated = "";
    try {
      await translateStream({
        text: text2,
        from: preview.from,
        to: preview.to,
        onDelta: /* @__PURE__ */ __name((chunk) => {
          accumulated += chunk;
          setOutput(accumulated);
        }, "onDelta")
      });
      const finalText = accumulated.trim();
      if (!finalText) {
        setError(t("translateFailed"));
      } else {
        await saveTranslation({
          id: cryptoID(),
          source: text2,
          target: finalText,
          srcLang: preview.from,
          dstLang: preview.to,
          at: Date.now(),
          starred: false
        });
        store.refresh();
      }
    } catch (caught) {
      setError(caught instanceof LookupError ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, "run");
  return /* @__PURE__ */ jsxs("div", { style: { padding: SPACE.s4, display: "flex", flexDirection: "column", gap: SPACE.s4 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: SPACE.s2, fontSize: 13, fontWeight: 500, color: palette2.accent }, children: [
      /* @__PURE__ */ jsx("button", { type: "button", style: plain(palette2), onClick: /* @__PURE__ */ __name(() => setDirection("zhToEn"), "onClick"), children: NATIVE_NAME[preview.from] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          style: plain(palette2),
          onClick: /* @__PURE__ */ __name(() => setDirection(preview.from === "zh" ? "enToZh" : "zhToEn"), "onClick"),
          "aria-label": "Swap",
          children: /* @__PURE__ */ jsx(Icon, { name: "swap", size: 13 })
        }
      ),
      /* @__PURE__ */ jsx("button", { type: "button", style: plain(palette2), onClick: /* @__PURE__ */ __name(() => setDirection("enToZh"), "onClick"), children: NATIVE_NAME[preview.to] }),
      /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
      direction !== "auto" ? /* @__PURE__ */ jsx("button", { type: "button", style: { ...plain(palette2), fontSize: 11, color: palette2.muted }, onClick: /* @__PURE__ */ __name(() => setDirection("auto"), "onClick"), children: t("autoDetect") }) : null
    ] }),
    /* @__PURE__ */ jsx(
      "textarea",
      {
        value: input,
        onChange: /* @__PURE__ */ __name((event) => setInput(event.target.value), "onChange"),
        placeholder: t("translateInputPlaceholder"),
        rows: 4,
        style: {
          width: "100%",
          boxSizing: "border-box",
          resize: "vertical",
          minHeight: 96,
          maxHeight: 260,
          borderRadius: RADIUS.field,
          border: `1px solid ${palette2.line}`,
          padding: SPACE.s3,
          fontSize: 15,
          color: palette2.ink,
          background: palette2.surface,
          fontFamily: "inherit"
        }
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: SPACE.s3 }, children: [
      /* @__PURE__ */ jsxs("span", { style: { fontSize: 11, color: overLimit ? palette2.red : palette2.muted }, children: [
        input.length,
        " / ",
        MAX_CHARS
      ] }),
      /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
      /* @__PURE__ */ jsx(
        PrimaryButton,
        {
          palette: palette2,
          title: t("translateAction"),
          busy,
          disabled: !input.trim() || overLimit || !props.aiAvailable,
          onClick: run
        }
      )
    ] }),
    error ? /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.red }, children: error }) : null,
    output ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s3 }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 16, color: palette2.ink, whiteSpace: "pre-wrap" }, children: output }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: SPACE.s4 }, children: [
        /* @__PURE__ */ jsx("button", { type: "button", style: { ...plain(palette2), fontSize: 12 }, onClick: /* @__PURE__ */ __name(() => void copyText(output), "onClick"), children: t("copy") }),
        /* @__PURE__ */ jsxs("button", { type: "button", style: { ...plain(palette2), fontSize: 12 }, onClick: /* @__PURE__ */ __name(() => void speak(output, "us"), "onClick"), children: [
          /* @__PURE__ */ jsx(Icon, { name: "speaker", size: 12 }),
          " ",
          t("speakAloud")
        ] })
      ] })
    ] }) : null
  ] });
}
__name(TranslatePage, "TranslatePage");
function plain(palette2) {
  return {
    border: "none",
    background: "transparent",
    color: palette2.accent,
    padding: 0,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500
  };
}
__name(plain, "plain");
function TranslationDetail(props) {
  const { palette: palette2, t, store } = props;
  const [record, setRecord] = useState(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found = await getTranslation(props.recordID);
      if (cancelled) return;
      if (!found) setMissing(true);
      else setRecord(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.recordID]);
  const toggleStar = /* @__PURE__ */ __name(async () => {
    if (!record) return;
    const next = { ...record, starred: !record.starred };
    setRecord(next);
    await saveTranslation(next);
    store.refresh();
  }, "toggleStar");
  const retranslate = /* @__PURE__ */ __name(async () => {
    if (!record || busy) return;
    setBusy(true);
    setError("");
    const previous = record.target;
    let accumulated = "";
    try {
      await translateStream({
        text: record.source,
        from: record.srcLang,
        to: record.dstLang,
        onDelta: /* @__PURE__ */ __name((chunk) => {
          accumulated += chunk;
          setRecord((current) => current ? { ...current, target: accumulated } : current);
        }, "onDelta")
      });
      const finalText = accumulated.trim();
      if (!finalText) {
        setRecord((current) => current ? { ...current, target: previous } : current);
        setError(t("translateFailed"));
      } else {
        const next = { ...record, target: finalText, at: Date.now() };
        setRecord(next);
        await saveTranslation(next);
        store.refresh();
      }
    } catch (caught) {
      setRecord((current) => current ? { ...current, target: previous } : current);
      setError(caught instanceof LookupError ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, "retranslate");
  if (missing) {
    return /* @__PURE__ */ jsx(PushPage, { palette: palette2, title: "", onBack: props.onBack, children: /* @__PURE__ */ jsx(EmptyState, { palette: palette2, icon: "clock", text: t("noTranslationRecord") }) });
  }
  if (!record) return /* @__PURE__ */ jsx(PushPage, { palette: palette2, title: "", onBack: props.onBack, children: /* @__PURE__ */ jsx("div", {}) });
  const speakText = record.srcLang === "en" ? record.source : record.target;
  return /* @__PURE__ */ jsx(
    PushPage,
    {
      palette: palette2,
      title: record.source,
      onBack: props.onBack,
      trailing: /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: toggleStar,
          style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 17, cursor: "pointer", padding: 8 },
          "aria-label": record.starred ? t("unfavourite") : t("favourite"),
          children: /* @__PURE__ */ jsx(Icon, { name: record.starred ? "star.fill" : "star", size: 17 })
        }
      ),
      children: /* @__PURE__ */ jsxs("div", { style: { padding: SPACE.s4, display: "flex", flexDirection: "column", gap: SPACE.s5 }, children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { style: { fontSize: 11, fontWeight: 500, color: palette2.muted, textTransform: "uppercase" }, children: NATIVE_NAME[record.srcLang] }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: 16, fontWeight: 500, color: palette2.ink, marginTop: 6, userSelect: "text" }, children: record.source })
        ] }),
        /* @__PURE__ */ jsx("div", { style: { height: 1, background: palette2.line } }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("div", { style: { fontSize: 11, fontWeight: 500, color: palette2.accent, textTransform: "uppercase" }, children: [
            NATIVE_NAME[record.dstLang],
            busy ? " …" : ""
          ] }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: 16, color: palette2.ink, marginTop: 6, whiteSpace: "pre-wrap", userSelect: "text" }, children: record.target })
        ] }),
        error ? /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.red }, children: error }) : null,
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: SPACE.s4, alignItems: "center" }, children: [
          /* @__PURE__ */ jsx("button", { type: "button", style: { ...plain(palette2), fontSize: 12 }, onClick: /* @__PURE__ */ __name(() => void copyText(record.target), "onClick"), children: t("copy") }),
          /* @__PURE__ */ jsxs("button", { type: "button", style: { ...plain(palette2), fontSize: 12 }, onClick: /* @__PURE__ */ __name(() => void speak(speakText, "us"), "onClick"), children: [
            /* @__PURE__ */ jsx(Icon, { name: "speaker", size: 12 }),
            " ",
            t("speakAloud")
          ] }),
          /* @__PURE__ */ jsx(SecondaryButton, { palette: palette2, title: t("retranslate"), icon: "refresh", disabled: busy, onClick: retranslate }),
          /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              style: { ...plain(palette2), fontSize: 12, color: palette2.red },
              onClick: /* @__PURE__ */ __name(async () => {
                await removeTranslation(record.id);
                store.refresh();
                props.onBack();
              }, "onClick"),
              children: t("delete")
            }
          )
        ] })
      ] })
    }
  );
}
__name(TranslationDetail, "TranslationDetail");
function VocabPage(props) {
  const { palette: palette2, t, store } = props;
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("added");
  const [tag, setTag] = useState(null);
  const due = useMemo(() => dueCount(store.vocab), [store.vocab]);
  const tagsOf = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const item of store.vocab) {
      if (item.kind !== "word") continue;
      const entry = store.entryOf(item.text);
      if (entry?.examTags.length) map.set(item.text, entry.examTags);
    }
    return map;
  }, [store.vocab, store.entryOf]);
  const filtered = useMemo(() => {
    const query = props.query.trim().toLowerCase();
    let rows = store.vocab.filter((item) => matchesFilter(item, filter));
    if (query) {
      rows = rows.filter((item) => item.text.includes(query) || (item.brief ?? "").toLowerCase().includes(query));
    }
    if (tag) rows = rows.filter((item) => (tagsOf.get(item.text) ?? []).includes(tag));
    return rows;
  }, [store.vocab, filter, props.query, tag, tagsOf]);
  const availableTags = useMemo(() => {
    const set = /* @__PURE__ */ new Set();
    for (const item of filtered) for (const value of tagsOf.get(item.text) ?? []) set.add(value);
    return [...set].sort();
  }, [filtered, tagsOf]);
  const groups = useMemo(() => buildGroups(filtered, sort), [filtered, sort]);
  return /* @__PURE__ */ jsxs("div", { style: { paddingBottom: SPACE.s6 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: SPACE.s2, padding: `${SPACE.s3}px ${SPACE.s4}px`, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ jsx(
        InfoChip,
        {
          palette: palette2,
          icon: "list",
          label: `${t("filterVocab")}: ${filterLabel(t, filter)}`,
          filled: filter !== "all",
          onClick: /* @__PURE__ */ __name(async () => {
            const picked = await pickAction(props, [
              { id: "all", title: t("filterAll") },
              { id: "word", title: t("filterWord") },
              { id: "sentence", title: t("filterSentence") },
              { id: "mastered", title: t("filterMastered") },
              { id: "unmastered", title: t("filterUnmastered") }
            ]);
            if (picked) setFilter(picked);
          }, "onClick")
        }
      ),
      /* @__PURE__ */ jsx(
        InfoChip,
        {
          palette: palette2,
          icon: "cards",
          label: `${t("sortBy")}: ${sortLabel(t, sort)}`,
          filled: sort !== "added",
          onClick: /* @__PURE__ */ __name(async () => {
            const picked = await pickAction(props, [
              { id: "added", title: t("sortAdded") },
              { id: "alpha", title: t("sortAlpha") },
              { id: "urgency", title: t("sortUrgency") }
            ]);
            if (picked) setSort(picked);
          }, "onClick")
        }
      ),
      availableTags.length ? /* @__PURE__ */ jsx(
        InfoChip,
        {
          palette: palette2,
          label: `${t("examTag")}: ${tag ?? t("allTags")}`,
          filled: tag !== null,
          onClick: /* @__PURE__ */ __name(async () => {
            const picked = await pickAction(props, [
              { id: "__all", title: t("allTags") },
              ...availableTags.map((value) => ({ id: value, title: value }))
            ]);
            if (picked) setTag(picked === "__all" ? null : picked);
          }, "onClick")
        }
      ) : null
    ] }),
    due > 0 ? /* @__PURE__ */ jsx("div", { style: { padding: `0 ${SPACE.s4}px ${SPACE.s3}px` }, children: /* @__PURE__ */ jsx(DueBanner, { palette: palette2, text: dueBanner(t, props.lang, due), onClick: props.onOpenReview }) }) : null,
    filtered.length === 0 ? /* @__PURE__ */ jsx(EmptyState, { palette: palette2, icon: "star", text: t("vocabEmpty") }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { style: { padding: `0 ${SPACE.s4}px 6px`, fontSize: 12, color: palette2.muted }, children: t("vocabCount", { n: filtered.length }) }),
      groups.map((group) => /* @__PURE__ */ jsxs("section", { children: [
        group.key ? /* @__PURE__ */ jsx("div", { style: { padding: `${SPACE.s3}px ${SPACE.s4}px 4px`, fontSize: 12, color: palette2.muted }, children: group.key }) : null,
        group.items.map((item) => /* @__PURE__ */ jsx(
          Row,
          {
            palette: palette2,
            title: /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [
              item.text,
              item.masteredAt ? /* @__PURE__ */ jsx(Icon, { name: "checkmark.seal", size: 12, color: palette2.green }) : null
            ] }),
            subtitle: item.brief || void 0,
            onClick: /* @__PURE__ */ __name(() => props.onOpenWord(item.text), "onClick"),
            trailing: /* @__PURE__ */ jsx(SpeakButton, { palette: palette2, onClick: /* @__PURE__ */ __name(() => void speak(item.text, "us"), "onClick") }),
            onLongPress: /* @__PURE__ */ __name(async () => {
              const action = await pickAction(props, [
                { id: "master", title: item.masteredAt ? t("unmarkMastered") : t("markMastered") },
                { id: "delete", title: t("delete"), destructive: true }
              ]);
              if (action === "master") {
                await upsertVocab({ term: item.text, mastered: item.masteredAt === null });
                store.refresh();
              }
              if (action === "delete") {
                await removeVocab(item.text);
                store.refresh();
              }
            }, "onLongPress")
          },
          item.text
        ))
      ] }, group.key))
    ] })
  ] });
}
__name(VocabPage, "VocabPage");
function matchesFilter(item, filter) {
  switch (filter) {
    case "word":
      return item.kind === "word";
    case "sentence":
      return item.kind === "sentence";
    case "mastered":
      return item.masteredAt !== null;
    case "unmastered":
      return item.masteredAt === null;
    default:
      return true;
  }
}
__name(matchesFilter, "matchesFilter");
function filterLabel(t, filter) {
  const map = {
    all: "filterAll",
    word: "filterWord",
    sentence: "filterSentence",
    mastered: "filterMastered",
    unmastered: "filterUnmastered"
  };
  return t(map[filter]);
}
__name(filterLabel, "filterLabel");
function sortLabel(t, sort) {
  const map = { added: "sortAdded", alpha: "sortAlpha", urgency: "sortUrgency" };
  return t(map[sort]);
}
__name(sortLabel, "sortLabel");
function buildGroups(items, sort) {
  if (sort === "alpha") {
    return [{ key: "", items: [...items].sort((a, b) => a.text.localeCompare(b.text, void 0, { sensitivity: "base" })) }];
  }
  if (sort === "urgency") {
    return [{ key: "", items: [...items].sort((a, b) => (a.nextReviewAt ?? -Infinity) - (b.nextReviewAt ?? -Infinity)) }];
  }
  const buckets = /* @__PURE__ */ new Map();
  for (const item of [...items].sort((a, b) => b.addedAt - a.addedAt)) {
    const date = new Date(item.addedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  return [...buckets.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, group]) => ({ key, items: group }));
}
__name(buildGroups, "buildGroups");
function WordDetail(props) {
  const { palette: palette2, t, store, word } = props;
  const [payload, setPayload] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [regenerateError, setRegenerateError] = useState("");
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const saved = useMemo(
    () => store.vocab.some((item) => item.text === word.trim().toLowerCase()),
    [store.vocab, word]
  );
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setPayload(null);
      setError("");
      setRegenerateError("");
      setMeta(null);
      const cached = await getEntry(word);
      if (cached && cached.payload && Array.isArray(cached.payload.senses)) {
        if (cancelled) return;
        await recordHistory(word, cached.brief);
        setPayload(cached.payload);
        setMeta({ isCached: true, source: cached.source });
        setLoading(false);
        store.refresh();
        return;
      }
      try {
        const fresh = await lookupWord(word);
        if (cancelled) return;
        const entry = await replaceEntry(word, fresh);
        await recordHistory(word, entry.brief);
        setPayload(fresh);
        setMeta({ isCached: false, source: fresh.source });
        store.refresh();
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof LookupError ? caught.message : String(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [word]);
  const entryText = payload ? formatEntryText(payload) : "";
  const regenerate = /* @__PURE__ */ __name(async () => {
    if (!payload || regenerating) return;
    setRegenerating(true);
    setRegenerateError("");
    try {
      const fresh = await lookupWord(word);
      await replaceEntry(word, fresh);
      setPayload(fresh);
      setMeta({ isCached: false, source: fresh.source });
      store.refresh();
    } catch (caught) {
      setRegenerateError(caught instanceof LookupError ? caught.message : String(caught));
    } finally {
      setRegenerating(false);
    }
  }, "regenerate");
  const toggleSave = /* @__PURE__ */ __name(async () => {
    if (saved) {
      await removeVocab(word);
    } else {
      await upsertVocab({
        term: word,
        kind: "word",
        brief: payload ? briefOf(payload) : "",
        note: payload?.examples[0]?.en ?? null
      });
    }
    store.refresh();
  }, "toggleSave");
  const menu = /* @__PURE__ */ __name(async () => {
    const action = await pickAction(props, [
      { id: "star", title: saved ? t("unfavourite") : t("favourite") },
      ...payload && !regenerating ? [{ id: "regen", title: t("regenerate") }] : [],
      ...entryText ? [{ id: "copy", title: t("copyEntry") }, { id: "share", title: t("share") }] : []
    ]);
    if (action === "star") await toggleSave();
    if (action === "regen") await regenerate();
    if (action === "copy") await copyText(entryText);
    if (action === "share") await shareText(entryText);
  }, "menu");
  return /* @__PURE__ */ jsx(
    PushPage,
    {
      palette: palette2,
      title: word,
      onBack: props.onBack,
      trailing: /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 2 }, children: [
        props.companionAvailable && payload ? /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: /* @__PURE__ */ __name(() => props.onCompanion(null, entryText), "onClick"),
            style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 17, cursor: "pointer", width: 44, height: 44 },
            "aria-label": t("companionTitle"),
            children: /* @__PURE__ */ jsx(Icon, { name: "sparkles", size: 17 })
          }
        ) : null,
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: menu,
            style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 17, cursor: "pointer", width: 44, height: 44 },
            "aria-label": "More",
            children: "⋯"
          }
        )
      ] }),
      children: /* @__PURE__ */ jsxs("div", { style: { padding: SPACE.s4, display: "flex", flexDirection: "column", gap: SPACE.s5 }, children: [
        /* @__PURE__ */ jsx("h1", { style: { margin: 0, fontSize: 30, fontWeight: 600, color: palette2.ink }, children: word }),
        loading ? /* @__PURE__ */ jsx(Skeleton, { palette: palette2 }) : null,
        !loading && error ? /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", paddingTop: SPACE.s8 }, children: [
          /* @__PURE__ */ jsx("div", { style: { fontSize: 15, fontWeight: 500, color: palette2.ink }, children: t("loadFailed") }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted, margin: `${SPACE.s2}px 0 ${SPACE.s4}px` }, children: error }),
          /* @__PURE__ */ jsx(PrimaryButton, { palette: palette2, title: t("retry"), onClick: /* @__PURE__ */ __name(() => props.onOpenWord(word), "onClick") })
        ] }) : null,
        payload ? /* @__PURE__ */ jsxs(Fragment, { children: [
          regenerateError ? /* @__PURE__ */ jsxs("div", { style: { background: alpha(palette2.orange, 0.1), borderRadius: RADIUS.field, padding: SPACE.s3 }, children: [
            /* @__PURE__ */ jsxs("div", { style: { fontSize: 13, fontWeight: 500, color: palette2.orange }, children: [
              /* @__PURE__ */ jsx(Icon, { name: "warning", size: 13 }),
              " ",
              t("regenerateFailed")
            ] }),
            /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted, marginTop: 4 }, children: regenerateError })
          ] }) : null,
          payload.corrected ? /* @__PURE__ */ jsxs("div", { style: { fontSize: 14, color: palette2.ink }, children: [
            t("didYouMean"),
            " ",
            /* @__PURE__ */ jsxs("span", { style: { fontWeight: 600 }, children: [
              "“",
              payload.corrected,
              "”?"
            ] })
          ] }) : null,
          meta ? /* @__PURE__ */ jsxs(ChipsFlow, { children: [
            /* @__PURE__ */ jsx(InfoChip, { palette: palette2, icon: "shield", label: sourceLabel(t, meta.source), filled: true }),
            /* @__PURE__ */ jsx(
              InfoChip,
              {
                palette: palette2,
                icon: meta.isCached ? "drive" : "refresh",
                label: meta.isCached ? t("cached") : t("justUpdated"),
                tint: meta.isCached ? void 0 : palette2.green,
                filled: !meta.isCached
              }
            )
          ] }) : null,
          payload.phoneticUK || payload.phoneticUS || payload.frequency !== null ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: SPACE.s2 }, children: [
            payload.phoneticUK ? /* @__PURE__ */ jsx(InfoChip, { palette: palette2, icon: "speaker", label: `UK /${payload.phoneticUK}/`, onClick: /* @__PURE__ */ __name(() => void speak(word, "uk"), "onClick") }) : null,
            payload.phoneticUS ? /* @__PURE__ */ jsx(InfoChip, { palette: palette2, icon: "speaker", label: `US /${payload.phoneticUS}/`, onClick: /* @__PURE__ */ __name(() => void speak(word, "us"), "onClick") }) : null,
            /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
            payload.frequency !== null ? /* @__PURE__ */ jsx(Frequency, { palette: palette2, value: payload.frequency }) : null
          ] }) : null,
          payload.examTags.length ? /* @__PURE__ */ jsx(ChipsFlow, { children: payload.examTags.map((tag) => /* @__PURE__ */ jsx(InfoChip, { palette: palette2, label: tag }, tag)) }) : null,
          /* @__PURE__ */ jsxs("section", { children: [
            /* @__PURE__ */ jsx(SectionHeader, { palette: palette2, title: t("sectionSenses") }),
            /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: payload.senses.map((sense, index) => /* @__PURE__ */ jsxs("div", { style: { fontSize: 15, color: palette2.ink }, children: [
              sense.pos ? /* @__PURE__ */ jsxs("span", { style: { color: palette2.accent }, children: [
                sense.pos,
                " "
              ] }) : null,
              sense.glosses.join("；")
            ] }, `${sense.pos}-${index}`)) })
          ] }),
          props.companionAvailable ? /* @__PURE__ */ jsxs("section", { children: [
            /* @__PURE__ */ jsx(SectionHeader, { palette: palette2, title: t("sectionCompanion") }),
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexWrap: "wrap", gap: SPACE.s2 }, children: [
              /* @__PURE__ */ jsx(Pill, { palette: palette2, icon: "quote", label: t("chipSimpler"), onClick: /* @__PURE__ */ __name(() => props.onCompanion(`Give me a simpler example sentence for "${word}".`, entryText), "onClick") }),
              /* @__PURE__ */ jsx(Pill, { palette: palette2, icon: "list", label: t("chipOther"), onClick: /* @__PURE__ */ __name(() => props.onCompanion(`Does "${word}" have other common meanings or uses I should know about?`, entryText), "onClick") })
            ] })
          ] }) : null,
          payload.forms.length ? /* @__PURE__ */ jsxs("section", { children: [
            /* @__PURE__ */ jsx(SectionHeader, { palette: palette2, title: t("sectionForms") }),
            /* @__PURE__ */ jsx(ChipsFlow, { children: payload.forms.map((form) => /* @__PURE__ */ jsx(
              InfoChip,
              {
                palette: palette2,
                label: `${form.label} ${form.value}`,
                onClick: /* @__PURE__ */ __name(() => props.onOpenWord(form.value), "onClick")
              },
              `${form.label}-${form.value}`
            )) })
          ] }) : null,
          payload.examples.length ? /* @__PURE__ */ jsxs("section", { children: [
            /* @__PURE__ */ jsx(SectionHeader, { palette: palette2, title: t("sectionExamples") }),
            /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s3 }, children: payload.examples.map((example, index) => /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "flex-start", gap: SPACE.s2 }, children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: /* @__PURE__ */ __name(() => void speak(example.en, "us"), "onClick"),
                  style: { flex: 1, border: "none", background: "transparent", padding: 0, textAlign: "left", cursor: "pointer" },
                  children: [
                    /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.ink }, children: example.en }),
                    example.zh ? /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted, marginTop: 2 }, children: example.zh }) : null
                  ]
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: /* @__PURE__ */ __name(() => props.onPractice(example.en), "onClick"),
                  style: { border: "none", background: "transparent", color: palette2.accent, cursor: "pointer", padding: 4 },
                  "aria-label": t("practiceTitle"),
                  children: /* @__PURE__ */ jsx(Icon, { name: "mic", size: 16 })
                }
              )
            ] }, `${example.en}-${index}`)) })
          ] }) : null,
          payload.memoryTip ? /* @__PURE__ */ jsxs("section", { children: [
            /* @__PURE__ */ jsx(SectionHeader, { palette: palette2, title: t("sectionMemoryTip") }),
            /* @__PURE__ */ jsx("div", { style: { background: palette2.surface, borderRadius: RADIUS.card, padding: SPACE.s3, fontSize: 14, color: palette2.ink }, children: payload.memoryTip })
          ] }) : null,
          payload.synonyms.length || payload.antonyms.length ? /* @__PURE__ */ jsxs("section", { children: [
            /* @__PURE__ */ jsx(SectionHeader, { palette: palette2, title: t("sectionRelated") }),
            /* @__PURE__ */ jsxs(ChipsFlow, { children: [
              payload.synonyms.map((item) => /* @__PURE__ */ jsx(InfoChip, { palette: palette2, label: item, filled: true, onClick: /* @__PURE__ */ __name(() => props.onOpenWord(item), "onClick") }, `syn-${item}`)),
              payload.antonyms.map((item) => /* @__PURE__ */ jsx(InfoChip, { palette: palette2, label: item, tint: palette2.red, filled: true, onClick: /* @__PURE__ */ __name(() => props.onOpenWord(item), "onClick") }, `ant-${item}`))
            ] })
          ] }) : null
        ] }) : null,
        !loading && !payload && !error ? /* @__PURE__ */ jsx(EmptyState, { palette: palette2, icon: "magnifyingglass", text: t("emptySearchHint") }) : null
      ] })
    }
  );
}
__name(WordDetail, "WordDetail");
function briefOf(payload) {
  const sense = payload.senses[0];
  if (!sense) return "";
  return [sense.pos, sense.glosses[0] ?? ""].filter(Boolean).join(" ").trim();
}
__name(briefOf, "briefOf");
function Frequency({ palette: palette2, value }) {
  const level = Math.min(5, Math.max(0, Math.round(value)));
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 3 }, children: [1, 2, 3, 4, 5].map((index) => /* @__PURE__ */ jsx(
    "span",
    {
      style: {
        width: 6,
        height: 6,
        borderRadius: 3,
        display: "inline-block",
        background: index <= level ? palette2.accent : "transparent",
        border: index <= level ? "none" : `1px solid ${palette2.line}`
      }
    },
    index
  )) });
}
__name(Frequency, "Frequency");
function Pill(props) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      onClick: props.onClick,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "none",
        borderRadius: RADIUS.pill,
        padding: "8px 12px",
        fontSize: 13,
        fontWeight: 500,
        color: props.palette.accent,
        background: alpha(props.palette.accent, 0.1),
        cursor: "pointer"
      },
      children: [
        /* @__PURE__ */ jsx(Icon, { name: props.icon, size: 12 }),
        " ",
        props.label
      ]
    }
  );
}
__name(Pill, "Pill");
function Skeleton({ palette: palette2 }) {
  const block = /* @__PURE__ */ __name((width, height) => /* @__PURE__ */ jsx("div", { style: { width, height, borderRadius: 8, background: palette2.surface } }), "block");
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s3, opacity: 0.55 }, children: [
    block(160, 28),
    block(220, 16),
    block("100%", 16),
    block("100%", 80)
  ] });
}
__name(Skeleton, "Skeleton");
function PracticeSheet(props) {
  const { palette: palette2, t } = props;
  const [state, setState] = useState("idle");
  const [score, setScore] = useState(null);
  const [reason, setReason] = useState(null);
  const [detail, setDetail] = useState("");
  const [partial, setPartial] = useState("");
  const pending = useRef(null);
  useEffect(() => {
    if (!props.open) return;
    setState("idle");
    setScore(null);
    setPartial("");
    void (async () => {
      const probe = await probeSpeech("en-US");
      if (!probe.available) {
        setReason(probe.reason);
        setDetail(probe.detail);
        setState("unavailable");
      }
    })();
    return () => {
      void cancelRecognizing();
    };
  }, [props.open]);
  useEffect(() => {
    if (state !== "recording") return;
    const timer = window.setInterval(async () => setPartial(await partialTranscript()), 400);
    return () => window.clearInterval(timer);
  }, [state]);
  const start = /* @__PURE__ */ __name(async () => {
    setState("requestingPermission");
    setPartial("");
    pending.current = recognize("en-US", 15e3);
    setState("recording");
  }, "start");
  const finish = /* @__PURE__ */ __name(async () => {
    setState("scoring");
    await stopRecognizing();
    const result = await pending.current;
    pending.current = null;
    if (!result || result.error) {
      setReason("engineError");
      setDetail(result?.error ?? "");
      setState("unavailable");
      return;
    }
    setScore(scorePronunciation(props.sentence, result.transcript));
    setState("result");
  }, "finish");
  return /* @__PURE__ */ jsxs(Sheet, { palette: palette2, open: props.open, onClose: props.onClose, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", padding: SPACE.s4 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 500, color: palette2.ink }, children: [
        /* @__PURE__ */ jsx(Icon, { name: "mic", size: 15 }),
        " ",
        t("practiceTitle")
      ] }),
      /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
      /* @__PURE__ */ jsx("button", { type: "button", onClick: props.onClose, style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 15, cursor: "pointer" }, children: t("done") })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { padding: `0 ${SPACE.s5}px`, fontSize: 17, fontWeight: 500, color: palette2.ink, textAlign: "center" }, children: props.sentence }),
    /* @__PURE__ */ jsxs("div", { style: { padding: `${SPACE.s6}px ${SPACE.s5}px ${SPACE.s6}px`, textAlign: "center" }, children: [
      state === "idle" ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: start,
            style: { border: "none", background: "transparent", color: palette2.accent, cursor: "pointer", lineHeight: 1 },
            "aria-label": t("practiceTapToStart"),
            children: /* @__PURE__ */ jsx(Icon, { name: "mic", size: 64 })
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted, marginTop: SPACE.s3 }, children: t("practiceTapToStart") })
      ] }) : null,
      state === "requestingPermission" || state === "scoring" ? /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted }, children: state === "scoring" ? t("practiceScoring") : "…" }) : null,
      state === "recording" ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: finish,
            style: { border: "none", background: "transparent", color: palette2.red, cursor: "pointer", lineHeight: 1 },
            "aria-label": t("practiceRecording"),
            children: /* @__PURE__ */ jsx(Icon, { name: "stop", size: 64 })
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted, marginTop: SPACE.s3 }, children: t("practiceRecording") }),
        partial ? /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted, marginTop: 6 }, children: partial }) : null
      ] }) : null,
      state === "result" && score ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s4, alignItems: "center" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 40, fontWeight: 500, color: scoreColor(palette2, score.percent) }, children: [
          score.percent,
          "%"
        ] }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted }, children: t("practiceMatchLabel") }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }, children: score.words.map((word, index) => /* @__PURE__ */ jsx(
          "span",
          {
            style: {
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 999,
              padding: "5px 10px",
              color: word.matched ? palette2.green : palette2.red,
              background: alpha(word.matched ? palette2.green : palette2.red, 0.12)
            },
            children: word.text
          },
          `${word.text}-${index}`
        )) }),
        /* @__PURE__ */ jsx(SecondaryButton, { palette: palette2, title: t("practiceRetry"), icon: "refresh", onClick: /* @__PURE__ */ __name(() => setState("idle"), "onClick") })
      ] }) : null,
      state === "unavailable" ? /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx(Icon, { name: "warning", size: 32, color: palette2.muted }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted, marginTop: SPACE.s3 }, children: unavailableText(t, reason, detail) })
      ] }) : null
    ] })
  ] });
}
__name(PracticeSheet, "PracticeSheet");
function scoreColor(palette2, percent) {
  if (percent >= 80) return palette2.green;
  if (percent >= 50) return palette2.orange;
  return palette2.red;
}
__name(scoreColor, "scoreColor");
function unavailableText(t, reason, detail) {
  switch (reason) {
    case "recognizerUnavailable":
      return t("speechRecognizerUnavailable");
    case "onDeviceUnsupported":
      return t("speechOnDeviceUnsupported");
    case "micDenied":
      return t("speechMicDenied");
    case "speechDenied":
      return t("speechDenied");
    default:
      return detail || t("speechRecognizerUnavailable");
  }
}
__name(unavailableText, "unavailableText");
function PhotoSheet(props) {
  const { palette: palette2, t } = props;
  const [busy, setBusy] = useState(false);
  const [words, setWords] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (props.open) return;
    setWords(null);
    setError(null);
    setPreview(null);
  }, [props.open]);
  const pick = /* @__PURE__ */ __name(async () => {
    setBusy(true);
    const result = await lookUpFromPhoto();
    setBusy(false);
    setPreview(result.previewURL);
    setWords(result.words);
    setError(result.error);
  }, "pick");
  return /* @__PURE__ */ jsxs(Sheet, { palette: palette2, open: props.open, onClose: props.onClose, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", padding: SPACE.s4 }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 15, fontWeight: 500, color: palette2.ink }, children: t("photoLookup") }),
      /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
      /* @__PURE__ */ jsx("button", { type: "button", onClick: props.onClose, style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 15, cursor: "pointer" }, children: t("done") })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { padding: `0 ${SPACE.s5}px ${SPACE.s6}px`, textAlign: "center" }, children: !preview && !words ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Icon, { name: "viewfinder", size: 48, color: palette2.muted }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted, margin: `${SPACE.s3}px ${SPACE.s6}px ${SPACE.s4}px` }, children: t("photoPickHint") }),
      /* @__PURE__ */ jsx(PrimaryButton, { palette: palette2, title: t("photoPick"), busy, onClick: pick })
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      preview ? /* @__PURE__ */ jsx("img", { src: preview, alt: "", style: { maxWidth: "100%", maxHeight: 240, borderRadius: RADIUS.card, objectFit: "contain" } }) : null,
      /* @__PURE__ */ jsxs("div", { style: { marginTop: SPACE.s4 }, children: [
        error === "load" ? /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted }, children: t("photoLoadFailed") }) : null,
        error === "unsupported" ? /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted }, children: t("photoUnsupported") }) : null,
        error === "empty" ? /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted }, children: t("photoNoText") }) : null,
        !error && words?.length ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted, marginBottom: SPACE.s2 }, children: t("photoTapWord") }),
          /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }, children: words.map((word) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: /* @__PURE__ */ __name(() => {
                props.onPickWord(word);
                props.onClose();
              }, "onClick"),
              style: {
                border: "none",
                borderRadius: 999,
                padding: "5px 10px",
                fontSize: 14,
                color: palette2.accent,
                background: alpha(palette2.accent, 0.12),
                cursor: "pointer"
              },
              children: word
            },
            word
          )) })
        ] }) : null
      ] }),
      /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s4 }, children: /* @__PURE__ */ jsx(SecondaryButton, { palette: palette2, title: t("photoChange"), icon: "photo", onClick: pick }) })
    ] }) })
  ] });
}
__name(PhotoSheet, "PhotoSheet");
function AiCompanion(props) {
  const { palette: palette2, t } = props;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const seeded = useRef("");
  const system = `The user is looking at this dictionary entry:

${props.entryText}`;
  const send = /* @__PURE__ */ __name(async (text2) => {
    const value = text2.trim();
    if (!value || busy) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", text: value }, { role: "assistant", text: "" }]);
    setBusy(true);
    const bridge2 = typeof window !== "undefined" ? window.aibox : void 0;
    if (!bridge2?.ai) {
      setMessages((current) => replaceLast(current, t("errNoProvider")));
      setBusy(false);
      return;
    }
    try {
      if (typeof bridge2.ai.generateStream === "function") {
        let accumulated = "";
        for await (const delta of bridge2.ai.generateStream({ system, prompt: value, intent: "balanced" })) {
          accumulated += delta;
          setMessages((current) => replaceLast(current, accumulated));
        }
      } else {
        const reply = await bridge2.ai.generate({ system, prompt: value, intent: "balanced" });
        setMessages((current) => replaceLast(current, reply));
      }
    } catch (error) {
      setMessages((current) => replaceLast(current, String(error)));
    } finally {
      setBusy(false);
    }
  }, "send");
  useEffect(() => {
    if (!props.open) {
      setMessages([]);
      seeded.current = "";
      return;
    }
    if (props.seed && seeded.current !== props.seed) {
      seeded.current = props.seed;
      void send(props.seed);
    }
  }, [props.open, props.seed]);
  const chips = [
    { label: t("chipSimpler"), seed: `Give me a simpler example sentence for "${props.word}".` },
    { label: t("chipOther"), seed: `Does "${props.word}" have other common meanings or uses I should know about?` },
    { label: t("chipStory"), seed: `Tell me a short, vivid memory story or association to help me remember "${props.word}".` },
    { label: t("chipWrite"), seed: `Help me write my own sentence using "${props.word}", and correct it if needed.` },
    { label: t("chipQuiz"), seed: `Quiz me on "${props.word}" with a couple of quick questions.` }
  ];
  return /* @__PURE__ */ jsxs(Sheet, { palette: palette2, open: props.open, onClose: props.onClose, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", padding: SPACE.s4 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 500, color: palette2.ink }, children: [
        /* @__PURE__ */ jsx(Icon, { name: "sparkles", size: 15, color: palette2.accent }),
        " ",
        t("companionTitle")
      ] }),
      /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: /* @__PURE__ */ __name(() => void shareWordContext(`Tell me more about the English word "${props.word}".`), "onClick"),
          style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 12, cursor: "pointer" },
          children: t("sendToChat")
        }
      ),
      /* @__PURE__ */ jsx("button", { type: "button", onClick: props.onClose, style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 15, cursor: "pointer", marginLeft: SPACE.s3 }, children: t("done") })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { padding: `0 ${SPACE.s4}px`, display: "flex", flexWrap: "wrap", gap: 6 }, children: chips.map((chip) => /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: /* @__PURE__ */ __name(() => void send(chip.seed), "onClick"),
        style: {
          border: "none",
          borderRadius: 999,
          padding: "8px 12px",
          fontSize: 13,
          fontWeight: 500,
          color: palette2.accent,
          background: alpha(palette2.accent, 0.1),
          cursor: "pointer"
        },
        children: chip.label
      },
      chip.label
    )) }),
    /* @__PURE__ */ jsxs("div", { style: { padding: SPACE.s4, display: "flex", flexDirection: "column", gap: SPACE.s3, minHeight: 160 }, children: [
      messages.length === 0 ? /* @__PURE__ */ jsx(EmptyState, { palette: palette2, icon: "sparkles", text: t("companionPlaceholder") }) : null,
      messages.map((message, index) => /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            alignSelf: message.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%",
            borderRadius: 18,
            padding: "10px 13px",
            fontSize: 15,
            whiteSpace: "pre-wrap",
            color: message.role === "user" ? palette2.onAccent : palette2.ink,
            background: message.role === "user" ? palette2.accent : palette2.surface
          },
          children: message.text || "…"
        },
        index
      ))
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: SPACE.s2, padding: `0 ${SPACE.s4}px ${SPACE.s4}px` }, children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          value: input,
          onChange: /* @__PURE__ */ __name((event) => setInput(event.target.value), "onChange"),
          onKeyDown: /* @__PURE__ */ __name((event) => {
            if (event.key === "Enter") void send(input);
          }, "onKeyDown"),
          placeholder: t("companionPlaceholder"),
          style: {
            flex: 1,
            borderRadius: RADIUS.field,
            border: `1px solid ${palette2.line}`,
            padding: "10px 12px",
            fontSize: 15,
            background: palette2.surface,
            color: palette2.ink
          }
        }
      ),
      /* @__PURE__ */ jsx(PrimaryButton, { palette: palette2, title: "↑", busy, disabled: !input.trim(), onClick: /* @__PURE__ */ __name(() => void send(input), "onClick") })
    ] })
  ] });
}
__name(AiCompanion, "AiCompanion");
function replaceLast(messages, text2) {
  const next = [...messages];
  next[next.length - 1] = { role: "assistant", text: text2 };
  return next;
}
__name(replaceLast, "replaceLast");
function App() {
  const scene = useScene();
  const locale = useLocale();
  const tabs = useTabs();
  const store = useWordStore();
  const lang = locale.language.startsWith("zh") ? "zh" : "en";
  const t = useMemo(() => makeT(lang), [lang]);
  const dark = scene?.appearance.effectiveColorScheme === "dark";
  const hostAccent = scene?.appearance.accentColor ?? null;
  const palette$1 = useMemo(() => {
    const base = palette(Boolean(dark));
    return hostAccent ? { ...base, accent: hostAccent } : base;
  }, [dark, hostAccent]);
  const [tab, setTab] = useState("search");
  const [route, setRoute] = useState({ kind: "root" });
  const [searchQuery, setSearchQuery] = useState("");
  const [vocabQuery, setVocabQuery] = useState("");
  const [pendingTranslate, setPendingTranslate] = useState(null);
  const [practice, setPractice] = useState(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [companion, setCompanion] = useState(null);
  useEffect(() => {
    if (tabs.rendered && tabs.selected && tabs.selected !== tab) setTab(tabs.selected);
  }, [tabs.selected, tabs.rendered]);
  useEffect(() => {
    registerWordActions(store.refresh);
  }, [store.refresh]);
  const openWord = useCallback((word) => {
    const value = word.trim();
    if (value) setRoute({ kind: "word", word: value });
  }, []);
  const goTranslate = useCallback((text2) => {
    setPendingTranslate(text2);
    setRoute({ kind: "root" });
    setTab("translate");
    if (tabs.rendered) void tabs.select("translate");
  }, [tabs.rendered]);
  const aiAvailable = capabilities.ai;
  const companionAvailable = aiAvailable;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        position: "relative",
        minHeight: "100dvh",
        background: palette$1.bg,
        color: palette$1.ink,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
        display: "flex",
        flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom)"
      },
      children: [
        tab !== "translate" ? /* @__PURE__ */ jsxs("div", { style: { padding: `${SPACE.s3}px ${SPACE.s4}px 0`, display: "flex", gap: SPACE.s2, alignItems: "center" }, children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              value: tab === "search" ? searchQuery : vocabQuery,
              onChange: /* @__PURE__ */ __name((event) => (tab === "search" ? setSearchQuery : setVocabQuery)(event.target.value), "onChange"),
              placeholder: tab === "search" ? t("searchPlaceholder") : t("vocabFilterPlaceholder"),
              autoCapitalize: "none",
              autoCorrect: "off",
              enterKeyHint: "search",
              onKeyDown: /* @__PURE__ */ __name((event) => {
                if (tab !== "search" || event.key !== "Enter") return;
                const value = searchQuery.trim();
                if (!value) return;
                if (resolveIntent(value) === "translate") goTranslate(value);
                else openWord(value);
              }, "onKeyDown"),
              style: {
                flex: 1,
                borderRadius: 10,
                border: "none",
                padding: "9px 12px",
                fontSize: 16,
                background: palette$1.surface,
                color: palette$1.ink
              }
            }
          ),
          tab === "search" && capabilities.picker && capabilities.ocr ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: /* @__PURE__ */ __name(() => setPhotoOpen(true), "onClick"),
              style: { border: "none", background: "transparent", color: palette$1.accent, cursor: "pointer", padding: 8 },
              "aria-label": t("photoLookup"),
              children: /* @__PURE__ */ jsx(Icon, { name: "viewfinder", size: 18 })
            }
          ) : null
        ] }) : null,
        /* @__PURE__ */ jsxs("main", { style: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }, children: [
          tab === "search" ? /* @__PURE__ */ jsx(
            SearchPage,
            {
              palette: palette$1,
              t,
              lang,
              store,
              query: searchQuery,
              aiAvailable,
              surface: scene?.effective ?? null,
              onOpenWord: openWord,
              onOpenTranslation: /* @__PURE__ */ __name((id) => setRoute({ kind: "translation", id }), "onOpenTranslation"),
              onTranslateSentence: goTranslate,
              onOpenReview: /* @__PURE__ */ __name(() => setRoute({ kind: "review" }), "onOpenReview")
            }
          ) : null,
          tab === "translate" ? /* @__PURE__ */ jsx(
            TranslatePage,
            {
              palette: palette$1,
              t,
              store,
              pending: pendingTranslate,
              aiAvailable,
              onPendingConsumed: /* @__PURE__ */ __name(() => setPendingTranslate(null), "onPendingConsumed")
            }
          ) : null,
          tab === "vocab" ? /* @__PURE__ */ jsx(
            VocabPage,
            {
              palette: palette$1,
              t,
              lang,
              store,
              query: vocabQuery,
              onOpenWord: openWord,
              onOpenReview: /* @__PURE__ */ __name(() => setRoute({ kind: "review" }), "onOpenReview")
            }
          ) : null
        ] }),
        !tabs.rendered ? /* @__PURE__ */ jsx(
          "nav",
          {
            style: {
              display: "flex",
              borderTop: `1px solid ${palette$1.line}`,
              background: palette$1.surface,
              paddingBottom: "env(safe-area-inset-bottom)"
            },
            children: ["translate", "search", "vocab"].map((id) => /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: /* @__PURE__ */ __name(() => setTab(id), "onClick"),
                style: {
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  padding: "10px 0 12px",
                  fontSize: 11,
                  cursor: "pointer",
                  color: tab === id ? palette$1.accent : palette$1.muted
                },
                children: [
                  /* @__PURE__ */ jsx("div", { style: { fontSize: 18, lineHeight: "22px" }, children: /* @__PURE__ */ jsx(Icon, { name: id === "translate" ? "globe" : id === "search" ? "magnifyingglass" : "star", size: 18 }) }),
                  t(id === "translate" ? "tabTranslate" : id === "search" ? "tabSearch" : "tabVocab")
                ]
              },
              id
            ))
          }
        ) : null,
        route.kind === "word" ? /* @__PURE__ */ jsx(
          WordDetail,
          {
            palette: palette$1,
            t,
            store,
            word: route.word,
            companionAvailable,
            onBack: /* @__PURE__ */ __name(() => setRoute({ kind: "root" }), "onBack"),
            onOpenWord: openWord,
            onPractice: /* @__PURE__ */ __name((sentence) => setPractice(sentence), "onPractice"),
            onCompanion: /* @__PURE__ */ __name((seed, entryText) => setCompanion({ word: route.word, entryText, seed }), "onCompanion")
          }
        ) : null,
        route.kind === "translation" ? /* @__PURE__ */ jsx(TranslationDetail, { palette: palette$1, t, store, recordID: route.id, onBack: /* @__PURE__ */ __name(() => setRoute({ kind: "root" }), "onBack") }) : null,
        route.kind === "review" ? /* @__PURE__ */ jsx(ReviewPage, { palette: palette$1, t, store, onBack: /* @__PURE__ */ __name(() => setRoute({ kind: "root" }), "onBack"), onOpenWord: openWord }) : null,
        /* @__PURE__ */ jsx(
          PracticeSheet,
          {
            palette: palette$1,
            t,
            open: practice !== null,
            sentence: practice ?? "",
            onClose: /* @__PURE__ */ __name(() => setPractice(null), "onClose")
          }
        ),
        /* @__PURE__ */ jsx(PhotoSheet, { palette: palette$1, t, open: photoOpen, onClose: /* @__PURE__ */ __name(() => setPhotoOpen(false), "onClose"), onPickWord: openWord }),
        /* @__PURE__ */ jsx(
          AiCompanion,
          {
            palette: palette$1,
            t,
            open: companion !== null,
            word: companion?.word ?? "",
            entryText: companion?.entryText ?? "",
            seed: companion?.seed ?? null,
            onClose: /* @__PURE__ */ __name(() => setCompanion(null), "onClose")
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { display: "none", background: alpha(palette$1.accent, 0.01) } })
      ]
    }
  );
}
__name(App, "App");
const root = document.getElementById("root");
if (root && root.children.length === 0) {
  createRoot(root).render(createElement(StrictMode, null, createElement(App)));
}
