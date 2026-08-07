import { checkManifest, renderActionTypes } from './lib/action-types.mjs'

export { checkManifest, renderActionTypes }
// 标准小应用的严格 TypeScript → 保结构 ESM 构建。
//
// ## 为什么要这条管线（而不是都改成 bundle）
//
// 已发布的小应用是 `source` 型：宿主按路径逐个伺服 `src/**`，多文件 ESM，没有打包步骤。
// 用 Vite 打成单文件能拿到类型，但把**模块图**整个换掉了：一个 app.js、标识符重命名、
// tree-shaking 决定谁还在——出问题时既不能按文件定位，diff 也没法读。
//
// 这条管线换一个方向：**开发期是 TS，产物仍是逐文件 1:1 的多文件 ESM**。
//
// ⚠️ 一处要说准的地方：产物**仍要声明 `runtimeKind: "bundle"`**。
// 那个字段在宿主侧只管两件事——要不要加载浏览器内转译器（es-module-shims + Sucrase）、
// 以及包里没有 index.html 时补哪份默认外壳。我们的产物是已编译的纯 `.js` 且自带外壳，
// 所以「预构建、端上不转译」正是对它的**如实**描述；标成 source 反而会让宿主白加载一套转译器。
// 也就是说：保住的是**文件结构与模块图**（这才是可读、可定位、可回滚的那部分），
// 不是「一个字节都没变」——加载器确实从 shim 换成了原生 ESM。
//   src/**（.tsx/.ts，唯一手写源）  --tsc-->  dist/**（.js，签入，发版打它）
//
// 目录用 `src/` → `dist/` 而不是另造一对名字：市场工具链**已经**按「有 package.json = 构建型、
// 进包的是 dist/ 平铺到包根、manifest.json/.tests.json 从 src/ 取」这套约定工作
// （`collectBundleEntries`）。顺着它走，validate / release / 索引一行都不用改；
// 另造第三种形态则要动全套工具，且每处都是新的漏判面。
// 于是：
//  · 文件结构与模块图 1:1 保留 → diff 可读、报错能按文件定位、回滚面清晰；
//  · 端上**更快**：源码型每个 `.jsx/.tsx/.ts` 都要过一遍浏览器内 Sucrase，
//    预编译成 `.js` 之后一次都不用过；
//  · 开发期拿到完整类型 + lint。
//
// ## 三条硬约束（verify() 会逐条检查，不满足就不写盘）
//
// 1. **相对 import 必须带 `.js` 扩展名。** 宿主对 `.js` 是原样伺服、**不做 import 重写**
//    （重写只发生在转译路径上）。少一个扩展名，浏览器就去请求一个不存在的路径，表现是白屏。
//    所以源码里就要写 `./foo.js`（TS 的 bundler 解析允许这么写，实际文件是 `foo.tsx`）。
// 2. **裸说明符只能是 import map 里那几个。** 宿主 import map 之外的裸 import 在运行时解析不到。
// 3. **`@aibox/applet-sdk`（含 `/react` 子路径）必须改写到宿主共享运行时。** tsc 不重写裸说明符，
//    所以这里把 npm 开发期入口确定性替换为 `aibox/sdk` / `aibox/sdk/react`。两者由宿主 import map
//    指向同一个 `aibox-sdk.mjs`，应用产物不再各带一份 SDK 实现。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** 宿主 import map 提供的裸说明符（与 Swift `AppletImportRules.bareToFile` 对齐）。 */
export const HOST_BARE_SPECIFIERS = new Set([
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'chart.js',
  'antd-mobile',
  'aibox/ui',
  'aibox/sdk',
  'aibox/sdk/react',
])

const SDK_SPECIFIER = '@aibox/applet-sdk'
const SDK_RUNTIME_SPECIFIER = 'aibox/sdk'

