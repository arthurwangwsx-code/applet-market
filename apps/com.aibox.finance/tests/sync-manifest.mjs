#!/usr/bin/env node
// 从 src/lib/tool-defs.js 生成 src/manifest.json 的 `actions[]`。
//
// 为什么要生成而不是手写：23 个工具的 `inputSchemaJSON` 是**转义后的 JSON 字符串**，
// 手写必然漂移；而 schema 一旦与 handler 对不上，AI 就会用错参数名静默失败。
// descriptor 单一真值 = tool-defs.js，这里只做投影。
//
//   node apps/com.aibox.finance/tests/sync-manifest.mjs          # 写入
//   node apps/com.aibox.finance/tests/sync-manifest.mjs --check  # 只校验是否已同步（CI 用）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { manifestActions } from '../src/lib/tool-defs.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, 'src', 'manifest.json')

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const actions = manifestActions()
const next = { ...manifest, actions }
const serialized = `${JSON.stringify(next, null, 2)}\n`

if (process.argv.includes('--check')) {
  const current = fs.readFileSync(manifestPath, 'utf8')
  if (current !== serialized) {
    console.error('✗ manifest.json 的 actions[] 与 tool-defs.js 不同步，重跑 sync-manifest.mjs')
    process.exit(1)
  }
  console.log(`✓ manifest.actions 已同步（${actions.length} 个工具）`)
  process.exit(0)
}

fs.writeFileSync(manifestPath, serialized, 'utf8')
console.log(`✓ 已写入 ${actions.length} 个 action 到 src/manifest.json`)
for (const action of actions) {
  console.log(`  ${action.readOnly ? 'read ' : 'WRITE'} ${action.name}`)
}
