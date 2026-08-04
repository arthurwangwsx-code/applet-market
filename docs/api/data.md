# `aibox.data`

> Metadata about this applet's own private data: how much of its storage budget is left, and which version last wrote it. The budget is shared by aibox.storage, aibox.db and aibox.resource; going over it fails writes with aibox/quota-exceeded.

**分组** 容器内建 ｜ **方法数** 4 ｜ **声明要求** 容器协议内核，**manifest 无需声明**（写/执行型方法仍会走一次授权确认）。

<!-- GENERATED:BEGIN —— 本节由 scripts/gen-api-docs.mjs 从宿主 descriptor 生成，请勿手改 -->

## API

### `aibox.data.usage()`

Bytes used and remaining across this applet's private data (kv + db + imports). Check it before bulk writes and use it to drive your own eviction policy — the host sets the budget, you decide what to drop.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{usedBytes, limitBytes, remainingBytes, layers:{kv,db,imports,other}}`

**返回类型** `{ layers: { db: number; imports: number; kv: number; other: number }; limitBytes: number; remainingBytes: number; usedBytes: number }`

```js
const u = await aibox.data.usage(); if (u.remainingBytes < 1e6) await trimOldRecords()
```

### `aibox.data.version()`

Which version last wrote the data on disk versus the version running now. This is the migration hook: when changed is true, migrate from previous to current, then call acknowledgeVersion(). The host knows nothing about your schema.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{current, previous, isFirstRun, changed, firstSeenAt?}`

**返回类型** `{ changed: boolean; current: string; firstSeenAt?: string; isFirstRun: boolean; previous: string | unknown }`

```js
const v = await aibox.data.version(); if (v.changed) { await migrate(v.previous, v.current); await aibox.data.acknowledgeVersion() }
```

### `aibox.data.acknowledgeVersion()`

Mark the current version's data as migrated. Idempotent; until you call it, version() keeps reporting the same transition, so a failed migration is retried instead of silently skipped.

**副作用档位** `localWrite`（本地写）— 改本机数据或系统状态；首次使用会弹一次授权。

**参数**

无参数。

**返回** `{current, previous, isFirstRun, changed}`

**返回类型** `{ changed: boolean; current: string; firstSeenAt?: string; isFirstRun: boolean; previous: string | unknown }`

```js
await aibox.data.acknowledgeVersion()
```

### `aibox.data.snapshot()`

The data snapshot the host captured before the last update, if any. Read it to tell the user a rollback point exists; the host keeps exactly one.

**副作用档位** `read`（读取）— 只读，不改任何状态；不触发用户确认。

**参数**

无参数。

**返回** `{version?, capturedAt?, bytes} | null`

**返回类型** `{ bytes: number; capturedAt?: string; version?: string } | unknown`

```js
const s = await aibox.data.snapshot(); if (s) showRollbackHint(s.capturedAt)
```

**真值来源** `Packages/AppletPluginKit/Sources/AppletPluginKit/Runtime/Capabilities/DataCapabilityAdapter.swift`

<!-- GENERATED:END -->

## 兼容性

<!-- MANUAL:BEGIN compat -->
- **可用 surface**：全部，含 `headless`。它不需要可见运行时，也不弹任何授权框——
  这正是它存在的前提之一：无头执行（`applet_run` / `aibox.jobs` 后台任务）里也必须问得出「还剩多少」。
- **宿主变体**：Full / Lean 一致。它属容器协议内核，不随可选模块存废。
- **manifest 声明**：**不需要**。与 `db` / `resource` 同族，恒可发现。
- **iOS 系统授权**：无。它只读写本应用自己的沙箱与宿主为它维护的账本。
- **能力缺席时的降级**：老宿主上 `aibox.data` 整条不存在，调用会 reject
  `aibox/denied: unknown api 'data'`。所以**必须包一层**：

  ```js
  const usage = await aibox.data?.usage().catch(() => null)
  if (usage && usage.remainingBytes < 1_000_000) await trimOldRecords()
  ```

  拿不到余量时按「预算未知」处理（照常写、失败再收敛到 `aibox/quota-exceeded`），
  不要因为读不到 usage 就停写——那会把一个可选的优化变成必需路径。
- **配额本身在更老的宿主上不存在**：那些版本里 `aibox.storage` 没有任何上限、
  `aibox.db` 只有单 collection 上限。写失败的错误码是稳定的（`aibox/quota-exceeded`），
  按错误码分支比按宿主版本分支可靠。
<!-- MANUAL:END compat -->

## 接下来的规划

<!-- MANUAL:BEGIN roadmap -->
设计与裁定见主仓库 `docs/capabilities/applet/data-architecture.md`（§9 裁定、§10 as-built）。

已知缺口，按优先级：

1. **快照只能读、不能回滚。** `snapshot()` 告诉你「更新前那份数据还在」，但没有
   `restore()`。回滚目前只能由宿主侧（Studio / 验收 CLI）做。缺它的后果是：
   迁移脚本写错时应用**知道**有救但**够不着**。设计上要先想清楚「应用能不能自己覆盖自己的数据」
   ——那是个真实的脚枪，不是随手加个方法。
2. **配额是单一总量，不可按层规划。** 这是刻意的（宿主不替应用规划 kv/db/imports 的比例），
   但也意味着一个失控的 `imports` 能饿死 `db`。真出现这种案例再谈分层预算，别提前造。
3. **`version()` 的 `current` 对非市场应用恒为 `"local"`。** 本地开发 / 旁装的应用没有版本号，
   于是迁移钩子在它们身上永远不触发。这对开发期是对的（改代码不该触发数据迁移），
   但如果将来 `.aiboxapplet` 包带上自己的版本号，这里要跟着改。
4. **`aibox-sdk` 还没有 `defineMigrations()` 封装。** 本页给的是原语；
   把「版本区间 → 迁移函数」的调度沉进 SDK 是下一步。
<!-- MANUAL:END roadmap -->

---

[← API 索引](README.md) ｜ [入门指南](../authoring-guide.md) ｜ 协议与权限架构：主仓库 `docs/capabilities/applet/platform-protocol.md`