// SDK 的 React 子路径。它是**另一个入口**（hooks），不在 `dist/index.js` 的导出面里，
// 所以要单独打一份。只有真用到时才 emit —— 否则已经在架上的 7 个应用会凭空多出一个产物文件。
const SDK_REACT_SPECIFIER = '@aibox/applet-sdk/react'
const SDK_REACT_RUNTIME_SPECIFIER = 'aibox/sdk/react'

/** 从一段 JS 里抓出所有 import/export 说明符（含动态 import）。 */
export function specifiersIn(code) {
  const out = []
  // **必须锚在行首**：裸 `\bfrom\s*['"]` 会把字符串内容当成 import ——
  // `menu === 'from'` 里那个 `from` 紧跟闭合引号，正则就从那儿开始捕获，
  // 于是报出 `裸说明符 '), onClick: () => setMenu('` 这种荒唐结果（2026-08-05 实测被自己的闸门咬到）。
  // tsc 产物的 import/export 一律在行首独占一行，锚定行首既准确又不需要真解析器。
  const patterns = [
    /^\s*import\s[^'"]*from\s*['"]([^'"]+)['"]/gm,
    /^\s*export\s[^'"]*from\s*['"]([^'"]+)['"]/gm,
    /^\s*import\s*['"]([^'"]+)['"]/gm,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(code)) !== null) out.push(m[1])
  }
  return out
}

/** 三条硬约束的检查。返回问题清单（空 = 通过）。 */
export function verify(files) {
  const problems = []
  for (const [rel, code] of files) {
    for (const spec of specifiersIn(code)) {
      const isRelative = spec.startsWith('./') || spec.startsWith('../')
      if (isRelative) {
        if (!/\.[a-zA-Z0-9]+$/.test(spec)) {
          problems.push(
            `${rel}: 相对 import 缺扩展名 —— '${spec}'。` +
              `产物是原样伺服的，宿主不会替你补 '.js'，浏览器会去请求一个不存在的路径（白屏）。` +
              `源码里就写 './x.js'（TS 的 bundler 解析认这种写法）。`,
          )
        } else if (/\.(tsx?|jsx)$/.test(spec)) {
          // 比「缺扩展名」更阴：tsc **原样保留** import 说明符，不会把 '.jsx' 改写成 '.js'。
          // 于是产物里留下一个指向源码扩展名的路径，而 dist/ 里只有 `.js` —— 404 白屏，
          // 且「有扩展名」这条检查会放过它。源码里一律写 './x.js'，哪怕文件真身是 x.tsx。
          problems.push(
            `${rel}: 相对 import 指向源码扩展名 —— '${spec}'。` +
              `tsc 不重写说明符，而 dist/ 里只有编译后的 '.js'，运行时会 404（白屏）。` +
              `改成 '${spec.replace(/\.(tsx?|jsx)$/, '.js')}'。`,
          )
        }
        continue
      }
      if (spec.startsWith('/') || /^[a-z]+:/i.test(spec)) continue
      if (spec === SDK_SPECIFIER || spec === SDK_REACT_SPECIFIER) {
        problems.push(`${rel}: 残留裸 SDK 说明符 '${spec}' —— 产物重写没覆盖到，请报告这个 case。`)
        continue
      }
      if (!HOST_BARE_SPECIFIERS.has(spec)) {
        problems.push(
          `${rel}: 裸说明符 '${spec}' 不在宿主 import map 里，运行时解析不到。` +
            `可用的只有：${[...HOST_BARE_SPECIFIERS].join(', ')}。`,
        )
      }
    }
  }
  return problems
}

/**
 * 生成的外壳 `index.html`。
 *
 * 为什么要自带而不是让宿主补默认外壳：宿主的源码型默认外壳硬编码 `import('./app.jsx')`，
 * 而本管线的产物入口是 `app.js`（已编译，端上不需要再转译）。安装器只在**包里没有 index.html 时**
 * 才补默认外壳（`AppletMarketInstaller` ①'），所以自带一份就能把入口指对，同时保住
 * 「全部 `.js`、端上零转译」这个收益。
 *
 * 挂载契约与宿主默认外壳**逐字一致**：`app.js` 只需 `export default function App(){…}`，
 * 也兼容自挂载（root 非空就跳过）。少了这条兼容，两种外壳之间来回切就会白屏。
 */
