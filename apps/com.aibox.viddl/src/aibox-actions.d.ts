// 本文件由 @aibox/applet-tsbuild 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。

import '@aibox/applet-sdk';

declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    /** Reads a video page or stream URL and reports what can be downloaded: title, uploader, duration, and every available quality with its format id, container, codecs and size. Nothing is downloaded. Pass the chosen format id to the fetch action. Supports Bilibili, YouTube, direct media links, m3u8 streams and generic pages with an embedded video. */
    "inspect": {
      input: {
        /** The video page or stream URL. */
        url: string;
      };
      output: {
        error?: string;
        formats?: Array<unknown>;
        ok?: boolean;
        text?: string;
        video?: Record<string, unknown>;
      };
    };
    /** Downloads a video the user is entitled to save, for offline viewing. Give the page or stream "url"; add "formatId" (from the inspect action) to choose a quality, otherwise the best one is used. Set "audioOnly" to keep only the audio track as .m4a. Returns a jobId immediately — videos are large, so track it with the library action. HLS sources produce an in-app offline package rather than a portable mp4. */
    "fetch": {
      input: {
        /** Keep only the audio track as .m4a. Default false. */
        audioOnly?: boolean;
        /** Format id from the inspect action. Omit for best quality. */
        formatId?: string;
        url: string;
      };
      output: {
        error?: string;
        jobId?: string;
        ok?: boolean;
        text?: string;
      };
    };
    /** Lists downloaded videos and in-flight video downloads with their state and progress, or acts on one of them. "action": "list" (default) / "status" / "pause" / "resume" / "cancel" / "retry" / "play" / "export" — everything except list and status needs a "jobId". "export" turns an HLS offline package into a portable mp4; direct downloads are already mp4. */
    "library": {
      input: {
        action?: "list" | "status" | "pause" | "resume" | "cancel" | "retry" | "play" | "export";
        jobId?: string;
      };
      output: {
        action?: string;
        error?: string;
        ok?: boolean;
        text?: string;
      };
    };
  }
}
