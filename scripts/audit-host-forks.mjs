#!/usr/bin/env node
//
//  audit-host-forks.mjs
//  `host.js` 分叉**棘轮**：每个应用自己抄一份桥胶水的份数与行数，只减不增。
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
//  它**不能**让手写应用用上 SDK：`source` 运行时下 `aibox/sdk` 裸说明符尚未注册
//  （sdk-architecture.md §3.3 方案 C / 落地顺序第 8 步，属未拍板项）。
//  在那之前，本闸门的作用是**止血**：不让欠账继续变大，并在有人新增分叉时把正确路径摆在他面前。
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

/** 每个应用私有的桥胶水文件。命名固定为 `src/lib/host.js`（四份原始分叉都叫这个）。 */
function scan() {
  if (!fs.existsSync(APPS)) return {}
  const out = {}
  for (const app of fs.readdirSync(APPS).sort()) {
    const file = path.join(APPS, app, 'src', 'lib', 'host.js')
    if (!fs.existsSync(file)) continue
    out[app] = fs.readFileSync(file, 'utf8').split('\n').length
  }
  return out
}

const current = scan()
const files = Object.keys(current).length
const lines = Object.values(current).reduce((a, b) => a + b, 0)

if (UPDATE) {
  const payload = {
    _doc: '每个应用私有 host.js 的行数。只减不增；迁到 SDK 后把该应用从这里删掉。',
    linesByApp: current,
  }
  fs.writeFileSync(BASELINE, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`已更新基线：${files} 份分叉、共 ${lines} 行。`)
  process.exit(0)
}

console.log(`host.js 分叉：${files} 份、共 ${lines} 行。`)

if (!fs.existsSync(BASELINE)) {
  console.error(`\n缺少基线 ${path.relative(ROOT, BASELINE)} —— 先跑：node scripts/audit-host-forks.mjs --update-baseline`)
  process.exit(REPORT_ONLY ? 0 : 2)
}

const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).linesByApp ?? {}
const added = Object.keys(current).filter((app) => !(app in baseline))
const grown = Object.keys(current).filter((app) => app in baseline && current[app] > baseline[app])
const removed = Object.keys(baseline).filter((app) => !(app in current))
const shrunk = Object.keys(current).filter((app) => app in baseline && current[app] < baseline[app])

if (removed.length > 0 || shrunk.length > 0) {
  const notes = [
    ...removed.map((a) => `${a} 已删除`),
    ...shrunk.map((a) => `${a} ${baseline[a]}→${current[a]} 行`),
  ]
  console.log(`↓ 欠账减少：${notes.join(' · ')}\n  跑 --update-baseline 把进度钉死。`)
}

if ((added.length > 0 || grown.length > 0) && !REPORT_ONLY) {
  console.error('\n❌ 桥胶水分叉变多或变长：')
  for (const app of added) console.error(`   · ${app}：新增一份 host.js（${current[app]} 行）`)
  for (const app of grown) console.error(`   · ${app}：${baseline[app]} → ${current[app]} 行`)
  console.error(
    '\n新应用不要再抄一份 host.js。正确路径：\n' +
      '  · bundle 型（Vite + TS）→ 依赖 `@aibox/applet-sdk`，类型与实现都是生成/共享的；\n' +
      '  · 已有的手写应用要加能力 → 优先把那段实现补进 SDK，再从 SDK 用。\n' +
      '每多一份分叉，AI 就多一个互相矛盾的范例可以继承（ui.confirm 回 null 还是 false、\n' +
      'openURL 要不要封顶、图片走 applet:// 还是 data: —— 这些歧义都是这么来的）。\n' +
      '\n若这是既有应用**不得不**增长（source 运行时下 SDK 裸说明符尚未注册，见 sdk-architecture.md\n' +
      '§3.3 / 落地顺序第 8 步），跑 `node scripts/audit-host-forks.mjs --update-baseline` 显式记一笔账——\n' +
      '要的是「有人看见并决定了」，不是悄悄变大。',
  )
  process.exit(1)
}

console.log('\n✓ 棘轮通过：分叉没有变多、也没有变长。')
