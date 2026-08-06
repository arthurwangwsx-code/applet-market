# @aibox/applet-sdk

AiBox 小应用的前端 SDK。零运行时依赖，构建时被打进应用产物。

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
| 类型 | 无（`window.aibox` 是 `any`） | 39 个命名空间全量类型，**从宿主真值派生**，带漂移检查 |
| 能力探测 | 每个应用自己写 `typeof aibox.x.y === 'function'` | `isAvailable(ns, method)` / `useCapability()` / `probe()` |
| 错误码 | `e.code` 是 `any`，拼错没人管 | `AiboxError` + 字面量联合，`switch` 能穷尽 |
| 非 UTF-8 站点 | 每个应用手写 base64 → TextDecoder | `fetchText(url, { encoding: 'gb18030' })` |
| `truncated` | 布尔位，大多数应用漏判 | 默认截断即抛 |
| action 契约 | manifest 与 handler 无机械联系 | 名字/入参/返回**编译期**对齐 |
| 事件订阅 | 手动记 unsubscribe | hooks 自动退订 |
| 触摸手势 | 每个应用手搓分页 / 左滑 / 下拉，`touchcancel` 谁写谁漏 | `useSwipePager` / `useDragGesture` / `useLongPress`，cancel = 放弃写死在里面 |

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

> `scripts-postbuild.mjs` 那一步不能省：`aibox-global.d.ts` 是 global script，
> tsc 不会把 `/// <reference>` emit 到产物里，少了它消费者会**静默**丢掉全部 `aibox.*` 类型。
