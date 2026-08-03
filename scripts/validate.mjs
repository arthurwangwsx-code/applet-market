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
  ROOT, appPaths, collectBundleEntries, encodingFor, fail, info, isBuiltApp, isValidAppID,
  listAppIDs, listReleaseVersions, ok, parseSemver, readJSON, relativePathError, sha256, warn,
} from './lib/market.mjs'
import { RUNTIME_MODULE_URLS } from '../packages/aibox-vite/lib/runtime-modules.mjs'
import { checkManifestKeys, defaultHostSourceDir, loadHostSchema } from './lib/manifest-keys.mjs'

const errors = []
const warnings = []
const err = (appId, message) => errors.push(`${appId}: ${message}`)
const wrn = (appId, message) => warnings.push(`${appId}: ${message}`)

/** 宿主键表：main() 里加载一次；null = 宿主源码不在场（单独 clone 市场仓库），跳过该闸门。 */
let hostSchema = null

// 匹配 import / export ... from '<spec>' 与 import('<spec>')。
const IMPORT_RE = /(?:^|[\s;}])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm

/** 抽出一段代码里的全部**裸** import 说明符（相对路径与绝对 URL 由运行时解析，不归白名单管）。 */
function bareSpecifiers(source) {
  IMPORT_RE.lastIndex = 0
  const out = new Set()
  let match
  while ((match = IMPORT_RE.exec(source)) !== null) {
    const spec = match[1] || match[2] || match[3]
    if (!spec) continue
    if (spec.startsWith('.') || spec.startsWith('/') || spec.includes('://')) continue
    out.add(spec)
  }
  return out
}

function checkImports(appId, relative, source) {
  for (const spec of bareSpecifiers(source)) {
    if (!BARE_IMPORT_ALLOWLIST.has(spec)) {
      err(appId, `${relative} 引用了非离线白名单模块 '${spec}'（可用：${[...BARE_IMPORT_ALLOWLIST].join(', ')}）`)
    }
  }
}

// 构建型工程里，源码可以 import 任意 npm 包（打包器会把它们打进产物），**只有产物受白名单约束**。
// 这些前缀在源码里出现是正常的，出现在 dist 里才是错。
const BUNDLED_DEPENDENCY_PREFIXES = ['@aibox/']

/**
 * 构建产物的 import 断言 —— **「external 配置有没有生效」的自动化判据**。
 *
 * 正向而不是过滤式：dist 里的裸 import 必须**恰好落在 external 集合内**，且
 * 构建期依赖（`@aibox/applet-sdk` 等）**必须不在其中**。
 *  · 多了一个不在 external 里的模块 → 运行时 import map 解析不到 → 白屏
 *  · `@aibox/applet-sdk` 还在里面   → 说明它被误当成 external，没打进产物 → 同样白屏
 * 后一条最要紧：它是「忘了把 SDK 打进去」这个错误唯一的自动化捕捉点，人眼看产物头部很容易漏。
 */
