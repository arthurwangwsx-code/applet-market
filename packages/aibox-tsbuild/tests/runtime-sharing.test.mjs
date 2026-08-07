import assert from 'node:assert/strict'
import ts from 'typescript'
import { HOST_BARE_SPECIFIERS, rewriteSDKSpecifier, shellHTML, verify } from '../index.mjs'

assert.equal(HOST_BARE_SPECIFIERS.has('react/jsx-dev-runtime'), false)
assert.equal(HOST_BARE_SPECIFIERS.has('aibox/sdk'), true)
assert.equal(HOST_BARE_SPECIFIERS.has('aibox/sdk/react'), true)

const rewritten = rewriteSDKSpecifier(`
import { bridge } from '@aibox/applet-sdk'
export { useTabs } from "@aibox/applet-sdk/react"
`)
assert.match(rewritten, /from 'aibox\/sdk'/)
assert.match(rewritten, /from "aibox\/sdk\/react"/)
assert.doesNotMatch(rewritten, /@aibox\/applet-sdk/)
assert.deepEqual(verify([['app.js', rewritten]]), [])

const shell = shellHTML('Compatibility')
assert.match(shell, /await import\('aibox\/sdk'\)/, '业务模块前必须先探测共享 SDK')
assert.match(shell, /checkCompatibility/)
assert.match(shell, /incompatible-host/)
assert.match(
  shell,
  /new RegExp\('aibox-sdk\[\.\]mjs\|aibox\/sdk\|incompatible-host', 'i'\)/,
  '共享 SDK 缺失判定不能生成含未转义路径斜杠的正则字面量',
)
assert.doesNotMatch(shell, /\/aibox-sdk[^\n]*aibox\/sdk/, '生成外壳不能把 aibox/sdk 放进正则字面量')
assert.match(shell, /sharedSDKReady = true/, '业务模块异常不得误报为宿主 SDK 缺失')
assert.doesNotMatch(
  shell,
  /incompatible-host\|Failed to fetch dynamically imported module/,
  '通用加载失败不能一律归因老宿主',
)
assert.match(shell, /newer AiBox container/, '缺共享资产时必须有可见降级，不能白屏')
assert.match(shell, /这个小应用需要更新版本的 AiBox/, '中文容器必须显示可理解的升级提示')
assert.ok(shell.includes("upgradeHint + '\\n\\n' + message"), '模板里的换行必须保留为 JS 转义，不能展开成裸换行')
const moduleScripts = [...shell.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((match) => match[1])
assert.equal(moduleScripts.length, 1)
const syntaxDiagnostics =
  ts.transpileModule(moduleScripts[0], {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  }).diagnostics ?? []
assert.deepEqual(syntaxDiagnostics, [], '生成外壳的 module script 必须能被 JavaScript 解析')

console.log('✓ tsbuild uses the host-shared SDK with an explicit legacy-host fallback')
