#!/usr/bin/env node
// 扫描 apps/ 重建 registry.json（市场索引）与每个应用的 releases.json（版本索引）。
// 幂等：不读旧索引，只从磁盘真值重算，所以手改索引会被覆盖回正确值。
//
//   node scripts/build-registry.mjs

import fs from 'node:fs'
import path from 'node:path'
import {
  REGISTRY_PATH,
  SCHEMA_VERSION,
  appPaths,
  fail,
  info,
  listAppIDs,
  listReleaseVersions,
  ok,
  readJSON,
  sha256,
  writeJSON,
} from './lib/market.mjs'

const MARKET_NAME = 'AiBox 官方小应用市场'

/** 从磁盘的 releases/<v>/release.json 重建单应用版本索引，返回最新版本条目。 */
function buildReleasesIndex(appId) {
  const paths = appPaths(appId)
  const versions = listReleaseVersions(appId)
  const releases = []
  for (const version of versions) {
    const releaseFile = path.join(paths.releaseDir(version), 'release.json')
    const bundleFile = path.join(paths.releaseDir(version), 'bundle.json')
    if (!fs.existsSync(releaseFile)) continue
    const release = readJSON(releaseFile)
    const entry = {
      version,
      releasedAt: release.releasedAt,
      notes: release.notes ?? '',
      fileCount: (release.files ?? []).length,
      totalBytes: release.totalBytes ?? 0,
      path: `${paths.relative}/releases/${version}`,
    }
    if (release.localizedNotes) entry.localizedNotes = release.localizedNotes
    if (release.minHostVersion) entry.minHostVersion = release.minHostVersion
    // 撤回标记住在 release.json 里（`release.mjs yank` 写的），索引只是把它透出去。
    // **字节永远留在仓库里**：已装用户的完整性校验与诊断复现都依赖它，删目录会让
    // 「用户装的到底是哪一版」变成不可回答的问题。撤回不是删除。
    if (release.yanked) {
      entry.yanked = true
      if (release.yankedReason) entry.yankedReason = release.yankedReason
    }
    if (fs.existsSync(bundleFile)) {
      entry.bundleSha256 = sha256(fs.readFileSync(bundleFile))
    }
    releases.push(entry)
  }
  if (releases.length === 0) return null

  // latest 跳过已撤回的版本——撤回的意思就是「不要再让新用户装到它」。
  // 全部都被撤回时回落到最新那一条：没有 latestVersion 的应用在客户端是一张点不动的卡片，
  // 比诚实地显示一个「已撤回」的版本更糟。
  const latest = releases.find((r) => !r.yanked) ?? releases[0]
  writeJSON(paths.releasesJSON, {
    schemaVersion: SCHEMA_VERSION,
    appId,
    latestVersion: latest.version,
    releases,
  })
  return latest
}

function buildRegistryEntry(appId) {
  const paths = appPaths(appId)
  if (!fs.existsSync(paths.appJSON)) return null
  const meta = readJSON(paths.appJSON)
  const latest = buildReleasesIndex(appId)
  if (!latest) {
    info(`${appId} 还没有已发布版本，跳过索引`)
    return null
  }
  const manifest = fs.existsSync(paths.manifest) ? readJSON(paths.manifest) : {}
  const permissions = manifest.permissions ?? {}
  const capabilities = [
    ...new Set([
      ...(permissions.network ? ['net'] : []),
      ...(permissions.storage ? ['storage'] : []),
      ...(permissions.ai ? ['ai'] : []),
      ...(permissions.capabilities ?? []),
      // 外壳能力：manifest 里的**静态声明门**是 `scene.tabBar` / `scene.toolbar`
      // （app-shell-and-market.md §1.1 / §2.1，Swift 侧 `AppletSceneDeclaration` 的 CodingKeys 同名）。
      // `aibox.tabs` 只是运行时 API 的命名空间，manifest 里没有这个键——曾经写成 `scene.tabs`，
      // 结果是「声明了底部 Tab 的应用在市场列表里看不出来」。
      ...(manifest.scene?.tabBar ? ['tabs'] : []),
      ...(manifest.scene?.toolbar ? ['toolbar'] : []),
    ]),
  ].sort()

  const entry = {
    appId,
    name: meta.name,
    summary: meta.summary ?? '',
    icon: meta.icon ?? manifest.icon ?? 'puzzlepiece.extension.fill',
    category: meta.category ?? 'other',
    author: meta.author ?? 'AiBox',
    latestVersion: latest.version,
    latestReleasedAt: latest.releasedAt,
    versionCount: listReleaseVersions(appId).length,
    capabilities,
    // 协议 v1.1：装之前用户就该知道**要下多少**、**几个文件**、**跑起来要不要在设备上转译**。
    // 这三条以前只能点进详情再拉一次 releases.json 才拿得到，于是列表阶段完全看不见体积。
    latestTotalBytes: latest.totalBytes ?? 0,
    latestFileCount: latest.fileCount ?? 0,
    // **宿主的 `effectiveRuntimeKind`，不是本地打包判据**。
    // 本地按「有没有 package.json」决定怎么打包；宿主按 manifest 的声明决定要不要转译。
    // 这里要回答的是后者——未声明时宿主一律按 `source` 处理（会加载 296KB 转译器），
    // 所以回落成 `source` 是如实转述宿主行为，不是猜测。
    runtimeKind: manifest.runtimeKind ?? 'source',
    path: paths.relative,
  }
  if (meta.localizedNames) entry.localizedNames = meta.localizedNames
  if (meta.localizedSummaries) entry.localizedSummaries = meta.localizedSummaries
  if (meta.iconTintHex ?? manifest.iconTintHex) entry.iconTintHex = meta.iconTintHex ?? manifest.iconTintHex
  if (meta.tags?.length) entry.tags = meta.tags
  // ⚠️ **只取 latest（= 冻结在包里的那一份）**，不回落 `app.json`。
  // 安装门用的是 `bundle.minHostVersion`；`app.json` 后来加的要求旧包里并不存在，
  // 回落会让 registry 展示一个包里没有的要求，列表提示与实际安装判定就此不一致。
  if (latest.minHostVersion) {
    entry.minHostVersion = latest.minHostVersion
  }
  if (meta.homepage) entry.homepage = meta.homepage
  return entry
}

export function rebuild({ quiet = false } = {}) {
  const appIds = listAppIDs()
  const apps = []
  for (const appId of appIds) {
    const entry = buildRegistryEntry(appId)
    if (entry) apps.push(entry)
  }
  apps.sort((a, b) => a.appId.localeCompare(b.appId))

  // updatedAt 取所有版本发布时间的最大值，而不是「跑脚本的此刻」——否则每次重建都产生 Git 噪声 diff。
  const updatedAt = apps.reduce(
    (latest, app) => (app.latestReleasedAt > latest ? app.latestReleasedAt : latest),
    '1970-01-01T00:00:00Z',
  )
  writeJSON(REGISTRY_PATH, {
    schemaVersion: SCHEMA_VERSION,
    name: MARKET_NAME,
    updatedAt,
    appCount: apps.length,
    apps,
  })
  if (!quiet) {
    ok(`registry.json 已重建：${apps.length} 个应用`)
    for (const app of apps) info(`${app.appId} — ${app.latestVersion}（${app.versionCount} 个版本）`)
  }
  return apps
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    rebuild()
  } catch (error) {
    fail(String(error.stack ?? error))
    process.exit(1)
  }
}
