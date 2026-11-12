---
id: doc-4
title: QuestDB 运行态目录：美股与BTC对象
type: guide
created_date: '2026-11-12T13:43:00Z'
updated_date: '2026-11-12T13:46:00Z'
tags:
  - questdb
  - inventory
  - us
  - btc
---
# QuestDB 运行态目录：美股与BTC对象

> 运行态快照，与主说明同一轮只读采集。字段摘要只列前四个字段；使用文末 SQL 获得完整字段和物理属性。

| 对象 | 类型 | 指定时间/分区 | 行数 | 最小至最大时间 | WAL待应用 | 字段摘要（前四个） |
| --- | --- | --- | ---: | --- | ---: | --- |
| `btc_funding` | TABLE | funding_time / MONTH | 7512 | 2020-01-01T00:00:00.000000Z 至 2026-11-08T16:00:00.000000Z | 0 | funding_time:timestamp, exchange:varchar, symbol:varchar, instrument:varchar … |
| `btc_index_1h` | TABLE | open_time / MONTH | 59736 | 2020-01-01T00:00:00.000000Z 至 2026-11-08T23:00:00.000000Z | 0 | open_time:timestamp, exchange:varchar, symbol:varchar, instrument:varchar … |
| `btc_mark_1h` | TABLE | open_time / MONTH | 59832 | 2020-01-01T00:00:00.000000Z 至 2026-11-08T23:00:00.000000Z | 0 | open_time:timestamp, exchange:varchar, symbol:varchar, instrument:varchar … |
| `btc_perp_1h` | TABLE | open_time / MONTH | 60072 | 2020-01-01T00:00:00.000000Z 至 2026-11-08T23:00:00.000000Z | 0 | open_time:timestamp, exchange:varchar, symbol:varchar, instrument:varchar … |
| `btc_spot_1d` | TABLE | open_time / MONTH | 2504 | 2020-01-01T00:00:00.000000Z 至 2026-11-08T00:00:00.000000Z | 0 | open_time:timestamp, exchange:varchar, symbol:varchar, instrument:varchar … |
| `btc_spot_1h` | TABLE | open_time / MONTH | 59680 | 2020-01-01T00:00:00.000000Z 至 2026-10-23T23:00:00.000000Z | 0 | open_time:timestamp, exchange:varchar, symbol:varchar, instrument:varchar … |
| `us_equity_daily` | TABLE | trade_date / YEAR | 45587506 | 2006-01-03T00:00:00.000000Z 至 2026-11-11T00:00:00.000000Z | 0 | trade_date:timestamp, symbol:varchar, provider:varchar, venue:varchar … |
| `us_equity_intraday` | TABLE | ts / MONTH | 1677312 | 2026-01-02T14:30:00.000000Z 至 2026-11-11T20:59:00.000000Z | 0 | ts:timestamp, trade_date:timestamp, symbol:varchar, provider:varchar … |
| `us_equity_intraday_regular` | VIEW | ts / N/A | 0 | — | 0 | ts:timestamp, trade_date:timestamp, symbol:varchar, provider:varchar … |
| `us_etf_equity_holdings` | TABLE | asof_date / YEAR | 604 | 2026-10-16T00:00:00.000000Z 至 2026-10-16T00:00:00.000000Z | 0 | asof_date:timestamp, fund:varchar, symbol:varchar, issuer:varchar … |
| `us_index_daily` | TABLE | trade_date / YEAR | 5279 | 2006-01-03T00:00:00.000000Z 至 2026-11-09T00:00:00.000000Z | 0 | trade_date:timestamp, symbol:varchar, provider:varchar, close:double precision … |
| `us_market_daily` | TABLE | trade_date / YEAR | 13119 | 2006-01-03T00:00:00.000000Z 至 2026-11-11T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, close:double precision, source_id:varchar … |
| `us_security_history_catalog` | TABLE | observed_at / YEAR | 51629 | 2026-10-19T16:36:21.068445Z 至 2026-10-19T16:36:21.068445Z | 0 | source_row:bigint, observed_at:timestamp, symbol:varchar, exchange:varchar … |
| `us_security_identifiers` | TABLE | observed_at / YEAR | 72 | 2026-10-20T00:36:36.571256Z 至 2026-10-22T08:43:46.411168Z | 0 | observed_at:timestamp, provider:varchar, security_id:varchar, price_symbol:varchar … |
| `us_security_universe` | TABLE | observed_at / YEAR | 13306 | 2026-10-19T16:36:21.935815Z 至 2026-10-19T16:36:22.032479Z | 0 | observed_at:timestamp, symbol:varchar, directory:varchar, security_name:varchar … |
| `us_tbr` | TABLE | date / YEAR | 224038 | 2018-03-27T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | date:timestamp, w4_bd:double precision, w4_ce:double precision, w8_bd:double precision … |
| `us_tltr` | TABLE | date / YEAR | 224038 | 2018-03-27T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | date:timestamp, ltc:double precision, cmt:double precision, e_factor:double precision |
| `us_trltr` | TABLE | date / YEAR | 224038 | 2018-03-27T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | date:timestamp, ltr_avg:double precision |
| `us_trycr` | TABLE | date / YEAR | 224038 | 2018-03-26T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | date:timestamp, y5:double precision, y7:double precision, y10:double precision … |
| `us_tycr` | TABLE | date / YEAR | 224038 | 2018-03-27T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | date:timestamp, m1:double precision, m2:double precision, m3:double precision … |

## 完整结构复现

```sql
SELECT table_name, column_name, ordinal_position, data_type
FROM information_schema.columns
ORDER BY table_name, ordinal_position;

SHOW COLUMNS FROM <table_name>;
```

`SHOW COLUMNS` 还列出 indexed、designated、upsertKey。对于 VIEW，应同时读取其定义；对于 MATERIALIZED VIEW，应另行核对刷新和输入修订。
