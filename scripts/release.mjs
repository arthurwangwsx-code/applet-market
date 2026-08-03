#!/usr/bin/env node
// 把 apps/<appId>/src/ 的当前内容冻结成一个不可变版本，并刷新索引。
//
//   node scripts/release.mjs com.aibox.news 1.0.0 --notes "首个版本"
//   node scripts/release.mjs com.aibox.news 1.0.1 --notes "修复分类计数" --min-host 1.1.0
//   node scripts/release.mjs com.aibox.news 1.0.1 --force        # 覆盖已存在的同版本
//   node scripts/release.mjs yank com.aibox.news 1.0.1 --reason "崩溃"   # 撤回一个已发布版本
//   node scripts/release.mjs unyank com.aibox.news 1.0.1                 # 撤销撤回
//
// 发布前会先跑 validate.mjs；不绿就不发。

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {
  LIMITS, ROOT, SCHEMA_VERSION, appPaths, collectBundleEntries, compareSemver, fail, info,
  isBuiltApp, listAppIDs, listReleaseVersions, ok, parseSemver, readBundleFile, readJSON,
  relativePathError, stripContent, warn, writeJSON,
} from './lib/market.mjs'
import { rebuild } from './build-registry.mjs'

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--force') flags.force = true
    else if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--dry-run-latest') flags.dryRunLatest = true
    else if (arg === '--notes') flags.notes = argv[++i]
    else if (arg === '--notes-en') flags.notesEN = argv[++i]
    else if (arg === '--min-host') flags.minHost = argv[++i]
    else if (arg === '--reason') flags.reason = argv[++i]
    else if (arg.startsWith('-')) throw new Error(`未知参数 ${arg}`)
    else positional.push(arg)
  }
  return { positional, flags }
}

/**
 * CI 冒烟：把**每个**应用按「构建 → 校验 → 组包」跑一遍，但一个字节都不写盘。
 *
 * 为什么需要它：validate 与 build-registry 验的都是**产物**，没有任何一条会执行本脚本。
 * 于是「发布脚本坏了但最近没人发版」可以一路绿着躺在 main 上——2026-08-03 真实发生过一次
 * （切换打包路径时漏改一处 `listSourceFiles` 调用；无参运行因为参数校验先抛，看起来完全正常）。
 * 这条把「生产产物的工具」本身也纳入闸门。
 */
function dryRunLatest() {
  const appIds = listAppIDs()
  if (appIds.length === 0) { warn('apps/ 下没有应用，冒烟跳过'); return }
  for (const appId of appIds) {
    const paths = appPaths(appId)
    if (!fs.existsSync(paths.appJSON)) continue
    const built = isBuiltApp(appId)
    if (built) runBuild(appId)
    const entries = collectBundleEntries(appId)
    let totalBytes = 0
    for (const { absDir, relative } of entries) {
      const pathError = relativePathError(relative)
      if (pathError) throw new Error(`${appId}: ${pathError}`)
      const file = readBundleFile(absDir, relative)
      if (file.bytes > LIMITS.maxFileBytes) {
        throw new Error(`${appId}: ${relative} 超过单文件上限 ${LIMITS.maxFileBytes} 字节`)
      }
      totalBytes += file.bytes
    }
    if (totalBytes > LIMITS.maxVersionBytes) {
      throw new Error(`${appId}: 总计 ${totalBytes} 字节超过单版本上限 ${LIMITS.maxVersionBytes}`)
    }
    readJSON(paths.manifest)
    ok(`${appId} 组包冒烟通过（${built ? '构建型' : '源码型'}，${entries.length} 个文件，${(totalBytes / 1024).toFixed(1)} KB）`)
  }
  ok(`发布脚本冒烟通过：${appIds.length} 个应用`)
}

/**
 * 构建型工程：发布前**先构建**。
 *
 * 顺序很重要——构建必须在 validate **之前**：validate 校验的是 `dist/`，先验后构等于验的是上一次的产物。
 * 这条顺序就是「发出去的东西 = 刚构建出来的东西」的全部保证。
 *
 * `npm run typecheck`（若声明了）也在这里跑：**类型不过就不发**。TS 工程的价值全在这一步，
 * 跳过它等于把 TS 当成带类型注释的 JS。
 */
