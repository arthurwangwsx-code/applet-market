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
function safeSeconds(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
__name(safeSeconds, "safeSeconds");
function clockString(seconds) {
  const total = Math.floor(safeSeconds(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
__name(clockString, "clockString");
function clockFlat(seconds) {
  const total = Math.floor(safeSeconds(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
__name(clockFlat, "clockFlat");
function clockCentis(ms) {
  const total = Math.max(0, Math.floor(ms));
  const m = Math.floor(total / 6e4);
  const s = Math.floor(total % 6e4 / 1e3);
  const cc = Math.floor(total % 1e3 / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(cc).padStart(2, "0")}`;
}
__name(clockCentis, "clockCentis");
function clockPadded(seconds) {
  const total = Math.floor(safeSeconds(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}
__name(clockPadded, "clockPadded");
function srtTime(seconds) {
  const total = safeSeconds(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = Math.floor(total % 60);
  const ms = Math.floor((total - Math.floor(total)) * 1e3);
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, "0")}`;
}
__name(srtTime, "srtTime");
function pad(value) {
  return String(value).padStart(2, "0");
}
__name(pad, "pad");
function mediumDateTime(ms, locale) {
  try {
    return new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return new Date(ms).toISOString();
  }
}
__name(mediumDateTime, "mediumDateTime");
function shortDate(ms, locale) {
  try {
    return new Date(ms).toLocaleDateString(locale, { dateStyle: "medium" });
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}
__name(shortDate, "shortDate");
function byteSize(bytes) {
  const value = Math.max(0, bytes);
  if (value < 1e3) return `${value} B`;
  if (value < 1e6) return `${(value / 1e3).toFixed(0)} kB`;
  if (value < 1e9) return `${(value / 1e6).toFixed(1)} MB`;
  return `${(value / 1e9).toFixed(2)} GB`;
}
__name(byteSize, "byteSize");
function defaultTitle(prefix, locale, at = /* @__PURE__ */ new Date()) {
  let stamp;
  try {
    stamp = at.toLocaleString(locale, { dateStyle: "medium", timeStyle: "medium" });
  } catch {
    stamp = at.toISOString();
  }
  return `${prefix} ${stamp}`;
}
__name(defaultTitle, "defaultTitle");
function fileSlug(title) {
  const slug = String(title ?? "").replace(/[^\p{L}\p{N}\-_]+/gu, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return slug || "recording";
}
__name(fileSlug, "fileSlug");
function exportMarkdown(input) {
  const lines = [`# ${input.memo.title}`, ""];
  lines.push(`- **${input.labels.createdAt}:** ${mediumDateTime(input.memo.createdAt, input.locale)}`);
  lines.push(`- **${input.labels.duration}:** ${clockPadded(input.memo.duration)}`);
  lines.push("");
  if (input.summary.trim()) lines.push(`## ${input.labels.summary}`, "", input.summary.trim(), "");
  const body = transcriptBody(input);
  if (body.text) lines.push(`## ${body.heading}`, "", body.text, "");
  if (input.chapters.length) {
    lines.push(`## ${input.labels.chapters}`, "");
    for (const chapter of input.chapters) lines.push(`- [${clockString(chapter.start)}] ${chapter.title}`);
    lines.push("");
  }
  if (input.actionItems.length) {
    lines.push(`## ${input.labels.actionItems}`, "");
    for (const item of input.actionItems) {
      const tail = [item.owner, item.dueHint, item.sourceTime !== void 0 ? clockString(item.sourceTime) : ""].filter(Boolean).join(" · ");
      lines.push(`- [${item.isDone ? "x" : " "}] ${item.text}${tail ? ` — ${tail}` : ""}`);
    }
    lines.push("");
  }
  if (input.translation.trim()) lines.push(`## ${input.labels.translation}`, "", input.translation.trim(), "");
  return lines.join("\n").trimEnd() + "\n";
}
__name(exportMarkdown, "exportMarkdown");
function exportText(input) {
  return exportMarkdown(input).replace(/^#+ /gm, "").replace(/\*\*/g, "");
}
__name(exportText, "exportText");
function transcriptBody(input, markdown) {
  if (input.correctionTurns.length) {
    const text2 = input.correctionTurns.map((turn) => `**${turn.speaker}:** ${turn.text}`).join("\n\n");
    return { heading: input.labels.corrected, text: text2 };
  }
  return { heading: input.labels.transcript, text: input.transcript.trim() };
}
__name(transcriptBody, "transcriptBody");
function exportSRT(input) {
  const total = Math.max(input.memo.duration, 1);
  const turns = input.correctionTurns;
  if (turns.length) {
    const slice = total / turns.length;
    return turns.map((turn, index) => {
      const start = index * slice;
      const end = Math.max(start + 0.2, (index + 1) * slice);
      return `${index + 1}
${srtTime(start)} --> ${srtTime(end)}
${turn.speaker}: ${turn.text}
`;
    }).join("\n");
  }
  const text2 = input.transcript.trim();
  if (!text2) return "";
  return `1
${srtTime(0)} --> ${srtTime(total)}
${text2}
`;
}
__name(exportSRT, "exportSRT");
function hashText(text2) {
  let hash = 2166136261;
  for (let i = 0; i < text2.length; i += 1) {
    hash ^= text2.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash >>> 0).toString(36);
}
__name(hashText, "hashText");
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
const api = /* @__PURE__ */ __name(() => typeof window !== "undefined" ? window.aibox : void 0, "api");
const capabilities = {
  get library() {
    return Boolean(api()?.voiceMemos);
  },
  get shareFile() {
    return typeof api()?.share?.file === "function";
  }
};
async function memoCall(method, args = {}) {
  const bridge2 = api();
  const namespace = bridge2?.voiceMemos;
  if (!namespace || typeof namespace[method] !== "function") {
    return { ok: false, text: "", json: null, error: "aibox/voicememos-unavailable" };
  }
  try {
    const raw = await namespace[method](args);
    const text2 = String(raw?.text ?? "");
    const ok = !(raw?.ok === false || raw?.isError === true);
    return { ok, text: text2, json: parseJSON(text2), error: ok ? null : text2 };
  } catch (error) {
    return { ok: false, text: "", json: null, error: normalizeError(error).message };
  }
}
__name(memoCall, "memoCall");
function parseJSON(text2) {
  const trimmed = String(text2 ?? "").trim();
  if (!trimmed || trimmed[0] !== "{" && trimmed[0] !== "[") return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}
__name(parseJSON, "parseJSON");
async function listLibrary(input = {}) {
  const args = {};
  if (input.query) args.query = input.query;
  if (input.favOnly) args.favOnly = true;
  const result = await memoCall("list", args);
  if (!Array.isArray(result.json)) return [];
  return result.json.map(toMemo);
}
__name(listLibrary, "listLibrary");
function toMemo(raw) {
  return {
    id: String(raw.id ?? ""),
    source: "library",
    title: String(raw.title ?? ""),
    duration: Number(raw.duration ?? 0),
    // 宿主给的是 unix **秒**，本地统一用毫秒。
    createdAt: Number(raw.createdAt ?? 0) * 1e3,
    isFavourite: Boolean(raw.isFavourite),
    hasTranscript: Boolean(raw.hasTranscript),
    hasAudio: raw.hasAudio !== false,
    isAudioProtected: Boolean(raw.isAudioProtected),
    folder: raw.folder
  };
}
__name(toMemo, "toMemo");
async function fetchTranscript(id) {
  const result = await memoCall("transcript", { id });
  const json = result.json;
  if (!json) return null;
  return {
    status: String(json.status ?? "none") ?? "none",
    fullText: String(json.fullText ?? ""),
    locale: String(json.locale ?? ""),
    isEdited: Boolean(json.isEdited),
    segmentCount: Number(json.segmentCount ?? 0)
  };
}
__name(fetchTranscript, "fetchTranscript");
async function startTranscription(id, locale) {
  return memoCall("transcribe", locale ? { id, locale } : { id });
}
__name(startTranscription, "startTranscription");
async function renameMemo(id, title) {
  return memoCall("rename", { id, title });
}
__name(renameMemo, "renameMemo");
async function deleteMemo(id) {
  return memoCall("delete", { id });
}
__name(deleteMemo, "deleteMemo");
async function toggleFavourite(id) {
  return memoCall("favourite", { id });
}
__name(toggleFavourite, "toggleFavourite");
async function playMemo(id) {
  return memoCall("play", { id });
}
__name(playMemo, "playMemo");
async function stopPlayback() {
  return memoCall("stop", {});
}
__name(stopPlayback, "stopPlayback");
async function seekMemo(input) {
  return memoCall("seek", input);
}
__name(seekMemo, "seekMemo");
async function fetchActionItems(id, force = false) {
  const result = await memoCall("actionItems", force ? { id, force: true } : { id });
  if (!Array.isArray(result.json)) return [];
  return result.json.map((raw, index) => ({
    id: String(raw.id ?? `item-${index}`),
    text: String(raw.text ?? ""),
    kind: String(raw.kind ?? "task") ?? "task",
    isDone: Boolean(raw.isDone),
    owner: raw.owner ? String(raw.owner) : void 0,
    dueHint: raw.dueHint ? String(raw.dueHint) : void 0,
    sourceTime: typeof raw.sourceTime === "number" ? raw.sourceTime : void 0
  })).filter((item) => item.text);
}
__name(fetchActionItems, "fetchActionItems");
async function fetchChapters(id, force = false) {
  const result = await memoCall("chapters", force ? { id, force: true } : { id });
  if (!Array.isArray(result.json)) return [];
  return result.json.map((raw) => ({ title: String(raw.title ?? ""), start: Number(raw.start ?? 0) })).filter((chapter) => chapter.title);
}
__name(fetchChapters, "fetchChapters");
async function askMemo(id, question) {
  return memoCall("ask", { id, question });
}
__name(askMemo, "askMemo");
async function cleanTranscript(id) {
  return memoCall("cleanTranscript", { id });
}
__name(cleanTranscript, "cleanTranscript");
async function hostRecordStart(title) {
  return memoCall("recordStart", title ? { title } : {});
}
__name(hostRecordStart, "hostRecordStart");
async function recorderAvailability() {
  const bridge2 = api();
  if (!bridge2?.audio) return { available: false, reason: "unavailable", background: false };
  try {
    const value = await bridge2.audio.availability();
    return {
      available: value.available,
      reason: value.reason ?? "",
      background: value.supportsBackgroundRecording
    };
  } catch (error) {
    return { available: false, reason: normalizeError(error).message, background: false };
  }
}
__name(recorderAvailability, "recorderAvailability");
async function recordStart(input) {
  const bridge2 = api();
  if (!bridge2?.audio) return { started: false, error: "aibox/unavailable" };
  try {
    const result = await bridge2.audio.recordStart({
      format: "m4a",
      sampleRate: input.sampleRate,
      bitrate: input.bitrate,
      channels: 1
    });
    return { started: result.started, error: "" };
  } catch (error) {
    return { started: false, error: normalizeError(error).message };
  }
}
__name(recordStart, "recordStart");
async function recordPause() {
  await safeAudio((audio) => audio.recordPause());
}
__name(recordPause, "recordPause");
async function recordResume() {
  await safeAudio((audio) => audio.recordResume());
}
__name(recordResume, "recordResume");
async function recordCancel() {
  await safeAudio((audio) => audio.recordCancel());
}
__name(recordCancel, "recordCancel");
async function safeAudio(run) {
  const bridge2 = api();
  if (!bridge2?.audio) return null;
  try {
    return await run(bridge2.audio);
  } catch {
    return null;
  }
}
__name(safeAudio, "safeAudio");
async function recordStatus() {
  const bridge2 = api();
  const empty = { recording: false, paused: false, interrupted: false, elapsedMs: 0, levels: [] };
  if (!bridge2?.audio) return empty;
  try {
    const value = await bridge2.audio.recordStatus();
    return {
      recording: value.recording,
      paused: value.paused,
      interrupted: value.interrupted,
      elapsedMs: value.elapsedMs,
      levels: Array.isArray(value.levels) ? value.levels : []
    };
  } catch {
    return empty;
  }
}
__name(recordStatus, "recordStatus");
async function recordStop() {
  const bridge2 = api();
  if (!bridge2?.audio) return null;
  try {
    const value = await bridge2.audio.recordStop();
    if (value.discarded || !value.handle || !value.url) {
      return { discarded: true, durationMs: value.durationMs ?? 0, handle: "", url: "", byteCount: 0, interrupted: false };
    }
    return {
      discarded: false,
      durationMs: value.durationMs ?? 0,
      handle: value.handle,
      url: value.url,
      byteCount: value.byteCount ?? value.size ?? 0,
      interrupted: Boolean(value.interrupted)
    };
  } catch {
    return null;
  }
}
__name(recordStop, "recordStop");
const COLLECTIONS = { clips: "localClips", artifacts: "memoArtifacts" };
function db() {
  const bridge2 = api();
  return bridge2?.db && typeof bridge2.db.query === "function" ? bridge2.db : void 0;
}
__name(db, "db");
const memoryStore = /* @__PURE__ */ new Map();
function bucket(collection) {
  let value = memoryStore.get(collection);
  if (!value) {
    value = /* @__PURE__ */ new Map();
    memoryStore.set(collection, value);
  }
  return value;
}
__name(bucket, "bucket");
async function readAll(collection) {
  const store = db();
  if (!store) return [...bucket(collection).values()];
  try {
    const rows = await store.query({ collection, limit: 2e3 });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}
__name(readAll, "readAll");
async function write(collection, document2) {
  const store = db();
  const doc = document2;
  if (!store) {
    const id = String(doc._id ?? newID());
    bucket(collection).set(id, { ...doc, _id: id });
    return;
  }
  try {
    await store.insert({ collection, document: doc });
  } catch {
  }
}
__name(write, "write");
async function erase(collection, id) {
  const store = db();
  if (!store) {
    bucket(collection).delete(id);
    return;
  }
  try {
    await store.remove({ collection, id });
  } catch {
  }
}
__name(erase, "erase");
function newID() {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : void 0;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
__name(newID, "newID");
async function listClips() {
  const rows = await readAll(COLLECTIONS.clips);
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}
__name(listClips, "listClips");
async function saveClip(clip2) {
  const rows = await readAll(COLLECTIONS.clips);
  const previous = rows.find((row) => row.id === clip2.id);
  await write(COLLECTIONS.clips, { ...clip2, _id: previous?._id ?? newID() });
}
__name(saveClip, "saveClip");
async function deleteClip(id) {
  const rows = await readAll(COLLECTIONS.clips);
  const hit = rows.find((row) => row.id === id);
  if (!hit) return;
  await erase(COLLECTIONS.clips, hit._id);
  const bridge2 = api();
  if (bridge2?.resource && hit.handle) {
    try {
      await bridge2.resource.remove(hit.handle);
    } catch {
    }
  }
}
__name(deleteClip, "deleteClip");
function emptyArtifacts(memoID) {
  return {
    memoID,
    summaryText: "",
    summaryPoints: [],
    summaryTemplate: "general",
    summaryStatus: "none",
    correctionTurns: [],
    correctionStatus: "none",
    correctionMode: "auto",
    correctionSpeakers: [],
    translationText: "",
    translationLang: "en",
    translationBilingual: false,
    translationStatus: "none",
    chapters: [],
    actionItems: [],
    sourceHash: "",
    updatedAt: 0
  };
}
__name(emptyArtifacts, "emptyArtifacts");
async function loadArtifacts(memoID, transcript) {
  const rows = await readAll(COLLECTIONS.artifacts);
  const found = rows.find((row) => row.memoID === memoID);
  if (!found) return emptyArtifacts(memoID);
  const hash = hashText(transcript);
  if (found.sourceHash && hash && found.sourceHash !== hash) {
    return {
      ...found,
      summaryStatus: found.summaryStatus === "ready" ? "stale" : found.summaryStatus,
      correctionStatus: found.correctionStatus === "ready" ? "stale" : found.correctionStatus,
      translationStatus: found.translationStatus === "ready" ? "stale" : found.translationStatus
    };
  }
  return {
    ...found,
    summaryStatus: found.summaryStatus === "generating" ? "none" : found.summaryStatus,
    correctionStatus: found.correctionStatus === "generating" ? "none" : found.correctionStatus,
    translationStatus: found.translationStatus === "generating" ? "none" : found.translationStatus
  };
}
__name(loadArtifacts, "loadArtifacts");
async function saveArtifacts(artifacts) {
  const rows = await readAll(COLLECTIONS.artifacts);
  const previous = rows.find((row) => row.memoID === artifacts.memoID);
  await write(COLLECTIONS.artifacts, { ...artifacts, updatedAt: Date.now(), _id: previous?._id ?? newID() });
}
__name(saveArtifacts, "saveArtifacts");
async function loadSetting(key, fallback) {
  const bridge2 = api();
  if (!bridge2?.storage) return fallback;
  try {
    const value = await bridge2.storage.get(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
__name(loadSetting, "loadSetting");
async function saveSetting(key, value) {
  const bridge2 = api();
  if (!bridge2?.storage) return;
  try {
    await bridge2.storage.set(key, value);
  } catch {
  }
}
__name(saveSetting, "saveSetting");
function clipToMemo(clip2) {
  return {
    id: clip2.id,
    source: "local",
    title: clip2.title,
    duration: clip2.durationMs / 1e3,
    createdAt: clip2.createdAt,
    isFavourite: clip2.isFavourite,
    // 本机剪辑**没有转写路径**：容器里没有任何工具能转写一个 applet 私有资源。
    hasTranscript: false,
    hasAudio: true,
    isAudioProtected: false,
    url: clip2.url,
    handle: clip2.handle
  };
}
__name(clipToMemo, "clipToMemo");
const SPACE = { s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32 };
const RADIUS = { field: 14 };
const LIGHT = {
  ink: "#1B1A16",
  muted: "#68665E",
  line: "rgba(0,0,0,0.08)",
  bg: "#F2F2F7",
  surface: "#FFFFFF",
  accent: "#0A7AFF",
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
  accent: "#4E9BFF",
  onAccent: "#FFFFFF",
  green: "#43C487",
  orange: "#F2A93B",
  red: "#FF6B5F"
};
function palette(dark) {
  return dark ? DARK : LIGHT;
}
__name(palette, "palette");
function brandTint(dark) {
  return dark ? "#FF9F5B" : "#FF6B35";
}
__name(brandTint, "brandTint");
function favouriteTint(dark) {
  return dark ? "#F4C54B" : "#B77900";
}
__name(favouriteTint, "favouriteTint");
function speakerPalette(dark) {
  return dark ? ["#4E9BFF", "#F2A93B", "#C186F5", "#3FC7C1", "#FF7EB6", "#8E8CF5"] : ["#0A7AFF", "#B56B00", "#8E4EC6", "#0E8C86", "#C2407A", "#5B57C6"];
}
__name(speakerPalette, "speakerPalette");
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
  cards: "🃏",
  waveform: "〜",
  "waveform.slash": "⌁",
  folder: "📁",
  doc: "📄",
  gear: "⚙",
  bubble: "💬",
  checklist: "☑",
  wand: "✨",
  down: "⤓",
  gobackward: "↺",
  goforward: "↻",
  "person.2": "👥",
  pause: "⏸",
  lock: "🔒"
};
function EmptyState(props) {
  return /* @__PURE__ */ jsxs("div", { style: { padding: "18px 16px", textAlign: "center", color: props.palette.muted }, children: [
    /* @__PURE__ */ jsx("div", { style: { opacity: 0.7 }, children: /* @__PURE__ */ jsx(Icon, { name: props.icon, size: 26 }) }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: 13, marginTop: SPACE.s2 }, children: props.text })
  ] });
}
__name(EmptyState, "EmptyState");
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
function ActionItemsSheet(props) {
  const { palette: palette2, t } = props;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const items = props.artifacts?.actionItems ?? [];
  const run = /* @__PURE__ */ __name(async (force) => {
    if (!props.artifacts) return;
    setBusy(true);
    setFailed(false);
    const next = await fetchActionItems(props.memoID, force);
    setBusy(false);
    if (next.length === 0 && force) setFailed(true);
    const merged = { ...props.artifacts, actionItems: next };
    props.onArtifacts(merged);
    await saveArtifacts(merged);
  }, "run");
  useEffect(() => {
    if (!props.open || !props.artifacts) return;
    if (props.artifacts.actionItems.length > 0) return;
    void run(false);
  }, [props.open, props.artifacts?.memoID]);
  const toggle = /* @__PURE__ */ __name(async (id) => {
    if (!props.artifacts) return;
    const merged = {
      ...props.artifacts,
      actionItems: props.artifacts.actionItems.map((item) => item.id === id ? { ...item, isDone: !item.isDone } : item)
    };
    props.onArtifacts(merged);
    await saveArtifacts(merged);
  }, "toggle");
  const groups = [
    { kind: "task", label: t("groupTasks") },
    { kind: "decision", label: t("groupDecisions") },
    { kind: "commitment", label: t("groupCommitments") }
  ];
  return /* @__PURE__ */ jsxs(Sheet, { palette: palette2, open: props.open, onClose: props.onClose, children: [
    /* @__PURE__ */ jsx(
      SheetHeader,
      {
        palette: palette2,
        title: t("actionItems"),
        leading: /* @__PURE__ */ jsx(SecondaryButton, { palette: palette2, title: "", icon: "refresh", onClick: /* @__PURE__ */ __name(() => void run(true), "onClick") }),
        onDone: props.onClose,
        doneLabel: t("done")
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: { padding: `0 ${SPACE.s4}px ${SPACE.s6}px` }, children: [
      busy ? /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, textAlign: "center", padding: SPACE.s5 }, children: "…" }) : null,
      !busy && items.length === 0 ? failed ? /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", padding: SPACE.s5 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginBottom: SPACE.s3 }, children: t("actionItemsFailed") }),
        /* @__PURE__ */ jsx(PrimaryButton, { palette: palette2, title: t("retry"), onClick: /* @__PURE__ */ __name(() => void run(true), "onClick") })
      ] }) : /* @__PURE__ */ jsx(EmptyState, { palette: palette2, icon: "checklist", text: t("noActionItems") }) : null,
      groups.map((group) => {
        const rows = items.filter((item) => item.kind === group.kind);
        if (rows.length === 0) return null;
        return /* @__PURE__ */ jsxs("section", { style: { marginTop: SPACE.s4 }, children: [
          /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: 500, color: palette2.muted, textTransform: "uppercase", marginBottom: 6 }, children: group.label }),
          rows.map((item) => /* @__PURE__ */ jsx(
            ActionRow,
            {
              palette: palette2,
              item,
              onToggle: /* @__PURE__ */ __name(() => void toggle(item.id), "onToggle"),
              onSeek: /* @__PURE__ */ __name(() => {
                if (item.sourceTime === void 0) return;
                props.onSeek(item.sourceTime);
                props.onClose();
              }, "onSeek")
            },
            item.id
          ))
        ] }, group.kind);
      })
    ] })
  ] });
}
__name(ActionItemsSheet, "ActionItemsSheet");
function ActionRow(props) {
  const { palette: palette2, item } = props;
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "flex-start", gap: SPACE.s2, padding: "8px 0" }, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: props.onToggle,
        style: { border: "none", background: "transparent", color: item.isDone ? palette2.accent : palette2.muted, cursor: "pointer", padding: 0, fontSize: 16 },
        "aria-label": "Toggle",
        children: item.isDone ? "◉" : "○"
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 15, color: palette2.ink, textDecoration: item.isDone ? "line-through" : "none" }, children: item.text }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap", alignItems: "center" }, children: [
        item.owner ? /* @__PURE__ */ jsx("span", { style: { fontSize: 11, color: palette2.accent, background: alpha(palette2.accent, 0.18), borderRadius: 999, padding: "2px 8px" }, children: item.owner }) : null,
        item.dueHint ? /* @__PURE__ */ jsx("span", { style: { fontSize: 11, color: palette2.muted }, children: item.dueHint }) : null
      ] })
    ] }),
    item.sourceTime !== void 0 ? /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: props.onSeek,
        style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 12, cursor: "pointer", fontFamily: "ui-monospace, monospace" },
        children: clockString(item.sourceTime)
      }
    ) : null
  ] });
}
__name(ActionRow, "ActionRow");
function AskSheet(props) {
  const { palette: palette2, t } = props;
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (props.open) return;
    setQuestion("");
    setAnswer("");
  }, [props.open]);
  const send = /* @__PURE__ */ __name(async (text2) => {
    const value = text2.trim();
    if (!value || busy) return;
    setBusy(true);
    setAnswer("");
    const result = await askMemo(props.memoID, value);
    setBusy(false);
    setAnswer(result.ok && result.text ? result.text : t("askFailed"));
  }, "send");
  const starters = [t("askStarter1"), t("askStarter2"), t("askStarter3")];
  return /* @__PURE__ */ jsxs(Sheet, { palette: palette2, open: props.open, onClose: props.onClose, children: [
    /* @__PURE__ */ jsx(SheetHeader, { palette: palette2, title: t("askTitle"), onDone: props.onClose, doneLabel: t("done") }),
    /* @__PURE__ */ jsxs("div", { style: { padding: `0 ${SPACE.s4}px ${SPACE.s4}px` }, children: [
      !answer && !busy ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginBottom: SPACE.s3 }, children: t("askHint") }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, children: starters.map((starter) => /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: /* @__PURE__ */ __name(() => void send(starter), "onClick"),
            style: {
              border: "none",
              borderRadius: 999,
              padding: "8px 12px",
              fontSize: 13,
              color: palette2.accent,
              background: alpha(palette2.accent, 0.15),
              cursor: "pointer"
            },
            children: starter
          },
          starter
        )) })
      ] }) : null,
      busy ? /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, padding: SPACE.s5, textAlign: "center" }, children: t("askThinking") }) : null,
      answer ? /* @__PURE__ */ jsx("div", { style: { background: palette2.surface, borderRadius: RADIUS.field, padding: SPACE.s4, fontSize: 15, lineHeight: 1.6, color: palette2.ink, whiteSpace: "pre-wrap" }, children: answer }) : null
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: SPACE.s2, padding: `0 ${SPACE.s4}px ${SPACE.s5}px` }, children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          value: question,
          onChange: /* @__PURE__ */ __name((event) => setQuestion(event.target.value), "onChange"),
          onKeyDown: /* @__PURE__ */ __name((event) => {
            if (event.key === "Enter") void send(question);
          }, "onKeyDown"),
          placeholder: t("askPlaceholder"),
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
      /* @__PURE__ */ jsx(PrimaryButton, { palette: palette2, title: "↑", busy, disabled: !question.trim(), onClick: /* @__PURE__ */ __name(() => void send(question), "onClick") })
    ] })
  ] });
}
__name(AskSheet, "AskSheet");
function CleanUpSheet(props) {
  const { palette: palette2, t } = props;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return /* @__PURE__ */ jsxs(Sheet, { palette: palette2, open: props.open, onClose: props.onClose, children: [
    /* @__PURE__ */ jsx(SheetHeader, { palette: palette2, title: t("cleanUp"), onDone: props.onClose, doneLabel: t("cancel") }),
    /* @__PURE__ */ jsxs("div", { style: { padding: `0 ${SPACE.s4}px ${SPACE.s6}px` }, children: [
      /* @__PURE__ */ jsxs("div", { style: { background: alpha(palette2.orange, 0.1), borderRadius: RADIUS.field, padding: SPACE.s3, fontSize: 13, color: palette2.orange }, children: [
        /* @__PURE__ */ jsx(Icon, { name: "warning", size: 13 }),
        " ",
        t("cleanUpWarning")
      ] }),
      failed ? /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginTop: SPACE.s3 }, children: t("cleanUpFailed") }) : null,
      /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s4 }, children: /* @__PURE__ */ jsx(
        PrimaryButton,
        {
          palette: palette2,
          title: t("cleanUpKeep"),
          block: true,
          busy,
          onClick: /* @__PURE__ */ __name(async () => {
            setBusy(true);
            setFailed(false);
            const result = await cleanTranscript(props.memoID);
            setBusy(false);
            if (!result.ok) {
              setFailed(true);
              return;
            }
            props.onApplied();
            props.onClose();
          }, "onClick")
        }
      ) })
    ] })
  ] });
}
__name(CleanUpSheet, "CleanUpSheet");
function SheetHeader(props) {
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: SPACE.s2, padding: SPACE.s4 }, children: [
    props.leading,
    /* @__PURE__ */ jsx("div", { style: { flex: 1, fontSize: 15, fontWeight: 600, color: props.palette.ink }, children: props.title }),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: props.onDone,
        style: { border: "none", background: "transparent", color: props.palette.accent, fontSize: 15, cursor: "pointer" },
        children: props.doneLabel
      }
    )
  ] });
}
__name(SheetHeader, "SheetHeader");
const DEFAULT_SETTINGS = {
  transcribeLocale: "auto",
  autoTranscribe: false,
  autoSummarize: false,
  defaultTemplate: "general",
  quality: "high"
};
const QUALITY_PRESET = {
  high: { sampleRate: 44100, bitrate: 128e3 },
  medium: { sampleRate: 32e3, bitrate: 96e3 },
  low: { sampleRate: 22050, bitrate: 64e3 }
};
const DEFAULT_FILTER = {
  duration: "any",
  date: "all",
  sort: "newest",
  favOnly: false,
  withTranscript: false,
  source: "all"
};
function filterIsActive(filter) {
  return filter.duration !== "any" || filter.date !== "all" || filter.favOnly || filter.withTranscript || filter.source !== "all";
}
__name(filterIsActive, "filterIsActive");
function MemoList(props) {
  const { palette: palette2, t } = props;
  const rows = useMemo(() => applyFilter(props.memos, props.filter, props.query), [props.memos, props.filter, props.query]);
  if (rows.length === 0) {
    const filtered = props.query.trim() !== "" || filterIsActive(props.filter);
    if (filtered && props.memos.length > 0) {
      return /* @__PURE__ */ jsxs("div", { style: { padding: `${SPACE.s8}px ${SPACE.s5}px`, textAlign: "center" }, children: [
        /* @__PURE__ */ jsx(Icon, { name: "magnifyingglass", size: 40, color: palette2.accent }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette2.ink, marginTop: SPACE.s3 }, children: t("noMatchTitle") }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginTop: 6 }, children: t("noMatchBody") }),
        filterIsActive(props.filter) ? /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s4 }, children: /* @__PURE__ */ jsx(SecondaryButton, { palette: palette2, title: t("clearFilter"), onClick: props.onClearFilter }) }) : null
      ] });
    }
    return /* @__PURE__ */ jsxs("div", { style: { padding: `${SPACE.s8}px ${SPACE.s5}px`, textAlign: "center" }, children: [
      /* @__PURE__ */ jsx(Icon, { name: "mic", size: 40, color: palette2.accent }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette2.ink, marginTop: SPACE.s3 }, children: t("emptyTitle") }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginTop: 6 }, children: props.scoped ? t("emptyScopedBody") : t("emptyBody") })
    ] });
  }
  return /* @__PURE__ */ jsx("div", { children: rows.map((memo) => /* @__PURE__ */ jsx(
    MemoRow,
    {
      palette: palette2,
      t,
      dark: props.dark,
      memo,
      busy: props.busyIDs[`${memo.source}:${memo.id}`],
      onOpen: /* @__PURE__ */ __name(() => props.onOpen(memo), "onOpen"),
      onMenu: /* @__PURE__ */ __name(() => props.onMenu(memo), "onMenu")
    },
    `${memo.source}:${memo.id}`
  )) });
}
__name(MemoList, "MemoList");
function MemoRow(props) {
  const { palette: palette2, t, memo } = props;
  const tint = memo.hasAudio ? palette2.accent : palette2.muted;
  let pressTimer = null;
  const startPress = /* @__PURE__ */ __name(() => {
    pressTimer = window.setTimeout(props.onMenu, 550);
  }, "startPress");
  const endPress = /* @__PURE__ */ __name(() => {
    if (pressTimer !== null) {
      window.clearTimeout(pressTimer);
      pressTimer = null;
    }
  }, "endPress");
  return /* @__PURE__ */ jsxs(
    "div",
    {
      role: "button",
      onClick: props.onOpen,
      onPointerDown: startPress,
      onPointerUp: endPress,
      onPointerLeave: endPress,
      onContextMenu: /* @__PURE__ */ __name((event) => {
        event.preventDefault();
        props.onMenu();
      }, "onContextMenu"),
      style: {
        display: "flex",
        alignItems: "center",
        gap: SPACE.s3,
        padding: `8px ${SPACE.s4}px`,
        borderBottom: `1px solid ${palette2.line}`,
        cursor: "pointer"
      },
      children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              width: 34,
              height: 34,
              borderRadius: 17,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: alpha(tint, 0.12),
              color: tint,
              fontSize: 14,
              fontWeight: 600
            },
            children: /* @__PURE__ */ jsx(Icon, { name: memo.hasAudio ? "waveform" : "doc", size: 14 })
          }
        ),
        /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }, children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  fontSize: 16,
                  fontWeight: 500,
                  color: palette2.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                },
                children: memo.title
              }
            ),
            memo.isFavourite ? /* @__PURE__ */ jsx(Icon, { name: "star.fill", size: 11, color: favouriteTint(props.dark) }) : null,
            /* @__PURE__ */ jsx("span", { style: { flex: 1, minWidth: 8 } }),
            props.busy ? /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  fontSize: 11,
                  color: palette2.accent,
                  background: alpha(palette2.accent, 0.12),
                  borderRadius: 999,
                  padding: "3px 8px",
                  whiteSpace: "nowrap"
                },
                children: props.busy
              }
            ) : null
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: SPACE.s2, fontSize: 12, color: palette2.muted, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx("span", { children: shortDate(memo.createdAt, "default") }),
            /* @__PURE__ */ jsx("span", { children: clockString(memo.duration) }),
            !memo.hasAudio ? /* @__PURE__ */ jsxs("span", { children: [
              /* @__PURE__ */ jsx(Icon, { name: "waveform.slash", size: 11 }),
              " ",
              t("transcriptOnly")
            ] }) : null,
            /* @__PURE__ */ jsx("span", { style: { opacity: 0.8 }, children: memo.source === "local" ? t("sourceLocal") : t("sourceLibrary") })
          ] }),
          memo.snippet ? /* @__PURE__ */ jsxs("div", { style: { fontSize: 12, color: palette2.accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
            /* @__PURE__ */ jsx(Icon, { name: "bubble", size: 11 }),
            " ",
            memo.snippet
          ] }) : null
        ] })
      ]
    }
  );
}
__name(MemoRow, "MemoRow");
function applyFilter(memos, filter, query) {
  const now = Date.now();
  const needle = query.trim().toLowerCase();
  let rows = memos.filter((memo) => {
    if (needle && !memo.title.toLowerCase().includes(needle) && !(memo.snippet ?? "").toLowerCase().includes(needle)) {
      return false;
    }
    if (filter.favOnly && !memo.isFavourite) return false;
    if (filter.withTranscript && !memo.hasTranscript) return false;
    if (filter.source !== "all" && memo.source !== filter.source) return false;
    if (filter.duration === "under1m" && !(memo.duration < 60)) return false;
    if (filter.duration === "1to5m" && !(memo.duration >= 60 && memo.duration <= 300)) return false;
    if (filter.duration === "over5m" && !(memo.duration >= 300)) return false;
    const age = now - memo.createdAt;
    if (filter.date === "today" && new Date(memo.createdAt).toDateString() !== new Date(now).toDateString()) return false;
    if (filter.date === "week" && age > 7 * 864e5) return false;
    if (filter.date === "month" && age > 30 * 864e5) return false;
    if (filter.date === "year" && age > 365 * 864e5) return false;
    return true;
  });
  rows = [...rows].sort((a, b) => {
    switch (filter.sort) {
      case "oldest":
        return a.createdAt - b.createdAt;
      case "longest":
        return b.duration - a.duration;
      case "shortest":
        return a.duration - b.duration;
      case "name":
        return a.title.localeCompare(b.title, void 0, { sensitivity: "base" });
      default:
        return b.createdAt - a.createdAt;
    }
  });
  return rows;
}
__name(applyFilter, "applyFilter");
function FilterSheet(props) {
  const { palette: palette2, t, filter } = props;
  const isDefault = JSON.stringify(filter) === JSON.stringify(DEFAULT_FILTER);
  const section = /* @__PURE__ */ __name((title, key, options) => /* @__PURE__ */ jsxs("section", { style: { marginBottom: SPACE.s4 }, children: [
    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: 500, color: palette2.muted, padding: `0 ${SPACE.s4}px 6px`, textTransform: "uppercase" }, children: title }),
    options.map((option) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: /* @__PURE__ */ __name(() => props.onChange({ ...filter, [key]: option.value }), "onClick"),
        style: {
          display: "flex",
          width: "100%",
          alignItems: "center",
          border: "none",
          background: "transparent",
          padding: `10px ${SPACE.s4}px`,
          fontSize: 15,
          color: palette2.ink,
          cursor: "pointer",
          borderBottom: `1px solid ${palette2.line}`
        },
        children: [
          /* @__PURE__ */ jsx("span", { style: { flex: 1, textAlign: "left" }, children: option.label }),
          filter[key] === option.value ? /* @__PURE__ */ jsx(Icon, { name: "check", size: 14, color: palette2.accent }) : null
        ]
      },
      String(option.value)
    ))
  ] }, String(key)), "section");
  return /* @__PURE__ */ jsxs(Sheet, { palette: palette2, open: props.open, onClose: props.onClose, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", padding: SPACE.s4 }, children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          disabled: isDefault,
          onClick: /* @__PURE__ */ __name(() => props.onChange(DEFAULT_FILTER), "onClick"),
          style: {
            border: "none",
            background: "transparent",
            color: palette2.accent,
            fontSize: 15,
            cursor: isDefault ? "default" : "pointer",
            opacity: isDefault ? 0.4 : 1,
            padding: 0
          },
          children: t("reset")
        }
      ),
      /* @__PURE__ */ jsx("div", { style: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: 600, color: palette2.ink }, children: t("filter") }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: props.onClose,
          style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 15, cursor: "pointer", padding: 0 },
          children: t("done")
        }
      )
    ] }),
    section(t("filterDuration"), "duration", [
      { value: "any", label: t("durationAny") },
      { value: "under1m", label: t("durationUnder1m") },
      { value: "1to5m", label: t("duration1to5m") },
      { value: "over5m", label: t("durationOver5m") }
    ]),
    section(t("filterDate"), "date", [
      { value: "all", label: t("dateAll") },
      { value: "today", label: t("dateToday") },
      { value: "week", label: t("dateWeek") },
      { value: "month", label: t("dateMonth") },
      { value: "year", label: t("dateYear") }
    ]),
    section(t("filterSource"), "source", [
      { value: "all", label: t("sourceAll") },
      { value: "library", label: t("sourceLibrary") },
      { value: "local", label: t("sourceLocal") }
    ]),
    section(t("filterSort"), "sort", [
      { value: "newest", label: t("sortNewest") },
      { value: "oldest", label: t("sortOldest") },
      { value: "longest", label: t("sortLongest") },
      { value: "shortest", label: t("sortShortest") },
      { value: "name", label: t("sortName") }
    ]),
    /* @__PURE__ */ jsxs("div", { style: { padding: `0 ${SPACE.s4}px ${SPACE.s6}px` }, children: [
      /* @__PURE__ */ jsx(Toggle, { palette: palette2, label: t("favOnly"), value: filter.favOnly, onChange: /* @__PURE__ */ __name((value) => props.onChange({ ...filter, favOnly: value }), "onChange") }),
      /* @__PURE__ */ jsx(Toggle, { palette: palette2, label: t("withTranscript"), value: filter.withTranscript, onChange: /* @__PURE__ */ __name((value) => props.onChange({ ...filter, withTranscript: value }), "onChange") })
    ] })
  ] });
}
__name(FilterSheet, "FilterSheet");
function Toggle(props) {
  return /* @__PURE__ */ jsxs(
    "label",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: SPACE.s3,
        padding: "10px 0",
        fontSize: 15,
        color: props.palette.ink,
        cursor: "pointer"
      },
      children: [
        /* @__PURE__ */ jsxs("span", { style: { flex: 1 }, children: [
          props.label,
          props.hint ? /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: props.palette.muted, marginTop: 2 }, children: props.hint }) : null
        ] }),
        /* @__PURE__ */ jsx(
          "span",
          {
            onClick: /* @__PURE__ */ __name(() => props.onChange(!props.value), "onClick"),
            style: {
              width: 46,
              height: 28,
              borderRadius: 14,
              position: "relative",
              flexShrink: 0,
              background: props.value ? props.palette.green : props.palette.line,
              transition: "background 0.15s"
            },
            children: /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  position: "absolute",
                  top: 2,
                  left: props.value ? 20 : 2,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: "#FFFFFF",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  transition: "left 0.15s"
                }
              }
            )
          }
        )
      ]
    }
  );
}
__name(Toggle, "Toggle");
const MAX_CHARS = 8e3;
const ai = /* @__PURE__ */ __name(() => {
  const bridge2 = typeof window !== "undefined" ? window.aibox : void 0;
  return bridge2?.ai && typeof bridge2.ai.generate === "function" ? bridge2.ai : void 0;
}, "ai");
class AiError extends Error {
  static {
    __name(this, "AiError");
  }
}
function clip(text2) {
  return text2.length > MAX_CHARS ? text2.slice(0, MAX_CHARS) : text2;
}
__name(clip, "clip");
function extractJSON(raw) {
  let text2 = String(raw ?? "").trim();
  if (text2.startsWith("```")) {
    const lines = text2.split("\n");
    if (lines[0]?.startsWith("```")) lines.shift();
    if (lines[lines.length - 1]?.startsWith("```")) lines.pop();
    text2 = lines.join("\n");
  }
  const objectStart = text2.indexOf("{");
  const objectEnd = text2.lastIndexOf("}");
  const arrayStart = text2.indexOf("[");
  const arrayEnd = text2.lastIndexOf("]");
  let slice = text2;
  if (arrayStart >= 0 && arrayEnd > arrayStart && (objectStart < 0 || arrayStart < objectStart)) {
    slice = text2.slice(arrayStart, arrayEnd + 1);
  } else if (objectStart >= 0 && objectEnd > objectStart) {
    slice = text2.slice(objectStart, objectEnd + 1);
  }
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}
__name(extractJSON, "extractJSON");
async function generate(input) {
  const api2 = ai();
  if (!api2) throw new AiError("aibox/ai-unavailable");
  try {
    return await api2.generate({ ...input, intent: "balanced" });
  } catch (error) {
    throw new AiError(normalizeError(error).message);
  }
}
__name(generate, "generate");
const COMMON_GUIDE = 'Write GFM Markdown using "##" section headings and "-" lists. Be faithful and concise. Omit a whole section when the transcript has nothing for it. Answer in the language of the transcript.';
const TEMPLATE_GUIDE = {
  general: {
    system: "You summarize spoken recordings faithfully.",
    guide: 'Write a 2-3 sentence overview paragraph, then a "## Key Points" section with short bullets.'
  },
  meeting: {
    system: "You write meeting minutes.",
    guide: 'Sections: "## Overview", "## Discussion", "## Decisions", "## Action Items" (only tasks that were explicitly stated, as "- [ ] task — owner (due)"), "## Open Questions".'
  },
  interview: {
    system: "You write interview debriefs.",
    guide: 'Sections: "## Candidate", "## Strengths", "## Concerns", "## Notable Q&A", "## Overall".'
  },
  oneOnOne: {
    system: "You write 1:1 notes.",
    guide: 'Sections: "## Context", "## Feedback & Asks", "## Agreements", "## Next Steps".'
  },
  lecture: {
    system: "You write lecture notes.",
    guide: 'Sections: "## Overview", "## Key Concepts", "## Conclusions", "## To Review".'
  },
  podcast: {
    system: "You write podcast show notes.",
    guide: 'Sections: "## Overview", "## Topics", "## Quotes", "## Takeaways".'
  }
};
async function summarize(transcript, template) {
  const text2 = clip(transcript.trim());
  if (!text2) throw new AiError("empty-transcript");
  if (template === "general") {
    const raw = await generate({
      system: TEMPLATE_GUIDE.general.system,
      prompt: 'Output ONLY a single JSON object (no markdown fences, no explanation) shaped exactly like:\n{"abstract":"2-3 sentence summary","points":["short key point", "..."]}\nAnswer in the language of the transcript.\n\nTranscript:\n' + text2,
      maxTokens: 900,
      temperature: 0.3
    });
    const parsed = extractJSON(raw);
    if (parsed && typeof parsed.abstract === "string" && parsed.abstract.trim()) {
      return {
        text: parsed.abstract.trim(),
        points: Array.isArray(parsed.points) ? parsed.points.map((item) => String(item)).filter(Boolean) : []
      };
    }
    return { text: raw.trim(), points: [] };
  }
  const spec = TEMPLATE_GUIDE[template];
  const body = await generate({
    system: spec.system,
    prompt: `${COMMON_GUIDE}
${spec.guide}

Transcript:
${text2}`,
    maxTokens: 1400,
    temperature: 0.3
  });
  return { text: body.trim(), points: [] };
}
__name(summarize, "summarize");
const SPEAKER_COLOR_COUNT = 6;
async function correct(input) {
  const text2 = clip(input.transcript.trim());
  if (!text2) throw new AiError("empty-transcript");
  const speakerRule = input.mode === "none" ? 'Do NOT attribute speakers; return a single turn per paragraph with an empty "speaker".' : input.mode === "named" ? `There are exactly ${input.speakers.length} speakers named: ${input.speakers.join(", ")}. Use those exact names.` : 'Identify how many distinct speakers there are and label them "S1", "S2", … in order of first appearance.';
  const raw = await generate({
    system: "You clean up raw speech-recognition transcripts.",
    prompt: `Fix recognition errors, restore punctuation and casing, and split the text into speaker turns. Preserve meaning and language exactly — do not summarize, do not add or remove content. ${speakerRule}
Output ONLY a JSON array (no markdown fences, no explanation) shaped exactly like:
[{"speaker":"S1","text":"..."}]

Transcript:
` + text2,
    maxTokens: 2400,
    temperature: 0.2
  });
  const parsed = extractJSON(raw);
  if (!Array.isArray(parsed)) throw new AiError("unparseable");
  const order = [];
  const turns = [];
  for (const item of parsed) {
    const body = String(item?.text ?? "").trim();
    if (!body) continue;
    const speaker = String(item?.speaker ?? "").trim();
    if (speaker && !order.includes(speaker)) order.push(speaker);
    turns.push({
      speaker,
      colorIndex: speaker ? order.indexOf(speaker) % SPEAKER_COLOR_COUNT : 0,
      text: body
    });
  }
  if (turns.length === 0) throw new AiError("empty-result");
  return turns;
}
__name(correct, "correct");
function speakerDisplayName(label, index, template) {
  const trimmed = label.trim();
  if (!trimmed) return template.replace("{n}", String(index + 1));
  const match = /^S(\d+)$/i.exec(trimmed);
  if (match) return template.replace("{n}", match[1]);
  return trimmed;
}
__name(speakerDisplayName, "speakerDisplayName");
const TRANSLATION_LANGS = ["zh", "en", "ja", "ko", "fr", "de", "es", "ru"];
const LANG_NAME = {
  zh: "Chinese",
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  fr: "French",
  de: "German",
  es: "Spanish",
  ru: "Russian"
};
const TRANSLATE_CHUNK = 4e3;
async function translate(input) {
  const source = input.text.trim();
  if (!source) throw new AiError("empty-transcript");
  const name = LANG_NAME[input.lang];
  const guide = input.bilingual ? `Translate paragraph by paragraph: output each source paragraph on one line, then its ${name} translation on the next line, then a blank line. Do not add any other commentary.` : `Output ONLY the ${name} translation, preserving paragraph breaks.`;
  const chunks = [];
  for (let index = 0; index < source.length; index += TRANSLATE_CHUNK) {
    chunks.push(source.slice(index, index + TRANSLATE_CHUNK));
  }
  const parts = [];
  for (const chunk of chunks) {
    parts.push((await generate({ prompt: `${guide}

${chunk}`, maxTokens: 2400, temperature: 0.2 })).trim());
  }
  return parts.join("\n\n");
}
__name(translate, "translate");
const TEMPLATES = ["general", "meeting", "interview", "oneOnOne", "lecture", "podcast"];
function MemoDetail(props) {
  const { palette: palette2, t, memo } = props;
  const [transcript, setTranscript] = useState(null);
  const [artifacts, setArtifacts] = useState(null);
  const [tab, setTab] = useState(null);
  const [chaptersBusy, setChaptersBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = memo.source === "library" ? await fetchTranscript(memo.id) : null;
      if (cancelled) return;
      setTranscript(next);
      const loaded = await loadArtifacts(memo.id, next?.fullText ?? "");
      if (cancelled) return;
      setArtifacts(loaded);
      setTab((current) => current ?? (loaded.summaryText ? "summary" : "original"));
    })();
    return () => {
      cancelled = true;
    };
  }, [memo.id, memo.source]);
  useEffect(() => {
    if (memo.source !== "library") return;
    if (transcript?.status !== "pending" && transcript?.status !== "inProgress") return;
    const timer = window.setInterval(async () => {
      const next = await fetchTranscript(memo.id);
      if (next) setTranscript(next);
      if (next && next.status !== "pending" && next.status !== "inProgress") {
        window.clearInterval(timer);
        props.onRefresh();
      }
    }, 2e3);
    return () => window.clearInterval(timer);
  }, [memo.id, memo.source, transcript?.status]);
  const text2 = transcript?.fullText ?? "";
  const context = { memo, transcript, artifacts, setArtifacts, text: text2 };
  useEffect(() => {
    if (!artifacts || !text2.trim()) return;
    if (!props.settings.autoSummarize) return;
    if (artifacts.summaryStatus !== "none") return;
    void runSummary(context, props.settings.defaultTemplate, setError);
  }, [artifacts?.memoID, text2, props.settings.autoSummarize]);
  if (memo.source === "local") {
    return /* @__PURE__ */ jsx(PushPage, { palette: palette2, title: memo.title, onBack: props.onBack, trailing: /* @__PURE__ */ jsx(MoreButton, { palette: palette2, onClick: /* @__PURE__ */ __name(() => props.onMenu(context), "onClick") }), children: /* @__PURE__ */ jsx(LocalClipBody, { palette: palette2, t, memo }) });
  }
  const status = transcript?.status ?? "none";
  return /* @__PURE__ */ jsx(PushPage, { palette: palette2, title: memo.title, onBack: props.onBack, trailing: /* @__PURE__ */ jsx(MoreButton, { palette: palette2, onClick: /* @__PURE__ */ __name(() => props.onMenu(context), "onClick") }), children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", minHeight: "100%" }, children: [
    !memo.hasAudio ? /* @__PURE__ */ jsxs("div", { style: { background: alpha(palette2.orange, 0.1), padding: `${SPACE.s3}px ${SPACE.s4}px` }, children: [
      /* @__PURE__ */ jsxs("div", { style: { fontSize: 13, fontWeight: 500, color: palette2.orange }, children: [
        /* @__PURE__ */ jsx(Icon, { name: "waveform.slash", size: 13 }),
        " ",
        t("audioRemovedTitle")
      ] }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted, marginTop: 2 }, children: t("audioRemovedBody") })
    ] }) : null,
    status === "completed" ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(TabStrip, { palette: palette2, t, tab: tab ?? "original", artifacts, onChange: setTab }),
      /* @__PURE__ */ jsxs("div", { style: { flex: 1, padding: `${SPACE.s3}px ${SPACE.s5}px ${SPACE.s6}px` }, children: [
        (tab ?? "original") === "summary" ? /* @__PURE__ */ jsx(SummaryTab, { palette: palette2, t, context, settings: props.settings, onError: setError }) : null,
        (tab ?? "original") === "original" ? /* @__PURE__ */ jsx(
          OriginalTab,
          {
            palette: palette2,
            t,
            transcript,
            chapters: artifacts?.chapters ?? [],
            chaptersBusy,
            hasAudio: memo.hasAudio,
            onSeek: /* @__PURE__ */ __name((seconds) => void seekMemo({ seconds }), "onSeek"),
            onGenerateChapters: /* @__PURE__ */ __name(async () => {
              if (!artifacts) return;
              setChaptersBusy(true);
              const next = await fetchChapters(memo.id, artifacts.chapters.length > 0);
              setChaptersBusy(false);
              const merged = { ...artifacts, chapters: next, sourceHash: hashText(text2) };
              setArtifacts(merged);
              await saveArtifacts(merged);
            }, "onGenerateChapters")
          }
        ) : null,
        (tab ?? "original") === "corrected" ? /* @__PURE__ */ jsx(CorrectedTab, { palette: palette2, t, dark: props.dark, context, onError: setError }) : null,
        (tab ?? "original") === "translation" ? /* @__PURE__ */ jsx(TranslationTab, { palette: palette2, t, context, onError: setError }) : null,
        error ? /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.red, marginTop: SPACE.s3 }, children: error }) : null
      ] })
    ] }) : null,
    status === "pending" || status === "inProgress" ? /* @__PURE__ */ jsxs(Centered, { children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette2.ink }, children: t("transcribingTitle") }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginTop: 6 }, children: t("transcribingBody") })
    ] }) : null,
    status === "none" || status === "failed" ? /* @__PURE__ */ jsxs(Centered, { children: [
      /* @__PURE__ */ jsx(Icon, { name: status === "failed" ? "warning" : "bubble", size: 46, color: palette2.accent }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette2.ink, marginTop: SPACE.s3 }, children: status === "failed" ? t("transcribeFailedTitle") : t("noTranscriptTitle") }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginTop: 6, maxWidth: 300 }, children: status === "failed" ? t("transcribeFailedBody") : t("noTranscriptBody") }),
      memo.hasAudio ? /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s5 }, children: /* @__PURE__ */ jsx(
        PrimaryButton,
        {
          palette: palette2,
          title: status === "failed" ? t("retry") : t("transcribeAction"),
          onClick: /* @__PURE__ */ __name(async () => {
            await startTranscription(memo.id, localeArg(props.settings));
            const next = await fetchTranscript(memo.id);
            if (next) setTranscript(next);
          }, "onClick")
        }
      ) }) : null
    ] }) : null,
    /* @__PURE__ */ jsx(TransportBar, { palette: palette2, t, memo })
  ] }) });
}
__name(MemoDetail, "MemoDetail");
function localeArg(settings) {
  if (settings.transcribeLocale === "auto") return void 0;
  return settings.transcribeLocale;
}
__name(localeArg, "localeArg");
function MoreButton(props) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick: props.onClick,
      style: { border: "none", background: "transparent", color: props.palette.accent, fontSize: 17, cursor: "pointer", width: 44, height: 44 },
      "aria-label": "More",
      children: "⋯"
    }
  );
}
__name(MoreButton, "MoreButton");
function Centered({ children }) {
  return /* @__PURE__ */ jsx("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }, children });
}
__name(Centered, "Centered");
function TabStrip(props) {
  const { palette: palette2, t } = props;
  const items = [
    { id: "summary", label: t("tabSummary"), busy: props.artifacts?.summaryStatus === "generating" },
    { id: "original", label: t("tabOriginal"), busy: false },
    { id: "corrected", label: t("tabCorrected"), busy: props.artifacts?.correctionStatus === "generating" },
    { id: "translation", label: t("tabTranslation"), busy: props.artifacts?.translationStatus === "generating" }
  ];
  return /* @__PURE__ */ jsx("div", { style: { padding: `${SPACE.s2}px ${SPACE.s4}px 4px` }, children: /* @__PURE__ */ jsx("div", { style: { display: "flex", background: palette2.surface, borderRadius: 999, padding: 4 }, children: items.map((item) => {
    const active = props.tab === item.id;
    return /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: /* @__PURE__ */ __name(() => props.onChange(item.id), "onClick"),
        style: {
          flex: 1,
          border: "none",
          borderRadius: 999,
          padding: "7px 4px",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: active ? 600 : 400,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          color: active ? palette2.onAccent : palette2.muted,
          background: active ? palette2.accent : "transparent",
          whiteSpace: "nowrap",
          overflow: "hidden"
        },
        children: [
          /* @__PURE__ */ jsx("span", { style: { overflow: "hidden", textOverflow: "ellipsis" }, children: item.label }),
          item.busy ? /* @__PURE__ */ jsx("span", { style: { fontSize: 10 }, children: "•" }) : null
        ]
      },
      item.id
    );
  }) }) });
}
__name(TabStrip, "TabStrip");
async function runSummary(context, template, onError) {
  const base = context.artifacts;
  if (!base || !context.text.trim()) return;
  context.setArtifacts({ ...base, summaryStatus: "generating", summaryTemplate: template });
  try {
    const result = await summarize(context.text, template);
    const next = {
      ...base,
      summaryText: result.text,
      summaryPoints: result.points,
      summaryTemplate: template,
      summaryStatus: "ready",
      sourceHash: hashText(context.text)
    };
    context.setArtifacts(next);
    await saveArtifacts(next);
  } catch (error) {
    onError(String(error));
    context.setArtifacts({ ...base, summaryStatus: "failed", summaryTemplate: template });
  }
}
__name(runSummary, "runSummary");
function SummaryTab(props) {
  const { palette: palette2, t, context } = props;
  const [picking, setPicking] = useState(false);
  const artifacts = context.artifacts;
  if (!artifacts) return null;
  const busy = artifacts.summaryStatus === "generating";
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s4 }, children: [
    /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        disabled: busy,
        onClick: /* @__PURE__ */ __name(() => setPicking(true), "onClick"),
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          borderRadius: 999,
          padding: "7px 11px",
          fontSize: 12,
          fontWeight: 500,
          cursor: busy ? "default" : "pointer",
          color: palette2.accent,
          background: alpha(palette2.accent, 0.1),
          opacity: busy ? 0.5 : 1
        },
        children: [
          /* @__PURE__ */ jsx(Icon, { name: "sparkles", size: 12 }),
          " ",
          templateLabel(t, artifacts.summaryTemplate)
        ]
      }
    ) }),
    busy ? /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, textAlign: "center" }, children: t("summarizing") }) : null,
    !busy && artifacts.summaryText ? /* @__PURE__ */ jsxs(Fragment, { children: [
      artifacts.summaryStatus === "stale" ? /* @__PURE__ */ jsxs("div", { style: { fontSize: 12, color: palette2.muted }, children: [
        /* @__PURE__ */ jsx(Icon, { name: "clock", size: 11 }),
        " ",
        t("stale"),
        " — ",
        t("staleTranscriptChanged")
      ] }) : null,
      /* @__PURE__ */ jsx(Markdown, { palette: palette2, text: artifacts.summaryText }),
      artifacts.summaryPoints.length ? /* @__PURE__ */ jsx("ul", { style: { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }, children: artifacts.summaryPoints.map((point, index) => /* @__PURE__ */ jsx("li", { style: { fontSize: 15, color: palette2.ink }, children: point }, index)) }) : null
    ] }) : null,
    !busy && !artifacts.summaryText ? artifacts.summaryStatus === "failed" || artifacts.summaryStatus === "stale" ? /* @__PURE__ */ jsxs(Centered, { children: [
      /* @__PURE__ */ jsx(Icon, { name: "warning", size: 38, color: palette2.orange }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginTop: SPACE.s3 }, children: t("summaryFailed") })
    ] }) : /* @__PURE__ */ jsxs(Centered, { children: [
      /* @__PURE__ */ jsx(Icon, { name: "sparkles", size: 40, color: palette2.accent }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette2.ink, marginTop: SPACE.s3 }, children: t("noSummaryTitle") }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginTop: 6 }, children: t("noSummaryBody") })
    ] }) : null,
    /* @__PURE__ */ jsx(Sheet, { palette: palette2, open: picking, onClose: /* @__PURE__ */ __name(() => setPicking(false), "onClose"), children: TEMPLATES.map((template) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: /* @__PURE__ */ __name(() => {
          setPicking(false);
          void runSummary(context, template, props.onError);
        }, "onClick"),
        style: {
          display: "flex",
          width: "100%",
          alignItems: "center",
          border: "none",
          background: "transparent",
          padding: `12px ${SPACE.s4}px`,
          fontSize: 15,
          color: palette2.ink,
          cursor: "pointer",
          borderBottom: `1px solid ${palette2.line}`
        },
        children: [
          /* @__PURE__ */ jsx("span", { style: { flex: 1, textAlign: "left" }, children: templateLabel(t, template) }),
          artifacts.summaryTemplate === template ? /* @__PURE__ */ jsx(Icon, { name: "check", size: 14, color: palette2.accent }) : null
        ]
      },
      template
    )) })
  ] });
}
__name(SummaryTab, "SummaryTab");
function templateLabel(t, template) {
  const map = {
    general: "templateGeneral",
    meeting: "templateMeeting",
    interview: "templateInterview",
    oneOnOne: "templateOneOnOne",
    lecture: "templateLecture",
    podcast: "templatePodcast"
  };
  return t(map[template]);
}
__name(templateLabel, "templateLabel");
function OriginalTab(props) {
  const { palette: palette2, t } = props;
  const paragraphs = useMemo(
    () => (props.transcript?.fullText ?? "").split(/\n+/).map((line) => line.trim()).filter(Boolean),
    [props.transcript?.fullText]
  );
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s4 }, children: [
    props.transcript?.isEdited ? /* @__PURE__ */ jsxs("div", { style: { fontSize: 12, color: palette2.muted }, children: [
      /* @__PURE__ */ jsx(Icon, { name: "pencil", size: 11 }),
      " ",
      t("edited")
    ] }) : null,
    props.chaptersBusy ? /* @__PURE__ */ jsx("div", { style: { background: palette2.surface, borderRadius: RADIUS.field, padding: SPACE.s4, fontSize: 14, color: palette2.muted }, children: t("findingChapters") }) : props.chapters.length ? /* @__PURE__ */ jsxs("div", { style: { background: palette2.surface, borderRadius: RADIUS.field, padding: SPACE.s4 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { fontSize: 15, fontWeight: 600, color: palette2.accent, marginBottom: SPACE.s2 }, children: [
        /* @__PURE__ */ jsx(Icon, { name: "list", size: 13 }),
        " ",
        t("chapters")
      ] }),
      props.chapters.map((chapter, index) => /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          disabled: !props.hasAudio,
          onClick: /* @__PURE__ */ __name(() => props.onSeek(chapter.start), "onClick"),
          style: {
            display: "flex",
            width: "100%",
            alignItems: "center",
            gap: SPACE.s3,
            border: "none",
            background: "transparent",
            padding: "7px 0",
            cursor: props.hasAudio ? "pointer" : "default"
          },
          children: [
            /* @__PURE__ */ jsx("span", { style: { flex: 1, textAlign: "left", fontSize: 15, color: palette2.ink }, children: chapter.title }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: palette2.muted, fontFamily: "ui-monospace, monospace" }, children: clockString(chapter.start) })
          ]
        },
        `${chapter.title}-${index}`
      ))
    ] }) : /* @__PURE__ */ jsx(SecondaryButton, { palette: palette2, title: t("chapters"), icon: "list", onClick: props.onGenerateChapters }),
    paragraphs.length === 0 ? /* @__PURE__ */ jsx(EmptyState, { palette: palette2, icon: "bubble", text: t("noTranscriptBody") }) : /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s3 }, children: paragraphs.map((paragraph, index) => /* @__PURE__ */ jsx("p", { style: { margin: 0, fontSize: 18, lineHeight: 1.6, color: palette2.ink, userSelect: "text" }, children: paragraph }, index)) })
  ] });
}
__name(OriginalTab, "OriginalTab");
function CorrectedTab(props) {
  const { palette: palette2, t, context } = props;
  const artifacts = context.artifacts;
  const [mode, setMode] = useState(artifacts?.correctionMode ?? "auto");
  const [count, setCount] = useState(Math.max(2, artifacts?.correctionSpeakers.length ?? 2));
  const [names, setNames] = useState(artifacts?.correctionSpeakers ?? ["", ""]);
  if (!artifacts) return null;
  const busy = artifacts.correctionStatus === "generating";
  const colors = speakerPalette(props.dark);
  const run = /* @__PURE__ */ __name(async () => {
    const base = context.artifacts;
    if (!base) return;
    context.setArtifacts({ ...base, correctionStatus: "generating", correctionMode: mode });
    try {
      const turns = await correct({
        transcript: context.text,
        mode,
        speakers: names.slice(0, count).map((name, index) => name.trim() || `Speaker ${index + 1}`)
      });
      const next = {
        ...base,
        correctionTurns: turns,
        correctionStatus: "ready",
        correctionMode: mode,
        correctionSpeakers: names.slice(0, count),
        sourceHash: hashText(context.text)
      };
      context.setArtifacts(next);
      await saveArtifacts(next);
    } catch (error) {
      props.onError(String(error));
      context.setArtifacts({ ...base, correctionStatus: "failed", correctionMode: mode });
    }
  }, "run");
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s4 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: SPACE.s2, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ jsx(Icon, { name: "person.2", size: 13, color: palette2.muted }),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: mode,
          onChange: /* @__PURE__ */ __name((event) => setMode(event.target.value), "onChange"),
          style: { border: `1px solid ${palette2.line}`, borderRadius: 8, padding: "6px 8px", fontSize: 13, background: palette2.surface, color: palette2.ink },
          children: [
            /* @__PURE__ */ jsx("option", { value: "none", children: t("speakerModeNone") }),
            /* @__PURE__ */ jsx("option", { value: "auto", children: t("speakerModeAuto") }),
            /* @__PURE__ */ jsx("option", { value: "named", children: t("speakerModeNamed") })
          ]
        }
      ),
      mode === "named" ? /* @__PURE__ */ jsx(
        "input",
        {
          type: "number",
          min: 2,
          max: 6,
          value: count,
          onChange: /* @__PURE__ */ __name((event) => {
            const value = Math.min(6, Math.max(2, Number(event.target.value) || 2));
            setCount(value);
            setNames((current) => {
              const next = [...current];
              while (next.length < value) next.push("");
              return next.slice(0, value);
            });
          }, "onChange"),
          style: { width: 56, border: `1px solid ${palette2.line}`, borderRadius: 8, padding: "6px 8px", fontSize: 13, background: palette2.surface, color: palette2.ink }
        }
      ) : null,
      /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          disabled: !context.text.trim(),
          onClick: run,
          style: {
            border: "none",
            borderRadius: 999,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 500,
            color: palette2.onAccent,
            background: palette2.accent,
            cursor: "pointer",
            opacity: busy ? 0.5 : context.text.trim() ? 1 : 0.4
          },
          children: [
            /* @__PURE__ */ jsx(Icon, { name: artifacts.correctionTurns.length ? "refresh" : "sparkles", size: 12 }),
            " ",
            artifacts.correctionTurns.length ? t("recorrectAction") : t("correctAction")
          ]
        }
      )
    ] }),
    mode === "named" ? /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: new Array(count).fill(0).map((_, index) => /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: SPACE.s2, background: palette2.surface, borderRadius: 8, padding: "6px 10px" }, children: [
      /* @__PURE__ */ jsx("span", { style: { width: 8, height: 8, borderRadius: 4, background: colors[index % colors.length] } }),
      /* @__PURE__ */ jsx(
        "input",
        {
          value: names[index] ?? "",
          onChange: /* @__PURE__ */ __name((event) => setNames((current) => {
            const next = [...current];
            next[index] = event.target.value;
            return next;
          }), "onChange"),
          placeholder: t("speakerName", { n: index + 1 }),
          style: { flex: 1, border: "none", background: "transparent", fontSize: 14, color: palette2.ink, outline: "none" }
        }
      )
    ] }, index)) }) : null,
    busy ? /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, textAlign: "center" }, children: t("correcting") }) : null,
    !busy && artifacts.correctionTurns.length ? /* @__PURE__ */ jsxs(Fragment, { children: [
      artifacts.correctionStatus === "stale" ? /* @__PURE__ */ jsxs("div", { style: { fontSize: 12, color: palette2.muted }, children: [
        /* @__PURE__ */ jsx(Icon, { name: "warning", size: 11 }),
        " ",
        t("staleTranscriptChanged")
      ] }) : null,
      /* @__PURE__ */ jsx("div", { style: { fontSize: 11, color: palette2.muted }, children: t("correctionNoTimestamps") }),
      /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s3 }, children: artifacts.correctionTurns.map((turn, index) => {
        const previous = artifacts.correctionTurns[index - 1];
        const showSpeaker = Boolean(turn.speaker) && previous?.speaker !== turn.speaker;
        const color = colors[turn.colorIndex % colors.length];
        return /* @__PURE__ */ jsxs("div", { style: { background: palette2.surface, borderRadius: 12, padding: SPACE.s3 }, children: [
          showSpeaker ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }, children: [
            /* @__PURE__ */ jsx("span", { style: { width: 9, height: 9, borderRadius: 5, background: color } }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: 14, fontWeight: 600, color }, children: speakerDisplayName(turn.speaker, index, t("speakerName", { n: "{n}" })) })
          ] }) : null,
          /* @__PURE__ */ jsx("div", { style: { fontSize: 17, lineHeight: 1.5, color: palette2.ink, userSelect: "text" }, children: turn.text })
        ] }, index);
      }) })
    ] }) : null,
    !busy && artifacts.correctionTurns.length === 0 ? artifacts.correctionStatus === "failed" ? /* @__PURE__ */ jsxs(Centered, { children: [
      /* @__PURE__ */ jsx(Icon, { name: "warning", size: 38, color: palette2.orange }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginTop: SPACE.s3 }, children: t("correctionFailed") })
    ] }) : /* @__PURE__ */ jsxs(Centered, { children: [
      /* @__PURE__ */ jsx(Icon, { name: "wand", size: 40, color: palette2.accent }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette2.ink, marginTop: SPACE.s3 }, children: t("noCorrectionTitle") }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginTop: 6 }, children: t("noCorrectionBody") })
    ] }) : null
  ] });
}
__name(CorrectedTab, "CorrectedTab");
function TranslationTab(props) {
  const { palette: palette2, t, context } = props;
  const artifacts = context.artifacts;
  const [lang, setLang] = useState(artifacts?.translationLang ?? "en");
  const [bilingual, setBilingual] = useState(artifacts?.translationBilingual ?? false);
  if (!artifacts) return null;
  const busy = artifacts.translationStatus === "generating";
  const source = artifacts.correctionTurns.length ? artifacts.correctionTurns.map((turn) => turn.text).join("\n\n") : context.text;
  const run = /* @__PURE__ */ __name(async () => {
    const base = context.artifacts;
    if (!base) return;
    context.setArtifacts({ ...base, translationStatus: "generating", translationLang: lang, translationBilingual: bilingual });
    try {
      const text2 = await translate({ text: source, lang, bilingual });
      const next = {
        ...base,
        translationText: text2,
        translationLang: lang,
        translationBilingual: bilingual,
        translationStatus: "ready",
        sourceHash: hashText(context.text)
      };
      context.setArtifacts(next);
      await saveArtifacts(next);
    } catch (error) {
      props.onError(String(error));
      context.setArtifacts({ ...base, translationStatus: "failed", translationLang: lang });
    }
  }, "run");
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s4 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: SPACE.s2, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ jsx(Icon, { name: "globe", size: 13, color: palette2.muted }),
      /* @__PURE__ */ jsx(
        "select",
        {
          value: lang,
          onChange: /* @__PURE__ */ __name((event) => setLang(event.target.value), "onChange"),
          style: { border: `1px solid ${palette2.line}`, borderRadius: 8, padding: "6px 8px", fontSize: 13, background: palette2.surface, color: palette2.ink },
          children: TRANSLATION_LANGS.map((code) => /* @__PURE__ */ jsx("option", { value: code, children: LANG_NAME[code] }, code))
        }
      ),
      /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          disabled: !source.trim(),
          onClick: run,
          style: {
            border: "none",
            borderRadius: 999,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 500,
            color: palette2.onAccent,
            background: palette2.accent,
            cursor: "pointer",
            opacity: busy ? 0.5 : source.trim() ? 1 : 0.4
          },
          children: [
            /* @__PURE__ */ jsx(Icon, { name: artifacts.translationText ? "refresh" : "globe", size: 12 }),
            " ",
            artifacts.translationText ? t("retranslateAction") : t("translateAction")
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", background: palette2.surface, borderRadius: 999, padding: 3 }, children: [false, true].map((value) => /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: /* @__PURE__ */ __name(() => setBilingual(value), "onClick"),
        style: {
          flex: 1,
          border: "none",
          borderRadius: 999,
          padding: "6px 0",
          fontSize: 13,
          cursor: "pointer",
          color: bilingual === value ? palette2.onAccent : palette2.muted,
          background: bilingual === value ? palette2.accent : "transparent"
        },
        children: value ? t("bilingual") : t("translationOnly")
      },
      String(value)
    )) }),
    busy ? /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, textAlign: "center" }, children: t("translating") }) : null,
    !busy && artifacts.translationText ? /* @__PURE__ */ jsxs(Fragment, { children: [
      artifacts.translationStatus === "stale" ? /* @__PURE__ */ jsxs("div", { style: { fontSize: 12, color: palette2.muted }, children: [
        /* @__PURE__ */ jsx(Icon, { name: "warning", size: 11 }),
        " ",
        t("staleTranscriptChanged")
      ] }) : null,
      /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s3 }, children: artifacts.translationText.split(/\n+/).filter(Boolean).map((paragraph, index) => /* @__PURE__ */ jsx("p", { style: { margin: 0, fontSize: 17, lineHeight: 1.6, color: palette2.ink, userSelect: "text" }, children: paragraph }, index)) })
    ] }) : null,
    !busy && !artifacts.translationText ? /* @__PURE__ */ jsxs(Centered, { children: [
      /* @__PURE__ */ jsx(Icon, { name: "globe", size: 40, color: palette2.accent }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette2.ink, marginTop: SPACE.s3 }, children: t("noTranslationTitle") }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginTop: 6 }, children: t("noTranslationBody") })
    ] }) : null
  ] });
}
__name(TranslationTab, "TranslationTab");
function TransportBar(props) {
  const { palette: palette2, t, memo } = props;
  const [playing, setPlaying] = useState(false);
  if (!memo.hasAudio) {
    return /* @__PURE__ */ jsxs("div", { style: { background: alpha(palette2.surface, 0.9), padding: `${SPACE.s3}px ${SPACE.s5}px ${SPACE.s4}px`, textAlign: "center" }, children: [
      /* @__PURE__ */ jsx(Icon, { name: "waveform.slash", size: 20, color: palette2.muted }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted, marginTop: 4 }, children: t("audioRemovedTitle") }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted }, children: t("audioRemovedBody") })
    ] });
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        background: alpha(palette2.surface, 0.9),
        padding: `${SPACE.s3}px ${SPACE.s5}px ${SPACE.s4}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.s3
      },
      children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: /* @__PURE__ */ __name(() => void seekMemo({ seconds: -15 }), "onClick"),
            style: iconButton(palette2),
            "aria-label": "-15s",
            children: /* @__PURE__ */ jsx(Icon, { name: "gobackward", size: 21 })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: /* @__PURE__ */ __name(async () => {
              await playMemo(memo.id);
              setPlaying((value) => !value);
            }, "onClick"),
            style: {
              width: 50,
              height: 50,
              borderRadius: 25,
              border: "none",
              background: palette2.accent,
              color: palette2.onAccent,
              fontSize: 20,
              cursor: "pointer"
            },
            "aria-label": "Play",
            children: /* @__PURE__ */ jsx(Icon, { name: playing ? "pause" : "play", size: 20 })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: /* @__PURE__ */ __name(() => void seekMemo({ seconds: 15 }), "onClick"),
            style: iconButton(palette2),
            "aria-label": "+15s",
            children: /* @__PURE__ */ jsx(Icon, { name: "goforward", size: 21 })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: /* @__PURE__ */ __name(async () => {
              await stopPlayback();
              setPlaying(false);
            }, "onClick"),
            style: iconButton(palette2),
            "aria-label": "Stop",
            children: /* @__PURE__ */ jsx(Icon, { name: "stop", size: 17 })
          }
        )
      ]
    }
  );
}
__name(TransportBar, "TransportBar");
function iconButton(palette2) {
  return {
    width: 36,
    height: 36,
    borderRadius: 18,
    border: "none",
    background: "transparent",
    color: palette2.ink,
    cursor: "pointer"
  };
}
__name(iconButton, "iconButton");
function LocalClipBody(props) {
  const { palette: palette2, t, memo } = props;
  const audioRef = useRef(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(memo.duration);
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState([]);
  useEffect(() => {
    if (!memo.url) return;
    let cancelled = false;
    void (async () => {
      const samples = await decodePeaks(memo.url, 240);
      if (!cancelled) setPeaks(samples);
    })();
    return () => {
      cancelled = true;
    };
  }, [memo.url]);
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s4, padding: SPACE.s5 }, children: [
    /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: palette2.muted }, children: t("localClipNote").replace(/\*\*/g, "") }),
    /* @__PURE__ */ jsx(StaticWaveform, { palette: palette2, peaks, progress: duration > 0 ? position / duration : 0 }),
    /* @__PURE__ */ jsx(
      "audio",
      {
        ref: audioRef,
        src: memo.url,
        preload: "metadata",
        onTimeUpdate: /* @__PURE__ */ __name((event) => setPosition(event.currentTarget.currentTime), "onTimeUpdate"),
        onLoadedMetadata: /* @__PURE__ */ __name((event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value) && value > 0) setDuration(value);
        }, "onLoadedMetadata"),
        onEnded: /* @__PURE__ */ __name(() => setPlaying(false), "onEnded"),
        style: { display: "none" }
      }
    ),
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "range",
        min: 0,
        max: Math.max(duration, 0.1),
        step: 0.1,
        value: position,
        onChange: /* @__PURE__ */ __name((event) => {
          const value = Number(event.target.value);
          setPosition(value);
          if (audioRef.current) audioRef.current.currentTime = value;
        }, "onChange"),
        style: { width: "100%", accentColor: palette2.accent }
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: SPACE.s3 }, children: [
      /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: palette2.muted, minWidth: 38, fontFamily: "ui-monospace, monospace" }, children: clockFlat(position) }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: /* @__PURE__ */ __name(() => {
            if (audioRef.current) audioRef.current.currentTime = Math.max(0, position - 15);
          }, "onClick"),
          style: iconButton(palette2),
          "aria-label": "-15s",
          children: /* @__PURE__ */ jsx(Icon, { name: "gobackward", size: 21 })
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: /* @__PURE__ */ __name(() => {
            const audio = audioRef.current;
            if (!audio) return;
            if (playing) audio.pause();
            else void audio.play();
            setPlaying(!playing);
          }, "onClick"),
          style: {
            width: 50,
            height: 50,
            borderRadius: 25,
            border: "none",
            background: palette2.accent,
            color: palette2.onAccent,
            fontSize: 20,
            cursor: "pointer"
          },
          "aria-label": "Play",
          children: /* @__PURE__ */ jsx(Icon, { name: playing ? "pause" : "play", size: 20 })
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: /* @__PURE__ */ __name(() => {
            if (audioRef.current) audioRef.current.currentTime = Math.min(duration, position + 15);
          }, "onClick"),
          style: iconButton(palette2),
          "aria-label": "+15s",
          children: /* @__PURE__ */ jsx(Icon, { name: "goforward", size: 21 })
        }
      ),
      /* @__PURE__ */ jsxs("span", { style: { fontSize: 12, color: palette2.muted, minWidth: 38, textAlign: "right", fontFamily: "ui-monospace, monospace" }, children: [
        "-",
        clockFlat(Math.max(0, duration - position))
      ] })
    ] })
  ] });
}
__name(LocalClipBody, "LocalClipBody");
function StaticWaveform(props) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    if (props.peaks.length === 0) {
      context.fillStyle = "rgba(255,255,255,0.18)";
      context.fillRect(0, height / 2 - 0.75, width, 1.5);
      return;
    }
    const barWidth = 3;
    const gap = Math.max(1, barWidth * 0.5);
    const stride = barWidth + gap;
    const barCount = Math.max(1, Math.min(props.peaks.length, Math.floor(width / stride)));
    const played = props.progress * width;
    const mid = height / 2;
    for (let index = 0; index < barCount; index += 1) {
      const value = props.peaks[Math.floor(index / barCount * props.peaks.length)] ?? 0;
      const barHeight = Math.max(height * 0.06, value * height);
      const x = index * stride;
      context.fillStyle = x + barWidth / 2 <= played ? props.palette.accent : "rgba(255,255,255,0.18)";
      const round = context.roundRect;
      if (typeof round === "function") {
        context.beginPath();
        round.call(context, x, mid - barHeight / 2, barWidth, barHeight, barWidth / 2);
        context.fill();
      } else {
        context.fillRect(x, mid - barHeight / 2, barWidth, barHeight);
      }
    }
  }, [props.peaks, props.progress, props.palette]);
  return /* @__PURE__ */ jsx("canvas", { ref, style: { width: "100%", height: 72, display: "block" } });
}
__name(StaticWaveform, "StaticWaveform");
async function decodePeaks(url, buckets) {
  try {
    const response = await fetch(url);
    const bytes = await response.arrayBuffer();
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return [];
    const context = new Ctor();
    const buffer = await context.decodeAudioData(bytes);
    const channel = buffer.getChannelData(0);
    const size = Math.max(1, Math.floor(channel.length / buckets));
    const peaks = [];
    for (let index = 0; index < buckets; index += 1) {
      let peak = 0;
      const start = index * size;
      for (let offset = 0; offset < size && start + offset < channel.length; offset += 1) {
        const value = Math.abs(channel[start + offset]);
        if (value > peak) peak = value;
      }
      peaks.push(peak);
    }
    void context.close();
    const max = Math.max(...peaks, 1e-4);
    return peaks.map((value) => value / max);
  } catch {
    return [];
  }
}
__name(decodePeaks, "decodePeaks");
function Markdown(props) {
  const blocks = props.text.split("\n");
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: blocks.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("## ")) {
      return /* @__PURE__ */ jsx("div", { style: { fontSize: 15, fontWeight: 600, color: props.palette.accent, marginTop: 8 }, children: trimmed.slice(3) }, index);
    }
    if (trimmed.startsWith("# ")) {
      return /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 700, color: props.palette.ink }, children: trimmed.slice(2) }, index);
    }
    if (trimmed.startsWith("- ")) {
      return /* @__PURE__ */ jsxs("div", { style: { fontSize: 15, color: props.palette.ink, paddingLeft: 14, position: "relative" }, children: [
        /* @__PURE__ */ jsx("span", { style: { position: "absolute", left: 2 }, children: "•" }),
        stripBold(trimmed.slice(2))
      ] }, index);
    }
    return /* @__PURE__ */ jsx("p", { style: { margin: 0, fontSize: 15, lineHeight: 1.6, color: props.palette.ink }, children: stripBold(trimmed) }, index);
  }) });
}
__name(Markdown, "Markdown");
function stripBold(text2) {
  return text2.replace(/\*\*(.+?)\*\*/g, "$1");
}
__name(stripBold, "stripBold");
const POLL_MS = 50;
function RecordSheet(props) {
  const { palette: palette2, t } = props;
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState([]);
  const [paused, setPaused] = useState(false);
  const [recording, setRecording] = useState(true);
  useEffect(() => {
    if (!props.open) {
      setElapsed(0);
      setLevels([]);
      setPaused(false);
      setRecording(true);
      return;
    }
    let alive = true;
    const timer = window.setInterval(async () => {
      const status = await recordStatus();
      if (!alive) return;
      setElapsed(status.elapsedMs);
      setLevels(status.levels.slice(-120));
      setPaused(status.paused);
      setRecording(status.recording);
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [props.open]);
  const stop = /* @__PURE__ */ __name(async () => {
    const clip2 = await recordStop();
    if (clip2) props.onFinish(clip2);
    else props.onCancel();
  }, "stop");
  return /* @__PURE__ */ jsxs(
    Sheet,
    {
      palette: palette2,
      open: props.open,
      onClose: /* @__PURE__ */ __name(() => {
        if (!recording) props.onCancel();
      }, "onClose"),
      children: [
        /* @__PURE__ */ jsx("div", { style: { padding: `${SPACE.s5}px ${SPACE.s5}px ${SPACE.s3}px` }, children: /* @__PURE__ */ jsx(
          "input",
          {
            value: props.title,
            onChange: /* @__PURE__ */ __name((event) => props.onTitleChange(event.target.value), "onChange"),
            placeholder: t("recordTitlePlaceholder"),
            style: {
              width: "100%",
              boxSizing: "border-box",
              border: "none",
              background: "transparent",
              textAlign: "center",
              fontSize: 17,
              fontWeight: 600,
              color: palette2.ink,
              outline: "none"
            }
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: SPACE.s3, padding: `0 ${SPACE.s5}px ${SPACE.s2}px`, fontSize: 12, color: palette2.muted }, children: [
          /* @__PURE__ */ jsxs("span", { style: { flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [
            /* @__PURE__ */ jsx(Icon, { name: "mic", size: 11 }),
            " ",
            t("localeAuto")
          ] }),
          props.backgroundSupported ? /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx(Icon, { name: "drive", size: 11 }),
            " ✓"
          ] }) : null
        ] }),
        /* @__PURE__ */ jsx(LiveWaveform, { palette: palette2, levels, active: recording && !paused }),
        /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              padding: `${SPACE.s4}px 0`,
              textAlign: "center",
              fontSize: 44,
              fontWeight: 200,
              fontVariantNumeric: "tabular-nums",
              fontFamily: "ui-monospace, Menlo, monospace",
              color: recording && !paused ? palette2.accent : palette2.muted
            },
            children: clockCentis(elapsed)
          }
        ),
        paused ? /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", fontSize: 12, color: palette2.muted, marginBottom: SPACE.s2 }, children: [
          /* @__PURE__ */ jsx(Icon, { name: "pause", size: 12 }),
          " ",
          t("paused")
        ] }) : null,
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "center", alignItems: "center", gap: SPACE.s6, paddingBottom: SPACE.s6 }, children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: /* @__PURE__ */ __name(async () => {
                if (paused) await recordResume();
                else await recordPause();
              }, "onClick"),
              "aria-label": paused ? t("resume") : t("pause"),
              style: {
                width: 56,
                height: 56,
                borderRadius: 28,
                background: palette2.surface,
                border: `1px solid ${palette2.line}`,
                color: palette2.ink,
                fontSize: 20,
                cursor: "pointer"
              },
              children: /* @__PURE__ */ jsx(Icon, { name: paused ? "mic" : "pause", size: 20 })
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: stop,
              "aria-label": t("stop"),
              style: {
                width: 72,
                height: 72,
                borderRadius: 36,
                background: palette2.red,
                border: "none",
                color: "#FFFFFF",
                fontSize: 22,
                cursor: "pointer"
              },
              children: /* @__PURE__ */ jsx(Icon, { name: "stop", size: 22 })
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: /* @__PURE__ */ __name(async () => {
                await recordCancel();
                props.onCancel();
              }, "onClick"),
              "aria-label": t("cancel"),
              style: {
                width: 56,
                height: 56,
                borderRadius: 28,
                background: "transparent",
                border: `1px solid ${palette2.line}`,
                color: palette2.muted,
                fontSize: 15,
                cursor: "pointer"
              },
              children: "✕"
            }
          )
        ] })
      ]
    }
  );
}
__name(RecordSheet, "RecordSheet");
function LiveWaveform(props) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const barWidth = 3;
    const step = 5;
    const count = Math.max(1, Math.floor(width / step));
    const tail = props.levels.slice(-count);
    const padded = [...new Array(Math.max(0, count - tail.length)).fill(0), ...tail];
    context.fillStyle = props.active ? props.palette.red : props.palette.muted;
    context.globalAlpha = props.active ? 1 : 0.4;
    const mid = height / 2;
    for (let index = 0; index < padded.length; index += 1) {
      const level = Math.max(0, Math.min(1, padded[index]));
      const barHeight = Math.max(2, level * height);
      const x = index * step;
      const y = mid - barHeight / 2;
      roundRect(context, x, y, barWidth, barHeight, barWidth / 2);
    }
  }, [props.levels, props.active, props.palette]);
  return /* @__PURE__ */ jsx("div", { style: { padding: `0 ${SPACE.s3}px` }, children: /* @__PURE__ */ jsx("canvas", { ref, style: { width: "100%", height: 90, display: "block" } }) });
}
__name(LiveWaveform, "LiveWaveform");
function roundRect(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
  context.fill();
}
__name(roundRect, "roundRect");
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(text, "text");
async function allMemos() {
  const [library, clips] = await Promise.all([listLibrary(), listClips()]);
  return [...library, ...clips.filter((clip2) => !clip2.isTrashed).map(clipToMemo)].sort((a, b) => b.createdAt - a.createdAt);
}
__name(allMemos, "allMemos");
async function findMemo(id) {
  return (await allMemos()).find((memo) => memo.id === id) ?? null;
}
__name(findMemo, "findMemo");
async function readableTranscript(memo) {
  if (memo.source === "local") return { text: "", status: "none", corrected: false };
  const transcript = await fetchTranscript(memo.id);
  const artifacts = await loadArtifacts(memo.id, transcript?.fullText ?? "");
  if (artifacts.correctionTurns.length) {
    return {
      text: artifacts.correctionTurns.map((turn) => turn.speaker ? `${turn.speaker}: ${turn.text}` : turn.text).join("\n\n"),
      status: transcript?.status ?? "none",
      corrected: true
    };
  }
  return { text: transcript?.fullText ?? "", status: transcript?.status ?? "none", corrected: false };
}
__name(readableTranscript, "readableTranscript");
function registerMemoActions(refresh, locale, labels) {
  registerActions({
    async memo_list(input) {
      const query = text(input?.query).toLowerCase();
      const source = text(input?.source) || "all";
      const favOnly = input?.favOnly === true;
      let rows = await allMemos();
      if (source !== "all") rows = rows.filter((memo) => memo.source === source);
      if (favOnly) rows = rows.filter((memo) => memo.isFavourite);
      if (query) rows = rows.filter((memo) => memo.title.toLowerCase().includes(query));
      if (rows.length === 0) return { ok: true, text: "No recordings match.", count: 0 };
      const lines = rows.map((memo, index) => {
        const flags = [
          memo.source === "local" ? "on-device" : "library",
          memo.isFavourite ? "favourite" : "",
          memo.hasTranscript ? "transcribed" : "",
          memo.hasAudio ? "" : "transcript-only"
        ].filter(Boolean).join(", ");
        return `${index + 1}. ${memo.title} — ${clockString(memo.duration)}, ${shortDate(memo.createdAt, locale)} (${flags}) [id: ${memo.id}]`;
      });
      return { ok: true, text: lines.join("\n"), count: rows.length };
    },
    async memo_transcribe(input) {
      const id = text(input?.id);
      if (!id) return { ok: false, text: "Provide the recording id." };
      const memo = await findMemo(id);
      if (!memo) return { ok: false, text: "Recording not found." };
      if (memo.source === "local") {
        return {
          ok: false,
          text: "On-device clips cannot be transcribed: the container has no path from applet-private audio into transcription. Record into the host library instead."
        };
      }
      const locale2 = text(input?.locale);
      const result = await startTranscription(id, locale2 || void 0);
      refresh();
      return { ok: result.ok, text: result.ok ? result.text || `Transcription queued for '${memo.title}'.` : result.error ?? "Failed." };
    },
    async memo_transcript(input) {
      const id = text(input?.id);
      if (!id) return { ok: false, text: "Provide the recording id." };
      const memo = await findMemo(id);
      if (!memo) return { ok: false, text: "Recording not found." };
      const readable = await readableTranscript(memo);
      if (!readable.text) {
        return { ok: true, text: `No transcript yet (status: ${readable.status}). Run memo_transcribe first.`, status: readable.status };
      }
      const prefix = readable.corrected ? "(speaker-corrected)\n\n" : "";
      return { ok: true, text: prefix + readable.text, status: readable.status };
    },
    async memo_summarize(input) {
      const id = text(input?.id);
      if (!id) return { ok: false, text: "Provide the recording id." };
      const memo = await findMemo(id);
      if (!memo) return { ok: false, text: "Recording not found." };
      const readable = await readableTranscript(memo);
      if (!readable.text.trim()) return { ok: false, text: "No transcript — run memo_transcribe first." };
      const template = text(input?.template) || "general";
      try {
        const result = await summarize(readable.text, template);
        const artifacts = await loadArtifacts(memo.id, readable.text);
        await saveArtifacts({
          ...artifacts,
          summaryText: result.text,
          summaryPoints: result.points,
          summaryTemplate: template,
          summaryStatus: "ready",
          sourceHash: hashText(readable.text)
        });
        refresh();
        const body = result.points.length ? `${result.text}

