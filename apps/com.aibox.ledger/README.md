# 记账 / Ledger（`com.aibox.ledger`）

原生 `LedgerPluginKit`（51 个 Swift 文件 / 11328 行）的 React 复刻。多账户复式记账、
多币种、预算与结转、项目与 AA 分摊、CSV 导入导出，并把 8 个 `ledger_*` 工具暴露给 AI。

```bash
node scripts/validate.mjs com.aibox.ledger          # 市场校验
node apps/com.aibox.ledger/tests/selftest.mjs       # 219 条断言：金额精度 / WAL / 聚合 / AA / AI 工具
node apps/com.aibox.ledger/tests/jsx-check.mjs      # 用宿主同一份 Sucrase 转译 + 加载全部源码
```

---

## 已复刻的部分

**五个 Tab**：明细 / 报表 / 资产 / 预算 / 项目，外加账户详情、项目详情两个下钻页。

| 页面 | 状态 |
|---|---|
| 明细页 | 当前项目提示条、本月摘要卡、三个筛选 chip、分段加载（每次 +3 个月）、按日分组、左滑删除 + 撤销条、两级空态 |
| 报表页 | 月份条、收支切换、总额卡、环形占比 + 图例、每日趋势柱状、排行榜、下钻列表 |
| 资产页 | 净资产头卡、按 6 种账户类型分组、外币角标与 `≈ 基准币`、长按菜单、币种入口 |
| 账户详情 | 余额卡、编辑 / 校准动作条、最近 30 条 |
| 预算页 | 月份条、总预算卡（结转、日均可花、进度条）、分类预算列表（按额度降序） |
| 项目页 | 未归档 / 已归档两段、当前项目 chip、四种副标题形态、长按菜单 |
| 项目详情 | 头卡与统计列、预算卡、按分类环形、成员与 AA 结算区块、流水段、底部主按钮 |
| 记一笔 / 编辑 | 类型分段、表达式金额显示、4 列分类宫格 + 子类 chip、转账双账户、元信息区、自绘计算器键盘、保存并再记 |
| 分摊编辑器 | 均摊 / 精确 / 份额 / 百分比四种模式、勾选、已分配校验 |
| 币种与汇率 | 基准币置顶、手动标记、添加币种、在线刷新、长按设为基准币 |
| CSV 导入 | 选文件 → 预览（有效行 / 问题 / 前 100 行）→ 确认写库 |
| 最近删除 | 左滑恢复、右滑永久删除 + 二次确认、转账两腿只展示一条 |

**数据与算法**：9 张表全部落 `aibox.db`；金额恒为整数分；转账两腿配对；软删 tombstone；
幂等键；历史入账汇率口径；预算结转递归（最多回看 120 个月）；分摊零头落付款人；
最少笔数结算方案；账户余额 / 净资产 / 校准；名称解析（种类词 + 品牌别名 + 币种收窄）。

**内置种子完整实现**：10 个一级支出分类 + 34 个二级 + 7 个收入分类 + 4 个默认账户 + 20 个币种目录，
按首启时的 App 内语言物化，之后永不回灌。

**双语**：全部文案跟随 `window.__aiboxEnvironment.locale`，并监听 `environment.localeChanged` 重渲染。

### AI 工具（8 个，`manifest.actions[]` → 宿主的延迟工具）

| 工具 | `action` 取值 | 类型 |
|---|---|---|
| `record` | add / update / delete | 写（sequential） |
| `query` | — | 只读 |
| `stats` | — | 只读 |
| `budget` | status / set | 写 |
| `account` | list / create / set_balance / archive / update | 写 |
| `category` | list / create / rename / archive | 写 |
| `currency` | list / add / set_rate / set_preferred / refresh | 写 |
| `project` | list / create / activate / update / archive / summary / members / add_member / remove_member / settle / record_settlement | 写 |

全部 `headless: true` + `visibility` 含 `agent`，`inputSchemaJSON` 逐字段写全。
**处理器不碰任何 React 状态**，只依赖 `lib/` 的纯函数与 store，走的是与 UI **同一条带 WAL 的写路径**；
自测第 12 段专门验证「零 UI、库都没打开」时直接调用也能正确落库。

---

## 与原生的差异（诚实清单）

### 一、容器缺能力 → 功能未实现

| # | 原生功能 | 本版 | 原因 |
|---|---|---|---|
| 1 | **拍照记账 / 从相册选择** | **整个入口不渲染**，FAB 直接打开手动记账面板 | 落账链路要「多模态 AI（图片作附件进会话）」，容器的 `aibox.ai` 只有纯文本 `generate/decide`，没有图片通道。原生的做法就是「能力不可用时整条入口不渲染」，这里照做 |
| 2 | **快速添加三选面板** | 不渲染 | 三个选项里两个（拍照 / 相册）不可用，剩一个选项的面板比没有面板更糟 |
| 3 | **端上 OCR 与「本地识别」开关** | 不渲染 | 容器没有系统 OCR 桥；`tesseract.js` 是白名单外的 npm 包，运行时会炸掉整个模块。原生在没有 OCR 能力时也是隐藏这个开关（sheet 高度 360 → 300） |
| 4 | **聊天工具卡片 + 「在记账中打开」深链** | 无 | 卡片渲染器与 `section + entityId` 两级深链是宿主侧能力，小应用注册不了。`pendingOpenSection` 那条链路相应也没有 |
| 5 | **模块智能一键动作（L3）/ 周报主动洞察（L4）** | 无 | 需要宿主的模块智能贡献点 |
| 6 | **停靠陪聊半浮层** | 见下「AI 面板」 | 容器没有 docked 会话协调器 |

