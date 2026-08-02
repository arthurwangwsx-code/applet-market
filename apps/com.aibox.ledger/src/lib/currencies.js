// 币种目录（§4.8「币种目录（20 种）」的完整清单，「添加币种」选择器的来源）。
//
// 纪律：**存储恒 ×100**，与币种小数位无关；`decimals` 只影响显示截位
// （JPY / KRW / VND 是 0 位币，不显示小数部分）。

/** 20 个内置币种：code / 符号 / 小数位。名称走 i18n（键 `cur.<CODE>`）。 */
export const CURRENCY_CATALOG = [
  { code: 'CNY', symbol: '¥', decimals: 2 },
  { code: 'MYR', symbol: 'RM', decimals: 2 },
  { code: 'USD', symbol: '$', decimals: 2 },
  { code: 'EUR', symbol: '€', decimals: 2 },
  { code: 'GBP', symbol: '£', decimals: 2 },
  { code: 'HKD', symbol: 'HK$', decimals: 2 },
  { code: 'SGD', symbol: 'S$', decimals: 2 },
  { code: 'TWD', symbol: 'NT$', decimals: 2 },
  { code: 'THB', symbol: '฿', decimals: 2 },
  { code: 'JPY', symbol: '¥', decimals: 0 },
  { code: 'KRW', symbol: '₩', decimals: 0 },
  { code: 'AUD', symbol: 'A$', decimals: 2 },
  { code: 'CAD', symbol: 'C$', decimals: 2 },
  { code: 'IDR', symbol: 'Rp', decimals: 2 },
  { code: 'VND', symbol: '₫', decimals: 0 },
  { code: 'INR', symbol: '₹', decimals: 2 },
  { code: 'PHP', symbol: '₱', decimals: 2 },
  { code: 'MOP', symbol: 'MOP$', decimals: 2 },
  { code: 'CHF', symbol: 'CHF', decimals: 2 },
  { code: 'NZD', symbol: 'NZ$', decimals: 2 },
]

const BY_CODE = new Map(CURRENCY_CATALOG.map((row) => [row.code, row]))

/** 目录条目；未知币种返回 null。 */
export function catalogEntry(code) {
  return BY_CODE.get(String(code ?? '').toUpperCase()) ?? null
}

/** 符号。未知币种回退 `"{CODE} "`（大写码 + 一个空格）；`RMB` 特判成 `¥`。 */
export function currencySymbol(code) {
  const upper = String(code ?? '').toUpperCase()
  if (upper === 'RMB') return '¥'
  const entry = BY_CODE.get(upper)
  if (entry) return entry.symbol
  return `${upper} `
}

/** 显示小数位。未知币种默认 2。 */
export function currencyDecimals(code) {
  const entry = BY_CODE.get(String(code ?? '').toUpperCase())
  return entry ? entry.decimals : 2
}

// 俗名 / 母语名 → ISO 码（AI 与导入的宽松解析用）。
const ALIASES = {
  rmb: 'CNY', 人民币: 'CNY', 元: 'CNY', 块: 'CNY', yuan: 'CNY', 'chinese yuan': 'CNY',
  ringgit: 'MYR', 马币: 'MYR', 林吉特: 'MYR',
  dollar: 'USD', 美元: 'USD', 美金: 'USD', usdollar: 'USD',
  euro: 'EUR', 欧元: 'EUR',
  pound: 'GBP', 英镑: 'GBP', sterling: 'GBP',
  港币: 'HKD', 港元: 'HKD',
  新币: 'SGD', 新加坡元: 'SGD',
  台币: 'TWD', 新台币: 'TWD',
  泰铢: 'THB', baht: 'THB',
  日元: 'JPY', 日圆: 'JPY', yen: 'JPY',
  韩元: 'KRW', won: 'KRW',
  澳元: 'AUD', 澳币: 'AUD',
  加元: 'CAD', 加币: 'CAD',
  印尼盾: 'IDR', rupiah: 'IDR',
  越南盾: 'VND', dong: 'VND',
  卢比: 'INR', rupee: 'INR',
  比索: 'PHP', peso: 'PHP',
  澳门元: 'MOP', 葡币: 'MOP',
  法郎: 'CHF', franc: 'CHF',
  新西兰元: 'NZD',
}

/** 归一成 ISO 码；无法归一时返回大写原串。 */
export function normalizeCurrencyCode(raw) {
  const text = String(raw ?? '').trim()
  if (text.length === 0) return ''
  const upper = text.toUpperCase()
  if (BY_CODE.has(upper)) return upper
  const alias = ALIASES[text.toLowerCase()] ?? ALIASES[text]
  return alias ?? upper
}
