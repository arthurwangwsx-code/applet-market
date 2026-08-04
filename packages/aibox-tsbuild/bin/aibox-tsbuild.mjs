#!/usr/bin/env node
// 用法：
//   aibox-tsbuild               # 在应用目录里跑：src/** → dist/**
//   aibox-tsbuild --check       # 只校验：产物与磁盘不一致即退出 1（CI 的可复现闸门）
//   aibox-tsbuild --app <dir>   # 指定应用目录

import path from 'node:path'
import { buildApplet } from '../index.mjs'

const argv = process.argv.slice(2)
const check = argv.includes('--check')
const appIndex = argv.indexOf('--app')
const appDir = path.resolve(appIndex >= 0 ? argv[appIndex + 1] : process.cwd())

try {
  const { emitted, drift } = await buildApplet({ appDir, check })
  if (check) {
    if (drift.length) {
      console.error(`❌ dist/ 与 src/ 重新编译的结果不一致（${drift.length} 个文件）：`)
      for (const file of drift.slice(0, 20)) console.error(`   · ${file}`)
      console.error('\n有人手改了产物，或构建不可复现。修法：在应用目录里跑 npm run build，然后提交 dist/。')
      process.exit(1)
    }
    console.log(`✓ 产物与源一致（${emitted} 个文件）`)
  } else {
    console.log(`✓ 已生成 dist/（${emitted} 个文件）—— 保结构多文件 ESM，端上零转译`)
  }
} catch (error) {
  console.error(`❌ ${error.message ?? error}`)
  process.exit(1)
}
