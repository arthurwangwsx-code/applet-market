#!/usr/bin/env node
// 提交前硬闸门：校验 apps/ 下每个应用的元数据、源码、已发布版本完整性。
//
//   node scripts/validate.mjs              # 全量
//   node scripts/validate.mjs com.aibox.news
//
// 退出码 0 = 全绿；1 = 有 error（warn 不阻断）。

import fs from 'node:fs'
import path from 'node:path'
import {
  APPS_DIR, BARE_IMPORT_ALLOWLIST, CATEGORIES, CONTAINER_NAMESPACES, KNOWN_CAPABILITIES, LIMITS,
  ROOT, appPaths, encodingFor, fail, info, isValidAppID, listAppIDs, listReleaseVersions,
  listSourceFiles, ok, parseSemver, readJSON, relativePathError, sha256, warn,
} from './lib/market.mjs'
import { checkManifestKeys, defaultHostSourceDir, loadHostSchema } from './lib/manifest-keys.mjs'

const errors = []
const warnings = []
const err = (appId, message) => errors.push(`${appId}: ${message}`)
const wrn = (appId, message) => warnings.push(`${appId}: ${message}`)

/** 宿主键表：main() 里加载一次；null = 宿主源码不在场（单独 clone 市场仓库），跳过该闸门。 */
let hostSchema = null

// 匹配 import / export ... from '<spec>' 与 import('<spec>')。
const IMPORT_RE = /(?:^|[\s;}])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm

function checkImports(appId, relative, source) {
  IMPORT_RE.lastIndex = 0
  let match
  while ((match = IMPORT_RE.exec(source)) !== null) {
    const spec = match[1] || match[2] || match[3]
    if (!spec) continue
    // 相对路径与 applet:// 绝对 URL 由运行时解析，不在白名单管辖内。
    if (spec.startsWith('.') || spec.startsWith('/') || spec.includes('://')) continue
    if (!BARE_IMPORT_ALLOWLIST.has(spec)) {
      err(appId, `${relative} 引用了非离线白名单模块 '${spec}'（可用：${[...BARE_IMPORT_ALLOWLIST].join(', ')}）`)
    }
  }
}

function validateManifest(appId, manifest, meta) {
  if (!manifest || typeof manifest !== 'object') return err(appId, 'src/manifest.json 不是对象')
  for (const key of ['name', 'icon', 'template', 'entry']) {
    if (!manifest[key]) err(appId, `manifest 缺少必填字段 ${key}`)
  }
  if (manifest.id) {
    wrn(appId, 'manifest 里的 id 会被宿主安装时替换成本机 UUID，市场包不该写死它')
  }
  if (manifest.name !== meta.name) {
    wrn(appId, `manifest.name(${manifest.name}) 与 app.json name(${meta.name}) 不一致，列表与详情会显示不同名字`)
  }
  const security = manifest.securityMode
  if (security && !['secure', 'developer'].includes(security)) {
    err(appId, `manifest.securityMode 非法：${security}`)
  }
  if (security === 'developer') {
    wrn(appId, 'manifest.securityMode=developer 会放开页面外联；市场包应保持 secure')
  }
  const permissions = manifest.permissions ?? {}
  for (const capability of permissions.capabilities ?? []) {
    if (CONTAINER_NAMESPACES.has(capability)) {
      wrn(appId, `'${capability}' 是容器内建能力，恒可用、无需声明；写在这里只会让用户以为要了更多权限`)
    } else if (!KNOWN_CAPABILITIES.has(capability)) {
      err(appId, `manifest.permissions.capabilities 含未知能力 '${capability}'（可选：${[...KNOWN_CAPABILITIES].join(', ')}）`)
    }
  }
  if (permissions.network && (permissions.networkAllowed ?? []).length === 0) {
    err(appId, 'manifest 声明了 network 但 networkAllowed 为空——网络会被全部拒绝')
  }
  if ((permissions.networkAllowed ?? []).includes('*')) {
    err(appId, "manifest.networkAllowed 含 '*'——市场包不允许任意 host，请精确列域名")
  }

  // 键名闸门：宿主用合成 Codable 读 manifest，不认识的键**静默忽略**——写错一个键不会报错，
  // 只是那条声明从未生效。最容易踩的是照抄 `applet_manage` 工具 schema 的 snake_case
  //（`timeout_ms` / `max_retries` / `requires_network`…），而 manifest 侧要的是 camelCase。
  if (hostSchema) {
    const { errors: keyErrors, warnings: keyWarnings } = checkManifestKeys(manifest, hostSchema)
    for (const message of keyErrors) err(appId, message)
    for (const message of keyWarnings) wrn(appId, message)
  }
}

