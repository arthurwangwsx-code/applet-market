// 设计令牌（对齐 AiBoxKit/AiBoxPluginUI/Theme.swift）。
// 间距 space1..6 = 4/8/12/16/20/24。深浅色都要能看。
//
// 关于 accent：原生音乐**没有自己的品牌色**，accent 一律跟随全局主题色；
// 小应用读不到宿主主题色，所以用模块入口的固定 tint `#FF6B6B / #FF8E8E`（launcher / 悬浮控制台
// 用的就是它），并在 README 里如实标注这是近似。
export const THEME_CSS = `
:root {
  --mu-accent: #FF6B6B;
  --mu-ink: #1B1A16;
  --mu-muted: #68665E;
  --mu-line: rgba(0, 0, 0, 0.08);
  --mu-line-strong: rgba(0, 0, 0, 0.14);
  --mu-warning: #B56B00;
  --mu-danger: #D92D20;
  --mu-bg: #F2F2F7;
  --mu-surface: #FFFFFF;
  --mu-glass: rgba(255, 255, 255, 0.74);
}
@media (prefers-color-scheme: dark) {
  :root {
    --mu-accent: #FF8E8E;
    --mu-ink: #EDEBE3;
    --mu-muted: #A6A498;
    --mu-line: rgba(255, 255, 255, 0.14);
    --mu-line-strong: rgba(255, 255, 255, 0.22);
    --mu-warning: #F2A93B;
    --mu-danger: #FF6B5F;
    --mu-bg: #000000;
    --mu-surface: #1C1C1E;
    --mu-glass: rgba(28, 28, 30, 0.78);
  }
}
:root[data-theme="light"] {
  --mu-accent: #FF6B6B; --mu-ink: #1B1A16; --mu-muted: #68665E;
  --mu-line: rgba(0, 0, 0, 0.08); --mu-line-strong: rgba(0, 0, 0, 0.14);
  --mu-warning: #B56B00; --mu-danger: #D92D20;
  --mu-bg: #F2F2F7; --mu-surface: #FFFFFF; --mu-glass: rgba(255, 255, 255, 0.74);
}
:root[data-theme="dark"] {
  --mu-accent: #FF8E8E; --mu-ink: #EDEBE3; --mu-muted: #A6A498;
  --mu-line: rgba(255, 255, 255, 0.14); --mu-line-strong: rgba(255, 255, 255, 0.22);
  --mu-warning: #F2A93B; --mu-danger: #FF6B5F;
  --mu-bg: #000000; --mu-surface: #1C1C1E; --mu-glass: rgba(28, 28, 30, 0.78);
}

.mu-root {
  position: relative;
  min-height: 100dvh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--mu-bg);
  color: var(--mu-ink);
  font: 16px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  -webkit-text-size-adjust: 100%;
  overflow: hidden;
}
.mu-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}
.mu-scroll::-webkit-scrollbar { display: none; }
.mu-mono { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.mu-press { -webkit-tap-highlight-color: transparent; user-select: none; }
.mu-btn {
  appearance: none; border: 0; background: none; padding: 0; margin: 0;
  color: inherit; font: inherit; text-align: left; cursor: pointer;
  -webkit-tap-highlight-color: transparent; user-select: none;
}
.mu-clamp-1 {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1;
  overflow: hidden; word-break: break-word;
}
.mu-clamp-2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.mu-spin { animation: mu-rotate 0.9s linear infinite; transform-origin: 50% 50%; }
@keyframes mu-rotate { to { transform: rotate(360deg); } }
.mu-hrow::-webkit-scrollbar { display: none; }
.mu-hrow { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }

/* Now Playing 的氛围底：五层叠加，铺满全屏（含安全区）。 */
.mu-ambient { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.mu-ambient > * { position: absolute; inset: 0; }
.mu-ambient-blur {
  /* 布局红线：.fill 的封面必须被有具体尺寸的容器裁住，否则会撑宽内容把两侧控件挤出屏幕。 */
  width: 100%; height: 100%; object-fit: cover; filter: blur(80px);
  opacity: 0.55; transform: scale(1.25);
}
.mu-fade-in { animation: mu-fade 0.2s ease-out; }
@keyframes mu-fade { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }

.mu-sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: flex-end; z-index: 60;
}
.mu-sheet {
  width: 100%; max-height: 86dvh; display: flex; flex-direction: column;
  background: var(--mu-bg); border-radius: 16px 16px 0 0; overflow: hidden;
  animation: mu-rise 0.24s cubic-bezier(0.2, 0.8, 0.3, 1);
}
@keyframes mu-rise { from { transform: translateY(14%); opacity: 0.6; } to { transform: none; opacity: 1; } }

input[type="range"].mu-slider {
  -webkit-appearance: none; appearance: none; width: 100%; height: 24px;
  background: transparent; margin: 0;
}
input[type="range"].mu-slider::-webkit-slider-runnable-track {
  height: 4px; border-radius: 2px; background: var(--mu-line-strong);
}
input[type="range"].mu-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 20px; height: 20px; margin-top: -8px;
  border-radius: 50%; background: #FFFFFF; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
`;
export const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24 };
export const C = {
    accent: 'var(--mu-accent)',
    ink: 'var(--mu-ink)',
    muted: 'var(--mu-muted)',
    line: 'var(--mu-line)',
    lineStrong: 'var(--mu-line-strong)',
    warning: 'var(--mu-warning)',
    danger: 'var(--mu-danger)',
    bg: 'var(--mu-bg)',
    surface: 'var(--mu-surface)',
    glass: 'var(--mu-glass)',
};
/** Now Playing 是强制白色高对比：显式白前景 + 白 tint，不依赖「深色模式」语义色。 */
export const WHITE = {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.72)',
    tertiary: 'rgba(255,255,255,0.45)',
    quaternary: 'rgba(255,255,255,0.28)',
};
