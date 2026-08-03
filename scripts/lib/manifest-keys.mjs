// manifest 闸门：把 `src/manifest.json` 的每个**键名**与每个**枚举值**，对着宿主解码器核一遍。
//
// ## 为什么需要它（键名）
// 宿主用 Swift 合成的 `Codable` 读 manifest —— 合成解码器对**不认识的键一律静默忽略**。于是：
//
//   "execution": { "mode": "serial", "timeout_ms": 8000 }
//
// 装得上、不报错、`validate.mjs` 也不报错（我们校验的是市场自己的 schema，不是宿主的解码器），
// 但 `timeout_ms` 被丢掉，声明的超时**从未生效**。更阴的是 `mode` 两边同名会照常生效，
// 看起来像整个 `execution` 都被吃进去了。
//
// 这个坑之所以容易踩：**同一个结构体在另一条路径上读的是 snake_case**——`applet_manage` 工具
// （`Tools/AppletContractToolParsing.swift`）读 `timeout_ms` / `max_retries` / `requires_network`…
// 那是给模型看的工具 schema，不是 manifest 的 wire 格式。照着工具 schema 写 manifest 就会中招。
//
// ## 为什么需要它（枚举值）
// 键名对了、值错了，后果比丢一个字段严重得多：枚举是**硬解码**的，一个非法值让整份 manifest
// 解不出来 —— 表现为**应用静默装不上**，没有任何一处日志说得清原因。
//
// 这不是假设。`com.aibox.timer` **1.0.0 就是带着这个 bug 发布出去的**：
//
//   "actions": [{ "name": "startTimer", "effect": "localWrite" }]     ← 非法
//
// `localWrite` 来自**另一套词汇**：桥能力描述的副作用档位（`AppletCapabilityEffect`：
// read / localWrite / external / presentation / meta），而 manifest 的 action effect 是
// `AppletActionEffect`（read / write / delete / …）。两套同名 `effect`、共有 `read`，
// 还有三对近义词。AI 写 `read` 成功 → 合理推断两套是同一套 → 接着写 `localWrite`。
// 而当时 `validate.mjs` 对 `effect` 零命中，CI 如实反映「没人检查这一项」。
//
// ## 为什么从 Swift 源码机械提取，而不是手写一张表
// 手写的表会漂：宿主加一个 additive 字段或一个枚举 case，表不更新 → 合法 manifest 被误判成非法。
// 直接读 `public var` 声明 + `enum CodingKeys` 重映射 + `enum X: String` 的 case 表，
// 宿主改什么这里自动跟随，零维护。**桥词汇的对照表也一样是提取的**（宿主
// `AppletActionEffect.bridgeSideEffectEquivalents`），不在这里抄第二份。
//
// 四条必须处理的细节（漏一条就误报）：
//  1. `enum CodingKeys` 的重映射是权威 —— `AppletPresentation` 是 `primary = "default"`、
//     `AppletActionDescriptor` 是 `actionID = "id"`。按属性名判就会把合法的 `default` / `id` 判成非法。
//  2. **计算属性不是 wire 字段** —— `public var id: String { name }`、`effectivePresentation` 之类
//     不参与编解码，混进来会把非法键放行。
//  3. 枚举只认**顶格**声明的 `enum X: String`：嵌在 struct 里的 `enum CodingKeys: String, CodingKey`
//     缩进 4 格，混进来会把 CodingKeys 的 case 当成合法取值。
//  4. 宿主源码不在场时（有人单独 clone 市场仓库）**跳过并 warn，不 fail**。

import fs from 'node:fs'
import path from 'node:path'

/** 承载 manifest 的三个模型文件。都不在时视为「宿主源码不在场」。 */
const MODEL_FILES = ['AppletModels.swift', 'AppletPlatformModels.swift', 'AppletSceneModels.swift']

/** 桥词汇对照表所在文件（相对宿主源码根）——只取那张表，不参与键名/类型图。 */
const EFFECT_REMEDY_FILE = 'AppletPlatformModels.swift'

/** manifest 的根类型。 */
export const ROOT_STRUCT = 'AppletManifest'

/**
 * 宿主安装时会覆写/剥掉的字段：写了也不算数，提醒而不是报错。
 * 刻意**不含 `id`**——`validate.mjs` 已有一条专门的、且不依赖宿主源码在场的 `id` 提醒，
 * 放这里会变成同一件事报两遍。
 */
const HOST_OWNED_KEYS = new Set([
  'createdAt', 'updatedAt',
  'marketSourceID', 'marketAppID', 'marketVersion',
  'lastOpenedAt', 'lastExecutedAt', 'pinned',
])

