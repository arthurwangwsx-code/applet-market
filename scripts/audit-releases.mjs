#!/usr/bin/env node
// 已发布版本的**只读**归档审计：把仓库里所有 `releases/*/bundle.json` 拿宿主的判据重扫一遍，
// 回答「哪些历史版本其实装不上、该被 yank」。
//
//   node scripts/audit-releases.mjs                 # 全量
//   node scripts/audit-releases.mjs com.aibox.timer # 单个应用
//   node scripts/audit-releases.mjs --json          # 机读
//
// ## 为什么它是独立命令，而且**不进 CI 的退出码**
//
// `validate.mjs` 只读 `src/manifest.json`，从不回看已发布的包——于是 `com.aibox.timer` 1.0.0
// 那份坏 manifest（`effect: "localWrite"`，宿主硬解码抛错 → 应用静默装不上）在仓库里躺了很久，
// 而 CI 全程绿灯。
//
// 但**不能**因此把它塞进 `validate.mjs`：已发布版本是不可变的，重新校验它们会产生一条
// **永久无法修复的红**（你不能回去改一个已经发出去的包）。红了又修不了的闸门，
// 下一个人只会学会忽略它——那比没有闸门更糟。
//
// 所以这条命令的产出是**一份工单**：「这些历史版本该被 yank」。
// 处置动作是 `node scripts/release.mjs yank <appId> <version> --reason "…"`，
// 由人看过之后执行；撤回保留字节、只是不再让新用户装到它。
//
// ⚠️ 它复刻的是**宿主**的判据，不是发布脚本的判据。两者分叉正是这类故障的根因，
// 所以这里的规则必须与 Swift 侧 `AppletMarketPreflight` / `AppletMarketInstaller` 对齐；
// 改了一侧就要改另一侧。

import fs from 'node:fs'
import path from 'node:path'
import {
  LIMITS,
  ROOT,
  appPaths,
  fail,
  info,
  listAppIDs,
  listReleaseVersions,
  ok,
  readJSON,
  warn,
} from './lib/market.mjs'
import { checkManifestKeys, defaultHostSourceDir, loadHostSchema } from './lib/manifest-keys.mjs'

// —— manifest 的枚举取值域从**宿主源码**现取，不在这里抄第二份 ——
//
// 第一版这里手抄了五张枚举表，结果三张是错的（`AppletActionVisibility` 抄成了
// assistant/launcher/…，`AppletResourceRefreshPolicy` 抄成了 manual/onOpen/interval，
// `AppletAutomationTriggerKind` 少了三个 case），于是审计把**全部 20 个已发布版本**
// 都判成「装不上」。
//
// 这正是这条审计要抓的那种缺陷本身：**市场侧的规则和宿主的真值是两套东西。**
// 手抄的表迟早会漂，而漂了之后审计的结论会比没有审计更糟——它会很自信地说错话。
// 所以判据一律取 `manifest-keys.mjs` 的 `loadHostSchema`（从 Swift 源码解 enum case），
// 宿主源码不在场时**跳过 manifest 那一段并说明**，而不是回落到一份抄来的表。

/** 一条问题。`fatal` = 这一版**装不上**（该 yank）；否则只是值得知道。 */
const issue = (fatal, code, message) => ({ fatal, code, message })

let hostSchema
let hostSchemaChecked = false

/** 惰性加载宿主 schema；不在场返回 null（调用方跳过 manifest 检查并说明）。 */
function schema() {
  if (!hostSchemaChecked) {
    hostSchemaChecked = true
    hostSchema = loadHostSchema(defaultHostSourceDir(ROOT))
  }
  return hostSchema
}

/**
 * manifest 面：键名 + 枚举取值域，判据全部来自宿主 Swift 源码。
 * `checkManifestKeys` 的 error 就是「宿主解不开 / 声明不生效」，与本命令的 `fatal` 同义。
 */
function auditManifest(manifest) {
  const host = schema()
  if (!host) return []
  const { errors } = checkManifestKeys(manifest, host)
  return errors.map((message) => issue(true, 'manifest.schema', message))
}

/** 宿主的路径硬门（`AppletMarketInstaller.validatedRelativePath` 的镜像）。 */
function auditPath(relative) {
  const value = String(relative ?? '').trim()
  if (!value) return issue(true, 'path.empty', '空路径条目')
  if (value.length > 240) return issue(true, 'path.tooLong', `路径过长：${value}`)
  if (value.startsWith('/') || value.startsWith('~')) {
    return issue(true, 'path.absolute', `绝对路径：${value}`)
  }
  if (value.includes('\\')) return issue(true, 'path.backslash', `反斜杠分隔：${value}`)
  if (/^[a-zA-Z]:/.test(value)) return issue(true, 'path.driveLetter', `Windows 盘符：${value}`)
  for (const seg of value.split('/')) {
    if (seg === '') return issue(true, 'path.emptySegment', `空路径段：${value}`)
    if (seg === '..') return issue(true, 'path.traversal', `路径穿越：${value}`)
    if (seg === '.') return issue(true, 'path.dotSegment', `. 路径段：${value}`)
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(seg)) {
      return issue(true, 'path.controlCharacter', `控制字符：${JSON.stringify(value)}`)
    }
  }
  if (value === '.aibox' || value.startsWith('.aibox/') || value === '.build' || value.startsWith('.build/')) {
    return issue(true, 'path.protectedSurface', `宿主受保护面：${value}`)
  }
  return null
}

