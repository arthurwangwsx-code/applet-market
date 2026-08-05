#!/usr/bin/env node
// 「引用了不存在的标识符」闸门。
//
// ## 为什么单独有这么一条
// 2026-08-06：viddl 1.1.4 发到用户手上，点资料库的 ▶ 必崩。原因是包里 `playJob`
// **只有调用点、没有定义**——一次半成品构建被发布了出去。
// 而当时全线是绿的：`typecheck` 绿、`build` 绿、`validate` 绿、旁装 `run`/`test` 也绿。
// 复现确认过：往 `.jsx` 里塞一个完全不存在的 `totallyUndefinedFn(j)`，
// `tsc --noEmit` 与 `aibox-tsbuild` 双双通过——因为 `.jsx/.js` 在 `checkJs:false` 下不被检查，
// 而无头验收只点得到首屏，点不到需要真实数据才出现的那一行。
//
// ## 判据
// 用 TypeScript 自己的语义分析（`checkJs: true`），但**只取 TS2304 / TS2552**
// （"Cannot find name" / "Did you mean"）。其余类型噪音一律丢弃——
// 目标是「这个名字在运行时会不会是 ReferenceError」，不是把应用全量类型化。
// 这样既零误报（找不到名字就是找不到），又不需要先把 40 个 JS 文件补上类型。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APPS = path.join(ROOT, 'apps')

/** 只有这两个码代表「运行时会 ReferenceError」。 */
const FATAL = new Set([2304, 2552])

function sourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, acc)
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) acc.push(full)
  }
  return acc
}

function auditApp(appDir) {
  const src = path.join(appDir, 'src')
  if (!fs.existsSync(src)) return []
  const files = sourceFiles(src)
  if (!files.length) return []

  const program = ts.createProgram(files, {
    allowJs: true,
    checkJs: true,                 // ← 关键：不开这个，.jsx 里的未定义名字根本不会被看一眼
    noEmit: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
    // 类型声明找不到不是我们要抓的东西，别让它淹没结果。
    skipLibCheck: true,
    noResolve: false,
  })

  const hits = []
  for (const file of files) {
    const sf = program.getSourceFile(file)
    if (!sf) continue
    for (const d of program.getSemanticDiagnostics(sf)) {
      if (!FATAL.has(d.code)) continue
      const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0)
      hits.push({
        file: path.relative(ROOT, file),
        line: line + 1,
        message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
      })
    }
  }
  return hits
}

const only = process.argv[2]
const apps = fs.readdirSync(APPS).filter((n) => !only || n === only)
let total = 0
for (const app of apps) {
  const hits = auditApp(path.join(APPS, app))
  if (!hits.length) continue
  total += hits.length
  console.log(`\n❌ ${app}`)
  for (const h of hits) console.log(`   ${h.file}:${h.line} — ${h.message}`)
}

if (total) {
  console.log(`\n共 ${total} 处「名字找不到」。这些在运行时就是 ReferenceError —— 点到那条路径必崩。`)
  console.log('注意：typecheck / build / 无头验收都拦不住这一类（.jsx 默认不检查，无头点不到深层交互）。')
  process.exit(1)
}
console.log(`✓ 未定义标识符闸门通过（${apps.length} 个应用）。`)
