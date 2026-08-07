// 主题。跟随系统深浅色——小应用里**不要**强制配色：宿主页面是跟随系统的，
// 一个恒亮的小应用在暗色下会像一块打翻的灯箱。

export const C = {
  brand: '#FB7299', // B 站粉
  brandDim: 'rgba(251,114,153,0.12)',
  bg: 'var(--bl-bg)',
  surface: 'var(--bl-surface)',
  text: 'var(--bl-text)',
  sub: 'var(--bl-sub)',
  faint: 'var(--bl-faint)',
  line: 'var(--bl-line)',
}

export const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24 }
export const RADIUS = { sm: 6, md: 10, lg: 14 }

export const THEME_CSS = `
:root {
  --bl-bg: #ffffff;
  --bl-surface: #f7f8fa;
  --bl-text: #18191c;
  --bl-sub: #61666d;
  --bl-faint: #9499a0;
  --bl-line: rgba(0,0,0,0.07);
}
:root[data-prefers-color-scheme="dark"] {
  --bl-bg: #17181a;
  --bl-surface: #1f2022;
  --bl-text: #e3e5e7;
  --bl-sub: #a2a7ae;
  --bl-faint: #757a80;
  --bl-line: rgba(255,255,255,0.08);
}
* { -webkit-tap-highlight-color: transparent; }
body {
  margin: 0;
  background: var(--bl-bg);
  color: var(--bl-text);
  font: 15px/1.45 -apple-system, "SF Pro Text", "PingFang SC", system-ui, sans-serif;
}
/* 长列表滚动容器：iOS 上不加这条，橡皮筋会把整页一起拖走 */
.bl-scroll { overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; }
.bl-press:active { opacity: 0.6; }
/* 标题两行截断 —— 视频标题长度差异极大，不截会把卡片高度撑得参差不齐 */
.bl-clamp2 {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; word-break: break-word;
}
`