function validateAppJSON(appId, meta) {
  if (meta.appId !== appId) err(appId, `app.json 的 appId(${meta.appId}) 与目录名不一致`)
  if (!meta.name) err(appId, 'app.json 缺少 name')
  if (!meta.summary) wrn(appId, 'app.json 缺少 summary，市场列表会空一行')
  if (meta.category && !CATEGORIES.has(meta.category)) {
    err(appId, `app.json category 非法：${meta.category}（可选：${[...CATEGORIES].join(', ')}）`)
  }
  if (meta.minHostVersion && !parseSemver(meta.minHostVersion)) {
    err(appId, `app.json minHostVersion 不是 semver：${meta.minHostVersion}`)
  }
}

function validateSource(appId, srcDir) {
  let files
  try {
    files = listSourceFiles(srcDir)
  } catch (error) {
    return err(appId, String(error.message ?? error))
  }
  if (files.length === 0) return err(appId, 'src/ 为空')
  if (files.length > LIMITS.maxFileCount) {
    err(appId, `文件数 ${files.length} 超过上限 ${LIMITS.maxFileCount}`)
  }
  if (!files.includes('manifest.json')) err(appId, 'src/ 缺少 manifest.json')

  let total = 0
  for (const relative of files) {
    const pathError = relativePathError(relative)
    if (pathError) { err(appId, pathError); continue }
    const bytes = fs.statSync(path.join(srcDir, relative)).size
    total += bytes
    if (bytes > LIMITS.maxFileBytes) {
      err(appId, `${relative} ${bytes} 字节超过单文件上限 ${LIMITS.maxFileBytes}`)
    }
    if (encodingFor(relative) === 'utf8' && /\.(jsx?|tsx?|mjs)$/.test(relative)) {
      checkImports(appId, relative, fs.readFileSync(path.join(srcDir, relative), 'utf8'))
    }
  }
  if (total > LIMITS.maxVersionBytes) {
    err(appId, `src 总计 ${total} 字节超过单版本上限 ${LIMITS.maxVersionBytes}`)
  }
  return files
}

