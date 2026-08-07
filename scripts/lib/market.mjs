// 小应用市场脚本共享库。
//
// 单一真值：目录布局、体积/路径限制、semver 比较、文件遍历、sha256、bundle 组装。
// validate / release / build-registry / new-app 都从这里取，避免规则漂移。

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXTERNAL_MODULES, FORBIDDEN_MODULES } from './runtime-modules.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const APPS_DIR = path.join(ROOT, 'apps')
export const REGISTRY_PATH = path.join(ROOT, 'registry.json')

export const SCHEMA_VERSION = 1

// —— 限制（与宿主 AppletMarketInstaller 的常量必须一致）——
export const LIMITS = {
  maxFileBytes: 2 * 1024 * 1024,
  maxVersionBytes: 8 * 1024 * 1024,
  maxFileCount: 500,
}

// 离线运行时可用的裸模块白名单。
//
// **真值是 Swift 侧 `AppletImportRules.bareToFile`**（Runtime/AppletImportRules.swift）——它同时决定
// 宿主 react 外壳的 import map。这份表必须与它**逐条相等**：
//  · 多一条 → validate 放过一个宿主解析不了的说明符 → 装上就白屏（且转译期零报错，极难归因）
//  · 少一条 → 误拒合法应用
export const BARE_IMPORT_ALLOWLIST = new Set(EXTERNAL_MODULES)

// 曾经在白名单里、但宿主**其实没有**的说明符。单列出来是为了给一条能自愈的错误，
// 而不是笼统的「未知模块」。（2026-08-03 修：`react/jsx-dev-runtime` 与 `chart.js/auto`
// 在市场白名单里但不在 Swift bareToFile、也不在 import map —— 放过去就是 404 白屏。）
export const KNOWN_MISSING_IMPORTS = new Map(Object.entries(FORBIDDEN_MODULES))

export const CATEGORIES = new Set([
  'information',
  'productivity',
  'tools',
  'media',
  'developer',
  'lifestyle',
  'game',
  'other',
])

// 宿主已知的 aibox.* 扩展能力命名空间（manifest.permissions.capabilities 的取值域）。
// 真值是 Swift 侧 `AppletCapabilityCatalog.declarableExtensionNamespaces`（有序数组，同时决定
// AI 工具 schema 的 enum）。这里必须与它逐字一致——多了会放过装不上的包，少了会误拒合法包。
// 注意 `tts`（语音**输出**）与 `speech`（语音**识别**）是两条能力，别混；`browser` 是 2026-08
// 新增（浏览器桥）；`download` 是 2026-08 新增（宿主下载引擎的遥控面）；`audio`（应用内录音）/ `speech`（端侧 STT）是 2026-08 新增的麦克风两条。
// `video`（宿主视频引擎的遥控面）与 `secrets`（Keychain 凭据 + 会话 cookie 罐）是 2026-08 新增。
// 注意 `video` 与 `media` 是两条：`media` 只播 applet 自己资源里的**音频**，
// `video` 是遥控宿主 AVPlayer 播任意 http(s) 视频（全屏 / 画中画 / 锁屏卡片都在那一侧）。
export const KNOWN_CAPABILITIES = new Set([
  'audio',
  'browser',
  'calendar',
  'clipboard',
  'contacts',
  'device',
  'download',
  'files',
  'haptics',
  'health',
  'location',
  'media',
  'music',
  'notifications',
  'open',
  'photos',
  'picker',
  'reminders',
  'secrets',
  'share',
  'shortcuts',
  'speech',
  'toast',
  'tools',
  'tts',
  'ui',
  'video',
  'vision',
  'voiceMemos',
])

