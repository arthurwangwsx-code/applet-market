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
    return ((1 + totalPct / 100) ** (1 / years) - 1) * 100;
}
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
                nav *= (closes[i] ?? 0) / (closes[i - 1] ?? 1);
            equity.push(nav);
            if (i < 20)
                continue;
            if (ma5[i] === null || ma20[i] === null || ma5[i - 1] === null || ma20[i - 1] === null)
                continue;
            const previousFast = ma5[i - 1];
            const previousSlow = ma20[i - 1];
            const currentFast = ma5[i];
            const currentSlow = ma20[i];
            if (previousFast === null ||
                previousFast === undefined ||
                previousSlow === null ||
                previousSlow === undefined ||
                currentFast === null ||
                currentFast === undefined ||
                currentSlow === null ||
                currentSlow === undefined)
                continue;
            const golden = previousFast <= previousSlow && currentFast > currentSlow;
            const dead = previousFast >= previousSlow && currentFast < currentSlow;
            if (golden && !holding) {
                holding = true;
                entry = closes[i] ?? 0;
                trades += 1;
            }
            else if (dead && holding) {
                holding = false;
                if ((closes[i] ?? 0) > entry)
                    wins += 1;
            }
        }
        if (holding && (closes.at(-1) ?? 0) > entry)
            wins += 1;
    }
    else {
        const initial = closes[0] ?? 1;
        equity = closes.map((close) => close / initial);
    }
    const first = equity[0] ?? 0;
    const last = equity.at(-1) ?? 0;
    const totalReturn = first !== 0 ? ((last - first) / first) * 100 : 0;
    const dailyReturns = [];
    for (let i = 1; i < equity.length; i += 1) {
        const previous = equity[i - 1];
        const current = equity[i];
        if (previous === undefined || current === undefined || previous === 0)
            continue;
        dailyReturns.push(current / previous - 1);
    }
    const sd = stdDevSample(dailyReturns);
    const mean = dailyReturns.length ? dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length : 0;
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
        buyHoldReturn: (((closes.at(-1) ?? 0) - (closes[0] ?? 0)) / (closes[0] ?? 1)) * 100,
        trades,
        wins,
        winRate: trades > 0 ? (wins / trades) * 100 : 0,
    };
}
export function dcaPlan(candles, { amount = 1000, frequency = 'monthly', } = {}) {
    const rows = (candles || []).filter((row) => row.close > 0);
    const step = frequency === 'weekly' ? 5 : 21;
    if (rows.length < step || !(amount > 0))
        return null;
    let invested = 0;
    let shares = 0;
    const points = [];
    for (let i = 0; i < rows.length; i += step) {
        const close = rows[i]?.close;
        if (close === undefined)
            continue;
        invested += amount;
        shares += amount / close;
        points.push({ index: i, value: shares * close, base: invested });
    }
    const lastClose = rows.at(-1)?.close ?? 0;
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
        lumpSumReturn: ((lastClose - (rows[0]?.close ?? 0)) / (rows[0]?.close ?? 1)) * 100,
        curve: downsample(points),
    };
}
export function rebalance({ valuation, targets, quotes, fxMap, }) {
    const totalMinor = valuation.totalMinor;
    const weightSum = targets.reduce((sum, row) => sum + Math.max(0, row.weight), 0);
    if (weightSum <= 0)
        return [];
    const tolerance = Math.max(100, Math.round(totalMinor / 1000));
    const currentBySymbol = new Map(valuation.rows.map((row) => [row.position.instrumentSymbol, row]));
    const proposals = [];
    for (const target of targets) {
        const normalized = Math.max(0, target.weight) / weightSum;
        const targetMinor = Math.round(totalMinor * normalized);
        const row = currentBySymbol.get(target.symbol);
        const currentMinor = row ? row.marketValueMinor : 0;
        const delta = targetMinor - currentMinor;
        const quote = quotes ? quotes[target.symbol] : null;
        const currency = row ? row.position.currency : target.currency || valuation.account.currency;
        const rate = currency === valuation.account.currency ? 1 : fxMap ? fxMap[currency] : null;
        const price = quote && quote.price > 0 ? quote.price : null;
        const shares = price && rate ? Math.abs(delta) / 100 / (price * rate) : null;
        proposals.push({
            symbol: target.symbol,
            name: row ? row.position.name : target.symbol,
            weight: normalized,
            targetMinor,
            currentMinor,
            deltaMinor: delta,
            shares,
            onTarget: Math.abs(delta) < tolerance,
            action: Math.abs(delta) < tolerance ? 'hold' : delta > 0 ? 'buy' : 'sell',
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
