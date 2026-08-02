import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { EXTERNAL_MODULES, FORBIDDEN_MODULES, RUNTIME_MODULE_URLS } from './lib/runtime-modules.mjs';
import { aiboxManifest } from './lib/manifest-plugin.mjs';

//
//  @aibox/applet-vite
//  小应用的 Vite 预设：一行拿到「产物可直接被宿主加载」的正确配置。
//
//  ## 为什么不是普通 Vite 配置
//  宿主运行环境有四条硬约束，配错任何一条都是白屏而不是报错：
//   ① react / react-dom / react-dom/client / react/jsx-runtime / antd-mobile / chart.js / aibox/ui
//      **恒为 external**。它们由宿主随运行时资产提供、经 import map 解析。打进产物会得到
//      **两份 React 实例**（宿主 antd-mobile 用宿主那份，你的组件用你那份）→ hooks 立刻炸。
//   ② 产物必须是 **ESM**，且入口能被 `<script type="module">` 直接 import。
//   ③ 资源路径必须是**相对**的（`base: './'`）。宿主伺服在 `applet://localhost/<appId>/`，
//      绝对路径 `/assets/x.js` 会跑到 `applet://localhost/assets/x.js` → 跨 appId → 404。
//   ④ 目标是 iOS 17 的 WKWebView。`target: 'safari17'`——更高的 target 会 emit iOS 17 不认的语法。
//
//  ## 产物形态
//  `dist/` 直接就是 bundle 根目录：`index.html` + `app.js`（+ 可选 css / chunk）。
//  `release.mjs` 打包 `dist/**` + `src/manifest.json`，宿主原样落盘、`entry: index.html` 命中。
//

export { EXTERNAL_MODULES, FORBIDDEN_MODULES, RUNTIME_MODULE_URLS } from './lib/runtime-modules.mjs';
export { aiboxManifest, renderActionTypes, checkManifest } from './lib/manifest-plugin.mjs';

/**
 * 产物自检插件：构建结束后扫一遍 emit 出来的 JS，确认
 *  · 该 external 的都 external 了（没有把 react 打进来）
 *  · 没有出现宿主解析不了的说明符（jsx-dev-runtime / chart.js/auto / 任意第三方 npm）
 *  · 没有残留绝对路径引用
 * 这是**构建期**闸门——比在真机上白屏再回头查便宜几个数量级。
 */
