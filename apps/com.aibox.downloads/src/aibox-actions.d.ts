// 本文件由 @aibox/applet-tsbuild 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。

import '@aibox/applet-sdk';

declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    /** Downloads one or more files from http(s) URLs using the host download engine. Transfers keep running when the app is backgrounded or killed, and resume after interruptions. Choose where the file lands with "destination": "sandbox" (default, always works), "iCloud", "externalFiles" (a folder the user authorized in Settings), or "vault" (the notes vault). Returns task ids — poll with the list action for progress. Large files are fine; there is no size cap. */
    "add": {
      input: {
        /** Where files land. Default sandbox. */
        destination?: "sandbox" | "iCloud" | "externalFiles" | "vault";
        /** Saved name for a single URL. Ignored when several urls are given. */
        filename?: string;
        /** Relative subfolder inside the destination root. */
        folder?: string;
        priority?: "low" | "normal" | "high";
        /** One or more absolute http(s) URLs. */
        urls: Array<string>;
      };
      output: {
        count?: number;
        error?: string;
        ok?: boolean;
        tasks?: Array<{ artifactRef?: string; filename?: string; taskId?: string; url?: string }>;
        text?: string;
      };
    };
    /** Lists this app's downloads with live progress: state, bytes received, percentage, speed, and the saved path once finished. Filter with "state" (active / finished / running / queued / paused / completed / failed / cancelled). Only shows downloads started from this app — the host's own downloads and other apps' downloads are never included. */
    "list": {
      input: {
        limit?: number;
        state?: "active" | "finished" | "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
      };
      output: {
        count?: number;
        error?: string;
        ok?: boolean;
        tasks?: Array<unknown>;
        text?: string;
      };
    };
    /** Pauses, resumes, cancels or removes downloads. Give "taskId" for one task, or omit it to act on all of this app's downloads. "clearFinished" drops finished records from the list without deleting any downloaded file. Paused downloads keep their resume data, so resuming continues instead of restarting. */
    "control": {
      input: {
        action: "pause" | "resume" | "cancel" | "remove" | "clearFinished";
        /** Omit to act on every download of this app. */
        taskId?: string;
      };
      output: {
        action?: string;
        error?: string;
        ok?: boolean;
        text?: string;
      };
    };
    /** Pause every download of this app from the ⋯ menu. Drives the visible queue, so it is a UI action rather than an agent tool — the agent uses the control action instead. */
    "pauseAll": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Resume every paused download of this app from the ⋯ menu. */
    "resumeAll": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Remove finished records from the visible list. Downloaded files are not deleted. */
    "clearFinished": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
  }
}
