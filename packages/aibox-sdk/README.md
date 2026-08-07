# @aibox/applet-sdk

AiBox 小应用的前端 SDK。npm 包负责开发期 API、类型和测试；运行时由 AiBox 宿主以
`aibox/sdk` / `aibox/sdk/react` 提供同一个 `aibox-sdk.mjs` 实例，应用包不再复制 SDK 实现。
`aibox-tsbuild` 会自动改写说明符，业务源码不需要区分两种入口。

```ts
import { isAvailable, fetchText, storage, registerActions, normalizeError } from '@aibox/applet-sdk';
import { useTabs, useToolbarSearch, useKeyboardInset, useLocale } from '@aibox/applet-sdk/react';
import { useSwipePager, useDragGesture, useLongPress } from '@aibox/applet-sdk/react';
```

> **触摸手势一律用上面第三行那组原语，不要自己接 `onTouch*`。**
> `touchcancel` 只有原生手势抢走触摸时才发，浏览器里测不出来——手搓必漏，
> 实测两个应用两种错法（当成 `touchend` 直接误提交 / 干脆不接、状态永不复位）。
> 原语把「cancel = 放弃」写死在里面，并由 `tests/gestures.test.mjs` 派发真的合成
> `touchcancel` 守着。见 [../../docs/authoring-guide.md](../../docs/authoring-guide.md) §2。

完整文档：[../../docs/typescript-workflow.md](../../docs/typescript-workflow.md) §4。

## 它比裸 `window.aibox` 多了什么

| | 裸桥 | SDK |
|---|---|---|
| 类型 | 无（`window.aibox` 是 `any`） | 宿主命名空间全量类型，**从宿主真值派生**，带漂移检查 |
| 能力探测 | 每个应用自己写 `typeof aibox.x.y === 'function'` | `isAvailable(ns, method)` / `useCapability()` / `probe()` |
| 错误码 | `e.code` 是 `any`，拼错没人管 | `AiboxError` + 字面量联合，`switch` 能穷尽 |
| 非 UTF-8 站点 | 每个应用手写 base64 → TextDecoder | `fetchText(url, { encoding: 'gb18030' })` |
| `truncated` | 布尔位，大多数应用漏判 | 默认截断即抛 |
| action 契约 | manifest 与 handler 无机械联系 | 名字/入参/返回**编译期**对齐 |
| 事件订阅 | 手动记 unsubscribe | hooks 自动退订 |
| 触摸手势 | 每个应用手搓分页 / 左滑 / 下拉，`touchcancel` 谁写谁漏 | `useSwipePager` / `useDragGesture` / `useLongPress`，cancel = 放弃写死在里面 |

## 兼容判断与降级

```ts
import { checkCompatibility, containerInfo, supports } from '@aibox/applet-sdk';

const report = checkCompatibility({
  minSDKVersion: '1.1.0',
  bridgeProtocol: '2.0',
  runtimeModules: ['aibox/ui'],
  capabilities: [
    { namespace: 'storage', method: 'get' },
    { namespace: 'haptics', method: 'impact', optional: true },
  ],
});

if (!report.compatible) renderUnsupportedState(report.errors);
if (!supports('capability:haptics.impact')) hideHapticsSetting();
console.log(containerInfo());
```

`containerInfo()` 只读宿主在 `documentStart` 注入的版本合同，不触发授权。硬依赖进入
`report.errors`；可选能力进入 `report.warnings`，由应用隐藏入口或降级。能力版本尚未进入桥协议，
因此不要用容器版本猜能力，也不要给 `supports('capability:…')` 传伪版本。

## 类型是怎么来的

`src/generated/aibox-global.d.ts` 由 `applet-market/scripts/gen-sdk-types.mjs` 从三份宿主真值生成
（`platformTypeScript` + `aiTypeScript` + `docs/api/capabilities.snapshot.json`）。**不要手改。**

```bash
npm run sdk:types          # 重新生成
npm run sdk:types:check    # 漂移检查
```

## 构建

```bash
npm run build      # tsc -> dist/ + 把全局类型与 triple-slash 引用写进产物
npm run typecheck
```

宿主资产由根仓 `WebAssets/applet-runtime` 从这里生成，并用版本、字节数和 SHA-256 锁定；市场侧
`audit-runtime-contracts.mjs` 同时检查 SDK 版本、所有应用依赖、构建器启动预检和宿主资产锁。

> `scripts-postbuild.mjs` 那一步不能省：`aibox-global.d.ts` 是 global script，
> tsc 不会把 `/// <reference>` emit 到产物里，少了它消费者会**静默**丢掉全部 `aibox.*` 类型。