// 容器协议自身的命名空间：恒可用，**不需要**也不应该写进 permissions.capabilities。
// 写进去不算错（宿主忽略），但会让用户以为这个应用要了更多权限，所以 validate 给一条提醒。
export const CONTAINER_NAMESPACES = new Set([
  'access',
  'action',
  'apps',
  'chat',
  'db',
  'jobs',
  'lifecycle',
  'list',
  'menu',
  'navigation',
  'resource',
  'scene',
  'tabs',
  'toolbar',
])

// 二进制扩展名 → base64；其余按 utf8 存。
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.icns',
  '.pdf',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.mp3',
  '.mp4',
  '.wav',
  '.m4a',
  '.zip',
])

// 永不进包的开发副产物。
const IGNORED_ENTRIES = new Set(['.DS_Store', 'node_modules', '.git', '.build', '.aibox'])

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

export function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

// —— semver ——

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/

export function parseSemver(value) {
  const match = SEMVER_RE.exec(String(value ?? ''))
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** a > b 返回正数；a < b 返回负数；相等返回 0。非法版本按 0.0.0 处理。 */
export function compareSemver(a, b) {
  const left = parseSemver(a) ?? [0, 0, 0]
  const right = parseSemver(b) ?? [0, 0, 0]
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i]
  }
  return 0
}

// —— 路径安全 ——

const APP_ID_RE = /^[a-z0-9]+(\.[a-z0-9][a-z0-9-]*)+$/

export function isValidAppID(value) {
  return typeof value === 'string' && APP_ID_RE.test(value) && value.length <= 96
}

/** 返回错误串，合法时返回 null。规则与 docs/market-protocol.md §6 一致。 */
export function relativePathError(relative) {
  if (!relative || typeof relative !== 'string') return '路径为空'
  if (relative.startsWith('/') || /^[a-zA-Z]:/.test(relative)) return `不允许绝对路径：${relative}`
  if (relative.split('/').includes('..')) return `不允许 .. 路径：${relative}`
  if (relative.startsWith('.aibox/')) return `.aibox/ 是宿主保留目录：${relative}`
  if (relative.length > 240) return `路径过长：${relative}`
  return null
}

// —— 文件遍历 ——

/** 递归列出 src/ 下的相对路径（已排序、已剔除开发副产物、拒绝符号链接）。 */
export function listSourceFiles(srcDir) {
  const out = []
  const walk = (dir, prefix) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (IGNORED_ENTRIES.has(entry.name)) continue
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isSymbolicLink()) throw new Error(`不允许符号链接：${relative}`)
      if (entry.isDirectory()) walk(path.join(dir, entry.name), relative)
      else if (entry.isFile()) out.push(relative)
    }
  }
  walk(srcDir, '')
  return out
}

export function encodingFor(relative) {
  return BINARY_EXTENSIONS.has(path.extname(relative).toLowerCase()) ? 'base64' : 'utf8'
}

/** 读单个文件 → bundle 文件条目（含 content）。`baseDir` 是源目录或产物目录。 */
export function readBundleFile(baseDir, relative) {
  const bytes = fs.readFileSync(path.join(baseDir, relative))
  const encoding = encodingFor(relative)
  return {
    path: relative,
    bytes: bytes.length,
    sha256: sha256(bytes),
    encoding,
    content: encoding === 'base64' ? bytes.toString('base64') : bytes.toString('utf8'),
  }
}

/** 剥掉 content，得到 release.json 用的清单条目。 */
export function stripContent(file) {
  const { content, ...rest } = file
  return rest
}

// —— 应用发现 ——

export function listAppIDs() {
  if (!fs.existsSync(APPS_DIR)) return []
  return fs
    .readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort()
}

export function appPaths(appId) {
  const dir = path.join(APPS_DIR, appId)
  return {
    dir,
    appJSON: path.join(dir, 'app.json'),
    srcDir: path.join(dir, 'src'),
    distDir: path.join(dir, 'dist'),
    packageJSON: path.join(dir, 'package.json'),
    manifest: path.join(dir, 'src', 'manifest.json'),
    releasesJSON: path.join(dir, 'releases.json'),
    releasesDir: path.join(dir, 'releases'),
    releaseDir: (version) => path.join(dir, 'releases', version),
    relative: `apps/${appId}`,
  }
}