function runBuild(appId) {
  const paths = appPaths(appId)
  const pkg = readJSON(paths.packageJSON)
  const scripts = pkg.scripts ?? {}
  if (!scripts.build) {
    throw new Error(`${paths.relative}/package.json 没有 build 脚本 —— 构建型工程必须能被机械地构建出来`)
  }
  const run = (script) => {
    info(`npm run ${script}（${paths.relative}）`)
    try {
      execFileSync('npm', ['run', script], { cwd: paths.dir, stdio: 'inherit' })
    } catch {
      throw new Error(`npm run ${script} 失败，已中止发布`)
    }
  }
  if (scripts.typecheck) run('typecheck')
  run('build')
}

function runValidate(appId) {
  try {
    const output = execFileSync(process.execPath, [path.join(ROOT, 'scripts/validate.mjs'), appId], {
      cwd: ROOT, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
    })
    // 没有已发布版本的首发场景会有一条提醒，属预期。
    process.stdout.write(output)
  } catch (error) {
    process.stdout.write(error.stdout ?? '')
    process.stderr.write(error.stderr ?? '')
    throw new Error('validate 未通过，已中止发布')
  }
}


/**
 * 撤回 / 撤销撤回一个已发布版本。
 *
 * ## 为什么是 yank 而不是删目录（协议 §7，裁定 D4）
 *
 * 删目录是**改写历史**：已经装了那一版的用户，客户端会认为市场「降级」了，而「用户装的到底是
 * 哪一版」变成不可回答的问题——诊断复现、完整性校验全部依赖那些字节还在。
 * 所以照抄 npm deprecate / crates.io yank 的成熟做法：**标记，不删除**。
 *
 * 语义（宿主侧由 `AppletMarketRelease.yanked` 消费）：
 *  · `build-registry.mjs` 算 `latestVersion` 时跳过它 → 新用户不会再装到；
 *  · 自动更新不会以它为目标；
 *  · 详情页版本历史里显示为「已撤回」，仍可手动安装（这是降级路径，要额外确认）。
 *
 * ⚠️ 撤回**不会**让已经装了它的用户自动退回。用户侧的出口是应用详情页的「回到上一版」
 *   （宿主 `AppletManifest.marketPreviousVersion`）。撤回只保证「不再扩散」。
 */
