// 本文件由 @aibox/applet-tsbuild 从 packages/aibox-sdk 打出，**请勿手改**。
// 它是生成物，不是这个应用私有的桥胶水——单一真值在 SDK 包里，重新构建即可刷新。
// 重新生成： npm run build --prefix apps/<id>
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../packages/aibox-sdk/dist/bridge.js
function bridge() {
  try {
    return typeof window !== "undefined" ? window.aibox : void 0;
  } catch {
    return void 0;
  }
}
function isApplet() {
  return bridge() !== void 0;
}
function namespaceOf(name) {
  const host = bridge();
  const value = host?.[name];
  return value && typeof value === "object" ? value : void 0;
}
function available(name, method) {
  const host = bridge();
  const ns = host?.[name];
  if (!ns || typeof ns !== "object")
    return false;
  if (!method)
    return true;
  return typeof ns[method] === "function";
}
function capabilityMap() {
  const host = bridge();
  if (!host || typeof host.capabilities !== "function")
    return {};
  try {
    return host.capabilities() ?? {};
  } catch {
    return {};
  }
}

// ../../packages/aibox-sdk/dist/errors.js
var AiboxError = class extends Error {
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
};
function isAiboxError(value) {
  return value instanceof AiboxError;
}
function hasCode(value, ...codes) {
  return isAiboxError(value) && codes.includes(value.code);
}
function isPermissionDenied(value) {
  return hasCode(value, "aibox/not-granted", "aibox/denied", "aibox/not-declared", "aibox/structurally-denied", "aibox/host-policy-denied", "aibox/refused");
}
function isTransient(value) {
  return hasCode(value, "aibox/busy", "aibox/timeout", "aibox/inactive", "aibox/not-visible", "aibox/upstream-failed");
}
var CODE_IN_MESSAGE = /\b(aibox\/[a-z][a-z0-9-]*)/;
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
async function attempt(run) {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error: normalizeError(error) };
  }
}
async function withFallback(run, fallback, onError) {
  const result = await attempt(run);
  if (result.ok)
    return result.value;
  onError?.(result.error);
  return fallback;
}

// ../../packages/aibox-sdk/dist/capabilities.js
function isAvailable(namespace, method) {
  return available(namespace, method);
}
function allAvailable(...namespaces) {
  return namespaces.every((name) => available(name));
}
async function ifAvailable(namespace, method, run, fallback) {
  if (!available(namespace, method))
    return fallback;
  try {
    return await run();
  } catch {
    return fallback;
  }
}
function requireAvailable(namespace, method) {
  if (available(namespace, method))
    return;
  const target = method ? `aibox.${namespace}.${method}` : `aibox.${namespace}`;
  throw new AiboxError("aibox/unavailable", `aibox/unavailable: ${target} is not registered in this host. Declare it in manifest.permissions.capabilities, and gate the entry point on isAvailable().`);
}
function registeredNamespaces() {
  return Object.keys(capabilityMap()).sort();
}
async function explainAccess(target) {
  const host = bridge();
  if (!host?.access || typeof host.access.explain !== "function")
    return null;
  try {
    return await host.access.explain(target);
  } catch (error) {
    throw normalizeError(error);
  }
}
async function probe(namespace, method) {
  const registered = available(namespace, method);
  const base = { namespace, registered, allowed: null, failedGate: null, remedies: [] };
  if (!registered)
    return base;
  const decision = await explainAccess(method ? { capability: namespace, method } : { capability: namespace }).catch(() => null);
  if (!decision)
    return { ...base, allowed: null };
  return {
    namespace,
    registered,
    allowed: Boolean(decision.allowed),
    failedGate: decision.failedGate ?? null,
    remedies: Array.isArray(decision.remedies) ? decision.remedies : []
  };
}

