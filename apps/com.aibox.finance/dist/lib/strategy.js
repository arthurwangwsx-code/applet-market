// 回测 / 定投 / 再平衡（规格 §10.11–§10.13）。纯本地模拟，**只提案不下单**。
//
// 注意两处与绩效不同的口径，别顺手统一：
//  · 波动率用**样本**标准差（除以 n−1），绩效那边是总体（除以 n）；
//  · 年化的 days 用**K 线根数**，不是日历天数。
import { downsample, maxDrawdown, sma, stdDevSample } from './indicators.js';
import { roundHalfAway } from './money.js';
function annualizedFrom(totalPct, days) {
    if (days <= 0)
        return 0;
    const years = days / 252;
    if (years <= 0)
        return 0;
    return (((1 + totalPct / 100) ** (1 / years)) - 1) * 100;
}
/**
 * 回测。候选 = close > 0 的 K 线，需 ≥ 20 根否则返回 null。
 * maCross 的关键细节：**开仓当根不吃涨跌**（nav 先乘再判信号）。
 */
export function backtest(candles, strategy = 'buyhold') {
    const rows = (candles || []).filter((row) => row.close > 0);
    if (rows.length < 20)
        return null;
    const closes = rows.map((row) => row.close);
    let equity = [];
    let trades = 0;
    let wins = 0;
    if (strategy === 'macross') {
        const ma5 = sma(closes, 5);
        const ma20 = sma(closes, 20);
        let nav = 1;
        let holding = false;
        let entry = 0;
        for (let i = 0; i < rows.length; i += 1) {
            if (holding && i > 0)
                nav *= closes[i] / closes[i - 1];
            equity.push(nav);
            if (i < 20)
                continue;
            if (ma5[i] === null || ma20[i] === null || ma5[i - 1] === null || ma20[i - 1] === null)
                continue;
            const golden = ma5[i - 1] <= ma20[i - 1] && ma5[i] > ma20[i];
            const dead = ma5[i - 1] >= ma20[i - 1] && ma5[i] < ma20[i];
            if (golden && !holding) {
                holding = true;
                entry = closes[i];
                trades += 1;
            }
            else if (dead && holding) {
                holding = false;
                if (closes[i] > entry)
                    wins += 1;
            }
        }
        if (holding && closes[closes.length - 1] > entry)
            wins += 1;
    }
    else {
        equity = closes.map((close) => close / closes[0]);
    }
    const first = equity[0];
    const last = equity[equity.length - 1];
    const totalReturn = first !== 0 ? ((last - first) / first) * 100 : 0;
    const dailyReturns = [];
    for (let i = 1; i < equity.length; i += 1) {
        if (equity[i - 1] === 0)
            continue;
        dailyReturns.push(equity[i] / equity[i - 1] - 1);
    }
    const sd = stdDevSample(dailyReturns);
    const mean = dailyReturns.length
        ? dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length
        : 0;
    const volatility = sd * Math.sqrt(252) * 100;
    return {
        strategy,
        curve: downsample(equity.map((value, index) => ({ index, value }))),
        totalReturn,
        // days = **K 线根数**，不是日历天数。
        annualized: annualizedFrom(totalReturn, rows.length),
        maxDrawdown: maxDrawdown(equity),
        volatility,
        sharpe: sd !== 0 ? (mean * 252 - 0.02) / (sd * Math.sqrt(252)) : 0,
        buyHoldReturn: ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100,
        trades,
        wins,
        winRate: trades > 0 ? (wins / trades) * 100 : 0,
    };
}
/** 定投：step = 每月 21 / 每周 5（交易日）。需 K 线数 ≥ step 且 amount > 0。 */
export function dcaPlan(candles, { amount = 1000, frequency = 'monthly' } = {}) {
    const rows = (candles || []).filter((row) => row.close > 0);
    const step = frequency === 'weekly' ? 5 : 21;
    if (rows.length < step || !(amount > 0))
        return null;
    let invested = 0;
    let shares = 0;
    const points = [];
    for (let i = 0; i < rows.length; i += step) {
        invested += amount;
        shares += amount / rows[i].close;
        points.push({ index: i, value: shares * rows[i].close, base: invested });
    }
    const lastClose = rows[rows.length - 1].close;
    points.push({ index: rows.length - 1, value: shares * lastClose, base: invested });
    const finalValue = shares * lastClose;
    const totalReturn = invested > 0 ? ((finalValue - invested) / invested) * 100 : 0;
    return {
        frequency,
        amount,
        periods: Math.ceil(rows.length / step),
        invested,
        shares,
        avgCost: shares > 0 ? invested / shares : 0,
        finalValue,
        totalReturn,
        annualized: annualizedFrom(totalReturn, rows.length),
        lumpSumReturn: ((lastClose - rows[0].close) / rows[0].close) * 100,
        curve: downsample(points),
    };
}
/**
 * 再平衡提案（§10.13）。容差 = max(100 分, 总资产分/1000)，即「1 个货币单位」与「0.1%」取大。
 * 持有但不在目标里 → 建议清仓全部。
 */