function yank(appId, version, { yanked, reason }) {
  if (!appId || !version) {
    throw new Error('用法：node scripts/release.mjs yank <appId> <version> [--reason "…"]')
  }
  const paths = appPaths(appId)
  const dir = paths.releaseDir(version)
  const releaseFile = path.join(dir, 'release.json')
  const bundleFile = path.join(dir, 'bundle.json')
  if (!fs.existsSync(releaseFile)) {
    throw new Error(`${appId} 没有已发布的 ${version}（找不到 ${releaseFile}）`)
  }
  const published = listReleaseVersions(appId)
  if (yanked && published.length === 1) {
    warn(`${appId} 只有这一个版本；撤回后市场里它会变成一个装不到最新版的应用`)
  }
  // 两个文件都要改：`build-registry.mjs` 读 release.json 建索引，而 bundle.json 是宿主真正下载的
  // 那一份——只改一个会让「索引说撤回了、包里没说」，正是 bundleSha256 要防的那种分叉。
  for (const file of [releaseFile, bundleFile]) {
    if (!fs.existsSync(file)) continue
    const value = readJSON(file)
    if (yanked) {
      value.yanked = true
      if (reason) value.yankedReason = reason
      else delete value.yankedReason
    } else {
      delete value.yanked
      delete value.yankedReason
    }
    writeJSON(file, value)
  }
  ok(`${yanked ? '已撤回' : '已撤销撤回'} ${appId} ${version}`)
  if (yanked && reason) info(`理由：${reason}`)
  rebuild({ quiet: true })
  ok('registry.json / releases.json 已刷新')
  info(`已装用户不会自动退回——他们的出口是应用详情页的「回到上一版」`)
  info(`提交：git add -A && git commit -m "${yanked ? 'yank' : 'unyank'}(${appId}): ${version}"`)
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  if (flags.dryRunLatest) return dryRunLatest()
  if (positional[0] === 'yank' || positional[0] === 'unyank') {
    return yank(positional[1], positional[2],
                { yanked: positional[0] === 'yank', reason: flags.reason })
  }
  const [appId, version] = positional
  if (!appId || !version) {
    throw new Error('用法：node scripts/release.mjs <appId> <version> [--notes "…"] [--min-host x.y.z] [--force]\n'
      + '      撤回：node scripts/release.mjs yank <appId> <version> [--reason "…"]')
  }
  if (!parseSemver(version)) throw new Error(`版本号必须是 semver：${version}`)

  const paths = appPaths(appId)
  if (!fs.existsSync(paths.appJSON)) throw new Error(`找不到 ${paths.relative}/app.json`)
  const meta = readJSON(paths.appJSON)

  const existing = listReleaseVersions(appId)
  if (existing.includes(version) && !flags.force) {
    throw new Error(`版本 ${version} 已发布。已发布版本不可变——发新版本，或确实要重来时加 --force`)
  }
  if (existing.length > 0 && !flags.force && compareSemver(version, existing[0]) <= 0) {
    throw new Error(`版本 ${version} 不高于当前最新 ${existing[0]}`)
  }

  // 构建 → 校验 → 组包。构建必须在校验前：validate 校验的是 dist/，先验后构等于验上一次的产物。
  const built = isBuiltApp(appId)
  if (built) runBuild(appId)
  runValidate(appId)

  // —— 组包 ——
  // 构建型进 `dist/**`（平铺到包根）+ `src/manifest.json`；源码型进 `src/**`。见 collectBundleEntries。
  const entries = collectBundleEntries(appId)
  if (entries.length === 0) throw new Error(`${built ? 'dist/' : 'src/'} 为空，没有可发布的内容`)
  const files = []
  let totalBytes = 0
  for (const { absDir, relative } of entries) {
    const pathError = relativePathError(relative)
    if (pathError) throw new Error(pathError)
    const file = readBundleFile(absDir, relative)
    if (file.bytes > LIMITS.maxFileBytes) {
      throw new Error(`${relative} 超过单文件上限 ${LIMITS.maxFileBytes} 字节`)
    }
    totalBytes += file.bytes
    files.push(file)
  }
  if (totalBytes > LIMITS.maxVersionBytes) {
    throw new Error(`总计 ${totalBytes} 字节超过单版本上限 ${LIMITS.maxVersionBytes}`)
  }

  const manifest = readJSON(paths.manifest)
  // 市场包里的 id 无意义（宿主安装时分配本机 UUID），冻结时统一剥掉，避免误导。
  delete manifest.id

  const releasedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const minHostVersion = flags.minHost ?? meta.minHostVersion
  if (minHostVersion && !parseSemver(minHostVersion)) {
    throw new Error(`--min-host 必须是 semver：${minHostVersion}`)
  }

  const head = {
    schemaVersion: SCHEMA_VERSION,
    appId,
    version,
    releasedAt,
    notes: flags.notes ?? '',
    ...(flags.notesEN ? { localizedNotes: { en: flags.notesEN } } : {}),
    ...(minHostVersion ? { minHostVersion } : {}),
    manifest,
    totalBytes,
  }

  if (flags.dryRun) {
    ok(`${appId} ${version} 组包冒烟通过（--dry-run，未写盘）`)
    info(`${built ? '构建型' : '源码型'} · ${files.length} 个文件，${(totalBytes / 1024).toFixed(1)} KB`)
    return
  }

  const dir = paths.releaseDir(version)
  fs.mkdirSync(dir, { recursive: true })
  writeJSON(path.join(dir, 'release.json'), { ...head, files: files.map(stripContent) })
  writeJSON(path.join(dir, 'bundle.json'), { ...head, files })

  ok(`已发布 ${appId} ${version}`)
  info(`${built ? '构建型（dist/ + src/manifest.json）' : '源码型（src/）'} · ${files.length} 个文件，${(totalBytes / 1024).toFixed(1)} KB`)
  if (flags.force && existing.includes(version)) warn(`--force 覆盖了已存在的 ${version}`)

  rebuild({ quiet: true })
  ok('registry.json / releases.json 已刷新')
  info(`提交：git add -A && git commit -m "release(${appId}): ${version}"`)
}

try {
  main()
} catch (error) {
  fail(String(error.message ?? error))
  process.exit(1)
}
