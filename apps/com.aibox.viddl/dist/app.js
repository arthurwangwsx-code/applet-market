var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
import React, { createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { jsxs, jsx, Fragment } from "react/jsx-runtime";
const THEME_CSS = `
:root {
  --vd-brand: #E64340;
  --vd-running: #E64340;
  --vd-done: #2A9D63;
  --vd-failed: #D9534F;
  --vd-ink: #1B1A16;
  --vd-muted: #68665E;
  --vd-line: rgba(0, 0, 0, 0.08);
  --vd-bg: #F2F2F7;
  --vd-surface: #FFFFFF;
  --vd-track: rgba(0, 0, 0, 0.08);
  --vd-on-accent: #FFFFFF;
}
@media (prefers-color-scheme: dark) {
  :root {
    --vd-brand: #FF6961;
    --vd-running: #FF6961;
    --vd-done: #3BBD78;
    --vd-failed: #E0685F;
    --vd-ink: #EDEBE3;
    --vd-muted: #A6A498;
    --vd-line: rgba(255, 255, 255, 0.14);
    --vd-bg: #000000;
    --vd-surface: #1C1C1E;
    --vd-track: rgba(255, 255, 255, 0.14);
  }
}
:root[data-theme="light"] {
  --vd-brand: #E64340; --vd-running: #E64340; --vd-done: #2A9D63; --vd-failed: #D9534F;
  --vd-ink: #1B1A16; --vd-muted: #68665E; --vd-line: rgba(0, 0, 0, 0.08);
  --vd-bg: #F2F2F7; --vd-surface: #FFFFFF; --vd-track: rgba(0, 0, 0, 0.08);
}
:root[data-theme="dark"] {
  --vd-brand: #FF6961; --vd-running: #FF6961; --vd-done: #3BBD78; --vd-failed: #E0685F;
  --vd-ink: #EDEBE3; --vd-muted: #A6A498; --vd-line: rgba(255, 255, 255, 0.14);
  --vd-bg: #000000; --vd-surface: #1C1C1E; --vd-track: rgba(255, 255, 255, 0.14);
}
body { margin: 0; background: var(--vd-bg); color: var(--vd-ink);
  font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased; }
button { font: inherit; color: inherit; }
input, textarea { font: inherit; color: inherit; }
`;
const C = {
  brand: "var(--vd-brand)",
  running: "var(--vd-running)",
  done: "var(--vd-done)",
  failed: "var(--vd-failed)",
  ink: "var(--vd-ink)",
  muted: "var(--vd-muted)",
  line: "var(--vd-line)",
  surface: "var(--vd-surface)",
  track: "var(--vd-track)",
  onAccent: "var(--vd-on-accent)"
};
const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24 };
const RADIUS = { card: 16, chip: 999, control: 10 };
function stateColor(state) {
  if (state === "completed") return C.done;
  if (state === "failed" || state === "cancelled") return C.failed;
  if (state === "paused") return C.muted;
  return C.running;
}
__name(stateColor, "stateColor");
function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
__name(formatBytes, "formatBytes");
function formatSpeed(bytesPerSecond) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "";
  return `${formatBytes(bytesPerSecond)}/s`;
}
__name(formatSpeed, "formatSpeed");
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
const F = { fill: "currentColor", stroke: "none" };
const I = {
  plus: ["M12 5.5v13M5.5 12h13"],
  xmark: ["M6.5 6.5l11 11M17.5 6.5l-11 11"],
  "chevron.right": ["M9.5 5.5L16 12l-6.5 6.5"],
  "chevron.down": ["M5.5 9.5L12 16l6.5-6.5"],
  pause: ["M9 5.5v13M15 5.5v13"],
  "pause.circle": ["M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M10 9v6M14 9v6"],
  play: [null, "M8 5.5v13l11-6.5z"],
  "play.circle": ["M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M10 8.5l6 3.5-6 3.5z"],
  trash: ["M5.5 7h13M9.5 7V5.2h5V7M7.2 7l.8 12.3h8l.8-12.3M10.4 10v6.4M13.6 10v6.4"],
  "arrow.down.circle": ["M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M12 7.6v8.2M8.6 12.4L12 15.8l3.4-3.4"],
  "arrow.down.circle.fill": [null, "M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4m.9 4.4v6.1l2.1-2.1 1.3 1.3L12 17l-4.3-4.5 1.3-1.3 2.1 2.1V7.2z"],
  "checkmark.circle": ["M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M8 12.3l2.7 2.7L16 9.6"],
  "checkmark.circle.fill": [null, "M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4m-1.4 13.4-3.4-3.4 1.3-1.3 2.1 2.1 5-5 1.3 1.3z"],
  "exclamationmark.triangle": ["M12 4.4l8 14.2H4zM12 9.6v4.2M12 16.4v.1"],
  "square.and.arrow.up": ["M12 4.4v10M8.6 7.8L12 4.4l3.4 3.4M6 12.4v6.2h12v-6.2"],
  "doc.text": ["M7 3.6h6.6L18 8v12.4H7zM13.4 3.6V8H18M9.6 12h6.4M9.6 15.2h6.4"],
  "arrow.clockwise": ["M19 12a7 7 0 1 1-2.1-5M19 4.6V9.4h-4.8"],
  "doc.on.clipboard": ["M9.4 4.6h5.2M8 6.2h8v13.2H8zM10.4 3.2h3.2v2.6h-3.2z"],
  externaldrive: ["M4.5 9.6h15v7.2h-15zM6.6 9.6l1.6-3.2h7.6l1.6 3.2M7.6 13.2h.1M10.4 13.2h.1"],
  icloud: ["M8 17.4a3.8 3.8 0 0 1-.3-7.6 4.8 4.8 0 0 1 9.1-1.2A3.6 3.6 0 0 1 16.6 17.4z"],
  folder: ["M4.4 7.2h5l1.6 2h8.6v9.4H4.4z"],
  lock: ["M8 10.4V8.2a4 4 0 0 1 8 0v2.2M6.4 10.4h11.2v9H6.4z"],
  "arrow.down.to.line": ["M12 4v10M8.2 10.2L12 14l3.8-3.8M6 19h12"],
  film: ["M4.6 5.4h14.8v13.2H4.6zM8.4 5.4v13.2M15.6 5.4v13.2M4.6 12h14.8"],
  "film.fill": [null, "M4.6 5.4h14.8v13.2H4.6zm2 2v2h2v-2zm9 0v2h2v-2zm-9 4.6v2h2v-2zm9 0v2h2v-2zm-9 4.6v2h2v-2zm9 0v2h2v-2z"],
  "play.rectangle": ["M3.8 6h16.4v12H3.8zM10.4 9.4l4.4 2.6-4.4 2.6z"],
  "waveform": ["M4 11v2M7.6 8.2v7.6M11.2 5.6v12.8M14.8 8.2v7.6M18.4 11v2"],
  "magnifyingglass": ["M11 4.4a6.6 6.6 0 1 1 0 13.2 6.6 6.6 0 0 1 0-13.2M15.8 15.8L20 20"],
  "square.and.arrow.down": ["M12 14.4V4.4M8.6 11l3.4 3.4L15.4 11M6 12.4v6.2h12v-6.2"],
  "exclamationmark.circle": ["M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M12 7.4v5.4M12 15.6v.1"],
  link: ["M10 14a4 4 0 0 1 0-5.6l2.4-2.4a4 4 0 1 1 5.6 5.6L16.8 12.8M14 10a4 4 0 0 1 0 5.6l-2.4 2.4a4 4 0 1 1-5.6-5.6l1.2-1.2"]
};
function Icon({ name, size = 20, color, style }) {
  const entry = I[name];
  const [stroke, fill] = entry || [null, "M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8"];
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      "aria-hidden": "true",
      style: { display: "block", color, flex: "0 0 auto", ...style },
      children: [
        stroke ? /* @__PURE__ */ jsx("path", { d: stroke, ...S }) : null,
        fill ? /* @__PURE__ */ jsx("path", { d: fill, ...F }) : null
      ]
    }
  );
}
__name(Icon, "Icon");
function Card({ children, padding = SPACE.s4, style }) {
  return /* @__PURE__ */ jsx("div", { style: {
    background: C.surface,
    borderRadius: RADIUS.card,
    border: `1px solid ${C.line}`,
    padding,
    overflow: "hidden",
    ...style
  }, children });
}
__name(Card, "Card");
function SectionHeader({ children, trailing }) {
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: SPACE.s2, padding: `0 4px ${SPACE.s2}px` }, children: [
    /* @__PURE__ */ jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }, children }),
    /* @__PURE__ */ jsx("div", { style: { flex: "1 1 auto" } }),
    trailing
  ] });
}
__name(SectionHeader, "SectionHeader");
function EmptyState({ icon, title, hint, action }) {
  return /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", padding: `${SPACE.s6 * 2}px ${SPACE.s5}px`, color: C.muted }, children: [
    /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", marginBottom: SPACE.s3, opacity: 0.55 }, children: /* @__PURE__ */ jsx(Icon, { name: icon, size: 44 }) }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: SPACE.s2 }, children: title }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: 14, lineHeight: 1.5, maxWidth: 300, margin: "0 auto" }, children: hint }),
    action ? /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s4 }, children: action }) : null
  ] });
}
__name(EmptyState, "EmptyState");
function Button({ children, onClick, kind = "plain", disabled, icon, block, style }) {
  const tone = {
    primary: { background: C.brand, color: C.onAccent, border: "none" },
    danger: { background: "transparent", color: C.failed, border: `1px solid ${C.line}` },
    plain: { background: "transparent", color: C.ink, border: `1px solid ${C.line}` }
  }[kind];
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      onClick,
      disabled,
      style: {
        display: block ? "flex" : "inline-flex",
        width: block ? "100%" : void 0,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minHeight: 40,
        padding: `0 ${SPACE.s4}px`,
        borderRadius: RADIUS.control,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "default" : "pointer",
        fontSize: 15,
        fontWeight: 500,
        ...tone,
        ...style
      },
      children: [
        icon ? /* @__PURE__ */ jsx(Icon, { name: icon, size: 17 }) : null,
        children
      ]
    }
  );
}
__name(Button, "Button");
function IconButton({ name, onClick, color, label }) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick,
      "aria-label": label,
      title: label,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 18,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: color || C.muted,
        padding: 0
      },
      children: /* @__PURE__ */ jsx(Icon, { name, size: 20 })
    }
  );
}
__name(IconButton, "IconButton");
function Chip({ children, active, onClick }) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick,
      style: {
        padding: "6px 14px",
        borderRadius: RADIUS.chip,
        border: `1px solid ${active ? "transparent" : C.line}`,
        background: active ? C.brand : "transparent",
        color: active ? C.onAccent : C.muted,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer"
      },
      children
    }
  );
}
__name(Chip, "Chip");
function ProgressBar({ fraction, color }) {
  const determinate = typeof fraction === "number" && Number.isFinite(fraction);
  return /* @__PURE__ */ jsx("div", { style: { height: 4, borderRadius: 2, background: C.track, overflow: "hidden" }, children: /* @__PURE__ */ jsx("div", { style: {
    height: "100%",
    width: determinate ? `${Math.max(0, Math.min(1, fraction)) * 100}%` : "35%",
    background: color || C.running,
    borderRadius: 2,
    transition: determinate ? "width 220ms linear" : "none",
    opacity: determinate ? 1 : 0.6
  } }) });
}
__name(ProgressBar, "ProgressBar");
function Sheet({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.42)",
        display: "flex",
        alignItems: "flex-end"
      },
      onClick: onClose,
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          onClick: /* @__PURE__ */ __name((e) => e.stopPropagation(), "onClick"),
          style: {
            width: "100%",
            maxHeight: "86vh",
            overflowY: "auto",
            background: C.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: `${SPACE.s4}px ${SPACE.s4}px calc(${SPACE.s5}px + env(safe-area-inset-bottom))`,
            boxShadow: "0 -8px 32px rgba(0,0,0,0.18)"
          },
          children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", marginBottom: SPACE.s3 }, children: [
              /* @__PURE__ */ jsx("span", { style: { fontSize: 17, fontWeight: 600 }, children: title }),
              /* @__PURE__ */ jsx("div", { style: { flex: "1 1 auto" } }),
              /* @__PURE__ */ jsx(IconButton, { name: "xmark", onClick: onClose, label: "关闭" })
            ] }),
            children,
            footer ? /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s4 }, children: footer }) : null
          ]
        }
      )
    }
  );
}
__name(Sheet, "Sheet");
function Notice({ text, tone = "info", onDismiss }) {
  if (!text) return null;
  const color = tone === "error" ? C.failed : tone === "success" ? C.done : C.brand;
  return /* @__PURE__ */ jsx(
    "div",
    {
      onClick: onDismiss,
      style: {
        margin: `0 ${SPACE.s4}px ${SPACE.s3}px`,
        padding: `${SPACE.s2}px ${SPACE.s3}px`,
        borderRadius: RADIUS.control,
        border: `1px solid ${color}`,
        color,
        fontSize: 13,
        cursor: "pointer"
      },
      children: text
    }
  );
}
__name(Notice, "Notice");
function firstURL(text) {
  const found = String(text || "").match(/https?:\/\/[^\s<>"')\]]+/);
  return found ? found[0].replace(/[.,;]+$/, "") : "";
}
__name(firstURL, "firstURL");
function protoBadge(proto) {
  const label = { direct: "直链", hls: "HLS", dash: "DASH" }[proto] || proto;
  return /* @__PURE__ */ jsx("span", { style: {
    fontSize: 11,
    padding: "1px 6px",
    borderRadius: 4,
    border: `1px solid ${C.line}`,
    color: C.muted
  }, children: label });
}
__name(protoBadge, "protoBadge");
function InspectSheet({ open, onClose, onInspect, onDownload, onPaste }) {
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [info, setInfo] = React.useState(null);
  const [formats, setFormats] = React.useState([]);
  const [chosen, setChosen] = React.useState(null);
  const [audioOnly, setAudioOnly] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    setUrl("");
    setInfo(null);
    setFormats([]);
    setChosen(null);
    setAudioOnly(false);
    setError("");
  }, [open]);
  const inspect = /* @__PURE__ */ __name(async () => {
    const target = firstURL(url);
    if (!target) {
      setError("没找到 http(s) 链接。");
      return;
    }
    setBusy(true);
    setError("");
    const result = await onInspect(target);
    setBusy(false);
    if (!result.ok) {
      setError(result.text || result.error || "解析失败。");
      return;
    }
    setInfo(result.video);
    setFormats(result.formats || []);
    setChosen(result.formats && result.formats[0] && result.formats[0].id || null);
    if (!result.formats || !result.formats.length) {
      setError("");
    }
  }, "inspect");
  const start = /* @__PURE__ */ __name(async () => {
    const target = firstURL(url);
    if (!target) return;
    setBusy(true);
    await onDownload({ url: target, formatId: chosen || void 0, audioOnly });
    setBusy(false);
    onClose();
  }, "start");
  return /* @__PURE__ */ jsxs(
    Sheet,
    {
      open,
      title: "添加视频",
      onClose,
      footer: info ? /* @__PURE__ */ jsx(Button, { kind: "primary", block: true, disabled: busy, onClick: start, icon: "arrow.down.to.line", children: audioOnly ? "只下音频" : "开始下载" }) : /* @__PURE__ */ jsx(Button, { kind: "primary", block: true, disabled: busy || !url.trim(), onClick: inspect, icon: "magnifyingglass", children: busy ? "解析中…" : "解析" }),
      children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            value: url,
            onChange: /* @__PURE__ */ __name((e) => {
              setUrl(e.target.value);
              setInfo(null);
              setFormats([]);
            }, "onChange"),
            placeholder: "粘贴视频页面或直链地址",
            style: {
              width: "100%",
              boxSizing: "border-box",
              padding: SPACE.s3,
              borderRadius: RADIUS.control,
              border: `1px solid ${C.line}`,
              background: "transparent",
              fontSize: 14
            }
          }
        ),
        onPaste ? /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s2 }, children: /* @__PURE__ */ jsx(
          Button,
          {
            icon: "doc.on.clipboard",
            onClick: /* @__PURE__ */ __name(async () => {
              const t = await onPaste();
              if (t) {
                setUrl(t);
                setInfo(null);
              }
            }, "onClick"),
            children: "从剪贴板粘贴"
          }
        ) }) : null,
        error ? /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s3, fontSize: 13, color: C.failed, lineHeight: 1.5 }, children: error }) : null,
        info ? /* @__PURE__ */ jsxs("div", { style: { marginTop: SPACE.s4 }, children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: SPACE.s3 }, children: [
            info.thumbnailURL ? /* @__PURE__ */ jsx(
              "img",
              {
                src: info.thumbnailURL,
                alt: "",
                style: { width: 96, height: 54, objectFit: "cover", borderRadius: 8, background: C.track }
              }
            ) : /* @__PURE__ */ jsx("div", { style: {
              width: 96,
              height: 54,
              borderRadius: 8,
              background: C.track,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.muted
            }, children: /* @__PURE__ */ jsx(Icon, { name: "film", size: 22 }) }),
            /* @__PURE__ */ jsxs("div", { style: { flex: "1 1 auto", minWidth: 0 }, children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 15, fontWeight: 600, lineHeight: 1.35 }, children: info.title }),
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12.5, color: C.muted, marginTop: 3 }, children: [info.uploader, info.durationText, info.extractor].filter(Boolean).join(" · ") })
            ] })
          ] }),
          formats.length ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s4, fontSize: 13, fontWeight: 600, color: C.muted }, children: "画质" }),
            /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: SPACE.s1, marginTop: SPACE.s2 }, children: formats.map((f) => /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: /* @__PURE__ */ __name(() => setChosen(f.id), "onClick"),
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: SPACE.s2,
                  textAlign: "left",
                  padding: `${SPACE.s2}px ${SPACE.s3}px`,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${chosen === f.id ? C.brand : C.line}`,
                  background: "transparent",
                  cursor: "pointer",
                  minHeight: 44
                },
                children: [
                  /* @__PURE__ */ jsxs("span", { style: { flex: "1 1 auto", minWidth: 0 }, children: [
                    /* @__PURE__ */ jsx("span", { style: { display: "block", fontSize: 14.5, fontWeight: 500 }, children: f.qualityLabel }),
                    /* @__PURE__ */ jsx("span", { style: { display: "block", fontSize: 12, color: C.muted }, children: [f.codecs, f.filesizeText, f.needsMerge ? "需合并音视频轨" : null].filter(Boolean).join(" · ") || f.container })
                  ] }),
                  protoBadge(f.proto),
                  chosen === f.id ? /* @__PURE__ */ jsx(Icon, { name: "checkmark.circle.fill", size: 18, color: C.brand }) : null
                ]
              },
              f.id
            )) })
          ] }) : /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s3, fontSize: 12.5, color: C.muted }, children: "这个来源没有给出可选画质，会按默认清晰度下载。" }),
          /* @__PURE__ */ jsxs("div", { style: { marginTop: SPACE.s4, display: "flex", gap: SPACE.s2, alignItems: "center" }, children: [
            /* @__PURE__ */ jsx(Chip, { active: !audioOnly, onClick: /* @__PURE__ */ __name(() => setAudioOnly(false), "onClick"), children: "视频" }),
            /* @__PURE__ */ jsx(Chip, { active: audioOnly, onClick: /* @__PURE__ */ __name(() => setAudioOnly(true), "onClick"), children: "只要音频" })
          ] }),
          audioOnly ? /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s2, fontSize: 12, color: C.muted, lineHeight: 1.5 }, children: "DASH 来源会直接跳过视频轨（很快）；直链与 HLS 需要先下完整流再抽音频。" }) : null,
          info.subtitles && info.subtitles.length ? /* @__PURE__ */ jsxs("div", { style: { marginTop: SPACE.s2, fontSize: 12, color: C.muted }, children: [
            "字幕：",
            info.subtitles.join("、")
          ] }) : null
        ] }) : null
      ]
    }
  );
}
__name(InspectSheet, "InspectSheet");
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
__name(on, "on");
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
__name(shellOn, "shellOn");
async function readClipboard$1() {
  const host = bridge();
  if (!host?.clipboard?.read)
    return "";
  try {
    return await host.clipboard.read();
  } catch {
    return "";
  }
}
__name(readClipboard$1, "readClipboard$1");
async function callTool$1(name, args = {}) {
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
__name(callTool$1, "callTool$1");
function parseJobLines(text) {
  if (!text || typeof text !== "string") return [];
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const anchor = line.match(/\[job:\s*([^\]]+)\]\s*$/);
    if (!anchor) continue;
    const body = line.slice(0, anchor.index).replace(/^[•\-\s]+/, "").trim();
    const dash = body.indexOf(" — ");
    const title = (dash >= 0 ? body.slice(0, dash) : body).trim();
    const tail = dash >= 0 ? body.slice(dash + 3) : "";
    const segments = tail.split("·").map((s) => s.trim());
    const stateSegment = segments[0] || "";
    const state = (stateSegment.split(/[\s→]/)[0] || "").trim();
    const percent = tail.match(/(\d{1,3})%/);
    const output = tail.match(/→\s*([^·]+)/);
    const source = tail.match(/source:\s*([^·]+)/);
    out.push({
      jobId: anchor[1].trim(),
      state: state || "unknown",
      fraction: percent ? Number(percent[1]) / 100 : void 0,
      title: title || anchor[1].trim(),
      outputName: output ? output[1].trim() : void 0,
      source: source ? source[1].trim() : void 0
    });
  }
  return out;
}
__name(parseJobLines, "parseJobLines");
const capabilities = {
  get download() {
    return available("download", "list");
  },
  get clipboard() {
    return available("clipboard", "read");
  },
  get haptics() {
    return available("haptics", "impact");
  }
};
async function toolBlockReason(name) {
  const api = bridge();
  if (!api || !api.access || typeof api.access.explain !== "function") {
    return { ok: false, reason: "unknown", hint: "这个宿主没有工具网关。" };
  }
  try {
    const verdict = await api.access.explain({ tool: name });
    if (verdict && verdict.allowed) return { ok: true, reason: null, hint: "" };
    const failed = (verdict && verdict.gates ? verdict.gates : []).filter((g) => !g.passed).map((g) => g.name);
    if (failed.includes("active")) {
      const grantPath = failed.includes("localGrant") ? "另外也还没授权给这个小应用：点右上角「⋯」→「应用详情」→「能力」，在宿主工具那一段把 viddl 系列打开。" : "";
      return {
        ok: false,
        reason: "not-active",
        hint: `视频解析工具当前没有启用——可能是宿主的工具开关里关着，也可能是这个构建没装视频下载模块。${grantPath}`
      };
    }
    if (failed.includes("localGrant")) {
      return { ok: false, reason: "not-granted", hint: "还没有把视频解析工具授权给这个小应用。点右上角「⋯」→「应用详情」→「能力」，在宿主工具那一段把 viddl 系列打开就能用了。" };
    }
    if (failed.includes("declared") || failed.includes("requirement")) {
      return { ok: false, reason: "not-declared", hint: "这个版本的小应用没有声明要用视频解析工具，请更新到新版本。" };
    }
    if (failed.includes("bridgeable") || failed.includes("hostPolicy")) {
      return { ok: false, reason: "blocked", hint: "当前宿主策略不允许小应用调用视频解析工具。" };
    }
    return { ok: false, reason: "unknown", hint: verdict && verdict.remedies && verdict.remedies[0] || "视频解析工具当前不可用。" };
  } catch (error) {
    return { ok: false, reason: "unknown", hint: "视频解析工具当前不可用。" };
  }
}
__name(toolBlockReason, "toolBlockReason");
async function callTool(name, args) {
  const result = await callTool$1(name, args || {});
  return result.ok ? result : { ok: false, error: result.text, text: result.text };
}
__name(callTool, "callTool");
const queue = {
  /** 视频轨道与 HLS 离线包都在这里。 */
  async list() {
    const api = bridge();
    if (!capabilities.download) return [];
    try {
      const items = await api.download.list({});
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  },
  async subscribe() {
    const api = bridge();
    if (!capabilities.download) return false;
    try {
      await api.download.subscribe({});
      return true;
    } catch {
      return false;
    }
  },
  async unsubscribe() {
    const api = bridge();
    if (!capabilities.download) return false;
    try {
      await api.download.unsubscribe({});
      return true;
    } catch {
      return false;
    }
  }
};
const onEvent = on;
const onNamespaceEvent = shellOn;
const readClipboard = readClipboard$1;
function tap(style) {
  const api = bridge();
  if (!capabilities.haptics) return;
  try {
    api.haptics.impact({ style: style || "light" });
  } catch {
  }
}
__name(tap, "tap");
const uiHooks = { refresh: null };
function extractJobId(text) {
  if (!text) return void 0;
  const anchored = String(text).match(/\[job:\s*([^\]]+)\]/);
  if (anchored) return anchored[1].trim();
  const labelled = String(text).match(/\bjobId[:\s]+([0-9a-fA-F-]{8,})/);
  return labelled ? labelled[1] : void 0;
}
__name(extractJobId, "extractJobId");
async function inspectVideo({ url }) {
  if (!url) return { ok: false, error: "url is required", text: "需要一个视频页面或直链地址。" };
  const result = await callTool("viddl_inspect", { url });
  if (!result.ok) {
    return { ok: false, error: result.error || result.text, text: result.text || "解析失败。" };
  }
  const details = result.details && result.details.type === "video_inspect" ? result.details : null;
  return {
    ok: true,
    video: details ? {
      title: details.title,
      uploader: details.uploader,
      durationText: details.durationText,
      thumbnailURL: details.thumbnailURL,
      extractor: details.extractor,
      subtitles: details.subtitles || []
    } : null,
    formats: details ? details.formats || [] : [],
    text: result.text
  };
}
__name(inspectVideo, "inspectVideo");
async function fetchVideo({ url, formatId, audioOnly }) {
  if (!url) return { ok: false, error: "url is required", text: "需要一个视频页面或直链地址。" };
  const args = { url };
  if (formatId) args.formatId = formatId;
  if (audioOnly) args.audio_only = true;
  const result = await callTool("viddl_download", args);
  if (uiHooks.refresh) uiHooks.refresh();
  if (!result.ok) {
    return { ok: false, error: result.error || result.text, text: result.text || "下载启动失败。" };
  }
  return {
    ok: true,
    jobId: extractJobId(result.text),
    text: result.text || "已开始下载。视频较大，可在资料库里查看进度。"
  };
}
__name(fetchVideo, "fetchVideo");
let libraryDenied = false;
function isLibraryDenied() {
  return libraryDenied;
}
__name(isLibraryDenied, "isLibraryDenied");
let preflight = null;
async function libraryAllowed() {
  preflight ??= toolBlockReason("viddl_jobs").then((verdict) => {
    if (!verdict.ok) libraryDenied = true;
    return verdict;
  }).catch(() => ({ ok: true }));
  return preflight;
}
__name(libraryAllowed, "libraryAllowed");
async function libraryAction({ action, jobId } = {}) {
  const verb = action || "list";
  if (libraryDenied) {
    return { ok: false, action: verb, denied: true, jobs: [], text: "视频下载工具未授权。" };
  }
  const verdict = await libraryAllowed();
  if (!verdict.ok) {
    return { ok: false, action: verb, denied: true, jobs: [], text: verdict.hint || "视频下载工具未授权。" };
  }
  const args = { action: verb };
  if (jobId) args.jobId = jobId;
  const result = await callTool("viddl_jobs", args);
  if (uiHooks.refresh) uiHooks.refresh();
  if (!result.ok) {
    const message = String(result.error || result.text || "");
    if (message.includes("aibox/denied") || message.includes("not granted")) libraryDenied = true;
    return { ok: false, action: verb, denied: libraryDenied, error: result.error || result.text, jobs: [], text: result.text || "操作失败。" };
  }
  return { ok: true, action: verb, jobs: parseJobLines(result.text), text: result.text };
}
__name(libraryAction, "libraryAction");
function registerActions() {
  const api = typeof window !== "undefined" ? window.aibox : void 0;
  if (!api || !api.action || typeof api.action.register !== "function") return;
  api.action.register("inspect", inspectVideo);
  api.action.register("fetch", fetchVideo);
  api.action.register("library", libraryAction);
}
__name(registerActions, "registerActions");
registerActions();
const TABS = [
  { id: "library", title: "资料库", icon: "film", selectedIcon: "film.fill" },
  { id: "downloading", title: "下载中", icon: "arrow.down.circle", selectedIcon: "arrow.down.circle.fill" }
];
const DONE_STATES = ["completed"];
const FAIL_STATES = ["failed", "cancelled"];
function useThemeSetup() {
  React.useEffect(() => {
    if (document.getElementById("__vd_css__")) return;
    const style = document.createElement("style");
    style.id = "__vd_css__";
    style.textContent = THEME_CSS;
    document.head.appendChild(style);
  }, []);
}
__name(useThemeSetup, "useThemeSetup");
function useJobs() {
  const [jobs, setJobs] = React.useState([]);
  const [bytes, setBytes] = React.useState({});
  const [loaded, setLoaded] = React.useState(false);
  const [denied, setDenied] = React.useState(false);
  const refresh = React.useCallback(async () => {
    const result = await libraryAction({ action: "list" });
    setJobs(result.jobs || []);
    setLoaded(true);
    if (result.denied) setDenied(true);
  }, []);
  React.useCallback(async (job) => {
    const api = typeof window !== "undefined" ? window.aibox : void 0;
    const ref = (bytes[job.jobId] || {}).artifactRef;
    if (api && api.video && ref) {
      try {
        try {
          await api.video.stage({ aspect: "16:9", backgroundAudio: true, pictureInPicture: true });
        } catch (_) {
        }
        const result = await api.video.play({ artifactRef: ref, title: job.title });
        if (result && result.playing) return;
      } catch (error) {
      }
    }
    await act("play", job.jobId);
  }, [bytes]);
  const refreshBytes = React.useCallback(async () => {
    const items = await queue.list();
    const map = {};
    for (const item of items) {
      const key = item.groupId || item.taskId;
      const row = map[key] || { received: 0, total: 0, speed: 0, known: true, artifactRef: null };
      if (!row.artifactRef && item.state === "completed" && item.artifactRef) row.artifactRef = item.artifactRef;
      row.received += item.bytesReceived || 0;
      if (item.totalBytes) row.total += item.totalBytes;
      else row.known = false;
      row.speed += item.speed || 0;
      map[key] = row;
    }
    setBytes(map);
  }, []);
  React.useEffect(() => {
    let alive = true;
    let poll = null;
    let off = null;
    const boot = /* @__PURE__ */ __name(async () => {
      await refresh();
      await refreshBytes();
      const pushed = await queue.subscribe();
      if (!alive) return;
      off = onEvent("download.progress", () => {
        refreshBytes();
      });
      poll = setInterval(() => {
        if (isLibraryDenied()) {
          clearInterval(poll);
          poll = null;
          return;
        }
        refresh();
        if (!pushed) refreshBytes();
      }, pushed ? 2500 : 1200);
    }, "boot");
    boot();
    return () => {
      alive = false;
      if (poll) clearInterval(poll);
      if (off) off();
      queue.unsubscribe();
    };
  }, [refresh, refreshBytes]);
  return { jobs, bytes, loaded, refresh, denied };
}
__name(useJobs, "useJobs");
function JobRow({ job, detail, onPause, onResume, onCancel, onRetry, onPlay, onExport }) {
  const done = DONE_STATES.includes(job.state);
  const failed = FAIL_STATES.includes(job.state);
  const active = !done && !failed;
  const color = stateColor(job.state === "downloading" || job.state === "processing" ? "running" : done ? "completed" : failed ? "failed" : job.state);
  const parts = [];
  if (detail && detail.received) {
    parts.push(detail.known && detail.total ? `${formatBytes(detail.received)} / ${formatBytes(detail.total)}` : formatBytes(detail.received));
  }
  if (active && detail && detail.speed) parts.push(formatSpeed(detail.speed));
  if (job.source) parts.push(job.source);
  if (failed) parts.push(job.state === "cancelled" ? "已取消" : "失败");
  if (done && job.outputName) parts.push(job.outputName);
  return /* @__PURE__ */ jsxs("div", { "data-row-id": job.jobId, style: { padding: `${SPACE.s3}px ${SPACE.s4}px` }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: SPACE.s3 }, children: [
      /* @__PURE__ */ jsx("div", { style: {
        // `flex: '0 0 44px'` 不能省：只写 width 的话，flex 容器在标题长的行里会把它**压窄**，
        // 于是每行的图标宽度和标题起点都不一样——真机上就是一列参差不齐的行（2026-08-05 实测）。
        flex: "0 0 44px",
        width: 44,
        height: 44,
        borderRadius: 8,
        background: C.track,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color
      }, children: /* @__PURE__ */ jsx(Icon, { name: done ? "play.rectangle" : failed ? "exclamationmark.circle" : "arrow.down.circle", size: 20 }) }),
      /* @__PURE__ */ jsxs("div", { style: { flex: "1 1 auto", minWidth: 0 }, children: [
        /* @__PURE__ */ jsx("div", { style: {
          fontSize: 15,
          fontWeight: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }, children: job.title }),
        /* @__PURE__ */ jsx("div", { style: {
          fontSize: 12.5,
          color: failed ? C.failed : C.muted,
          marginTop: 2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }, children: parts.join(" · ") || job.state })
      ] }),
      active && typeof job.fraction === "number" ? /* @__PURE__ */ jsxs("span", { style: { flexShrink: 0, fontSize: 12.5, color: C.muted, fontVariantNumeric: "tabular-nums" }, children: [
        Math.round(job.fraction * 100),
        "%"
      ] }) : null,
      job.state === "downloading" ? /* @__PURE__ */ jsx(IconButton, { name: "pause", onClick: /* @__PURE__ */ __name(() => onPause(job), "onClick"), label: "暂停" }) : null,
      job.state === "paused" ? /* @__PURE__ */ jsx(IconButton, { name: "play", onClick: /* @__PURE__ */ __name(() => onResume(job), "onClick"), label: "继续" }) : null,
      active ? /* @__PURE__ */ jsx(IconButton, { name: "xmark", onClick: /* @__PURE__ */ __name(() => onCancel(job), "onClick"), label: "取消" }) : null,
      failed ? /* @__PURE__ */ jsx(IconButton, { name: "arrow.clockwise", onClick: /* @__PURE__ */ __name(() => onRetry(job), "onClick"), label: "重试" }) : null,
      done ? /* @__PURE__ */ jsx(IconButton, { name: "play", onClick: /* @__PURE__ */ __name(() => onPlay(job), "onClick"), label: "播放" }) : null,
      done && job.outputName && /\.movpkg$/i.test(job.outputName) ? /* @__PURE__ */ jsx(IconButton, { name: "square.and.arrow.down", onClick: /* @__PURE__ */ __name(() => onExport(job), "onClick"), label: "导出 mp4" }) : null
    ] }),
    active ? /* @__PURE__ */ jsx("div", { style: { marginTop: SPACE.s2, marginLeft: 44 + SPACE.s3 }, children: /* @__PURE__ */ jsx(ProgressBar, { fraction: job.fraction, color }) }) : null
  ] });
}
__name(JobRow, "JobRow");
function App() {
  useThemeSetup();
  const [tab, setTab] = React.useState("library");
  const [shell, setShell] = React.useState({ tabsRendered: false, toolbarRendered: false });
  const [adding, setAdding] = React.useState(false);
  const [notice, setNotice] = React.useState(null);
  const [extractorReady, setExtractorReady] = React.useState(true);
  const [blockHint, setBlockHint] = React.useState("");
  const { jobs, bytes, loaded, refresh, denied } = useJobs();
  React.useEffect(() => {
    toolBlockReason("viddl_inspect").then((verdict) => {
      setExtractorReady(verdict.ok);
      setBlockHint(verdict.ok ? "" : verdict.hint);
    });
  }, []);
  React.useEffect(() => {
    if (denied) setExtractorReady(false);
  }, [denied]);
  React.useEffect(() => {
    uiHooks.refresh = refresh;
    return () => {
      uiHooks.refresh = null;
    };
  }, [refresh]);
  const done = jobs.filter((j) => DONE_STATES.includes(j.state));
  const running = jobs.filter((j) => !DONE_STATES.includes(j.state));
  const visible = tab === "library" ? done : running;
  const act2 = React.useCallback(async (action, jobId) => {
    tap("light");
    const result = await libraryAction({ action, jobId });
    if (!result.ok) setNotice({ tone: "error", text: result.text || "操作失败" });
    await refresh();
  }, [refresh]);
  const startDownload = React.useCallback(async (request) => {
    const result = await fetchVideo(request);
    setNotice(result.ok ? { tone: "success", text: result.text } : { tone: "error", text: result.text });
    if (result.ok) {
      tap("medium");
      setTab("downloading");
    }
    await refresh();
  }, [refresh]);
  const addRef = React.useRef(null);
  addRef.current = () => setAdding(true);
  React.useEffect(() => {
    let cancelled = false;
    const offs = [];
    const wire = /* @__PURE__ */ __name(async () => {
      const api = window.aibox;
      if (api && api.tabs && typeof api.tabs.getState === "function") {
        try {
          const state = await api.tabs.getState();
          if (!cancelled && state && state.rendered) {
            setShell((c) => ({ ...c, tabsRendered: true }));
            if (state.selected) setTab(state.selected);
          }
        } catch (error) {
        }
        offs.push(onNamespaceEvent("tabs", "changed", (state) => {
          if (!state) return;
          const rendered = state.rendered !== false;
          setShell((c) => c.tabsRendered === rendered ? c : { ...c, tabsRendered: rendered });
          if (state.selected) setTab(state.selected);
        }));
      }
      if (api && api.toolbar && typeof api.toolbar.getState === "function") {
        try {
          const state = await api.toolbar.getState();
          if (!cancelled && state) setShell((c) => ({ ...c, toolbarRendered: state.rendered !== false }));
        } catch (error) {
        }
        offs.push(onNamespaceEvent("toolbar", "invoke", (payload) => {
          if (payload && payload.id === "add" && addRef.current) addRef.current();
        }));
      }
      offs.push(onEvent("lifecycle.foreground", () => {
        refresh();
      }));
    }, "wire");
    wire();
    return () => {
      cancelled = true;
      offs.forEach((off) => off && off());
    };
  }, [refresh]);
  const runningCount = running.length;
  React.useEffect(() => {
    const api = window.aibox;
    const title = tab === "library" ? "资料库" : "下载中";
    document.title = title;
    if (api && api.navigation && typeof api.navigation.setTitle === "function") {
      api.navigation.setTitle(title).catch(() => {
      });
    }
    if (shell.toolbarRendered && api && api.toolbar && typeof api.toolbar.update === "function") {
      api.toolbar.update({ items: { add: { hidden: !extractorReady } } }).catch(() => {
      });
    }
    if (shell.tabsRendered && api && api.tabs && typeof api.tabs.update === "function") {
      api.tabs.update({
        items: { downloading: { badge: runningCount ? String(runningCount) : null } }
      }).catch(() => {
      });
    }
  }, [tab, runningCount, extractorReady, shell.tabsRendered, shell.toolbarRendered]);
  return /* @__PURE__ */ jsxs("div", { style: { minHeight: "100vh", paddingBottom: shell.tabsRendered ? 0 : 76 }, children: [
    !shell.toolbarRendered ? /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: SPACE.s2,
      padding: `calc(${SPACE.s3}px + env(safe-area-inset-top)) ${SPACE.s4}px ${SPACE.s3}px`
    }, children: [
      /* @__PURE__ */ jsx("span", { style: { fontSize: 22, fontWeight: 700 }, children: tab === "library" ? "资料库" : "下载中" }),
      /* @__PURE__ */ jsx("div", { style: { flex: "1 1 auto" } }),
      extractorReady ? /* @__PURE__ */ jsx(Button, { kind: "primary", icon: "plus", onClick: /* @__PURE__ */ __name(() => setAdding(true), "onClick"), children: "添加" }) : null
    ] }) : null,
    /* @__PURE__ */ jsx(Notice, { text: notice && notice.text, tone: notice && notice.tone, onDismiss: /* @__PURE__ */ __name(() => setNotice(null), "onDismiss") }),
    !extractorReady ? /* @__PURE__ */ jsx("div", { style: { padding: `0 ${SPACE.s4}px` }, children: /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: "exclamationmark.circle",
        title: "解析能力不可用",
        hint: blockHint || "视频解析工具当前不可用。"
      }
    ) }) : null,
    /* @__PURE__ */ jsx("div", { style: { padding: `0 ${SPACE.s4}px ${SPACE.s5}px` }, children: !loaded ? null : visible.length === 0 ? extractorReady ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: tab === "library" ? "film" : "arrow.down.circle",
        title: tab === "library" ? "资料库还是空的" : "没有进行中的下载",
        hint: tab === "library" ? "粘贴一个视频页面地址，先看清有哪些画质，再决定下哪一个。" : "下载在后台继续，退出这个小应用也不会中断。",
        action: tab === "library" ? /* @__PURE__ */ jsx(Button, { kind: "primary", icon: "plus", onClick: /* @__PURE__ */ __name(() => setAdding(true), "onClick"), children: "添加视频" }) : null
      }
    ) : null : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs(SectionHeader, { children: [
        visible.length,
        " 项"
      ] }),
      /* @__PURE__ */ jsx(Card, { padding: 0, children: visible.map((job, index) => /* @__PURE__ */ jsx("div", { style: index ? { borderTop: `1px solid ${C.line}` } : void 0, children: /* @__PURE__ */ jsx(
        JobRow,
        {
          job,
          detail: bytes[job.jobId],
          onPause: /* @__PURE__ */ __name((j) => act2("pause", j.jobId), "onPause"),
          onResume: /* @__PURE__ */ __name((j) => act2("resume", j.jobId), "onResume"),
          onCancel: /* @__PURE__ */ __name((j) => act2("cancel", j.jobId), "onCancel"),
          onRetry: /* @__PURE__ */ __name((j) => act2("retry", j.jobId), "onRetry"),
          onPlay: /* @__PURE__ */ __name((j) => playJob(j), "onPlay"),
          onExport: /* @__PURE__ */ __name((j) => act2("export", j.jobId), "onExport")
        }
      ) }, job.jobId)) })
    ] }) }),
    !shell.tabsRendered ? /* @__PURE__ */ jsx("div", { style: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 40,
      display: "flex",
      borderTop: `1px solid ${C.line}`,
      background: C.surface,
      paddingBottom: "env(safe-area-inset-bottom)"
    }, children: TABS.map((row) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: /* @__PURE__ */ __name(() => {
          setTab(row.id);
          tap("light");
        }, "onClick"),
        style: {
          flex: "1 1 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "8px 0 6px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: tab === row.id ? C.brand : C.muted
        },
        children: [
          /* @__PURE__ */ jsx(Icon, { name: tab === row.id ? row.selectedIcon : row.icon, size: 22 }),
          /* @__PURE__ */ jsx("span", { style: { fontSize: 11 }, children: row.title })
        ]
      },
      row.id
    )) }) : null,
    /* @__PURE__ */ jsx(
      InspectSheet,
      {
        open: adding,
        onClose: /* @__PURE__ */ __name(() => setAdding(false), "onClose"),
        onInspect: /* @__PURE__ */ __name((url) => inspectVideo({ url }), "onInspect"),
        onDownload: startDownload,
        onPaste: capabilities.clipboard ? readClipboard : null
      }
    )
  ] });
}
__name(App, "App");
const root = document.getElementById("root");
if (root && root.children.length === 0) {
  createRoot(root).render(createElement(StrictMode, null, createElement(App)));
}
