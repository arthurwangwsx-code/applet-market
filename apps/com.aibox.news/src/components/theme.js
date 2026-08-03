// 设计令牌（对齐 AiBoxPluginUI/Theme.swift + NewsUI.brand）。
// 深浅色都要能看：默认跟随 prefers-color-scheme，宿主若给出有效方案则以 :root[data-theme] 覆盖。

export const THEME_CSS = `
:root {
  --news-brand: #E8552D;
  --news-ink: #1B1A16;
  --news-muted: #68665E;
  --news-line: rgba(0, 0, 0, 0.08);
  --news-line-strong: rgba(0, 0, 0, 0.14);
  --news-warning: #B56B00;
  --news-danger: #D93025;
  --news-orange: #E08A1E;
  --news-bg: #F2F2F7;
  --news-surface: #FFFFFF;
  --news-on-brand: #FFFFFF;
  --news-blur: rgba(255, 255, 255, 0.72);
}
@media (prefers-color-scheme: dark) {
  :root {
    --news-brand: #FF7A4D;
    --news-ink: #EDEBE3;
    --news-muted: #A6A498;
    --news-line: rgba(255, 255, 255, 0.14);
    --news-line-strong: rgba(255, 255, 255, 0.22);
    --news-warning: #F2A93B;
    --news-danger: #FF6B60;
    --news-orange: #F2A93B;
    --news-bg: #000000;
    --news-surface: #1C1C1E;
    --news-blur: rgba(28, 28, 30, 0.78);
  }
}
:root[data-theme="light"] {
  --news-brand: #E8552D; --news-ink: #1B1A16; --news-muted: #68665E;
  --news-line: rgba(0, 0, 0, 0.08); --news-line-strong: rgba(0, 0, 0, 0.14);
  --news-warning: #B56B00; --news-danger: #D93025; --news-orange: #E08A1E;
  --news-bg: #F2F2F7; --news-surface: #FFFFFF; --news-blur: rgba(255, 255, 255, 0.72);
}
:root[data-theme="dark"] {
  --news-brand: #FF7A4D; --news-ink: #EDEBE3; --news-muted: #A6A498;
  --news-line: rgba(255, 255, 255, 0.14); --news-line-strong: rgba(255, 255, 255, 0.22);
  --news-warning: #F2A93B; --news-danger: #FF6B60; --news-orange: #F2A93B;
  --news-bg: #000000; --news-surface: #1C1C1E; --news-blur: rgba(28, 28, 30, 0.78);
}

/* 用 height 而不是 min-height：中间那块要能被 flex 约束住才滚得动（min-height 下子块会撑高整页）。 */
.news-root {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--news-bg);
  color: var(--news-ink);
  font: 16px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  -webkit-text-size-adjust: 100%;
}
.news-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.news-mono { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.news-hairline { border-bottom: 0.5px solid var(--news-line); }
.news-press { -webkit-tap-highlight-color: transparent; user-select: none; }
.news-btn {
  appearance: none; border: 0; background: none; padding: 0; margin: 0;
  color: inherit; font: inherit; text-align: left; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.news-clamp-1 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden; }
.news-clamp-2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.news-clamp-3 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
.news-spin { animation: news-rotate 0.9s linear infinite; transform-origin: 50% 50%; }
@keyframes news-rotate { to { transform: rotate(360deg); } }
.news-chips::-webkit-scrollbar { display: none; }
/* 轨道自己也是 flex item（宿主是 display:flex）——必须显式 flex-shrink:0。
   只写 width:300% 会被 flex 的默认 flex-shrink:1 压回 100%，于是每屏只剩 1/3 屏宽，
   translate3d(-1/3) 之后当前页和下一页同屏并排出现（真机上表现为「两份状态条 + 两份空态」）。 */
.news-pager-track { display: flex; flex: 0 0 auto; width: 300%; min-height: 0; will-change: transform; }
/* 每一屏都是列向 flex：里面的 .news-scroll 才会被约束到分页器高度、自己滚动而不是撑破容器。
   宽度用 calc(100%/3) 而不是 33.3333%：轨道是 300%，三屏必须**精确**等于宿主宽度，
   否则每屏差 0.03% 会随页码累积成可见错位。 */
.news-pager-slot {
  width: calc(100% / 3);
  flex: 0 0 calc(100% / 3);
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* 面板 portal 到 body，不在 .news-root 里，故字体与前景色要自己带上。 */
.news-sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35);
  display: flex; align-items: flex-end; z-index: 40;
  color: var(--news-ink);
  font: 16px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
`

export const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32 }

export const FONT = {
  title: { fontSize: 17, fontWeight: 500 },
  body: { fontSize: 16 },
  subhead: { fontSize: 15 },
  caption: { fontSize: 13 },
  small: { fontSize: 12 },
}

export const C = {
  brand: 'var(--news-brand)',
  ink: 'var(--news-ink)',
  muted: 'var(--news-muted)',
  line: 'var(--news-line)',
  lineStrong: 'var(--news-line-strong)',
  warning: 'var(--news-warning)',
  danger: 'var(--news-danger)',
  orange: 'var(--news-orange)',
  bg: 'var(--news-bg)',
  surface: 'var(--news-surface)',
  onBrand: 'var(--news-on-brand)',
  blur: 'var(--news-blur)',
}