function checkBuiltImports(appId, relative, source) {
  for (const spec of bareSpecifiers(source)) {
    const bundled = BUNDLED_DEPENDENCY_PREFIXES.find((prefix) => spec.startsWith(prefix))
    if (bundled) {
      err(appId, `dist/${relative} 里仍有 '${spec}' 的裸 import —— 它是**构建期依赖**，必须被打进产物。`
        + '检查 vite 配置有没有误把它列进 external（宿主 import map 里没有它，运行时会 404 白屏）。')
      continue
    }
    if (!BARE_IMPORT_ALLOWLIST.has(spec)) {
      err(appId, `dist/${relative} 引用了宿主解析不了的模块 '${spec}'。`
        + `构建产物里允许的裸 import 只有：${[...BARE_IMPORT_ALLOWLIST].join(', ')}。`
        + '别的依赖要么打进产物，要么自己实现。')
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

  // 键名 + 枚举值闸门（两张表都从宿主 Swift 源码机械提取，不手抄）：
  //  · 键名：宿主用合成 Codable 读 manifest，不认识的键**静默忽略**——写错一个键不会报错，
  //    只是那条声明从未生效。最容易踩的是照抄 `applet_manage` 工具 schema 的 snake_case
  //   （`timeout_ms` / `max_retries` / `requires_network`…），而 manifest 侧要的是 camelCase。
  //  · 枚举值：枚举是**硬解码**的，一个非法值让整份 manifest 解不出来 → **应用静默装不上**。
  //    `com.aibox.timer` 1.0.0 带着 `effect: "localWrite"`（桥的副作用档位，不是 manifest 词汇）
  //    发布过一次，而当时本文件对 `effect` 零命中，CI 如实反映「没人检查这一项」。
  if (hostSchema) {
    const { errors: keyErrors, warnings: keyWarnings } = checkManifestKeys(manifest, hostSchema)
    for (const message of keyErrors) err(appId, message)
    for (const message of keyWarnings) wrn(appId, message)
  }
}

/**
 * 源码型工程 `src/` 里的 npm 痕迹。**只 warn 不 fail** —— 真正会坏的那条（import 了非白名单裸模块）
 * 已经是 error 了；这里管的是「本地跑得通、装到机器上找不到模块」这条**局部真相**。
 *
 * 为什么源码型下它一定坏：`listSourceFiles` 的 IGNORED_ENTRIES 排除 `node_modules`，依赖**永远不进包**；
 * 运行时也不做 npm 解析，裸 import 由 import map + `AppletImportRules` 重写成 `applet://` 绝对 URL，
 * 只认离线白名单那几个。也就是说 `npm install` 装出来的东西在设备上一个字节都不存在。
 *
 * **构建型工程整条跳过**：那里 npm 依赖是被打包器**内联进 `dist/`** 的，「装不进包」的前提整个反过来，
 * 照搬这条提醒会把正确做法说成错误。构建型进包的是什么、允许 import 什么，由 `validateBundleFiles`
 * 按 `dist/` 判定（`node_modules` 也不在 `src/` 而在应用根）。
 */
function validateSourceLayout(appId, srcDir) {
  if (isBuiltApp(appId)) return
  const nested = []
  const walk = (dir, prefix) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch { return }
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.name === 'node_modules') { nested.push(relative); continue }  // 不下钻，只记位置
      if (entry.isDirectory() && !entry.name.startsWith('.')) walk(path.join(dir, entry.name), relative)
    }
  }
  walk(srcDir, '')
  for (const relative of nested) {
    wrn(appId, `src/${relative}/ 不会进包（发布时被跳过），设备上也没有 npm 解析——`
      + '装上去会是运行时找不到模块。依赖只能用离线白名单里的裸模块，或改写成相对路径引入自带源码')
  }
  const packageJSON = path.join(srcDir, 'package.json')
  if (fs.existsSync(packageJSON)) {
    let declared = []
    try {
      const parsed = readJSON(packageJSON)
      declared = [...Object.keys(parsed.dependencies ?? {}), ...Object.keys(parsed.devDependencies ?? {})]
    } catch { /* 坏 JSON 不是本闸门的事 */ }
    const outside = declared.filter((name) => !BARE_IMPORT_ALLOWLIST.has(name))
    wrn(appId, `src/package.json 会被原样打进包但不起任何作用（宿主不跑 npm install）`
      + (outside.length > 0
        ? `；其中 ${outside.join(', ')} 不在离线白名单里，一旦被 import 就会安装失败`
        : ''))
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

/**
 * 校验**实际进包的那份文件集**。
 *
 * 两种工程形态检查的对象不同，这是刻意的：
 *  · 源码型（无 package.json）：进包的就是 `src/**`，白名单直接管源码 —— 历史行为，逐字不变。
 *  · 构建型（有 package.json）：进包的是 `dist/**`。源码里 import `@aibox/applet-sdk` 之类的
 *    构建期依赖是**正确**的（打包器会把它们打进产物），只有产物里还留着才是错。
 *    所以白名单管 `dist/`，不管 `src/`。
 */
function validateBundleFiles(appId) {
  const built = isBuiltApp(appId)
  let entries
  try {
    entries = collectBundleEntries(appId)
  } catch (error) {
    return err(appId, String(error.message ?? error))
  }
  if (entries.length === 0) return err(appId, built ? 'dist/ 为空' : 'src/ 为空')
  if (entries.length > LIMITS.maxFileCount) {
    err(appId, `文件数 ${entries.length} 超过上限 ${LIMITS.maxFileCount}`)
  }
  const names = entries.map((entry) => entry.relative)
  if (!names.includes('manifest.json')) err(appId, '包内缺少 manifest.json')

  let total = 0
  for (const { absDir, relative } of entries) {
    const pathError = relativePathError(relative)
    if (pathError) { err(appId, pathError); continue }
    const file = path.join(absDir, relative)
    const bytes = fs.statSync(file).size
    total += bytes
    if (bytes > LIMITS.maxFileBytes) {
      err(appId, `${relative} ${bytes} 字节超过单文件上限 ${LIMITS.maxFileBytes}`)
    }
    if (encodingFor(relative) === 'utf8' && /\.(jsx?|tsx?|mjs)$/.test(relative)) {
      const source = fs.readFileSync(file, 'utf8')
      if (built) checkBuiltImports(appId, relative, source)
      else checkImports(appId, relative, source)
    }
  }
  if (total > LIMITS.maxVersionBytes) {
    err(appId, `包总计 ${total} 字节超过单版本上限 ${LIMITS.maxVersionBytes}`)
  }
  return names
}

/**
 * 构建型工程的形态检查 —— 这些错误在真机上一律表现为**白屏**，没有任何日志能指回原因，
 * 所以必须在发布前拦住。
 */
function validateBuiltShape(appId, manifest, names) {
  const paths = appPaths(appId)
  // ① 入口必须真的在包里。市场安装器**不会**替包补 index.html（只有 .aiboxapplet 导入路径会补），
  //    entry 指向一个不存在的文件 = 打开即 404 空白页。
  const entry = manifest?.entry ?? 'index.html'
  if (!names.includes(entry)) {
    err(appId, `manifest.entry="${entry}" 不在包里（包内有：${names.slice(0, 8).join(', ')}…）——`
      + '市场安装器按包内容原样落盘、不会替你补 index.html，entry 找不到就是打开白屏。')
  }
  // ② dist 必须是构建出来的，不能是手写残留。
  if (!fs.existsSync(paths.distDir)) {
    err(appId, '构建型工程缺少 dist/ —— 先跑 npm run build')
    return
  }
  // ③ dist 比 src 旧 = 忘了重新构建。这是最常见的「改了代码但发出去的是旧版本」。
  const newest = (dir) => {
    let latest = 0
    const walk = (current) => {
      for (const item of fs.readdirSync(current, { withFileTypes: true })) {
        if (item.name === 'node_modules' || item.name.startsWith('.')) continue
        const full = path.join(current, item.name)
        if (item.isDirectory()) walk(full)
        else latest = Math.max(latest, fs.statSync(full).mtimeMs)
      }
    }
    walk(dir)
    return latest
  }
  if (fs.existsSync(paths.srcDir) && newest(paths.srcDir) > newest(paths.distDir)) {
    wrn(appId, 'src/ 比 dist/ 新 —— 产物可能是旧的。发布前跑一次 npm run build（release.mjs 会自动跑）。')
  }
  // ④ runtimeKind 声明与工程形态一致。
  if (manifest && manifest.runtimeKind !== 'bundle') {
    err(appId, `构建型工程的 manifest 必须声明 "runtimeKind": "bundle"（当前 ${JSON.stringify(manifest.runtimeKind ?? null)}）——`
      + '否则宿主会按源码型处理，拿 Sucrase 去转译已经构建好的产物。')
  }
  if (manifest && manifest.template !== 'react') {
    err(appId, `构建型工程必须声明 "template": "react"（当前 ${JSON.stringify(manifest.template ?? null)}）——`
      + '宿主据此决定要不要准备 React/antd-mobile 运行时资产；声明成 vanilla 会让 import map 指向的 URL 全部 404。')
  }
  // ⑤ index.html 必须自带 import map（bundle 形态不经系统外壳，没有别处给它）。
  const indexPath = path.join(paths.distDir, 'index.html')
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8')
    if (!/<script[^>]+type=["']importmap["']/.test(html)) {
      err(appId, 'dist/index.html 里没有 import map —— 预构建产物的裸 import（react / antd-mobile …）没人解析，必然白屏。')
    }
    for (const [specifier, url] of Object.entries(RUNTIME_MODULE_URLS)) {
      if (html.includes(`"${specifier}"`) && !html.includes(url)) {
        err(appId, `dist/index.html 的 import map 里 "${specifier}" 没有指向 ${url}`)
      }
    }
    if (/\bsrc=["']\/(?!\/)/.test(html)) {
      err(appId, 'dist/index.html 里有绝对路径引用（src="/…"）——宿主伺服在 applet://localhost/<appId>/ 下，绝对路径会跨出应用目录。设 base: "./"。')
    }
    // bundle 形态用原生 module 脚本；出现 shim 标签说明这其实是源码型外壳被贴了 bundle 标签，
    // 于是产物会被白白喂一遍 Sucrase（实测 +9% 体积、语义不变，纯浪费）。
    // 按**标签**判而不是按字符串判：注释里提到 "es-module-shims" 这个名字是正常的。
    if (/<script[^>]+type=["'](?:module-shim|importmap-shim)["']/.test(html)
        || /<script[^>]+src=["'][^"']*es-module-shims/.test(html)) {
      err(appId, 'dist/index.html 用的是源码型外壳（module-shim / es-module-shims），与 runtimeKind=bundle 矛盾。'
        + '预构建产物应当用原生 <script type="module"> + 原生 importmap，一行都不该转译。')
    }
    if (!/<script[^>]+type=["']module["']/.test(html)) {
      err(appId, 'dist/index.html 里没有原生 module 脚本标签 —— 没有任何东西会加载构建产物。')
    }
  }
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
  const names = validateBundleFiles(appId) ?? []
  validateSourceLayout(appId, paths.srcDir)
  const manifest = fs.existsSync(paths.manifest) ? readJSON(paths.manifest) : null
  if (manifest) validateManifest(appId, manifest, meta)
  if (isBuiltApp(appId)) validateBuiltShape(appId, manifest, names)
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
