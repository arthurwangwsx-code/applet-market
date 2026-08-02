// 技术指标（规格 §7.3，对齐原生 `FinIndicators`）。纯本地计算，零网络。
//
// 三条容易写错、这里逐字照抄原生的口径：
//  · MACD 的 hist **乘 2**（DIF−DEA 的 2 倍，不是 1 倍）；
//  · KDJ 的 Ln 只在「low > 0」的样本里取 min（脏数据里 low=0 会把 RSV 拉成 100）；
//  · BOLL 的标准差是**总体**标准差（除以 n），不是样本（n−1）。
//    ——而绩效那边的年化波动率也是除以 n，回测那边却是除以 n−1，两处刻意不同，别统一。

/** 简单均线；暖机期（i < n−1）输出 null。 */
export function sma(values, period) {
  const out = new Array(values.length).fill(null)
  if (period <= 0) return out
  let sum = 0
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

/** EMA：k = 2/(n+1)，out[0] = v[0]，全长无 null。 */
export function ema(values, period) {
  const out = new Array(values.length).fill(null)
  if (values.length === 0 || period <= 0) return out
  const k = 2 / (period + 1)
  out[0] = values[0]
  for (let i = 1; i < values.length; i += 1) {
    out[i] = values[i] * k + out[i - 1] * (1 - k)
  }
  return out
}

/** MACD(12,26,9)：DIF = EMA12 − EMA26；DEA = EMA(DIF,9)；hist = (DIF − DEA) × 2。 */
export function macd(values, fast = 12, slow = 26, signal = 9) {
  const fastLine = ema(values, fast)
  const slowLine = ema(values, slow)
  const dif = values.map((_, i) => fastLine[i] - slowLine[i])
  const dea = ema(dif, signal)
  const hist = dif.map((value, i) => (value - dea[i]) * 2)
  return { dif, dea, hist }
}

/**
 * KDJ(9,3,3)。窗口是最近 9 根（开头处截断），prevK / prevD 初值都是 50。
 * Hn 用窗口最高价 max；Ln 用窗口内 low > 0 的最低价 min（全为 0 时退化成 Hn，RSV 走 50 分支）。
 */
export function kdj(candles, period = 9) {
  const k = []
  const d = []
  const j = []
  let prevK = 50
  let prevD = 50
  for (let i = 0; i < candles.length; i += 1) {
    const from = Math.max(0, i - period + 1)
    let high = -Infinity
    let low = Infinity
    for (let n = from; n <= i; n += 1) {
      if (candles[n].high > high) high = candles[n].high
      if (candles[n].low > 0 && candles[n].low < low) low = candles[n].low
    }
    if (!Number.isFinite(low)) low = high
    const rsv = high > low ? ((candles[i].close - low) / (high - low)) * 100 : 50
    const currentK = (rsv + prevK * 2) / 3
    const currentD = (currentK + prevD * 2) / 3
    k.push(currentK)
    d.push(currentD)
    j.push(3 * currentK - 2 * currentD)
    prevK = currentK
    prevD = currentD
  }
  return { k, d, j }
}

/** BOLL(20,2)：mid = MA20；sd = 窗口**总体**标准差；upper/lower = mid ± 2sd。暖机期 null。 */
export function boll(values, period = 20, multiplier = 2) {
  const mid = sma(values, period)
  const upper = new Array(values.length).fill(null)
  const lower = new Array(values.length).fill(null)
  for (let i = 0; i < values.length; i += 1) {
    if (mid[i] === null) continue
    let variance = 0
    for (let n = i - period + 1; n <= i; n += 1) {
      const diff = values[n] - mid[i]
      variance += diff * diff
    }
    const sd = Math.sqrt(variance / period)
    upper[i] = mid[i] + multiplier * sd
    lower[i] = mid[i] - multiplier * sd
  }
  return { mid, upper, lower }
}

/** 总体标准差（除以 n）。绩效年化波动用它。 */
export function stdDevPopulation(values) {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/** 样本标准差（除以 n−1）。回测波动用它——与上面刻意不同口径。 */
export function stdDevSample(values) {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** 最大回撤（%）：max over i of (peak_i − v_i)/peak_i × 100。 */
export function maxDrawdown(values) {
  let peak = -Infinity
  let worst = 0
  for (const value of values) {
    if (value > peak) peak = value
    if (peak > 0) {
      const drawdown = ((peak - value) / peak) * 100
      if (drawdown > worst) worst = drawdown
    }
  }
  return worst
}

/** 曲线降采样到 ≤ ~60 点（步长 n/60，末点补齐）。 */
export function downsample(points, target = 60) {
  if (points.length <= target) return points.slice()
  const step = Math.max(1, Math.floor(points.length / target))
  const out = []
  for (let i = 0; i < points.length; i += step) out.push(points[i])
  const last = points[points.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}
