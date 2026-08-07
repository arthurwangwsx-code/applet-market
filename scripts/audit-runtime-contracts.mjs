#!/usr/bin/env node
// 跨仓运行时合同闸门：裸模块白名单与 aibox/ui 导出面只能有一套答案。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { appPaths, fail, listAppIDs, ok, ROOT, readJSON } from './lib/market.mjs'
import { RUNTIME_MODULE_FILES } from './lib/runtime-modules.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const UI_TYPES = path.join(ROOT, 'packages/aibox-tsbuild/types/aibox-ui.d.ts')
const UI_CONTRACT = path.join(ROOT, 'packages/aibox-tsbuild/types/aibox-ui-contract.json')
const TSBUILD = path.join(ROOT, 'packages/aibox-tsbuild/index.mjs')
const SDK_PACKAGE = path.join(ROOT, 'packages/aibox-sdk/package.json')
const NEW_APP = path.join(ROOT, 'scripts/new-app.mjs')
const HOST_IMPORT_RULES = path.resolve(
  ROOT,
  '../Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletImportRules.swift',
)
const HOST_UI_SOURCE = path.resolve(ROOT, '../WebAssets/applet-runtime/src/aibox-ui-bundle.js')
const HOST_VIRTUAL_LIST_SOURCE = path.resolve(ROOT, '../WebAssets/applet-runtime/src/aibox-ui/virtual-list.js')
const HOST_SDK_LOCK = path.resolve(ROOT, '../WebAssets/applet-runtime/aibox-sdk.lock.json')
const HOST_SDK_ASSET = path.resolve(
  ROOT,
  '../Packages/AppletPluginKit/Sources/AppletPluginKit/Resources/Runtime/aibox-sdk.mjs',
)

function sorted(values) {
  return [...new Set(values)].sort()
}

function arrayDiff(expected, actual) {
  const left = new Set(expected)
  const right = new Set(actual)
  return {
    missing: expected.filter((item) => !right.has(item)),
    extra: actual.filter((item) => !left.has(item)),
  }
}

