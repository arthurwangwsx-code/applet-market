// 主题。跟随系统深浅色——小应用里**不要**强制配色：宿主页面是跟随系统的，
// 一个恒亮的小应用在暗色下会像一块打翻的灯箱。

export const C = {
  brand: '#FF0033', // YouTube 红
  brandDim: 'rgba(255,0,51,0.12)',
  bg: 'var(--yt-bg)',
  surface: 'var(--yt-surface)',
  text: 'var(--yt-text)',
  sub: 'var(--yt-sub)',
  faint: 'var(--yt-faint)',
  line: 'var(--yt-line)',
}

export const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24 }
export const RADIUS = { sm: 6, md: 10, lg: 14 }

export const THEME_CSS = `
:root {
  --yt-bg: #ffffff;
  --yt-surface: #f7f8fa;
  --yt-text: #18191c;
  --yt-sub: #61666d;
  --yt-faint: #9499a0;
  --yt-line: rgba(0,0,0,0.07);
}
:root[data-prefers-color-scheme="dark"] {
  --yt-bg: #17181a;
  --yt-surface: #1f2022;
  --yt-text: #e3e5e7;
  --yt-sub: #a2a7ae;
  --yt-faint: #757a80;
  --yt-line: rgba(255,255,255,0.08);
}
* { -webkit-tap-highlight-color: transparent; }
body {
  margin: 0;
  background: var(--yt-bg);
  color: var(--yt-text);
  font: 15px/1.45 -apple-system, "SF Pro Text", "PingFang SC", system-ui, sans-serif;
}
/* 长列表滚动容器：iOS 上不加这条，橡皮筋会把整页一起拖走 */
.yt-scroll { overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; }
.yt-press:active { opacity: 0.6; }
/* 标题两行截断 —— 视频标题长度差异极大，不截会把卡片高度撑得参差不齐 */
.yt-clamp2 {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; word-break: break-word;
}
`
