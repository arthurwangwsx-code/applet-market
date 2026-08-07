#!/usr/bin/env node
// TypeScript 源码政策：市场当前为零 JS/JSX；扫描逻辑保留历史诊断能力，防止任何文件回流。

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { appPaths, fail, listAppIDs, ok, readJSON, ROOT, warn, writeJSON } from './lib/market.mjs'

const BASELINE = path.join(ROOT, 'config/legacy-js-baseline.json')
const CODE_EXTENSIONS = /\.(?:js|jsx)$/
const CHECKED_CODE_EXTENSIONS = /\.(?:js|jsx|ts|tsx)$/

function walk(dir, prefix = '', extensions = CODE_EXTENSIONS) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'releases') continue
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), relative, extensions))
    else if (extensions.test(relative)) out.push(relative)
  }
  return out.sort()
}

function diagnosticCountsForApp(appId) {
  const paths = appPaths(appId)
  const configFile = path.join(paths.dir, 'tsconfig.json')
  if (!fs.existsSync(configFile)) return { global: ['缺少 tsconfig.json'], files: {} }
  const loaded = ts.readConfigFile(configFile, ts.sys.readFile)
  if (loaded.error) return { global: [ts.flattenDiagnosticMessageText(loaded.error.messageText, '\n')], files: {} }
  const parsed = ts.parseJsonConfigFileContent(
    loaded.config,
    ts.sys,
    paths.dir,
    {
      allowJs: true,
      checkJs: true,
      strict: false,
      noEmit: true,
      pretty: false,
    },
    configFile,
  )
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options })
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)].filter(
    (item) => item.category === ts.DiagnosticCategory.Error,
  )
  const global = []
  const files = {}
  for (const diagnostic of diagnostics) {
    if (!diagnostic.file) {
      global.push(`TS${diagnostic.code}`)
      continue
    }
    const relative = path.relative(ROOT, diagnostic.file.fileName).split(path.sep).join('/')
    if (!CODE_EXTENSIONS.test(relative)) continue
    files[relative] ??= {}
    const code = `TS${diagnostic.code}`
    files[relative][code] = (files[relative][code] ?? 0) + 1
  }
  return { global, files }
}

export function collectLegacyState() {
  const files = {}
  const diagnostics = {}
  for (const appId of listAppIDs()) {
    const paths = appPaths(appId)
    for (const relative of walk(paths.srcDir)) files[`${paths.relative}/src/${relative}`] = true
    const result = diagnosticCountsForApp(appId)
    if (result.global.length > 0) diagnostics[`${paths.relative}/<global>`] = { errors: result.global.length }
    Object.assign(diagnostics, result.files)
  }
  return { files, diagnostics }
}

function strictPolicyErrors() {
  const errors = []
  for (const appId of listAppIDs()) {
    const paths = appPaths(appId)
    const tsconfig = path.join(paths.dir, 'tsconfig.json')
    if (fs.existsSync(tsconfig) && readJSON(tsconfig).compilerOptions?.strict === false) {
      errors.push(`${paths.relative}/tsconfig.json 禁止 strict:false`)
    }
    for (const relative of walk(paths.srcDir, '', CHECKED_CODE_EXTENSIONS)) {
      const source = fs.readFileSync(path.join(paths.srcDir, relative), 'utf8')
      if (/^\s*\/\/[#\s]*@ts-(?:nocheck|ignore)\b/m.test(source)) {
        errors.push(`${paths.relative}/src/${relative} 禁止 @ts-nocheck/@ts-ignore`)
      }
    }
  }
  return errors
}

function countDiagnostics(value) {
  return Object.values(value ?? {}).reduce((sum, count) => sum + Number(count), 0)
}

function main() {
  const current = collectLegacyState()
  if (process.argv.includes('--update')) {
    writeJSON(BASELINE, {
      schemaVersion: 1,
      policy: '应用源码只允许严格 TypeScript；JS/JSX 基线为空，任何回流都失败。',
      files: Object.keys(current.files).sort(),
      diagnostics: current.diagnostics,
    })
    ok(`已刷新 ${path.relative(ROOT, BASELINE)}；请人工审阅新增文件与诊断，不能把回归伪装成基线更新`)
    return
  }

  if (!fs.existsSync(BASELINE)) {
    fail(`缺少 ${path.relative(ROOT, BASELINE)}；先运行 node scripts/audit-typescript-policy.mjs --update`)
    process.exitCode = 1
    return
  }
  const baseline = readJSON(BASELINE)
  const allowedFiles = new Set(baseline.files ?? [])
  const errors = strictPolicyErrors()
  for (const file of Object.keys(current.files)) {
    if (!allowedFiles.has(file)) errors.push(`${file} 是新增 JS/JSX；新代码必须使用 .ts/.tsx`)
  }
  for (const [file, codes] of Object.entries(current.diagnostics)) {
    const allowed = baseline.diagnostics?.[file] ?? {}
    for (const [code, count] of Object.entries(codes)) {
      if (count > (allowed[code] ?? 0)) {
        errors.push(`${file} 的 ${code} 从 ${allowed[code] ?? 0} 增至 ${count}`)
      }
    }
  }
  if (errors.length > 0) {
    for (const error of errors) fail(error)
    process.exitCode = 1
    return
  }
  const baselineCount = Object.values(baseline.diagnostics ?? {}).reduce(
    (sum, codes) => sum + countDiagnostics(codes),
    0,
  )
  const currentCount = Object.values(current.diagnostics).reduce((sum, codes) => sum + countDiagnostics(codes), 0)
  const currentFiles = Object.keys(current.files).length
  if (currentFiles > 0)
    warn(`遗留 JS/JSX：${currentFiles} 个文件，checkJs 诊断 ${currentCount}/${baselineCount}（只减不增）`)
  ok('TypeScript 政策通过：应用源码保持全量 TS/TSX，且没有类型检查逃生口')
}

main()
