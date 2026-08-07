// 设计令牌（对齐 AiBoxPluginUI/Theme.swift + LedgerUI）。
//
// 记账没有自己的品牌色：`brand = AiBoxTheme.accent`（默认 jade #2A9D63 / #3BBD78）。
// 但**两个语义色写死、不跟主题**：
//   expenseColor #D9534F / #E0685F（支出/超支/危险）
//   incomeColor  #2A9D63 / #3BBD78（收入/结清/正向）
export const THEME_CSS = `
:root {
  --lg-brand: #2A9D63;
  --lg-expense: #D9534F;
  --lg-income: #2A9D63;
  --lg-info: #3A83D0;
  --lg-insight: #7C6BD0;
  --lg-ink: #1B1A16;
  --lg-muted: #68665E;
  --lg-line: rgba(0, 0, 0, 0.08);
  --lg-bg: #F2F2F7;
  --lg-surface: #FFFFFF;
  --lg-on-accent: #FFFFFF;
}
@media (prefers-color-scheme: dark) {
  :root {
    --lg-brand: #3BBD78;
    --lg-expense: #E0685F;
    --lg-income: #3BBD78;
    --lg-info: #4E88FF;
    --lg-insight: #9B7AFF;
    --lg-ink: #EDEBE3;
    --lg-muted: #A6A498;
    --lg-line: rgba(255, 255, 255, 0.14);
    --lg-bg: #000000;
    --lg-surface: #1C1C1E;
  }
}
:root[data-theme="light"] {
  --lg-brand: #2A9D63; --lg-expense: #D9534F; --lg-income: #2A9D63;
  --lg-info: #3A83D0; --lg-insight: #7C6BD0;
  --lg-ink: #1B1A16; --lg-muted: #68665E; --lg-line: rgba(0, 0, 0, 0.08);
  --lg-bg: #F2F2F7; --lg-surface: #FFFFFF;
}
:root[data-theme="dark"] {
  --lg-brand: #3BBD78; --lg-expense: #E0685F; --lg-income: #3BBD78;
  --lg-info: #4E88FF; --lg-insight: #9B7AFF;
  --lg-ink: #EDEBE3; --lg-muted: #A6A498; --lg-line: rgba(255, 255, 255, 0.14);
  --lg-bg: #000000; --lg-surface: #1C1C1E;
}

.lg-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--lg-bg);
  color: var(--lg-ink);
  font: 16px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  -webkit-text-size-adjust: 100%;
  overflow-x: hidden;
}
.lg-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
/* 所有金额文本都要等宽数字（对应原生的 monospacedDigit）。 */
.lg-mono { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.lg-btn {
  appearance: none; border: 0; background: none; padding: 0; margin: 0;
  color: inherit; font: inherit; text-align: left; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.lg-btn:disabled { cursor: default; }
.lg-clamp-1 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden; word-break: break-all; }
.lg-chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
.lg-chips::-webkit-scrollbar { display: none; }
.lg-spin { animation: lg-rotate 0.9s linear infinite; transform-origin: 50% 50%; }
@keyframes lg-rotate { to { transform: rotate(360deg); } }
.lg-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35);
  display: flex; align-items: flex-end; z-index: 50;
  animation: lg-fade 0.2s ease;
}
@keyframes lg-fade { from { opacity: 0 } to { opacity: 1 } }
.lg-sheet {
  width: 100%; background: var(--lg-bg); color: var(--lg-ink);
  border-radius: 16px 16px 0 0; display: flex; flex-direction: column;
  max-height: calc(100dvh - 40px); animation: lg-rise 0.24s cubic-bezier(0.2, 0.8, 0.3, 1);
}
@keyframes lg-rise { from { transform: translateY(24px) } to { transform: none } }
.lg-field {
  appearance: none; width: 100%; border: 0; background: transparent;
  color: var(--lg-ink); font: inherit; outline: none; padding: 0;
}
.lg-field::placeholder { color: var(--lg-muted); }
.lg-undo {
  position: fixed; left: 0; right: 0; z-index: 40;
  animation: lg-rise 0.2s ease;
}
`;
export const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32 };
export const RADIUS = { card: 16, bubble: 18, field: 14, pill: 999 };
export const FONT = {
    title: 17,
    body: 16,
    subhead: 15,
    caption: 13,
    small: 12,
};
export const C = {
    brand: 'var(--lg-brand)',
    expense: 'var(--lg-expense)',
    income: 'var(--lg-income)',
    info: 'var(--lg-info)',
    insight: 'var(--lg-insight)',
    ink: 'var(--lg-ink)',
    muted: 'var(--lg-muted)',
    line: 'var(--lg-line)',
    bg: 'var(--lg-bg)',
    surface: 'var(--lg-surface)',
    onAccent: 'var(--lg-on-accent)',
};
/** `#RRGGBB` + 透明度 → rgba()。用于「图标章底色 = 前景色 16%」这类令牌。 */
export function alpha(hex, opacity) {
    const raw = String(hex ?? '').replace('#', '');
    if (raw.length !== 6)
        return `rgba(0, 0, 0, ${opacity})`;
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
/** CSS 变量色的透明版本（color-mix 在 WKWebView/iOS 17 可用；不支持时回落原色）。 */
export function fade(cssColor, percent) {
    return `color-mix(in srgb, ${cssColor} ${percent}%, transparent)`;
}
