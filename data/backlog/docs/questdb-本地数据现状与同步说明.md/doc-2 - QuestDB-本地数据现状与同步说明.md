---
id: doc-2
title: QuestDB 本地数据现状与同步说明
type: guide
created_date: '2026-11-12T13:39:00Z'
updated_date: '2026-11-12T13:47:00Z'
tags:
  - questdb
  - data-governance
  - sync
---
# QuestDB 本地数据现状与同步说明

> 采集时点：2026-11-12 13:47:06 UTC。范围仅为 `http://127.0.0.1:9000` 当前可读目录；所有操作均为只读。“有数据”不等于来源完整、可用于策略或同步正在运行。

## 结论

- 本地实例 HTTP 可用，目录中有 **165** 个对象、字段目录含 **3,440** 条字段记录。完整运行态目录分为：`doc-3`（A股/宏观/技术）、`doc-4`（美股/BTC）、`doc-5`（因子/回测/L2）。
- 数据域包括 A股/宏观、美股、BTC、因子回测和 L2；对象既有普通表也有视图。VIEW 没有独立存量，不能按零行判断为空数据。
- 代码约定 Java 是正式 QuestDB writer，Python 用于只读研究；策略、订单和成交记录保存在 SQLite。实际 writer、配置覆盖和成功账本仍须逐进程核验。
- 本次目录中未见 `table_suspended=true`。不少对象最大时间停留在 2026-08 至 2026-11；这是新鲜度候选，不能直接推出缺口或全市场不完整。

## 数据质量与验收边界

| 已知事实 | 不能据此推出 |
| --- | --- |
| `tables()` 显示行数、时间边界、WAL 待应用行数和对象类型 | 来源范围、历史连续性、业务键唯一性或策略可用 |
| HTTP 200、进程成功退出或 `MAX(timestamp)` 有值 | 同步成功、WAL 完全可见或逐字段正确 |
| `java_*`/`*_stage*` 可见 | 其为可消费正式表；不得按名称批量删除 |
| VIEW 的行数为零 | 底表为空；物化视图还需单独核对刷新与输入修订 |

正式验收必须同时具备来源范围/版本、完整业务键和值回读、`writerTxn == sequencerTxn`、`bufferedTxnSize == 0`、表未 suspended 及目标物理身份稳定。A 股、美股和 BTC 分别按其交易日或 UTC 日判断，不共用落后阈值。

## 同步方式与责任

| 数据域 | 代码定义入口 | 目标与观测证据 | 本次结论 |
| --- | --- | --- | --- |
| A股/财务 | `markets/cn/data-app`；正式任务 `data.<dataset>` | Java Sender(QWP/WebSocket)或 typed HTTP/ILP；账本、区间锁、读回 | 对象可读；运行开关、来源覆盖未确认 |
| A股 Batch | `platform/engine/batch` | 隔离 `jdb_test_*`；不能作为正式表成功证据 | 未作为正式同步判定 |
| 主策略后收盘 | `deploy/backtest-post-close` 与主策略 profile | QuestDB、账本、锁、缺口审计 | 当前调度/最近运行未在本次核验范围 |
| 美股 | `markets/us/data-app` 的 `UsCoreCollector`、`UsBroadDailyCollector` 等 | Java 写入、来源范围、逐字段回读 | 目录可读；全市场完整性未确认 |
| BTC | `markets/btc/data-app`、`tools/btc_daily.py` | Binance 原文、run/revision 报告、QuestDB 回读 | 应读取 `latest.json`/run 账本后再判定 |
| L2 | `deploy/l2-live` 独立链路 | SQLite 原始 journal、归一化 Parquet；QuestDB 仅用于明确链路 | QuestDB 目录不能代表完整 L2 档案 |

## 维护者巡检

1. 读取 `tables()`、`wal_tables()`，记录 suspended、pending rows、事务一致性和物理目录名。
2. 按指定时间列与业务键检查覆盖、重复、空值；公告/财务另分报告期、公告期和可用期。
3. 从同步账本取得范围、来源版本、响应摘要、锁和回读；缺失时标为“未确认”。
4. 业务消费前检查市场日历、点时可用性、来源范围和依赖表，不能只看单表最新日期。

## 证据与限制

- 运行态：本机 QuestDB HTTP `tables()` 与 `information_schema.columns`，采集于文首时点。
- 代码/规范：`F:\repo\engine\data\docs\questdb-usage.md`、`docs\formal-sync-takeover.md`、`docs\btc-data.md`、`docs\us-market-data.md`、`deploy\btc-data\README.md`、`deploy\backtest-post-close\README.md` 及其模块入口。
- 本次没有启动采集、写入、重启或修改数据库/WAL；不声称任何域“已完整同步”或“策略可用”。
- `groma agent-instructions` 在本环境不可执行，未使用 Groma 架构索引；代码归属来自指定工程的只读资料和文件定位。
