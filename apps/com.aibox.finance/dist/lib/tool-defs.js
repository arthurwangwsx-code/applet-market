// `finance_*` 工具的**声明真值**（规格 §13.4）。
//
// 这一份同时喂两处：① `src/manifest.json` 的 `actions[]`（由 tests/sync-manifest.mjs 生成，
// 不手写 JSON）；② `lib/tools.js` 的 handler 注册。两边名字对不上就等于工具不存在，
// 所以必须同源。
//
// 硬约束（缺一 AI 就发现不到 / 调不对）：
//  · 全部 `headless: true` 且 `visibility` 含 `"agent"`；
//  · `inputSchemaJSON` 必须写全——schema 是 AI 调用的唯一依据；
//  · 4 个写型（watch / account / trade / alert）`readOnly: false`；
//    `finance_trade` 另外 `idempotent: false`（同一笔买入调两次就是两笔成交）。
//
// 能力级约束逐字追加到每个 summary 末尾（见 CAPABILITY_NOTE）。
export const CAPABILITY_NOTE = 'Market quotes are delayed and for simulation/research only — never place real trades or move real money.';
const obj = (properties, required = []) => JSON.stringify({
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
});
const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const num = (description, extra = {}) => ({ type: 'number', description, ...extra });
const enumOf = (values, description, extra = {}) => ({ type: 'string', enum: values, description, ...extra });
const SYMBOL_HINT = 'Canonical symbol: A-shares sh600519 / sz000001, HK hk00700, US usAAPL, fund fund161725. A bare 6-digit code is accepted for A-shares.';
/** 读型工具的公共字段。 */
const read = { effect: 'read', readOnly: true, idempotent: true };
/** 写型工具的公共字段。 */
const write = { effect: 'write', readOnly: false, destructive: false };
export const TOOL_DEFS = [
    {
        name: 'finance_quote',
        displayName: '查行情',
        summary: 'Get delayed quotes for stocks, funds or indices — price, change, open/high/low, turnover, P/E and order book.',
        keywords: ['stock', 'quote', 'price', 'index', 'fund', '行情', '股票', '股价', '基金', '指数'],
        ...read,
        input: obj({
            symbols: { type: 'array', items: str('Canonical symbol'), description: `Batch of symbols. ${SYMBOL_HINT}` },
            symbol: str(`Single symbol. ${SYMBOL_HINT}`),
            force: { type: 'boolean', description: 'Bypass the local TTL cache and refetch.' },
        }),
    },
    {
        name: 'finance_search',
        displayName: '搜索标的',
        summary: 'Search instruments by name or code across A-shares, Hong Kong, US and mutual funds. Use this whenever the user names a company instead of a code.',
        keywords: ['search', 'find', 'ticker', 'lookup', '搜索', '查找', '代码'],
        ...read,
        input: obj({
            query: str('Company name, ticker or code.'),
            market: enumOf(['ashare', 'hk', 'us', 'fund'], 'Restrict results to one market.'),
            limit: num('Max results, 1..15. Default 15.'),
        }, ['query']),
    },
    {
        name: 'finance_chart',
        displayName: '取K线',
        summary: 'Fetch OHLCV candles plus locally computed indicator values (MA / MACD / KDJ / BOLL) and a window summary.',
        keywords: ['chart', 'candle', 'kline', 'trend', 'MA', 'MACD', 'KDJ', 'K线', '走势', '技术指标'],
        ...read,
        input: obj({
            symbol: str(SYMBOL_HINT),
            period: enumOf(['5m', '15m', '30m', '60m', 'day', 'week', 'month'], 'Candle period. Default day.'),
            count: num('Number of candles, 1..800. Default 120.'),
            adjust: enumOf(['qfq', 'hfq'], 'Price adjustment for daily/weekly/monthly. Default qfq.'),
            indicators: { type: 'array', items: enumOf(['ma', 'macd', 'kdj', 'boll'], 'Indicator'), description: 'Indicators to summarize.' },
        }, ['symbol']),
    },
    {
        name: 'finance_watch',
        displayName: '管理自选',
        summary: 'List, add, remove or regroup the watchlist, and manage watchlist groups. Writes to the user\'s watchlist.',
        keywords: ['watchlist', 'follow', 'add', 'remove', '自选', '关注', '添加'],
        ...write,
        idempotent: true,
        input: obj({
            action: enumOf(['list', 'add', 'remove', 'move', 'create_group', 'delete_group'], 'What to do. Default list.'),
            symbol: str(SYMBOL_HINT),
            group: str('Group name.'),
        }),
    },
    {
        name: 'finance_portfolio',
        displayName: '看持仓',
        summary: 'Value the paper portfolio (holdings with market value, cost, unrealized and daily P&L) or list recent trades. Positions with a missing quote or FX rate are reported as incomplete rather than guessed.',
        keywords: ['portfolio', 'holdings', 'positions', 'pnl', '持仓', '组合', '盈亏'],
        ...read,
        input: obj({
            action: enumOf(['holdings', 'history'], 'Default holdings.'),
            account: str('Account name. Omit for the primary account.'),
            limit: num('Rows for history, 1..100. Default 20.'),
        }),
    },
    {
        name: 'finance_trade',
        displayName: '模拟买卖',
        summary: 'Record a simulated buy or sell in a paper account. Cross-currency trades lock the exchange rate at execution and fail when no rate is available.',
        keywords: ['buy', 'sell', 'trade', 'order', '买入', '卖出', '交易', '下单'],
        ...write,
        idempotent: false,
        input: obj({
            action: enumOf(['buy', 'sell'], 'Trade side.'),
            symbol: str(SYMBOL_HINT),
            quantity: num('Share/unit count, must be > 0.'),
            price: num('Execution price in the instrument currency. Defaults to the latest quote.'),
            account: str('Account name. Omit for the primary account.'),
            fee: num('Commission in the account currency (major units, e.g. 5.00).'),
        }, ['action', 'symbol', 'quantity']),
    },
    {
        name: 'finance_account',
        displayName: '管理账户',
        summary: 'List, create, rename, reset, archive or delete paper accounts, and record cash flows (deposit / withdrawal / dividend / interest / tax / fee / adjustment).',
        keywords: ['account', 'cash', 'deposit', 'withdraw', '账户', '入金', '出金', '现金'],
        ...write,
        idempotent: false,
        input: obj({
            action: enumOf(['list', 'create', 'copy', 'rename', 'update', 'cashflow', 'reset', 'archive', 'unarchive', 'delete'], 'Default list.'),
            name: str('Account name (target, or new name for create/rename).'),
            currency: enumOf(['CNY', 'HKD', 'USD'], 'Account currency for create. Default CNY.'),
            initial_cash: num('Initial cash in major units for create. Default 1000000.'),
            note: str('Free-form note.'),
            cashflow_type: enumOf(['deposit', 'withdrawal', 'dividend', 'interest', 'tax', 'fee', 'adjustment'], 'Cash flow kind.'),
            amount: num('Cash flow amount in major units, must be > 0.'),
            is_real_copy: { type: 'boolean', description: 'Mark the account as a mirror of real holdings.' },
            include_archived: { type: 'boolean', description: 'Include archived accounts when listing.' },
            from_account: str('Source account name for copy.'),
        }),
    },
    {
        name: 'finance_alert',
        displayName: '到价提醒',
        summary: 'List, set, remove, enable or disable price alerts. Alerts are checked while quotes refresh in the foreground — this container has no background wake-up.',
        keywords: ['alert', 'notify', 'target price', '提醒', '到价', '通知'],
        ...write,
        idempotent: true,
        input: obj({
            action: enumOf(['list', 'set', 'remove', 'enable', 'disable'], 'Default list.'),
            symbol: str(SYMBOL_HINT),
            condition: enumOf(['above', 'below', 'up_pct', 'down_pct'], 'Trigger condition.'),
            price: num('Target price, or target percent for up_pct / down_pct.'),
            note: str('Free-form note.'),
        }),
    },
    {
        name: 'finance_financials',
        displayName: '查财务',
        summary: 'Fetch up to eight periods of key financial indicators (revenue, net profit, ROE, gross margin, EPS, BPS with YoY) plus the current P/E and P/B.',
        keywords: ['financials', 'earnings', 'revenue', 'ROE', 'PE', '财务', '营收', '净利润', '市盈率'],
        ...read,
        input: obj({ symbol: str(SYMBOL_HINT) }, ['symbol']),
    },
    {
        name: 'finance_perf',
        displayName: '组合绩效',
        summary: 'Compute portfolio performance: total and annualized return, max drawdown, volatility, Sharpe and win rate. Refreshes quotes and records a daily snapshot first; drawdown/volatility/Sharpe need at least two daily snapshots.',
        keywords: ['performance', 'sharpe', 'drawdown', 'return', '绩效', '年化', '回撤', '夏普'],
        ...read,
        idempotent: false,
        input: obj({ account: str('Account name. Omit for the primary account.') }),
    },
    {
        name: 'finance_diagnose',
        displayName: '组合诊断',
        summary: 'Score portfolio structure (0..100) and list risk flags such as over-concentration, too few holdings or an excessive cash ratio. Refuses to score when any quote or FX rate is missing.',
        keywords: ['diagnose', 'risk', 'concentration', '诊断', '风险', '集中度'],
        ...read,
        input: obj({ account: str('Account name. Omit for the primary account.') }),
    },
    {
        name: 'finance_dividend',
        displayName: '查分红',
        summary: 'Fetch the dividend and bonus-issue history for an A-share company. A-shares only.',
        keywords: ['dividend', 'bonus', 'payout', '分红', '送配', '派息'],
        ...read,
        input: obj({ symbol: str(SYMBOL_HINT) }, ['symbol']),
    },
    {
        name: 'finance_fundflow',
        displayName: '资金流向',
        summary: 'Fetch daily net capital flow for an A-share stock split by order size (main / super / large / medium / small), in CNY. A-shares only.',
        keywords: ['fund flow', 'capital', 'main net', '资金流', '主力', '净流入'],
        ...read,
        input: obj({
            symbol: str(SYMBOL_HINT),
            days: num('Trading days, 1..60. Default 10.'),
        }, ['symbol']),
    },
    {
        name: 'finance_sector',
        displayName: '板块行情',
        summary: 'List industry or concept sectors ranked by change or main capital inflow, or list a sector\'s constituents. Needs a mainland-China network connection; returns empty otherwise.',
        keywords: ['sector', 'industry', 'concept', 'board', '板块', '行业', '概念'],
        ...read,
        input: obj({
            action: enumOf(['industry', 'concept', 'constituents'], 'What to list.'),
            sort: enumOf(['change', 'moneyflow'], 'Ranking field. Default change.'),
            code: str('Sector code (BKxxxx) — required for constituents.'),
            limit: num('Rows, 1..40. Default 12.'),
        }, ['action']),
    },
    {
        name: 'finance_moneyrank',
        displayName: '资金排行',
        summary: 'Rank the whole A-share market by main capital net inflow or outflow. Needs a mainland-China network connection.',
        keywords: ['money flow', 'inflow', 'outflow', 'ranking', '资金排行', '净流入', '净流出'],
        ...read,
        input: obj({
            direction: enumOf(['inflow', 'outflow'], 'Default inflow.'),
            limit: num('Rows, 1..30. Default 12.'),
        }),
    },
    {
        name: 'finance_dragon',
        displayName: '龙虎榜',
        summary: 'Fetch the latest Dragon-Tiger list (stocks with abnormal trading), deduplicated by code, with net buy amounts and the listing reason.',
        keywords: ['dragon tiger', 'billboard', 'abnormal', '龙虎榜', '异动'],
        ...read,
        input: obj({ limit: num('Rows, 1..30. Default 12.') }),
    },
    {
        name: 'finance_sentiment',
        displayName: '市场情绪',
        summary: 'Fetch today\'s market breadth: limit-up count, limit-down count, broken-board count, seal rate and the longest consecutive limit-up streak. Needs a mainland-China network connection.',
        keywords: ['sentiment', 'limit up', 'breadth', '情绪', '涨停', '跌停', '封板'],
        ...read,
        input: obj({}),
    },
    {
        name: 'finance_screener',
        displayName: '选股扫描',
        summary: 'Scan the top A-share universe and filter locally by P/E, P/B, change, market cap or industry. Needs a mainland-China network connection.',
        keywords: ['screener', 'filter', 'scan', 'valuation', '选股', '筛选', '扫描'],
        ...read,
        input: obj({
            sortBy: enumOf(['change', 'moneyflow', 'turnover', 'pe', 'marketcap'], 'Sort field. Default change.'),
            order: enumOf(['asc', 'desc'], 'Sort order. Defaults to asc for pe, desc otherwise.'),
            peMin: num('Minimum P/E.'),
            peMax: num('Maximum P/E.'),
            pbMax: num('Maximum P/B.'),
            changeMin: num('Minimum percent change.'),
            changeMax: num('Maximum percent change.'),
            mktcapMinYi: num('Minimum market cap in 亿 (100 million CNY).'),
            industry: str('Industry name substring.'),
            limit: num('Rows, 1..25. Default 12.'),
        }),
    },
    {
        name: 'finance_backtest',
        displayName: '策略回测',
        summary: 'Run a local historical backtest (buy & hold, or MA5/MA20 crossover) and report return, annualized return, max drawdown, volatility, Sharpe and win rate.',
        keywords: ['backtest', 'strategy', 'simulate', '回测', '策略', '均线'],
        ...read,
        input: obj({
            symbol: str(SYMBOL_HINT),
            strategy: enumOf(['buyhold', 'macross'], 'Default buyhold.'),
            count: num('Daily candles, 30..800. Default 250.'),
        }, ['symbol']),
    },
    {
        name: 'finance_plan',
        displayName: '定投模拟',
        summary: 'Simulate a dollar-cost-averaging plan over historical prices and report invested amount, current value, average cost and the lump-sum comparison.',
        keywords: ['dca', 'plan', 'invest', 'monthly', '定投', '计划'],
        ...read,
        input: obj({
            symbol: str(SYMBOL_HINT),
            amount: num('Amount invested each period. Default 1000.'),
            frequency: enumOf(['weekly', 'monthly'], 'Default monthly.'),
            count: num('Daily candles, 60..800. Default 500.'),
        }, ['symbol']),
    },
    {
        name: 'finance_news',
        displayName: '财经快讯',
        summary: 'Fetch market newsflashes, per-stock announcements, or the latest earnings pre-announcements.',
        keywords: ['news', 'announcement', 'forecast', '快讯', '公告', '业绩预告'],
        ...read,
        input: obj({
            action: enumOf(['market', 'stock', 'forecast'], 'What to fetch.'),
            symbol: str(`Required for action=stock. ${SYMBOL_HINT}`),
            limit: num('Rows, 1..25. Default 10.'),
        }, ['action']),
    },
    {
        name: 'finance_compare',
        displayName: '横向对比',
        summary: 'Compare several instruments (price, change, P/E, P/B, market cap) or several paper accounts (total value, P&L, return) side by side.',
        keywords: ['compare', 'versus', 'benchmark', '对比', '比较'],
        ...read,
        input: obj({
            type: enumOf(['instruments', 'accounts'], 'Default instruments.'),
            items: { type: 'array', items: str('Symbol or account name'), description: 'Things to compare.' },
        }, ['items']),
    },
    {
        name: 'finance_rebalance',
        displayName: '再平衡提案',
        summary: 'Propose (never execute) the trades needed to move a paper account toward target weights. Weights are normalized to 100%; nothing is ordered.',
        keywords: ['rebalance', 'allocation', 'target weight', '再平衡', '调仓', '配置'],
        ...read,
        input: obj({
            account: str('Account name. Omit for the primary account.'),
            targets: {
                type: 'array',
                description: 'Target weights.',
                items: {
                    type: 'object',
                    properties: { symbol: str(SYMBOL_HINT), weight: num('Relative weight, > 0.') },
                    required: ['symbol', 'weight'],
                    additionalProperties: false,
                },
            },
        }, ['targets']),
    },
];
/** manifest.actions[] 的条目（tests/sync-manifest.mjs 用）。 */
export function manifestActions() {
    return TOOL_DEFS.map((def) => ({
        id: def.name,
        name: def.name,
        displayName: def.displayName,
        summary: `${def.summary} ${CAPABILITY_NOTE}`,
        keywords: def.keywords,
        inputSchemaJSON: def.input,
        headless: true,
        visibility: ['agent', 'automation'],
        effect: def.effect,
        readOnly: def.readOnly,
        ...(def.destructive !== undefined ? { destructive: def.destructive } : {}),
        idempotent: def.idempotent,
    }));
}
