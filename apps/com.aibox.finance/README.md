# 理财 · com.aibox.finance

原生 `FinancePluginKit` 的 React 小应用复刻：4 Tab（行情 / 行业 / 持仓 / 设置）、
Apple 股市式自选、多周期折线图 + 5 类本地技术指标、A 股基本面 / 板块 / 龙虎榜 / 情绪、
多账户模拟交易（整数分记账、跨币种锁汇率）、组合绩效 / 诊断 / 回测 / 定投，
以及 **23 个对 AI 暴露的 `finance_*` 工具**。

数据源全部免费、零 API Key（腾讯主 / 新浪备 / 东方财富进阶），走 `aibox.net.fetch`
原生代理设 `Referer` 绕反爬，GBK 响应在 Web 侧用 `TextDecoder('gb18030')` 解码。

---

## 目录

```
src/
  app.jsx                 根：装配 → 接外壳 → 注册工具 → 路由 → 刷新循环
  manifest.json           外壳声明 + 23 个 action（由 tests/sync-manifest.mjs 生成，勿手改 actions[]）
  i18n/                   zh-Hans / en 各 298 键（键名与原生 xcstrings 一致）
  lib/
    symbol.js             FinSymbol 两级解析 + 各 Provider 代码映射
    money.js              「分」为单位的整数账目运算
    format.js             数字 / 涨跌色 / 货币 / 时间戳格式
    indicators.js         MA / EMA / MACD / KDJ / BOLL / 标准差 / 回撤 / 降采样
    portfolio.js          §10 全部口径（买卖 / 汇率 / 估值 / 绩效 / 配置 / 诊断）
    strategy.js           回测 / 定投 / 再平衡 / 快照
    http.js               net.fetch 封装 + GBK 解码 + 同 key 并发合并
    providers/            tencent / sina / fund / eastmoney / push2
    quotes.js             TTL 缓存 + 故障切换 + 数据可信状态机
    store.js / ledger.js  自选与设置 / 模拟账本（单 key 原子提交）
    alerts.js             到价提醒（纯函数 shouldFire + 4 小时冷却）
    tool-defs.js          23 个工具的**声明真值**
    tools.js              读型 handler + 注册；tools-write.js 4 个写型
  components/             页面与零件（图表全部手绘 SVG）
tests/
  selftest.mjs            43 条金额 / 指标 / 口径断言
  tools-smoke.mjs         13 条端到端冒烟（假桥跑通 GBK → 解析 → 工具结果）
  sync-manifest.mjs       tool-defs.js → manifest.actions[]（`--check` 供 CI 用）
```

自验：

```bash
node apps/com.aibox.finance/tests/selftest.mjs
node apps/com.aibox.finance/tests/tools-smoke.mjs
node apps/com.aibox.finance/tests/sync-manifest.mjs --check
node scripts/validate.mjs com.aibox.finance
```

---

## 与原生版的差异

诚实清单。分三类：**平台缺口导致的降级**、**刻意的近似**、**未实现**。

### A. 平台缺口导致的降级

| 原生 | 本复刻 | 原因 |
|---|---|---|
| **桌面 Widget**（App Group + WidgetKit） | **整块砍掉** | 容器没有小组件数据槽。App 内功能完全不受影响 |
| **后台到价检查**（BGTaskScheduler） | **只在前台刷新时检查** | 容器有 `notifications.schedule` 但**没有后台唤醒**。设置页 footer 已如实写明「App 活跃时生效；本容器没有后台唤醒，关闭 App 后不盯盘」——不假装能后台盯盘 |
| **iCloud 自选同步**（NSUbiquitousKeyValueStore） | **开关整块不渲染** | 容器无对应能力。留一个点了没反应的开关比没有更糟 |
| **停靠式 AI 会话**（半浮层 + toolScope + 跨页跟随） | 降级成 `aibox.chat.open`：把页面快照上下文 + 种子 prompt 交给宿主聊天页开新会话 | 容器没有停靠会话；**原生自己就有这条降级路径**。宿主没有 AI 时 ✨ 入口与 AI 面板整块不渲染 |
| **账户归档导入**（fileImporter） | 只做**导出**（`aibox.share.file`） | 导出已够做备份/迁移；导入需要 picker + 一套合并语义，本轮未做 |
| **SwiftData 事务** | 整本账住**同一个 KV key**，一次 `storage.set` 原子提交 | 容器 KV 单键写入是原子的：「余额变更 + 流水写入」要么全成要么全不成，失败时内存状态也不改。**没有**用裸多键 KV 记账 |
| **左滑删除 / 拖拽重排 / 长按菜单**（原生手势） | 左滑删除自绘（`SwipeRow`）；**拖拽重排未实现** | `aibox.list.*` 原生手势层尚未上线（framework-capabilities §3.1 标 P0 未做）。排序菜单三档齐全，手动顺序可用但只能按加入次序 |
| **`aibox/ui` 的 `VirtualList`** | `components/VirtualList.jsx` **同接口本地兜底** | 资产已存在于 `WebAssets/applet-runtime/src/aibox-ui/`，但说明符**还没进 `AppletImportRules.bareWhitelist`（Swift 侧）与 market 的 `BARE_IMPORT_ALLOWLIST`** —— 现在写裸 import 会转译期被拒 → 白屏。上架后把该文件换成 `export { VirtualList } from 'aibox/ui'` 即可，调用方一行不用改 |
| 导航栏 `ellipsis.circle` 排序菜单 | 就近放在**分组条右端** | 宿主 `scene.toolbar.trailing` 上限 3 项且身份静态，已被 ✨ 与搜索占满 |

