#!/usr/bin/env node
//
//  gen-api-docs.mjs
//  从宿主 Swift 源码里的 AppletCapabilityDescriptor 生成 docs/api/ 的桥接 API 参考。
//
//  为什么是生成而不是手写：descriptor 是这套能力的唯一真值（docs/capabilities/applet/
//  framework-capabilities.md §6 第 3 条），同一份声明已经在驱动 aibox.capabilities()、
//  applet_read action=capabilities、能力中心 UI 和虚拟 .aibox/aibox.d.ts。手写第二份必然漂移。
//
//  两段式设计（因为市场是独立仓库，CI 里没有 Swift 源码）：
//    extract:  Swift 源码 -> capabilities.snapshot.json（需要宿主仓库在场）
//    render:   snapshot   -> docs/api/*.md（纯数据，任何地方都能跑）
//  `--check` 自动判断：宿主源码在场就连 extract 一起校验（完整漂移），
//  不在场（CI）就只校验 snapshot -> Markdown 这一段（挡住手改生成内容）。
//
//  手写增补：文件里 <!-- MANUAL:BEGIN key --> ... <!-- MANUAL:END key --> 之间的内容
//  由人维护，重新生成时**原样保留**。这是本脚本最重要的约束——没有它，第二次生成就把
//  兼容性和规划章节冲掉了。
//

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARKET_ROOT = path.resolve(HERE, '..');
const API_DIR = path.join(MARKET_ROOT, 'docs', 'api');
const SNAPSHOT = path.join(API_DIR, 'capabilities.snapshot.json');

// ---------------------------------------------------------------------------
// 0. 命名空间分组
// ---------------------------------------------------------------------------
// 唯一手工维护的映射：命名空间 -> 文档分组。故意不放进 Swift（那是宿主的实现关注点，
// 不是文档编排关注点）。为了防止它悄悄过期，未分组的命名空间会让生成器**硬失败**：
// 新增一条能力时必须来这里分一次组，这是「新能力必须同批落文档」闸门的一部分。

const GROUPS = [
  {
    id: 'container',
    title: '容器内建',
    blurb: '小应用平台内核。只碰 applet 自己的沙箱与声明合同，manifest 无需重复声明（`storage` / `net` / `ai` 走各自的权限位）。',
  },
  {
    id: 'shell',
    title: '应用级外壳',
    blurb: '让小应用长得像一个 App：原生 Tab、导航栏、弹框、选择器、反馈。身份静态声明在 manifest，运行时只改显示状态。',
  },
  {
    id: 'system',
    title: '系统能力投影',
    blurb: '把宿主模块与系统能力投影成一等 `aibox.*` API。**能力缺席时整条命名空间不注册**——先探测再渲染入口。',
  },
  {
    id: 'gateway',
    title: '长尾工具网关',
    blurb: '没有被升格为一等 API 的宿主工具，统一经此发现和调用。',
  },
];

const NAMESPACE_GROUP = {
  // 容器内建
  storage: 'container', net: 'container', ai: 'container', access: 'container',
  lifecycle: 'container', action: 'container', resource: 'container', db: 'container',
  apps: 'container', jobs: 'container', chat: 'container', data: 'container',
  // 应用级外壳
  scene: 'shell', navigation: 'shell', menu: 'shell', tabs: 'shell', toolbar: 'shell',
  overlay: 'shell',
  ui: 'shell', picker: 'shell', toast: 'shell', haptics: 'shell', list: 'shell',
  // 系统能力投影
  browser: 'system', clipboard: 'system', device: 'system', media: 'system',
  open: 'system', share: 'system', tts: 'system', audio: 'system', speech: 'system',
  health: 'system', notifications: 'system', location: 'system', calendar: 'system',
  reminders: 'system', contacts: 'system', photos: 'system', files: 'system',
  music: 'system', voiceMemos: 'system', shortcuts: 'system', download: 'system',
  video: 'system', secrets: 'system',
  // 长尾工具网关
  tools: 'gateway',
};

const EFFECTS = {
  read: { label: '读取', hint: '只读，不改任何状态；不触发用户确认。' },
  localWrite: { label: '本地写', hint: '改本机数据或系统状态；首次使用会弹一次授权。' },
  external: { label: '外发', hint: '发往网络或模型；有配额与失败分支，必须有兜底。' },
  presentation: { label: '呈现', hint: '弹出原生界面或播放；需要可见的 applet 运行时。' },
  meta: { label: '元操作', hint: '改容器自身的声明或路由，不碰宿主数据。' },
};

// ---------------------------------------------------------------------------
// 1. Swift 字面量扫描器
// ---------------------------------------------------------------------------
// 不用正则直接抓 descriptor 的原因：parametersJSON 是 `#"{...}"#` 原始字符串，里面全是
// 花括号、引号和逗号。必须先有一个能跳过字符串与注释的扫描器，再谈「平衡括号」和「顶层逗号」。