export function shellHTML(title) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHTML(title)}</title>
  <!-- 本文件由 @aibox/applet-tsbuild 生成，请勿手改。 -->
  <script type="importmap">
  {
    "imports": {
      "react": "applet://localhost/runtime/react.mjs",
      "react-dom": "applet://localhost/runtime/react.mjs",
      "react-dom/client": "applet://localhost/runtime/react.mjs",
      "react/jsx-runtime": "applet://localhost/runtime/react.mjs",
      "chart.js": "applet://localhost/runtime/chart.mjs",
      "antd-mobile": "applet://localhost/runtime/antd-mobile.mjs",
      "aibox/ui": "applet://localhost/runtime/aibox-ui.mjs",
      "aibox/sdk": "applet://localhost/runtime/aibox-sdk.mjs",
      "aibox/sdk/react": "applet://localhost/runtime/aibox-sdk.mjs"
    }
  }
  </script>
  <link rel="stylesheet" href="applet://localhost/runtime/aibox-ui.css" />
  <style>
    :root { color-scheme: light dark; }
    body { margin: 0; }
    #__err {
      position: fixed; left: 0; right: 0; bottom: 0; max-height: 55%; overflow: auto;
      margin: 0; padding: 12px 14px; background: #b00020; color: #fff;
      font: 12px/1.5 ui-monospace, Menlo, monospace; white-space: pre-wrap; z-index: 2147483647;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <pre id="__err" style="display:none"></pre>
  <script>
    // 可见错误浮层：WKWebView 里没有控制台，没有这一层「白屏」就是全部信息。
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
  <script type="module">
    import { createElement, StrictMode } from 'react';
    import { createRoot } from 'react-dom/client';
    var sharedSDKReady = false;
    try {
      // 共享 SDK 先于业务模块预检。老宿主 / 资产缺失时在这里给出可见、可捕获的兼容页，
      // 不让 app.js 的静态 import 直接把整页打成白屏。
      const sdk = await import('aibox/sdk');
      const compatibility = sdk.checkCompatibility({
        minSDKVersion: '1.1.0',
        runtimeModules: ['aibox/sdk']
      });
      if (!compatibility.compatible) {
        const problem = compatibility.errors.map(function (item) {
          return item.target + (item.required ? ' >= ' + item.required : '');
        }).join(', ');
        throw new Error('aibox/incompatible-host: ' + (problem || 'shared SDK runtime unavailable'));
      }
      sharedSDKReady = true;
      const mod = await import('./app.js');
      const root = document.getElementById('root');
      if (mod && mod.default && root && root.children.length === 0) {
        createRoot(root).render(createElement(StrictMode, null, createElement(mod.default)));
      } else if (root && root.children.length === 0) {
        __showErr('app.js must \`export default function App(){…}\` (a React component). Nothing mounted.');
      }
    } catch (e) {
      var message = String((e && e.message) || e || '');
      // 通用动态 import 失败文案本身不含 URL；只有 SDK 预检阶段失败时才能据此归因宿主过旧。
      // app.js 自己 404 或其业务依赖失败必须保留真实的运行错误，不能误导成「请升级容器」。
      // 不用正则字面量：这段代码住在模板字符串里，转义斜杠会先被模板消费，
      // 生成含 aibox/sdk 的正则字面量后 WebKit 会把 sdk 当 flags，整个 module script 在解析期白屏。
      var sharedSDKMissing = !sharedSDKReady || new RegExp('aibox-sdk[.]mjs|aibox/sdk|incompatible-host', 'i').test(message);
      var locale = String((navigator && navigator.language) || document.documentElement.lang || '').toLowerCase();
      var upgradeHint = locale.indexOf('zh') === 0
        ? '这个小应用需要更新版本的 AiBox（宿主共享 aibox/sdk 运行时）。请升级 AiBox 后重新打开。'
        : 'This applet needs a newer AiBox container (shared aibox/sdk runtime). Update AiBox and reopen it.';
      __showErr(sharedSDKMissing
        ? upgradeHint + '\\n\\n' + message
        : 'Failed to run app.js: ' + ((e && e.stack) || e));
    }
  </script>
