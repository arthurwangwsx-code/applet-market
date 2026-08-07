#!/usr/bin/env node
// 包体与静态性能预算：绝对上限 + 当前基线棘轮。

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { appPaths, collectBundleEntries, fail, listAppIDs, ok, readJSON, ROOT, warn, writeJSON } from './lib/market.mjs'

const CONFIG = path.join(ROOT, 'config/applet-budgets.json')
const CODE_RE = /\.(?:js|jsx|ts|tsx|mjs)$/

function sourceFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'releases') continue
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...sourceFiles(path.join(dir, entry.name), relative))
    else if (CODE_RE.test(relative) && !relative.endsWith('.d.ts')) out.push(relative)
  }
  return out.sort()
}

function staticRisks(source, fileName) {
  const kind = /\.tsx?$/.test(fileName)
    ? ts.ScriptKind.TSX
    : /\.jsx$/.test(fileName)
      ? ts.ScriptKind.JSX
      : ts.ScriptKind.JS
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind)
  let intervalCalls = 0
  let rafCalls = 0
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(file)
      if (name === 'setInterval' || name === 'window.setInterval') intervalCalls += 1
      if (name === 'requestAnimationFrame' || name === 'window.requestAnimationFrame') rafCalls += 1
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return {
    intervalCalls,
    rafCalls,
    infiniteAnimations: (source.match(/\banimation(?:Name)?\s*[:=][^\n;}]*(?:infinite|Infinity)/g) ?? []).length,
    dynamicClasses: (source.match(/(?:className|class)\s*=\s*\{?`[^`]*\$\{/g) ?? []).length,
  }
}

function addRisks(total, next) {
  for (const key of Object.keys(total)) total[key] += next[key] ?? 0
}

export function measureApp(appId) {
  const paths = appPaths(appId)
  const entries = collectBundleEntries(appId)
  let packageBytes = 0
  let javascriptBytes = 0
  let largestModuleBytes = 0
  let sourceFileCount = 0
  const oversizeSourceFiles = {}
  const risks = { intervalCalls: 0, rafCalls: 0, infiniteAnimations: 0, dynamicClasses: 0 }
  let sourcemaps = 0
  for (const { absDir, relative } of entries) {
    const bytes = fs.statSync(path.join(absDir, relative)).size
    packageBytes += bytes
    if (/\.(?:js|mjs)$/.test(relative)) {
      javascriptBytes += bytes
      largestModuleBytes = Math.max(largestModuleBytes, bytes)
    }
    if (relative.endsWith('.map')) sourcemaps += 1
  }
  for (const relative of sourceFiles(paths.srcDir)) {
    sourceFileCount += 1
    const source = fs.readFileSync(path.join(paths.srcDir, relative), 'utf8')
    const lines = source.split(/\r?\n/).length
    if (lines > 800) oversizeSourceFiles[`${paths.relative}/src/${relative}`] = lines
    addRisks(risks, staticRisks(source, relative))
  }
  return {
    packageBytes,
    javascriptBytes,
    fileCount: entries.length,
    largestModuleBytes,
    sourceFileCount,
    sourcemaps,
    risks,
    oversizeSourceFiles,
  }
}

function main() {
  const measurements = Object.fromEntries(listAppIDs().map((appId) => [appId, measureApp(appId)]))
  if (process.argv.includes('--update')) {
    const previous = fs.existsSync(CONFIG) ? readJSON(CONFIG) : {}
    writeJSON(CONFIG, {
      schemaVersion: 1,
      limits: previous.limits ?? {
        maxPackageBytes: 786432,
        maxJavaScriptBytes: 716800,
        maxFileCount: 180,
        maxLargestModuleBytes: 131072,
        maxNewSourceLines: 800,
      },
      tolerance: previous.tolerance ?? {
        packageBytes: 16384,
        javascriptBytes: 16384,
        fileCount: 4,
        largestModuleBytes: 8192,
      },
      baselines: measurements,
    })
    ok(`已刷新 ${path.relative(ROOT, CONFIG)}；包体增长与新增常驻任务必须人工审阅`)
    return
  }
  if (!fs.existsSync(CONFIG)) {
    fail(`缺少 ${path.relative(ROOT, CONFIG)}；先运行 npm run budgets:update`)
    process.exitCode = 1
    return
  }
  const config = readJSON(CONFIG)
  const limits = config.limits ?? {}
  const tolerance = config.tolerance ?? {}
  const errors = []
  for (const [appId, current] of Object.entries(measurements)) {
    const baseline = config.baselines?.[appId]
    if (!baseline) {
      errors.push(`${appId} 没有预算基线；构建后运行 npm run budgets:update 并审阅新增预算`)
      continue
    }
    for (const [metric, limitName] of [
      ['packageBytes', 'maxPackageBytes'],
      ['javascriptBytes', 'maxJavaScriptBytes'],
      ['fileCount', 'maxFileCount'],
      ['largestModuleBytes', 'maxLargestModuleBytes'],
    ]) {
      if (current[metric] > limits[limitName]) {
        errors.push(`${appId} ${metric}=${current[metric]} 超过绝对预算 ${limits[limitName]}`)
      }
      if (current[metric] > baseline[metric] + (tolerance[metric] ?? 0)) {
        errors.push(
          `${appId} ${metric} 从 ${baseline[metric]} 增至 ${current[metric]}，超过容差 ${tolerance[metric] ?? 0}`,
        )
      }
    }
    if (current.sourcemaps > 0)
      errors.push(`${appId} 发布包含 ${current.sourcemaps} 个 sourcemap；市场包禁止分发完整源码映射`)
    for (const [risk, count] of Object.entries(current.risks)) {
      const allowed = baseline.risks?.[risk] ?? 0
      if (count > allowed) errors.push(`${appId} 静态性能风险 ${risk} 从 ${allowed} 增至 ${count}`)
    }
    for (const [file, lines] of Object.entries(current.oversizeSourceFiles)) {
      const allowed = baseline.oversizeSourceFiles?.[file]
      if (allowed === undefined) errors.push(`${file} 是新增的 ${lines} 行大文件（上限 ${limits.maxNewSourceLines}）`)
      else if (lines > allowed) errors.push(`${file} 从 ${allowed} 行增至 ${lines} 行；存量大文件只能减不能增`)
    }
  }
  for (const appId of Object.keys(config.baselines ?? {})) {
    if (!measurements[appId]) warn(`预算基线仍包含已删除应用 ${appId}`)
  }
  if (errors.length > 0) {
    for (const error of errors) fail(error)
    process.exitCode = 1
    return
  }
  const total = Object.values(measurements).reduce((sum, item) => sum + item.packageBytes, 0)
  ok(`包体与静态性能预算通过：${Object.keys(measurements).length} 个应用，共 ${(total / 1024).toFixed(1)} KB`)
}

main()
