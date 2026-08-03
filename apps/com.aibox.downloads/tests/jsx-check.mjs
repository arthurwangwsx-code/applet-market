#!/usr/bin/env node
// 用**运行时同一份 Sucrase** 转译 com.aibox.downloads 的每个源文件，再用桩 react 真正 import 一遍。
// 目的：在提交前抓住「转译期不报错、运行时炸掉整个模块 → 白屏」的那类问题。
//
//   node apps/com.aibox.downloads/tests/jsx-check.mjs

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')
// 宿主运行时资产（Sucrase 就是页面里那一份）。不在这个位置时跳过，不阻断。
const RUNTIME = path.resolve(HERE, '../../../../WebAssets/applet-runtime')
const OUT = path.join(process.env.SCRATCH ?? '/tmp', 'downloads-jsx-check')

if (!fs.existsSync(path.join(RUNTIME, 'node_modules', 'sucrase'))) {
  console.log(`! 找不到宿主运行时的 sucrase（${RUNTIME}），跳过转译检查`)
  process.exit(0)
}
const require = createRequire(`${RUNTIME}/package.json`)
const { transform } = require('sucrase')

// —— 桩 react：只需能被 import，模块顶层不会真的渲染 ——
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, 'node_modules', 'react'), { recursive: true })
fs.writeFileSync(path.join(OUT, 'node_modules', 'react', 'package.json'),
  JSON.stringify({ name: 'react', version: '18.0.0', type: 'module', main: 'index.js' }))
fs.writeFileSync(path.join(OUT, 'node_modules', 'react', 'index.js'), `
const noop = () => {}
const hook = (v) => [typeof v === 'function' ? v() : v, noop]
const React = {
  createElement: (...a) => ({ __el: a }),
  Fragment: Symbol('Fragment'),
  useState: hook,
  useRef: (v) => ({ current: v }),
  useEffect: noop,
  useMemo: (f) => f(),
  useCallback: (f) => f,
  createContext: () => ({}),
}
export default React
export const { createElement, Fragment, useState, useRef, useEffect, useMemo, useCallback } = React
`)
fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify({ name: 'check', type: 'module' }))

function walk(dir, prefix = '') {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel))
    else if (/\.(jsx?|mjs)$/.test(entry.name)) out.push(rel)
  }
  return out
}

const files = walk(SRC).sort()
const failures = []
let transformed = 0

for (const rel of files) {
  const source = fs.readFileSync(path.join(SRC, rel), 'utf8')
  let code
  try {
    // 与宿主运行时相同的两个 transform：jsx + imports 保留为 ESM。
    code = transform(source, {
      transforms: ['jsx'],
      jsxRuntime: 'classic',
      filePath: rel,
      production: true,
    }).code
    transformed += 1
  } catch (error) {
    failures.push(`转译失败 ${rel}\n    ${String(error.message).split('\n')[0]}`)
    continue
  }
  // 相对 import 一律改成 .js，落到镜像目录里。
  const target = path.join(OUT, rel.replace(/\.jsx$/, '.js'))
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, code.replace(/(['"])(\.[^'"]*?)\.jsx\1/g, '$1$2.js$1'))
}

if (failures.length > 0) {
  console.log(`✗ ${failures.length} 个文件转译失败\n`)
  for (const line of failures) console.log(`  ✗ ${line}`)
  process.exit(1)
}
console.log(`✓ Sucrase 转译通过：${transformed} 个文件`)

// —— 真的 import 一遍，抓 import 名字写错 / 循环依赖 / 顶层求值报错 ——
const loadFailures = []
for (const rel of files) {
  const target = path.join(OUT, rel.replace(/\.jsx$/, '.js'))
  try {
    await import(target)
  } catch (error) {
    loadFailures.push(`${rel}\n    ${String(error.message).split('\n')[0]}`)
  }
}

if (loadFailures.length > 0) {
  console.log(`\n✗ ${loadFailures.length} 个模块加载失败\n`)
  for (const line of loadFailures) console.log(`  ✗ ${line}`)
  process.exit(1)
}
console.log(`✓ 模块加载通过：${files.length} 个文件（含全部 JSX 组件）`)

// —— app.jsx 必须 export default ——
const app = await import(path.join(OUT, 'app.js'))
if (typeof app.default !== 'function') {
  console.log('\n✗ app.jsx 没有 export default 一个组件函数')
  process.exit(1)
}
console.log('✓ app.jsx export default 是组件函数')