${result.points.map((point) => `- ${point}`).join("\n")}` : result.text;
        return { ok: true, text: body, template };
      } catch (error) {
        return { ok: false, text: `Could not summarize: ${String(error)}` };
      }
    },
    async memo_action_items(input) {
      const id = text(input?.id);
      if (!id) return { ok: false, text: "Provide the recording id." };
      const memo = await findMemo(id);
      if (!memo || memo.source === "local") return { ok: false, text: "Recording not found in the host library." };
      const items = await fetchActionItems(id, input?.force === true);
      if (items.length === 0) return { ok: true, text: "No action items found.", count: 0 };
      const lines = items.map((item) => {
        const tail = [item.owner, item.dueHint, item.sourceTime !== void 0 ? clockString(item.sourceTime) : ""].filter(Boolean).join(" · ");
        return `- [${item.isDone ? "x" : " "}] (${item.kind}) ${item.text}${tail ? ` — ${tail}` : ""}`;
      });
      refresh();
      return { ok: true, text: lines.join("\n"), count: items.length };
    },
    async memo_ask(input) {
      const id = text(input?.id);
      const question = text(input?.question);
      if (!id || !question) return { ok: false, text: "Provide both the recording id and a question." };
      const memo = await findMemo(id);
      if (!memo || memo.source === "local") return { ok: false, text: "Recording not found in the host library." };
      const result = await askMemo(id, question);
      if (!result.ok || !result.text.trim()) return { ok: false, text: result.error ?? "No answer." };
      return { ok: true, text: result.text };
    },
    async memo_export(input) {
      const id = text(input?.id);
      if (!id) return { ok: false, text: "Provide the recording id." };
      const memo = await findMemo(id);
      if (!memo) return { ok: false, text: "Recording not found." };
      const format = text(input?.format) || "markdown";
      const transcript = memo.source === "library" ? await fetchTranscript(memo.id) : null;
      const artifacts = await loadArtifacts(memo.id, transcript?.fullText ?? "");
      const payload = {
        memo,
        locale,
        summary: artifacts.summaryText,
        transcript: transcript?.fullText ?? "",
        correctionTurns: artifacts.correctionTurns,
        chapters: artifacts.chapters,
        actionItems: artifacts.actionItems,
        translation: artifacts.translationText,
        labels
      };
      const body = format === "srt" ? exportSRT(payload) : format === "text" ? exportText(payload) : exportMarkdown(payload);
      if (!body.trim()) return { ok: false, text: "Nothing to export yet — transcribe the recording first." };
      return { ok: true, text: body, format };
    }
  });
}
__name(registerMemoActions, "registerMemoActions");
const TABLE = {
  tabRecord: { zh: "录音", en: "Record" },
  tabFolders: { zh: "文件夹", en: "Folders" },
  tabSettings: { zh: "设置", en: "Settings" },
  titleRecordings: { zh: "录音", en: "Recordings" },
  titleVoiceMemos: { zh: "语音备忘录", en: "Voice Memos" },
  titleSettings: { zh: "设置", en: "Settings" },
  // 列表
  searchPlaceholder: { zh: "搜索录音", en: "Search recordings" },
  newRecording: { zh: "新录音", en: "New Recording" },
  emptyTitle: { zh: "暂无录音", en: "No recordings" },
  emptyBody: { zh: "点按下方录音按钮开始录音", en: "Tap the record button below to start" },
  emptyScopedBody: { zh: "这里还没有录音", en: "Nothing here yet" },
  noMatchTitle: { zh: "无匹配的录音", en: "No matching recordings" },
  noMatchBody: { zh: "换个关键词试试", en: "Try a different keyword" },
  clearFilter: { zh: "清除筛选", en: "Clear filters" },
  transcriptOnly: { zh: "仅保留文稿", en: "Transcript only" },
  transcribing: { zh: "转录中…", en: "Transcribing…" },
  summarizing: { zh: "摘要中…", en: "Summarizing…" },
  correcting: { zh: "校正中…", en: "Correcting…" },
  translating: { zh: "翻译中…", en: "Translating…" },
  sourceLocal: { zh: "本机", en: "On device" },
  sourceLibrary: { zh: "录音库", en: "Library" },
  // 筛选
  filter: { zh: "筛选", en: "Filter" },
  filterDuration: { zh: "时长", en: "Duration" },
  durationAny: { zh: "任意时长", en: "Any duration" },
  durationUnder1m: { zh: "1 分钟内", en: "Under 1 minute" },
  duration1to5m: { zh: "1–5 分钟", en: "1–5 minutes" },
  durationOver5m: { zh: "超过 5 分钟", en: "Over 5 minutes" },
  filterDate: { zh: "日期", en: "Date" },
  dateAll: { zh: "全部时间", en: "All time" },
  dateToday: { zh: "今天", en: "Today" },
  dateWeek: { zh: "最近 7 天", en: "Last 7 days" },
  dateMonth: { zh: "最近 30 天", en: "Last 30 days" },
  dateYear: { zh: "最近一年", en: "Last year" },
  filterSort: { zh: "排序", en: "Sort By" },
  sortNewest: { zh: "最新优先", en: "Newest first" },
  sortOldest: { zh: "最早优先", en: "Oldest first" },
  sortLongest: { zh: "最长优先", en: "Longest first" },
  sortShortest: { zh: "最短优先", en: "Shortest first" },
  sortName: { zh: "名称", en: "Name" },
  favOnly: { zh: "仅收藏", en: "Favourites only" },
  withTranscript: { zh: "仅含转录", en: "With transcript" },
  filterSource: { zh: "来源", en: "Source" },
  sourceAll: { zh: "全部来源", en: "All sources" },
  reset: { zh: "重置", en: "Reset" },
  done: { zh: "完成", en: "Done" },
  cancel: { zh: "取消", en: "Cancel" },
  // 行菜单
  shareAudio: { zh: "分享音频", en: "Share audio" },
  rename: { zh: "重命名", en: "Rename" },
  viewTranscript: { zh: "查看转录", en: "View transcript" },
  copyTranscript: { zh: "复制转录", en: "Copy transcript" },
  startTranscription: { zh: "发起转录", en: "Transcribe" },
  favourite: { zh: "收藏", en: "Favourite" },
  unfavourite: { zh: "取消收藏", en: "Unfavourite" },
  moveToTrash: { zh: "移到最近删除", en: "Move to Recently Deleted" },
  deletePermanently: { zh: "永久删除", en: "Delete permanently" },
  restore: { zh: "恢复", en: "Restore" },
  trashConfirmTitle: { zh: '要将这段录音移到"最近删除"吗？', en: "Move this recording to Recently Deleted?" },
  deleteConfirmTitle: { zh: "要永久删除这段录音吗？", en: "Permanently delete this recording?" },
  emptyTrashConfirmTitle: { zh: "要永久删除所有录音吗？", en: "Permanently delete all recordings?" },
  renamePrompt: { zh: "重命名录音", en: "Rename recording" },
  renameField: { zh: "名称", en: "Name" },
  // 录音面板
  recordTitlePlaceholder: { zh: "录音标题（可选）", en: "Recording title (optional)" },
  paused: { zh: "已暂停", en: "Paused" },
  record: { zh: "录制", en: "Record" },
  pause: { zh: "暂停", en: "Pause" },
  resume: { zh: "继续", en: "Resume" },
  stop: { zh: "停止", en: "Stop" },
  recordFailedTitle: { zh: "无法录音", en: "Can't record" },
  micDenied: { zh: "需要麦克风权限，请在系统设置中允许。", en: "Microphone access is required. Allow it in Settings." },
  micBusy: { zh: "麦克风正被其它功能占用。", en: "The microphone is in use by something else." },
  recorderUnavailable: { zh: "此设备暂时无法录音。", en: "Recording is unavailable on this device." },
  recordIntoLibrary: { zh: "录到录音库（可转写）", en: "Record into library (transcribable)" },
  hostRecording: { zh: "宿主录音进行中", en: "Host recording in progress" },
  localClipNote: {
    zh: "本机剪辑保存在小应用内：可播放、可分享，但**无法转写** —— 容器没有把 applet 私有音频送进转写的通路。",
    en: "On-device clips live inside this app: playable and shareable, but they cannot be transcribed — the container has no path from applet-private audio into transcription."
  },
  // 详情页
  tabSummary: { zh: "摘要", en: "Summary" },
  tabOriginal: { zh: "原文", en: "Original" },
  tabCorrected: { zh: "校正后", en: "Corrected" },
  tabTranslation: { zh: "翻译", en: "Translation" },
  transcribingTitle: { zh: "转录中…", en: "Transcribing…" },
  transcribingBody: { zh: "转写由 Apple 语音识别处理。", en: "Transcription is handled by Apple speech recognition." },
  noTranscriptTitle: { zh: "尚无转录", en: "No transcript yet" },
  noTranscriptBody: { zh: "为这段录音生成转写。", en: "Generate a transcript for this recording." },
  transcribeFailedTitle: { zh: "转录失败", en: "Transcription failed" },
  transcribeFailedBody: { zh: "出了点问题，请重新转录。", en: "Something went wrong. Try transcribing again." },
  transcribeAction: { zh: "转录", en: "Transcribe" },
  retry: { zh: "重试", en: "Retry" },
  audioRemovedTitle: { zh: "音频文件已移除", en: "Audio file removed" },
  audioRemovedBody: {
    zh: "播放、编辑和重新转写已不可用，但文稿仍会保留。",
    en: "Playback, editing and re-transcription are unavailable, but the transcript is kept."
  },
  edited: { zh: "已编辑", en: "Edited" },
  stale: { zh: "已过期", en: "Out of date" },
  staleTranscriptChanged: { zh: "转录稿已改动", en: "the transcript changed" },
  chapters: { zh: "章节", en: "Chapters" },
  findingChapters: { zh: "查找章节中…", en: "Finding chapters…" },
  // 摘要 Tab
  noSummaryTitle: { zh: "暂无摘要", en: "No summary yet" },
  noSummaryBody: { zh: "选择上方模板以生成摘要。", en: "Pick a template above to generate one." },
  summaryFailed: { zh: "无法生成摘要。请检查 AI 模型后重试。", en: "Could not generate a summary. Check the AI model and retry." },
  templateGeneral: { zh: "通用", en: "General" },
  templateMeeting: { zh: "会议纪要", en: "Meeting" },
  templateInterview: { zh: "面试", en: "Interview" },
  templateOneOnOne: { zh: "一对一", en: "1:1" },
  templateLecture: { zh: "讲座", en: "Lecture" },
  templatePodcast: { zh: "播客", en: "Podcast" },
  // 校正 Tab
  speakerModeNone: { zh: "不区分说话人", en: "No speaker labels" },
  speakerModeAuto: { zh: "自动识别", en: "Detect automatically" },
  speakerModeNamed: { zh: "指定", en: "Named" },
  speakerName: { zh: "说话人 {n}", en: "Speaker {n}" },
  correctAction: { zh: "校正", en: "Correct" },
  recorrectAction: { zh: "重新校正", en: "Correct again" },
  noCorrectionTitle: { zh: "尚未校正", en: "Not corrected yet" },
  noCorrectionBody: {
    zh: "用上方按钮修正识别错误、整理排版并标注说话人。",
    en: "Use the button above to fix recognition errors, tidy the layout and label speakers."
  },
  correctionFailed: { zh: "校正失败。请检查 AI 模型后重试。", en: "Correction failed. Check the AI model and retry." },
  correctionNoTimestamps: {
    zh: "容器拿不到逐词时间戳，校正段不带时间回查。",
    en: "Word-level timestamps are unavailable in the container, so corrected turns carry no seek times."
  },
  // 翻译 Tab
  translateAction: { zh: "翻译", en: "Translate" },
  retranslateAction: { zh: "重新翻译", en: "Translate again" },
  translationOnly: { zh: "仅译文", en: "Translation only" },
  bilingual: { zh: "双语对照", en: "Bilingual" },
  noTranslationTitle: { zh: "尚未翻译", en: "Not translated yet" },
  noTranslationBody: {
    zh: "选择语言后翻译，即可用你的语言阅读转录稿。",
    en: "Pick a language and translate to read the transcript in your own language."
  },
  // AI 抽屉
  cleanUp: { zh: "整理文本", en: "Clean Up" },
  cleanUpKeep: { zh: "保留", en: "Keep" },
  cleanUpFailed: { zh: "无法整理文本。", en: "Could not clean up the text." },
  cleanUpWarning: {
    zh: "整理会直接改写转录原文并作废全部 AI 产物（原文可撤销）。",
    en: "Clean Up rewrites the transcript in place and invalidates every AI artifact (the original is recoverable)."
  },
  actionItems: { zh: "待办事项", en: "Action Items" },
  groupTasks: { zh: "任务", en: "Tasks" },
  groupDecisions: { zh: "决定", en: "Decisions" },
  groupCommitments: { zh: "你的承诺", en: "Your Commitments" },
  noActionItems: { zh: "未找到待办事项。", en: "No action items found." },
  actionItemsFailed: { zh: "无法找到待办事项。", en: "Could not extract action items." },
  askTitle: { zh: "询问这段录音", en: "Ask this recording" },
  askHint: { zh: "就这段录音随便问。回答只来自它的转录文本。", en: "Ask anything. Answers come only from its transcript." },
  askPlaceholder: { zh: "就这段录音提问…", en: "Ask about this recording…" },
  askThinking: { zh: "思考中…", en: "Thinking…" },
  askFailed: { zh: "无法回答这个问题。", en: "Could not answer that question." },
  askStarter1: { zh: "总结这些决定", en: "Summarize the decisions" },
  askStarter2: { zh: "列出待办事项", en: "List the action items" },
  askStarter3: { zh: "我承诺了什么？", en: "What did I commit to?" },
  // 分享 / 导出
  share: { zh: "分享", en: "Share" },
  shareSummary: { zh: "分享摘要", en: "Share summary" },
  shareTranscript: { zh: "分享原文", en: "Share transcript" },
  shareCorrected: { zh: "分享校正稿", en: "Share corrected text" },
  shareTranslation: { zh: "分享翻译", en: "Share translation" },
  exportGroup: { zh: "导出", en: "Export" },
  exportMarkdown: { zh: "导出为 Markdown", en: "Export as Markdown" },
  exportText: { zh: "导出为文本", en: "Export as text" },
  exportSRT: { zh: "导出为字幕", en: "Export as subtitles" },
  copy: { zh: "复制", en: "Copy" },
  labelCreatedAt: { zh: "创建时间", en: "Created" },
  labelDuration: { zh: "时长", en: "Duration" },
  // 文件夹页
  smartAllRecordings: { zh: "全部录音", en: "All Recordings" },
  smartFavourites: { zh: "收藏", en: "Favourites" },
  smartLocalClips: { zh: "本机剪辑", en: "On-device clips" },
  recentlyDeleted: { zh: "最近删除", en: "Recently Deleted" },
  trashEmptyTitle: { zh: "最近删除为空", en: "Recently Deleted is empty" },
  trashEmptyBody: { zh: "已删除的录音会显示在这里，方便恢复。", en: "Deleted recordings appear here so you can restore them." },
  trashFooter: { zh: "录音会保留在这里，直到你恢复或永久删除。", en: "Recordings stay here until you restore or permanently delete them." },
  emptyTrash: { zh: "清空", en: "Empty" },
  foldersUnavailable: {
    zh: "用户文件夹需要宿主投影 memo_folder_* 工具，当前容器还没有 —— 所以这里只有智能列表。",
    en: "User folders need the host to project the memo_folder_* tools, which it does not yet — so only smart lists are shown here."
  },
  // 设置页
  settingsAI: { zh: "AI 与自动化", en: "AI & Automation" },
  settingsRecording: { zh: "录音与转写", en: "Recording & Transcription" },
  settingsStorage: { zh: "存储", en: "Storage" },
  transcribeLanguage: { zh: "转录语言", en: "Transcription language" },
  transcribeLanguageHint: {
    zh: "用于转录录音的语言。「自动」跟随 App 语言。如果某条录音转录出来是乱码（例如中文音频被当成英文转录），在此设为实际所说的语言后重新转录。",
    en: 'The language used to transcribe. "Automatic" follows the app language. If a recording comes out as gibberish (for example Chinese audio transcribed as English), set the language actually spoken and transcribe again.'
  },
  localeAuto: { zh: "自动", en: "Automatic" },
  localeZh: { zh: "中文", en: "Chinese" },
  localeEn: { zh: "英语", en: "English" },
  autoTranscribe: { zh: "录音后自动转录", en: "Transcribe after recording" },
  autoSummarize: { zh: "自动生成摘要", en: "Summarize automatically" },
  autoSummarizeHint: { zh: "转录后自动生成摘要（只补空，不覆盖已有结果）。", en: "Summarize after transcription — fills gaps only, never overwrites." },
  defaultTemplate: { zh: "默认摘要模板", en: "Default summary template" },
  quality: { zh: "录音质量", en: "Recording quality" },
  qualityHigh: { zh: "高", en: "High" },
  qualityMedium: { zh: "中", en: "Medium" },
  qualityLow: { zh: "低", en: "Low" },
  qualityHint: {
    zh: "录音统一使用 AAC/M4A，以保证播放与分享的一致性。更高质量会占用更多空间，修改仅影响新录音。",
    en: "Recordings always use AAC/M4A for consistent playback and sharing. Higher quality uses more space; changes affect new recordings only."
  },
  clipCount: { zh: "本机剪辑", en: "On-device clips" },
  clipBytes: { zh: "占用空间", en: "Space used" },
  hostSettingsNote: {
    zh: "存储位置、音频预算、麦克风选择与完整性扫描属于宿主级设置，留在「设置 ▸ 语音备忘录」里。",
    en: "Storage location, audio budget, microphone choice and integrity scans are host-level settings and stay in Settings ▸ Voice Memos."
  },
  libraryUnavailable: {
    zh: "宿主没有装语音备忘录模块，录音库不可用 —— 只能用本机剪辑。",
    en: "The host has no Voice Memos module, so the recordings library is unavailable — only on-device clips work."
  }
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
const SETTINGS_KEY = "settings";
function useMemoStore() {
  const [ready, setReady] = useState(false);
  const [library, setLibrary] = useState([]);
  const [clips, setClips] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [libraryError, setLibraryError] = useState(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [nextLibrary, nextClips, stored] = await Promise.all([
        capabilities.library ? listLibrary() : Promise.resolve([]),
        listClips(),
        loadSetting(SETTINGS_KEY, {})
      ]);
      if (cancelled) return;
      setLibrary(nextLibrary);
      setClips(nextClips);
      setSettings({ ...DEFAULT_SETTINGS, ...stored });
      setLibraryError(capabilities.library ? null : "aibox/voicememos-unavailable");
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);
  const memos = useMemo(() => {
    const merged = [...library, ...clips.filter((clip2) => !clip2.isTrashed).map(clipToMemo)];
    return merged.sort((a, b) => b.createdAt - a.createdAt);
  }, [library, clips]);
  const updateSettings = useCallback((patch) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void saveSetting(SETTINGS_KEY, next);
      return next;
    });
  }, []);
  return {
    ready,
    memos,
    clips,
    settings,
    libraryAvailable: capabilities.library,
    libraryError,
    updateSettings,
    refresh
  };
}
__name(useMemoStore, "useMemoStore");
function App() {
  const scene = useScene();
  const locale = useLocale();
  const tabs = useTabs();
  const store = useMemoStore();
  const lang = locale.language.startsWith("zh") ? "zh" : "en";
  const t = useMemo(() => makeT(lang), [lang]);
  const dark = scene?.appearance.effectiveColorScheme === "dark";
  const hostAccent = scene?.appearance.accentColor ?? null;
  const palette$1 = useMemo(() => {
    const base = palette(Boolean(dark));
    return hostAccent ? { ...base, accent: hostAccent } : base;
  }, [dark, hostAccent]);
  const [tab, setTab] = useState("record");
  const [route, setRoute] = useState({ kind: "root" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(DEFAULT_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [recorder, setRecorder] = useState(null);
  const [busyIDs, setBusyIDs] = useState({});
  const [sheet, setSheet] = useState(null);
  const detailContext = useRef(null);
  const [detailArtifacts, setDetailArtifacts] = useState(null);
  useEffect(() => {
    if (tabs.rendered && tabs.selected && tabs.selected !== tab) setTab(tabs.selected);
  }, [tabs.selected, tabs.rendered]);
  useEffect(() => {
    void (async () => setRecorder(await recorderAvailability()))();
  }, []);
  const exportLabels = useMemo(() => ({
    createdAt: t("labelCreatedAt"),
    duration: t("labelDuration"),
    summary: t("tabSummary"),
    corrected: t("tabCorrected"),
    transcript: t("tabOriginal"),
    chapters: t("chapters"),
    actionItems: t("actionItems"),
    translation: t("tabTranslation")
  }), [t]);
  useEffect(() => {
    registerMemoActions(store.refresh, locale.locale, exportLabels);
  }, [store.refresh, locale.locale, exportLabels]);
  const beginRecording = useCallback(async () => {
    if (!recorder?.available) return;
    const preset = QUALITY_PRESET[store.settings.quality];
    const result = await recordStart(preset);
    if (!result.started) {
      await confirmAlert(t("recordFailedTitle"), errorText(t, result.error));
      setRecorder(await recorderAvailability());
      return;
    }
    setDraftTitle("");
    setRecordOpen(true);
  }, [recorder, store.settings.quality, t]);
  const openMenu = useCallback(async (memo) => {
    const actions = [
      { id: "rename", title: t("rename") },
      { id: "fav", title: memo.isFavourite ? t("unfavourite") : t("favourite") }
    ];
    if (memo.source === "library" && !memo.hasTranscript && memo.hasAudio) {
      actions.push({ id: "transcribe", title: t("startTranscription") });
    }
    if (memo.source === "library" && memo.hasTranscript) actions.push({ id: "copy", title: t("copyTranscript") });
    if (memo.source === "local") actions.push({ id: "share", title: t("shareAudio") });
    actions.push({ id: "delete", title: memo.source === "local" ? t("moveToTrash") : t("deletePermanently"), destructive: true });
    const picked = await actionSheet(actions);
    if (!picked) return;
    const key = `${memo.source}:${memo.id}`;
    if (picked === "rename") {
      const next = await promptText(t("renamePrompt"), memo.title);
      if (!next) return;
      if (memo.source === "library") await renameMemo(memo.id, next);
      else {
        const clip2 = (await listClips()).find((item) => item.id === memo.id);
        if (clip2) await saveClip({ ...clip2, title: next });
      }
      store.refresh();
      return;
    }
    if (picked === "fav") {
      if (memo.source === "library") await toggleFavourite(memo.id);
      else {
        const clip2 = (await listClips()).find((item) => item.id === memo.id);
        if (clip2) await saveClip({ ...clip2, isFavourite: !clip2.isFavourite });
      }
      store.refresh();
      return;
    }
    if (picked === "transcribe") {
      setBusyIDs((current) => ({ ...current, [key]: t("transcribing") }));
      await startTranscription(memo.id, store.settings.transcribeLocale === "auto" ? void 0 : store.settings.transcribeLocale);
      setRoute({ kind: "detail", memo });
      setBusyIDs((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    if (picked === "copy") {
      const transcript = await fetchTranscript(memo.id);
      if (transcript?.fullText) await copyText(transcript.fullText);
      return;
    }
    if (picked === "share") {
      await shareClipAudio(memo);
      return;
    }
    if (picked === "delete") {
      const ok = await confirmDestructive(
        memo.source === "local" ? t("trashConfirmTitle") : t("deleteConfirmTitle"),
        memo.source === "local" ? t("moveToTrash") : t("deletePermanently"),
        t("cancel")
      );
      if (!ok) return;
      if (memo.source === "local") {
        const clip2 = (await listClips()).find((item) => item.id === memo.id);
        if (clip2) await saveClip({ ...clip2, isTrashed: true, trashedAt: Date.now() });
      } else {
        await deleteMemo(memo.id);
      }
      store.refresh();
      if (route.kind === "detail") setRoute({ kind: "root" });
    }
  }, [t, store, route.kind]);
  const openDetailMenu = useCallback(async (context) => {
    detailContext.current = context;
    setDetailArtifacts(context.artifacts);
    const memo = context.memo;
    const hasText = Boolean(context.text.trim());
    const actions = [];
    if (hasText) {
      actions.push({ id: "actionItems", title: t("actionItems") });
      actions.push({ id: "ask", title: t("askTitle") });
      actions.push({ id: "cleanUp", title: t("cleanUp"), destructive: true });
      actions.push({ id: "shareTranscript", title: t("shareTranscript") });
      if (context.artifacts?.summaryText) actions.push({ id: "shareSummary", title: t("shareSummary") });
      if (capabilities.shareFile) {
        actions.push({ id: "exportMd", title: t("exportMarkdown") });
        actions.push({ id: "exportTxt", title: t("exportText") });
        actions.push({ id: "exportSrt", title: t("exportSRT") });
      }
    }
    actions.push({ id: "rename", title: t("rename") });
    const picked = await actionSheet(actions);
    if (!picked) return;
    if (picked === "actionItems") return setSheet("actionItems");
    if (picked === "ask") return setSheet("ask");
    if (picked === "cleanUp") return setSheet("cleanUp");
    if (picked === "shareTranscript") return void shareText(context.text);
    if (picked === "shareSummary") return void shareText(context.artifacts?.summaryText ?? "");
    if (picked === "rename") return void openMenu(memo);
    if (picked.startsWith("export")) {
      const payload = {
        memo,
        locale: locale.locale,
        summary: context.artifacts?.summaryText ?? "",
        transcript: context.text,
        correctionTurns: context.artifacts?.correctionTurns ?? [],
        chapters: context.artifacts?.chapters ?? [],
        actionItems: context.artifacts?.actionItems ?? [],
        translation: context.artifacts?.translationText ?? "",
        labels: exportLabels
      };
      const format = picked === "exportMd" ? "md" : picked === "exportTxt" ? "txt" : "srt";
      const body = format === "srt" ? exportSRT(payload) : format === "txt" ? exportText(payload) : exportMarkdown(payload);
      await shareFile(`${fileSlug(memo.title)}-${newID().slice(0, 6)}.${format}`, body);
    }
  }, [t, locale.locale, exportLabels, openMenu]);
  const rootMemos = store.memos;
  const scopedMemos = route.kind === "scoped" ? route.scope === "fav" ? rootMemos.filter((memo) => memo.isFavourite) : route.scope === "local" ? rootMemos.filter((memo) => memo.source === "local") : rootMemos : [];
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
        flexDirection: "column"
      },
      children: [
        tab === "record" ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: SPACE.s2, alignItems: "center", padding: `${SPACE.s3}px ${SPACE.s4}px 0` }, children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                value: query,
                onChange: /* @__PURE__ */ __name((event) => setQuery(event.target.value), "onChange"),
                placeholder: t("searchPlaceholder"),
                enterKeyHint: "search",
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
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: /* @__PURE__ */ __name(() => setFilterOpen(true), "onClick"),
                style: {
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 8,
                  color: filterIsActive(filter) ? palette$1.accent : palette$1.muted
                },
                "aria-label": t("filter"),
                children: /* @__PURE__ */ jsx(Icon, { name: "list", size: 18 })
              }
            )
          ] }),
          !store.libraryAvailable ? /* @__PURE__ */ jsxs("div", { style: { margin: `${SPACE.s3}px ${SPACE.s4}px 0`, background: alpha(palette$1.orange, 0.12), borderRadius: RADIUS.field, padding: SPACE.s3, fontSize: 12, color: palette$1.orange }, children: [
            /* @__PURE__ */ jsx(Icon, { name: "warning", size: 12 }),
            " ",
            t("libraryUnavailable")
          ] }) : null,
          /* @__PURE__ */ jsxs("main", { style: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }, children: [
            /* @__PURE__ */ jsx(
              MemoList,
              {
                palette: palette$1,
                t,
                dark: Boolean(dark),
                memos: rootMemos,
                query,
                filter,
                scoped: false,
                busyIDs,
                onOpen: /* @__PURE__ */ __name((memo) => setRoute({ kind: "detail", memo }), "onOpen"),
                onMenu: openMenu,
                onClearFilter: /* @__PURE__ */ __name(() => setFilter(DEFAULT_FILTER), "onClearFilter")
              }
            ),
            /* @__PURE__ */ jsx("div", { style: { height: 96 } })
          ] }),
          recorder?.available ? /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                justifyContent: "center",
                paddingBottom: `calc(${tabs.rendered ? 16 : 74}px + env(safe-area-inset-bottom))`,
                pointerEvents: "none"
              },
              children: /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: /* @__PURE__ */ __name(() => void beginRecording(), "onClick"),
                  style: {
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    border: "none",
                    cursor: "pointer",
                    background: palette$1.red,
                    color: "#FFFFFF",
                    fontSize: 18,
                    pointerEvents: "auto",
                    boxShadow: "0 3px 6px rgba(0,0,0,0.18)"
                  },
                  "aria-label": t("record"),
                  children: /* @__PURE__ */ jsx(Icon, { name: "mic", size: 18 })
                }
              )
            }
          ) : null
        ] }) : null,
        tab === "library" ? /* @__PURE__ */ jsx("main", { style: { flex: 1, overflowY: "auto" }, children: /* @__PURE__ */ jsx(
          LibraryTab,
          {
            palette: palette$1,
            t,
            memos: rootMemos,
            trashCount: store.clips.filter((clip2) => clip2.isTrashed).length,
            onScope: /* @__PURE__ */ __name((scope) => setRoute({ kind: "scoped", scope }), "onScope"),
            onTrash: /* @__PURE__ */ __name(() => setRoute({ kind: "trash" }), "onTrash"),
            onHostRecord: /* @__PURE__ */ __name(async () => {
              await hostRecordStart(defaultTitle(t("newRecording"), locale.locale));
              store.refresh();
            }, "onHostRecord"),
            libraryAvailable: store.libraryAvailable
          }
        ) }) : null,
        tab === "settings" ? /* @__PURE__ */ jsx("main", { style: { flex: 1, overflowY: "auto" }, children: /* @__PURE__ */ jsx(SettingsTab, { palette: palette$1, t, dark: Boolean(dark), settings: store.settings, onChange: store.updateSettings, clips: store.clips }) }) : null,
        !tabs.rendered ? /* @__PURE__ */ jsx("nav", { style: { display: "flex", borderTop: `1px solid ${palette$1.line}`, background: palette$1.surface, paddingBottom: "env(safe-area-inset-bottom)" }, children: ["record", "library", "settings"].map((id) => /* @__PURE__ */ jsxs(
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
              /* @__PURE__ */ jsx("div", { style: { fontSize: 18, lineHeight: "22px" }, children: /* @__PURE__ */ jsx(Icon, { name: id === "record" ? "mic" : id === "library" ? "folder" : "gear", size: 18 }) }),
              t(id === "record" ? "tabRecord" : id === "library" ? "tabFolders" : "tabSettings")
            ]
          },
          id
        )) }) : null,
        route.kind === "detail" ? /* @__PURE__ */ jsx(
          MemoDetail,
          {
            palette: palette$1,
            t,
            dark: Boolean(dark),
            memo: route.memo,
            settings: store.settings,
            onBack: /* @__PURE__ */ __name(() => setRoute({ kind: "root" }), "onBack"),
            onMenu: openDetailMenu,
            onRefresh: store.refresh
          }
        ) : null,
        route.kind === "scoped" ? /* @__PURE__ */ jsx(PushPage, { palette: palette$1, title: t("titleRecordings"), onBack: /* @__PURE__ */ __name(() => setRoute({ kind: "root" }), "onBack"), children: /* @__PURE__ */ jsx(
          MemoList,
          {
            palette: palette$1,
            t,
            dark: Boolean(dark),
            memos: scopedMemos,
            query: "",
            filter: DEFAULT_FILTER,
            scoped: true,
            busyIDs,
            onOpen: /* @__PURE__ */ __name((memo) => setRoute({ kind: "detail", memo }), "onOpen"),
            onMenu: openMenu,
            onClearFilter: /* @__PURE__ */ __name(() => void 0, "onClearFilter")
          }
        ) }) : null,
        route.kind === "trash" ? /* @__PURE__ */ jsx(
          TrashPage,
          {
            palette: palette$1,
            t,
            store,
            onBack: /* @__PURE__ */ __name(() => setRoute({ kind: "root" }), "onBack")
          }
        ) : null,
        /* @__PURE__ */ jsx(FilterSheet, { palette: palette$1, t, open: filterOpen, filter, onChange: setFilter, onClose: /* @__PURE__ */ __name(() => setFilterOpen(false), "onClose") }),
        /* @__PURE__ */ jsx(
          RecordSheet,
          {
            palette: palette$1,
            t,
            open: recordOpen,
            title: draftTitle,
            onTitleChange: setDraftTitle,
            backgroundSupported: Boolean(recorder?.background),
            onCancel: /* @__PURE__ */ __name(() => setRecordOpen(false), "onCancel"),
            onFinish: /* @__PURE__ */ __name(async (clip2) => {
              setRecordOpen(false);
              if (clip2.discarded) return;
              await saveClip({
                id: newID(),
                // 默认标题必须在进持久层前解析成用户语言的真实文案。
                title: draftTitle.trim() || defaultTitle(t("newRecording"), locale.locale),
                createdAt: Date.now(),
                durationMs: clip2.durationMs,
                handle: clip2.handle,
                url: clip2.url,
                byteCount: clip2.byteCount,
                isFavourite: false,
                isTrashed: false,
                trashedAt: null,
                interrupted: clip2.interrupted
              });
              store.refresh();
            }, "onFinish")
          }
        ),
        /* @__PURE__ */ jsx(
          ActionItemsSheet,
          {
            palette: palette$1,
            t,
            open: sheet === "actionItems",
            memoID: detailContext.current?.memo.id ?? "",
            artifacts: detailArtifacts,
            onArtifacts: /* @__PURE__ */ __name((value) => {
              setDetailArtifacts(value);
              detailContext.current?.setArtifacts(value);
            }, "onArtifacts"),
            onSeek: /* @__PURE__ */ __name((seconds) => void seekMemo({ seconds }), "onSeek"),
            onClose: /* @__PURE__ */ __name(() => setSheet(null), "onClose")
          }
        ),
        /* @__PURE__ */ jsx(AskSheet, { palette: palette$1, t, open: sheet === "ask", memoID: detailContext.current?.memo.id ?? "", onClose: /* @__PURE__ */ __name(() => setSheet(null), "onClose") }),
        /* @__PURE__ */ jsx(
          CleanUpSheet,
          {
            palette: palette$1,
            t,
            open: sheet === "cleanUp",
            memoID: detailContext.current?.memo.id ?? "",
            onClose: /* @__PURE__ */ __name(() => setSheet(null), "onClose"),
            onApplied: store.refresh
          }
        )
      ]
    }
  );
}
__name(App, "App");
function LibraryTab(props) {
  const { palette: palette2, t } = props;
  const rows = [
    { id: "all", icon: "waveform", label: t("smartAllRecordings"), badge: props.memos.length },
    { id: "fav", icon: "star.fill", label: t("smartFavourites"), badge: props.memos.filter((memo) => memo.isFavourite).length },
    { id: "local", icon: "mic", label: t("smartLocalClips"), badge: props.memos.filter((memo) => memo.source === "local").length }
  ];
  return /* @__PURE__ */ jsxs("div", { style: { padding: `${SPACE.s4}px 0` }, children: [
    rows.map((row) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: /* @__PURE__ */ __name(() => props.onScope(row.id), "onClick"),
        style: {
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: SPACE.s3,
          border: "none",
          background: "transparent",
          padding: `12px ${SPACE.s4}px`,
          cursor: "pointer",
          borderBottom: `1px solid ${palette2.line}`
        },
        children: [
          /* @__PURE__ */ jsx(Icon, { name: row.icon, size: 16, color: palette2.accent }),
          /* @__PURE__ */ jsx("span", { style: { flex: 1, textAlign: "left", fontSize: 16, color: palette2.ink }, children: row.label }),
          /* @__PURE__ */ jsx("span", { style: { fontSize: 14, color: palette2.muted }, children: row.badge }),
          /* @__PURE__ */ jsx(Icon, { name: "chevron", size: 14, color: palette2.muted })
        ]
      },
      row.id
    )),
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: props.onTrash,
        style: {
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: SPACE.s3,
          border: "none",
          background: "transparent",
          padding: `12px ${SPACE.s4}px`,
          cursor: "pointer",
          borderBottom: `1px solid ${palette2.line}`,
          marginTop: SPACE.s4
        },
        children: [
          /* @__PURE__ */ jsx(Icon, { name: "trash", size: 16, color: palette2.accent }),
          /* @__PURE__ */ jsx("span", { style: { flex: 1, textAlign: "left", fontSize: 16, color: palette2.ink }, children: t("recentlyDeleted") }),
          /* @__PURE__ */ jsx("span", { style: { fontSize: 14, color: palette2.muted }, children: props.trashCount }),
          /* @__PURE__ */ jsx(Icon, { name: "chevron", size: 14, color: palette2.muted })
        ]
      }
    ),
    props.libraryAvailable ? /* @__PURE__ */ jsx("div", { style: { padding: `${SPACE.s5}px ${SPACE.s4}px 0` }, children: /* @__PURE__ */ jsx(SecondaryButton, { palette: palette2, title: t("recordIntoLibrary"), icon: "mic", onClick: props.onHostRecord }) }) : null,
    /* @__PURE__ */ jsx("div", { style: { padding: `${SPACE.s4}px ${SPACE.s4}px`, fontSize: 12, color: palette2.muted }, children: t("foldersUnavailable") })
  ] });
}
__name(LibraryTab, "LibraryTab");
function TrashPage(props) {
  const { palette: palette2, t } = props;
  const trashed = props.store.clips.filter((clip2) => clip2.isTrashed);
  return /* @__PURE__ */ jsx(
    PushPage,
    {
      palette: palette2,
      title: t("recentlyDeleted"),
      onBack: props.onBack,
      trailing: trashed.length ? /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: /* @__PURE__ */ __name(async () => {
            const ok = await confirmDestructive(t("emptyTrashConfirmTitle"), t("emptyTrash"), t("cancel"));
            if (!ok) return;
            for (const clip2 of trashed) await deleteClip(clip2.id);
            props.store.refresh();
          }, "onClick"),
          style: { border: "none", background: "transparent", color: palette2.red, fontSize: 15, cursor: "pointer", padding: 8 },
          children: t("emptyTrash")
        }
      ) : void 0,
      children: trashed.length === 0 ? /* @__PURE__ */ jsxs("div", { style: { padding: `${SPACE.s8}px ${SPACE.s5}px`, textAlign: "center" }, children: [
        /* @__PURE__ */ jsx(Icon, { name: "trash", size: 40, color: palette2.muted }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette2.ink, marginTop: SPACE.s3 }, children: t("trashEmptyTitle") }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 14, color: palette2.muted, marginTop: 6 }, children: t("trashEmptyBody") })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        trashed.map((clip2) => /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: SPACE.s3,
              padding: `10px ${SPACE.s4}px`,
              borderBottom: `1px solid ${palette2.line}`
            },
            children: [
              /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
                /* @__PURE__ */ jsx("div", { style: { fontSize: 16, fontWeight: 500, color: palette2.ink }, children: clip2.title }),
                /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted }, children: clockString(clip2.durationMs / 1e3) })
              ] }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: /* @__PURE__ */ __name(async () => {
                    await saveClip({ ...clip2, isTrashed: false, trashedAt: null });
                    props.store.refresh();
                  }, "onClick"),
                  style: { border: "none", background: "transparent", color: palette2.accent, fontSize: 18, cursor: "pointer" },
                  "aria-label": t("restore"),
                  children: /* @__PURE__ */ jsx(Icon, { name: "gobackward", size: 18 })
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: /* @__PURE__ */ __name(async () => {
                    const ok = await confirmDestructive(t("deleteConfirmTitle"), t("deletePermanently"), t("cancel"));
                    if (!ok) return;
                    await deleteClip(clip2.id);
                    props.store.refresh();
                  }, "onClick"),
                  style: { border: "none", background: "transparent", color: palette2.red, fontSize: 16, cursor: "pointer" },
                  "aria-label": t("deletePermanently"),
                  children: /* @__PURE__ */ jsx(Icon, { name: "trash", size: 16 })
                }
              )
            ]
          },
          clip2.id
        )),
        /* @__PURE__ */ jsx("div", { style: { padding: SPACE.s4, fontSize: 12, color: palette2.muted }, children: t("trashFooter") })
      ] })
    }
  );
}
__name(TrashPage, "TrashPage");
function SettingsTab(props) {
  const { palette: palette2, t, settings } = props;
  const bytes = props.clips.reduce((sum, clip2) => sum + clip2.byteCount, 0);
  const templates = ["general", "meeting", "interview", "oneOnOne", "lecture", "podcast"];
  const templateLabels = {
    general: t("templateGeneral"),
    meeting: t("templateMeeting"),
    interview: t("templateInterview"),
    oneOnOne: t("templateOneOnOne"),
    lecture: t("templateLecture"),
    podcast: t("templatePodcast")
  };
  return /* @__PURE__ */ jsxs("div", { style: { padding: SPACE.s4, display: "flex", flexDirection: "column", gap: SPACE.s5 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: SPACE.s3 }, children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            width: 44,
            height: 44,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: alpha(brandTint(props.dark), 0.15),
            color: brandTint(props.dark),
            fontSize: 20
          },
          children: /* @__PURE__ */ jsx(Icon, { name: "mic", size: 20 })
        }
      ),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: 16, fontWeight: 600, color: palette2.ink }, children: t("titleVoiceMemos") }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 12, color: palette2.muted }, children: [
          t("settingsAI"),
          " · ",
          t("settingsRecording")
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: 500, color: palette2.muted, textTransform: "uppercase", marginBottom: 6 }, children: t("settingsRecording") }),
      /* @__PURE__ */ jsx(
        Picker,
        {
          palette: palette2,
          label: t("transcribeLanguage"),
          value: settings.transcribeLocale,
          options: [
            { value: "auto", label: t("localeAuto") },
            { value: "zh_CN", label: t("localeZh") },
            { value: "en_US", label: t("localeEn") }
          ],
          onChange: /* @__PURE__ */ __name((value) => props.onChange({ transcribeLocale: value }), "onChange")
        }
      ),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted, margin: "4px 0 10px" }, children: t("transcribeLanguageHint") }),
      /* @__PURE__ */ jsx(
        Picker,
        {
          palette: palette2,
          label: t("quality"),
          value: settings.quality,
          options: [
            { value: "high", label: t("qualityHigh") },
            { value: "medium", label: t("qualityMedium") },
            { value: "low", label: t("qualityLow") }
          ],
          onChange: /* @__PURE__ */ __name((value) => props.onChange({ quality: value }), "onChange")
        }
      ),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted, marginTop: 4 }, children: t("qualityHint") })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: 500, color: palette2.muted, textTransform: "uppercase", marginBottom: 6 }, children: t("settingsAI") }),
      /* @__PURE__ */ jsx(Toggle, { palette: palette2, label: t("autoTranscribe"), value: settings.autoTranscribe, onChange: /* @__PURE__ */ __name((value) => props.onChange({ autoTranscribe: value }), "onChange") }),
      /* @__PURE__ */ jsx(
        Toggle,
        {
          palette: palette2,
          label: t("autoSummarize"),
          hint: t("autoSummarizeHint"),
          value: settings.autoSummarize,
          onChange: /* @__PURE__ */ __name((value) => props.onChange({ autoSummarize: value }), "onChange")
        }
      ),
      /* @__PURE__ */ jsx(
        Picker,
        {
          palette: palette2,
          label: t("defaultTemplate"),
          value: settings.defaultTemplate,
          options: templates.map((template) => ({ value: template, label: templateLabels[template] })),
          onChange: /* @__PURE__ */ __name((value) => props.onChange({ defaultTemplate: value }), "onChange")
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: 500, color: palette2.muted, textTransform: "uppercase", marginBottom: 6 }, children: t("settingsStorage") }),
      /* @__PURE__ */ jsx(StatRow, { palette: palette2, label: t("clipCount"), value: String(props.clips.length) }),
      /* @__PURE__ */ jsx(StatRow, { palette: palette2, label: t("clipBytes"), value: byteSize(bytes) }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: palette2.muted, marginTop: 8 }, children: t("hostSettingsNote") })
    ] })
  ] });
}
__name(SettingsTab, "SettingsTab");
function Picker(props) {
  return /* @__PURE__ */ jsxs("label", { style: { display: "flex", alignItems: "center", gap: SPACE.s3, padding: "10px 0", fontSize: 15, color: props.palette.ink }, children: [
    /* @__PURE__ */ jsx("span", { style: { flex: 1 }, children: props.label }),
    /* @__PURE__ */ jsx(
      "select",
      {
        value: props.value,
        onChange: /* @__PURE__ */ __name((event) => props.onChange(event.target.value), "onChange"),
        style: {
          border: `1px solid ${props.palette.line}`,
          borderRadius: 8,
          padding: "6px 8px",
          fontSize: 14,
          background: props.palette.surface,
          color: props.palette.ink
        },
        children: props.options.map((option) => /* @__PURE__ */ jsx("option", { value: option.value, children: option.label }, option.value))
      }
    )
  ] });
}
__name(Picker, "Picker");
function StatRow(props) {
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", padding: "10px 0", fontSize: 15, color: props.palette.ink }, children: [
    /* @__PURE__ */ jsx("span", { style: { flex: 1 }, children: props.label }),
    /* @__PURE__ */ jsx("span", { style: { color: props.palette.muted, fontSize: 14 }, children: props.value })
  ] });
}
__name(StatRow, "StatRow");
function errorText(t, reason) {
  const value = reason.toLowerCase();
  if (value.includes("denied") || value.includes("microphone-denied")) return t("micDenied");
  if (value.includes("busy")) return t("micBusy");
  return t("recorderUnavailable");
}
__name(errorText, "errorText");
async function actionSheet(actions) {
  const bridge2 = typeof window !== "undefined" ? window.aibox : void 0;
  if (!bridge2?.ui || actions.length === 0) return null;
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
__name(actionSheet, "actionSheet");
async function confirmDestructive(title, confirmTitle, cancelTitle) {
  const bridge2 = typeof window !== "undefined" ? window.aibox : void 0;
  if (!bridge2?.ui) return true;
  try {
    const result = await bridge2.ui.confirm({
      title,
      actions: [
        { id: "cancel", title: cancelTitle, role: "cancel" },
        { id: "ok", title: confirmTitle, role: "destructive" }
      ]
    });
    return !result.cancelled && result.actionId === "ok";
  } catch {
    return false;
  }
}
__name(confirmDestructive, "confirmDestructive");
async function confirmAlert(title, message) {
  const bridge2 = typeof window !== "undefined" ? window.aibox : void 0;
  if (!bridge2?.ui) return;
  try {
    await bridge2.ui.alert({ title, message });
  } catch {
  }
}
__name(confirmAlert, "confirmAlert");
async function promptText(title, defaultValue) {
  const bridge2 = typeof window !== "undefined" ? window.aibox : void 0;
  if (!bridge2?.ui) return null;
  try {
    const result = await bridge2.ui.prompt({ title, defaultValue });
    const value = (result.value ?? "").trim();
    return result.cancelled || !value ? null : value;
  } catch {
    return null;
  }
}
__name(promptText, "promptText");
async function copyText(text2) {
  const bridge2 = typeof window !== "undefined" ? window.aibox : void 0;
  if (!bridge2?.clipboard) return;
  try {
    await bridge2.clipboard.write({ text: text2 });
  } catch {
  }
}
__name(copyText, "copyText");
async function shareText(text2) {
  const bridge2 = typeof window !== "undefined" ? window.aibox : void 0;
  if (!bridge2?.share || !text2.trim()) return;
  try {
    await bridge2.share.text({ text: text2 });
  } catch {
  }
}
__name(shareText, "shareText");
async function shareFile(filename, content) {
  const bridge2 = typeof window !== "undefined" ? window.aibox : void 0;
  if (!bridge2?.share || typeof bridge2.share.file !== "function" || !content.trim()) return;
  try {
    await bridge2.share.file({ filename, content, mimeType: filename.endsWith(".srt") ? "application/x-subrip" : "text/plain" });
  } catch {
  }
}
__name(shareFile, "shareFile");
async function shareClipAudio(memo) {
  const bridge2 = typeof window !== "undefined" ? window.aibox : void 0;
  if (!bridge2?.share || typeof bridge2.share.file !== "function" || !memo.url) return;
  try {
    const response = await fetch(memo.url);
    const buffer = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let index = 0; index < buffer.length; index += 1) binary += String.fromCharCode(buffer[index]);
    await bridge2.share.file({
      filename: `${fileSlug(memo.title)}.m4a`,
      content: btoa(binary),
      mimeType: "audio/mp4",
      encoding: "base64"
    });
  } catch {
  }
}
__name(shareClipAudio, "shareClipAudio");
const root = document.getElementById("root");
if (root && root.children.length === 0) {
  createRoot(root).render(createElement(StrictMode, null, createElement(App)));
}
