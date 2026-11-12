---
id: doc-5
title: QuestDB 运行态目录：因子、回测与L2对象
type: guide
created_date: '2026-11-12T13:43:00Z'
updated_date: '2026-11-12T13:46:00Z'
tags:
  - questdb
  - inventory
  - factor
  - l2
---
# QuestDB 运行态目录：因子、回测与L2对象

> 运行态快照，与主说明同一轮只读采集。字段摘要只列前四个字段；使用文末 SQL 获得完整字段和物理属性。

| 对象 | 类型 | 指定时间/分区 | 行数 | 最小至最大时间 | WAL待应用 | 字段摘要（前四个） |
| --- | --- | --- | ---: | --- | ---: | --- |
| `etf_factor` | TABLE | trade_date / YEAR | 1120693 | 2018-01-02T00:00:00.000000Z 至 2026-10-30T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, open:double precision, high:double precision … |
| `factor_catalog` | TABLE | updated_at / NONE | 233 | — | 0 | updated_at:timestamp, factor_id:varchar, definition_version:varchar, name_zh:varchar … |
| `factor_corr_snapshot` | TABLE | snapshot_date / MONTH | 92 | 2026-05-08T00:00:00.000000Z 至 2026-07-28T00:00:00.000000Z | 0 | snapshot_date:timestamp, factor_id_1:varchar, factor_id_2:varchar, definition_version:varchar … |
| `factor_daily_metric` | TABLE | trade_date / MONTH | 69527 | 2024-01-02T00:00:00.000000Z 至 2026-10-08T00:00:00.000000Z | 0 | trade_date:timestamp, universe_id:varchar, universe_version:varchar, factor_id:varchar … |
| `factor_definition` | TABLE | registered_at / NONE | 1550 | — | 0 | registered_at:timestamp, factor_id:varchar, definition_version:varchar, name_zh:varchar … |
| `factor_dependency` | TABLE | registered_at / YEAR | 1707 | 2026-07-29T13:32:46.000000Z 至 2026-08-05T20:13:23.000000Z | 0 | registered_at:timestamp, factor_id:varchar, definition_version:varchar, dependency_id:varchar … |
| `factor_ic_daily` | TABLE | trade_date / MONTH | 396586 | 2025-07-01T00:00:00.000000Z 至 2026-08-03T00:00:00.000000Z | 0 | trade_date:timestamp, factor_id:varchar, universe_id:varchar, signal_date:timestamp … |
| `factor_materialization_run` | TABLE | period_end / MONTH | 44724 | 2025-01-20T00:00:00.000000Z 至 2026-08-05T00:00:00.000000Z | 0 | period_end:timestamp, period_start:timestamp, factor_id:varchar, definition_version:varchar … |
| `factor_monitor_daily` | TABLE | signal_date / MONTH | 129944 | 2025-07-01T00:00:00.000000Z 至 2026-09-09T00:00:00.000000Z | 0 | signal_date:timestamp, maturity_date:timestamp, factor_id:varchar, definition_version:varchar … |
| `factor_monitor_summary` | TABLE | as_of_date / YEAR | 120020 | 2026-07-31T00:00:00.000000Z 至 2026-09-11T00:00:00.000000Z | 0 | as_of_date:timestamp, factor_id:varchar, definition_version:varchar, universe_id:varchar … |
| `factor_observation` | TABLE | signal_date / MONTH | 689643504 | 2023-01-03T00:00:00.000000Z 至 2026-10-09T00:00:00.000000Z | 0 | signal_date:timestamp, entity_type:varchar, entity_id:varchar, factor_id:varchar … |
| `factor_platform_run` | TABLE | run_at / YEAR | 89 | 2026-05-23T22:28:46.415302Z 至 2026-08-05T20:13:23.000000Z | 0 | run_at:timestamp, run_id:varchar, consumer:varchar, start_date:timestamp … |
| `factor_regime_daily` | TABLE | trade_date / MONTH | 17734 | 2025-07-01T00:00:00.000000Z 至 2026-07-27T00:00:00.000000Z | 0 | trade_date:timestamp, factor_id:varchar, universe_id:varchar, definition_version:varchar … |
| `factor_registry` | TABLE | updated_at / NONE | 2251 | — | 0 | updated_at:timestamp, run_id:varchar, factor_id:varchar, definition_version:varchar … |
| `factor_usage` | TABLE | observed_at / YEAR | 228 | 2026-07-29T13:32:46.000000Z 至 2026-08-05T20:13:23.000000Z | 0 | observed_at:timestamp, factor_id:varchar, definition_version:varchar, consumer_type:varchar … |
| `factor_validation_daily` | TABLE | trade_date / MONTH | 525 | 2026-07-08T00:00:00.000000Z 至 2026-07-28T00:00:00.000000Z | 0 | trade_date:timestamp, factor_id:varchar, universe_id:varchar, definition_version:varchar … |
| `l2_daily_features` | TABLE | ts / DAY | 5111050 | 2023-01-03T00:00:00.000000Z 至 2026-11-06T00:00:00.000000Z | 0 | ts:timestamp, symbol:varchar, has_deal:boolean, has_order:boolean … |
| `l2_dataset_manifest` | TABLE | trade_date_ts / DAY | 657003 | 2026-02-02T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | trade_date:varchar, symbol:varchar, market:varchar, board:varchar … |
| `l2_event_response_features` | TABLE | minute / DAY | 114123728 | 2026-02-02T01:15:00.000000Z 至 2026-09-21T07:00:00.000000Z | 0 | trade_date:varchar, symbol:varchar, market:varchar, board:varchar … |
| `l2_intraday_bar_features` | TABLE | minute / DAY | 158752546 | 2026-02-02T01:14:00.000000Z 至 2026-09-21T07:00:00.000000Z | 0 | trade_date:varchar, symbol:varchar, market:varchar, board:varchar … |
| `l2_live_normalized_events` | TABLE | recv_ts / DAY | 26531701 | 2026-07-17T09:15:14.004569Z 至 2026-10-14T15:01:39.571501Z | 0 | vendor:varchar, recv_ts:timestamp, trade_date:varchar, exchange_ts:timestamp … |
| `l2_t0_training_labels` | TABLE | minute / DAY | 181049686 | 2026-01-08T00:15:00.000000Z 至 2026-09-21T07:00:00.000000Z | 0 | trade_date:varchar, symbol:varchar, market:varchar, board:varchar … |
| `stk_factor` | TABLE | trade_date / YEAR | 10416165 | 2010-01-29T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, close:double precision, open:double precision … |

## 完整结构复现

```sql
SELECT table_name, column_name, ordinal_position, data_type
FROM information_schema.columns
ORDER BY table_name, ordinal_position;

SHOW COLUMNS FROM <table_name>;
```

`SHOW COLUMNS` 还列出 indexed、designated、upsertKey。对于 VIEW，应同时读取其定义；对于 MATERIALIZED VIEW，应另行核对刷新和输入修订。