export function rebalance({ valuation, targets, quotes, fxMap }) {
    const totalMinor = valuation.totalMinor;
    const weightSum = targets.reduce((sum, row) => sum + Math.max(0, row.weight), 0);
    if (weightSum <= 0)
        return [];
    const tolerance = Math.max(100, Math.round(totalMinor / 1000));
    const currentBySymbol = new Map();
    for (const row of valuation.rows)
        currentBySymbol.set(row.position.instrumentSymbol, row);
    const proposals = [];
    for (const target of targets) {
        const normalized = Math.max(0, target.weight) / weightSum;
        const targetMinor = Math.round(totalMinor * normalized);
        const row = currentBySymbol.get(target.symbol);
        const currentMinor = row ? row.marketValueMinor : 0;
        const delta = targetMinor - currentMinor;
        const quote = quotes ? quotes[target.symbol] : null;
        const currency = row ? row.position.currency : (target.currency || valuation.account.currency);
        const rate = currency === valuation.account.currency ? 1 : (fxMap ? fxMap[currency] : null);
        const price = quote && quote.price > 0 ? quote.price : null;
        const shares = (price && rate) ? (Math.abs(delta) / 100) / (price * rate) : null;
        proposals.push({
            symbol: target.symbol,
            name: row ? row.position.name : target.symbol,
            weight: normalized,
            targetMinor,
            currentMinor,
            deltaMinor: delta,
            shares,
            onTarget: Math.abs(delta) < tolerance,
            action: Math.abs(delta) < tolerance ? 'hold' : (delta > 0 ? 'buy' : 'sell'),
        });
        currentBySymbol.delete(target.symbol);
    }
    for (const [symbol, row] of currentBySymbol) {
        if (row.marketValueMinor <= 0)
            continue;
        proposals.push({
            symbol,
            name: row.position.name,
            weight: 0,
            targetMinor: 0,
            currentMinor: row.marketValueMinor,
            deltaMinor: -row.marketValueMinor,
            shares: row.position.quantity,
            onTarget: false,
            action: 'sell',
        });
    }
    return proposals;
}
/** 快照日期归一到当天 0 点（本地时区），同日覆盖。 */
export function startOfDay(timestamp) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}
/** §10.7：**仅当估值完整才写**快照——不完整的估值不进曲线。 */
export function snapshotFor(valuation, when) {
    if (!valuation.isComplete)
        return null;
    return {
        accountID: valuation.account.id,
        date: startOfDay(when || Date.now()),
        totalValueMinor: roundHalfAway(valuation.totalMinor),
        cashMinor: valuation.cashMinor,
        marketValueMinor: valuation.marketValueMinor,
    };
}