</body>
</html>
`
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

/** npm 开发期 SDK 入口 → 宿主共享运行时裸说明符。 */
export function rewriteSDKSpecifier(code) {
  let out = code
  for (const [specifier, runtimeSpecifier] of [
    [SDK_REACT_SPECIFIER, SDK_REACT_RUNTIME_SPECIFIER],
    [SDK_SPECIFIER, SDK_RUNTIME_SPECIFIER],
  ]) {
    out = out
      .replaceAll(`'${specifier}'`, `'${runtimeSpecifier}'`)
      .replaceAll(`"${specifier}"`, `"${runtimeSpecifier}"`)
  }
  return out
}

/**
 * 构建一个应用：`src/**`（手写源）→ `dist/**`（产物，签入、发版打它）。
 *
 * @param {object} options
 * @param {string} options.appDir 应用根目录（含 src/ 与 dist/）
 * @param {boolean} [options.check] 只校验不写盘：产物与磁盘不一致即失败（CI 的可复现闸门）
 */
export async function buildApplet({ appDir, check = false }) {
  const srcDir = path.join(appDir, 'src')
  const outDir = path.join(appDir, 'dist')
  if (!fs.existsSync(srcDir)) throw new Error(`找不到手写源目录：${srcDir}`)
  const legacySources = walk(srcDir).filter((relative) => /\.(?:js|jsx)$/.test(relative))
  if (legacySources.length > 0) {
    throw new Error(`标准工程禁止 JS/JSX 源码：\n  · ${legacySources.join('\n  · ')}`)
  }

  // manifest action 类型是源码合同的一部分。旧 Vite 插件退役后必须在唯一构建器里继续生成，
  // 否则 manifest 改了而 handler 仍按旧类型编译，`check:build` 也发现不了这类漂移。
  const manifestPath = path.join(srcDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) throw new Error(`缺少声明：${manifestPath}`)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const manifestProblems = checkManifest(manifest)
  if (manifestProblems.length > 0) throw new Error(`manifest 校验失败：\n  · ${manifestProblems.join('\n  · ')}`)
  const actionTypesPath = path.join(srcDir, 'aibox-actions.d.ts')
  const nextActionTypes = renderActionTypes(manifest)
  const currentActionTypes = fs.existsSync(actionTypesPath) ? fs.readFileSync(actionTypesPath, 'utf8') : null
  if (currentActionTypes !== nextActionTypes) {
    if (check) {
      throw new Error('src/aibox-actions.d.ts 与 manifest.actions 不一致；先运行 npm run build 并提交生成文件')
    }
    fs.writeFileSync(actionTypesPath, nextActionTypes, 'utf8')
  }

  const configPath = path.join(HERE, 'tsconfig.base.json')
  const base = ts.readConfigFile(configPath, ts.sys.readFile)
  if (base.error) throw new Error(ts.flattenDiagnosticMessageText(base.error.messageText, '\n'))

  // `paths` 里的相对项按 TS 5.0+ 的规则是**相对 tsconfig 文件**解析的；这里 basePath 传的是
  // 应用的 src/，照抄过去会被错解成 `<app>/src/types/aibox-ui.d.ts`（不存在）→ TS2307。
  // 所以先按本包目录绝对化。应用侧 `tsc -p tsconfig.json` 走的是正常继承路径，不受影响。
  const baseOptions = { ...base.config.compilerOptions }
  if (baseOptions.paths) {
    baseOptions.paths = Object.fromEntries(
      Object.entries(baseOptions.paths).map(([specifier, targets]) => [
        specifier,
        targets.map((target) => (target.startsWith('.') ? path.resolve(HERE, target) : target)),
      ]),
    )
  }

  const parsed = ts.parseJsonConfigFileContent(
    { ...base.config, include: ['**/*'], compilerOptions: { ...baseOptions, outDir, rootDir: srcDir, noEmit: false } },
    ts.sys,
    srcDir,
  )
  if (parsed.errors.length) {
    throw new Error(parsed.errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'))
  }

  // 产物先收在内存里：三条硬约束没过就一个字节都不写盘。
  const emitted = new Map()
  const host = ts.createCompilerHost(parsed.options)
  const writeFile = (fileName, text) => {
    const rel = path.relative(outDir, fileName).split(path.sep).join('/')
    emitted.set(rel, rewriteSDKSpecifier(text))
  }
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, host })
  const result = program.emit(undefined, writeFile)

  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics].filter(
    // 只拦真正的错误；标准工程的每个源码文件都必须进入严格 TypeScript 检查。
    (d) => d.category === ts.DiagnosticCategory.Error,
  )
  if (diagnostics.length) {
    const text = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => appDir,
      getNewLine: () => '\n',
    })
    throw new Error(`TypeScript 报错，未写盘：\n${text}`)
  }

  // 自带外壳：宿主默认外壳硬编码 import('./app.jsx')，而本管线的入口是已编译的 app.js。
  const title = fs.existsSync(manifestPath) ? (manifest.name ?? 'Applet') : 'Applet'
  emitted.set('index.html', shellHTML(title))

  // 非代码资源（.css / 图片…）原样带过去。
  // **`manifest.json` 与 `.tests.json` 例外**：市场约定它们是「作者手写声明」，只从 src/ 取，
  // 不进 dist/（`collectBundleEntries` 会显式拒绝 dist/ 里的 manifest.json）。
  const SIDECARS = new Set(['manifest.json', '.tests.json'])
  for (const rel of walk(srcDir)) {
    if (/\.(tsx?|jsx?)$/.test(rel) || SIDECARS.has(rel)) continue
    emitted.set(rel, fs.readFileSync(path.join(srcDir, rel)))
  }

  const problems = verify([...emitted.entries()].filter(([rel]) => rel.endsWith('.js')))
  if (problems.length) throw new Error(`产物不满足硬约束，未写盘：\n  · ${problems.join('\n  · ')}`)

  if (check) {
    const drift = []
    for (const [rel, content] of emitted) {
      const file = path.join(outDir, rel)
      const current = fs.existsSync(file) ? fs.readFileSync(file) : null
      const next = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
      if (!current || !current.equals(next)) drift.push(rel)
    }
    const known = new Set(emitted.keys())
    for (const rel of walk(outDir)) if (!known.has(rel)) drift.push(`${rel}（多余）`)
    return { emitted: emitted.size, drift }
  }

  // 先清掉不再产出的旧文件，再写：留着的话「删了一个源文件」不会反映到产物里。
  const known = new Set(emitted.keys())
  for (const rel of walk(outDir)) {
    if (!known.has(rel)) fs.rmSync(path.join(outDir, rel))
  }
  for (const [rel, content] of emitted) {
    const file = path.join(outDir, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return { emitted: emitted.size, drift: [] }
}

function walk(dir, prefix = '') {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // 只跳隐藏**目录**（.git/.cache…）。隐藏**文件**要带过去——`.tests.json` 是验收 CLI 的输入，
    // 漏掉它的表现是「应用还在，但自测一条都不跑」，而且不会有任何报错。
    if (entry.isDirectory() && entry.name.startsWith('.')) continue
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel))
    else out.push(rel)
  }
  return out
}
