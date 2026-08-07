#!/usr/bin/env node
// 本地与 CI 的统一验证入口。单项脚本仍可独立排障，但提交前只需要记住 `npm run verify`。

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { appPaths, fail, listAppIDs, ok, readJSON, ROOT } from './lib/market.mjs'

const args = process.argv.slice(2)
const scopeIndex = args.indexOf('--scope')
const requestedScope = scopeIndex >= 0 ? args[scopeIndex + 1] : 'all'
const allowedScopes = new Set(['all', 'tooling', 'build', 'package'])
if (!allowedScopes.has(requestedScope)) {
  fail(`未知 scope ${requestedScope}；可选 all / tooling / build / package`)
  process.exit(1)
}

function section(title) {
  console.log(`\n== ${title} ==`)
}

function run(command, commandArgs, options = {}) {
  console.log(`\n$ ${command} ${commandArgs.join(' ')}`)
  execFileSync(command, commandArgs, { cwd: ROOT, stdio: 'inherit', ...options })
}

function npm(script, extra = []) {
  run('npm', ['run', script, ...(extra.length ? ['--', ...extra] : [])])
}

function generatedIndexSnapshot() {
  const files = [path.join(ROOT, 'registry.json')]
  for (const appId of listAppIDs()) files.push(appPaths(appId).releasesJSON)
  return new Map(files.map((file) => [file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null]))
}

function verifyTooling() {
  section('工程格式与合同')
  npm('format:check')
  npm('lint')
  run(process.execPath, ['scripts/audit-runtime-contracts.mjs'])
  run(process.execPath, ['scripts/audit-typescript-policy.mjs'])
  run(process.execPath, ['scripts/audit-budgets.mjs'])
  npm('sdk:types:check')
  run(process.execPath, ['scripts/gen-api-docs.mjs', '--check'])
  run(process.execPath, ['scripts/gen-facts.mjs', '--check'])
  npm('audit:result-schema')
  npm('audit:host-forks')
  npm('audit:hand-rolled-touch')
  npm('audit:undefined-names')
  run(process.execPath, ['--test', 'scripts/tests/tooling.test.mjs'])
  run(process.execPath, ['packages/aibox-tsbuild/tests/runtime-sharing.test.mjs'])
}

function verifyBuild() {
  section('SDK 与应用构建')
  npm('sdk:build')
  run('npm', ['test', '--workspace', '@aibox/applet-sdk'])
  for (const appId of listAppIDs()) {
    const paths = appPaths(appId)
    if (!fs.existsSync(paths.packageJSON))
      throw new Error(`${paths.relative} 缺少 package.json；新应用必须进入 TS 构建链`)
    const pkg = readJSON(paths.packageJSON)
    for (const script of ['typecheck', 'check:build']) {
      if (!pkg.scripts?.[script]) throw new Error(`${paths.relative} 缺少 npm script: ${script}`)
      run('npm', ['run', script, '--prefix', paths.dir])
    }
  }
}

function verifyPackage() {
  section('市场包、索引与发布冒烟')
  npm('validate')
  const before = generatedIndexSnapshot()
  npm('registry')
  const changed = [...before].filter(([file, content]) => {
    const next = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
    return next !== content
  })
  if (changed.length > 0) {
    throw new Error(`索引与磁盘真值不一致，已重建：${changed.map(([file]) => path.relative(ROOT, file)).join(', ')}`)
  }
  run(process.execPath, ['scripts/release.mjs', '--dry-run-latest'])
}

try {
  if (requestedScope === 'all' || requestedScope === 'tooling') verifyTooling()
  if (requestedScope === 'all' || requestedScope === 'build') verifyBuild()
  if (requestedScope === 'all' || requestedScope === 'package') verifyPackage()
  if (args.includes('--ci')) {
    section('CI 可复现工作树')
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' })
    if (status.trim()) throw new Error(`验证命令产生了未提交漂移：\n${status}`)
  }
  ok(`统一验证通过（scope=${requestedScope}）`)
} catch (error) {
  fail(String(error.message ?? error))
  process.exit(1)
}
