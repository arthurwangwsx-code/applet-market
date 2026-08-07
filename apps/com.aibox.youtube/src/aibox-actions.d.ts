// 本文件由 @aibox/applet-tsbuild 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。

import '@aibox/applet-sdk';

declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    /** Search YouTube for videos by keyword. Returns each match with its video id, title, channel, duration and view count. Pass a video id or url to the play action to watch one. */
    "search": {
      input: {
        /** How many results to return (default 10). */
        limit?: number;
        /** What to search for. */
        query: string;
      };
      output: {
        error?: string;
        ok?: boolean;
        text?: string;
        videos?: Array<unknown>;
      };
    };
    /** Play a YouTube video on the native full-screen player, with lock-screen controls and picture-in-picture. Accepts a full watch url or a bare video id. The host resolves the stream and picks the best quality this build can actually play. */
    "play": {
      input: {
        /** A youtube.com/watch?v=... url. */
        url?: string;
        /** Bare video id, if you do not have the full url. */
        videoId?: string;
      };
      output: {
        error?: string;
        ok?: boolean;
        text?: string;
        video?: Record<string, unknown>;
      };
    };
  }
}
