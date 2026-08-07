// 本文件由 @aibox/applet-tsbuild 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。

import '@aibox/applet-sdk';

declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    /** Search Bilibili for videos by keyword. Returns each match with its BV id, title, uploader, duration and play count. Pass a BV id to the play action to watch one. */
    "search": {
      input: {
        /** What to search for. */
        keyword: string;
        /** How many results to return (default 10). */
        limit?: number;
      };
      output: {
        error?: string;
        ok?: boolean;
        text?: string;
        videos?: Array<unknown>;
      };
    };
    /** What is popular on Bilibili right now. kind 'popular' is the trending feed, 'ranking' is the all-site leaderboard. */
    "trending": {
      input: {
        kind?: "popular" | "ranking";
        limit?: number;
      };
      output: {
        error?: string;
        ok?: boolean;
        text?: string;
        videos?: Array<unknown>;
      };
    };
    /** Play a Bilibili video by its BV id on the native full-screen player, with lock-screen controls and picture-in-picture. Get a BV id from the search or trending action first. */
    "play": {
      input: {
        /** The BV id, e.g. BV1bz3Q6oEMP. */
        bvid: string;
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
