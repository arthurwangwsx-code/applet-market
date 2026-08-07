// 本文件由 @aibox/applet-tsbuild 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。

import '@aibox/applet-sdk';

declare module '@aibox/applet-sdk' {
  interface AppletActionMap {
    /** Record, edit or delete one ledger entry: an expense, an income, or a transfer between two accounts. Only `amount` is required for a new expense — category, account and date all have sensible defaults, so do NOT stop and ask the user for them. Pass a stable `request_id` (a UUID) on every add so a retry can never double-post. Use the ledger account tool to create accounts; this tool never creates one from scratch. */
    "record": {
      input: {
        /** Which account the money came from. Defaults to the default account. Kind words (cash, 信用卡, 电子钱包) and brand names (支付宝, WeChat) resolve automatically. */
        account?: string;
        /** Defaults to add. Never guess delete. */
        action?: "add" | "update" | "delete";
        /** Required for add and always positive, in major units (12.50). Direction comes from `type`, never from a sign. */
        amount?: number;
        batch_id?: string;
        /** Category name, or a two-level path 'Parent/Child'. Ignored for transfers. */
        category?: string;
        /** ISO code or a colloquial name (ringgit, 马币). If given without an account, routes to a same-currency account. A currency with no configured rate is refused outright. */
        currency?: string;
        /** YYYY-MM-DD, or natural language such as yesterday / 3天前. Defaults to today. */
        date?: string;
        merchant?: string;
        note?: string;
        /** Shared expenses: who paid ('me' for the user). Only meaningful when the project has members. */
        payer?: string;
        /** Group into a project; created if missing. 'none' means no project. Omitting it means NO project even when one is currently active. */
        project?: string;
        /** transaction_id of the expense this income refunds; 'none' unlinks on update. */
        refund_of?: string;
        reimbursable?: boolean;
        /** Idempotency key (use a UUID). The same key never posts twice — reuse it when retrying. */
        request_id?: string;
        source_fingerprint?: string;
        /** Omit for no split (the payer bears the whole cost). */
        split_mode?: "equal" | "exact" | "shares" | "percent";
        /** Aligned with split_with: exact amounts, weights, or percentages. Not needed for equal. */
        split_values?: Array<number>;
        /** Member names taking part; omit for everyone. */
        split_with?: Array<string>;
        tags?: Array<string>;
        /** Destination account; required for transfers. */
        to_account?: string;
        /** Cross-currency transfers: the amount that lands, in the destination account's currency. Omit to convert at the current rate. */
        to_amount?: number;
        /** Required for update and delete. */
        transaction_id?: string;
        /** Defaults to expense. */
        type?: "expense" | "income" | "transfer";
      };
      output: {
        amountMinor?: number;
        currency?: string;
        duplicate?: boolean;
        id?: string;
        ok?: boolean;
        text?: string;
      };
    };
    /** List individual ledger entries matching filters. Returns the count, the expense total in the base currency, and one line per entry ending in [id: …] so it can be updated or deleted afterwards. An unresolvable category/account/project name comes back as a candidate list rather than being silently ignored. */
    "query": {
      input: {
        account?: string;
        category?: string;
        /** YYYY-MM-DD, inclusive. */
        date_from?: string;
        /** YYYY-MM-DD, inclusive. */
        date_to?: string;
        /** Matches merchant, note and tags. */
        keyword?: string;
        /** Defaults to 20. */
        limit?: number;
        max_amount?: number;
        min_amount?: number;
        /** Defaults to this_month. Ignored when date_from/date_to are given. */
        period?: "today" | "this_week" | "last_7_days" | "last_30_days" | "this_month" | "last_month" | "this_year" | "all";
        project?: string;
        reimbursable?: boolean;
        tag?: string;
        type?: "expense" | "income" | "transfer";
      };
      output: {
        baseCurrency?: string;
        count?: number;
        entries?: Array<Record<string, unknown>>;
        ok?: boolean;
        text?: string;
        totalExpenseMinor?: number;
      };
    };
    /** Aggregate spending or income into buckets by category, subcategory, day, month, account, tag or project. Shares one implementation with the in-app Reports screen, so quoted numbers always match what the user sees. Amounts are in the base currency at the exchange rate frozen when each entry was posted. Transfers and balance adjustments are excluded. */
    "stats": {
      input: {
        /** Also compute the immediately preceding window of equal length. */
        compare_previous?: boolean;
        date_from?: string;
        date_to?: string;
        /** Defaults to by_category. */
        dimension?: "by_category" | "by_subcategory" | "by_day" | "by_month" | "by_account" | "by_tag" | "by_project";
        /** Defaults to expense. */
        metric?: "expense" | "income" | "net";
        period?: "today" | "this_week" | "last_7_days" | "last_30_days" | "this_month" | "last_month" | "this_year" | "all";
        project?: string;
        /** Time dimensions are never truncated. */
        top_n?: number;
      };
      output: {
        baseCurrency?: string;
        buckets?: Array<Record<string, unknown>>;
        ok?: boolean;
        previousTotalMinor?: unknown;
        text?: string;
        totalMinor?: number;
      };
    };
    /** Read budget status or set a monthly limit. Status shares one implementation with the in-app Budget screen and reports the total limit, spent, remaining, days left and the daily allowance, plus each category line (flagged when over, annotated when it carries a rollover). Setting a limit of 0 deletes that budget. */
    "budget": {
      input: {
        /** Defaults to status. */
        action?: "status" | "set";
        /** Roll this month's unspent amount into next month. Overspending never carries a negative. */
        carryover?: boolean;
        /** Omit for the overall monthly budget. */
        category?: string;
        /** Major units. 0 removes the budget. */
        limit?: number;
        /** YYYY-MM (also accepts YYYYMM or YYYY/MM). Defaults to the current month. */
        month?: string;
      };
      output: {
        ok?: boolean;
        payload?: Record<string, unknown>;
        text?: string;
      };
    };
    /** List accounts with balances and net worth, create an account, set an account's balance (a Beancount-style balance assertion that posts a visible calibration entry), archive one, or rename one. This is the ONLY way to create an account — the record tool never creates one. For credit accounts a positive initial_balance is stored as the amount owed. */
    "account": {
      input: {
        /** Which existing account to act on. */
        account?: string;
        /** Defaults to list. */
        action?: "list" | "create" | "set_balance" | "archive" | "update";
        archived?: boolean;
        /** Target balance for set_balance. Pass a negative number for what is owed on a credit account. */
        balance?: number;
        credit_limit?: number;
        currency?: string;
        include_in_net_worth?: boolean;
        initial_balance?: number;
        kind?: "cash" | "debit" | "credit" | "ewallet" | "prepaid" | "investment";
        name?: string;
        new_name?: string;
      };
      output: {
        assetsMinor?: number;
        baseCurrency?: string;
        deltaMinor?: number;
        id?: string;
        liabilitiesMinor?: number;
        netWorthMinor?: number;
        ok?: boolean;
        text?: string;
      };
    };
    /** List, create, rename or archive spending and income categories. Categories are two levels deep at most. When the user wants a category that does not exist yet, create it rather than forcing the entry into an existing one. Archiving only removes it from pickers; existing entries keep it. */
    "category": {
      input: {
        /** Defaults to list. */
        action?: "list" | "create" | "rename" | "archive";
        archived?: boolean;
        /** Defaults to expense. */
        kind?: "expense" | "income";
        name?: string;
        new_name?: string;
        /** Attach under a top-level category to make it a subcategory. */
        parent?: string;
      };
      output: {
        categories?: Array<string>;
        id?: string;
        ok?: boolean;
        text?: string;
      };
    };
    /** Manage currencies and exchange rates: list them, add one, set a rate manually, change the base currency all statistics are priced in, or refresh rates online. A currency with no configured rate is EXCLUDED from converted totals rather than being faked at 1:1, so add the rate before recording in it. Setting a rate marks it manual and online refreshes will not overwrite it. */
    "currency": {
      input: {
        /** Defaults to list. */
        action?: "list" | "add" | "set_rate" | "set_preferred" | "refresh";
        /** ISO code or a colloquial name; normalised to a 3-letter code. */
        code?: string;
        /** How many units of the BASE currency one unit of `code` is worth. */
        rate?: number;
      };
      output: {
        baseCurrency?: string;
        ok?: boolean;
        text?: string;
      };
    };
    /** Projects group a trip or event's spending, and carry shared-expense settlement. Actions: list, create, activate (pass 'none' to clear), update, archive, summary, members, add_member, remove_member, settle (member balances plus the fewest transfers that zero them out), record_settlement. Adding the first member auto-creates a 'Me' member. A settlement involving the user also posts a matching ledger entry. */
    "project": {
      input: {
        /** Defaults to list. */
        action?: "list" | "create" | "activate" | "update" | "archive" | "summary" | "members" | "add_member" | "remove_member" | "settle" | "record_settlement";
        activate?: boolean;
        /** record_settlement: amount in the base currency, major units. */
        amount?: number;
        archived?: boolean;
        /** Optional total budget in the base currency. */
        budget?: number;
        end?: string;
        /** record_settlement: who pays. */
        from?: string;
        is_me?: boolean;
        member?: string;
        name?: string;
        new_name?: string;
        start?: string;
        /** record_settlement: who gets paid. */
        to?: string;
      };
      output: {
        balances?: Record<string, unknown>;
        buckets?: Array<Record<string, unknown>>;
        budgetMinor?: number;
        id?: string;
        incomeMinor?: number;
        ok?: boolean;
        plan?: Array<Record<string, unknown>>;
        spentMinor?: number;
        text?: string;
      };
    };
    /** Open the in-app AI analysis panel. */
    "openAI": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Export every ledger entry as a CSV file and hand it to the share sheet. */
    "exportCSV": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Pick a ledger CSV file and open the import preview. Selecting a file never writes anything on its own. */
    "importCSV": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
    /** Open the recently deleted entries screen, where entries can be restored or permanently removed. */
    "openRecentlyDeleted": {
      input: Record<string, unknown>;
      output: import("@aibox/applet-sdk").JSONValue;
    };
  }
}
