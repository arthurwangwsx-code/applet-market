#!/usr/bin/env node
//
//  gen-facts.mjs
//  「事实基线」生成器：把手写文档里**会过期的那些数字**改成生成的。
//
//  ## 为什么
//  `docs/capabilities/applet/sdk-architecture.md` 是一份高质量调研，但它的头部数字**一天就全错了**：
//    39 个命名空间 → 47 ｜ 185 个方法 → 252 ｜ 7 个应用 → 11 ｜ 4 份 host.js → 8 ｜ 68% unknown → 更高
//  这不是作者不认真，是**手写的统计数字没有保鲜机制**：`docs-audit.py` 管链接与索引，不管正文断言。
//  于是「文档写着 4 份分叉」和「实际 8 份」可以长期共存，而读者（包括 AI）会照着过期数字做判断。
//
//  做法：数字只从真值源现算，写进两个地方——
//    ① `applet-market/docs/facts.md`（市场侧，CI 用 --check 守；不放 docs/api/——那是 descriptor 的全量生成目录）；
//    ② 宿主仓库 `docs/capabilities/applet/sdk-architecture.md` 里的标记块
//       `<!-- FACTS:BEGIN -->…<!-- FACTS:END -->`（宿主不在场时跳过）。
//
//  ## 用法
//    node scripts/gen-facts.mjs            # 生成/覆盖
//    node scripts/gen-facts.mjs --check    # 漂移检查（退出码 1 = 数字过期）
//

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SNAPSHOT = path.join(ROOT, 'docs', 'api', 'capabilities.snapshot.json')
const DTS = path.join(ROOT, 'packages', 'aibox-sdk', 'src', 'generated', 'aibox-global.d.ts')
const OUT = path.join(ROOT, 'docs', 'facts.md')
const CHECK = process.argv.includes('--check')

const BEGIN = '<!-- FACTS:BEGIN -->'
const END = '<!-- FACTS:END -->'

function hostDoc() {
  const candidate = path.resolve(ROOT, '..', 'docs', 'capabilities', 'applet', 'sdk-architecture.md')
  return fs.existsSync(candidate) ? candidate : null
}

function countLines(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').length : 0
}

function collect() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'))
  const methods = snapshot.namespaces.flatMap((ns) => ns.methods)
  const projected = methods.filter((m) => m.toolName != null)
  const declarable = methods.filter((m) => m.toolName == null)
  const typed = declarable.filter((m) => m.resultSchemaJSON)
  // 手写签名的命名空间补 schema 只改文档、不改类型，故覆盖率要分开报——
  // 混在一起的那个数会同时低估进度、又掩盖真正的欠账在哪。
  const handwritten = new Set(snapshot.handwritten ?? [])
  const generatedNs = snapshot.namespaces.filter((ns) => !handwritten.has(ns.namespace))
  const generatedMethods = generatedNs.flatMap((ns) => ns.methods).filter((m) => m.toolName == null)
  const generatedTyped = generatedMethods.filter((m) => m.resultSchemaJSON)

  const dts = fs.existsSync(DTS) ? fs.readFileSync(DTS, 'utf8') : ''
  const dtsSignatures = (dts.match(/^\s+(?:function\s+)?[\w"'.]+\(/gm) ?? []).length
  const dtsUnknown = (dts.match(/Promise<unknown>/g) ?? []).length

  const appsDir = path.join(ROOT, 'apps')
  const apps = fs.existsSync(appsDir) ? fs.readdirSync(appsDir).filter((d) => !d.startsWith('.')).sort() : []
  const bundleApps = apps.filter((a) => fs.existsSync(path.join(appsDir, a, 'package.json')))
  const sdkApps = bundleApps.filter((a) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(appsDir, a, 'package.json'), 'utf8'))
    return Boolean({ ...pkg.dependencies, ...pkg.devDependencies }['@aibox/applet-sdk'])
  })
  const forks = apps
    .map((a) => ({ app: a, file: path.join(appsDir, a, 'src', 'lib', 'host.js') }))
    .filter((e) => fs.existsSync(e.file))
  const forkLines = forks.reduce((sum, e) => sum + countLines(e.file), 0)

  const sdkPkgPath = path.join(ROOT, 'packages', 'aibox-sdk', 'package.json')
  const sdkVersion = fs.existsSync(sdkPkgPath) ? JSON.parse(fs.readFileSync(sdkPkgPath, 'utf8')).version : '—'
  const sdkSrcDir = path.join(ROOT, 'packages', 'aibox-sdk', 'src')
  const sdkModules = fs.existsSync(sdkSrcDir) ? fs.readdirSync(sdkSrcDir).filter((f) => f.endsWith('.ts')) : []
  const sdkLines = sdkModules.reduce((sum, f) => sum + countLines(path.join(sdkSrcDir, f)), 0)

  return {
    namespaces: snapshot.namespaces.length,
    methods: methods.length,
    declarable: declarable.length,
    projected: projected.length,
    typed: typed.length,
    coverage: declarable.length === 0 ? 100 : Math.round((typed.length / declarable.length) * 1000) / 10,
    generatedTotal: generatedMethods.length,
    generatedTyped: generatedTyped.length,
    generatedCoverage:
      generatedMethods.length === 0 ? 100 : Math.round((generatedTyped.length / generatedMethods.length) * 1000) / 10,
    dtsLines: countLines(DTS),
    dtsSignatures,
    dtsUnknown,
    apps: apps.length,
    bundleApps: bundleApps.length,
    sdkApps: sdkApps.length,
    forks: forks.length,
    forkLines,
    sdkVersion,
    sdkModules: sdkModules.length,
    sdkLines,
  }
}

