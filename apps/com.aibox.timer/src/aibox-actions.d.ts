// 本文件由 @aibox/applet-tsbuild 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。

import '@aibox/applet-sdk';

declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    /** Starts a countdown. Pass "minutes" (1-180) or "seconds" for a precise duration; omit both for the default 25-minute focus block. Optional "label" names the session so it is recognisable in history. */
    "start": {
      input: {
        /** What this session is for, e.g. "write report". */
        label?: string;
        /** Duration in whole minutes (1-180). */
        minutes?: number;
        /** Duration in seconds; wins over minutes when both are given. */
        seconds?: number;
      };
      output: {
        label?: string;
        ok: boolean;
        remainingSeconds: number;
        text?: string;
      };
    };
    /** Reports whether a timer is running and how much time is left. Read-only. */
    "status": {
      input: Record<string, unknown>;
      output: {
        label?: string;
        ok: boolean;
        remainingSeconds?: number;
        running: boolean;
        text?: string;
      };
    };
    /** Stops the running timer. Set "record" to true to still write it into history as an interrupted session. */
    "stop": {
      input: {
        /** Write the partial session into history. Default false. */
        record?: boolean;
      };
      output: {
        ok: boolean;
        stopped: boolean;
        text?: string;
      };
    };
  }
}