// ../../packages/aibox-sdk/dist/video.js
async function resolveVideo(pageURL) {
  const host = bridge();
  if (!host?.video?.resolve)
    throw new Error("\u5BBF\u4E3B\u6CA1\u6709\u89C6\u9891\u89E3\u6790\u80FD\u529B");
  try {
    const r = await host.video.resolve({ url: pageURL });
    if (!r?.ok)
      throw new Error(r?.error || "\u89E3\u6790\u4E0D\u51FA\u53EF\u64AD\u653E\u7684\u5730\u5740");
    return { ...r, formats: Array.isArray(r.formats) ? r.formats : [] };
  } catch (error) {
    throw normalizeError(error);
  }
}
function pickBestFormat(formats) {
  const usable = (formats || []).filter((f) => f && f.playable !== false);
  if (!usable.length)
    return null;
  const area = (f) => (Number(f.width) || 0) * (Number(f.height) || 0);
  return usable.reduce((best, f) => area(f) > area(best) ? f : best);
}
function stageAspect(width, height) {
  const w = Number(width), h = Number(height);
  if (!(w > 0) || !(h > 0))
    return "16:9";
  const ratio = Math.min(4, Math.max(0.5, w / h));
  return `${Math.round(ratio * 100)}:100`;
}
async function playVideo(args) {
  const host = bridge();
  if (!host?.video?.play)
    throw new Error("\u5BBF\u4E3B\u6CA1\u6709\u89C6\u9891\u64AD\u653E\u80FD\u529B");
  const payload = {
    title: args.title,
    resumeFrom: args.resumeFrom ?? 0
  };
  if (args.sourceURL) {
    payload.sourceURL = args.sourceURL;
    if (args.formatID)
      payload.formatID = args.formatID;
  } else {
    payload.url = args.url;
  }
  try {
    return await host.video.play(payload);
  } catch (error) {
    throw normalizeError(error);
  }
}

