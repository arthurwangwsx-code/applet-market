// 本文件由 @aibox/applet-tsbuild 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。

import '@aibox/applet-sdk';

declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    /** Return the current track, queue summary, sleep timer and lyrics availability in one call, instead of chaining music_status + music_queue + music_lyrics. */
    "nowPlayingSummary": {
      input: Record<string, unknown>;
      output: {
        currentIndex?: number;
        durationSeconds?: number;
        isPlaying?: boolean;
        isShuffled?: boolean;
        lyrics?: Record<string, unknown>;
        playbackState?: string;
        positionSeconds?: number;
        queueCount?: number;
        repeatMode?: string;
        sleepTimer?: unknown;
        track?: unknown;
        upNext?: Array<unknown>;
      };
    };
    /** Play the user's most-played tracks, ranked by this app's own play history (the host music tools do not expose play history). */
    "playMostPlayed": {
      input: {
        /** How many tracks to queue (default 20). */
        limit?: number;
      };
      output: {
        message?: string;
        ok?: boolean;
        queued?: number;
        startedWith?: unknown;
      };
    };
    /** Resume the last track this app played, seeking back to the stored position (this app's own restore point; no host tool persists it). */
    "resumeLast": {
      input: Record<string, unknown>;
      output: {
        message?: string;
        ok?: boolean;
        positionSeconds?: number;
        track?: unknown;
      };
    };
    /** Toggle shuffle on the host playback engine. Drives the ⋯ menu row, so it is a UI action rather than an agent tool (music_shuffle already covers agents). */
    "toggleShuffle": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Set the repeat mode to off / one / all. Input is the bare mode string supplied by the ⋯ menu row. */
    "setRepeat": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Set or cancel the sleep timer. Input is {minutes} for a preset, {mode:'endOfTrack'} to stop after the current song, or {mode:'off'} to cancel. */
    "setSleepTimer": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Open the audio effects subpage. */
    "openEffects": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Share the current track through the system share sheet. */
    "shareCurrent": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Open the music settings subpage. */
    "openSettings": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
  }
}
