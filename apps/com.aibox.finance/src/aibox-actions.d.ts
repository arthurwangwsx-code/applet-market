// 本文件由 @aibox/applet-tsbuild 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。

import '@aibox/applet-sdk';

declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    /** Get delayed quotes for stocks, funds or indices — price, change, open/high/low, turnover, P/E and order book. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_quote": {
      input: {
        /** Bypass the local TTL cache and refetch. */
        force?: boolean;
        /** Single symbol. Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbol?: string;
        /** Batch of symbols. Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbols?: Array<string>;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Search instruments by name or code across A-shares, Hong Kong, US and mutual funds. Use this whenever the user names a company instead of a code. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_search": {
      input: {
        /** Max results, 1..15. Default 15. */
        limit?: number;
        /** Restrict results to one market. */
        market?: "ashare" | "hk" | "us" | "fund";
        /** Company name, ticker or code. */
        query: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Fetch OHLCV candles plus locally computed indicator values (MA / MACD / KDJ / BOLL) and a window summary. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_chart": {
      input: {
        /** Price adjustment for daily/weekly/monthly. Default qfq. */
        adjust?: "qfq" | "hfq";
        /** Number of candles, 1..800. Default 120. */
        count?: number;
        /** Indicators to summarize. */
        indicators?: Array<"ma" | "macd" | "kdj" | "boll">;
        /** Candle period. Default day. */
        period?: "5m" | "15m" | "30m" | "60m" | "day" | "week" | "month";
        /** Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbol: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** List, add, remove or regroup the watchlist, and manage watchlist groups. Writes to the user's watchlist. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_watch": {
      input: {
        /** What to do. Default list. */
        action?: "list" | "add" | "remove" | "move" | "create_group" | "delete_group";
        /** Group name. */
        group?: string;
        /** Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbol?: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Value the paper portfolio (holdings with market value, cost, unrealized and daily P&L) or list recent trades. Positions with a missing quote or FX rate are reported as incomplete rather than guessed. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_portfolio": {
      input: {
        /** Account name. Omit for the primary account. */
        account?: string;
        /** Default holdings. */
        action?: "holdings" | "history";
        /** Rows for history, 1..100. Default 20. */
        limit?: number;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Record a simulated buy or sell in a paper account. Cross-currency trades lock the exchange rate at execution and fail when no rate is available. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_trade": {
      input: {
        /** Account name. Omit for the primary account. */
        account?: string;
        /** Trade side. */
        action: "buy" | "sell";
        /** Commission in the account currency (major units, e.g. 5.00). */
        fee?: number;
        /** Execution price in the instrument currency. Defaults to the latest quote. */
        price?: number;
        /** Share/unit count, must be > 0. */
        quantity: number;
        /** Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbol: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** List, create, rename, reset, archive or delete paper accounts, and record cash flows (deposit / withdrawal / dividend / interest / tax / fee / adjustment). Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_account": {
      input: {
        /** Default list. */
        action?: "list" | "create" | "copy" | "rename" | "update" | "cashflow" | "reset" | "archive" | "unarchive" | "delete";
        /** Cash flow amount in major units, must be > 0. */
        amount?: number;
        /** Cash flow kind. */
        cashflow_type?: "deposit" | "withdrawal" | "dividend" | "interest" | "tax" | "fee" | "adjustment";
        /** Account currency for create. Default CNY. */
        currency?: "CNY" | "HKD" | "USD";
        /** Source account name for copy. */
        from_account?: string;
        /** Include archived accounts when listing. */
        include_archived?: boolean;
        /** Initial cash in major units for create. Default 1000000. */
        initial_cash?: number;
        /** Mark the account as a mirror of real holdings. */
        is_real_copy?: boolean;
        /** Account name (target, or new name for create/rename). */
        name?: string;
        /** Free-form note. */
        note?: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** List, set, remove, enable or disable price alerts. Alerts are checked while quotes refresh in the foreground — this container has no background wake-up. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_alert": {
      input: {
        /** Default list. */
        action?: "list" | "set" | "remove" | "enable" | "disable";
        /** Trigger condition. */
        condition?: "above" | "below" | "up_pct" | "down_pct";
        /** Free-form note. */
        note?: string;
        /** Target price, or target percent for up_pct / down_pct. */
        price?: number;
        /** Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbol?: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Fetch up to eight periods of key financial indicators (revenue, net profit, ROE, gross margin, EPS, BPS with YoY) plus the current P/E and P/B. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_financials": {
      input: {
        /** Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbol: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Compute portfolio performance: total and annualized return, max drawdown, volatility, Sharpe and win rate. Refreshes quotes and records a daily snapshot first; drawdown/volatility/Sharpe need at least two daily snapshots. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_perf": {
      input: {
        /** Account name. Omit for the primary account. */
        account?: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Score portfolio structure (0..100) and list risk flags such as over-concentration, too few holdings or an excessive cash ratio. Refuses to score when any quote or FX rate is missing. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_diagnose": {
      input: {
        /** Account name. Omit for the primary account. */
        account?: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Fetch the dividend and bonus-issue history for an A-share company. A-shares only. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_dividend": {
      input: {
        /** Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbol: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Fetch daily net capital flow for an A-share stock split by order size (main / super / large / medium / small), in CNY. A-shares only. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_fundflow": {
      input: {
        /** Trading days, 1..60. Default 10. */
        days?: number;
        /** Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbol: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** List industry or concept sectors ranked by change or main capital inflow, or list a sector's constituents. Needs a mainland-China network connection; returns empty otherwise. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_sector": {
      input: {
        /** What to list. */
        action: "industry" | "concept" | "constituents";
        /** Sector code (BKxxxx) — required for constituents. */
        code?: string;
        /** Rows, 1..40. Default 12. */
        limit?: number;
        /** Ranking field. Default change. */
        sort?: "change" | "moneyflow";
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Rank the whole A-share market by main capital net inflow or outflow. Needs a mainland-China network connection. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_moneyrank": {
      input: {
        /** Default inflow. */
        direction?: "inflow" | "outflow";
        /** Rows, 1..30. Default 12. */
        limit?: number;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Fetch the latest Dragon-Tiger list (stocks with abnormal trading), deduplicated by code, with net buy amounts and the listing reason. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_dragon": {
      input: {
        /** Rows, 1..30. Default 12. */
        limit?: number;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Fetch today's market breadth: limit-up count, limit-down count, broken-board count, seal rate and the longest consecutive limit-up streak. Needs a mainland-China network connection. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_sentiment": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Scan the top A-share universe and filter locally by P/E, P/B, change, market cap or industry. Needs a mainland-China network connection. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_screener": {
      input: {
        /** Maximum percent change. */
        changeMax?: number;
        /** Minimum percent change. */
        changeMin?: number;
        /** Industry name substring. */
        industry?: string;
        /** Rows, 1..25. Default 12. */
        limit?: number;
        /** Minimum market cap in 亿 (100 million CNY). */
        mktcapMinYi?: number;
        /** Sort order. Defaults to asc for pe, desc otherwise. */
        order?: "asc" | "desc";
        /** Maximum P/B. */
        pbMax?: number;
        /** Maximum P/E. */
        peMax?: number;
        /** Minimum P/E. */
        peMin?: number;
        /** Sort field. Default change. */
        sortBy?: "change" | "moneyflow" | "turnover" | "pe" | "marketcap";
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Run a local historical backtest (buy & hold, or MA5/MA20 crossover) and report return, annualized return, max drawdown, volatility, Sharpe and win rate. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_backtest": {
      input: {
        /** Daily candles, 30..800. Default 250. */
        count?: number;
        /** Default buyhold. */
        strategy?: "buyhold" | "macross";
        /** Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbol: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Simulate a dollar-cost-averaging plan over historical prices and report invested amount, current value, average cost and the lump-sum comparison. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_plan": {
      input: {
        /** Amount invested each period. Default 1000. */
        amount?: number;
        /** Daily candles, 60..800. Default 500. */
        count?: number;
        /** Default monthly. */
        frequency?: "weekly" | "monthly";
        /** Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbol: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Fetch market newsflashes, per-stock announcements, or the latest earnings pre-announcements. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_news": {
      input: {
        /** What to fetch. */
        action: "market" | "stock" | "forecast";
        /** Rows, 1..25. Default 10. */
        limit?: number;
        /** Required for action=stock. Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares. */
        symbol?: string;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Compare several instruments (price, change, P/E, P/B, market cap) or several paper accounts (total value, P&L, return) side by side. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_compare": {
      input: {
        /** Things to compare. */
        items: Array<string>;
        /** Default instruments. */
        type?: "instruments" | "accounts";
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Propose (never execute) the trades needed to move a paper account toward target weights. Weights are normalized to 100%; nothing is ordered. Market quotes are delayed and for simulation/research only — never place real trades or move real money. */
    "finance_rebalance": {
      input: {
        /** Account name. Omit for the primary account. */
        account?: string;
        /** Target weights. */
        targets: Array<{ symbol: string; weight: number }>;
      };
      output: import("@aibox/applet-sdk").JSONValue;
    };
  }
}