// ../../packages/aibox-sdk/dist/net.js
function requireNet() {
  const host = bridge();
  if (!host?.net || typeof host.net.fetch !== "function") {
    throw new AiboxError("aibox/unavailable", 'aibox/unavailable: aibox.net.fetch is not registered. Set "network": true and list hosts in manifest.permissions.networkAllowed \u2014 page-level fetch() is blocked by CSP and will never work.');
  }
  return host.net;
}
function assertResponse(url, meta, options) {
  if (!options.allowErrorStatus && (meta.status < 200 || meta.status >= 300)) {
    throw new AiboxError("aibox/upstream-failed", `aibox/upstream-failed: ${meta.status} from ${url}`, { data: meta });
  }
  if (!options.allowTruncated && meta.truncated) {
    throw new AiboxError("aibox/truncated", `aibox/truncated: ${url} returned ${meta.bytes} bytes and was cut off. Raise maxBytes, or pass allowTruncated: true if a partial body is genuinely acceptable.`, { data: meta });
  }
}
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1)
    bytes[i] = binary.charCodeAt(i);
  return bytes;
}
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
async function fetchJSON(url, options = {}) {
  const { body, meta } = await rawFetch(url, "json", options);
  assertResponse(url, meta, options);
  return body;
}
async function fetchBytes(url, options = {}) {
  const { body, meta } = await rawFetch(url, "base64", options);
  assertResponse(url, meta, options);
  return base64ToBytes(typeof body === "string" ? body : "");
}
async function fetchWithMeta(url, responseType, options = {}) {
  const { body, meta } = await rawFetch(url, responseType, options);
  return { body, ...meta };
}
function imageURL(remoteURL, options = {}) {
  if (typeof remoteURL !== "string" || remoteURL === "" || !/^https?:\/\//i.test(remoteURL))
    return remoteURL;
  let binary = "";
  const bytes = new TextEncoder().encode(remoteURL);
  for (let i = 0; i < bytes.length; i += 1)
    binary += String.fromCharCode(bytes[i]);
  const handle = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const width = Number(options.width);
  const query = Number.isFinite(width) && width > 0 ? `?w=${Math.round(width)}` : "";
  return `applet://localhost/image/${handle}${query}`;
}

// ../../packages/aibox-sdk/dist/storage.js
var storage_exports = {};
__export(storage_exports, {
  defineKey: () => defineKey,
  get: () => get,
  getParsed: () => getParsed,
  list: () => list,
  remove: () => remove,
  set: () => set
});
function requireStorage() {
  const host = bridge();
  if (!host?.storage || typeof host.storage.get !== "function") {
    throw new AiboxError("aibox/unavailable", 'aibox/unavailable: aibox.storage is not available. Set "storage": true in manifest.permissions.');
  }
  return host.storage;
}
async function get(key, fallback) {
  const host = bridge();
  if (!host?.storage)
    return fallback;
  try {
    const value = await host.storage.get(key);
    return value === null || value === void 0 ? fallback : value;
  } catch {
    return fallback;
  }
}
async function getParsed(key, parse, fallback, onInvalid) {
  const host = bridge();
  if (!host?.storage)
    return fallback;
  let raw = null;
  try {
    raw = await host.storage.get(key);
  } catch {
    return fallback;
  }
  if (raw === null || raw === void 0)
    return fallback;
  try {
    const parsed = parse(raw);
    if (parsed === void 0) {
      onInvalid?.(raw);
      return fallback;
    }
    return parsed;
  } catch {
    onInvalid?.(raw);
    return fallback;
  }
}
async function set(key, value) {
  try {
    return await requireStorage().set(key, value);
  } catch (error) {
    throw normalizeError(error);
  }
}
async function remove(key) {
  try {
    return await requireStorage().remove(key);
  } catch (error) {
    throw normalizeError(error);
  }
}
async function list() {
  try {
    return await requireStorage().list();
  } catch {
    return [];
  }
}
function defineKey(key, fallback, codec = {}) {
  const encode = (value) => codec.serialize ? codec.serialize(value) : value;
  return {
    key,
    read: () => codec.parse ? getParsed(key, codec.parse, fallback, codec.onInvalid) : get(key, fallback),
    write: (value) => set(key, encode(value)),
    clear: () => remove(key)
  };
}

// ../../packages/aibox-sdk/dist/db.js
var PAGE = 500;
function requireDB() {
  const host = bridge();
  if (!host?.db || typeof host.db.query !== "function") {
    throw new AiboxError("aibox/unavailable", "aibox/unavailable: aibox.db is not available in this build.");
  }
  return host.db;
}
function databaseAvailable() {
  const host = bridge();
  return !!host?.db && typeof host.db.query === "function";
}
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

// ../../packages/aibox-sdk/dist/actions.js
function requireAction() {
  const host = bridge();
  if (!host?.action || typeof host.action.register !== "function") {
    throw new AiboxError("aibox/unavailable", "aibox/unavailable: aibox.action.register is not available. Actions only work inside the applet container.");
  }
  return host.action;
}
function registerAction(name, handler) {
  const host = bridge();
  if (!host?.action || typeof host.action.register !== "function")
    return;
  host.action.register(name, handler);
}
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
async function actionResult(data) {
  try {
    return await requireAction().result(data);
  } catch (error) {
    throw normalizeError(error);
  }
}

// ../../packages/aibox-sdk/dist/shell.js
async function tabsAreRendered() {
  const host = bridge();
  if (!host?.tabs)
    return false;
  try {
    const state = await host.tabs.getState();
    return Boolean(state.declared && state.rendered);
  } catch {
    return false;
  }
}
async function searchIsRendered() {
  const host = bridge();
  if (!host?.toolbar)
    return false;
  try {
    const state = await host.toolbar.getState();
    return Boolean(state.search?.declared && state.search?.rendered);
  } catch {
    return false;
  }
}
async function tabsState() {
  const host = bridge();
  if (!host?.tabs)
    return null;
  try {
    return await host.tabs.getState();
  } catch {
    return null;
  }
}
async function selectTab(id) {
  const host = bridge();
  if (!host?.tabs)
    return null;
  try {
    return await host.tabs.select(id);
  } catch (error) {
    throw normalizeError(error);
  }
}
async function setTabBadge(id, badge) {
  const host = bridge();
  if (!host?.tabs)
    return;
  try {
    await host.tabs.update({ items: { [id]: { badge } } });
  } catch {
  }
}
async function sceneState() {
  const host = bridge();
  if (!host?.scene)
    return null;
  try {
    return await host.scene.getState();
  } catch {
    return null;
  }
}
async function setTitle(title) {
  const host = bridge();
  if (!host?.navigation)
    return;
  try {
    await host.navigation.setTitle(title);
  } catch {
  }
}
async function setCloseConfirmation(enabled, options) {
  const host = bridge();
  if (!host?.navigation)
    return;
  try {
    await host.navigation.setCloseConfirmation(enabled ? { enabled: true, ...options } : { enabled: false });
  } catch {
  }
}
async function haptic(kind = "light") {
  if (!available("haptics"))
    return;
  const host = bridge();
  const ns = host?.haptics;
  if (!ns)
    return;
  try {
    if (typeof ns.impact === "function" && (kind === "light" || kind === "medium" || kind === "heavy")) {
      await ns.impact({ style: kind });
    } else if (typeof ns.notification === "function") {
      await ns.notification({ type: kind });
    }
  } catch {
  }
}

// ../../packages/aibox-sdk/dist/manifest.js
function defineManifest(manifest) {
  return manifest;
}

// ../../packages/aibox-sdk/dist/events.js
var events_exports = {};
__export(events_exports, {
  namespaceOn: () => namespaceOn,
  on: () => on,
  once: () => once,
  shellOn: () => shellOn
});
function on(name, handler) {
  const host = bridge();
  if (!host?.events?.on)
    return () => {
    };
  try {
    const off = host.events.on(name, handler);
    return typeof off === "function" ? off : () => host.events?.off?.(name, handler);
  } catch {
    return () => {
    };
  }
}
function namespaceOn(namespace, events, handler) {
  const offs = events.map((event) => on(`${namespace}.${event}`, (payload) => handler(event, payload)));
  return () => offs.forEach((off) => off());
}
function shellOn(namespace, event, handler) {
  const host = bridge();
  const ns = host?.[namespace];
  if (!ns || typeof ns.on !== "function")
    return () => {
    };
  try {
    const off = ns.on(event, handler);
    return typeof off === "function" ? off : () => {
    };
  } catch {
    return () => {
    };
  }
}
function once(name, handler) {
  let off = () => {
  };
  off = on(name, (payload) => {
    off();
    handler(payload);
  });
  return off;
}

// ../../packages/aibox-sdk/dist/ui.js
var ui_exports = {};
__export(ui_exports, {
  actionSheet: () => actionSheet,
  alert: () => alert,
  confirm: () => confirm,
  prompt: () => prompt,
  toast: () => toast
});
async function confirm(input) {
  const host = bridge();
  if (!host?.ui?.confirm)
    return false;
  try {
    const result = await host.ui.confirm(input);
    return !result.cancelled;
  } catch {
    return false;
  }
}
async function alert(input) {
  const host = bridge();
  if (!host?.ui?.alert)
    return false;
  try {
    await host.ui.alert(input);
    return true;
  } catch {
    return false;
  }
}
async function prompt(input) {
  const host = bridge();
  if (!host?.ui?.prompt)
    return null;
  try {
    const result = await host.ui.prompt(input);
    return result.cancelled ? null : result.value;
  } catch {
    return null;
  }
}
async function actionSheet(input) {
  const host = bridge();
  if (!host?.ui?.actionSheet)
    return null;
  try {
    const result = await host.ui.actionSheet(input);
    return result.cancelled ? null : result.actionId;
  } catch {
    return null;
  }
}
async function toast(message) {
  const host = bridge();
  if (!host?.toast?.show)
    return false;
  try {
    return await host.toast.show({ message });
  } catch {
    return false;
  }
}

// ../../packages/aibox-sdk/dist/system.js
var system_exports = {};
__export(system_exports, {
  browserAvailability: () => browserAvailability,
  clearSession: () => clearSession,
  copyText: () => copyText,
  hasSession: () => hasSession,
  openArticle: () => openArticle,
  openInBrowser: () => openInBrowser,
  openURL: () => openURL,
  readClipboard: () => readClipboard,
  secretsWritable: () => secretsWritable,
  shareFile: () => shareFile,
  shareText: () => shareText,
  speak: () => speak,
  stopSpeaking: () => stopSpeaking,
  systemAvailable: () => systemAvailable
});
async function openURL(url, options = {}) {
  const host = bridge();
  if (!host?.open?.url)
    return false;
  return withTimeout(host.open.url({ url }), options.timeoutMs ?? 12e3, false);
}
async function openInBrowser(url, options = {}) {
  const host = bridge();
  if (!host?.browser?.open)
    return openURL(url, options);
  const result = await withTimeout(host.browser.open(options.mode ? { url, mode: options.mode } : { url }), options.timeoutMs ?? 12e3, null);
  return result ? result.opened : false;
}
async function openArticle(article, options = {}) {
  const host = bridge();
  if (!host?.browser?.openArticle)
    return openInBrowser(article.url, options);
  const result = await withTimeout(host.browser.openArticle(article), options.timeoutMs ?? 12e3, null);
  return result ? result.opened : false;
}
async function browserAvailability() {
  const host = bridge();
  if (!host?.browser?.availability)
    return { modes: [], reader: false };
  try {
    return await host.browser.availability();
  } catch {
    return { modes: [], reader: false };
  }
}
async function shareText(text, url) {
  const host = bridge();
  if (!host?.share?.text)
    return false;
  try {
    return await host.share.text(url ? { text, url } : { text });
  } catch {
    return false;
  }
}
async function shareFile(input) {
  const host = bridge();
  if (!host?.share?.file)
    return false;
  try {
    const result = await host.share.file(input);
    return Boolean(result?.shared ?? true);
  } catch {
    return false;
  }
}
async function readClipboard() {
  const host = bridge();
  if (!host?.clipboard?.read)
    return "";
  try {
    return await host.clipboard.read();
  } catch {
    return "";
  }
}
async function copyText(text) {
  const host = bridge();
  if (!host?.clipboard?.write)
    return false;
  try {
    return await host.clipboard.write({ text });
  } catch {
    return false;
  }
}
async function speak(text, options = {}) {
  const host = bridge();
  if (!host?.tts?.speak)
    return false;
  try {
    return await host.tts.speak({ text, ...options });
  } catch {
    return false;
  }
}
async function stopSpeaking() {
  const host = bridge();
  if (!host?.tts?.stop)
    return false;
  try {
    return await host.tts.stop();
  } catch {
    return false;
  }
}
async function hasSession(host_) {
  const host = bridge();
  if (!host?.secrets?.hasSession)
    return false;
  try {
    const result = await host.secrets.hasSession(host_ ? { host: host_ } : void 0);
    return result.hasSession;
  } catch {
    return false;
  }
}
async function clearSession(host_) {
  const host = bridge();
  if (!host?.secrets?.clearSession)
    return 0;
  try {
    const result = await host.secrets.clearSession(host_ ? { host: host_ } : void 0);
    return result.cleared;
  } catch {
    return 0;
  }
}
async function secretsWritable() {
  const host = bridge();
  if (!host?.secrets?.availability)
    return false;
  try {
    const result = await host.secrets.availability();
    return result.available;
  } catch {
    return false;
  }
}
var systemAvailable = {
  share: () => available("share"),
  browser: () => available("browser"),
  clipboard: () => available("clipboard"),
  tts: () => available("tts"),
  secrets: () => available("secrets")
};
function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise.then((value) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }
    }, () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      }
    });
  });
}

