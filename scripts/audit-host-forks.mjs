#!/usr/bin/env node
//
//  audit-host-forks.mjs
//  宿主适配器与 SDK 私有副本**棘轮**：不允许靠把 host.js 改名为 host.ts 假装债务消失，
//  也不允许构建产物重新携带一份 aibox-sdk 实现。
//
//  ## 为什么要这条闸门
//  同一件事在仓库里有很多个答案，是 AI 写出劣化实现的**结构性**原因——它检索到哪一份就继承哪一份。
//  逐函数比对过的实证（2026-08-03 调研）：四份 `host.js` 里 7 个函数逐字节相同，
//  差异部分是「每个应用只实现了自己当时用到的子集」加「某个应用在真机踩坑后单独修、其余三份不知情」：
//    · `ui.confirm` 不可用时，ledger 回 `null`、music 回 `false`；
//    · `openURL` news 有 12s 封顶、music 没有；
//    · 图片过 CSP，news 走 `applet://`、music 走 `data:`。
//  一天之后（2026-08-04 实测）分叉从 4 份涨到 8 份 —— **它在自己变糟**，因为新应用没有别的路可走。
//
//  ## 这条闸门不解决什么
//  `aibox/sdk` 已由宿主提供。存量 host 文件只允许保留应用领域投影；公共桥实现必须来自 SDK。
//  本闸门既阻止新增/增长，也验证每个适配器确实依赖共享 SDK，并确保 src/dist 没有 SDK 私有副本。
//
//  ## 用法
//    node scripts/audit-host-forks.mjs                 # 棘轮校验（退出码 1 = 分叉变多/变长）
//    node scripts/audit-host-forks.mjs --report        # 只看报告
//    node scripts/audit-host-forks.mjs --update-baseline
//

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const APPS = path.join(ROOT, 'apps')
const BASELINE = path.join(HERE, 'host-fork-baseline.json')

const argv = new Set(process.argv.slice(2))
const REPORT_ONLY = argv.has('--report')
const UPDATE = argv.has('--update-baseline')

/** 每个应用私有的宿主适配器。JS → TS 迁移不能改变棘轮统计。 */
function scan() {
  if (!fs.existsSync(APPS)) return {}
  const out = {}
  for (const app of fs.readdirSync(APPS).sort()) {
    const candidates = ['host.js', 'host.ts'].map((name) => path.join(APPS, app, 'src', 'lib', name))
    const file = candidates.find((candidate) => fs.existsSync(candidate))
    if (!file) continue
    const source = fs.readFileSync(file, 'utf8')
    out[app] = {
      lines: source.split('\n').length,
      file,
      usesSharedSDK: /from\s+['"](?:@aibox\/applet-sdk|aibox\/sdk)['"]/.test(source),
    }
  }
  return out
}

const current = scan()
const files = Object.keys(current).length
const linesByApp = Object.fromEntries(Object.entries(current).map(([app, value]) => [app, value.lines]))
const lines = Object.values(linesByApp).reduce((a, b) => a + b, 0)

function privateSDKCopies() {
  const copies = []
  for (const app of fs.readdirSync(APPS).sort()) {
    for (const root of ['src/lib', 'dist/lib']) {
      const dir = path.join(APPS, app, root)
      if (!fs.existsSync(dir)) continue
      for (const name of fs.readdirSync(dir)) {
        if (/^aibox-sdk(?:-react)?\.js$/.test(name)) copies.push(path.relative(ROOT, path.join(dir, name)))
      }
    }
  }
  return copies
}

if (UPDATE) {
  const payload = {
    _doc: '每个应用私有 host.js/host.ts 适配器的行数。JS 改 TS 不算删除；只有领域逻辑迁出后才应下降。',
    linesByApp,
  }
  fs.writeFileSync(BASELINE, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`已更新基线：${files} 份分叉、共 ${lines} 行。`)
  process.exit(0)
}

console.log(`宿主适配器：${files} 份、共 ${lines} 行。`)

if (!fs.existsSync(BASELINE)) {
  console.error(
    `\n缺少基线 ${path.relative(ROOT, BASELINE)} —— 先跑：node scripts/audit-host-forks.mjs --update-baseline`,
  )
  process.exit(REPORT_ONLY ? 0 : 2)
}

const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).linesByApp ?? {}
const added = Object.keys(linesByApp).filter((app) => !(app in baseline))
const grown = Object.keys(linesByApp).filter((app) => app in baseline && linesByApp[app] > baseline[app])
const removed = Object.keys(baseline).filter((app) => !(app in linesByApp))
const shrunk = Object.keys(linesByApp).filter((app) => app in baseline && linesByApp[app] < baseline[app])
const missingSharedSDK = Object.entries(current).filter(([, value]) => !value.usesSharedSDK)
const sdkCopies = privateSDKCopies()

if (removed.length > 0 || shrunk.length > 0) {
  const notes = [...removed.map((a) => `${a} 已删除`), ...shrunk.map((a) => `${a} ${baseline[a]}→${linesByApp[a]} 行`)]
  console.log(`↓ 欠账减少：${notes.join(' · ')}\n  跑 --update-baseline 把进度钉死。`)
}

const hasIssues = added.length > 0 || grown.length > 0 || missingSharedSDK.length > 0 || sdkCopies.length > 0

if (hasIssues) {
  console.error(REPORT_ONLY ? '\n! 报告发现宿主适配器或 SDK 复用问题：' : '\n❌ 宿主适配器或 SDK 复用回归：')
  for (const app of added) console.error(`   · ${app}：新增一份 host 适配器（${linesByApp[app]} 行）`)
  for (const app of grown) console.error(`   · ${app}：${baseline[app]} → ${linesByApp[app]} 行`)
  for (const [app, value] of missingSharedSDK) {
    console.error(`   · ${app}：${path.relative(ROOT, value.file)} 没有依赖共享 SDK`)
  }
  for (const copy of sdkCopies) console.error(`   · ${copy}：应用包内存在 SDK 私有副本`)
  console.error(
    '\n新应用不要再抄一份 host.js。正确路径：\n' +
      '  · bundle 型（aibox-tsbuild + TS）→ 源码依赖 `@aibox/applet-sdk`，产物重写到宿主共享 `aibox/sdk`；\n' +
      '  · 遗留 source 型 → 直接 import `aibox/sdk`，不要再复制桥实现；\n' +
      '  · SDK 仍缺能力 → 先把通用实现补进 SDK，再从应用消费。\n' +
      '每多一份分叉，AI 就多一个互相矛盾的范例可以继承（ui.confirm 回 null 还是 false、\n' +
      'openURL 要不要封顶、图片走 applet:// 还是 data: —— 这些歧义都是这么来的）。\n' +
      '\n宿主已经提供共享 SDK，host.js/host.ts 不再有合理的新增场景。只有确认是领域逻辑而非桥胶水时，\n' +
      '才可移动到业务模块；不要用更新 baseline 掩盖新增分叉。',
  )
  if (!REPORT_ONLY) process.exit(1)
}

if (!hasIssues) console.log('\n✓ 棘轮通过：适配器没有变多/变长，且应用包内没有 SDK 私有副本。')
