#!/usr/bin/env node
//
//  gen-sdk-types.mjs
//  从宿主真值派生 `@aibox/applet-sdk` 的 `aibox.*` 全局类型（packages/aibox-sdk/src/generated/）。
//
//  ## 为什么是生成而不是手抄
//  `aibox.*` 的真值是宿主虚拟文件 `.aibox/aibox.d.ts`（Swift 侧 `AppletDeveloperSDK.typeScript()`
//  在运行时拼出来的）。手抄一份进 SDK 必然漂移——漂移的类型比没有类型更糟：它会让 tsc 给出
//  「编译通过」的假绿，运行时才炸。
//
//  ## 三段真值，一个都不能少
//   ① `AppletDeveloperSDK+TypeScript.swift` 的 `platformTypeScript`
//      —— 手写 ergonomic 签名（storage / net / access / events / lifecycle / scene / menu /
//         tabs / toolbar / navigation / ui / picker / resource / share / action）。
//   ② `AppletDeveloperSDK.swift` 的 `aiTypeScript` —— `namespace ai`。
//   ③ `docs/api/capabilities.snapshot.json` —— descriptor 的机器可读快照，**由 api-docs 的
//      gen-api-docs.mjs 抽取**。本脚本只读它、不自己抽 descriptor（不造第二套提取器）。
//      snapshot 里被 ①② 覆盖的命名空间跳过，其余按 Swift `generatedNativeTypeScript` 的同一算法
//      从 parametersJSON 生成 `function m(input): Promise<unknown>`。
//
//  ## 用法
//    node scripts/gen-sdk-types.mjs           # 生成/覆盖
//    node scripts/gen-sdk-types.mjs --check   # 只校验，不写盘（CI 漂移闸门；退出码 1 = 漂移）
//
//  宿主源码不在场（独立 CI）时，① ② 取不到：`--check` 只校验 snapshot 那一段，生成模式直接报错
//  （宁可不生成，也不生成一份缺了一半的类型）。
//

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARKET_ROOT = path.resolve(HERE, '..');
const SNAPSHOT = path.join(MARKET_ROOT, 'docs', 'api', 'capabilities.snapshot.json');
const OUT_DIR = path.join(MARKET_ROOT, 'packages', 'aibox-sdk', 'src', 'generated');
const OUT_FILE = path.join(OUT_DIR, 'aibox-global.d.ts');

/** 宿主仓库根（市场是主仓库的子目录时成立；独立 clone 时为 null）。 */
function hostRoot() {
  const candidate = path.resolve(MARKET_ROOT, '..');
  const probe = path.join(candidate, 'Packages', 'AppletPluginKit', 'Sources', 'AppletPluginKit');
  return fs.existsSync(probe) ? candidate : null;
}

const KIT = (root) => path.join(root, 'Packages', 'AppletPluginKit', 'Sources', 'AppletPluginKit');

// ---------------------------------------------------------------------------
// 1. Swift 多行字符串常量抽取
// ---------------------------------------------------------------------------
// 只支持 `static let <name> = """ … """` 这一种形态（这两个常量就是这么写的），且要求块内
// **没有插值** —— 有插值说明常量形态变了，宁可硬失败也不要生成一份被 `\(…)` 污染的 .d.ts。

