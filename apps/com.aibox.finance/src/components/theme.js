// 设计令牌（对齐 AiBoxPluginUI/Theme.swift + FinanceUI.brand，规格开头的令牌表）。
// 间距 4/8/12/16/20/24；圆角 卡 16 / 输入 14 / 胶囊 999；
// 字号 title 17medium / body 16 / subhead 15 / caption 13 / small 12。
//
// **理财品牌色 brand = #E64340 / #FF5B57（= 涨红）**。底栏与顶栏按钮用全局 accent，**不**用 brand。

export const THEME_CSS = `
:root {
  --fin-brand: #E64340;
  --fin-ink: #1B1A16;
  --fin-muted: #68665E;
  --fin-line: rgba(0, 0, 0, 0.08);
  --fin-warning: #B56B00;
  --fin-danger: #D92D20;
  --fin-red: #E64340;
  --fin-green: #0FA968;
  --fin-amber: #D48F20;
  --fin-blue: #2F6BFF;
  --fin-bg: #F2F2F7;
  --fin-surface: #FFFFFF;
  --fin-on-accent: #FFFFFF;
  --fin-blur: rgba(255, 255, 255, 0.72);
}
@media (prefers-color-scheme: dark) {
  :root {
    --fin-brand: #FF5B57;
    --fin-ink: #EDEBE3;
    --fin-muted: #A6A498;
    --fin-line: rgba(255, 255, 255, 0.14);
    --fin-warning: #F2A93B;
    --fin-danger: #FF6B5F;
    --fin-red: #FF5B57;
    --fin-green: #30D158;
    --fin-amber: #E5A73D;
    --fin-blue: #4E84FF;
    --fin-bg: #000000;
    --fin-surface: #1C1C1E;
    --fin-blur: rgba(28, 28, 30, 0.78);
  }
}
:root[data-theme="light"] {
  --fin-brand: #E64340; --fin-ink: #1B1A16; --fin-muted: #68665E;
  --fin-line: rgba(0, 0, 0, 0.08); --fin-warning: #B56B00; --fin-danger: #D92D20;
  --fin-red: #E64340; --fin-green: #0FA968; --fin-amber: #D48F20; --fin-blue: #2F6BFF;
  --fin-bg: #F2F2F7; --fin-surface: #FFFFFF; --fin-blur: rgba(255, 255, 255, 0.72);
}
:root[data-theme="dark"] {
  --fin-brand: #FF5B57; --fin-ink: #EDEBE3; --fin-muted: #A6A498;
  --fin-line: rgba(255, 255, 255, 0.14); --fin-warning: #F2A93B; --fin-danger: #FF6B5F;
  --fin-red: #FF5B57; --fin-green: #30D158; --fin-amber: #E5A73D; --fin-blue: #4E84FF;
  --fin-bg: #000000; --fin-surface: #1C1C1E; --fin-blur: rgba(28, 28, 30, 0.78);
}

.fin-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--fin-bg);
  color: var(--fin-ink);
  font: 16px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  -webkit-text-size-adjust: 100%;
  overflow-x: hidden;
}
.fin-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
/* 等宽数字：漏了这条，价格列会跳动，一眼就是网页。 */
.fin-mono { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.fin-press { -webkit-tap-highlight-color: transparent; user-select: none; }
.fin-btn {
  appearance: none; border: 0; background: none; padding: 0; margin: 0;
  color: inherit; font: inherit; text-align: left; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.fin-clamp-1 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden; }
.fin-clamp-2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.fin-spin { animation: fin-rotate 0.9s linear infinite; transform-origin: 50% 50%; }
@keyframes fin-rotate { to { transform: rotate(360deg); } }
.fin-hscroll { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
.fin-hscroll::-webkit-scrollbar { display: none; }
.fin-sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35);
  display: flex; align-items: flex-end; z-index: 40;
}
.fin-field {
  appearance: none; width: 100%; border: 0; background: transparent;
  color: var(--fin-ink); font: 16px/1.3 inherit; padding: 0; outline: none;
  font-variant-numeric: tabular-nums;
}
.fin-field::placeholder { color: var(--fin-muted); }
`

export const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24 }

export const RADIUS = { card: 16, field: 14, pill: 999 }

export const FONT = {
  title: { fontSize: 17, fontWeight: 500 },
  body: { fontSize: 16 },
  subhead: { fontSize: 15 },
  caption: { fontSize: 13 },
  small: { fontSize: 12 },
}

export const C = {
  brand: 'var(--fin-brand)',
  ink: 'var(--fin-ink)',
  muted: 'var(--fin-muted)',
  line: 'var(--fin-line)',
  warning: 'var(--fin-warning)',
  danger: 'var(--fin-danger)',
  red: 'var(--fin-red)',
  green: 'var(--fin-green)',
  amber: 'var(--fin-amber)',
  blue: 'var(--fin-blue)',
  bg: 'var(--fin-bg)',
  surface: 'var(--fin-surface)',
  onAccent: 'var(--fin-on-accent)',
  blur: 'var(--fin-blur)',
}
