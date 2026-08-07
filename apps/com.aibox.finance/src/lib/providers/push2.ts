// 东财 push2 / push2ex（板块 / 资金 / 情绪 / 选股）—— 规格 §8.5。
//
// ⚠️ **这一族只在中国大陆网络下通**，海外/沙箱一律返回空。所以调用方必须优雅回退到
// 磁盘快照或空态，**不要转圈到超时**（规格 §15 第 11 条）。
//
// 两个必须照抄的解析细节：
//  · `fs` 参数**必须整体 URL 编码**（`+` → `%2B`，否则被解成空格，返回全空）；
//  · `data.diff` 兼容**数组**与**下标字典**两种形态，都要处理。
//
// 北向资金面板**不做**（§8.7：官方 2024-08 已停更，字段全 null，原生也放弃了）。

import { getJSON, num, str } from '../http.js'
import { shanghaiYMD } from '../format.js'

const QUOTE_REFERER = { Referer: 'https://quote.eastmoney.com/' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `data.diff` 归一成数组。 */
function diffRows(body: unknown): Array<Record<string, unknown>> {
  if (!isRecord(body) || !isRecord(body.data)) return []
  const diff = body.data.diff
  if (Array.isArray(diff)) return diff.filter(isRecord)
  if (isRecord(diff)) return Object.values(diff).filter(isRecord)
  return []
}

/** clist 通用列表。数值**直接取用，不除 100**（对齐 akshare）。 */
async function clist({
  fs,
  fields,
  fid,
  limit,
  ascending = false,
}: {
  fs: string
  fields: string
  fid: string
  limit: number
  ascending?: boolean
}): Promise<Array<Record<string, unknown>>> {
  const url =
    'https://push2.eastmoney.com/api/qt/clist/get' +
    `?pn=1&pz=${limit}&po=${ascending ? 0 : 1}&fid=${fid}` +
    `&fs=${encodeURIComponent(fs)}&fields=${fields}`
  const result = await getJSON(url, { headers: QUOTE_REFERER })
  if (!result.ok) return []
  return diffRows(result.body)
}

const SECTOR_FIELDS = 'f12,f14,f3,f62,f104,f105,f128,f136'

/** 行业/概念板块列表。 */
export async function fetchSectors({
  kind = 'industry',
  sort = 'change',
  limit = 60,
}: {
  kind?: 'industry' | 'concept'
  sort?: 'change' | 'moneyflow'
  limit?: number
} = {}) {
  const fs = kind === 'concept' ? 'm:90+t:3' : 'm:90+t:2'
  const rows = await clist({ fs, fields: SECTOR_FIELDS, fid: sort === 'moneyflow' ? 'f62' : 'f3', limit })
  return rows
    .map((row) => ({
      code: str(row.f12),
      name: str(row.f14),
      kind,
      changePct: num(row.f3),
      mainNet: num(row.f62),
      upCount: num(row.f104),
      downCount: num(row.f105),
      leaderName: str(row.f128),
      leaderChangePct: num(row.f136),
    }))
    .filter((row) => row.code)
}

/** 板块成分股。 */
export async function fetchConstituents(code: string, limit = 40) {
  const rows = await clist({
    fs: `b:${code}`,
    fields: 'f12,f13,f14,f2,f3,f62',
    fid: 'f3',
    limit,
  })
  return rows
    .map((row) => ({
      code: str(row.f12),
      marketFlag: num(row.f13),
      name: str(row.f14),
      price: num(row.f2),
      changePct: num(row.f3),
      mainNet: num(row.f62),
    }))
    .filter((row) => row.code)
}

const ALL_A = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048'

/** 全市场主力资金排行。`ascending = !inflow`。 */
export async function fetchMoneyRank({ inflow = true, limit = 30 }: { inflow?: boolean; limit?: number } = {}) {
  const rows = await clist({
    fs: ALL_A,
    fields: 'f12,f13,f14,f2,f3,f62,f184,f100',
    fid: 'f62',
    limit,
    ascending: !inflow,
  })
  return rows
    .map((row) => ({
      code: str(row.f12),
      marketFlag: num(row.f13),
      name: str(row.f14),
      price: num(row.f2),
      changePct: num(row.f3),
      mainNet: num(row.f62),
      mainRatio: num(row.f184),
      sector: str(row.f100),
    }))
    .filter((row) => row.code)
}

/** 选股扫描：拉前 400 再本地过滤。`marketCapYi = f20/1e8`。 */
export async function fetchScreenerUniverse(limit = 400) {
  const rows = await clist({
    fs: ALL_A,
    fields: 'f12,f13,f14,f2,f3,f8,f9,f23,f20,f62,f100',
    fid: 'f3',
    limit,
  })
  return rows
    .map((row) => ({
      code: str(row.f12),
      marketFlag: num(row.f13),
      name: str(row.f14),
      price: num(row.f2),
      changePct: num(row.f3),
      turnover: num(row.f8),
      pe: num(row.f9),
      pb: num(row.f23),
      marketCapYi: num(row.f20) / 1e8,
      mainNet: num(row.f62),
      industry: str(row.f100),
    }))
    .filter((row) => row.code)
}

/** 个股资金流（近 n 日）。`data.klines[]` 每行 `日期,主力,小单,中单,大单,超大单`，单位元。 */
interface FundFlowResponse {
  data?: { klines?: unknown[] }
}

export async function fetchFundFlow(secidValue: string | null | undefined, days = 60) {
  if (!secidValue) return []
  const url =
    'https://push2.eastmoney.com/api/qt/stock/fflow/kline/get' +
    `?lmt=${Math.max(1, Math.min(120, days))}&klt=101&secid=${secidValue}` +
    '&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56'
  const result = await getJSON<FundFlowResponse>(url, { headers: QUOTE_REFERER })
  if (!result.ok) return []
  const klines = result.body && result.body.data ? result.body.data.klines : null
  if (!Array.isArray(klines)) return []
  return klines.map((line) => {
    const parts = String(line).split(',')
    return {
      date: parts[0],
      mainNet: num(parts[1]),
      smallNet: num(parts[2]),
      midNet: num(parts[3]),
      bigNet: num(parts[4]),
      superNet: num(parts[5]),
    }
  })
}

// —— 市场情绪（涨跌停 / 炸板池）——

const POOLS = {
  up: { path: 'getTopicZTPool', dpt: 'wz.ztzt' },
  down: { path: 'getTopicDTPool', dpt: 'wz.dtzt' },
  broken: { path: 'getTopicZBPool', dpt: 'wz.zbgc' },
} as const

type PoolKind = keyof typeof POOLS
interface PoolResponse {
  data?: { pool?: unknown[] }
}

async function pool(kind: PoolKind, ymd: string): Promise<Array<Record<string, unknown>>> {
  const spec = POOLS[kind]
  const url =
    `https://push2ex.eastmoney.com/${spec.path}` +
    `?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=${spec.dpt}&Pageindex=0&pagesize=300&sort=fbt%3Aasc&date=${ymd}&_=0`
  const result = await getJSON<PoolResponse>(url, { headers: QUOTE_REFERER })
  if (!result.ok) return []
  const rows = result.body && result.body.data ? result.body.data.pool : null
  return Array.isArray(rows) ? rows.filter(isRecord) : []
}

/**
 * 市场情绪。三个池并发。`date` 用**上海时区**的 yyyyMMdd。
 * **涨停池为空即视为当日无数据，整体返回 null**（不要拿跌停数凑一个假面板）。
 */
export async function fetchBreadth(now: number) {
  const ymd = shanghaiYMD(now)
  const [up, down, broken] = await Promise.all([pool('up', ymd), pool('down', ymd), pool('broken', ymd)])
  if (up.length === 0) return null

  let maxContBoards = 0
  let contLeaderName = ''
  for (const row of up) {
    const boards = num(row.lbc, 0) || (isRecord(row.zttj) ? num(row.zttj.ct, 0) : 0) || 1
    if (boards > maxContBoards) {
      maxContBoards = boards
      contLeaderName = str(row.n)
    }
  }
  const limitUp = up.length
  const brokenBoard = broken.length
  return {
    tradeDate: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    limitUp,
    limitDown: down.length,
    brokenBoard,
    maxContBoards,
    contLeaderName,
    limitUpRatio: limitUp + brokenBoard > 0 ? (limitUp / (limitUp + brokenBoard)) * 100 : 0,
  }
}