function aiboxVerifyOutput() {
  const allowed = new Set(EXTERNAL_MODULES);
  // 与 Swift AppletImportRules.specifiers 同款：行锚定，避开字符串字面量里的伪 import。
  // Rollup 产物 import 语句都在文件头部且各自成行。
  const FROM_RE = /(?:^|[\n;])\s*(?:import|export)\b[^\n]*?\bfrom\s*(['"])([^'"]+)\1/g;
  const SIDE_EFFECT_RE = /(?:^|[\n;])\s*import\s*(['"])([^'"]+)\1/g;
  const DYNAMIC_RE = /\bimport\(\s*(['"])([^'"]+)\1\s*\)/g;

  return {
    name: 'aibox:verify-output',
    generateBundle(_options, bundle) {
      const problems = [];
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const code = chunk.code;
        const specifiers = new Set();
        for (const re of [FROM_RE, SIDE_EFFECT_RE, DYNAMIC_RE]) {
          re.lastIndex = 0;
          let match;
          while ((match = re.exec(code)) !== null) specifiers.add(match[2]);
        }
        for (const specifier of specifiers) {
          if (specifier.startsWith('./') || specifier.startsWith('../')) continue;
          if (specifier.startsWith('applet://')) continue;
          if (FORBIDDEN_MODULES[specifier]) {
            problems.push(`${fileName} 引用了 '${specifier}'：${FORBIDDEN_MODULES[specifier]}`);
            continue;
          }
          if (specifier.startsWith('/')) {
            problems.push(`${fileName} 引用了绝对路径 '${specifier}'——宿主伺服在 applet://localhost/<appId>/ 下，绝对路径会跨出应用目录。设置 base: './'。`);
            continue;
          }
          if (!allowed.has(specifier)) {
            problems.push(
              `${fileName} 引用了宿主没有的模块 '${specifier}'。离线沙箱没有 npm/CDN；`
              + `可用的裸 import 只有：${EXTERNAL_MODULES.join(', ')}。要么自己实现，要么把它打进产物（从 external 里去掉）。`);
          }
        }
        // react 被打进产物的典型指纹：产物里出现 React 内部符号但没有 `from "react"`。
        if (!specifiers.has('react') && /\b__SECRET_INTERNALS_DO_NOT_USE|ReactCurrentDispatcher/.test(code)) {
          problems.push(`${fileName} 疑似把 React 打进了产物（出现 React 内部符号却没有 external import）——会导致双实例，hooks 立刻报错。`);
        }
      }
      if (problems.length > 0) {
        this.error(`产物自检未通过：\n  - ${problems.join('\n  - ')}`);
      }
    },
  };
}

/**
 * 小应用 Vite 配置。
 *
 * @param {object} [options]
 * @param {string} [options.entry='src/main.tsx']  入口（相对应用根）。
 * @param {boolean} [options.minify=false]         默认**不压缩**：真机上唯一的调试面是 console 与
 *   错误浮层里的堆栈，压缩后函数名全没了；小应用体积远在 8MB 预算之下，可读性更值钱。
 * @param {boolean|'inline'} [options.sourcemap=false] 默认**不出 sourcemap**：它会进包占预算、
 *   并把完整源码分发给每个装了这个应用的用户。要调试就临时 `--sourcemap` 本地构建一次。
 * @param {string[]} [options.external]            额外 external（默认只有宿主运行时那 7 个）。
 * @param {boolean} [options.checkGenerated=false] CI 模式：生成物不一致直接失败而不是覆写。
 * @param {import('vite').UserConfig} [options.vite] 直接合并进最终配置的逃生口。
 */
export function defineAppletConfig(options = {}) {
  const {
    entry = 'src/main.tsx',
    minify = false,
    sourcemap = false,
    external = [],
    checkGenerated = false,
    vite: overrides = {},
  } = options;

  const externals = [...new Set([...EXTERNAL_MODULES, ...external])];

  return {
    // 相对基址：宿主把应用伺服在 applet://localhost/<appId>/ 下。
    base: './',
    plugins: [
      aiboxManifest({ check: checkGenerated }),
      react({ jsxRuntime: 'automatic' }),
      aiboxVerifyOutput(),
      ...(overrides.plugins ?? []),
    ],
    define: {
      // antd-mobile / react 的 UMD 分支会读它；不定义会在产物里留下 `process is not defined`。
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      // iOS 17 = Safari 17。别调高：更高 target 会 emit WKWebView 不认的语法，且失败形态是白屏。
      target: 'safari17',
      outDir: 'dist',
      emptyOutDir: true,
      minify,
      sourcemap,
      cssCodeSplit: false,
      // 单入口单 chunk，modulepreload 没有收益，还会往 HTML 里塞 applet:// 的 preload 链接。
      modulePreload: false,
      // 小图标内联进 JS，省一次 scheme handler 往返；大资源仍单独出文件。
      assetsInlineLimit: 4096,
      rollupOptions: {
        // HTML 入口：Vite 会处理 index.html 里的 <script type="module" src="/src/main.tsx">，
        // 并把它改写成相对路径的产物引用。import map 与 CSS link 原样保留。
        input: 'index.html',
        external: externals,
        output: {
          format: 'es',
          // 固定文件名、不带 hash：宿主源码一律 no-store，缓存破坏没有意义；而固定名让
          // release 产物在版本间可 diff、审阅时能看出真实改动。
          entryFileNames: 'app.js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name][extname]',
        },
        ...(overrides.build?.rollupOptions ?? {}),
      },
      ...(overrides.build ?? {}),
    },
    esbuild: {
      // 保留函数名：不压缩时也显式声明，避免将来打开 minify 时堆栈突然变成 a/b/c。
      keepNames: true,
      ...(overrides.esbuild ?? {}),
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => !['plugins', 'build', 'esbuild'].includes(key))),
  };
}

/** 应用根目录下有没有构建工程（`release.mjs` 据此决定走构建流程还是老式源码流程）。 */
export function isBuildableApp(appDir) {
  return fs.existsSync(path.join(appDir, 'package.json'));
}

/** 供脚本使用：读一个应用的 manifest。 */
export function readAppManifest(appDir) {
  const file = path.join(appDir, 'src', 'manifest.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}
