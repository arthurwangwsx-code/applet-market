// 本文件由 @aibox/applet-tsbuild 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。

import '@aibox/applet-sdk';

declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    /** Searches aggregated news from the user's subscribed sources (RSS / RSSHub / optional News API). Omit "query" to get the latest headlines. Filter by "topic". Set "cluster"=true to group multiple reports about the same event. Each result includes the article URL — pass it to the read action to fetch full text. News may be delayed; for reference only. */
    "search": {
      input: {
        /** Group same-event reports into clusters. Default false. */
        cluster?: boolean;
        /** Max results (1-30). Default 15. */
        limit?: number;
        /** Keywords to search titles/summaries/sources. Omit for latest headlines. */
        query?: string;
        /** Optional topic filter. */
        topic?: "top" | "world" | "china" | "tech" | "business" | "science" | "culture" | "sports" | "health";
      };
      output: {
        clusters?: Array<unknown>;
        count?: number;
        items?: Array<{ id?: string; image?: string; source?: string; summary?: string; time?: string; title?: string; topic?: string; url?: string }>;
        ok?: boolean;
        query?: string;
        text?: string;
      };
    };
    /** Fetches the readable full text of one news article for analysis or summarization. Pass the article "url" (from a search result) or its "id". Returns cleaned article text (truncated to 6000 characters) plus metadata. If the site blocks extraction or is outside this applet's network allowlist, returns the available summary — suggest opening the original. */
    "read": {
      input: {
        /** The article stable id (alternative to url). */
        id?: string;
        /** The article URL (from a search result). */
        url?: string;
      };
      output: {
        article?: Record<string, unknown>;
        error?: string;
        excerpt?: string;
        ok?: boolean;
        text?: string;
      };
    };
    /** Manages the user's news subscriptions. "action": "list" = show sources; "add" = subscribe (set "url" to an RSS/Atom URL, or an RSSHub route starting with "/" like "/zhihu/hotlist"; optional "title"/"topic"/"kind"); "remove" = unsubscribe (match by "title" or "url"); "test" = fetch a URL/route once and report how many articles came back. RSSHub routes need an instance configured in settings. Hosts outside this applet's network allowlist cannot be fetched. */
    "source": {
      input: {
        /** list / add / remove / test. */
        action: "list" | "add" | "remove" | "test";
        /** Source kind for add (inferred if omitted). */
        kind?: "rss" | "atom" | "rsshub" | "api";
        /** Display name (add), or match key (remove). */
        title?: string;
        /** Topic for add. */
        topic?: "top" | "world" | "china" | "tech" | "business" | "science" | "culture" | "sports" | "health";
        /** RSS/Atom URL, or RSSHub route ('/...'). Required for add/test; add or remove key. */
        url?: string;
      };
      output: {
        action?: string;
        count?: number;
        error?: string;
        feeds?: Array<unknown>;
        ok?: boolean;
        sample?: string;
        text?: string;
      };
    };
    /** Saves or removes articles in the user's read-later list. "action": "save" (set "url" or "id" from a search result), "unsave" (by "id" or "url"), or "list" to show saved articles. */
    "save": {
      input: {
        /** save / unsave / list. */
        action: "save" | "unsave" | "list";
        /** Article stable id (save/unsave). */
        id?: string;
        /** Article URL (save/unsave). */
        url?: string;
      };
      output: {
        action?: string;
        articles?: Array<unknown>;
        error?: string;
        ok?: boolean;
        text?: string;
      };
    };
    /** Start or stop reading the current news list aloud. Drives the in-app broadcast bar; needs the visible list, so it is a UI action rather than an agent tool. */
    "toggleBroadcast": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
  }
}