/** 从 i 处尝试读一个 Swift 字符串字面量（支持 #"..."# 原始字符串与 """ 多行）。 */
function readString(src, i) {
  let hashes = 0;
  let j = i;
  while (src[j] === '#') { hashes++; j++; }
  if (src[j] !== '"') return null;

  const pad = '#'.repeat(hashes);
  // 多行 """
  if (src.startsWith('"""', j)) {
    const close = `"""${pad}`;
    const start = j + 3;
    const end = src.indexOf(close, start);
    if (end < 0) return null;
    return { value: src.slice(start, end), end: end + close.length };
  }

  j += 1;
  let out = '';
  while (j < src.length) {
    const ch = src[j];
    // 原始字符串里转义符是 \# * n，普通字符串里是 \
    const escape = pad ? `\\${pad}` : '\\';
    if (src.startsWith(escape, j)) {
      const code = src[j + escape.length];
      const map = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', '"': '"', "'": "'" };
      if (code in map) { out += map[code]; j += escape.length + 1; continue; }
      if (code === '(') { // 插值：原样保留占位，descriptor 里不该出现
        const close = matchDelimiter(src, j + escape.length, '(', ')');
        out += '${…}';
        j = close + 1;
        continue;
      }
      out += code; j += escape.length + 1; continue;
    }
    if (ch === '"' && src.startsWith(`"${pad}`, j)) {
      return { value: out, end: j + 1 + pad.length };
    }
    out += ch; j += 1;
  }
  return null;
}

/** 从 open 分隔符处出发，返回配对 close 的下标。跳过字符串与注释。 */
function matchDelimiter(src, openIndex, open, close) {
  let depth = 0;
  let i = openIndex;
  while (i < src.length) {
    const skipped = skipTrivia(src, i);
    if (skipped !== i) { i = skipped; continue; }
    const str = readString(src, i);
    if (str) { i = str.end; continue; }
    const ch = src[i];
    if (ch === open) depth += 1;
    else if (ch === close) { depth -= 1; if (depth === 0) return i; }
    i += 1;
  }
  throw new Error(`未闭合的 ${open}（起点 ${openIndex}）`);
}

/** 跳过空白与注释；返回新的下标（没跳过就原样返回）。 */
function skipTrivia(src, i) {
  if (src.startsWith('//', i)) {
    const nl = src.indexOf('\n', i);
    return nl < 0 ? src.length : nl;
  }
  if (src.startsWith('/*', i)) {
    let depth = 0; let j = i;
    while (j < src.length) {
      if (src.startsWith('/*', j)) { depth += 1; j += 2; continue; }
      if (src.startsWith('*/', j)) { depth -= 1; j += 2; if (!depth) return j; continue; }
      j += 1;
    }
    return src.length;
  }
  return i;
}

/**
 * 跳过注释与字符串，找出第一个 ch 的下标。
 * 必须这样找而不是 indexOf：descriptor 前面的中文注释里有 `aibox.capabilities()` 这种
 * 带 ASCII 括号的内容，裸 indexOf('(') 会命中注释，进而把整条能力解析丢掉。
 */
function findDelimiter(text, ch, from = 0) {
  let i = from;
  while (i < text.length) {
    const skipped = skipTrivia(text, i);
    if (skipped !== i) { i = skipped; continue; }
    const str = readString(text, i);
    if (str) { i = str.end; continue; }
    if (text[i] === ch) return i;
    i += 1;
  }
  return -1;
}

/** 把注释替换成等长空白，字符串原样保留——让后续正则搜索不会命中注释。 */
function maskComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const skipped = skipTrivia(src, i);
    if (skipped !== i) {
      out += src.slice(i, skipped).replace(/[^\n]/g, ' ');
      i = skipped;
      continue;
    }
    const str = readString(src, i);
    if (str) { out += src.slice(i, str.end); i = str.end; continue; }
    out += src[i];
    i += 1;
  }
  return out;
}

/** 按顶层逗号切分一段参数/元素文本。 */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const skipped = skipTrivia(text, i);
    if (skipped !== i) { i = skipped; continue; }
    const str = readString(text, i);
    if (str) { i = str.end; continue; }
    const ch = text[i];
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
    i += 1;
  }
  const tail = text.slice(start);
  if (tail.trim()) parts.push(tail);
  return parts;
}

/** 把 `label: value` 的参数列表解析成 { label: rawValueText }。 */
function parseArgs(argText) {
  const out = {};
  for (const part of splitTopLevel(argText)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(part);
    if (!m) continue;
    out[m[1]] = part.slice(m.index + m[0].length).trim();
  }
  return out;
}

