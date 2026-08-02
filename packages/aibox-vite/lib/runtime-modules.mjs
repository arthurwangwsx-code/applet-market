//
//  runtime-modules.mjs
//  宿主随运行时资产提供的模块 —— 构建时**恒为 external**，运行时由 import map 解析。
//
//  ## 单一真值与它的三个副本
//  Swift 侧 `AppletImportRules.bareToFile`（Packages/AppletPluginKit/.../Runtime/AppletImportRules.swift）
//  是真值。它在三个地方被复制，任何一处漂移都会白屏：
//    ① 这里（构建 external 名单 + index.html import map 生成）
//    ② `applet-market/scripts/lib/market.mjs` 的 `BARE_IMPORT_ALLOWLIST`（validate 闸门）
//    ③ 宿主 react 外壳 `AppletTemplates.reactShellHTML` 的 importmap
//  `scripts/validate.mjs` 会拿这份表校验产物里的裸 import，是漂移的兜底闸门。
//
//  ⚠️ 这些是宿主 esbuild 自建的 bundle，**不是 npm 原版**。不要试图换成 CDN 同名包
//  （模块格式与 interop 垫片不同，`import { Button } from 'antd-mobile'` 会静默坏掉）。
//

/** 裸说明符 -> 运行时产物 URL。与 Swift `AppletImportRules.bareToFile` 逐条一致。 */
export const RUNTIME_MODULE_URLS = Object.freeze({
  'react': 'applet://localhost/runtime/react.mjs',
  'react-dom': 'applet://localhost/runtime/react.mjs',
  'react-dom/client': 'applet://localhost/runtime/react.mjs',
  'react/jsx-runtime': 'applet://localhost/runtime/react.mjs',
  'chart.js': 'applet://localhost/runtime/chart.mjs',
  'antd-mobile': 'applet://localhost/runtime/antd-mobile.mjs',
  'aibox/ui': 'applet://localhost/runtime/aibox-ui.mjs',
});

/** 构建时恒 external 的说明符。 */
export const EXTERNAL_MODULES = Object.freeze(Object.keys(RUNTIME_MODULE_URLS));

/**
 * `react/jsx-dev-runtime`：**production 构建绝不该出现**。
 * 宿主 import map 里没有它（Swift bareToFile 也没有），一旦漏进产物就是 404 白屏。
 * Vite 只在 dev 用 jsx-dev-runtime，`vite build` 走 automatic runtime 的 production 分支，
 * 所以正常不会出现；这里单列出来是为了让 validate 能给出一条**有解释的**错误而不是「未知模块」。
 */
export const FORBIDDEN_MODULES = Object.freeze({
  'react/jsx-dev-runtime': 'jsx-dev-runtime 只在开发模式存在，宿主 import map 没有它。用 vite build（production）而不是 dev 产物。',
  'chart.js/auto': "宿主 import map 只有整包 'chart.js'。改成 import { Chart, registerables } from 'chart.js' 后手动 Chart.register(...registerables)。",
});

/** 生成 index.html 用的原生 import map JSON 串。 */
export function importMapJSON(indent = 6) {
  const pad = ' '.repeat(indent);
  const entries = Object.entries(RUNTIME_MODULE_URLS)
    .map(([specifier, url]) => `${pad}  ${JSON.stringify(specifier)}: ${JSON.stringify(url)}`)
    .join(',\n');
  return `{\n${pad}"imports": {\n${entries}\n${pad}}\n${' '.repeat(Math.max(0, indent - 2))}}`;
}
