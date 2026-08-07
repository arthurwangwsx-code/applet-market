import fs from 'node:fs'
import path from 'node:path'
import { parseSchemaJSON, schemaToBlock } from './schema-to-ts.mjs'

// 由 manifest 的 actions 生成 TS 类型（2026-08-06 随构建管线收敛搬到唯一构建器）。
//  manifest-plugin.mjs
//  从 `src/manifest.json` 的 action 声明生成 `src/aibox-actions.d.ts`。
//
//  这是「可校验」的来源：manifest 里的 `inputSchemaJSON` / `outputSchemaJSON` 被翻译成
//  `AppletActionMap` 的模块增补，于是 `registerAction('search', handler)` 的
//  **名字、入参、返回**三样都由 tsc 检查。名字拼错、schema 改了没同步 handler、返回结构对不上，
//  全部变成编译错误而不是真机上的静默失败。
//
//  生成物是**签入仓库**的（不是 .gitignore）：这样 `tsc --noEmit` 不需要先跑一次构建，
//  CI 和编辑器都能直接用；漂移由 `--check` 模式挡住。
//

const BANNER = `// 本文件由 @aibox/applet-tsbuild 从 src/manifest.json 的 actions 声明生成，请勿手改。
// 重新生成：npm run build（或 npm run gen:actions）。
//
// 它把 manifest 的 action 契约接进 @aibox/applet-sdk 的 AppletActionMap，于是
// registerAction / registerActions 的名字与入参/返回类型都由 tsc 校验。
`

/** manifest -> `src/aibox-actions.d.ts` 文本。没有 action 时返回空表（仍生成，保持形态稳定）。 */
export function renderActionTypes(manifest) {
  const actions = Array.isArray(manifest?.actions) ? manifest.actions : []
  const lines = [
    BANNER,
    "import '@aibox/applet-sdk';",
    '',
    "declare module '@aibox/applet-sdk' {",
    '  interface AppletActionMap {',
  ]
  if (actions.length === 0) {
    lines.push('    // manifest.actions 为空：没有对外 action。')
  }
  for (const action of actions) {
    const name = typeof action?.name === 'string' ? action.name : null
    if (!name) continue
    const input = parseSchemaJSON(action.inputSchemaJSON)
    const output = parseSchemaJSON(action.outputSchemaJSON)
    const summary = typeof action.summary === 'string' ? action.summary.replace(/\*\//g, '*\\/') : ''
    if (summary) lines.push(`    /** ${summary} */`)
    lines.push(`    ${JSON.stringify(name)}: {`)
    lines.push(`      input: ${input ? schemaToBlock(input, '      ') : 'Record<string, unknown>'};`)
    lines.push(`      output: ${output ? schemaToBlock(output, '      ') : 'import("@aibox/applet-sdk").JSONValue'};`)
    lines.push('    };')
  }
  lines.push('  }', '}', '')
  return lines.join('\n')
}

/** 读 manifest 并做**发布前就该发现**的一致性检查。返回问题串数组。 */
export function checkManifest(manifest) {
  const problems = []
  if (!manifest || typeof manifest !== 'object') return ['src/manifest.json 不是对象']
  if (manifest.runtimeKind && !['source', 'bundle'].includes(manifest.runtimeKind)) {
    problems.push(`manifest.runtimeKind 非法：${manifest.runtimeKind}（只能是 source / bundle）`)
  }
  // externalize react 的产物必须让宿主备好 React 运行时资产。宿主用 `template` 判断要不要下载
  // react.mjs / antd-mobile.mjs（AppletTemplate.needsRuntime）——声明成 vanilla 就不会下载，
  // 于是 import map 指向的 URL 全部 404 → 白屏，而且是「装上了但打不开」这种最难查的形态。
  if (manifest.runtimeKind === 'bundle' && manifest.template !== 'react') {
    problems.push(
      `runtimeKind=bundle 的应用必须声明 template="react"（当前 ${JSON.stringify(manifest.template)}）——` +
        '宿主据此决定要不要准备 React 运行时资产，声明错了 import map 全部 404。',
    )
  }
  const seen = new Set()
  for (const action of manifest.actions ?? []) {
    if (typeof action?.name !== 'string' || action.name === '') {
      problems.push('manifest.actions 里有条目缺 name')
      continue
    }
    if (seen.has(action.name)) problems.push(`manifest.actions 里 name 重复：${action.name}`)
    seen.add(action.name)
    if (action.inputSchemaJSON && !parseSchemaJSON(action.inputSchemaJSON)) {
      problems.push(`action "${action.name}" 的 inputSchemaJSON 不是合法 JSON 对象`)
    }
    if (action.outputSchemaJSON && !parseSchemaJSON(action.outputSchemaJSON)) {
      problems.push(`action "${action.name}" 的 outputSchemaJSON 不是合法 JSON 对象`)
    }
  }
  return problems
}

/**
 * 构建器入口：构建开始时读 manifest、校验、生成 action 类型。
 * `check: true` 时只比对不写盘（CI 用）。
 */
export function aiboxManifest(options = {}) {
  const check = Boolean(options.check)
  let root = process.cwd()
  return {
    name: 'aibox:manifest',
    configResolved(config) {
      root = config.root
    },
    buildStart() {
      const manifestPath = path.join(root, 'src', 'manifest.json')
      if (!fs.existsSync(manifestPath)) {
        this.error('缺少 src/manifest.json —— 它是小应用的声明，发布时原样进包。')
        return
      }
      let manifest
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      } catch (error) {
        this.error(`src/manifest.json 解析失败：${error.message}`)
        return
      }
      const problems = checkManifest(manifest)
      if (problems.length > 0) {
        this.error(`manifest 校验失败：\n  - ${problems.join('\n  - ')}`)
        return
      }
      const target = path.join(root, 'src', 'aibox-actions.d.ts')
      const next = renderActionTypes(manifest)
      const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null
      if (current === next) return
      if (check) {
        this.error('src/aibox-actions.d.ts 与 src/manifest.json 不一致，跑一次 npm run build 重新生成。')
        return
      }
      fs.writeFileSync(target, next, 'utf8')
      this.info?.(`已更新 src/aibox-actions.d.ts（${(manifest.actions ?? []).length} 个 action）`)
    },
  }
}
