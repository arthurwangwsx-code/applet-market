// 小应用运行时由宿主提供的裸模块。
//
// 市场工具、构建器和脚手架都必须以这张表为准。宿主 Swift 仍是跨仓协议的最终真值，
// `scripts/audit-runtime-contracts.mjs` 会在宿主源码可见时逐条比对；独立 clone 市场仓库时，
// 这张表则是可执行的协议快照。不要在 validate/new-app 里再手抄一份。

export const RUNTIME_MODULE_FILES = Object.freeze({
  react: 'react.mjs',
  'react-dom': 'react.mjs',
  'react-dom/client': 'react.mjs',
  'react/jsx-runtime': 'react.mjs',
  'chart.js': 'chart.mjs',
  'antd-mobile': 'antd-mobile.mjs',
  'aibox/sdk': 'aibox-sdk.mjs',
  'aibox/sdk/react': 'aibox-sdk.mjs',
  'aibox/ui': 'aibox-ui.mjs',
})

export const RUNTIME_MODULE_URLS = Object.freeze(
  Object.fromEntries(
    Object.entries(RUNTIME_MODULE_FILES).map(([specifier, file]) => [specifier, `applet://localhost/runtime/${file}`]),
  ),
)

export const EXTERNAL_MODULES = Object.freeze(Object.keys(RUNTIME_MODULE_FILES))

export const FORBIDDEN_MODULES = Object.freeze({
  'react/jsx-dev-runtime': '开发态 JSX runtime 没有随宿主分发；请使用 production 构建。',
  'chart.js/auto': "宿主只提供 'chart.js'；请显式注册 registerables。",
  antd: "手机端只能使用宿主提供的 'antd-mobile'。",
})

export function importMapJSON(indent = 6) {
  const pad = ' '.repeat(indent)
  const entries = Object.entries(RUNTIME_MODULE_URLS)
    .map(([specifier, url]) => `${pad}  ${JSON.stringify(specifier)}: ${JSON.stringify(url)}`)
    .join(',\n')
  return `{\n${pad}"imports": {\n${entries}\n${pad}}\n${' '.repeat(Math.max(0, indent - 2))}}`
}