// ../../packages/aibox-sdk/dist/intelligence.js
var intelligence_exports = {};
__export(intelligence_exports, {
  aiAvailability: () => aiAvailability,
  aiDecide: () => aiDecide,
  aiGenerate: () => aiGenerate,
  callTool: () => callTool,
  findTool: () => findTool,
  intelligenceAvailable: () => intelligenceAvailable,
  openChat: () => openChat,
  toolAllowed: () => toolAllowed
});
async function aiAvailability() {
  const host = bridge();
  if (!host?.ai?.availability)
    return { available: false, reason: "aibox/ai-unavailable" };
  try {
    const value = await host.ai.availability();
    return { available: value.available, reason: value.reason };
  } catch {
    return { available: false, reason: "aibox/ai-unavailable" };
  }
}
async function aiGenerate(input) {
  const host = bridge();
  if (!host?.ai?.generate)
    return null;
  try {
    const value = await host.ai.generate(typeof input === "string" ? { prompt: input } : input);
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
async function aiDecide(input) {
  const host = bridge();
  if (!host?.ai?.decide)
    return null;
  try {
    return await host.ai.decide(input);
  } catch {
    return null;
  }
}
async function openChat(suggestedPrompt) {
  const host = bridge();
  if (!host?.chat?.shareContext)
    return false;
  try {
    return await host.chat.shareContext(suggestedPrompt ? { suggestedPrompt } : void 0);
  } catch {
    return false;
  }
}
async function findTool(query) {
  const host = bridge();
  if (!host?.tools?.search)
    return null;
  try {
    const results = await host.tools.search({ query, limit: 1 });
    return results[0]?.name ?? null;
  } catch {
    return null;
  }
}
async function toolAllowed(name) {
  const host = bridge();
  if (!host?.access?.explain)
    return false;
  try {
    const decision = await host.access.explain({ tool: name });
    return Boolean(decision.allowed);
  } catch {
    return false;
  }
}
async function callTool(name, args = {}) {
  const host = bridge();
  if (!host?.tools?.call)
    return { ok: false, text: "aibox/unavailable: tool gateway is not registered" };
  try {
    const result = await host.tools.call({ name, arguments: args });
    return { ok: result.ok && !result.isError, text: result.text ?? "", details: result.details };
  } catch (error) {
    return { ok: false, text: String(error?.message ?? error) };
  }
}
var intelligenceAvailable = {
  ai: () => available("ai", "generate"),
  tools: () => available("tools", "call"),
  chat: () => available("chat")
};
export {
  AiboxError,
  actionResult,
  allAvailable,
  attempt,
  available,
  base64ToBytes,
  bridge,
  capabilityMap,
  databaseAvailable,
  defineManifest,
  events_exports as events,
  explainAccess,
  fetchBytes,
  fetchJSON,
  fetchText,
  fetchWithMeta,
  haptic,
  hasCode,
  ifAvailable,
  imageURL,
  intelligence_exports as intelligence,
  isAiboxError,
  isApplet,
  isAvailable,
  isPermissionDenied,
  isTransient,
  namespaceOf,
  normalizeError,
  pickBestFormat,
  playVideo,
  probe,
  queryAll,
  registerAction,
  registerActions,
  registeredNamespaces,
  removeMany,
  requireAvailable,
  resolveVideo,
  sceneState,
  searchIsRendered,
  selectTab,
  setCloseConfirmation,
  setTabBadge,
  setTitle,
  stageAspect,
  storage_exports as storage,
  system_exports as system,
  tabsAreRendered,
  tabsState,
  ui_exports as ui,
  withFallback
};
