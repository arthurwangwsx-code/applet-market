import { registerActions } from '@aibox/applet-sdk';
import {
  appendHistory, durationFrom, formatDuration, loadRunning, newSessionID,
  remainingSeconds, saveRunning,
} from './timer';

/**
 * manifest 声明的三个 action 的实现。
 *
 * 关键点：`registerActions` 的入参类型来自 `src/aibox-actions.d.ts`，而那份文件是从
 * `src/manifest.json` 的 `inputSchemaJSON` / `outputSchemaJSON` **生成**的。所以
 *  · 少写一个 action        → "Property 'stop' is missing"
 *  · handler 形参写错类型   → 形参报错
 *  · 返回值缺 required 字段 → 返回值报错
 * 全部是编译期错误。这就是 manifest 与代码「对齐」的机械保证。
 *
 * 这些 action 是 `headless: true` 的：AI 和自动化可能在**页面没打开**时调它们，所以实现
 * 只能依赖 `aibox.storage`，不能依赖 React state。UI 侧靠轮询 storage 反映外部改动。
 */
export function registerAppletActions(onChange: () => void): void {
  registerActions({
    async start(input) {
      const seconds = durationFrom(input);
      const label = typeof input.label === 'string' && input.label.trim() !== ''
        ? input.label.trim()
        : '专注';
      await saveRunning({ label, plannedSeconds: seconds, startedAt: Date.now() });
      onChange();
      return {
        ok: true,
        remainingSeconds: seconds,
        label,
        text: `已开始计时：${label}，${formatDuration(seconds)}`,
      };
    },

    async status() {
      const running = await loadRunning();
      if (!running) return { ok: true, running: false, text: '当前没有正在进行的计时。' };
      const left = remainingSeconds(running);
      return {
        ok: true,
        running: left > 0,
        remainingSeconds: left,
        label: running.label,
        text: left > 0
          ? `${running.label} 还剩 ${formatDuration(left)}`
          : `${running.label} 已经到点了。`,
      };
    },

    async stop(input) {
      const running = await loadRunning();
      if (!running) return { ok: true, stopped: false, text: '没有正在进行的计时。' };
      const left = remainingSeconds(running);
      const actual = running.plannedSeconds - left;
      await saveRunning(null);
      if (input.record === true) {
        await appendHistory({
          id: newSessionID(),
          label: running.label,
          plannedSeconds: running.plannedSeconds,
          actualSeconds: actual,
          finishedAt: Date.now(),
          completed: left === 0,
        });
      }
      onChange();
      return { ok: true, stopped: true, text: `已停止：${running.label}（计了 ${formatDuration(actual)}）` };
    },
  });
}
