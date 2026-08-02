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
  LIMITS, ROOT, SCHEMA_VERSION, appPaths, compareSemver, fail, info, listReleaseVersions,
  listSourceFiles, ok, parseSemver, readBundleFile, readJSON, relativePathError, stripContent,
  warn, writeJSON,
} from './lib/market.mjs'
import { rebuild } from './build-registry.mjs'

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--force') flags.force = true
    else if (arg === '--notes') flags.notes = argv[++i]
    else if (arg === '--notes-en') flags.notesEN = argv[++i]
    else if (arg === '--min-host') flags.minHost = argv[++i]
    else if (arg.startsWith('-')) throw new Error(`未知参数 ${arg}`)
    else positional.push(arg)
  }
  return { positional, flags }
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

  runValidate(appId)

  // —— 组包 ——
  const relatives = listSourceFiles(paths.srcDir)
  if (relatives.length === 0) throw new Error('src/ 为空，没有可发布的内容')
  const files = []
  let totalBytes = 0
  for (const relative of relatives) {
    const pathError = relativePathError(relative)
    if (pathError) throw new Error(pathError)
    const file = readBundleFile(paths.srcDir, relative)
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

  const dir = paths.releaseDir(version)
  fs.mkdirSync(dir, { recursive: true })
  writeJSON(path.join(dir, 'release.json'), { ...head, files: files.map(stripContent) })
  writeJSON(path.join(dir, 'bundle.json'), { ...head, files })

  ok(`已发布 ${appId} ${version}`)
  info(`${files.length} 个文件，${(totalBytes / 1024).toFixed(1)} KB`)
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
