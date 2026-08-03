// 构建收尾：把全局类型文件搬进 dist，并**把 triple-slash 引用重新写回 dist/index.d.ts**。
//
// 为什么需要这一步：`aibox-global.d.ts` 是 global script（没有顶层 import/export），tsc 认为
// 它与 index.ts 之间没有模块依赖，于是**不会**把 src 里那条 `/// <reference path=…>` emit 到
// 产物的 .d.ts 里。结果是 SDK 装上后 `window.aibox` / `aibox.storage` 一律 "does not exist"——
// 类型全量丢失，而且丢得静默（SDK 自身编译是绿的，因为 src 里那条引用有效）。
// 2026-08-03 在迁移 com.aibox.news 时才发现，故补一条硬保证并加自检。
import fs from 'node:fs';

const GLOBAL = 'generated/aibox-global.d.ts';
const REFERENCE = `/// <reference path="./${GLOBAL}" />\n`;

fs.mkdirSync('dist/generated', { recursive: true });
fs.copyFileSync(`src/${GLOBAL}`, `dist/${GLOBAL}`);

const entry = 'dist/index.d.ts';
const current = fs.readFileSync(entry, 'utf8');
if (!current.includes(`reference path="./${GLOBAL}"`)) {
  fs.writeFileSync(entry, REFERENCE + current, 'utf8');
}

// 自检：产物里必须同时有全局类型文件与指向它的引用，否则整包类型等于没有。
const emitted = fs.readFileSync(entry, 'utf8');
if (!fs.existsSync(`dist/${GLOBAL}`) || !emitted.startsWith('/// <reference')) {
  console.error('✗ dist/index.d.ts 缺少全局类型引用 —— 消费者会丢掉全部 aibox.* 类型');
  process.exit(1);
}
console.log('✓ SDK 全局类型已随产物发布');
