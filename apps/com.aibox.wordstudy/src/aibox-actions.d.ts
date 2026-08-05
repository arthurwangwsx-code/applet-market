// 本文件由 @aibox/applet-tsbuild 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。

import '@aibox/applet-sdk';

declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    /** Looks up an English word or short phrase: phonetics (UK/US IPA), part-of-speech senses, inflected forms, example sentences, exam tags (CET-4/6, postgrad, etc.), synonyms/antonyms, and a memory tip. Cached lookups return instantly; a new word is scraped from a dictionary site and falls back to a one-shot AI generation (may take a few seconds). Accepts a spelling-corrected suggestion if the input looks misspelled. */
    "word_lookup": {
      input: {
        /** The English word or short phrase to look up. */
        term: string;
      };
      output: {
        cached?: boolean;
        ok: boolean;
        source?: string;
        text: string;
        word?: string;
      };
    };
    /** Translates text between Chinese and English (auto-detects direction by default: CJK input → Chinese-to-English, otherwise English-to-Chinese). Returns translation only, no explanation. Pass 'direction' to force a specific direction instead of auto-detection. */
    "word_translate": {
      input: {
        /** Translation direction; defaults to 'auto' (detect by script). */
        direction?: "auto" | "zhToEn" | "enToZh";
        /** The text to translate (up to 3000 characters). */
        text: string;
      };
      output: {
        dstLang?: string;
        ok: boolean;
        srcLang?: string;
        text: string;
      };
    };
    /** Lists the user's saved vocabulary (words and saved sentences), most recently added first. Filter by kind or mastered status, and/or search by a text fragment matched against the term and its brief gloss. Read-only, local data — no AI call, no network. */
    "word_list_vocab": {
      input: {
        /** Restrict the list to this kind/status; defaults to 'all'. */
        filter?: "all" | "word" | "sentence" | "mastered" | "unmastered";
        /** Max items to return (default 50, max 200). */
        limit?: number;
        /** Optional fuzzy text to match against term or gloss. */
        query?: string;
      };
      output: {
        count?: number;
        ok: boolean;
        text: string;
      };
    };
    /** Adds a word or sentence to the user's saved vocabulary, or updates its mastered flag if it's already saved. Non-destructive — never deletes existing data. Use word_lookup first if you need the word's brief gloss cached alongside it. */
    "word_vocab_upsert": {
      input: {
        /** What kind of entry this is; defaults to 'word'. */
        kind?: "word" | "sentence";
        /** Mark as mastered (archived, out of review pool). */
        mastered?: boolean;
        /** The word or sentence text to save. */
        term: string;
      };
      output: {
        created?: boolean;
        ok: boolean;
        text: string;
      };
    };
    /** Permanently removes a word or sentence from the user's saved vocabulary. This cannot be undone — confirm with the user before calling unless they explicitly asked to delete it. */
    "word_vocab_remove": {
      input: {
        /** The exact word or sentence text to remove. */
        term: string;
      };
      output: {
        ok: boolean;
        removed?: boolean;
        text: string;
      };
    };
  }
}
