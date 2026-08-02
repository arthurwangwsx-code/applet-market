// 汇率与换算（§4.2）。纯函数，输入是币种表数组，不依赖 store。
//
// 铁律：**没有可用汇率的外币一律按 0 计入汇总**，绝不静默按 1:1 伪造金额。

export const RATE_ENDPOINT_HOST = 'open.er-api.com'

export function baseCurrency(currencies) {
  return currencies.find((row) => row.isBase) ?? currencies[0] ?? null
}

export function baseCode(currencies) {
  const base = baseCurrency(currencies)
  return base ? base.code : 'CNY'
}

export function currencyRow(currencies, code) {
  const upper = String(code ?? '').toUpperCase()
  return currencies.find((row) => row.code === upper) ?? null
}

/** 该币种是否可用于统计（基准币恒可用）。 */
export function hasUsableRate(currencies, code) {
  const row = currencyRow(currencies, code)
  if (!row) return String(code ?? '').toUpperCase() === baseCode(currencies)
  if (row.isBase) return true
  return !!row.rateConfigured && Number(row.rateToBase) > 0
}

/**
 * 原币分 → 基准币分。
 *   未登记的 code   → code === base ? minor : 0
 *   isBase          → minor
 *   未配置汇率/≤0   → 0        ← 从汇总里排除
 */
export function toBaseMinor(currencies, minor, code) {
  const value = Math.round(Number(minor) || 0)
  const upper = String(code ?? '').toUpperCase()
  const row = currencyRow(currencies, upper)
  if (!row) return upper === baseCode(currencies) ? value : 0
  if (row.isBase) return value
  const rate = Number(row.rateToBase)
  if (!row.rateConfigured || !(rate > 0)) return 0
  return Math.round(value * rate)
}

/** 任意币 → 任意币（先过基准币）。 */
export function convertMinor(currencies, minor, from, to) {
  const source = String(from ?? '').toUpperCase()
  const target = String(to ?? '').toUpperCase()
  if (source === target) return Math.round(Number(minor) || 0)
  const base = toBaseMinor(currencies, minor, source)
  const targetRow = currencyRow(currencies, target)
  if (!targetRow) return target === baseCode(currencies) ? base : 0
  if (targetRow.isBase) return base
  const rate = Number(targetRow.rateToBase)
  if (!targetRow.rateConfigured || !(rate > 0)) return 0
  return Math.round(base / rate)
}

/**
 * 报表/统计的唯一口径：优先用**入账那一刻冻结的基准币金额**（历史成本），
 * 这样刷新汇率不会让过去月份的数字漂移。只有切换基准币时才对冻结值做一次跨基准换算。
 */
export function reportingBaseMinor(currencies, txn) {
  const snapshot = txn.baseAmountMinorAtPosting
  const snapshotCode = txn.baseCurrencyAtPosting
  if (snapshot !== null && snapshot !== undefined && snapshotCode) {
    const current = baseCode(currencies)
    if (String(snapshotCode).toUpperCase() === current) return Math.round(snapshot)
    return convertMinor(currencies, snapshot, snapshotCode, current)
  }
  return toBaseMinor(currencies, txn.amountMinor, txn.currency)
}

/**
 * 入账快照：新增和「实质金额/账户/币种变更」时触发。
 * 该币种没有可用汇率 → 四个快照字段全部清空。
 */
export function applyPostingSnapshot(currencies, txn, now = Date.now()) {
  const row = currencyRow(currencies, txn.currency)
  const base = baseCurrency(currencies)
  if (!base || !row || (!row.isBase && (!row.rateConfigured || !(Number(row.rateToBase) > 0)))) {
    txn.baseAmountMinorAtPosting = null
    txn.baseCurrencyAtPosting = null
    txn.fxRateToBaseAtPosting = null
    txn.fxRateDate = null
    return txn
  }
  const rate = row.isBase ? 1 : Number(row.rateToBase)
  txn.baseAmountMinorAtPosting = Math.round(txn.amountMinor * rate)
  txn.baseCurrencyAtPosting = base.code
  txn.fxRateToBaseAtPosting = rate
  txn.fxRateDate = now
  return txn
}

/** 汇率显示格式：`>= 100` 用 4 位整数化的 2 位小数，否则 4 位小数。 */
export function formatRate(rate) {
  const value = Number(rate) || 0
  return value >= 100 ? value.toFixed(2) : value.toFixed(4)
}

/**
 * 在线汇率：`GET https://open.er-api.com/v6/latest/{BASE}`（免费、无需 key），超时 12 秒。
 * 返回 `rates[X] = 1 基准币 = 多少 X`；失败一律返回 null（**静默降级**，绝不用 1 兜底）。
 * 隐私：只把基准币码发出去，不含任何用户财务数据。
 */
export async function fetchRates(base, httpGetJSON) {
  const code = String(base ?? '').toUpperCase()
  if (code.length !== 3) return null
  const result = await httpGetJSON(`https://${RATE_ENDPOINT_HOST}/v6/latest/${code}`, { timeoutMs: 12000 })
  if (!result.ok || !result.body) return null
  const payload = result.body
  if (payload.result === 'error') return null
  const rates = payload.rates
  if (!rates || typeof rates !== 'object' || Object.keys(rates).length === 0) return null
  return rates
}