/** 默认到宿主源码的相对路径；`AIBOX_HOST_SOURCE` 可覆盖。 */
export function defaultHostSourceDir(marketRoot) {
  return process.env.AIBOX_HOST_SOURCE
    ?? path.join(marketRoot, '..', 'Packages', 'AppletPluginKit', 'Sources', 'AppletPluginKit')
}

// —— Swift 解析 ——

/** `public nonisolated struct Name: ...` / `public struct Name: ...` */
const STRUCT_RE = /^(?:public\s+)?(?:nonisolated\s+)?public?\s*struct\s+([A-Za-z_][\w]*)\s*[:{]/
/** 缩进一级的存储属性；末尾捕获 `{`（计算属性）或 `=`（带默认值）。 */
const PROPERTY_RE = /^\s{4}public\s+(?:var|let)\s+([A-Za-z_][\w]*)\s*:\s*([^={\n]+?)\s*(\{|=)?\s*$/
/** `case a` / `case a, b, c` / `case a = "json"` */
const CASE_RE = /case\s+(.+)$/

function structHeader(line) {
  const normalized = line.replace(/^\s+/, '')
  if (!/^(public\s+)?(nonisolated\s+)?struct\s/.test(normalized)
      && !/^public\s+nonisolated\s+struct\s/.test(normalized)) return null
  const match = /struct\s+([A-Za-z_][\w]*)\s*[:{]/.exec(normalized)
  return match ? match[1] : null
}

/** 把 `[Foo]?` / `[String: Foo]?` / `Foo?` 拆成 { base, isArray, isDictionary }。 */
export function parseType(raw) {
  let type = raw.trim().replace(/\?+$/, '').trim()
  let isArray = false
  let isDictionary = false
  while (type.startsWith('[') && type.endsWith(']')) {
    const inner = type.slice(1, -1).trim()
    const colon = splitTopLevelColon(inner)
    if (colon >= 0) {
      isDictionary = true
      type = inner.slice(colon + 1).trim()
    } else {
      isArray = true
      type = inner
    }
    type = type.replace(/\?+$/, '').trim()
  }
  return { base: type, isArray, isDictionary }
}

/** 找字典类型里分隔 key/value 的顶层冒号（`[String: [String: Int]]` 里只认第一个）。 */
function splitTopLevelColon(text) {
  let depth = 0
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (c === '[' || c === '(') depth += 1
    else if (c === ']' || c === ')') depth -= 1
    else if (c === ':' && depth === 0) return i
  }
  return -1
}

/** 解析一个 Swift 文件，累积 struct → 字段表。 */
function parseSwift(source, structs) {
  const lines = source.split('\n')
  let current = null
  let depth = 0
  let inCodingKeys = false

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const name = current ? null : structHeader(line)
    if (name) {
      current = { name, props: [], codingKeys: null }
      structs.set(name, current)
      depth = countBraces(line)
      continue
    }
    if (!current) continue

    // CodingKeys 是权威键集，优先于属性名。
    if (/enum\s+CodingKeys\b/.test(line)) {
      current.codingKeys = current.codingKeys ?? new Map()
      inCodingKeys = !line.includes('}')      // 单行形态 `{ case style, items }` 就地解析
      collectCases(line, current.codingKeys)
      depth += countBraces(line)
      if (depth <= 0) { current = null; inCodingKeys = false }
      continue
    }
    if (inCodingKeys) {
      collectCases(line, current.codingKeys)
      if (line.includes('}')) inCodingKeys = false
      depth += countBraces(line)
      if (depth <= 0) { current = null; inCodingKeys = false }
      continue
    }

    const property = PROPERTY_RE.exec(line)
    if (property) {
      const [, propName, rawType, trailer] = property
      // 计算属性不参与编解码。`{` 在本行、或下一行独占一个 `{`，都算计算属性。
      const computed = trailer === '{' || /^\s*\{\s*$/.test(lines[i + 1] ?? '')
      if (!computed) current.props.push({ name: propName, ...parseType(rawType) })
    }

    depth += countBraces(line)
    if (depth <= 0) { current = null; inCodingKeys = false }
  }
}

function countBraces(line) {
  // 粗粒度括号计数：模型文件里没有含 `{`/`}` 的字符串字面量，够用。
  let n = 0
  for (const c of line) {
    if (c === '{') n += 1
    else if (c === '}') n -= 1
  }
  return n
}

/** `case a, b` / `case a = "json"` → Map<属性名, JSON 键>。 */
function collectCases(line, into) {
  const match = CASE_RE.exec(line.trim())
  if (!match) return
  const body = match[1].replace(/\}.*$/, '').trim()
  for (const piece of body.split(',')) {
    const item = piece.trim()
    if (!item) continue
    const remap = /^([A-Za-z_][\w]*)\s*=\s*"([^"]*)"$/.exec(item)
    if (remap) into.set(remap[1], remap[2])
    else if (/^[A-Za-z_][\w]*$/.test(item)) into.set(item, item)
  }
}

