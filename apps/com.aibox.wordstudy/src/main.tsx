import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/**
 * 入口。**同时兼容两种运行时形态**，这是刻意的：
 *
 * · `runtimeKind: "bundle"`（本工程）——`index.html` 用原生 `<script type="module">` 加载本文件，
 *   由这里自己 `createRoot` 挂载。
 * · `runtimeKind: "source"`（宿主默认外壳）——外壳会 `import('./app.jsx')` 并挂载它的 default
 *   导出，同时**跳过已经自挂载的模块**（判据是 `root.children.length === 0`）。
 *
 * 所以「自挂载 + default 导出」两样都留着，同一份代码在两种外壳下都能跑。
 * 少了自挂载 → bundle 形态白屏；少了 default 导出 → source 形态白屏。
 */
const root = document.getElementById('root');
if (root && root.children.length === 0) {
  createRoot(root).render(createElement(StrictMode, null, createElement(App)));
}

export default App;