/**
 * 求值一个 Swift 表达式文本（只支持 descriptor 里实际出现的形态）：
 * 字符串字面量、`.enumCase`、`nil`、以及指向同文件常量的标识符（如 MediaCapabilityAdapter 的 idSchema）。
 */
function evalExpr(text, symbols = {}) {
  if (text == null) return null;
  const t = text.trim();
  if (!t || t === 'nil') return null;
  const str = readString(t, 0);
  if (str && str.end >= t.length) return str.value;
  if (t.startsWith('.')) return t.slice(1).trim();
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t) && t in symbols) return symbols[t];
  // `Self.snapshotSchema` / `MediaCapabilityAdapter.idSchema` —— 带类型限定的同文件常量。
  // 不解开会把标识符原文当成 schema 写进快照（`"parametersJSON": "Self.snapshotSchema"`），
  // 文档里就变成一句「schema 无法解析」，且没有任何闸门看得出来。
  const qualified = /^[A-Za-z_][A-Za-z0-9_]*\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(t);
  if (qualified && qualified[1] in symbols) return symbols[qualified[1]];
  return t;
}

/** 收集同文件里可被 descriptor 引用的字符串常量。 */
function collectSymbols(src) {
  const symbols = {};
  // let namespace = "media"  /  public let namespace = "clipboard"
  const simple = /(?:^|\n)\s*(?:public\s+|private\s+|fileprivate\s+|internal\s+)?(?:static\s+)?let\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*String\s*)?=\s*(#*")/g;
  for (let m; (m = simple.exec(src));) {
    const str = readString(src, m.index + m[0].length - m[2].length);
    if (str) symbols[m[1]] = str.value;
  }
  // private var idSchema: String { #"..."# }
  const computed = /(?:^|\n)\s*(?:public\s+|private\s+|fileprivate\s+|internal\s+)?(?:static\s+)?var\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*String\s*\{\s*(#*")/g;
  for (let m; (m = computed.exec(src));) {
    const str = readString(src, m.index + m[0].length - m[2].length);
    if (str) symbols[m[1]] = str.value;
  }
  return symbols;
}

// ---------------------------------------------------------------------------
// 2. descriptor 抽取
// ---------------------------------------------------------------------------

/** 解析一个 AppletCapabilityMethodDescriptor 的 `.init(...)` 文本。 */
function parseMethod(text, symbols, source) {
  const open = findDelimiter(text, '(');
  if (open < 0) return null;
  const close = matchDelimiter(text, open, '(', ')');
  const args = parseArgs(text.slice(open + 1, close));
  const name = evalExpr(args.name, symbols);
  if (!name) return null;
  return {
    name,
    summary: evalExpr(args.summary, symbols) ?? '',
    parametersJSON: evalExpr(args.parametersJSON, symbols) ?? '{}',
    resultSummary: evalExpr(args.resultSummary, symbols) ?? 'unknown',
    effect: evalExpr(args.effect, symbols) ?? 'read',
    example: evalExpr(args.example, symbols),
    source,
  };
}

/** 解析一个 AppletCapabilityDescriptor 的参数区，得到 { namespace, summary, methods }。 */
function parseDescriptorArgs(argText, symbols, source) {
  const args = parseArgs(argText);
  const namespace = evalExpr(args.namespace, symbols);
  if (!namespace) return null;
  const methods = [];
  if (args.methods) {
    const raw = args.methods.trim();
    const open = findDelimiter(raw, '[');
    if (open >= 0) {
      const close = matchDelimiter(raw, open, '[', ']');
      for (const el of splitTopLevel(raw.slice(open + 1, close))) {
        const parsed = parseMethod(el, symbols, source);
        if (parsed) methods.push(parsed);
      }
    }
  }
  return {
    namespace,
    summary: evalExpr(args.summary, symbols) ?? '',
    methods,
    source,
    kind: 'descriptor',
  };
}

/** 找出 `名字 = [` 之后那段数组文本。 */
function arrayLiteralAfter(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) return null;
  const open = findDelimiter(src, '[', at + marker.length - 1);
  if (open < 0) return null;
  const close = matchDelimiter(src, open, '[', ']');
  return src.slice(open + 1, close);
}

/** AppletCapabilityCatalog.builtIns —— 桥内建能力。 */
function extractBuiltIns(src, source) {
  const body = arrayLiteralAfter(src, 'static let builtIns: [AppletCapabilityDescriptor] = [');
  if (!body) throw new Error('没找到 AppletCapabilityCatalog.builtIns');
  const symbols = collectSymbols(src);
  const out = [];
  for (const el of splitTopLevel(body)) {
    const open = findDelimiter(el, '(');
    if (open < 0) continue;
    const close = matchDelimiter(el, open, '(', ')');
    const parsed = parseDescriptorArgs(el.slice(open + 1, close), symbols, source);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** 从 builtIns 所在文件里顺带取两个声明门集合。 */
function extractDeclarationSets(src) {
  const readStringArray = (marker) => {
    const body = arrayLiteralAfter(src, marker);
    if (!body) return [];
    return splitTopLevel(body)
      .map((s) => evalExpr(s, {}))
      .filter((s) => s && /^[A-Za-z]+$/.test(s));
  };
  return {
    declarable: readStringArray('static let declarableExtensionNamespaces: [String] = ['),
    alwaysAvailable: readStringArray('static let alwaysAvailableNamespaces: Set<String> = ['),
  };
}

/** 单个 *CapabilityAdapter.swift 里的 descriptor 属性。 */
function extractAdapterDescriptor(src, source) {
  const symbols = collectSymbols(src);
  // 支持两种写法：`let descriptor = AppletCapabilityDescriptor(...)` 与
  // `var descriptor: AppletCapabilityDescriptor { .init(...) }`
  const decl = /(?:^|\n)\s*(?:public\s+|private\s+|internal\s+)?(?:let|var)\s+descriptor\s*(?::\s*AppletCapabilityDescriptor\s*)?(?:=|\{)/.exec(src);
  if (!decl) return null;
  const from = decl.index + decl[0].length;
  const call = /AppletCapabilityDescriptor\s*\(|\.init\s*\(/.exec(src.slice(from));
  if (!call) return null;
  const openRel = call.index + call[0].length - 1;
  const open = from + openRel;
  const close = matchDelimiter(src, open, '(', ')');
  return parseDescriptorArgs(src.slice(open + 1, close), symbols, source);
}

/** AppletStandardCapabilityProjections.catalog —— 一等系统能力投影。 */
function extractProjections(src, source) {
  const body = arrayLiteralAfter(src, 'static let catalog: [AppletStandardCapabilityProjectionGroup] = [');
  if (!body) return [];
  const symbols = collectSymbols(src);
  const out = [];
  for (const el of splitTopLevel(body)) {
    const open = findDelimiter(el, '(');
    if (open < 0) continue;
    const close = matchDelimiter(el, open, '(', ')');
    const args = parseArgs(el.slice(open + 1, close));
    const namespace = evalExpr(args.namespace, symbols);
    if (!namespace) continue;
    const methods = [];
    const raw = (args.projections || '').trim();
    const aOpen = findDelimiter(raw, '[');
    if (aOpen >= 0) {
      const aClose = matchDelimiter(raw, aOpen, '[', ']');
      for (const p of splitTopLevel(raw.slice(aOpen + 1, aClose))) {
        const pOpen = findDelimiter(p, '(');
        if (pOpen < 0) continue;
        const pClose = matchDelimiter(p, pOpen, '(', ')');
        const pArgs = parseArgs(p.slice(pOpen + 1, pClose));
        const name = evalExpr(pArgs.method, symbols);
        if (!name) continue;
        methods.push({
          name,
          summary: '',
          parametersJSON: null, // 运行时取真实 ToolDefinition.parametersJSON
          resultSummary: '{ok, text, permission, details?, progress, artifacts}',
          effect: evalExpr(pArgs.effect, symbols) ?? 'read',
          example: evalExpr(pArgs.example, symbols),
          toolName: evalExpr(pArgs.toolName, symbols),
          source,
        });
      }
    }
    out.push({
      namespace,
      summary: evalExpr(args.summary, symbols) ?? '',
      methods,
      source,
      kind: 'projection',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. extract：Swift -> snapshot
// ---------------------------------------------------------------------------

function hostPaths(hostRoot) {
  const kit = path.join(hostRoot, 'Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime');
  return {
    kit,
    catalog: path.join(kit, 'AppletCapabilityAdapter.swift'),
    capabilities: path.join(kit, 'Capabilities'),
    projection: path.join(kit, 'Capabilities/HostToolProjectionCapabilityAdapter.swift'),
  };
}

function hostSourcesAvailable(hostRoot) {
  return fs.existsSync(hostPaths(hostRoot).catalog);
}

function extract(hostRoot) {
  const p = hostPaths(hostRoot);
  const rel = (abs) => path.relative(hostRoot, abs);

  // 先把注释抹成等长空白：后面的正则搜索（descriptor 声明、常量表）就不会命中注释里的
  // `let descriptor` / `.init(` 之类的文字。字符串字面量原样保留，取值不受影响。
  const read = (abs) => maskComments(fs.readFileSync(abs, 'utf8'));

  const catalogSrc = read(p.catalog);
  const namespaces = extractBuiltIns(catalogSrc, rel(p.catalog));
  const sets = extractDeclarationSets(catalogSrc);

  const files = fs.readdirSync(p.capabilities).filter((f) => f.endsWith('.swift')).sort();
  for (const file of files) {
    const abs = path.join(p.capabilities, file);
    const src = read(abs);
    if (file === 'HostToolProjectionCapabilityAdapter.swift') {
      namespaces.push(...extractProjections(src, rel(abs)));
      continue;
    }
    const parsed = extractAdapterDescriptor(src, rel(abs));
    if (parsed) namespaces.push(parsed);
  }

  namespaces.sort((a, b) => a.namespace.localeCompare(b.namespace));

  const unknown = namespaces.map((n) => n.namespace).filter((n) => !(n in NAMESPACE_GROUP));
  if (unknown.length) {
    throw new Error(
      `以下命名空间还没有分组：${unknown.join(', ')}\n` +
      `请在 scripts/gen-api-docs.mjs 的 NAMESPACE_GROUP 里给它分一组（容器内建 / 应用级外壳 / 系统能力投影 / 长尾工具网关），\n` +
      `并补上 docs/api/<namespace>.md 的兼容性与规划两段手写增补。`);
  }

  return {
    // 生成器契约版本：渲染逻辑变了就 +1，好让 --check 的失败原因可解释。
    generator: 2,
    namespaces: namespaces.map((n) => ({ ...n, group: NAMESPACE_GROUP[n.namespace] })),
    declarable: sets.declarable,
    alwaysAvailable: sets.alwaysAvailable,
  };
}

// ---------------------------------------------------------------------------
// 4. render：snapshot -> Markdown
// ---------------------------------------------------------------------------

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();

function schemaType(v) {
  if (!v || typeof v !== 'object') return 'any';
  if (Array.isArray(v.enum)) return v.enum.map((x) => `\`${x}\``).join(' \\| ');
  if (!v.type) return Object.keys(v).length ? 'object' : 'any';
  const t = Array.isArray(v.type) ? v.type.join(' \\| ') : v.type;
  if (t === 'array') {
    const it = v.items;
    if (it && Array.isArray(it.enum)) return `(${it.enum.map((x) => `\`${x}\``).join(' \\| ')})[]`;
    if (it && it.type) return `${it.type}[]`;
    return 'array';
  }
  if (t === 'object' && v.additionalProperties && typeof v.additionalProperties === 'object') {
    return 'object<string, object>';
  }
  return t;
}

function schemaDesc(v) {
  if (!v || typeof v !== 'object') return '';
  const bits = [];
  if (v.description) bits.push(v.description);
  const c = [];
  if (v.minimum !== undefined) c.push(`最小 ${v.minimum}`);
  if (v.maximum !== undefined) c.push(`最大 ${v.maximum}`);
  if (v.minLength !== undefined) c.push(`最短 ${v.minLength}`);
  if (v.maxLength !== undefined) c.push(`最长 ${v.maxLength}`);
  if (v.maxItems !== undefined) c.push(`最多 ${v.maxItems} 项`);
  if (v.default !== undefined) c.push(`默认 ${JSON.stringify(v.default)}`);
  if (c.length) bits.push(`（${c.join('、')}）`);
  return bits.join(' ');
}

function collectRows(schema, prefix, rows, depth) {
  const required = new Set(schema.required || []);
  const props = schema.properties || {};
  for (const [key, value] of Object.entries(props)) {
    const p = prefix ? `${prefix}.${key}` : key;
    rows.push({ path: p, type: schemaType(value), required: required.has(key), desc: schemaDesc(value) });
    if (depth >= 2 || !value || typeof value !== 'object') continue;
    if (value.type === 'object' && value.properties) collectRows(value, p, rows, depth + 1);
    else if (value.type === 'array' && value.items && value.items.properties) collectRows(value.items, `${p}[]`, rows, depth + 1);
    else if (value.type === 'object' && value.additionalProperties && value.additionalProperties.properties) {
      collectRows(value.additionalProperties, `${p}.<key>`, rows, depth + 1);
    }
  }
}

function renderParams(parametersJSON, toolName) {
  if (parametersJSON == null) {
    return toolName
      ? `参数取自宿主工具 \`${toolName}\` 的真实 \`ToolDefinition.parametersJSON\`，随宿主版本变化。\n` +
        `写代码前用 \`await aibox.capabilities()\` 或 \`applet_read action=capabilities\` 读当前 schema。`
      : '参数 schema 在运行时决定。';
  }
  let schema;
  try { schema = JSON.parse(parametersJSON); } catch { return '_(schema 无法解析，请检查宿主源码)_'; }
  if (!schema || !schema.properties || !Object.keys(schema.properties).length) return '无参数。';
  const rows = [];
  collectRows(schema, '', rows, 0);
  if (!rows.length) return '无参数。';
  const head = '| 参数 | 类型 | 必填 | 说明 |\n|---|---|:--:|---|';
  const body = rows
    .map((r) => `| \`${r.path}\` | ${r.type} | ${r.required ? '✓' : '' } | ${esc(r.desc)} |`)
    .join('\n');
  const strict = schema.additionalProperties === false ? '\n\n未列出的字段会被拒绝（`additionalProperties: false`）。' : '';
  return `${head}\n${body}${strict}`;
}

function renderMethod(ns, m) {
  const effect = EFFECTS[m.effect] || { label: m.effect, hint: '' };
  const lines = [];
  lines.push(`### \`aibox.${ns}.${m.name}()\``);
  lines.push('');
  if (m.summary) lines.push(m.summary);
  else if (m.toolName) lines.push(`投影自宿主工具 \`${m.toolName}\`；摘要与参数以该工具的真实定义为准。`);
  lines.push('');
  lines.push(`**副作用档位** \`${m.effect}\`（${effect.label}）— ${effect.hint}`);
  lines.push('');
  lines.push('**参数**');
  lines.push('');
  lines.push(renderParams(m.parametersJSON, m.toolName));
  lines.push('');
  lines.push(`**返回** \`${m.resultSummary}\``);
  if (m.example) {
    lines.push('');
    lines.push('```js');
    lines.push(m.example);
    lines.push('```');
  }
  return lines.join('\n');
}

function availabilityLine(ns, snap) {
  if (snap.alwaysAvailable.includes(ns)) {
    return '容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。';
  }
  if (snap.declarable.includes(ns)) {
    return `需要在 \`manifest.permissions.capabilities\` 里声明 \`"${ns}"\`。**声明 ≠ 授权**，用户仍会被逐项询问。`;
  }
  if (ns === 'storage') return '需要 `manifest.permissions.storage: true`。';
  if (ns === 'net') return '需要 `manifest.permissions.network: true` 加 `networkAllowed` 精确域名白名单。';
  if (ns === 'ai') return '需要 `manifest.permissions.ai: true`；按 applet 计量配额。';
  return '声明要求见宿主 manifest 定义。';
}

const MANUAL_RE = /<!-- MANUAL:BEGIN (\S+) -->\n?([\s\S]*?)\n?<!-- MANUAL:END \1 -->/g;

function readManual(file) {
  if (!fs.existsSync(file)) return {};
  const src = fs.readFileSync(file, 'utf8');
  const out = {};
  for (let m; (m = MANUAL_RE.exec(src));) out[m[1]] = m[2];
  return out;
}

function manualBlock(key, existing, seed) {
  const body = existing[key] !== undefined ? existing[key] : seed;
  return `<!-- MANUAL:BEGIN ${key} -->\n${body}\n<!-- MANUAL:END ${key} -->`;
}

const SEED_COMPAT = `> **待补**。请写清楚：起始宿主版本、可用 surface（page/fullscreen/sheet/drawer/card/headless）、
> 宿主变体（Full/Lean）、manifest 声明要求、iOS 系统授权，以及**能力缺席时的降级行为**。`;

const SEED_ROADMAP = `> **待补**。从主仓库 \`docs/capabilities/applet/framework-capabilities.md\` 的 P0/P1/P2
> 分级里摘取与本能力相关的条目，并链接回去。没有已知缺口就写「暂无已知缺口」。`;

function renderNamespace(entry, snap) {
  const ns = entry.namespace;
  const file = path.join(API_DIR, `${ns}.md`);
  const existing = readManual(file);
  const group = GROUPS.find((g) => g.id === entry.group);

  const out = [];
  out.push(`# \`aibox.${ns}\``);
  out.push('');
  out.push(`> ${entry.summary || `\`${ns}\` 能力。`}`);
  out.push('');
  out.push(`**分组** ${group.title} ｜ **方法数** ${entry.methods.length} ｜ **声明要求** ${availabilityLine(ns, snap)}`);
  out.push('');
  out.push('<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->');
  out.push('');
  out.push('## API');
  out.push('');
  if (entry.kind === 'projection') {
    out.push(`本命名空间由 \`HostToolProjectionCapabilityAdapter\` 把宿主 AgentTool 升格而成：参数 schema 直接取真实`);
    out.push(`\`ToolDefinition\`，执行仍走同一个 ToolRunner（consent、超时、系统权限一个都不少）。`);
    out.push(`**宿主没装对应模块时，整条命名空间不注册**——不会广告假能力。`);
    out.push('');
    out.push('| 方法 | 背后的宿主工具 | 档位 |');
    out.push('|---|---|---|');
    for (const m of entry.methods) {
      out.push(`| \`${m.name}\` | \`${m.toolName}\` | \`${m.effect}\` |`);
    }
    out.push('');
  }
  for (const m of entry.methods) {
    out.push(renderMethod(ns, m));
    out.push('');
  }
  out.push(`**真值来源** \`${entry.source}\``);
  out.push('');
  out.push('<!-- GENERATED:END -->');
  out.push('');
  out.push('## 兼容性');
  out.push('');
  out.push(manualBlock('compat', existing, SEED_COMPAT));
  out.push('');
  out.push('## 接下来的规划');
  out.push('');
  out.push(manualBlock('roadmap', existing, SEED_ROADMAP));
  out.push('');
  out.push('---');
  out.push('');
  out.push('[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`');
  out.push('');
  return { file, content: out.join('\n') };
}

function renderIndex(snap) {
  const file = path.join(API_DIR, 'README.md');
  const existing = readManual(file);
  const out = [];

  out.push('# 小应用桥接 API 参考');
  out.push('');
  out.push('写小应用时查这里：每个 `aibox.<namespace>` 一篇，含方法签名、参数表、副作用档位、可直接抄的示例，');
  out.push('外加人工维护的兼容性与规划。');
  out.push('');
  out.push('- 第一次写小应用？先读 [入门指南](../authoring-guide.md)（运行时约束、起步、发布流程）。');
  out.push('- 想理解协议本身（JSON-RPC 形状、权限模型、版本规则）？读主仓库 `docs/capabilities/applet/platform-protocol.md`。');
  out.push('- 应用内还有一份**按当前宿主实际安装能力生成**的 `.aibox/aibox.d.ts`；跑在真机上时它比本文档更准。');
  out.push('');
  out.push('<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 生成，请勿手改 -->');
  out.push('');

  const totalMethods = snap.namespaces.reduce((n, e) => n + e.methods.length, 0);
  out.push(`当前宿主共 **${snap.namespaces.length}** 个命名空间、**${totalMethods}** 个方法。`);
  out.push('');

  for (const group of GROUPS) {
    const entries = snap.namespaces.filter((e) => e.group === group.id);
    if (!entries.length) continue;
    out.push(`## ${group.title}`);
    out.push('');
    out.push(group.blurb);
    out.push('');
    out.push('| 命名空间 | 说明 | 方法 | 声明 |');
    out.push('|---|---|:--:|---|');
    for (const e of entries) {
      const badge = snap.alwaysAvailable.includes(e.namespace)
        ? '恒可用'
        : snap.declarable.includes(e.namespace)
          ? `需声明 \`${e.namespace}\``
          : e.namespace === 'net' ? '需 `network`'
            : e.namespace === 'ai' ? '需 `ai`'
              : e.namespace === 'storage' ? '需 `storage`' : '—';
      out.push(`| [\`aibox.${e.namespace}\`](${e.namespace}.md) | ${esc(e.summary)} | ${e.methods.length} | ${badge} |`);
    }
    out.push('');
  }

  out.push('### 副作用档位');
  out.push('');
  out.push('| 档位 | 含义 |');
  out.push('|---|---|');
  for (const [key, v] of Object.entries(EFFECTS)) {
    out.push(`| \`${key}\` | **${v.label}** — ${v.hint} |`);
  }
  out.push('');
  out.push('<!-- GENERATED:END -->');
  out.push('');
  out.push('## 维护契约');
  out.push('');
  out.push('**descriptor 是唯一真值，本目录是它的投影。**（主仓库 `docs/capabilities/applet/framework-capabilities.md` §6 第 3 条）');
  out.push('');
  out.push('```bash');
  out.push('node scripts/gen-api-docs.mjs           # 重新生成');
  out.push('node scripts/gen-api-docs.mjs --check   # 校验漂移（CI 跑的就是这条）');
  out.push('```');
  out.push('');
  out.push('新增或修改一条宿主能力时：');
  out.push('');
  out.push('1. 在宿主侧改 `AppletCapabilityDescriptor`（`AppletCapabilityCatalog.builtIns`、各 `*CapabilityAdapter.descriptor`，或 `AppletStandardCapabilityProjections.catalog`）。');
  out.push('2. 在市场仓库跑 `node scripts/gen-api-docs.mjs`，把 `docs/api/` 的改动一起提交。');
  out.push('3. 新命名空间会让生成器**硬失败**，直到你在 `scripts/gen-api-docs.mjs` 的 `NAMESPACE_GROUP` 里给它分组——这是故意的，逼你顺手把文档补齐。');
  out.push('4. 填掉新文件里「兼容性」与「接下来的规划」两段的待补占位。');
  out.push('');
  out.push('### 手写增补写在哪');
  out.push('');
  out.push('每篇文档里这两段之间的内容**归人维护，生成器不会覆盖**：');
  out.push('');
  out.push('```md');
  out.push('<!-- MANUAL:BEGIN compat -->   ... 兼容性 ...    <!-- MANUAL:END compat -->');
  out.push('<!-- MANUAL:BEGIN roadmap -->  ... 规划 ...      <!-- MANUAL:END roadmap -->');
  out.push('```');
  out.push('');
  out.push('`<!-- GENERATED:BEGIN -->` … `<!-- GENERATED:END -->` 之间的内容则相反：手改一定会被下次生成冲掉，CI 也会先一步拦住。');
  out.push('');
  out.push('### CI 怎么卡的');
  out.push('');
  out.push('市场是独立仓库，CI 里没有宿主 Swift 源码，所以校验分两段：');
  out.push('');
  out.push('| 场景 | `--check` 做什么 |');
  out.push('|---|---|');
  out.push('| 本地（宿主源码在场） | Swift → snapshot → Markdown 全链校验，能抓「宿主改了能力但没重新生成」 |');
  out.push('| CI（只有市场仓库） | snapshot → Markdown 校验，能抓「有人手改了生成内容」或「漏提交 snapshot」 |');
  out.push('');
  out.push('`capabilities.snapshot.json` 是这两段之间的中间产物，**必须跟文档一起提交**。');
  out.push('');
  out.push(manualBlock('notes', existing, '<!-- 额外的索引级说明写在这里；生成器不会覆盖。 -->'));
  out.push('');
  return { file, content: out.join('\n') };
}

function render(snap) {
  const files = [renderIndex(snap)];
  for (const entry of snap.namespaces) files.push(renderNamespace(entry, snap));
  return files;
}

// ---------------------------------------------------------------------------
// 5. CLI
// ---------------------------------------------------------------------------

function snapshotText(snap) {
  return `${JSON.stringify(snap, null, 2)}\n`;
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const hostArg = argv.find((a) => a.startsWith('--host-root='));
  const hostRoot = path.resolve(hostArg ? hostArg.split('=')[1] : path.join(MARKET_ROOT, '..'));

  const haveHost = hostSourcesAvailable(hostRoot);
  const problems = [];
  let snap;

  if (haveHost) {
    snap = extract(hostRoot);
    const text = snapshotText(snap);
    if (check) {
      const old = fs.existsSync(SNAPSHOT) ? fs.readFileSync(SNAPSHOT, 'utf8') : null;
      if (old !== text) problems.push(`capabilities.snapshot.json 与宿主 descriptor 不一致`);
    } else {
      fs.mkdirSync(API_DIR, { recursive: true });
      fs.writeFileSync(SNAPSHOT, text);
    }
  } else {
    if (!fs.existsSync(SNAPSHOT)) {
      console.error(`找不到宿主源码（${hostRoot}），也没有 ${path.relative(MARKET_ROOT, SNAPSHOT)}。`);
      console.error('在能访问宿主仓库的机器上先跑一次 node scripts/gen-api-docs.mjs。');
      process.exit(2);
    }
    snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  }

  const files = render(snap);
  fs.mkdirSync(API_DIR, { recursive: true });

  let written = 0;
  for (const { file, content } of files) {
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (check) {
      if (old !== content) problems.push(`${path.relative(MARKET_ROOT, file)} 与 descriptor 不一致`);
    } else if (old !== content) {
      fs.writeFileSync(file, content);
      written += 1;
    }
  }

  // 命名空间被删掉时，残留文件也算漂移。
  const expected = new Set(files.map((f) => path.basename(f.file)));
  expected.add(path.basename(SNAPSHOT));
  const stray = fs.existsSync(API_DIR)
    ? fs.readdirSync(API_DIR).filter((f) => (f.endsWith('.md') || f.endsWith('.json')) && !expected.has(f))
    : [];
  for (const f of stray) problems.push(`docs/api/${f} 是残留文件（对应的能力已从宿主移除）`);

  const mode = haveHost ? '完整（Swift → snapshot → Markdown）' : '仅渲染（snapshot → Markdown；宿主源码不在场）';

  if (check) {
    if (problems.length) {
      console.error(`API 文档漂移检查失败 [${mode}]：\n`);
      for (const p of problems) console.error(`  ✗ ${p}`);
      console.error('\n修法：在能访问宿主仓库的机器上跑 node scripts/gen-api-docs.mjs，然后提交 docs/api/ 的改动。');
      process.exit(1);
    }
    console.log(`API 文档与 descriptor 一致 [${mode}]：${snap.namespaces.length} 个命名空间、${files.length} 个文件。`);
    return;
  }

  const methods = snap.namespaces.reduce((n, e) => n + e.methods.length, 0);
  console.log(`模式：${mode}`);
  console.log(`命名空间 ${snap.namespaces.length} 个、方法 ${methods} 个 → docs/api/`);
  console.log(`写入 ${written} / ${files.length} 个文件（未变化的不动）。`);
  if (stray.length) {
    console.log(`\n注意：以下文件已无对应能力，请手动删除：`);
    for (const f of stray) console.log(`  - docs/api/${f}`);
  }
}

main();
