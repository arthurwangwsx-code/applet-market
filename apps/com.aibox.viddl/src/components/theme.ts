// 设计令牌（对齐 AiBoxPluginUI/Theme.swift）。视频下载沿用原生模块的红色标识。
// 三个语义色写死、不跟主题：running 蓝 / done 绿 / failed 红——「这条在跑还是挂了」不该随外观漂移。

export const THEME_CSS = `
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
`

export const C = {
  brand: 'var(--vd-brand)',
  running: 'var(--vd-running)',
  done: 'var(--vd-done)',
  failed: 'var(--vd-failed)',
  ink: 'var(--vd-ink)',
  muted: 'var(--vd-muted)',
  line: 'var(--vd-line)',
  bg: 'var(--vd-bg)',
  surface: 'var(--vd-surface)',
  track: 'var(--vd-track)',
  onAccent: 'var(--vd-on-accent)',
}

export const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24 }
export const RADIUS = { card: 16, chip: 999, control: 10 }

/** 状态 → 颜色。终态三色是语义，不跟主题（见文件头）。 */
export function stateColor(state: string): string {
  if (state === 'completed') return C.done
  if (state === 'failed' || state === 'cancelled') return C.failed
  if (state === 'paused') return C.muted
  return C.running
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = n
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return ''
  return `${formatBytes(bytesPerSecond)}/s`
}

export function formatETA(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}
