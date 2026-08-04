// JSON Schema → TypeScript 类型表达式。**市场侧唯一实现**。
//
// ## 为什么必须只有一份
// 这段算法原先在 `gen-sdk-types.mjs` 里，`gen-api-docs.mjs` 要用就得抄第二份。
// 同一个仓库里已经因为「抄一份清单」出过事：`gen-sdk-types.mjs` 手抄的 `HANDWRITTEN`
// 集合漏了 `overlay` / `list`，于是 SDK 的 `aibox-global.d.ts` 把 `list` 声明了两次，
// TypeScript 命名空间合并把两份签名并成**重载**——`list.setRows({regionId, rows})`
// 这种错误的单对象调用因此合法通过 tsc，而真值是两个位置参数。
// 结论：凡是「两处消费同一条规则」，就把规则搬进 lib，不要抄。
//
// ## 与 Swift 的关系
// Swift 侧 `AppletDeveloperSDK+TypeScript.swift` 的 `generatedSchemaType` 是同一算法的另一语言实现
// （宿主要在运行时生成 `.aibox/aibox.d.ts`，拿不到 Node）。两者**必须逐条对齐**；
// 对齐由 `test/schema-type.test.mjs` 的共享用例表 + 宿主侧 `AppletGeneratedTypeScriptTests`
// 跑同一张表来保证——不是靠注释提醒。

/** JSON Schema 对象 → TS 类型表达式。无法表达的一律 `unknown`（宽而不骗人）。 */
export function schemaType(schema) {
  // 联合返回是真实存在的形状：`audio.recordStop` 要么给资源句柄、要么给 `{discarded:true}`。
  // 把它压成「一个带一堆可选字段的对象」会让 `if (!r.discarded) r.url` 这种正确写法反而报错，
  // 也会让 `r.url` 在 discarded 分支里合法 —— 两个方向都错。故 oneOf/anyOf 直译成 TS 联合。
  const variants = schema?.oneOf ?? schema?.anyOf
  if (Array.isArray(variants) && variants.length > 0) {
    return variants.map((variant) => schemaType(variant)).join(' | ')
  }
  if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
    return schema.enum
      .map((value) => (typeof value === 'string' ? JSON.stringify(value) : String(value)))
      .join(' | ')
  }
  switch (schema?.type) {
    case 'string':
      return 'string'
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return `Array<${schemaType(schema.items ?? {})}>`
    case 'object': {
      const properties = schema.properties ?? {}
      const required = new Set(schema.required ?? [])
      const keys = Object.keys(properties).sort()
      if (keys.length === 0) return 'Record<string, unknown>'
      const fields = keys.map((key) => `${key}${required.has(key) ? '' : '?'}: ${schemaType(properties[key])}`)
      return `{ ${fields.join('; ')} }`
    }
    default:
      return 'unknown'
  }
}

/** 入参 schema → TS 类型。空 schema = 该方法不收参数（`Record<string, never>`，比 `{}` 严格）。 */
export function parametersType(parametersJSON) {
  if (!parametersJSON || parametersJSON === '{}') return 'Record<string, never>'
  let parsed
  try {
    parsed = JSON.parse(parametersJSON)
  } catch {
    return 'Record<string, never>'
  }
  return schemaType(parsed)
}

/** 入参是否有必填字段——决定生成的签名里 `input` 要不要打问号。 */
export function hasRequired(parametersJSON) {
  try {
    const parsed = JSON.parse(parametersJSON ?? '{}')
    return Array.isArray(parsed.required) && parsed.required.length > 0
  } catch {
    return false
  }
}

/**
 * 返回 schema → TS 类型。**未声明 → `unknown`**。
 *
 * 刻意不去解析 `resultSummary` 那段散文（它的形态从 `"boolean"` 一路到
 * `"async-iterable of string deltas, with .cancel()"`）：猜出来的类型比没有类型更糟，
 * 它让 tsc 给出「编译通过」的假绿、运行时才炸。覆盖率靠 `audit-result-schema.mjs` 棘轮推进。
 */
export function resultType(resultSchemaJSON) {
  if (!resultSchemaJSON || resultSchemaJSON === '{}') return 'unknown'
  let parsed
  try {
    parsed = JSON.parse(resultSchemaJSON)
  } catch {
    return 'unknown'
  }
  return schemaType(parsed)
}
