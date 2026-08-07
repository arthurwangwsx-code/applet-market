#!/usr/bin/env node
//
//  audit-result-schema.mjs
//  返回类型覆盖率**棘轮**：未声明 `resultSchemaJSON` 的桥方法数只减不增。
//
//  ## 为什么要这条闸门
//  `AppletCapabilityDescriptor` 长期是不对称的：入参有机器可读 schema，返回只有散文 `resultSummary`。
//  后果不是「少一点类型」，是**成规模的 `Promise<unknown>`**——2026-08-03 记为 126/185（68%），
//  一天后变成 193/243（79%）。**它在自己变糟**：每新增一条桥能力，默认就多一个 unknown。
//
//  已经付出的代价有实证：`com.aibox.voicememos` / `com.aibox.wordstudy` 各自手写 `aibox-extra.d.ts`
//  去补返回类型（删掉就是 20+ 条 `'value' is of type 'unknown'`）；`com.aibox.music` 的
//  `classifyMusicError()` 在**按英文文案子串反推枚举**，因为返回里没有机器可读的错误码。
//  换句话说：返回侧没有 schema，应用侧就会长出各自的、互相矛盾的替代品——正是 SDK 要消灭的东西。
//
//  ## 棘轮怎么算
//  逐命名空间统计「未声明返回 schema 的方法数」，与 `scripts/result-schema-baseline.json` 比（**不放 docs/api/**——那个目录被 gen-api-docs 视作全量生成物，放进去会被判成残留文件）：
//   · 某命名空间的欠账**变多** → 红（新增方法必须带返回 schema）；
//   · 出现**基线里没有的命名空间**且有欠账 → 红（新能力按 0 欠账起步，不许开新债）；
//   · 欠账变少 → 绿，并提示跑 `--update-baseline` 把进度钉死（棘轮只能往下拧）。
//
//  ## 刻意豁免：宿主工具投影
//  `HostToolProjectionCapabilityAdapter` 升格来的方法（快照里 `toolName != null`）返回的是**统一信封**
//  `{ok, text, permission, details?, progress, artifacts}`，形状由投影层保证、不逐条声明。
//  它们不计入欠账，也不允许拿来充数——`--update-baseline` 同样跳过它们。
//
//  ## 用法
//    node scripts/audit-result-schema.mjs              # 报告 + 棘轮校验（退出码 1 = 有新欠账）
//    node scripts/audit-result-schema.mjs --report     # 只看报告，不判红
//    node scripts/audit-result-schema.mjs --update-baseline
//

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SNAPSHOT = path.join(ROOT, 'docs', 'api', 'capabilities.snapshot.json')
const BASELINE = path.join(HERE, 'result-schema-baseline.json')

const argv = new Set(process.argv.slice(2))
const REPORT_ONLY = argv.has('--report')
const UPDATE = argv.has('--update-baseline')

function loadSnapshot() {
  if (!fs.existsSync(SNAPSHOT)) {
    console.error(`找不到快照 ${path.relative(ROOT, SNAPSHOT)} —— 先跑 node scripts/gen-api-docs.mjs`)
    process.exit(2)
  }
  return JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'))
}

/** 参与统计的方法：排除宿主工具投影（统一信封，按类型豁免）。 */
function counted(method) {
  return method.toolName == null
}

function tally(snapshot) {
  // 手写 TS 签名覆盖的命名空间：补 resultSchemaJSON **不会改变它们的类型**，只改文档。
  // 混在一起统计会得到一个骗人的覆盖率，所以分开算——棘轮只对「生成」那批硬判红。
  const handwritten = new Set(snapshot.handwritten ?? [])
  const perNamespace = new Map()
  const cosmetic = new Map()
  let total = 0
  let typed = 0
  let exempt = 0
  let cosmeticTotal = 0
  for (const ns of snapshot.namespaces) {
    const isHandwritten = handwritten.has(ns.namespace)
    let missing = 0
    for (const method of ns.methods) {
      if (!counted(method)) {
        exempt += 1
        continue
      }
      if (isHandwritten) {
        cosmeticTotal += 1
        if (!method.resultSchemaJSON) missing += 1
        continue
      }
      total += 1
      if (method.resultSchemaJSON) typed += 1
      else missing += 1
    }
    if (missing > 0) (isHandwritten ? cosmetic : perNamespace).set(ns.namespace, missing)
  }
  return { perNamespace, cosmetic, total, typed, exempt, cosmeticTotal }
}

