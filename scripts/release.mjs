#!/usr/bin/env node
// 把 apps/<appId>/src/ 的当前内容冻结成一个不可变版本，并刷新索引。
//
//   node scripts/release.mjs com.aibox.news 1.0.0 --notes "首个版本"
//   node scripts/release.mjs com.aibox.news 1.0.1 --notes "修复分类计数" --min-host 1.1.0
//   node scripts/release.mjs com.aibox.news 1.0.1 --force        # 覆盖已存在的同版本
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

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  if (flags.dryRunLatest) return dryRunLatest()
  const [appId, version] = positional
  if (!appId || !version) {
    throw new Error('用法：node scripts/release.mjs <appId> <version> [--notes "…"] [--min-host x.y.z] [--force]')
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
