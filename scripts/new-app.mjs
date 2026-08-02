#!/usr/bin/env node
// 生成一个新应用骨架（app.json + src/manifest.json + src/app.jsx）。
//
//   node scripts/new-app.mjs com.aibox.weather --name "天气" --icon cloud.sun.fill --category tools

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
    else if (arg.startsWith('-')) throw new Error(`未知参数 ${arg}`)
    else positional.push(arg)
  }
  return { positional, flags }
}

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

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  const appId = positional[0]
  if (!appId) throw new Error('用法：node scripts/new-app.mjs <appId> [--name …] [--icon …] [--category …]')
  if (!isValidAppID(appId)) throw new Error(`appId 必须是小写反向域名，例如 com.aibox.weather（收到 ${appId}）`)

  const paths = appPaths(appId)
  if (fs.existsSync(paths.dir)) throw new Error(`${paths.relative} 已存在`)

  const name = flags.name ?? appId.split('.').pop()
  const category = flags.category ?? 'tools'
  if (!CATEGORIES.has(category)) {
    throw new Error(`category 非法：${category}（可选：${[...CATEGORIES].join(', ')}）`)
  }
  const icon = flags.icon ?? 'puzzlepiece.extension.fill'

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
    securityMode: 'secure',
    permissions: { network: false, storage: true, ai: false, networkAllowed: [], capabilities: [] },
    presentation: { default: 'page', surfaces: ['page', 'fullscreen'] },
  })

  fs.writeFileSync(path.join(paths.srcDir, 'app.jsx'), APP_JSX.replaceAll('<NAME>', name), 'utf8')

  ok(`已创建 ${paths.relative}`)
  info('下一步：改 src/app.jsx，然后 node scripts/validate.mjs')
  info(`发布：node scripts/release.mjs ${appId} 1.0.0 --notes "首个版本"`)
}

try {
  main()
} catch (error) {
  fail(String(error.message ?? error))
  process.exit(1)
}
