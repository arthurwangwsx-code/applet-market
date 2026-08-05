#!/usr/bin/env node
// 生成一个新应用骨架。
//
//   node scripts/new-app.mjs com.aibox.weather --name "天气" --icon cloud.sun.fill --category tools
//   node scripts/new-app.mjs com.aibox.weather --source        # 旧的单文件 JSX 形态（不推荐）
//
// ## 默认形态是 bundle + TypeScript + SDK（2026-08-04 改）
//
// 改之前默认产出的是 `source` 型单文件 JSX：没有 package.json、不是 workspace 成员、
// **结构上够不到 `@aibox/applet-sdk`**。于是每个新应用只能自己抄一份 `host.js` 桥胶水——
// 实测一天内分叉从 4 份涨到 8 份（1992 行），而且几份对同一件事有不同答案
// （`ui.confirm` 不可用时回 null 还是 false、`openURL` 要不要封顶、图片走 applet:// 还是 data:）。
// AI 写新应用时会继承检索到的那一份，所以「默认形态错」是这条债务的**源头**，不是使用者不小心。
//
// bundle 形态不需要等 `aibox/sdk` 裸说明符落地（那是 source 运行时的事）：
// 它经 npm workspace + Vite 直接依赖 SDK，`timer` / `wordstudy` / `voicememos` 三个应用已经这么跑。
//
// `--source` 逃生口保留：确实需要「零构建、改完即跑」的场景仍然有（一次性小工具、教学示例）。
// 但它不再是默认——默认必须是对的那条路。

import fs from 'node:fs'
import path from 'node:path'
import { CATEGORIES, appPaths, fail, info, isValidAppID, ok, writeJSON } from './lib/market.mjs'

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--name') flags.name = argv[++i]
    else if (arg === '--name-en') flags.nameEN = argv[++i]
    else if (arg === '--summary') flags.summary = argv[++i]
    else if (arg === '--icon') flags.icon = argv[++i]
    else if (arg === '--tint') flags.tint = argv[++i]
    else if (arg === '--category') flags.category = argv[++i]
    else if (arg === '--source') flags.source = true
    else if (arg.startsWith('-')) throw new Error(`未知参数 ${arg}`)
    else positional.push(arg)
  }
  return { positional, flags }
}

// --- source 形态（逃生口）-----------------------------------------------------

const APP_JSX = `// <NAME> —— AiBox 小应用。
// 运行时：React 18 + antd-mobile v5（离线内置）。只导出 default，宿主外壳负责挂载。

import React from 'react'
import { Button, List } from 'antd-mobile'

export default function App() {
  const [count, setCount] = React.useState(0)
  return (
    <div style={{ padding: 16 }}>
      <List header="<NAME>">
        <List.Item extra={count}>点击次数</List.Item>
      </List>
      <Button block color="primary" style={{ marginTop: 16 }} onClick={() => setCount((n) => n + 1)}>
        点我
      </Button>
    </div>
  )
}
`

// --- bundle 形态（默认）------------------------------------------------------

const APP_TSX = `import { useState } from 'react'
import { Button, List } from 'antd-mobile'

// <NAME> —— AiBox 小应用（TypeScript + Vite + SDK）。
//
// 桥调用一律经 SDK（\`import { storage, toast } from '@aibox/applet-sdk'\`）：那是所有应用共享的
// **同一份**实现，带超时封顶、不可用降级和可操作的错误文案。缺什么就往 SDK 里补，
// 不要在应用里另起一套——「同一件事有好几个答案」正是这套平台此前最贵的一笔债。
export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: 16 }}>
      <List header="<NAME>">
        <List.Item extra={count}>点击次数</List.Item>
      </List>
      <Button block color="primary" style={{ marginTop: 16 }} onClick={() => setCount((n) => n + 1)}>
        点我
      </Button>
    </div>
  )
}
`

const MAIN_TSX = `import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/**
 * 入口。**同时兼容两种运行时形态**，这是刻意的：
 * · bundle（本工程）—— index.html 用原生 module 脚本加载本文件，由这里自己挂载；
 * · source（宿主默认外壳）—— 外壳 import 本模块的 default 导出并挂载，同时跳过已自挂载的模块。
 * 少了自挂载 → bundle 形态白屏；少了 default 导出 → source 形态白屏。
 */
const root = document.getElementById('root');
if (root && root.children.length === 0) {
  createRoot(root).render(createElement(StrictMode, null, createElement(App)));
}

export default App;
`

