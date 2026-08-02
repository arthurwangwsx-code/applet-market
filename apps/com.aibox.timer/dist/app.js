var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
import { useMemo, useState, useEffect, useRef, useCallback, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { jsxs, jsx } from "react/jsx-runtime";
import { List, NavBar, Button, Space } from "antd-mobile";
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
  return true;
}
__name(available, "available");
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
  return available(namespace);
}
__name(isAvailable, "isAvailable");
function requireStorage() {
  const host = bridge();
  if (!host?.storage || typeof host.storage.get !== "function") {
    throw new AiboxError("aibox/unavailable", 'aibox/unavailable: aibox.storage is not available. Set "storage": true in manifest.permissions.');
  }
  return host.storage;
}
__name(requireStorage, "requireStorage");
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
__name(get, "get");
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
__name(getParsed, "getParsed");
async function set(key, value) {
  try {
    return await requireStorage().set(key, value);
  } catch (error) {
    throw normalizeError(error);
  }
}
__name(set, "set");
async function remove(key) {
  try {
    return await requireStorage().remove(key);
  } catch (error) {
    throw normalizeError(error);
  }
}
__name(remove, "remove");
function defineKey(key, fallback) {
  return {
    key,
    read: /* @__PURE__ */ __name(() => get(key, fallback), "read"),
    readParsed: /* @__PURE__ */ __name((parse, onInvalid) => getParsed(key, parse, fallback, onInvalid), "readParsed"),
    write: /* @__PURE__ */ __name((value) => set(key, value), "write"),
    clear: /* @__PURE__ */ __name(() => remove(key), "clear")
  };
}
__name(defineKey, "defineKey");
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
__name(haptic, "haptic");
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
function useKeyboardInset() {
  const measure = /* @__PURE__ */ __name(() => {
    if (typeof window === "undefined")
      return 0;
    const viewport = window.visualViewport;
    if (!viewport)
      return 0;
    const covered = (window.innerHeight || 0) - (viewport.height + viewport.offsetTop);
    return covered > 1 ? Math.round(covered) : 0;
  }, "measure");
  const [inset, setInset] = useState(() => ({ height: measure(), animationMs: 250, source: "viewport" }));
  useBridgeEvent("events", "keyboardChanged", (payload) => {
    const next = payload ?? {};
    setInset({
      height: Math.max(0, Math.round(Number(next.height) || 0)),
      animationMs: Math.max(0, Math.round(Number(next.animationMs) || 250)),
      source: "host"
    });
  });
  useEffect(() => {
    if (typeof window === "undefined")
      return void 0;
    const viewport = window.visualViewport;
    if (!viewport)
      return void 0;
    const update = /* @__PURE__ */ __name(() => setInset((previous) => {
      if (previous.source === "host")
        return previous;
      const height = measure();
      return previous.height === height ? previous : { height, animationMs: previous.animationMs, source: "viewport" };
    }), "update");
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    update();
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
__name(useKeyboardInset, "useKeyboardInset");
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
const DEFAULT_SECONDS = 25 * 60;
const HISTORY_LIMIT = 100;
const running = defineKey("timer.running", null);
const history = defineKey("timer.history", []);
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
__name(asRecord, "asRecord");
function toRunning(raw) {
  const record = asRecord(raw);
  if (!record) return void 0;
  const plannedSeconds = Number(record.plannedSeconds);
  const startedAt = Number(record.startedAt);
  if (!Number.isFinite(plannedSeconds) || plannedSeconds <= 0) return void 0;
  if (!Number.isFinite(startedAt) || startedAt <= 0) return void 0;
  return { label: typeof record.label === "string" ? record.label : "", plannedSeconds, startedAt };
}
__name(toRunning, "toRunning");
function toSession(raw) {
  const record = asRecord(raw);
  if (!record) return void 0;
  const id = typeof record.id === "string" ? record.id : null;
  if (!id) return void 0;
  return {
    id,
    label: typeof record.label === "string" ? record.label : "",
    plannedSeconds: Number(record.plannedSeconds) || 0,
    actualSeconds: Number(record.actualSeconds) || 0,
    finishedAt: Number(record.finishedAt) || 0,
    completed: record.completed === true
  };
}
__name(toSession, "toSession");
function remainingSeconds(timer, now = Date.now()) {
  const elapsed = Math.floor((now - timer.startedAt) / 1e3);
  return Math.max(0, timer.plannedSeconds - elapsed);
}
__name(remainingSeconds, "remainingSeconds");
async function loadRunning() {
  const value = await running.readParsed(toRunning);
  return toRunning(value) ?? null;
}
__name(loadRunning, "loadRunning");
async function saveRunning(timer) {
  await running.write(timer === null ? null : { ...timer });
}
__name(saveRunning, "saveRunning");
async function loadHistory() {
  const value = await history.read();
  if (!Array.isArray(value)) return [];
  return value.map(toSession).filter((entry) => entry !== void 0);
}
__name(loadHistory, "loadHistory");
async function appendHistory(session) {
  const previous = await loadHistory();
  const next = [session, ...previous].slice(0, HISTORY_LIMIT);
  await history.write(next);
  return next;
}
__name(appendHistory, "appendHistory");
function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = seconds % 60;
  const pad = /* @__PURE__ */ __name((value) => String(value).padStart(2, "0"), "pad");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
__name(formatDuration, "formatDuration");
function durationFrom(input) {
  if (Number.isFinite(input.seconds) && input.seconds > 0) {
    return Math.min(10800, Math.floor(input.seconds));
  }
  if (Number.isFinite(input.minutes) && input.minutes > 0) {
    return Math.min(180, Math.floor(input.minutes)) * 60;
  }
  return DEFAULT_SECONDS;
}
__name(durationFrom, "durationFrom");
function newSessionID() {
  return `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
__name(newSessionID, "newSessionID");
function Dial({ remaining, planned, label, running: running2 }) {
  const radius = 96;
  const circumference = 2 * Math.PI * radius;
  const progress = planned > 0 ? Math.min(1, Math.max(0, remaining / planned)) : 0;
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }, children: [
    /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 220 220", style: { width: "min(64vw, 240px)", height: "auto" }, "aria-hidden": "true", children: [
      /* @__PURE__ */ jsx(
        "circle",
        {
          cx: "110",
          cy: "110",
          r: radius,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "10",
          opacity: "0.15"
        }
      ),
      /* @__PURE__ */ jsx(
        "circle",
        {
          cx: "110",
          cy: "110",
          r: radius,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "10",
          strokeLinecap: "round",
          strokeDasharray: circumference,
          strokeDashoffset: circumference * (1 - progress),
          transform: "rotate(-90 110 110)",
          style: { opacity: running2 ? 1 : 0.45 }
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: { fontSize: 44, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" },
        children: formatDuration(remaining)
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "ax-muted", style: { fontSize: 15 }, children: label })
  ] });
}
__name(Dial, "Dial");
function HistoryList({ sessions, locale }) {
  if (sessions.length === 0) {
    return /* @__PURE__ */ jsx("div", { className: "ax-muted", style: { padding: "32px 16px", textAlign: "center", fontSize: 14 }, children: "还没有记录。计完一段就会出现在这里。" });
  }
  const time = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return /* @__PURE__ */ jsx(List, { header: `最近 ${sessions.length} 段`, children: sessions.map((session) => /* @__PURE__ */ jsxs(
    List.Item,
    {
      description: time.format(new Date(session.finishedAt)),
      extra: /* @__PURE__ */ jsx("span", { style: { fontVariantNumeric: "tabular-nums" }, children: formatDuration(session.actualSeconds) }),
      children: [
        session.label,
        !session.completed && /* @__PURE__ */ jsx("span", { className: "ax-muted", style: { marginLeft: 6, fontSize: 12 }, children: "（中断）" })
      ]
    },
    session.id
  )) });
}
__name(HistoryList, "HistoryList");
function registerAppletActions(onChange) {
  registerActions({
    async start(input) {
      const seconds = durationFrom(input);
      const label = typeof input.label === "string" && input.label.trim() !== "" ? input.label.trim() : "专注";
      await saveRunning({ label, plannedSeconds: seconds, startedAt: Date.now() });
      onChange();
      return {
        ok: true,
        remainingSeconds: seconds,
        label,
        text: `已开始计时：${label}，${formatDuration(seconds)}`
      };
    },
    async status() {
      const running2 = await loadRunning();
      if (!running2) return { ok: true, running: false, text: "当前没有正在进行的计时。" };
      const left = remainingSeconds(running2);
      return {
        ok: true,
        running: left > 0,
        remainingSeconds: left,
        label: running2.label,
        text: left > 0 ? `${running2.label} 还剩 ${formatDuration(left)}` : `${running2.label} 已经到点了。`
      };
    },
    async stop(input) {
      const running2 = await loadRunning();
      if (!running2) return { ok: true, stopped: false, text: "没有正在进行的计时。" };
      const left = remainingSeconds(running2);
      const actual = running2.plannedSeconds - left;
      await saveRunning(null);
      if (input.record === true) {
        await appendHistory({
          id: newSessionID(),
          label: running2.label,
          plannedSeconds: running2.plannedSeconds,
          actualSeconds: actual,
          finishedAt: Date.now(),
          completed: left === 0
        });
      }
      onChange();
      return { ok: true, stopped: true, text: `已停止：${running2.label}（计了 ${formatDuration(actual)}）` };
    }
  });
}
__name(registerAppletActions, "registerAppletActions");
const POLL_MS = 500;
function App() {
  const { locale } = useLocale();
  const scene = useScene();
  const keyboard = useKeyboardInset();
  const [running2, setRunning] = useState(null);
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS);
  const [history2, setHistory] = useState([]);
  const [ready, setReady] = useState(false);
  const settling = useRef(false);
  const refresh = useCallback(async () => {
    const [next, sessions] = await Promise.all([loadRunning(), loadHistory()]);
    setRunning(next);
    setHistory(sessions);
    setRemaining(next ? remainingSeconds(next) : DEFAULT_SECONDS);
  }, []);
  useEffect(() => {
    void refresh().finally(() => setReady(true));
    registerAppletActions(() => {
      void refresh();
    });
  }, [refresh]);
  useEffect(() => {
    if (!running2) return void 0;
    const tick = /* @__PURE__ */ __name(async () => {
      const left = remainingSeconds(running2);
      setRemaining(left);
      if (left > 0 || settling.current) return;
      settling.current = true;
      await saveRunning(null);
      const sessions = await appendHistory({
        id: newSessionID(),
        label: running2.label,
        plannedSeconds: running2.plannedSeconds,
        actualSeconds: running2.plannedSeconds,
        finishedAt: Date.now(),
        completed: true
      });
      setHistory(sessions);
      setRunning(null);
      void haptic("success");
      settling.current = false;
    }, "tick");
    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [running2]);
  const start = useCallback(async (seconds) => {
    const next = { label: "专注", plannedSeconds: seconds, startedAt: Date.now() };
    await saveRunning(next);
    setRunning(next);
    setRemaining(seconds);
    void haptic("light");
  }, []);
  const stop = useCallback(async () => {
    if (!running2) return;
    const left = remainingSeconds(running2);
    await saveRunning(null);
    const sessions = await appendHistory({
      id: newSessionID(),
      label: running2.label,
      plannedSeconds: running2.plannedSeconds,
      actualSeconds: running2.plannedSeconds - left,
      finishedAt: Date.now(),
      completed: false
    });
    setHistory(sessions);
    setRunning(null);
    setRemaining(DEFAULT_SECONDS);
    void haptic("warning");
  }, [running2]);
  const safeBottom = scene?.safeArea.bottom ?? 0;
  return /* @__PURE__ */ jsxs("div", { style: { minHeight: "100dvh", display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ jsx(NavBar, { back: null, children: "计时器" }),
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "32px 16px 0" }, children: [
      /* @__PURE__ */ jsx(
        Dial,
        {
          remaining,
          planned: running2?.plannedSeconds ?? DEFAULT_SECONDS,
          label: running2 ? running2.label : "准备开始",
          running: Boolean(running2)
        }
      ),
      running2 ? /* @__PURE__ */ jsx(Button, { color: "danger", fill: "outline", size: "large", onClick: /* @__PURE__ */ __name(() => {
        void stop();
      }, "onClick"), children: "停止" }) : /* @__PURE__ */ jsx(Space, { wrap: true, justify: "center", children: [5, 15, 25, 45].map((minutes) => /* @__PURE__ */ jsxs(
        Button,
        {
          color: minutes === 25 ? "primary" : "default",
          size: "large",
          onClick: /* @__PURE__ */ __name(() => {
            void start(minutes * 60);
          }, "onClick"),
          children: [
            minutes,
            " 分钟"
          ]
        },
        minutes
      )) }),
      !isAvailable("haptics") && /* @__PURE__ */ jsx("div", { className: "ax-muted", style: { fontSize: 12 }, children: "这台设备没有触觉反馈，计时结束只有视觉提示。" })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { marginTop: 24, paddingBottom: safeBottom + keyboard.height }, children: ready && /* @__PURE__ */ jsx(HistoryList, { sessions: history2, locale }) })
  ] });
}
__name(App, "App");
const root = document.getElementById("root");
if (root && root.children.length === 0) {
  createRoot(root).render(createElement(StrictMode, null, createElement(App)));
}