function extractSwiftMultiline(source, constName) {
  const decl = new RegExp(`static\\s+let\\s+${constName}\\s*=\\s*"""\\n`);
  const start = decl.exec(source);
  if (!start) throw new Error(`在 Swift 源码里找不到 ${constName} 的多行字符串常量`);
  const bodyStart = start.index + start[0].length;
  const end = source.indexOf('"""', bodyStart);
  if (end < 0) throw new Error(`${constName} 的多行字符串没有闭合`);
  const raw = source.slice(bodyStart, end);
  if (/\\\(/.test(raw)) {
    throw new Error(`${constName} 里出现了字符串插值，抽取器不能保证正确性——请更新 gen-sdk-types.mjs`);
  }
  // Swift 多行字符串以闭合 `"""` 的缩进为基准去缩进。
  const closingIndent = /(^|\n)([ \t]*)$/.exec(source.slice(0, end))?.[2] ?? '';
  const lines = raw.replace(/\n$/, '').split('\n');
  return lines
    .map((line) => (line.startsWith(closingIndent) ? line.slice(closingIndent.length) : line))
    .join('\n');
}

// ---------------------------------------------------------------------------
// 2. JSON Schema -> TypeScript（与 Swift `generatedSchemaType` 逐条对齐）
// ---------------------------------------------------------------------------

function schemaType(schema) {
  if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
    return schema.enum
      .map((value) => (typeof value === 'string' ? JSON.stringify(value) : String(value)))
      .join(' | ');
  }
  switch (schema?.type) {
    case 'string': return 'string';
    case 'integer':
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'array': return `Array<${schemaType(schema.items ?? {})}>`;
    case 'object': {
      const properties = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      const keys = Object.keys(properties).sort();
      if (keys.length === 0) return 'Record<string, unknown>';
      const fields = keys.map((key) => `${key}${required.has(key) ? '' : '?'}: ${schemaType(properties[key])}`);
      return `{ ${fields.join('; ')} }`;
    }
    default: return 'unknown';
  }
}

function parametersType(parametersJSON) {
  if (!parametersJSON || parametersJSON === '{}') return 'Record<string, never>';
  let parsed;
  try { parsed = JSON.parse(parametersJSON); } catch { return 'Record<string, never>'; }
  return schemaType(parsed);
}

function hasRequired(parametersJSON) {
  try {
    const parsed = JSON.parse(parametersJSON ?? '{}');
    return Array.isArray(parsed.required) && parsed.required.length > 0;
  } catch { return false; }
}

// 被 platformTypeScript / aiTypeScript 手写覆盖的命名空间，与 Swift `generatedNativeTypeScript`
// 的 `handwritten` 集合逐字一致。多一个会覆盖掉更好的手写签名，少一个会漏掉整条命名空间。
const HANDWRITTEN = new Set([
  'storage', 'net', 'ai', 'access', 'lifecycle', 'scene', 'navigation', 'ui', 'picker',
  'resource', 'tools', 'action', 'tabs', 'toolbar', 'share',
]);

// ECMAScript 保留字。descriptor 里**真的有**这样的方法名（`files.delete`、`voiceMemos.delete`、
// `voiceMemos.import`），而 `namespace X { function delete(…) }` 是语法错误。
//
// ⚠️ 宿主生成的虚拟文件 `.aibox/aibox.d.ts` 目前也踩了这个坑（Swift 侧 `generatedNativeTypeScript`
// 无条件 emit `function <name>`）——那份文件是模型的 API 文档，在 `files` 之后整块都解析不出来。
// 已在交付报告里作为宿主缺陷上报。这里用 `interface + const` 绕开：接口的成员名允许是关键字。
const RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import',
  'in', 'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true',
  'try', 'typeof', 'var', 'void', 'while', 'with',
]);

function interfaceName(namespace) {
  return `${namespace.charAt(0).toUpperCase()}${namespace.slice(1)}Namespace`;
}

function generatedNamespaces(snapshot) {
  const blocks = [];
  for (const entry of snapshot.namespaces) {
    if (HANDWRITTEN.has(entry.namespace)) continue;
    const needsInterface = entry.methods.some((method) => RESERVED_WORDS.has(method.name));
    const signatures = entry.methods.map((method) => {
      const input = parametersType(method.parametersJSON);
      const optional = hasRequired(method.parametersJSON) ? '' : '?';
      const doc = `    /** ${method.summary} Result: ${method.resultSummary} */`;
      const name = needsInterface && RESERVED_WORDS.has(method.name) ? `"${method.name}"` : method.name;
      const decl = needsInterface
        ? `    ${name}(input${optional}: ${input}): Promise<unknown>`
        : `    function ${method.name}(input${optional}: ${input}): Promise<unknown>`;
      return `${doc}\n${decl}`;
    });
    if (needsInterface) {
      const type = interfaceName(entry.namespace);
      blocks.push([
        `  // ${entry.namespace} 含保留字方法名，故用 interface + const 而不是 namespace（语义等价）。`,
        `  interface ${type} {`,
        ...signatures,
        '  }',
        `  const ${entry.namespace}: ${type}`,
      ].join('\n'));
    } else {
      blocks.push([`  namespace ${entry.namespace} {`, ...signatures, '  }'].join('\n'));
    }
  }
  return blocks.join('\n\n');
}