### 二、能力已有但形态不同 → 近似实现

| # | 原生 | 本版 | 说明 |
|---|---|---|---|
| 7 | **AI 面板**：4 个场景 prompt 交给带 `ledger_*` 工具的多轮会话，模型自己调工具拉数据 | **先在本地把真实数据算好**（与报表页/预算页同一份 `lib/`），把数据简报交给 `aibox.ai.generate`，模型只负责解读；结果就地回显 | 容器的 AI 是单次、无工具的。反过来做之后「结论必须钉在真实数据上」这条契约反而更硬——模型没有编数字的机会。代价是不能追问、不能多轮 |
| 8 | **导出 CSV** 走系统文件保存面板 | 优先 `aibox.share.file`；宿主还没实现时降级到 `aibox.share.text`，并弹一条说明告知「这次是按纯文本分享的」 | `aibox.share.file`（app-shell-and-market.md §3.5）尚在开发中，当前宿主只有 `share.text`。**接口一上线自动切换，无需改代码** |
| 9 | **`aibox/ui` 的 `VirtualList`** | `components/VirtualList.jsx`：同接口的本地实现（`items` / `estimatedRowHeight` / `renderRow` / `onVisibleRowsChange` / `restoreKey`） | 框架资产由另一位 agent 并行开发中，且 `aibox/ui` **目前还不在市场校验的裸 import 白名单**（`scripts/lib/market.mjs` 的 `BARE_IMPORT_ALLOWLIST`），现在 import 会被 `validate.mjs` 直接拒。白名单放开后把该文件换成 `export { VirtualList } from 'aibox/ui'` 即可，**调用方一行不用改** |
| 10 | 左右滑操作、长按上下文菜单、sheet detent | 自绘（`primitives.jsx` 的 `SwipeRow` / `useLongPress` / `Sheet`） | 手势与 detent 是原生控件语义；自绘版行为等价但触感不同 |
| 11 | 确认对话框、动作表 | 优先 `aibox.ui.confirm/actionSheet`（原生弹层），缺席时走自绘 | `Toast.show` 在本宿主渲染为空，全程不用它 |
| 12 | SF Symbols | `components/Icon.jsx` 内联 SVG 手绘约 90 个符号 | 几何近似，非像素级复刻；未收录的名字回落中性圆点，绝不渲染成空白 |
| 13 | Swift Charts（`SectorMark` / 柱状） | 纯 SVG 手绘 | 口径照抄 §5：环形取前 8、内径比 0.62、扇区间隙 1.5°、图例取前 6、Y 轴用紧凑金额。没用白名单里的 chart.js——它的 canvas 在深浅色切换时要手动重绘，SVG 更稳 |

### 三、有意改良（与原生行为不同，但是刻意的）

| # | 内容 | 理由 |
|---|---|---|
| 14 | **补齐了原生漏进 xcstrings 的 8 条中文**：`No matching entries` / `Try changing your search or filters.` / `There are no entries behind this report bucket.` / `Account unavailable` / `This account may have been removed or is no longer available.` / `Recent entries` / `Recently deleted is empty` / `Deleted entries appear here…` | 原生这 8 条在中文环境实际显示英文，是 bug。译法取规格 §7 的建议，表里以「补译」注释标出 |
| 15 | **表达式求值用精确有理数（BigInt 分子/分母），不是定点数** | 规格要求 Decimal 语义；有理数只会更准：`10/3*3` 在定点/浮点下会漂成 9.99，这里恒等于 10。**全程零浮点**，只在最后一步 `×100 四舍五入到分`（half away from zero） |
| 16 | **`majorNumberToMinor` 不写 `Math.round(value * 100)`** | `1.005 * 100 === 100.49999999999999`，会把 AI 传来的 1.005 记成 1.00。改成把数字打成十进制字面量后走同一套精确解析——「AI 给的浮点」与「用户敲的表达式」共用一条精度路径 |
| 17 | CSV 导出的 CRLF 与 RFC 4180 转义照抄，但**没有加 UTF-8 BOM** | 规格 §9.1 提到 BOM 只是「兼容 Excel」的可选建议；加了会破坏与原生导出文件的逐字节一致性，导入侧则两种都能读 |

### 四、有意保留的原生怪癖（照抄，不是 bug）