export function parseUITypeExports(source) {
  const file = ts.createSourceFile('aibox-ui.d.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const values = []
  for (const statement of file.statements) {
    if (!ts.isModuleDeclaration(statement) || statement.name.getText(file).replaceAll(/["']/g, '') !== 'aibox/ui')
      continue
    const body = statement.body
    if (!body || !ts.isModuleBlock(body)) continue
    for (const item of body.statements) {
      if (ts.isFunctionDeclaration(item) || ts.isClassDeclaration(item) || ts.isEnumDeclaration(item)) {
        if (item.name) values.push(item.name.text)
      } else if (ts.isVariableStatement(item)) {
        for (const declaration of item.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) values.push(declaration.name.text)
        }
      }
    }
  }
  return sorted(values)
}

export function parseUITypeInterfaceProperties(source, interfaceName) {
  const file = ts.createSourceFile('aibox-ui.d.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const values = []
  for (const statement of file.statements) {
    if (!ts.isModuleDeclaration(statement) || statement.name.getText(file).replaceAll(/["']/g, '') !== 'aibox/ui')
      continue
    const body = statement.body
    if (!body || !ts.isModuleBlock(body)) continue
    for (const item of body.statements) {
      if (!ts.isInterfaceDeclaration(item) || item.name.text !== interfaceName) continue
      for (const member of item.members) {
        if (ts.isPropertySignature(member) && member.name) {
          values.push(member.name.getText(file).replaceAll(/["']/g, ''))
        }
      }
    }
  }
  return sorted(values)
}

export function parseVirtualListRuntimeProps(source) {
  const file = ts.createSourceFile('virtual-list.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const values = []
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === 'props'
    ) {
      for (const element of node.name.elements) {
        if (element.dotDotDotToken) continue
        const name = element.propertyName ?? element.name
        if (ts.isIdentifier(name) || ts.isStringLiteral(name)) values.push(name.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return sorted(values)
}

export function parseESMExports(source) {
  const file = ts.createSourceFile('runtime.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const values = []
  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) values.push(element.name.text)
      continue
    }
    const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (!exported) continue
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) {
      if (statement.name) values.push(statement.name.text)
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) values.push(declaration.name.text)
      }
    }
  }
  return sorted(values)
}

export function parseSwiftModuleMap(source) {
  const match = /static\s+let\s+bareToFile\s*:\s*\[String:\s*String\]\s*=\s*\[([\s\S]*?)\n\s*\]/.exec(source)
  if (!match) throw new Error('无法从 AppletImportRules.swift 提取 bareToFile')
  const entries = {}
  for (const item of match[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) entries[item[1]] = item[2]
  return entries
}

export function parseTSBuildSpecifierSet(source) {
  const match = /HOST_BARE_SPECIFIERS\s*=\s*new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\)/.exec(source)
  if (!match) throw new Error('无法从 aibox-tsbuild 提取 HOST_BARE_SPECIFIERS')
  return sorted([...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]))
}

function compareSet(label, expected, actual, errors) {
  const { missing, extra } = arrayDiff(sorted(expected), sorted(actual))
  if (missing.length === 0 && extra.length === 0) return
  errors.push(
    `${label} 漂移：${missing.length ? `缺 ${missing.join(', ')}` : ''}${missing.length && extra.length ? '；' : ''}${extra.length ? `多 ${extra.join(', ')}` : ''}`,
  )
}

function compareMap(label, expected, actual, errors) {
  compareSet(label, Object.keys(expected), Object.keys(actual), errors)
  for (const key of Object.keys(expected)) {
    if (actual[key] !== undefined && actual[key] !== expected[key]) {
      errors.push(`${label} 的 ${key} 映射为 ${actual[key]}，应为 ${expected[key]}`)
    }
  }
}

function main() {
  const errors = []
  const sdkVersion = readJSON(SDK_PACKAGE).version
  const sdkRange = `^${sdkVersion}`
  const contract = readJSON(UI_CONTRACT)
  const contractExports = sorted(contract.exports ?? [])
  const virtualListProps = sorted(contract.virtualListProps ?? [])
  const typeExports = parseUITypeExports(fs.readFileSync(UI_TYPES, 'utf8'))
  compareSet('aibox/ui 类型声明', contractExports, typeExports, errors)
  compareSet(
    'VirtualList 类型属性',
    virtualListProps,
    parseUITypeInterfaceProperties(fs.readFileSync(UI_TYPES, 'utf8'), 'VirtualListProps'),
    errors,
  )

  if (fs.existsSync(HOST_UI_SOURCE)) {
    const runtimeSource = fs.readFileSync(HOST_UI_SOURCE, 'utf8')
    compareSet('aibox/ui 宿主运行时', contractExports, parseESMExports(runtimeSource), errors)
    const version = /export\s+const\s+version\s*=\s*['"]([^'"]+)['"]/.exec(runtimeSource)?.[1]
    if (version !== contract.version)
      errors.push(`aibox/ui 版本漂移：宿主=${version ?? '无法读取'}，合同=${contract.version}`)
  }
  if (fs.existsSync(HOST_VIRTUAL_LIST_SOURCE)) {
    compareSet(
      'VirtualList 宿主属性',
      virtualListProps.filter((name) => name !== 'ref'),
      parseVirtualListRuntimeProps(fs.readFileSync(HOST_VIRTUAL_LIST_SOURCE, 'utf8')),
      errors,
    )
  }

  const tsbuildSource = fs.readFileSync(TSBUILD, 'utf8')
  compareSet(
    'aibox-tsbuild HOST_BARE_SPECIFIERS',
    Object.keys(RUNTIME_MODULE_FILES),
    parseTSBuildSpecifierSet(tsbuildSource),
    errors,
  )
  for (const specifier of Object.keys(RUNTIME_MODULE_FILES)) {
    if (!tsbuildSource.includes(`"${specifier}"`) && !tsbuildSource.includes(`'${specifier}'`)) {
      errors.push(`aibox-tsbuild 外壳缺少运行时模块 ${specifier}`)
    }
  }
  if (!tsbuildSource.includes(`minSDKVersion: '${sdkVersion}'`)) {
    errors.push(`aibox-tsbuild 启动预检没有锁定当前 SDK ${sdkVersion}`)
  }

  const newAppSource = fs.readFileSync(NEW_APP, 'utf8')
  if (!newAppSource.includes(`'@aibox/applet-sdk': '${sdkRange}'`)) {
    errors.push(`new-app 模板 SDK 依赖没有锁定 ${sdkRange}`)
  }
  for (const appId of listAppIDs()) {
    const paths = appPaths(appId)
    if (!fs.existsSync(paths.packageJSON)) {
      errors.push(`${paths.relative} 缺少 package.json`)
      continue
    }
    const pkg = readJSON(paths.packageJSON)
    const dependency = { ...pkg.devDependencies, ...pkg.dependencies }['@aibox/applet-sdk']
    if (dependency !== sdkRange)
      errors.push(`${paths.relative} 的 SDK 依赖为 ${dependency ?? '缺失'}，应为 ${sdkRange}`)
  }

  if (fs.existsSync(HOST_IMPORT_RULES)) {
    compareMap(
      '宿主 AppletImportRules.bareToFile',
      RUNTIME_MODULE_FILES,
      parseSwiftModuleMap(fs.readFileSync(HOST_IMPORT_RULES, 'utf8')),
      errors,
    )
  }
  if (fs.existsSync(HOST_SDK_LOCK)) {
    const lock = readJSON(HOST_SDK_LOCK)
    if (lock.sdkVersion !== sdkVersion) {
      errors.push(`宿主 SDK 资产锁版本 ${lock.sdkVersion ?? '缺失'}，市场 SDK 为 ${sdkVersion}`)
    }
  }
  if (fs.existsSync(HOST_SDK_ASSET)) {
    const asset = fs.readFileSync(HOST_SDK_ASSET, 'utf8')
    if (!asset.includes(`@aibox/applet-sdk v${sdkVersion}`)) {
      errors.push(`宿主 aibox-sdk.mjs 不包含当前 SDK ${sdkVersion} 的生成标记`)
    }
  }

  if (errors.length > 0) {
    for (const error of errors) fail(error)
    process.exitCode = 1
    return
  }
  ok(
    `运行时合同一致：${Object.keys(RUNTIME_MODULE_FILES).length} 个裸模块；SDK ${sdkVersion}；aibox/ui ${contract.version} 共 ${contractExports.length} 个值导出`,
  )
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(HERE, 'audit-runtime-contracts.mjs')) main()