function renderBlock(f) {
  return [
    BEGIN,
    '<!-- 由 applet-market/scripts/gen-facts.mjs 生成，请勿手改。刷新： node scripts/gen-facts.mjs -->',
    '',
    '| 事实 | 当前值 | 真值源 |',
    '|---|---|---|',
    `| 桥命名空间 | ${f.namespaces} | \`docs/api/capabilities.snapshot.json\` |`,
    `| 桥方法（合计 / 可声明 / 工具投影） | ${f.methods} / ${f.declarable} / ${f.projected} | 同上 |`,
    `| **返回类型覆盖（生成签名）** | ${f.generatedTyped}/${f.generatedTotal}（${f.generatedCoverage}%）—— 真正吃 \`Promise<unknown>\` 的那批 | \`resultSchemaJSON\` 字段 |`,
    `| 返回类型覆盖（含手写签名命名空间） | ${f.typed}/${f.declarable}（${f.coverage}%）—— 其余那批补了只改文档 | 同上 |`,
    `| 生成的 \`aibox-global.d.ts\` | ${f.dtsLines} 行 / ${f.dtsSignatures} 个签名 / ${f.dtsUnknown} 个 \`Promise<unknown>\` | \`packages/aibox-sdk/src/generated/\` |`,
    `| 市场应用（总数 / bundle 型 / 用 SDK） | ${f.apps} / ${f.bundleApps} / ${f.sdkApps} | \`apps/*/package.json\` |`,
    `| \`host.js\` 分叉 | ${f.forks} 份、${f.forkLines} 行 | \`apps/*/src/lib/host.js\` |`,
    `| SDK | v${f.sdkVersion}，${f.sdkModules} 个模块 / ${f.sdkLines} 行 | \`packages/aibox-sdk/\` |`,
    '',
    END,
  ].join('\n')
}

const facts = collect()
const block = renderBlock(facts)

const doc = [
  '# 小应用平台事实基线（生成）',
  '',
  '> 手写文档里凡是「几个命名空间 / 几个方法 / 覆盖率多少 / 几份分叉」这类数字，**一律引用本页**，',
  '> 不要抄进正文——抄进去的数字一天就会过期（2026-08-03→04 实测：命名空间 39→47、应用 7→11、分叉 4→8）。',
  '',
  block,
  '',
  '## 怎么读这几个数',
  '',
  '- **返回类型覆盖**是这条链上最关键的单一指标：未覆盖的方法在 SDK 与 `.aibox/aibox.d.ts` 里都是',
  '  `Promise<unknown>`，应用侧只能自己手写补丁或按文案猜。由 `audit-result-schema.mjs` 棘轮只减不增。',
  '- **工具投影**那部分不计入覆盖率：它们返回统一信封，形状由投影层保证，按类型豁免。',
  '- **`host.js` 分叉**是「同一件事有几个答案」的直接度量。它每多一份，AI 就多一个可继承的矛盾范例。',
  '',
].join('\n')

function write(file, content) {
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  if (old === content) return false
  if (CHECK) {
    console.error(`❌ 事实基线已过期：${path.relative(ROOT, file)}`)
    console.error('   刷新： node scripts/gen-facts.mjs')
    process.exitCode = 1
    return false
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  return true
}

let wrote = write(OUT, doc)

const host = hostDoc()
if (host) {
  const source = fs.readFileSync(host, 'utf8')
  const start = source.indexOf(BEGIN)
  const stop = source.indexOf(END)
  if (start >= 0 && stop > start) {
    const next = source.slice(0, start) + block + source.slice(stop + END.length)
    if (write(host, next)) wrote = true
  }
  // 没有标记块 = 那份文档还没接入生成机制；不擅自插入（正文位置由作者决定）。
}

if (CHECK) {
  if (process.exitCode === 1) process.exit(1)
  console.log(`✓ 事实基线是最新的（${facts.namespaces} 个命名空间、返回类型覆盖 ${facts.coverage}%）。`)
} else {
  console.log(
    wrote
      ? `✓ 已写入事实基线（${facts.namespaces} 个命名空间、${facts.declarable} 个可声明方法、覆盖 ${facts.coverage}%）。`
      : '事实基线无变化。',
  )
}