// —— 两种工程形态 ——
//
// 市场同时承载两条链路（宿主 `AppletRuntimeKind` 的两个取值）：
//  · **构建型**（有 `package.json`）：TS + aibox-tsbuild 工程，进包的是 `dist/**` + `src/manifest.json`。
//  · **源码型**（无 `package.json`）：AI 直写的 `.jsx`，进包的是 `src/**`（历史行为，逐字不变）。
// 判据只有一个——**根目录有没有 `package.json`**。不用 manifest 的 runtimeKind 做判据：
// 那是给宿主看的运行时声明，而这里要回答的是「本地怎么打包」，两者不该互相依赖
// （manifest 写错时我们要能报错，而不是跟着它一起走错路）。

/** 这个应用是不是构建型工程。 */
export function isBuiltApp(appId) {
  return fs.existsSync(appPaths(appId).packageJSON)
}

/**
 * 一个应用要进包的文件清单：`[{ absDir, relative }]`，relative 就是 bundle 里的路径。
 *
 * 构建型：`dist/**` **平铺到包根**（`dist/index.html` → `index.html`，`entry: index.html` 因此命中）
 * ＋ 从 `src/` 取的**作者手写声明**（`manifest.json`、`.tests.json`）——它们是声明不是代码，
 * 不进构建产物，但必须随包走。
 */
/** 构建型工程里「住在 src/、必须原样进包」的作者手写文件。 */
const AUTHORED_SIDECARS = ['manifest.json', '.tests.json']

export function collectBundleEntries(appId) {
  const paths = appPaths(appId)
  if (!isBuiltApp(appId)) {
    return listSourceFiles(paths.srcDir).map((relative) => ({ absDir: paths.srcDir, relative }))
  }
  if (!fs.existsSync(paths.distDir)) {
    throw new Error(`${paths.relative} 是构建型工程但没有 dist/ —— 先跑 npm run build`)
  }
  const entries = listSourceFiles(paths.distDir).map((relative) => ({ absDir: paths.distDir, relative }))
  if (entries.some((entry) => entry.relative === 'manifest.json')) {
    throw new Error('dist/ 里不该有 manifest.json —— 它是声明不是构建产物，只从 src/manifest.json 取')
  }
  // `.tests.json` 之所以也要特判：它是应用自带的回归套件，`applet-verify test <appId>` 靠它重放。
  // 源码型应用天然带上（`listSourceFiles` 不跳 dotfile），构建型应用如果只取 dist/ 就会**静默丢掉**——
  // 表现是「源码里明明写了套件，装完却报『该应用没有 .tests.json』」，与历史上
  // `skipsHiddenFiles` 吃掉它是同一类坑。
  for (const sidecar of AUTHORED_SIDECARS) {
    if (!fs.existsSync(path.join(paths.srcDir, sidecar))) continue
    entries.push({ absDir: paths.srcDir, relative: sidecar })
  }
  return entries.sort((a, b) => a.relative.localeCompare(b.relative))
}

export function listReleaseVersions(appId) {
  const { releasesDir } = appPaths(appId)
  if (!fs.existsSync(releasesDir)) return []
  return fs
    .readdirSync(releasesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && parseSemver(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => compareSemver(b, a))
}

// —— 输出 ——

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR
const ESC = String.fromCharCode(27)
const paint = (code, text) => (COLOR ? `${ESC}[${code}m${text}${ESC}[0m` : text)
export const ok = (text) => console.log(`${paint('32', '✓')} ${text}`)
export const warn = (text) => console.log(`${paint('33', '!')} ${text}`)
export const fail = (text) => console.error(`${paint('31', '✗')} ${text}`)
export const info = (text) => console.log(`  ${text}`)
