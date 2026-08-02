// 小应用市场脚本共享库。
//
// 单一真值：目录布局、体积/路径限制、semver 比较、文件遍历、sha256、bundle 组装。
// validate / release / build-registry / new-app 都从这里取，避免规则漂移。

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

// 离线运行时可用的裸模块白名单，与 Swift 侧 AppletImportRules 保持一致。
export const BARE_IMPORT_ALLOWLIST = new Set([
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'antd-mobile',
  'chart.js',
  'chart.js/auto',
])

export const CATEGORIES = new Set([
  'information', 'productivity', 'tools', 'media', 'developer', 'lifestyle', 'game', 'other',
])

// 宿主已知的 aibox.* 扩展能力命名空间（manifest.permissions.capabilities 的取值域）。
// 真值是 Swift 侧 `AppletCapabilityCatalog.declarableExtensionNamespaces`（有序数组，同时决定
// AI 工具 schema 的 enum）。这里必须与它逐字一致——多了会放过装不上的包，少了会误拒合法包。
// 注意 `tts` 不叫 `speech`；`browser` 是 2026-08 新增（浏览器桥）。
export const KNOWN_CAPABILITIES = new Set([
  'browser', 'calendar', 'clipboard', 'contacts', 'device', 'files', 'haptics', 'health',
  'location', 'media', 'music', 'notifications', 'open', 'photos', 'picker', 'reminders',
  'share', 'shortcuts', 'toast', 'tools', 'tts', 'ui', 'voiceMemos',
])

// 容器协议自身的命名空间：恒可用，**不需要**也不应该写进 permissions.capabilities。
// 写进去不算错（宿主忽略），但会让用户以为这个应用要了更多权限，所以 validate 给一条提醒。
export const CONTAINER_NAMESPACES = new Set([
  'access', 'action', 'apps', 'chat', 'db', 'jobs', 'lifecycle', 'menu', 'navigation',
  'resource', 'scene', 'tabs', 'toolbar',
])

// 二进制扩展名 → base64；其余按 utf8 存。
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.icns', '.pdf',
  '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.mp4', '.wav', '.m4a', '.zip',
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

/** 读单个源文件 → bundle 文件条目（含 content）。 */
export function readBundleFile(srcDir, relative) {
  const bytes = fs.readFileSync(path.join(srcDir, relative))
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
  return fs.readdirSync(APPS_DIR, { withFileTypes: true })
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
    manifest: path.join(dir, 'src', 'manifest.json'),
    releasesJSON: path.join(dir, 'releases.json'),
    releasesDir: path.join(dir, 'releases'),
    releaseDir: (version) => path.join(dir, 'releases', version),
    relative: `apps/${appId}`,
  }
}

export function listReleaseVersions(appId) {
  const { releasesDir } = appPaths(appId)
  if (!fs.existsSync(releasesDir)) return []
  return fs.readdirSync(releasesDir, { withFileTypes: true })
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
