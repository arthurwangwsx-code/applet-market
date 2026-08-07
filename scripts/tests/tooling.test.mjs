import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { buildApplet } from '../../packages/aibox-tsbuild/index.mjs'
import {
  parseESMExports,
  parseSwiftModuleMap,
  parseTSBuildSpecifierSet,
  parseUITypeExports,
  parseUITypeInterfaceProperties,
  parseVirtualListRuntimeProps,
} from '../audit-runtime-contracts.mjs'
import { ROOT } from '../lib/market.mjs'
import { RUNTIME_MODULE_FILES } from '../lib/runtime-modules.mjs'
import { PACKAGE_JSON, rewriteRelativeImports, TSCONFIG } from '../migrate-to-ts.mjs'
import { APP_TSX } from '../new-app.mjs'

test('aibox/ui 合同能从运行时与类型声明稳定提取', () => {
  const contract = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'packages/aibox-tsbuild/types/aibox-ui-contract.json'), 'utf8'),
  )
  const types = fs.readFileSync(path.join(ROOT, 'packages/aibox-tsbuild/types/aibox-ui.d.ts'), 'utf8')
  assert.deepEqual(parseUITypeExports(types), [...contract.exports].sort())
  assert.deepEqual(parseUITypeInterfaceProperties(types, 'VirtualListProps'), [...contract.virtualListProps].sort())

  const runtime = path.resolve(ROOT, '../WebAssets/applet-runtime/src/aibox-ui-bundle.js')
  if (fs.existsSync(runtime)) {
    assert.deepEqual(parseESMExports(fs.readFileSync(runtime, 'utf8')), [...contract.exports].sort())
  }
  const virtualList = path.resolve(ROOT, '../WebAssets/applet-runtime/src/aibox-ui/virtual-list.js')
  if (fs.existsSync(virtualList)) {
    assert.deepEqual(
      parseVirtualListRuntimeProps(fs.readFileSync(virtualList, 'utf8')),
      contract.virtualListProps.filter((name) => name !== 'ref').sort(),
    )
  }
})

test('构建器与宿主模块表可以被合同闸门机械读取', () => {
  const expected = Object.keys(RUNTIME_MODULE_FILES).sort()
  const tsbuild = fs.readFileSync(path.join(ROOT, 'packages/aibox-tsbuild/index.mjs'), 'utf8')
  assert.deepEqual(parseTSBuildSpecifierSet(tsbuild), expected)

  const host = path.resolve(ROOT, '../Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletImportRules.swift')
  if (fs.existsSync(host)) {
    assert.deepEqual(parseSwiftModuleMap(fs.readFileSync(host, 'utf8')), RUNTIME_MODULE_FILES)
  }
})

test('new-app 明确拒绝新增 source/JS 工程', () => {
  const appId = 'com.aibox.tooling-test-source'
  assert.equal(fs.existsSync(path.join(ROOT, 'apps', appId)), false)
  const result = spawnSync(process.execPath, ['scripts/new-app.mjs', appId, '--source'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}${result.stderr}`, /--source 已退役/)
  assert.equal(fs.existsSync(path.join(ROOT, 'apps', appId)), false)
})

test('新应用模板是合法 TSX，并展示兼容探测与降级', () => {
  const source = APP_TSX.replaceAll('<NAME>', '测试应用')
  const result = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  assert.deepEqual(result.diagnostics ?? [], [])
  assert.match(source, /checkCompatibility/)
  assert.match(source, /supports\('capability:toast\.show'\)/)
  assert.match(source, /catch \{/)
})

test('迁移模板只生成 aibox-tsbuild 工程并保留运行时 .js 扩展名', () => {
  const pkg = JSON.parse(PACKAGE_JSON('com.aibox.legacy', 'legacy'))
  assert.equal(pkg.scripts.build, 'aibox-tsbuild')
  assert.equal(pkg.devDependencies['@aibox/applet-vite'], undefined)
  assert.doesNotMatch(TSCONFIG, /vite/i)
  assert.equal(
    rewriteRelativeImports("import A from './A.jsx'\nexport { x } from '../lib/x.ts'"),
    "import A from './A.js'\nexport { x } from '../lib/x.js'",
  )
})

test('唯一构建器拒绝 JS/JSX 绕过严格类型检查', async () => {
  const appDir = fs.mkdtempSync(path.join(ROOT, '.tooling-js-source-'))
  try {
    const src = path.join(appDir, 'src')
    fs.mkdirSync(src)
    fs.writeFileSync(path.join(src, 'app.jsx'), 'export default function App() { return null }\n')
    fs.writeFileSync(path.join(src, 'manifest.json'), '{"name":"Legacy fixture","template":"react"}\n')
    await assert.rejects(() => buildApplet({ appDir }), /标准工程禁止 JS\/JSX 源码/)
    assert.equal(fs.existsSync(path.join(appDir, 'dist')), false)
  } finally {
    fs.rmSync(appDir, { recursive: true, force: true })
  }
})

test('唯一构建器生成 action 类型并在 check 模式阻止 manifest 漂移', async () => {
  const appDir = fs.mkdtempSync(path.join(ROOT, '.tooling-action-types-'))
  try {
    const src = path.join(appDir, 'src')
    fs.mkdirSync(src)
    fs.writeFileSync(path.join(src, 'app.ts'), 'export default function App() { return null }\n')
    const manifest = {
      name: 'Tooling fixture',
      template: 'react',
      runtimeKind: 'bundle',
      actions: [{ name: 'ping', summary: 'Ping', inputSchemaJSON: '{"type":"object"}' }],
    }
    fs.writeFileSync(path.join(src, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    await buildApplet({ appDir })
    const actionTypes = fs.readFileSync(path.join(src, 'aibox-actions.d.ts'), 'utf8')
    assert.match(actionTypes, /"ping"/)
    assert.equal(fs.existsSync(path.join(appDir, 'dist/lib/aibox-sdk.js')), false)

    manifest.actions[0].name = 'pong'
    fs.writeFileSync(path.join(src, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    await assert.rejects(() => buildApplet({ appDir, check: true }), /aibox-actions\.d\.ts 与 manifest\.actions 不一致/)
  } finally {
    fs.rmSync(appDir, { recursive: true, force: true })
  }
})
