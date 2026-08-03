#!/usr/bin/env node
//
//  migrate-to-ts.mjs
//  把一个源码型（JSX）应用机械迁移成 TypeScript + Vite 工程。
//
//    node scripts/migrate-to-ts.mjs com.aibox.news --dry-run          # 只出报告，不写盘
//    node scripts/migrate-to-ts.mjs com.aibox.news --out apps/com.aibox.news.ts   # 迁到副本
//    node scripts/migrate-to-ts.mjs com.aibox.news --in-place         # 就地改（需要 --force 确认）
//
//  ## 它做什么
//   ① 生成工程文件：package.json / tsconfig.json / vite.config.ts / index.html
//   ② `.jsx -> .tsx`、`.js -> .ts`，并把相对 import 的扩展名同步改掉
//   ③ 入口 `app.jsx -> src/App.tsx` + 新建 `src/main.tsx`（自挂载 + default 导出）
//   ④ **裸 `aibox.*` 调用改写成 SDK 调用** —— 这是迁移的主要价值，也是「可校验」的来源
//   ⑤ manifest 补 `runtimeKind: "bundle"`
//   ⑥ 跑一次 `tsc --noEmit`，把类型错误**如实列出来**
//
//  ## 它不做什么（刻意）
//  改写规则只覆盖**有把握的**形态。拿不准的一律插 `// TODO(migrate): …` 并计入报告，
//  **绝不静默跳过**——一次「看起来迁完了」的迁移比一份诚实的待办清单危险得多。
//  类型错误同理：迁完必然有一批，那正是 TS 的价值所在，不是失败。
//

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { APPS_DIR, ROOT, appPaths, fail, info, listSourceFiles, ok, readJSON, warn } from './lib/market.mjs'

// ---------------------------------------------------------------------------
// 1. 桥调用 -> SDK 调用的改写规则
// ---------------------------------------------------------------------------
// 每条规则：`match` 命中就 `replace`，并登记需要 import 的 SDK 符号。
// 顺序有意义（长的先匹配，避免 `aibox.storage.get` 被 `aibox.storage` 抢先）。

