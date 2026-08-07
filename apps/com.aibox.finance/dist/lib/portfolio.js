// 组合口径（规格 §10）—— 全部纯函数：吃普通对象、吐普通对象，不碰宿主、不碰存储。
// 这样 §10 的每条公式都能被 node 自测逐条断言，也让「事务」在 store 层是一次原子替换。
//
// 三条最容易做错、这里刻意写死的规则：
//  1. **手续费不进成本价**（买入 avgCost 只算 qty×price），但**卖出时手续费吃进已实现盈亏**；
//  2. **总盈亏要扣掉净外部资金流**（入金/出金），否则追加本金会被误算成投资收益；
//  3. **缺行情或缺汇率一律按 0 计并打标**，绝不用汇率 1 兜底、绝不伪造数值。
import { MoneyError, addMinor, clampMinor, grossMinorOf, isFiniteNumber, roundHalfAway, scaleMinor, subMinor, } from './money.js';
export const CASH_FLOW_KINDS = [
    'deposit',
    'withdrawal',
    'dividend',
    'interest',
    'tax',
    'fee',
    'adjustment',
];
export function isExternalFlow(kind) {
    return kind === 'deposit' || kind === 'withdrawal';
}
/** withdrawal / tax / fee 为 −1，其余 +1。 */
export function defaultSign(kind) {
    return kind === 'withdrawal' || kind === 'tax' || kind === 'fee' ? -1 : 1;
}
// —— §10.3 汇率 ——
export const FX_CURRENCIES = ['USD', 'HKD', 'EUR', 'GBP', 'JPY', 'CNY'];
/** `fxToCNY[c]` 语义 = 1 单位外币 = ? 人民币；CNY 隐含 1。 */
export function cnyPer(currency, fxToCNY) {
    if (currency === 'CNY' || currency === 'RMB')
        return 1;
    const value = fxToCNY ? fxToCNY[currency] : undefined;
    return isFiniteNumber(value) && value > 0 ? value : null;
}
/**
 * 账户币视角的汇率表。账户币本身取不到 CNY 报价时返回**空表**——
 * 该账户什么都估不了，这比用 1 兜底诚实。
 */
