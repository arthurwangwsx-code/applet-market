import { defineAppletConfig } from '@aibox/applet-vite';

// 本应用是 JSX（非 TS）——迁移只为删掉私有 host.js 分叉，不顺带重写语言。
export default defineAppletConfig({ entry: 'src/main.jsx' });
