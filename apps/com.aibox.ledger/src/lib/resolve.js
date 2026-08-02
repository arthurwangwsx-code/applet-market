// 名称解析（§4.5）—— AI 工具与 CSV 导入共用的自愈逻辑。
//
// 纪律：**多候选时绝不静默默认**，而是回一份候选清单让模型重问。
// 返回 `{ found, value }` 或 `{ found: false, candidates: [...] }`。

const SEPARATORS = ['/', '／', '>', '-', '·']

const hit = (value) => ({ found: true, value })
const miss = (candidates) => ({ found: false, candidates: candidates ?? [] })

function lower(text) {
  return String(text ?? '').trim().toLowerCase()
}

/**
 * 分类：
 *  1. 含分隔符 → 取**最后一段**在二级分类里找同名
 *  2. 精确同名（不分大小写）：1 个命中；多个 → 候选展示路径列表
 *  3. 模糊（互相 contains）：0 未找到；1 命中；多个 → 候选列表
 */
export function resolveCategory(store, raw, kind) {
  const needle = lower(raw)
  if (needle.length === 0) return miss()
  const pool = store.categories.filter((row) => row.kind === kind && !row.isArchived)

  for (const separator of SEPARATORS) {
    if (!needle.includes(separator)) continue
    const tail = lower(needle.split(separator).pop())
    if (tail.length === 0) continue
    const child = pool.find((row) => row.parentID && lower(row.name) === tail)
    if (child) return hit(child)
  }

  const exact = pool.filter((row) => lower(row.name) === needle)
  if (exact.length === 1) return hit(exact[0])
  if (exact.length > 1) return miss(exact.map((row) => store.categoryPath(row.id)))

  const fuzzy = pool.filter((row) => lower(row.name).includes(needle) || needle.includes(lower(row.name)))
  if (fuzzy.length === 1) return hit(fuzzy[0])
  if (fuzzy.length > 1) return miss(fuzzy.map((row) => store.categoryPath(row.id)))
  return miss()
}

// 账户「种类词」。判定顺序**从专有到宽泛**：先 debit 再 ewallet，
// 否则「银行卡」会被「钱包」的子串规则误吞。
const KIND_WORDS = [
  ['credit', ['credit', '信用卡', '信用', '花呗', '白条']],
  ['prepaid', ['prepaid', '储值', '充值卡', '交通卡', '饭卡', '会员卡', '预付']],
  ['investment', ['investment', 'invest', '投资', '理财', '证券']],
  ['debit', ['debit', '储蓄卡', '储蓄', '借记卡', '银行卡', '银行账户']],
  ['ewallet', ['ewallet', 'e-wallet', 'e wallet', '电子钱包', '钱包', '移动支付', '第三方支付', 'wallet']],
  ['cash', ['cash', '现金', '现钞', '现钱']],
]

// 中文品牌别名 → 英文名子串。
const BRAND_ALIASES = [
  [['支付宝', 'alipay', '蚂蚁'], ['alipay', '支付宝']],
  [['微信', 'wechat', 'weixin'], ['wechat', 'weixin', '微信']],
  [['云闪付', 'unionpay', '银联'], ['unionpay', '云闪付', '银联']],
  [['paypal', '贝宝'], ['paypal', '贝宝']],
  [['touch n go', 'touchngo', 'tng', '一触即通'], ['tng', 'touch']],
]

/** 账户：层层放宽（精确 → 种类词 → 品牌别名 → 模糊 → 币种收窄）。 */
export function resolveAccount(store, raw, preferCurrency) {
  const needle = lower(raw)
  const pool = store.accounts.filter((row) => !row.isArchived)
  if (needle.length === 0) return miss(pool.map((row) => row.name))

  const narrow = (rows) => {
    if (rows.length === 1) return hit(rows[0])
    if (rows.length > 1 && preferCurrency) {
      const same = rows.filter((row) => row.currency === String(preferCurrency).toUpperCase())
      if (same.length === 1) return hit(same[0])
    }
    return rows.length > 1 ? miss(rows.map((row) => row.name)) : null
  }

  const exact = narrow(pool.filter((row) => lower(row.name) === needle))
  if (exact) return exact

  for (const [kind, words] of KIND_WORDS) {
    if (!words.some((word) => needle.includes(word))) continue
    const byKind = narrow(pool.filter((row) => row.kind === kind))
    if (byKind) return byKind
    break
  }

  for (const [triggers, fragments] of BRAND_ALIASES) {
    if (!triggers.some((word) => needle.includes(word))) continue
    const branded = narrow(pool.filter((row) => fragments.some((piece) => lower(row.name).includes(piece))))
    if (branded) return branded
    break
  }

  const fuzzy = narrow(pool.filter((row) => lower(row.name).includes(needle) || needle.includes(lower(row.name))))
  if (fuzzy) return fuzzy
  return miss(pool.map((row) => row.name))
}

/** 项目：精确 → 唯一模糊 → 未找到。 */
export function resolveProject(store, raw) {
  const needle = lower(raw)
  if (needle.length === 0) return miss()
  const pool = store.projects.filter((row) => !row.isArchived)
  const exact = pool.filter((row) => lower(row.name) === needle)
  if (exact.length === 1) return hit(exact[0])
  if (exact.length > 1) return miss(exact.map((row) => row.name))
  const fuzzy = pool.filter((row) => lower(row.name).includes(needle) || needle.includes(lower(row.name)))
  if (fuzzy.length === 1) return hit(fuzzy[0])
  if (fuzzy.length > 1) return miss(fuzzy.map((row) => row.name))
  return miss()
}

const ME_WORDS = ['me', '我', 'myself', 'i', 'self']

/** 成员：精确 → me/我/myself/i/self → 唯一模糊。 */
export function resolveMember(store, projectID, raw) {
  const needle = lower(raw)
  const pool = store.projectMembers(projectID)
  if (needle.length === 0) return miss(pool.map((row) => row.name))
  const exact = pool.filter((row) => lower(row.name) === needle)
  if (exact.length === 1) return hit(exact[0])
  if (ME_WORDS.includes(needle)) {
    const me = pool.find((row) => row.isMe)
    if (me) return hit(me)
  }
  const fuzzy = pool.filter((row) => lower(row.name).includes(needle) || needle.includes(lower(row.name)))
  if (fuzzy.length === 1) return hit(fuzzy[0])
  if (fuzzy.length > 1) return miss(fuzzy.map((row) => row.name))
  return miss(pool.map((row) => row.name))
}

/** 「不归项目」的显式说法。 */
export function isNoneToken(raw) {
  const needle = lower(raw)
  return ['none', '无', '不', '-', 'null'].includes(needle)
}