/** 已发布版本是不可变的：复核 bundle 内容与 release.json 清单的 sha256 是否仍然自洽。 */
function validateReleases(appId) {
  const paths = appPaths(appId)
  const versions = listReleaseVersions(appId)
  if (versions.length === 0) {
    wrn(appId, '还没有任何已发布版本（node scripts/release.mjs 发一个）')
    return
  }
  for (const version of versions) {
    const dir = paths.releaseDir(version)
    const releaseFile = path.join(dir, 'release.json')
    const bundleFile = path.join(dir, 'bundle.json')
    if (!fs.existsSync(releaseFile)) { err(appId, `${version} 缺少 release.json`); continue }
    if (!fs.existsSync(bundleFile)) { err(appId, `${version} 缺少 bundle.json`); continue }

    const release = readJSON(releaseFile)
    const bundle = readJSON(bundleFile)
    if (release.version !== version) err(appId, `${version}/release.json 的 version 字段是 ${release.version}`)
    if (bundle.version !== version) err(appId, `${version}/bundle.json 的 version 字段是 ${bundle.version}`)

    const manifestPaths = new Set((release.files ?? []).map((file) => file.path))
    for (const file of bundle.files ?? []) {
      if (!manifestPaths.has(file.path)) {
        err(appId, `${version} bundle 含 release.json 未登记的文件 ${file.path}`)
        continue
      }
      const raw = file.encoding === 'base64'
        ? Buffer.from(file.content ?? '', 'base64')
        : Buffer.from(file.content ?? '', 'utf8')
      const digest = sha256(raw)
      if (digest !== file.sha256) {
        err(appId, `${version} ${file.path} 内容与 sha256 不符（包被手改过？）`)
      }
      const declared = (release.files ?? []).find((entry) => entry.path === file.path)
      if (declared && declared.sha256 !== file.sha256) {
        err(appId, `${version} ${file.path} 在 release.json 与 bundle.json 里的 sha256 不一致`)
      }
    }
    if ((bundle.files ?? []).length !== manifestPaths.size) {
      err(appId, `${version} bundle 文件数(${(bundle.files ?? []).length}) 与 release.json(${manifestPaths.size}) 不一致`)
    }
  }

  if (fs.existsSync(paths.releasesJSON)) {
    const index = readJSON(paths.releasesJSON)
    const indexed = new Set((index.releases ?? []).map((entry) => entry.version))
    for (const version of versions) {
      if (!indexed.has(version)) err(appId, `releases.json 漏登记版本 ${version}（重跑 build-registry.mjs）`)
    }
    if (index.latestVersion !== versions[0]) {
      err(appId, `releases.json latestVersion=${index.latestVersion}，实际最新是 ${versions[0]}`)
    }
  } else {
    err(appId, '缺少 releases.json（重跑 build-registry.mjs）')
  }
}

function validateApp(appId) {
  if (!isValidAppID(appId)) {
    return err(appId, 'appId 必须是小写反向域名，例如 com.aibox.news')
  }
  const paths = appPaths(appId)
  if (!fs.existsSync(paths.appJSON)) return err(appId, '缺少 app.json')
  if (!fs.existsSync(paths.srcDir)) return err(appId, '缺少 src/ 目录')

  const meta = readJSON(paths.appJSON)
  validateAppJSON(appId, meta)
  validateSource(appId, paths.srcDir)
  if (fs.existsSync(paths.manifest)) {
    validateManifest(appId, readJSON(paths.manifest), meta)
  }
  validateReleases(appId)
}

function main() {
  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))
  const appIds = requested.length > 0 ? requested : listAppIDs()
  if (!fs.existsSync(APPS_DIR) || appIds.length === 0) {
    warn('apps/ 下没有任何应用')
    return 0
  }

  // 键表从宿主 Swift 源码机械提取，宿主加字段这里自动跟随。找不到宿主源码时**跳过而不是 fail**——
  // 单独 clone 市场仓库的人不该因为没有 AiBox 工程就跑不了校验（用 AIBOX_HOST_SOURCE 可显式指定）。
  const hostDir = defaultHostSourceDir(ROOT)
  hostSchema = loadHostSchema(hostDir)
  if (!hostSchema) {
    warn(`未找到宿主源码（${hostDir}），跳过 manifest 键名闸门；设 AIBOX_HOST_SOURCE 可指定路径`)
  }

  for (const appId of appIds) validateApp(appId)

  for (const message of warnings) warn(message)
  if (errors.length > 0) {
    for (const message of errors) fail(message)
    fail(`${errors.length} 个错误，${appIds.length} 个应用`)
    return 1
  }
  ok(`校验通过：${appIds.length} 个应用${warnings.length > 0 ? `（${warnings.length} 条提醒）` : ''}`)
  for (const appId of appIds) {
    const versions = listReleaseVersions(appId)
    info(`${appId} — ${versions.length} 个版本${versions.length > 0 ? `，最新 ${versions[0]}` : ''}`)
  }
  return 0
}

process.exit(main())