| # | 行为 |
|---|---|
| 18 | 计算器按 `=` 时**负结果会丢掉负号**（`-5` → `5`）。因为保存要求 > 0，不影响落账 |
| 19 | 删除撤销条**没有自动消失定时器**，只有点「撤销」才收起 |
| 20 | 明细行的**支出金额是 ink 正文色，不是红色**（只有账户负余额、超支、缺汇率才用红） |
| 21 | **AI 记账缺省不归任何项目**，哪怕存在「当前激活项目」；只有 UI 手动记账才默认归入 |
| 22 | 点项目详情底部「记账到此项目」会**先把该项目设为当前项目**再打开记一笔 |
| 23 | `byTag` 维度下，一笔多标签会给每个标签都加全额（有意的重复计数） |

### 五、规格里含糊、本版做了裁定的地方

| # | 说明 |
|---|---|
| 24 | §6.1 的规则说「整数部分带千分位」，但例子里 JPY 写成 `¥1234`。本版按**规则**执行（`¥1,234`），0 位币仍然不输出小数部分 |

---

## 持久化：为什么自己做了 WAL

实测宿主的 `aibox.db`（`AppletDocumentDatabase.swift`）**没有事务语义**：每个 collection 是一个 JSON
文件，`insert/update/remove` 各做一次「整表读 → 改 → 原子写文件」——**单次调用原子，跨调用不原子**。
而记账有两处绝不允许写一半：转账的两笔配对流水、AA 结算的「结算记录 + 关联流水」。

所以 `lib/db.js` 做了三件事：

1. **按月分片**：`tx` collection 里一个文档装一个月（`m202608`）。同月的转账两腿落在**同一个文档**里，
   天然就是一次原子写；顺带把 CSV 导入从「每行一次整表重写」压成「每月一次」。
2. **写前日志**：跨月或跨表的批次先把整批 ops 写进 `wal/pending`，逐个落地，全部成功后再删 pending。
   单条 op 直接跳过 WAL（宿主单次写本身就是原子的），省两次桥调用。
3. **启动重放**：开库时若发现 pending 就**重放**（不是回滚）。每个 op 都是「按 `_id` 整文档 put / del」，
   幂等，重放一定收敛到批次完成后的状态。

写失败沿着 `store.mutate` 显式冒泡：内存**原样不动**（Draft 直接丢弃 = 天然回滚）→ 切 `readOnly` →
顶部横幅 → 隐藏 FAB → 禁用写入口 → 记一笔弹 alert → AI 工具返回 `The ledger change was NOT saved…`。
**绝不吞掉异常后照常刷新 UI。**

自测第 5 段专门注入写失败，逐条断言「余额变了但流水没落库」不可能发生，并构造一个
「WAL 写完、数据只落了一半」的崩溃现场，验证重开后收敛到完成态。

### 容量上限

宿主对单个 collection 的限制是 20,000 个文档 / 12 MB。按月分片后文档数不是瓶颈；
12 MB 约合 3 万笔流水。超过之后 `db` 会返回 `aibox/quota-exceeded`，走的也是同一条
「写失败 → 切只读 → 显式告知」的路径，不会静默丢数据。

---

## 目录

```
src/
  app.jsx                 根：开库 / 外壳接线 / Tab 路由 / 写操作编排
  manifest.json           tabBar + toolbar + menu + 12 个 action（8 AI 工具 + 4 UI 入口）
  i18n/                   index.js（locale 跟随）+ strings.js（en / zh-Hans）
  lib/
    expression.js         表达式词法 + 递归下降 + 精确有理数
    money.js              金额格式化与主单位↔分
    currencies.js         20 币种目录 + 俗名归一
    dates.js              月键 / 归一 / 本地化格式
    seeds.js              内置种子完整清单
    db.js                 aibox.db 封装 + WAL + 按月分片
    store.js              内存模型 + 唯一写门面（可靠性四态）
    entries.js            流水写操作（含转账配对）
    entities.js           账户/分类/币种/预算/项目/成员写操作
    balances.js           余额 / 净资产 / 校准
    reporting.js          月度收支 / 预算结转
    queries.js            筛选 + 桶聚合（UI 与 AI 共用）
    split.js              AA 分摊 / 净额 / 结算
    fx.js                 换算三件套 + 在线汇率
    csv.js                导入导出
    resolve.js            名称解析
    display.js            正负号与颜色矩阵
    prefs.js              localStorage 记忆偏好
    actions.js            AI 工具：record / query / stats / budget
    actions-entities.js   AI 工具：account / category / currency / project
    register-actions.js   接 aibox.action.register
    host.js               宿主桥薄封装
  components/             15 个页面与零件
tests/                    自测（不在 src/ 里，永远不进包）
```

## 权限

| 声明 | 用在哪 |
|---|---|
| `network` + `networkAllowed: ["open.er-api.com"]` | 在线汇率（免费、无需 key、只发出基准币码，不含任何财务数据）。拿不到时静默降级为「点币种可手动设置」，**绝不用 1 兜底** |
| `ai` | AI 分析面板 |
| `storage` | 账本数据（经 `aibox.db`） |
| `picker` | CSV 导入选文件 |
| `share` | CSV 导出 |
| `ui` | 永久删除 / 结清的二次确认、保存失败提示 |
| `haptics` | 记一笔成功的轻触感 |
