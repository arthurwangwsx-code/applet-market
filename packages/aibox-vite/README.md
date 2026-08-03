# @aibox/applet-vite

小应用的 Vite 预设。

```ts
// vite.config.ts
import { defineAppletConfig } from '@aibox/applet-vite';
export default defineAppletConfig();
```

固定了四条**配错就白屏**的设置：`base: './'`、`target: 'safari17'`、7 个 external、固定产物名。
外加三个插件：manifest 校验 + action 类型生成、HTML 收尾、产物自检。

完整说明：[../../docs/typescript-workflow.md](../../docs/typescript-workflow.md) §5。
