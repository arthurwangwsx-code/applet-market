//
//  schema-to-ts.mjs
//  JSON Schema -> TypeScript 类型字面量。**全仓唯一一份**（gen-sdk-types.mjs 与 manifest action
//  类型生成共用），因为两处必须给出**逐字相同**的类型——不然同一个 schema 在 SDK 类型和应用
//  action 类型里长得不一样，编译期校验就成了摆设。
//
//  算法与宿主 Swift 侧 `AppletDeveloperSDK.generatedSchemaType` 逐条对齐：
//  enum 优先 -> string/number/boolean/array/object -> 其余 unknown。
//  额外支持 `description`（转成 JSDoc）与 `nullable`，这两条宿主不用但 manifest schema 里有。
//

/** JSON Schema -> TS 类型串（单行）。 */
export function schemaToType(schema) {
  if (!schema || typeof schema !== 'object') return 'unknown';
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum
      .map((value) => (typeof value === 'string' ? JSON.stringify(value) : String(value)))
      .join(' | ');
  }
  switch (schema.type) {
    case 'string': return 'string';
    case 'integer':
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'null': return 'null';
    case 'array': return `Array<${schemaToType(schema.items ?? {})}>`;
    case 'object': {
      const properties = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      const keys = Object.keys(properties).sort();
      if (keys.length === 0) return 'Record<string, unknown>';
      const fields = keys.map((key) => `${key}${required.has(key) ? '' : '?'}: ${schemaToType(properties[key])}`);
      return `{ ${fields.join('; ')} }`;
    }
    default:
      // 无 type 的 schema（如 `{}` 或只有 description）——保持宽松，别造一个骗人的窄类型。
      return Object.keys(schema).length === 0 ? 'unknown' : 'unknown';
  }
}

/**
 * JSON Schema -> 多行 TS 对象类型（带 JSDoc）。用于 action 的 input：字段说明是写给
 * 开发者和 AI 看的，压成单行就丢了。非 object schema 退回 `schemaToType`。
 */
export function schemaToBlock(schema, indent = '    ') {
  if (!schema || schema.type !== 'object') return schemaToType(schema);
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const keys = Object.keys(properties).sort();
  if (keys.length === 0) return 'Record<string, unknown>';
  const inner = `${indent}  `;
  const lines = ['{'];
  for (const key of keys) {
    const property = properties[key] ?? {};
    if (property.description) lines.push(`${inner}/** ${String(property.description).replace(/\*\//g, '*\\/')} */`);
    lines.push(`${inner}${key}${required.has(key) ? '' : '?'}: ${schemaToType(property)};`);
  }
  lines.push(`${indent}}`);
  return lines.join('\n');
}

/** schema 是否声明了必填字段（决定 handler 入参能不能省）。 */
export function schemaHasRequired(schema) {
  return Boolean(schema && Array.isArray(schema.required) && schema.required.length > 0);
}

/** 安全解析 schema 字符串。解析不了返回 null（调用方决定是报错还是退化）。 */
export function parseSchemaJSON(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
