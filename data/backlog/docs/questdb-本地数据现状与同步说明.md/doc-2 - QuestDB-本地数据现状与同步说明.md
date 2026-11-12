---
id: doc-2
title: QuestDB 本地数据现状与同步说明
type: guide
created_date: '2026-11-12T13:39:00Z'
updated_date: '2026-11-12T13:52:00Z'
tags:
  - questdb
  - data-governance
  - sync
  - core-data
---
# QuestDB 本地数据现状与同步说明

> 采集时点：2026-11-12 13:52:39 UTC。范围仅为 `http://127.0.0.1:9000` 当前可读目录；所有操作均为只读。“有数据”不等于来源完整、可用于策略或同步正在运行。

## 数据分级

| 等级 | 定义 | 当前处理 |
| --- | --- | --- |
| 核心候选 | 主策略基础输入、交易日历或跨市场日线基线；失效会阻断核心研究/策略链路 | 首先逐表建立完整性、正确性和自动同步证据；未达标不得标记为核心可用 |
| 扩展 | 行业、财务、宏观、公告或补充市场数据 | 需有各自来源与范围证据，但不阻断第一阶段核心准入 |
| 派生/编译 | 因子目录、回测产物、估值、视图或由其他表计算的结果 | 先验收上游核心表；派生结果需重算或值回读 |
| 高频 | L2、分钟/小时级、实时或近实时行情 | 独立按会话、分钟/小时缺口、延迟和原始证据验收，不用日线门槛替代 |
| 备份/临时 | `java_*`、`*_stage*`、`*_backup*`、`*isolated*`、`jdb_test_*` | 不参与业务消费或核心准入；保留恢复归属，禁止按前缀批量删除 |

三个目录附录已为每个当前对象标注一类等级。等级是维护优先级，**不**是质量结论。

## 第一阶段核心候选

| 市场 | 对象 | 角色 | 运行态快照 | 状态 |
| --- | --- | --- | --- | --- |
| A股 | `exchange_calendar` | 交易日、闭市与未来交易日基线 | 26,668 行，最大日期 2027-09-27 | 可读；范围与来源版本待验收 |
| A股 | `daily`、`daily_basic`、`stk_factor` | 日线、每日指标与复权/因子基础 | 均最大至 2026-11-10 | 可读；逐证券覆盖和值待验收 |
| A股 | `stk_suspend`、`stk_st_daily`、`stk_limit` | 停牌、ST、涨跌停约束 | 均最大至 2026-11-10 | 可读；稀疏事件需用合法空结果与范围验收 |
| ETF | `etf_basic`、`etf_daily`、`etf_adj`、`etf_factor` | ETF 目录、日线、复权与因子 | 日线/复权最大至 2026-11-10；因子至 2026-10-30 | `etf_factor` 尚不能按新鲜度视为已达标 |
| 美股 | `us_market_daily` | 市场指数/宏观日线基线 | 13,119 行，最大日期 2026-11-11 | 可读；来源窗口与完整键待验收 |
| BTC | `btc_spot_1d` | 原生现货日线基线 | 2,504 行，最大日期 2026-11-08 | 可读；原文、连续性与日更账本待验收 |

`us_equity_intraday`、`btc_spot_1h`、`btc_perp_1h`、`btc_mark_1h`、`btc_index_1h`、`btc_funding` 被列为高频：它们重要但使用独立的会话/小时级验收。`stock_basic`、`adj_factor` 等在代码/历史规范中出现但本次运行态目录未匹配为同名对象；它们属于“代码定义待确认”，不是本机核心已证实项。

## 核心数据的三道准入门

| 门槛 | 必须证明 | 不足以证明 |
| --- | --- | --- |
| 完整性 | 已批准的证券/交易日/原文范围；逐键覆盖、闭市/合法空结果、历史起点与中间缺口 | 行数、单表最大日期、少量样本 |
| 正确性 | 来源版本、字段映射、完整业务键和值回读；重复/空值/修订规则；目标物理身份 | HTTP 200、发送成功、WAL 接收或任务退出码 |
| 自动同步 | 一个明确的正式 Java writer；已启用且可追溯的调度；同步账本、锁、失败告警、重启/补跑和只读回读 | 代码存在、默认配置、一次手工运行或第二个 writer |

只有三道门都通过，才能把“核心候选”提升为“核心可用”。自动同步验收还要求 `writerTxn == sequencerTxn`、`bufferedTxnSize == 0`、对象未 suspended，并在 WAL 可见后按业务键和值回读。

## 建议核验顺序

1. `exchange_calendar`：先固定市场日与批准证券范围。
2. A股日线主干：`daily` → `daily_basic`/`stk_factor` → `stk_suspend`/`stk_st_daily`/`stk_limit`。
3. ETF：目录 → 日线 → 复权 → 因子；`etf_factor` 先处理截至 2026-10-30 的新鲜度与范围证据。
4. 美股日线与 BTC 日线：分别按纽约交易日和 UTC 闭日核验，不混用截止标准。
5. 高频：在核心日线通过后，单独核对小时/会话缺口与原始证据。
6. 仅在每个对象三道门均留有证据后，启用或接管其自动同步；不要通过新增第二 writer 绕过未确认运行。

## 同步责任与边界

| 数据域 | 代码定义入口 | 目标与观测证据 | 本次结论 |
| --- | --- | --- | --- |
| A股/财务 | `markets/cn/data-app`；正式任务 `data.<dataset>` | Java Sender(QWP/WebSocket)或 typed HTTP/ILP；账本、区间锁、读回 | 对象可读；运行开关、来源覆盖未确认 |
| A股 Batch | `platform/engine/batch` | 隔离 `jdb_test_*`；不能作为正式表成功证据 | 不参与核心准入 |
| 主策略后收盘 | `deploy/backtest-post-close` 与主策略 profile | QuestDB、账本、锁、缺口审计 | 当前调度/最近运行未在本次核验范围 |
| 美股 | `markets/us/data-app` | Java 写入、来源范围、逐字段回读 | 目录可读；全市场完整性未确认 |
| BTC | `markets/btc/data-app`、`tools/btc_daily.py` | Binance 原文、run/revision 报告、QuestDB 回读 | 运行账本尚未读取 |
| L2 | `deploy/l2-live` 独立链路 | SQLite 原始 journal、归一化 Parquet | QuestDB 目录不能代表完整 L2 档案 |

## 证据与限制

- 运行态：本机 QuestDB HTTP `tables()` 与 `information_schema.columns`，采集于文首时点。
- 代码/规范：`F:\repo\engine\data\docs\formal-sync-takeover.md`、`docs\strategy-source-coverage.md`、`docs\btc-data.md`、`docs\us-market-data.md`、`docs\questdb-usage.md`。
- 本次没有启动采集、写入、重启或修改数据库/WAL；自动同步尚未被实际启用或验收。
- `groma agent-instructions` 在本环境不可执行，未使用 Groma 架构索引；代码归属来自指定工程的只读资料和文件定位。