const REWRITES = [
  // —— net：三条样板一次做对（编码 / truncated / 状态码）——
  {
    id: 'net.fetch->fetchJSON',
    match: /\baibox\.net\.fetch\(([^;]*?)\{\s*responseType:\s*['"]json['"]([^}]*)\}\s*\)/g,
    replace: (_m, head, rest) => `fetchJSON(${head}{${rest}})`,
    imports: ['fetchJSON'],
    note: '检查原来有没有自己判 res.status / res.truncated —— SDK 已默认断言，重复判断可以删掉',
  },
  {
    id: 'net.fetch->fetchText',
    match: /\baibox\.net\.fetch\(/g,
    replace: 'fetchWithMeta(',
    imports: ['fetchWithMeta'],
    note: 'fetchWithMeta 与裸桥语义一致（不做断言）。能确定是文本/JSON 的调用点建议手工改成 fetchText / fetchJSON，'
      + '那两个会替你处理编码、truncated 与非 2xx',
  },
  // —— storage ——
  { id: 'storage.get', match: /\baibox\.storage\.get\(/g, replace: 'storage.get(', imports: ['storage'],
    note: 'SDK 的 storage.get(key, fallback) **要求第二个参数**（默认值），比裸桥的 `?? 默认值` 少一次判空' },
  { id: 'storage.set', match: /\baibox\.storage\.set\(/g, replace: 'storage.set(', imports: ['storage'] },
  { id: 'storage.remove', match: /\baibox\.storage\.remove\(/g, replace: 'storage.remove(', imports: ['storage'] },
  { id: 'storage.list', match: /\baibox\.storage\.list\(/g, replace: 'storage.list(', imports: ['storage'] },
  // —— action ——
  { id: 'action.register', match: /\baibox\.action\.register\(/g, replace: 'registerAction(', imports: ['registerAction'],
    note: '注册点改完后，建议整体换成一次 registerActions({...})：那样「漏注册 manifest 声明的 action」也会变成编译错误' },
  { id: 'action.result', match: /\baibox\.action\.result\(/g, replace: 'actionResult(', imports: ['actionResult'] },
  // —— 能力探测：把「不可用就别渲染入口」变成一次调用 ——
  {
    id: 'capability-probe',
    match: /\b(?:window\.)?aibox(?:\?)?\.([a-zA-Z]+)\s*&&\s*typeof\s+(?:window\.)?aibox\.\1\.([a-zA-Z]+)\s*===\s*['"]function['"]/g,
    replace: (_m, ns, method) => `isAvailable('${ns}', '${method}')`,
    imports: ['isAvailable'],
  },
  {
    id: 'capability-probe-short',
    match: /\btypeof\s+(?:window\.)?aibox\.([a-zA-Z]+)\s*!==\s*['"]undefined['"]/g,
    replace: (_m, ns) => `isAvailable('${ns}')`,
    imports: ['isAvailable'],
  },
  // —— 图片路由 ——
  { id: 'imageURL', match: /\baibox\.image\.url\(/g, replace: 'imageURL(', imports: ['imageURL'] },
]

// 剩下的裸 `aibox.<ns>` 用法：SDK 没有专门封装（一等命名空间直接用桥就是最合适的），
// 但它们**必须**在类型可见的前提下用。SDK 的全局 d.ts 提供了这一层，故只需提醒。
const RESIDUAL_RE = /\b(?:window\.)?aibox\.([a-zA-Z]+)\.([a-zA-Z]+)\(/g

// ---------------------------------------------------------------------------
// 1b. 手写 host 封装 -> SDK
// ---------------------------------------------------------------------------
// **迁移的真正工作量在这里。** 现有四个应用（资讯/股票/记账/音乐）各自写了一份
// `src/lib/host.js`，导出面惊人地一致：hasNamespace / capabilities / storage / onEvent /
// aiAvailability / aiGenerate / registerAction / shareFile…… 四份独立实现的同一个东西，
// 正是 SDK 要取代的那一层。
//
// 所以迁移不是「逐个改写调用点」（调用点全都 import 自这个封装，形态各异、正则抓不到），
// 而是**删掉这份封装、把它的消费者指向 SDK**。下表就是那份对照关系。
// 没有对应物的导出（应用自己的业务胶水，如 openArticle / classifyMusicError）保持原样：
// 它们本来就该留在应用里。
const HOST_WRAPPER_EXPORTS = new Map([
  ['hasNamespace', { sdk: 'isAvailable', note: "签名一致：isAvailable(ns, method?)" }],
  ['storage', { sdk: 'storage', note: 'SDK 的 storage.get(key, fallback) 要求默认值；封装里的 `?? null` 可以删' }],
  ['registerAction', { sdk: 'registerAction', note: '建议整体换成 registerActions({...})，漏注册会变成编译错误' }],
  ['shareFile', { sdk: null, note: '直接用 aibox.share.file（SDK 全局类型已覆盖，返回是结构化信封）' }],
  ['openURL', { sdk: null, note: '直接用 aibox.open.url' }],
  ['aiAvailability', { sdk: null, note: '直接用 aibox.ai.availability（SDK 全局类型已覆盖）' }],
  ['aiGenerate', { sdk: null, note: '直接用 aibox.ai.generate' }],
  ['onEvent', { sdk: null, note: 'React 组件里用 SDK 的 hooks（useTabs / useToolbarSearch / useLocale），它们自动退订' }],
  ['onNamespaceEvent', { sdk: null, note: '同上；非组件场景直接用 aibox.<ns>.on()' }],
  ['capabilities', { sdk: 'isAvailable', note: 'capabilities.xxx 的 getter 逐条换成 isAvailable(ns, method)' }],
  ['httpGet', { sdk: 'fetchText', note: 'fetchText 已处理编码 / truncated / 非 2xx —— 封装里那三段可以整块删' }],
  ['httpGetJSON', { sdk: 'fetchJSON', note: '同上' }],
  ['impact', { sdk: 'haptic', note: 'haptic() 在宿主没有 haptics 时静默忽略，不用先探测' }],
  ['tapFeedback', { sdk: 'haptic', note: '同上' }],
  ['haptics', { sdk: 'haptic', note: '同上' }],
  ['setNavigationTitle', { sdk: 'setTitle', note: '' }],
  ['tabs', { sdk: null, note: 'React 里换成 useTabs()' }],
  ['toolbar', { sdk: null, note: 'React 里换成 useToolbarSearch()' }],
])

const HOST_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*(['"])((?:\.\.?\/)+(?:lib\/)?host(?:\.js)?)\2;?/g

/** 手写 host 封装的 import 改写：能对上的换成 SDK，对不上的留在原封装里并标 TODO。 */
function rewriteHostWrapperImports(source, report, relative) {
  let out = source
  const sdkSymbols = new Set()
  HOST_IMPORT_RE.lastIndex = 0
  out = out.replace(HOST_IMPORT_RE, (whole, names, _quote, specifier) => {
    const imported = names.split(',').map((s) => s.trim()).filter(Boolean)
    const kept = []
    const moved = []
    for (const raw of imported) {
      // 支持 `a as b` 形式：只按源名匹配，别名原样带走。
      const [origin] = raw.split(/\s+as\s+/)
      const mapping = HOST_WRAPPER_EXPORTS.get(origin)
      if (mapping?.sdk && raw === origin) {
        sdkSymbols.add(mapping.sdk)
        moved.push({ name: origin, to: mapping.sdk, note: mapping.note })
      } else {
        kept.push(raw)
        if (mapping) report.todo.push({ file: relative, symbol: origin, hint: mapping.note })
      }
    }
    for (const item of moved) {
      report.rewrites.push({ file: relative, rule: `host.${item.name} -> sdk.${item.to}`, note: item.note })
    }
    if (moved.length === 0) return whole
    report.wrapperFiles.add(specifier)
    return kept.length > 0
      ? `import { ${kept.join(', ')} } from ${_quote}${specifier}${_quote};`
      : `// migrate: 本文件对 ${specifier} 的依赖已全部由 @aibox/applet-sdk 取代`
  })
  return { code: out, sdkSymbols }
}

// React hooks 可以替换的手写实现（只标记，不自动改——这些通常缠着组件状态）。
const HOOK_HINTS = [
  { re: /visualViewport/, hint: "手写的键盘高度推算可以换成 useKeyboardInset()（宿主事件优先，比 visualViewport 准）" },
  { re: /__aiboxEnvironment|navigator\.language/, hint: '语言判定可以换成 useLocale()（首帧就有值，且跟随 App 内语言切换）' },
  { re: /aibox\.tabs\.on\(|aibox\.tabs\.getState\(/, hint: 'tabs 订阅可以换成 useTabs()（自动退订，且直接给出 rendered）' },
  { re: /aibox\.toolbar\.on\(\s*['"]searchChanged/, hint: '搜索订阅可以换成 useToolbarSearch()' },
]

// ---------------------------------------------------------------------------
// 2. 文件改写
// ---------------------------------------------------------------------------

const TS_EXT = { '.jsx': '.tsx', '.js': '.ts', '.mjs': '.ts' }

function targetName(relative) {
  const ext = path.extname(relative)
  return TS_EXT[ext] ? relative.slice(0, -ext.length) + TS_EXT[ext] : relative
}

/** 相对 import 的扩展名跟着改：`./x.jsx` -> `./x`（bundler 解析，不写扩展名最省事）。 */
function rewriteRelativeImports(source) {
  return source.replace(/(from\s*['"]|import\s*\(\s*['"])(\.[^'"]*?)(\.jsx|\.js|\.mjs)(['"])/g,
    (_m, head, spec, _ext, tail) => `${head}${spec}${tail}`)
}

function rewriteBridgeCalls(source, report, relative) {
  let out = source
  const used = new Set()
  for (const rule of REWRITES) {
    rule.match.lastIndex = 0
    if (!rule.match.test(out)) continue
    rule.match.lastIndex = 0
    out = out.replace(rule.match, rule.replace)
    for (const name of rule.imports) used.add(name)
    report.rewrites.push({ file: relative, rule: rule.id, note: rule.note })
  }
  // 残留的裸桥调用：不改写，但**逐条登记**（这就是「不能自动的要留痕」）。
  RESIDUAL_RE.lastIndex = 0
  const residual = new Set()
  let match
  while ((match = RESIDUAL_RE.exec(out)) !== null) residual.add(`aibox.${match[1]}.${match[2]}`)
  for (const call of residual) report.residual.push({ file: relative, call })
  for (const { re, hint } of HOOK_HINTS) {
    if (re.test(out)) report.hints.push({ file: relative, hint })
  }
  return { code: out, used }
}

/** 在文件顶部插入 SDK import（已有同源 import 时合并）。 */
function ensureSDKImport(source, symbols) {
  if (symbols.size === 0) return source
  const names = [...symbols].sort()
  const existing = /import\s*\{([^}]*)\}\s*from\s*['"]@aibox\/applet-sdk['"];?/.exec(source)
  if (existing) {
    const merged = [...new Set([...existing[1].split(',').map((s) => s.trim()).filter(Boolean), ...names])].sort()
    return source.replace(existing[0], `import { ${merged.join(', ')} } from '@aibox/applet-sdk';`)
  }
  const line = `import { ${names.join(', ')} } from '@aibox/applet-sdk';\n`
  // 插在最后一条既有 import 之后；一条都没有就插在文件头（跳过开头的注释块）。
  const lastImport = [...source.matchAll(/^import .*?;?\s*$/gm)].pop()
  if (lastImport) {
    const at = lastImport.index + lastImport[0].length
    return `${source.slice(0, at)}\n${line}${source.slice(at)}`
  }
  return line + source
}

// ---------------------------------------------------------------------------
// 3. 工程文件模板
// ---------------------------------------------------------------------------

const PACKAGE_JSON = (appId, summary) => `${JSON.stringify({
  name: `@aibox-app/${appId.split('.').pop()}`,
  private: true,
  version: '1.0.0',
  description: summary || '',
  type: 'module',
  scripts: { typecheck: 'tsc --noEmit', build: 'vite build' },
  dependencies: { '@aibox/applet-sdk': '^1.0.0' },
  devDependencies: {
    '@aibox/applet-vite': '^1.0.0',
    '@types/react': '^18.3.12',
    '@types/react-dom': '^18.3.1',
    'antd-mobile': '^5.38.1',
    react: '^18.3.1',
    'react-dom': '^18.3.1',
    typescript: '^5.9.3',
    vite: '^6.3.5',
  },
}, null, 2)}\n`

const TSCONFIG = `{
  "extends": "@aibox/applet-vite/tsconfig.base.json",
  "include": ["src", "vite.config.ts"],
  "compilerOptions": {
    // 迁移期放宽：先让工程编起来，再逐个文件收紧。这两条打开时会淹没在存量告警里，
    // 迁移完成后**删掉这段**，回到 tsconfig.base.json 的严格档。
    "noUnusedLocals": false,
    "noUnusedParameters": false
  }
}
`

const VITE_CONFIG = `import { defineAppletConfig } from '@aibox/applet-vite';

export default defineAppletConfig();
`

const INDEX_HTML = (title) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${title}</title>
  <!--
    预构建外壳（runtimeKind: bundle）：原生 importmap + 原生 module 脚本，不加载
    es-module-shims、不加载 Sucrase。注释里不要写字面的 script 起始标签，Vite 的 HTML
    解析会把它当真标签处理。
  -->
  <script type="importmap">
  {
    "imports": {
      "react": "applet://localhost/runtime/react.mjs",
      "react-dom": "applet://localhost/runtime/react.mjs",
      "react-dom/client": "applet://localhost/runtime/react.mjs",
      "react/jsx-runtime": "applet://localhost/runtime/react.mjs",
      "chart.js": "applet://localhost/runtime/chart.mjs",
      "antd-mobile": "applet://localhost/runtime/antd-mobile.mjs",
      "aibox/ui": "applet://localhost/runtime/aibox-ui.mjs"
    }
  }
  </script>
  <link rel="stylesheet" href="applet://localhost/runtime/aibox-ui.css" />
  <style>
    :root { color-scheme: light dark; }
    body { margin: 0; }
    #__err { position: fixed; left: 0; right: 0; bottom: 0; max-height: 55%; overflow: auto; margin: 0;
      padding: 12px 14px; background: #b00020; color: #fff;
      font: 12px/1.5 ui-monospace, Menlo, monospace; white-space: pre-wrap; z-index: 2147483647; }
  </style>
</head>
<body>
  <div id="root"></div>
  <pre id="__err" style="display:none"></pre>
  <script>
    function __showErr(m) {
      var e = document.getElementById('__err');
      if (e) { e.style.display = 'block'; e.textContent = String(m); }
      try { console.error(String(m)); } catch (_) {}
    }
    window.addEventListener('error', function (ev) {
      if (ev && ev.target && (ev.target.src || ev.target.href)) { __showErr('Failed to load: ' + (ev.target.src || ev.target.href)); return; }
      __showErr((ev && ev.error && ev.error.stack) || (ev && ev.message) || 'Error');
    }, true);
    window.addEventListener('unhandledrejection', function (ev) {
      var r = ev && ev.reason;
      __showErr('Unhandled rejection: ' + ((r && r.stack) || (r && r.message) || r));
    });
  </script>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`

const MAIN_TSX = `import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 自挂载 + default 导出两样都留着：前者是 bundle 形态需要的，后者让同一份代码
// 也能被源码型系统外壳挂载。少任何一个都会在对应形态下白屏。
const root = document.getElementById('root');
if (root && root.children.length === 0) {
  createRoot(root).render(createElement(StrictMode, null, createElement(App)));
}

export default App;
`

// ---------------------------------------------------------------------------
// 4. 主流程
// ---------------------------------------------------------------------------

function migrate(appId, options) {
  const source = appPaths(appId)
  if (!fs.existsSync(source.srcDir)) throw new Error(`找不到 ${source.relative}/src`)
  if (fs.existsSync(source.packageJSON) && !options.force) {
    throw new Error(`${source.relative} 已经是构建型工程（有 package.json）。要重跑加 --force`)
  }
  const manifest = readJSON(source.manifest)
  const meta = fs.existsSync(source.appJSON) ? readJSON(source.appJSON) : {}
  const outDir = options.outDir ?? source.dir
  const report = {
    appId, outDir: path.relative(ROOT, outDir), dryRun: options.dryRun,
    renamed: [], rewrites: [], residual: [], hints: [], generated: [], typeErrors: [],
    todo: [], wrapperFiles: new Set(),
  }

  const relatives = listSourceFiles(source.srcDir)
  const writes = []

  for (const relative of relatives) {
    const abs = path.join(source.srcDir, relative)
    if (relative === 'manifest.json') {
      const next = { ...manifest, runtimeKind: 'bundle', template: 'react' }
      writes.push({ to: path.join(outDir, 'src', 'manifest.json'), content: `${JSON.stringify(next, null, 2)}\n` })
      report.generated.push('src/manifest.json（补 runtimeKind: "bundle"）')
      continue
    }
    const ext = path.extname(relative)
    if (!TS_EXT[ext]) {
      // 非代码资源原样搬运。
      writes.push({ to: path.join(outDir, 'src', relative), copyFrom: abs })
      continue
    }
    let code = fs.readFileSync(abs, 'utf8')
    code = rewriteRelativeImports(code)
    // ① 先处理手写 host 封装的 import（迁移的主要工作量），② 再处理直接的裸桥调用。
    const wrapper = rewriteHostWrapperImports(code, report, relative)
    const { code: rewritten, used } = rewriteBridgeCalls(wrapper.code, report, relative)
    code = ensureSDKImport(rewritten, new Set([...wrapper.sdkSymbols, ...used]))

    // 入口 app.jsx -> App.tsx，并新建 main.tsx。
    const isEntry = relative === 'app.jsx' || relative === 'app.tsx'
    const to = isEntry ? 'App.tsx' : targetName(relative)
    if (to !== relative) report.renamed.push(`${relative} -> ${to}`)
    writes.push({ to: path.join(outDir, 'src', to), content: code })
  }

  writes.push({ to: path.join(outDir, 'src', 'main.tsx'), content: MAIN_TSX })
  writes.push({ to: path.join(outDir, 'package.json'), content: PACKAGE_JSON(appId, meta.summary) })
  writes.push({ to: path.join(outDir, 'tsconfig.json'), content: TSCONFIG })
  writes.push({ to: path.join(outDir, 'vite.config.ts'), content: VITE_CONFIG })
  writes.push({ to: path.join(outDir, 'index.html'), content: INDEX_HTML(manifest.name ?? appId) })
  if (outDir !== source.dir && fs.existsSync(source.appJSON)) {
    writes.push({ to: path.join(outDir, 'app.json'), copyFrom: source.appJSON })
  }
  report.generated.push('src/main.tsx', 'package.json', 'tsconfig.json', 'vite.config.ts', 'index.html')

  if (options.dryRun) return report

  for (const write of writes) {
    fs.mkdirSync(path.dirname(write.to), { recursive: true })
    if (write.copyFrom) fs.copyFileSync(write.copyFrom, write.to)
    else fs.writeFileSync(write.to, write.content, 'utf8')
  }
  // 就地迁移：旧的 .jsx/.js 已经有了 .tsx/.ts 对应物，删掉，否则两份并存、构建取到旧的。
  if (outDir === source.dir) {
    for (const relative of relatives) {
      const ext = path.extname(relative)
      if (!TS_EXT[ext]) continue
      const old = path.join(source.srcDir, relative)
      if (fs.existsSync(old)) fs.rmSync(old)
    }
  }

  // 类型检查：装依赖 + tsc。失败是**预期内**的，如实记录而不是当成迁移失败。
  try {
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'ignore' })
    execFileSync('npx', ['tsc', '--noEmit'], { cwd: outDir, encoding: 'utf8', stdio: 'pipe' })
    report.typeErrors = []
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    report.typeErrors = output.split('\n').filter((line) => /error TS/.test(line))
  }
  return report
}

function printReport(report) {
  console.log('')
  ok(`迁移报告：${report.appId}${report.dryRun ? '（--dry-run，未写盘）' : ` -> ${report.outDir}`}`)

  console.log('\n【① 改名】')
  if (report.renamed.length === 0) info('（无）')
  for (const line of report.renamed) info(line)

  console.log('\n【② 已自动改写成 SDK 调用】')
  if (report.rewrites.length === 0) info('（无）')
  const byRule = new Map()
  for (const item of report.rewrites) {
    if (!byRule.has(item.rule)) byRule.set(item.rule, { files: [], note: item.note })
    byRule.get(item.rule).files.push(item.file)
  }
  for (const [rule, { files, note }] of byRule) {
    info(`${rule} — ${files.length} 个文件：${files.slice(0, 4).join(', ')}${files.length > 4 ? ' …' : ''}`)
    if (note) info(`    ↳ ${note}`)
  }

  console.log('\n【③ 仍是裸桥调用（SDK 无专门封装，保持直用；类型由 SDK 的全局 d.ts 提供）】')
  const byCall = new Map()
  for (const { file, call } of report.residual) {
    if (!byCall.has(call)) byCall.set(call, new Set())
    byCall.get(call).add(file)
  }
  if (byCall.size === 0) info('（无）')
  for (const [call, files] of [...byCall].sort()) {
    info(`${call} — ${files.size} 个文件`)
  }

  console.log('\n【④ TODO(migrate)：自动改写没把握，必须人工过一遍】')
  const todos = [...new Map(report.todo.map((t) => [`${t.symbol}`, t])).values()]
  if (todos.length === 0) info('（无）')
  for (const item of todos) {
    const files = report.todo.filter((t) => t.symbol === item.symbol).length
    info(`${item.symbol}（${files} 处）—— ${item.hint || '应用自有逻辑，保持原样即可'}`)
  }
  if (report.wrapperFiles.size > 0) {
    console.log('')
    warn(`手写桥封装 ${[...report.wrapperFiles].join(', ')} 的职责已部分由 SDK 承担；`
      + '把剩余导出（应用自有业务胶水）留下、其余删掉，是这次迁移最主要的收益')
  }

  console.log('\n【④b 其它建议】')
  const hints = [...new Set(report.hints.map((h) => `${h.file}: ${h.hint}`))]
  if (hints.length === 0) info('（无）')
  for (const line of hints) info(line)

  console.log('\n【⑤ 生成的工程文件】')
  for (const line of report.generated) info(line)

  console.log('\n【⑥ tsc --noEmit 结果】')
  if (report.dryRun) {
    info('（--dry-run 不跑 tsc）')
  } else if (report.typeErrors.length === 0) {
    ok('类型检查通过')
  } else {
    warn(`${report.typeErrors.length} 条类型错误 —— 这是预期的，逐条修就是迁移的实际工作量：`)
    for (const line of report.typeErrors.slice(0, 40)) info(line)
    if (report.typeErrors.length > 40) info(`… 还有 ${report.typeErrors.length - 40} 条`)
  }
  console.log('')
}

function main() {
  const argv = process.argv.slice(2)
  const appId = argv.find((arg) => !arg.startsWith('-'))
  if (!appId) {
    throw new Error('用法：node scripts/migrate-to-ts.mjs <appId> [--dry-run] [--out <dir>] [--in-place --force]')
  }
  const outIndex = argv.indexOf('--out')
  const options = {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    outDir: outIndex >= 0 ? path.resolve(ROOT, argv[outIndex + 1]) : undefined,
  }
  if (!options.dryRun && !options.outDir && !argv.includes('--in-place')) {
    throw new Error('就地迁移会改写别人的目录。要么给 --out <目录> 迁到副本，要么显式写 --in-place --force')
  }
  if (argv.includes('--in-place') && !options.force) {
    throw new Error('--in-place 需要同时加 --force（这会删掉原来的 .jsx/.js）')
  }
  printReport(migrate(appId, options))
}

try {
  main()
} catch (error) {
  fail(String(error.message ?? error))
  process.exit(1)
}