// ---------------------------------------------------------------------------
// 3. 组装
// ---------------------------------------------------------------------------
// `tools` 在宿主是**按本机 grant 现算**的（HostToolName 是当前允许的工具名字面量联合）。
// 市场包编译期拿不到那份清单，故这里退化成 `string` —— 类型宽一点，但不会给出一份骗人的窄类型。

const TOOLS_BLOCK = `  namespace tools {
    /**
     * 宿主 AgentTool 名。宿主虚拟 .aibox/aibox.d.ts 里这里是**按本机 grant 现算**的字面量联合；
     * 市场包编译期没有那份清单，故退化成 string。工具是否可调用仍由运行时 grant 决定。
     */
    type HostToolName = string
    interface HostToolArguments { [name: string]: Record<string, unknown> }
    interface ToolSummary { name: string; description: string; parameters: string[] }
    interface ArtifactRef { uri: string; kind: string; status: string; title?: string; origin?: string }
    interface ToolCallResult {
      ok: boolean
      tool: string
      text: string
      permission: string
      isError: boolean
      progress: string[]
      imageCount: number
      artifacts: ArtifactRef[]
      details?: JSONValue
      error?: string
    }

    function list(input?: { limit?: number }): Promise<ToolSummary[]>
    function search(input: { query: string; limit?: number }): Promise<ToolSummary[]>
    function describe(input: { name: HostToolName }): Promise<{
      name: string; description: string; shortDescription: string; parameters: JSONValue
    }>
    function call(input: { name: HostToolName; arguments?: Record<string, unknown> }): Promise<ToolCallResult>
    function callBatch(input: {
      calls: Array<{ name: HostToolName; arguments?: Record<string, unknown> }>
    }): Promise<ToolCallResult[]>
  }`;

function indent(block, spaces) {
  const pad = ' '.repeat(spaces);
  return block
    .split('\n')
    .map((line) => (line.trim() === '' ? line : pad + line))
    .join('\n');
}