const snapshot = loadSnapshot()
const { perNamespace, cosmetic, total, typed, exempt, cosmeticTotal } = tally(snapshot)
const current = Object.fromEntries([...perNamespace.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))

if (UPDATE) {
  const payload = {
    // 这个文件是**欠账快照**，不是配置：数字只应该变小。变大意味着有人新增了没有返回 schema 的桥方法。
    _doc: '未声明 resultSchemaJSON 的方法数（按命名空间）。只减不增；由 scripts/audit-result-schema.mjs 维护。',
    _generatedFrom: 'docs/api/capabilities.snapshot.json',
    untypedByNamespace: current,
  }
  fs.writeFileSync(BASELINE, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`已更新基线：${Object.keys(current).length} 个命名空间仍有欠账，共 ${total - typed} 条。`)
  process.exit(0)
}

const coverage = total === 0 ? 100 : Math.round((typed / total) * 1000) / 10
console.log(
  `返回类型覆盖：${typed}/${total}（${coverage}%）—— 只算**生成签名**的命名空间，那是真正吃 Promise<unknown> 的那批。`,
)
const cosmeticMissing = [...cosmetic.values()].reduce((a, b) => a + b, 0)
console.log(
  `另有 ${exempt} 条工具投影按类型豁免；${cosmeticMissing}/${cosmeticTotal} 条落在手写签名命名空间` +
    `（${[...cosmetic.keys()].sort().join(' ') || '无'}）——补了只改文档、不改类型，故不进棘轮。`,
)

if (perNamespace.size > 0) {
  const worst = [...perNamespace.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  console.log(`欠账最多的命名空间：${worst.map(([ns, n]) => `${ns}(${n})`).join(' · ')}`)
}

if (!fs.existsSync(BASELINE)) {
  console.error(
    `\n缺少基线 ${path.relative(ROOT, BASELINE)} —— 先跑：node scripts/audit-result-schema.mjs --update-baseline`,
  )
  process.exit(REPORT_ONLY ? 0 : 2)
}

const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).untypedByNamespace ?? {}
const regressions = []
const improvements = []
for (const [ns, missing] of Object.entries(current)) {
  const allowed = baseline[ns] ?? 0
  if (missing > allowed) regressions.push({ ns, missing, allowed })
}
for (const [ns, allowed] of Object.entries(baseline)) {
  const missing = current[ns] ?? 0
  if (missing < allowed) improvements.push({ ns, missing, allowed })
}

if (improvements.length > 0) {
  console.log(
    `\n↓ 欠账减少：${improvements.map((i) => `${i.ns} ${i.allowed}→${i.missing}`).join(' · ')}` +
      `\n  跑 node scripts/audit-result-schema.mjs --update-baseline 把进度钉死（棘轮只能往下拧）。`,
  )
}

if (regressions.length > 0 && !REPORT_ONLY) {
  console.error('\n❌ 新增了没有返回 schema 的桥方法：')
  for (const r of regressions) {
    console.error(`   · ${r.ns}：${r.allowed} → ${r.missing}`)
  }
  console.error(
    '\n新增桥方法必须带 `resultSchemaJSON`（与 parametersJSON 对称）。' +
      '\n照着返回值的**真实构造**写，不要照抄 resultSummary 那段散文——猜出来的类型比没有类型更糟。' +
      '\n样板见 Runtime/Capabilities/AudioRecordingCapabilityAdapter.swift。',
  )
  process.exit(1)
}

if (regressions.length > 0) {
  console.log(`\n（--report 模式：有 ${regressions.length} 处新增欠账，未判红）`)
}
console.log('\n✓ 棘轮通过：没有新增欠账。')