// —— 枚举取值域 ——

/** 顶格声明的 `String` 原始值枚举：`public enum AppletActionEffect: String, Codable, … {` */
const ENUM_HEADER_RE = /^(?:public\s+|internal\s+)?enum\s+([A-Za-z_][\w]*)\s*:\s*String\b/

/**
 * 解析一个 Swift 文件里所有**顶格** `enum X: String` 的取值域。
 * 只认顶格：嵌在 struct 里的 `enum CodingKeys: String, CodingKey` 缩进 4 格，混进来会污染取值域。
 * 反引号关键字 case（`case \`static\``）与显式 raw value（`case a = "b"`）都要还原成 wire 上的字符串。
 */
function parseEnums(source, into) {
  const lines = source.split('\n')
  let current = null
  let depth = 0
  for (const line of lines) {
    if (!current) {
      if (/^\s/.test(line)) continue                     // 非顶格 → 一定是嵌套枚举
      const header = ENUM_HEADER_RE.exec(line)
      if (!header) continue
      current = { name: header[1], values: [] }
      depth = countBraces(line)
      if (depth <= 0) current = null                     // 单行空枚举，忽略
      continue
    }
    const match = CASE_RE.exec(line.trim())
    if (match) {
      const body = match[1].replace(/\}.*$/, '').trim()
      for (const piece of body.split(',')) {
        const item = piece.trim()
        if (!item) continue
        const remap = /^`?([A-Za-z_][\w]*)`?\s*=\s*"([^"]*)"$/.exec(item)
        if (remap) current.values.push(remap[2])
        else if (/^`?[A-Za-z_][\w]*`?$/.test(item)) current.values.push(item.replace(/`/g, ''))
      }
    }
    depth += countBraces(line)
    if (depth <= 0) {
      if (current.values.length > 0) into.set(current.name, current.values)
      current = null
    }
  }
}

/**
 * 从宿主 `AppletActionEffect` 的对照表里提取「桥词汇 → manifest 词汇」。
 * 提取而不是手抄：宿主哪天给桥加一档副作用（或改一条对应关系），这里自动跟随；
 * 抄一份就是第二处会漂的真值，而这条错误的整个价值就在于文案说得准。
 */
function parseBridgeVocabulary(source) {
  const equivalents = new Map()
  const equivalentsBlock = /bridgeSideEffectEquivalents[^=]*=\s*\[([\s\S]*?)\n\s*\]/.exec(source)
  if (equivalentsBlock) {
    for (const m of equivalentsBlock[1].matchAll(/"([A-Za-z_][\w]*)"\s*:\s*\.([A-Za-z_][\w]*)/g)) {
      equivalents.set(m[1], m[2])
    }
  }
  const bridgeOnly = new Set()
  const onlyBlock = /bridgeOnlySideEffects[^=]*=\s*\[([^\]]*)\]/.exec(source)
  if (onlyBlock) {
    for (const m of onlyBlock[1].matchAll(/"([A-Za-z_][\w]*)"/g)) bridgeOnly.add(m[1])
  }
  return { equivalents, bridgeOnly }
}

// —— 对外 ——

/**
 * 读宿主模型，构建「struct → 合法 JSON 键 + 嵌套类型」的图，外加枚举取值域与桥词汇对照表。
 * 宿主源码不在场返回 null（调用方据此跳过并 warn）。
 */
export function loadHostSchema(hostSourceDir) {
  if (!hostSourceDir || !fs.existsSync(hostSourceDir)) return null
  const structs = new Map()
  const enums = new Map()
  let bridge = { equivalents: new Map(), bridgeOnly: new Set() }
  let found = 0
  for (const file of MODEL_FILES) {
    const full = path.join(hostSourceDir, file)
    if (!fs.existsSync(full)) continue
    const source = fs.readFileSync(full, 'utf8')
    parseSwift(source, structs)
    parseEnums(source, enums)
    if (file === EFFECT_REMEDY_FILE) bridge = parseBridgeVocabulary(source)
    found += 1
  }
  if (found === 0 || !structs.has(ROOT_STRUCT)) return null

  // 归一成 { keys: Set, fields: Map<jsonKey, {base,isArray,isDictionary}> }
  const byStruct = new Map()
  for (const [name, entry] of structs) {
    const fields = new Map()
    if (entry.codingKeys && entry.codingKeys.size > 0) {
      // CodingKeys 存在 ⇒ 它就是完整键集；属性表只用来补类型。
      const byProp = new Map(entry.props.map((p) => [p.name, p]))
      for (const [prop, jsonKey] of entry.codingKeys) {
        const type = byProp.get(prop) ?? { base: 'Unknown', isArray: false, isDictionary: false }
        fields.set(jsonKey, type)
      }
    } else {
      for (const prop of entry.props) fields.set(prop.name, prop)
    }
    byStruct.set(name, { keys: new Set(fields.keys()), fields })
  }
  return { structs: byStruct, enums, bridge }
}

/**
 * 按类型图逐层核对 manifest 的**键名与枚举值**。
 * @returns {{errors: string[], warnings: string[]}}
 */
export function checkManifestKeys(manifest, schema, rootStruct = ROOT_STRUCT) {
  const errors = []
  const warnings = []
  walk(manifest, rootStruct, '', schema, errors, warnings, true)
  return { errors, warnings }
}

/** 一个枚举字段的非法取值 → 可自愈错误（与宿主写入轮 `AppletSelfHealingEnum.rejection` 同款）。 */
function enumRejection(at, typeName, raw, schema) {
  const valid = schema.enums.get(typeName) ?? []
  let text = `manifest.${at} 的值 ${JSON.stringify(raw)} 不是合法的 ${typeName}`
    + `（只接受：${valid.join(', ')}）—— 宿主是硬解码枚举，一个非法值会让**整份 manifest 解不出来**，`
    + '表现为应用静默装不上，没有任何一处日志说得清原因'
  if (typeName !== 'AppletActionEffect' || typeof raw !== 'string') return text
  const { equivalents, bridgeOnly } = schema.bridge
  if (!equivalents.has(raw) && !bridgeOnly.has(raw)) return text
  const tiers = [...equivalents.keys(), ...bridgeOnly].join(' / ')
  text += `。\n    ${JSON.stringify(raw)} 是**桥能力的副作用档位**（read / ${tiers}`
    + '——你在 `aibox.capabilityDescriptors()`、`.aibox/aibox.d.ts` 与 `applet_read action=capabilities`'
    + ' 里看到的那一套），不是 manifest 的 action effect。两套词汇只共有 `read`，'
    + '所以写 `read` 会成功、看起来像同一套'
  text += equivalents.has(raw)
    ? `。manifest 侧应写 \`${equivalents.get(raw)}\`。`
    : '。它在 manifest 侧没有对应词，按这个 action 真正做的事挑一个。'
  return text
}

function walk(value, typeName, prefix, schema, errors, warnings, isRoot) {
  const entry = schema.structs.get(typeName)
  if (!entry) return                    // 未知类型（基础类型 / 别处定义）→ 无从校验，放过
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return

  for (const [key, child] of Object.entries(value)) {
    const at = prefix ? `${prefix}.${key}` : key
    if (!entry.keys.has(key)) {
      errors.push(
        `manifest.${at} 不是宿主认识的键（${typeName} 只接受：${[...entry.keys].sort().join(', ')}）`
        + ' —— 合成 Codable 会静默忽略它，声明不会生效')
      continue
    }
    if (isRoot && HOST_OWNED_KEYS.has(key)) {
      warnings.push(`manifest.${at} 由宿主安装时写入，包里写了也会被覆盖`)
    }
    const field = entry.fields.get(key)
    if (!field) continue
    // 枚举字段：值必须落在 Swift case 表内（标量与数组两种形态）。
    if (schema.enums.has(field.base)) {
      const valid = schema.enums.get(field.base)
      const candidates = field.isArray && Array.isArray(child) ? child : [child]
      candidates.forEach((raw, index) => {
        if (typeof raw !== 'string' || valid.includes(raw)) return
        const path = field.isArray && Array.isArray(child) ? `${at}[${index}]` : at
        errors.push(enumRejection(path, field.base, raw, schema))
      })
      continue
    }
    if (!schema.structs.has(field.base)) continue
    if (field.isArray && Array.isArray(child)) {
      child.forEach((item, index) => {
        walk(item, field.base, `${at}[${index}]`, schema, errors, warnings, false)
      })
    } else if (field.isDictionary && child && typeof child === 'object') {
      for (const [k, v] of Object.entries(child)) {
        walk(v, field.base, `${at}.${k}`, schema, errors, warnings, false)
      }
    } else {
      walk(child, field.base, at, schema, errors, warnings, false)
    }
  }
}
