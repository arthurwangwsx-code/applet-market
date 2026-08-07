#!/usr/bin/env node
// 创建唯一受支持的新应用形态：bundle + TypeScript + @aibox/applet-sdk。
// 存量 JS 可以逐步迁移，但新应用不再提供会绕开 SDK/类型/构建闸门的 source 逃生口。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
    else if (arg === '--source') {
      throw new Error('--source 已退役：新应用必须使用 TypeScript；存量迁移请运行 scripts/migrate-to-ts.mjs')
    } else if (arg.startsWith('-')) throw new Error(`未知参数 ${arg}`)
    else positional.push(arg)
  }
  return { positional, flags }
}

export const APP_TSX = `import { useEffect, useState } from 'react'
import { checkCompatibility, storage, supports, ui } from '@aibox/applet-sdk'
import { useAppletInsets } from 'aibox/ui'

const countStore = storage.defineKey<number>('counter', 0, {
  parse: (raw) => typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined,
})

// <NAME> —— 默认模板刻意展示平台的三条纪律：
// 1. 宿主能力先探测；2. 可选能力缺席时主动降级；3. 持久化只通过 SDK。
export default function App() {
  const insets = useAppletInsets()
  const [count, setCount] = useState(0)
  const [message, setMessage] = useState('正在读取本地数据…')
  const compatibility = checkCompatibility({
    capabilities: [{ namespace: 'toast', method: 'show', optional: true }],
  })

  useEffect(() => {
    void countStore.read().then((value) => {
      setCount(value)
      setMessage(compatibility.degraded ? '已进入兼容模式' : '已连接 AiBox 容器')
    })
  }, [compatibility.degraded])

  const increment = async () => {
    const next = count + 1
    setCount(next)
    try {
      await countStore.write(next)
      setMessage('已保存到应用私有存储')
      if (supports('capability:toast.show')) await ui.toast('已保存')
    } catch {
      setMessage('保存不可用，本次计数仅保留在当前页面')
    }
  }

  return (
    <main className="ax-app" style={{ padding: 16, paddingBottom: Math.max(16, insets.bottom) }}>
      <section className="ax-card" aria-labelledby="counter-title">
        <h1 id="counter-title"><NAME></h1>
        <p className="ax-muted">{message}</p>
        <p data-testid="counter-value" aria-live="polite">{count}</p>
        <button className="ax-btn ax-btn-primary" data-testid="increment" type="button" onClick={increment}>
          增加一次
        </button>
      </section>
    </main>
  )
}
`

export const TESTS = {
  version: 1,
  defaultSuite: 'smoke',
  suites: {
    smoke: [
      { action: 'wait', ms: 300 },
      {
        action: 'assert',
        expr: "Number.isFinite(Number(document.querySelector('[data-testid=counter-value]')?.textContent))",
        matcher: 'truthy',
      },
      {
        action: 'eval',
        expr: "window.__aiboxCounterBefore = Number(document.querySelector('[data-testid=counter-value]')?.textContent); document.querySelector('[data-testid=increment]')?.click()",
      },
      {
        action: 'assert',
        expr: "Number(document.querySelector('[data-testid=counter-value]')?.textContent) === window.__aiboxCounterBefore + 1",
        matcher: 'truthy',
      },
      { action: 'assert', matcher: 'noHorizontalOverflow' },
    ],
  },
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  const appId = positional[0]
  if (!appId) throw new Error('用法：node scripts/new-app.mjs <appId> [--name …] [--icon …] [--category …]')
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
    runtimeKind: 'bundle',
    securityMode: 'secure',
    permissions: { network: false, storage: true, ai: false, networkAllowed: [], capabilities: ['toast'] },
    presentation: { default: 'page', surfaces: ['page', 'fullscreen'] },
  })
  writeJSON(path.join(paths.dir, 'package.json'), {
    name: `@aibox-app/${slug}`,
    private: true,
    version: '1.0.0',
    description: `${name} —— AiBox 小应用。`,
    type: 'module',
    scripts: {
      typecheck: 'tsc --noEmit -p tsconfig.json',
      build: 'aibox-tsbuild',
      'build:ci': 'aibox-tsbuild',
      'check:build': 'aibox-tsbuild --check',
    },
    dependencies: { '@aibox/applet-sdk': '^1.1.0' },
    devDependencies: {
      '@aibox/applet-tsbuild': '^1.0.0',
      '@types/react': '^18.3.12',
      '@types/react-dom': '^18.3.1',
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      typescript: '^5.9.3',
    },
  })
  writeJSON(path.join(paths.dir, 'tsconfig.json'), {
    extends: '@aibox/applet-tsbuild/tsconfig.base.json',
    include: ['src'],
  })
  fs.writeFileSync(path.join(paths.srcDir, 'app.tsx'), APP_TSX.replaceAll('<NAME>', name), 'utf8')
  writeJSON(path.join(paths.srcDir, '.tests.json'), TESTS)

  ok(`已创建 ${paths.relative}（bundle + TypeScript + 宿主共享 SDK）`)
  info('下一步：npm install，然后实现业务与 manifest 权限声明')
  info(`验证：npm run typecheck --prefix ${paths.relative} && npm run build --prefix ${paths.relative}`)
  info('首次构建后：npm run budgets:update，并审阅新增应用的包体/性能预算')
  info('提交前：npm run verify')
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    fail(String(error.message ?? error))
    process.exit(1)
  }
}