export function fxMapFor(accountCurrency, fxToCNY) {
    const base = cnyPer(accountCurrency, fxToCNY);
    if (base === null)
        return {};
    const out = {};
    for (const currency of FX_CURRENCIES) {
        const per = cnyPer(currency, fxToCNY);
        if (per !== null)
            out[currency] = per / base;
    }
    return out;
}
/** 标的币 → 账户币。同币种直接 1；查不到返回 null（**不是** 1）。 */
export function fxRate(from, to, fxMap) {
    if (from === to)
        return 1;
    const rate = fxMap ? fxMap[from] : undefined;
    return isFiniteNumber(rate) && rate > 0 ? rate : null;
}
export function applyBuy({ account, position, symbol, name, market, currency, quantity, price, fxRate: rate, feeMinor = 0, tradedAt, note, source, }) {
    if (!account)
        throw new MoneyError('accountNotFound');
    if (account.isArchived)
        throw new MoneyError('accountArchived');
    if (!isFiniteNumber(rate) || rate <= 0)
        throw new MoneyError('invalidRate');
    if (!isFiniteNumber(feeMinor) || feeMinor < 0)
        throw new MoneyError('invalidFee');
    const grossMinor = grossMinorOf(quantity, price);
    const costAcctMinor = scaleMinor(grossMinor, rate);
    const debit = addMinor(costAcctMinor, Math.trunc(feeMinor));
    if (account.cashMinor < debit)
        throw new MoneyError('insufficientCash', { need: debit, have: account.cashMinor });
    const oldQty = position ? position.quantity : 0;
    const oldAvg = position ? position.avgCost : 0;
    const newQty = oldQty + quantity;
    // 手续费**不进**成本价：摊薄成本只由 qty×price 决定。
    const avgCost = (oldQty * oldAvg + quantity * price) / newQty;
    return {
        account: { ...account, cashMinor: subMinor(account.cashMinor, debit) },
        position: {
            ...(position || { realizedPnlMinor: 0 }),
            instrumentSymbol: symbol,
            accountID: account.id,
            name: name || (position && position.name) || symbol,
            marketRaw: market || (position && position.marketRaw) || null,
            currency,
            quantity: newQty,
            avgCost,
            updatedAt: tradedAt || Date.now(),
        },
        order: {
            accountID: account.id,
            instrumentSymbol: symbol,
            name: name || symbol,
            sideRaw: 'buy',
            quantity,
            price,
            grossMinor,
            feeMinor: Math.trunc(feeMinor),
            currency,
            fxRate: rate,
            tradedAt: tradedAt || Date.now(),
            note: note || '',
            source: source || 'manual',
        },
        debitMinor: debit,
    };
}
export function applySell({ account, position, quantity, price, fxRate: rate, feeMinor = 0, tradedAt, note, source, }) {
    if (!account)
        throw new MoneyError('accountNotFound');
    if (account.isArchived)
        throw new MoneyError('accountArchived');
    if (!position || position.quantity < quantity - 1e-9)
        throw new MoneyError('insufficientPosition');
    if (!isFiniteNumber(rate) || rate <= 0)
        throw new MoneyError('invalidRate');
    if (!isFiniteNumber(feeMinor) || feeMinor < 0)
        throw new MoneyError('invalidFee');
    const grossMinor = grossMinorOf(quantity, price);
    const proceedsGrossAcct = scaleMinor(grossMinor, rate);
    if (feeMinor > proceedsGrossAcct)
        throw new MoneyError('invalidFee');
    const proceedsNet = subMinor(proceedsGrossAcct, Math.trunc(feeMinor));
    const costBasisAcct = scaleMinor(roundHalfAway(position.avgCost * quantity * 100), rate);
    // 手续费**吃进**已实现盈亏：realizedDelta 用的是净收入。
    const realizedDelta = proceedsNet - costBasisAcct;
    return {
        account: { ...account, cashMinor: addMinor(account.cashMinor, proceedsNet) },
        // 清仓不删行：quantity 归 0，累计已实现盈亏留档，再买入自动复活。
        position: {
            ...position,
            quantity: position.quantity - quantity,
            avgCost: position.avgCost,
            realizedPnlMinor: addMinor(position.realizedPnlMinor || 0, realizedDelta),
            updatedAt: tradedAt || Date.now(),
        },
        order: {
            accountID: account.id,
            instrumentSymbol: position.instrumentSymbol,
            name: position.name,
            sideRaw: 'sell',
            quantity,
            price,
            grossMinor,
            feeMinor: Math.trunc(feeMinor),
            currency: position.currency,
            fxRate: rate,
            tradedAt: tradedAt || Date.now(),
            note: note || '',
            source: source || 'manual',
        },
        proceedsMinor: proceedsNet,
        realizedDeltaMinor: realizedDelta,
    };
}
export function applyCashFlow({ account, kind, amountMinor, occurredAt, note, source }) {
    if (!account)
        throw new MoneyError('accountNotFound');
    if (account.isArchived)
        throw new MoneyError('accountArchived');
    if (!isFiniteNumber(amountMinor) || amountMinor <= 0)
        throw new MoneyError('invalidAmount');
    const signed = defaultSign(kind) < 0 ? -Math.trunc(amountMinor) : Math.trunc(amountMinor);
    const cashAfter = addMinor(account.cashMinor, signed);
    if (cashAfter < 0)
        throw new MoneyError('insufficientCash');
    return {
        account: { ...account, cashMinor: cashAfter },
        flow: {
            accountID: account.id,
            kindRaw: kind,
            amountMinor: signed,
            currency: account.currency,
            occurredAt: occurredAt || Date.now(),
            note: note || '',
            source: source || 'manual',
        },
    };
}
// —— §10.4 单持仓估值 ——
export function valuePosition(position, quote, rate) {
    const quoteValid = !!(quote && isFiniteNumber(quote.price) && quote.price > 0);
    const priced = quoteValid && rate !== null && rate !== undefined;
    const qty = position.quantity;
    const marketValueMinor = priced ? scaleMinor(roundHalfAway(qty * quote.price * 100), rate) : 0;
    const costMinor = priced ? scaleMinor(roundHalfAway(qty * position.avgCost * 100), rate) : 0;
    const unrealizedMinor = marketValueMinor - costMinor;
    const prevClose = quote && isFiniteNumber(quote.prevClose) ? quote.prevClose : 0;
    const dayMinor = priced ? scaleMinor(roundHalfAway(qty * (quote.price - prevClose) * 100), rate) : 0;
    return {
        position,
        priced,
        marketValueMinor,
        costMinor,
        unrealizedMinor,
        unrealizedPct: costMinor !== 0 ? (unrealizedMinor / Math.abs(costMinor)) * 100 : 0,
        dayMinor,
        missingQuote: !quoteValid,
        missingFX: rate === null || rate === undefined,
    };
}
// —— §10.5 账户估值 ——
/**
 * `quotes` = canonical → quote；`fxToCNY` = 币种 → 人民币中间价；`cashFlows` = 该账户全部流水。
 * `positions` 要传**全部行（含 quantity=0 的历史行）**——已实现盈亏靠它们累加。
 */