### B. 刻意的近似

| 项 | 说明 |
|---|---|
| **图表** | 全部手绘 SVG，不用内置 chart.js。原生就是折线 + 渐变面积 + 柱 + 环形，**没有一根蜡烛**、没有十字光标 / tooltip / 缩放 / 时间轴标签——手绘反而能逐像素对齐（面积渐变 18%→2%、X 轴完全隐藏、Y 轴不含 0），也不引入需要注册控制器的依赖。**没有"好心"升级成蜡烛图** |
| **SF Symbols** | WebView 拿不到，按原生用到的符号名手绘了一套等价 SVG（几何近似，非像素级复刻） |
| **原生弹层** | sheet / 菜单 / 分段控件全部自绘 fixed 覆盖层。`Toast.show` 在本宿主渲染为空，同族命令式弹层风险相同，故一律不用 |
| **等宽数字** | 用 `font-variant-numeric: tabular-nums`（`.fin-mono`）。漏了这条价格列会跳动 |
| **分钟 K 线** | 端点已实现，但原生源码自己注明该端点未经 CI 验证；本复刻同样保留、失败静默回空 |

### C. 未实现

- **拖拽重排自选**（见 A 表）。左滑删除、三档排序、分组筛选都在。
- **账户归档导入**（导出在）。
- **`finance_screener` 的行业精确匹配**只做子串包含，没做行业码归一。
- **北向资金面板**：**按规格要求刻意不做**（§8.7：官方 2024-08 已停更，字段全 null，原生也已放弃）。

### D. 数据诚实性（与原生一致，逐条实现）

这几条是本模块的底线，复刻时一条没让：

- 缺行情或缺汇率的持仓**一律按 0 计并打标**，账户显「当前估值不完整 + 缺失清单」；
  **绝不用汇率 1 兜底、绝不伪造数值**。
- 估值不完整时**不出组合健康分、不写净值快照、绩效不进曲线**。
- 全部行情拉取失败时**保留旧缓存和旧 `lastUpdated`**，只加一行「刷新失败」，
  不把旧内容伪装成刚刷新。
- push2 系接口在非中国大陆网络下必空 → 行业页**先 hydrate 磁盘快照秒显再拉网络**，
  拉空就回退缓存 / 空态，**不转圈到超时**。
- 东财基金全量目录响应被 `maxBytes` 截断时，`finance_search` 会**明确报出来**
  （半截目录会让基金搜索静默漏结果）。

---

## 对 AI 暴露的 23 个工具

`manifest.actions[]` 声明 → 宿主投影成**延迟工具**（不进常驻 tools 数组，AI 经
`tool_search` / `describe` / `call` 发现调用），执行回到页面内的 `aibox.action.register`。

全部 `headless: true` + `visibility: ["agent","automation"]`，
每条 summary 末尾都带能力级约束：
*"Market quotes are delayed and for simulation/research only — never place real trades or move real money."*

| 类别 | 工具 |
|---|---|
| 行情与检索 | `finance_quote` `finance_search` `finance_chart` `finance_compare` |
| 自选与账户（**写型**） | `finance_watch` `finance_account` `finance_trade` `finance_alert` |
| 组合 | `finance_portfolio` `finance_perf` `finance_diagnose` `finance_rebalance` |
| 基本面 | `finance_financials` `finance_dividend` `finance_fundflow` `finance_news` |
| 市场 | `finance_sector` `finance_moneyrank` `finance_dragon` `finance_sentiment` `finance_screener` |
| 模拟 | `finance_backtest` `finance_plan` |

写型 4 个标 `readOnly: false`；`finance_trade` 另标 `idempotent: false`
（同一笔买入调两次就是两笔成交）；`finance_rebalance` **只提案不下单**。

**解析纪律**（做错会让 AI 记错账户 / 查错标的，已在冒烟测试里钉住）：

- 账户名对不上 → 返回候选清单，**绝不静默落主账户**；
- 标的多条命中 → 返回前 8 个 `"名字 [代码]"` 让模型挑；
- `"Tesla"` 这类全字母名称先被 `parseStrict` 判空 → 走搜索，
  不会造出永远查不到的假代码 `usTESLA`。

所有抓取 / 解析 / 估值 / 指标都在 `lib/` 的纯函数里，**UI 与 action 共用同一份**，
所以工具在无 UI 状态下也能工作。

---

## 网络与限频

`networkAllowed` 用子域后缀匹配，5 条覆盖全部 14 个端点：
`gtimg.cn` / `sinajs.cn` / `sina.com.cn` / `eastmoney.com` / `1234567.com.cn`。

| 项 | 策略 |
|---|---|
| 行情内存 TTL | `clamp(refreshInterval, 10, 60)` 秒；`force` 旁路 |
| 批量请求合并 | key = 数据源 + 排序后的代码串，同 key 并发共享一次网络调用 |
| 故障切换 | `automatic`：先腾讯 → 没拿到的代码再打新浪补齐 |
| 基金估值 | 一只一请求，并发窗口固定 4 |
| K 线 | 会话内 TTL 120s，条目超 40 整表清空 |
| 汇率 | 1 小时 |
| 磁盘快照 | 节流 20s，退到后台强制写，只留最近 200 条行情 |

GBK 端点（腾讯行情 / 腾讯联想 / 新浪行情 / 新浪汇率）一律
`responseType: 'base64'` + `TextDecoder('gb18030')`：
`'text'` 会按 UTF-8 解，失败时返回**空字符串**（不是乱码，是什么都没有）。

---

**仅供模拟，非投资建议，不涉及真实交易。**
