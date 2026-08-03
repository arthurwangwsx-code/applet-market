// 本文件由 @aibox/applet-vite 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。

import '@aibox/applet-sdk';

declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    /** Lists this app's voice recordings, newest first. Filter by a text query or favourites only. Read-only. */
    "memo_list": {
      input: {
        /** Only favourited recordings. */
        favOnly?: boolean;
        /** Match against the recording title. */
        query?: string;
      };
      output: {
        count?: number;
        ok: boolean;
        text: string;
      };
    };
    /** Transcribes one recording with Apple speech recognition and returns the text. It waits for completion, so a long recording can take minutes. Already-transcribed recordings return immediately; read them with memo_transcript. */
    "memo_transcribe": {
      input: {
        /** The recording id from memo_list. */
        id: string;
        /** BCP-47 locale such as en_US or zh_CN. Defaults to the configured transcription language. Pass the language actually spoken — a mismatch produces garbage. */
        locale?: string;
      };
      output: {
        ok: boolean;
        text: string;
      };
    };
    /** Returns the transcript of one recording: status and the full text. Prefers the speaker-corrected version when one exists. Read-only. */
    "memo_transcript": {
      input: {
        /** The recording id from memo_list. */
        id: string;
      };
      output: {
        ok: boolean;
        status?: string;
        text: string;
      };
    };
    /** Summarizes a recording's transcript and returns the summary text. Takes a template: general, meeting, interview, oneOnOne, lecture or podcast — each produces a different section structure (decisions and action items for meetings, strengths and concerns for interviews, and so on). Needs a completed transcript; run memo_transcribe first. */
    "memo_summarize": {
      input: {
        /** The recording id from memo_list. */
        id: string;
        /** Summary shape; defaults to 'general'. */
        template?: "general" | "meeting" | "interview" | "oneOnOne" | "lecture" | "podcast";
      };
      output: {
        ok: boolean;
        template?: string;
        text: string;
      };
    };
    /** Extracts tasks, decisions and personal commitments from a recording's transcript, each with an owner and a due hint when the speaker actually stated one. Nothing is invented. Needs a completed transcript. */
    "memo_action_items": {
      input: {
        /** Re-extract instead of returning the cached result. */
        force?: boolean;
        /** The recording id from memo_list. */
        id: string;
      };
      output: {
        count?: number;
        ok: boolean;
        text: string;
      };
    };
    /** Answers a question about one recording using only its transcript — nothing else. Use it instead of pulling the whole transcript when the user asks something specific about a long recording. */
    "memo_ask": {
      input: {
        /** The recording id from memo_list. */
        id: string;
        /** The question to answer from the transcript. */
        question: string;
      };
      output: {
        ok: boolean;
        text: string;
      };
    };
    /** Renders one recording as structured Markdown, plain text or SRT subtitles — title, created time, duration, summary, transcript, chapters, action items and translation, whichever exist. Returns the rendered text; it does not write a file. */
    "memo_export": {
      input: {
        /** Output format; defaults to 'markdown'. */
        format?: "markdown" | "text" | "srt";
        /** The recording id from memo_list. */
        id: string;
      };
      output: {
        format?: string;
        ok: boolean;
        text: string;
      };
    };
  }
}