/** 宿主自有文件：包里带了是冗余但无害，安装器会跳过（`AppletStore.isHostOwnedFile`）。 */
const isHostOwned = (p) => p === 'manifest.json' || p === '.tests.json'

function auditBundle(bundlePath) {
  const bundle = readJSON(bundlePath)
  const out = []
  if (!bundle.manifest || typeof bundle.manifest !== 'object') {
    out.push(issue(true, 'manifest.missing', 'bundle.json 里没有 manifest 对象'))
  } else {
    out.push(...auditManifest(bundle.manifest))
  }

  const files = bundle.files ?? []
  let total = 0
  let payload = 0
  const seen = new Set()
  for (const file of files) {
    const relative = String(file?.path ?? '').trim()
    if (isHostOwned(relative)) continue
    const pathIssue = auditPath(relative)
    if (pathIssue) {
      out.push(pathIssue)
      continue
    }
    if (seen.has(relative)) {
      out.push(issue(true, 'path.duplicate', `重复条目：${relative}`))
      continue
    }
    seen.add(relative)
    payload += 1
    total += file?.bytes ?? 0
    if ((file?.bytes ?? 0) > LIMITS.maxFileBytes) {
      out.push(issue(true, 'limit.fileBytes', `${relative} 超过单文件上限`))
    }
  }
  if (payload === 0) out.push(issue(true, 'content.empty', '这一版没有可安装的文件'))
  if (files.length > LIMITS.maxFileCount) {
    out.push(issue(true, 'limit.fileCount', `${files.length} 个文件超过上限 ${LIMITS.maxFileCount}`))
  }
  if (total > LIMITS.maxVersionBytes) {
    out.push(issue(true, 'limit.versionBytes', `整包 ${total} 字节超过单版本上限`))
  }

  // 构建型产物必须自带 index.html（含 import map）；宿主的默认外壳不认识它的 chunk 名。
  const runtimeKind = bundle.manifest?.runtimeKind ?? 'source'
  if (runtimeKind === 'bundle' && !seen.has('index.html')) {
    out.push(issue(true, 'shape.missingIndexBundle', 'runtimeKind="bundle" 但包里没有 index.html —— 装上去是空白页'))
  }
  return out
}

function main() {
  const args = process.argv.slice(2)
  const asJSON = args.includes('--json')
  const targets = args.filter((a) => !a.startsWith('-'))
  const appIds = targets.length ? targets : listAppIDs()
  const report = []

  for (const appId of appIds) {
    const paths = appPaths(appId)
    for (const version of listReleaseVersions(appId)) {
      const bundlePath = path.join(paths.releaseDir(version), 'bundle.json')
      if (!fs.existsSync(bundlePath)) continue
      const releasePath = path.join(paths.releaseDir(version), 'release.json')
      const yanked = fs.existsSync(releasePath) ? readJSON(releasePath).yanked === true : false
      let issues = []
      try {
        issues = auditBundle(bundlePath)
      } catch (error) {
        issues = [issue(true, 'bundle.unreadable', String(error.message ?? error))]
      }
      if (issues.length) report.push({ appId, version, yanked, issues })
    }
  }

  if (asJSON) {
    console.log(JSON.stringify({ auditedApps: appIds.length, findings: report }, null, 2))
    return
  }

  // 已经 yank 过的照样列出来，但**不再是待办**——否则每次跑都会重复提示同一批。
  const actionable = report.filter((r) => !r.yanked && r.issues.some((i) => i.fatal))
  const already = report.filter((r) => r.yanked)

  if (!report.length) {
    ok(`归档审计通过：${appIds.length} 个应用的全部已发布版本都装得上`)
    return
  }
  for (const row of report) {
    const tag = row.yanked ? '（已撤回）' : ''
    const line = `${row.appId} ${row.version}${tag}`
    if (row.yanked) info(line)
    else warn(line)
    for (const i of row.issues) info(`  ${i.fatal ? '装不上' : '注意'} · ${i.code} · ${i.message}`)
  }
  console.log('')
  if (already.length) {
    info(`${already.length} 个版本已经撤回，无需处理`)
  }
  if (actionable.length) {
    warn(`${actionable.length} 个已发布版本装不上，建议撤回：`)
    for (const row of actionable) {
      info(`  node scripts/release.mjs yank ${row.appId} ${row.version} --reason "…"`)
    }
    console.log('')
    info('这条命令**故意不用非零退出码**：已发布版本不可变，重新校验会产生永久修不掉的红，')
    info('而红了又修不了的闸门只会教人忽略它。它的产出是一份工单，不是一道门。')
  } else {
    ok('没有需要新撤回的版本')
  }
}

try {
  main()
} catch (error) {
  fail(String(error.stack ?? error))
  process.exit(1) // 只有审计器自己崩了才非零——审计**结论**永远退出 0
}