export function valueAccount({ account, positions, quotes, fxToCNY, cashFlows, }) {
    const fxMap = fxMapFor(account.currency, fxToCNY);
    const open = positions.filter((row) => row.quantity > 0);
    const rows = open.map((position) => {
        const quote = quotes ? quotes[position.instrumentSymbol] : null;
        return valuePosition(position, quote, fxRate(position.currency, account.currency, fxMap));
    });
    const marketValueMinor = rows.reduce((sum, row) => sum + row.marketValueMinor, 0);
    const costMinor = rows.reduce((sum, row) => sum + row.costMinor, 0);
    const unrealizedMinor = rows.reduce((sum, row) => sum + row.unrealizedMinor, 0);
    const dayMinor = rows.reduce((sum, row) => sum + row.dayMinor, 0);
    const realizedMinor = positions.reduce((sum, row) => sum + (row.realizedPnlMinor || 0), 0);
    const totalMinor = clampMinor(account.cashMinor + marketValueMinor);
    const externalCashFlowMinor = (cashFlows || [])
        .filter((flow) => isExternalFlow(flow.kindRaw))
        .reduce((sum, flow) => sum + flow.amountMinor, 0);
    // 追加入金不算收益：总盈亏必须扣掉净外部资金流。
    const totalPnlMinor = totalMinor - account.initialCashMinor - externalCashFlowMinor;
    const returnRate = account.initialCashMinor !== 0 ? (totalPnlMinor / Math.abs(account.initialCashMinor)) * 100 : 0;
    const missingQuotes = rows.filter((row) => row.missingQuote).map((row) => row.position.instrumentSymbol);
    const missingFX = [...new Set(rows.filter((row) => row.missingFX).map((row) => row.position.currency))];
    return {
        account,
        rows,
        cashMinor: account.cashMinor,
        marketValueMinor,
        costMinor,
        unrealizedMinor,
        dayMinor,
        realizedMinor,
        totalMinor,
        externalCashFlowMinor,
        totalPnlMinor,
        returnRate,
        missingQuotes,
        missingFX,
        isComplete: missingQuotes.length === 0 && missingFX.length === 0,
    };
}
// —— §10.8 组合绩效 ——
/** 胜率：成交按时间升序回放，逐标的重建摊薄成本；卖出价高于当时 avgCost 记一胜。 */
export function winRateOf(orders) {
    const sorted = [...orders].sort((a, b) => a.tradedAt - b.tradedAt);
    const state = new Map();
    let closed = 0;
    let wins = 0;
    for (const order of sorted) {
        const key = order.instrumentSymbol;
        const current = state.get(key) || { qty: 0, avg: 0 };
        if (order.sideRaw === 'buy') {
            const nextQty = current.qty + order.quantity;
            current.avg = nextQty > 0 ? (current.qty * current.avg + order.quantity * order.price) / nextQty : 0;
            current.qty = nextQty;
        }
        else {
            closed += 1;
            if (order.price > current.avg)
                wins += 1;
            current.qty = Math.max(0, current.qty - order.quantity);
        }
        state.set(key, current);
    }
    return { closed, wins, winRate: closed > 0 ? (wins / closed) * 100 : 0 };
}
const RISK_FREE = 0.02;
/** 快照 ≥ 2 才算回撤/波动/夏普，否则全 0 且 `hasEnoughData=false`。 */
export function performance({ orders, snapshots, }) {
    const wins = winRateOf(orders || []);
    const sorted = [...(snapshots || [])].sort((a, b) => a.date - b.date);
    const base = {
        ...wins,
        hasEnoughData: false,
        totalReturn: 0,
        annualized: 0,
        maxDrawdown: 0,
        volatility: 0,
        sharpe: 0,
    };
    if (sorted.length < 2)
        return base;
    const values = sorted.map((row) => row.totalValueMinor / 100);
    const first = values[0] ?? 0;
    const last = values.at(-1) ?? 0;
    const totalReturn = first !== 0 ? ((last - first) / first) * 100 : 0;
    const firstDate = sorted[0]?.date ?? 0;
    const lastDate = sorted.at(-1)?.date ?? firstDate;
    const days = Math.max(1, Math.round((lastDate - firstDate) / 86400000));
    const annualized = first > 0 && last > 0 ? (last / first) ** (365 / days) - 1 : 0;
    let peak = -Infinity;
    let drawdown = 0;
    for (const value of values) {
        if (value > peak)
            peak = value;
        if (peak > 0)
            drawdown = Math.max(drawdown, ((peak - value) / peak) * 100);
    }
    const returns = [];
    for (let i = 1; i < values.length; i += 1) {
        const previous = values[i - 1];
        const current = values[i];
        if (previous === undefined || current === undefined || previous === 0)
            continue;
        returns.push(current / previous - 1);
    }
    // 总体标准差（除以 n）——与回测那边的样本口径刻意不同。
    const mean = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
    const variance = returns.length ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length : 0;
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
    // 夏普用**年化收益**（不是日均年化），无风险 2%。
    const sharpe = volatility !== 0 ? (annualized - RISK_FREE) / (volatility / 100) : 0;
    return {
        ...wins,
        hasEnoughData: true,
        totalReturn,
        annualized: annualized * 100,
        maxDrawdown: drawdown,
        volatility,
        sharpe,
    };
}
// —— §10.9 资产配置 ——
export function allocation(rows) {
    const buckets = new Map();
    for (const row of rows) {
        const key = row.position.marketRaw || 'ashare';
        buckets.set(key, (buckets.get(key) || 0) + row.marketValueMinor);
    }
    const total = [...buckets.values()].reduce((sum, value) => sum + value, 0);
    if (total <= 0)
        return [];
    return [...buckets.entries()]
        .map(([market, marketValueMinor]) => ({ market, marketValueMinor, ratio: marketValueMinor / total }))
        .sort((a, b) => b.marketValueMinor - a.marketValueMinor);
}
// —— §10.10 组合诊断 ——
const FLAG_PENALTY = {
    highConcentration: 20,
    fewPositions: 15,
    singleMarket: 10,
    highCash: 10,
    lowCash: 5,
    bigDrawdown: 15,
    deepLoser: 15,
};
export function diagnose({ valuation, perf, }) {
    const rows = valuation.rows;
    const holdingsMinor = Math.max(valuation.marketValueMinor, 0);
    const totalMinor = Math.max(valuation.totalMinor, 1);
    const cashPct = (valuation.cashMinor / totalMinor) * 100;
    const holdingsPct = (holdingsMinor / totalMinor) * 100;
    let hhi = 0;
    let topWeight = 0;
    if (holdingsMinor > 0) {
        for (const row of rows) {
            const weight = row.marketValueMinor / holdingsMinor;
            hhi += weight * weight;
            if (weight > topWeight)
                topWeight = weight;
        }
    }
    const alloc = allocation(rows);
    const topMarket = alloc[0] ?? null;
    const positive = rows.filter((row) => row.marketValueMinor > 0);
    const contributor = positive.filter((row) => row.unrealizedPct > 0).sort((a, b) => b.unrealizedPct - a.unrealizedPct)[0] || null;
    const detractor = positive.filter((row) => row.unrealizedPct < 0).sort((a, b) => a.unrealizedPct - b.unrealizedPct)[0] || null;
    const flags = [];
    if (topWeight * 100 > 40)
        flags.push('highConcentration');
    if (rows.length > 0 && rows.length <= 2)
        flags.push('fewPositions');
    if (topMarket && topMarket.ratio * 100 > 90 && rows.length >= 2)
        flags.push('singleMarket');
    if (cashPct > 50)
        flags.push('highCash');
    if (rows.length > 0 && cashPct < 2)
        flags.push('lowCash');
    if (perf && perf.hasEnoughData && perf.maxDrawdown > 20)
        flags.push('bigDrawdown');
    if (detractor && detractor.unrealizedPct < -20)
        flags.push('deepLoser');
    const penalty = flags.reduce((sum, flag) => sum + (FLAG_PENALTY[flag] || 0), 0);
    return {
        isComplete: valuation.isComplete,
        score: Math.max(0, Math.min(100, 100 - penalty)),
        cashPct,
        holdingsPct,
        hhi,
        topWeight,
        topMarket,
        contributor,
        detractor,
        flags,
    };
}