function render({ platform, ai, snapshot }) {
  const header = [
    '// 本文件由 applet-market/scripts/gen-sdk-types.mjs 生成，请勿手改。',
    '// 真值：',
    '//   · Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletDeveloperSDK+TypeScript.swift（platformTypeScript）',
    '//   · Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/AppletDeveloperSDK.swift（aiTypeScript）',
    '//   · applet-market/docs/api/capabilities.snapshot.json（descriptor 快照，由 gen-api-docs.mjs 抽取）',
    '// 重新生成： npm run sdk:types      漂移检查： npm run sdk:types:check',
    `// 命名空间：${snapshot.namespaces.length} 个（宿主恒有 ${snapshot.alwaysAvailable.length} 个、可声明 ${snapshot.declarable.length} 个）`,
    '',
    '/* eslint-disable */',
    '',
  ].join('\n');

  const body = [
    'declare namespace aibox {',
    '  type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue }',
    '',
    '  interface BridgeProtocolInfo {',
    '    current: "2.0"',
    '    supported: Array<"1.0" | "2.0">',
    '    transport: "WKScriptMessageHandlerWithReply"',
    '  }',
    '  function protocol(): BridgeProtocolInfo',
    '  function rpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>',
    '  function invoke<T = unknown>(namespace: string, method: string, args?: Record<string, unknown>): Promise<T>',
    '  function capabilities(): Record<string, string[]>',
    '  function capabilityDescriptors(): Array<{',
    '    namespace: string',
    '    summary: string',
    '    methods: Array<{ name: string; summary: string; parametersJSON: string; resultSummary: string; effect: string; example?: string }>',
    '  }>',
    '',
    indent(platform, 0),
    '',
    generatedNamespaces(snapshot),
    '',
    indent(ai, 0),
    '',
    TOOLS_BLOCK,
    '}',
    '',
    'interface Window {',
    '  /** Effective host language, available before the applet\'s first render. */',
    '  readonly __aiboxEnvironment?: Readonly<{ locale: string; language: string }>',
    '  /** The bridge object. Present in every applet WebView; `undefined` outside one. */',
    '  readonly aibox?: typeof aibox',
    '}',
    '',
    '/** 宿主可声明的扩展能力命名空间（manifest.permissions.capabilities 的取值域）。 */',
    `declare type AiboxDeclarableCapability = ${snapshot.declarable.map((n) => JSON.stringify(n)).join(' | ')}`,
    '',
    '/** 容器恒可用命名空间：无需也不该写进 manifest.permissions.capabilities。 */',
    `declare type AiboxAlwaysAvailableNamespace = ${snapshot.alwaysAvailable.map((n) => JSON.stringify(n)).join(' | ')}`,
    '',
    '// 本文件**必须**保持为 global script（没有顶层 import/export）——加一行 `export {}` 就会把它变成',
    '// 模块，`declare namespace aibox` 随即只在该模块内可见，全仓的 `aibox.*` 类型一起失效。',
    '',
  ].join('\n');

  return `${header}${body}`;
}

// ---------------------------------------------------------------------------
// 4. 入口
// ---------------------------------------------------------------------------

function build() {
  if (!fs.existsSync(SNAPSHOT)) {
    throw new Error(`缺少 ${path.relative(MARKET_ROOT, SNAPSHOT)}（先跑 node scripts/gen-api-docs.mjs extract）`);
  }
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const root = hostRoot();
  if (!root) {
    throw new Error('宿主源码不在场（需要 ../Packages/AppletPluginKit），无法抽取 platformTypeScript / aiTypeScript');
  }
  const kit = KIT(root);
  const platform = extractSwiftMultiline(
    fs.readFileSync(path.join(kit, 'Runtime', 'AppletDeveloperSDK+TypeScript.swift'), 'utf8'),
    'platformTypeScript');
  const ai = extractSwiftMultiline(
    fs.readFileSync(path.join(kit, 'Runtime', 'AppletDeveloperSDK.swift'), 'utf8'),
    'aiTypeScript');
  return { text: render({ platform, ai, snapshot }), snapshot };
}

function main() {
  const check = process.argv.includes('--check');
  let built;
  try {
    built = build();
  } catch (error) {
    if (check && !hostRoot()) {
      // 独立 CI：宿主源码不在场，只能确认生成物存在（内容漂移由主仓库 CI 兜住）。
      if (fs.existsSync(OUT_FILE)) {
        console.log('SDK 类型：宿主源码不在场，跳过漂移检查（生成物存在）。');
        return 0;
      }
      console.error('✗ SDK 类型生成物缺失，且宿主源码不在场，无法生成。');
      return 1;
    }
    console.error(`✗ ${error.message}`);
    return 1;
  }

  if (check) {
    const old = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : null;
    if (old !== built.text) {
      console.error('✗ packages/aibox-sdk/src/generated/aibox-global.d.ts 与宿主真值不一致，跑 npm run sdk:types 重新生成。');
      return 1;
    }
    console.log(`✓ SDK 类型与宿主真值一致（${built.snapshot.namespaces.length} 个命名空间）。`);
    return 0;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, built.text, 'utf8');
  console.log(`✓ 已生成 ${path.relative(MARKET_ROOT, OUT_FILE)}（${built.snapshot.namespaces.length} 个命名空间）`);
  return 0;
}

process.exit(main());
