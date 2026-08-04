import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';

// bundle 形态自挂载；source 形态由宿主外壳挂 default 导出。两样都留着，少一样就是白屏。
const root = document.getElementById('root');
if (root && root.children.length === 0) {
  createRoot(root).render(createElement(StrictMode, null, createElement(App)));
}

export default App;