// import map 与 Swift `AppletImportRules.bareToFile` 对齐；宿主伺服 HTML 时还会
// `backfillImportMap`（只补不改），所以运行时后来新增的说明符会自动补进来，这份不会长期落后。
const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title><NAME></title>
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
    // 可见错误浮层：WKWebView 里没有控制台，没有这一层的话「白屏」就是全部信息。
    function __showErr(m) {
      var e = document.getElementById('__err');
      if (e) { e.style.display = 'block'; e.textContent = String(m); }
      try { console.error(String(m)); } catch (_) {}
    }
    window.addEventListener('error', function (ev) {
      if (ev && ev.target && (ev.target.src || ev.target.href)) {
        __showErr('Failed to load: ' + (ev.target.src || ev.target.href));
        return;
      }
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

const VITE_CONFIG = `// (unused)

// 全部约束（external / iOS 17 target / 相对基址 / 产物自检 / action 类型生成）都在预设里。
// 应用侧通常一行就够；要覆写就传参数，别绕过预设直接写裸 Vite 配置。
export default defineAppletConfig();
`

const GEN_ACTIONS =
  "node -e \"import('@aibox/applet-tsbuild').then(async m=>{const fs=await import('node:fs');" +
  "fs.writeFileSync('src/aibox-actions.d.ts',m.renderActionTypes(JSON.parse(fs.readFileSync('src/manifest.json','utf8'))))})\""

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  const appId = positional[0]
  if (!appId) throw new Error('用法：node scripts/new-app.mjs <appId> [--name …] [--icon …] [--category …] [--source]')
  if (!isValidAppID(appId)) throw new Error(`appId 必须是小写反向域名，例如 com.aibox.weather（收到 ${appId}）`)

  const paths = appPaths(appId)
  if (fs.existsSync(paths.dir)) throw new Error(`${paths.relative} 已存在`)

  const name = flags.name ?? appId.split('.').pop()
  const slug = appId.split('.').pop()
  const category = flags.category ?? 'tools'
  if (!CATEGORIES.has(category)) {
    throw new Error(`category 非法：${category}（可选：${[...CATEGORIES].join(', ')}）`)
  }
  const icon = flags.icon ?? 'puzzlepiece.extension.fill'
  const bundle = !flags.source

  writeJSON(paths.appJSON, {
    appId,
    name,
    ...(flags.nameEN ? { localizedNames: { en: flags.nameEN } } : {}),
    summary: flags.summary ?? '',
    icon,
    ...(flags.tint ? { iconTintHex: flags.tint } : {}),
    category,
    author: 'AiBox',
    tags: [],
  })

  writeJSON(paths.manifest, {
    name,
    ...(flags.nameEN ? { localizedNames: { en: flags.nameEN } } : {}),
    icon,
    ...(flags.tint ? { iconTintHex: flags.tint } : {}),
    summary: flags.summary ?? '',
    template: 'react',
    entry: 'index.html',
    ...(bundle ? { runtimeKind: 'bundle' } : {}),
    securityMode: 'secure',
    permissions: { network: false, storage: true, ai: false, networkAllowed: [], capabilities: [] },
    presentation: { default: 'page', surfaces: ['page', 'fullscreen'] },
  })

  if (!bundle) {
    fs.writeFileSync(path.join(paths.srcDir, 'app.jsx'), APP_JSX.replaceAll('<NAME>', name), 'utf8')
    ok(`已创建 ${paths.relative}（source 形态）`)
    info('⚠️ source 形态拿不到 @aibox/applet-sdk —— 桥调用要自己写。')
    info('   别再抄别的应用的 host.js：那是 8 份互相矛盾的分叉的由来（scripts/audit-host-forks.mjs 已把它棘轮住）。')
    info('下一步：改 src/app.jsx，然后 node scripts/validate.mjs')
    info(`发布：node scripts/release.mjs ${appId} 1.0.0 --notes "首个版本"`)
    return
  }

  writeJSON(path.join(paths.dir, 'package.json'), {
    name: `@aibox-app/${slug}`,
    private: true,
    version: '1.0.0',
    description: `${name} —— AiBox 小应用。`,
    type: 'module',
    scripts: {
      'gen:actions': GEN_ACTIONS,
      typecheck: 'tsc --noEmit',
      build: 'aibox-tsbuild',
      'build:ci': 'aibox-tsbuild',
      'check:build': 'aibox-tsbuild --check',
    },
    dependencies: { '@aibox/applet-sdk': '^1.0.0' },
    devDependencies: {
      '@aibox/applet-tsbuild': '^1.0.0',

      '@aibox/applet-tsbuild': '^1.0.0',
      '@types/react': '^18.3.12',
      '@types/react-dom': '^18.3.1',
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      typescript: '^5.9.3',
      'antd-mobile': '^5.38.1',
    },
  })
  writeJSON(path.join(paths.dir, 'tsconfig.json'), {
    extends: '@aibox/applet-tsbuild/tsconfig.base.json',
    include: ['src'],
  })
  fs.writeFileSync(path.join(paths.srcDir, 'app.tsx'), APP_TSX.replaceAll('<NAME>', name), 'utf8')

  ok(`已创建 ${paths.relative}（bundle + TypeScript + SDK）`)
  info('下一步：')
  info('  npm install                                   # 让新应用进 workspace（根 package.json 已是 apps/*）')
  info(`  npm run typecheck --prefix ${paths.relative}`)
  info(`  npm run build --prefix ${paths.relative}`)
  info(`发布：node scripts/release.mjs ${appId} 1.0.0 --notes "首个版本"`)
}

try {
  main()
} catch (error) {
  fail(String(error.message ?? error))
  process.exit(1)
}
