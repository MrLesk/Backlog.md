---
id: doc-3
title: QuestDB 运行态目录：A股、宏观与技术对象
type: guide
created_date: '2026-11-12T13:43:00Z'
updated_date: '2026-11-12T13:51:00Z'
tags:
  - questdb
  - inventory
  - cn
---
# QuestDB 运行态目录：A股、宏观与技术对象

> 运行态快照。等级表示维护优先级，不表示完整性、正确性或自动同步已经验收。

| 等级 | 对象 | 类型 | 指定时间/分区 | 行数 | 最小至最大时间 | WAL待应用 | 字段摘要（前四个） |
| --- | --- | --- | --- | ---: | --- | ---: | --- |
| 扩展 | `balance` | TABLE | ann_date / YEAR | 173145 | 2018-04-04T00:00:00.000000Z 至 2026-08-28T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, f_ann_date:varchar, end_date:varchar … |
| 扩展 | `block_trade` | TABLE | trade_date / YEAR | 239985 | 2018-01-02T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, price:double precision, vol:double precision … |
| 扩展 | `broker_recommend` | TABLE | month / YEAR | 13696 | 2020-03-01T00:00:00.000000Z 至 2026-09-01T00:00:00.000000Z | 0 | month:timestamp, broker:varchar, ts_code:varchar, name:varchar |
| 扩展 | `cashflow` | TABLE | ann_date / YEAR | 164525 | 2018-04-04T00:00:00.000000Z 至 2026-08-28T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, f_ann_date:varchar, end_date:varchar … |
| 扩展 | `cn_bond_yield_curve` | TABLE | trade_date / YEAR | 96580 | 2010-01-04T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | trade_date:timestamp, curve_name:varchar, curve_code:varchar, tenor:varchar … |
| 扩展 | `cn_cpi` | TABLE | month / YEAR | 200 | 2010-01-01T00:00:00.000000Z 至 2026-08-01T00:00:00.000000Z | 0 | month:timestamp, nt_val:double precision, nt_yoy:double precision, nt_mom:double precision … |
| 扩展 | `cn_gdp` | TABLE | report_date / YEAR | 66 | 2010-03-31T00:00:00.000000Z 至 2026-06-30T00:00:00.000000Z | 0 | quarter:varchar, report_date:timestamp, gdp:double precision, gdp_yoy:double precision … |
| 扩展 | `cn_m` | TABLE | month / YEAR | 200 | 2010-01-01T00:00:00.000000Z 至 2026-08-01T00:00:00.000000Z | 0 | month:timestamp, m0:double precision, m0_yoy:double precision, m0_mom:double precision … |
| 扩展 | `cn_pmi` | TABLE | month / YEAR | 200 | 2010-01-01T00:00:00.000000Z 至 2026-08-01T00:00:00.000000Z | 0 | month:timestamp, pmi010000:double precision, pmi010100:double precision, pmi010200:double precision … |
| 扩展 | `cn_ppi` | TABLE | month / YEAR | 200 | 2010-01-01T00:00:00.000000Z 至 2026-08-01T00:00:00.000000Z | 0 | month:timestamp, ppi_yoy:double precision, ppi_mp_yoy:double precision, ppi_mp_qm_yoy:double precision … |
| 派生/编译 | `company_intrinsic_valuation_consensus` | TABLE | valuation_date / MONTH | 4573049 | 2023-01-03T00:00:00.000000Z 至 2026-08-07T00:00:00.000000Z | 0 | valuation_date:timestamp, ts_code:varchar, name:varchar, industry_l2:varchar … |
| 派生/编译 | `company_intrinsic_valuation_model` | TABLE | valuation_date / MONTH | 15888188 | 2023-01-03T00:00:00.000000Z 至 2026-08-07T00:00:00.000000Z | 0 | valuation_date:timestamp, ts_code:varchar, name:varchar, industry_l2:varchar … |
| 扩展 | `crypto_data_gap_events` | TABLE | ts / MONTH | 2 | 2023-03-24T13:00:00.000000Z 至 2023-03-24T13:00:00.000000Z | 0 | ts:timestamp, gap_until:timestamp, exchange:varchar, symbol:varchar … |
| 扩展 | `crypto_ohlcv` | TABLE | ts / MONTH | 373598 | 2021-10-01T00:00:00.000000Z 至 2026-11-11T23:00:00.000000Z | 0 | ts:timestamp, exchange:varchar, symbol:varchar, instrument:varchar … |
| 扩展 | `cyq_chips` | TABLE | trade_date / YEAR | 1090577 | 2018-01-02T00:00:00.000000Z 至 2026-09-11T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, price:unknown, percent:unknown |
| 扩展 | `cyq_perf` | TABLE | trade_date / YEAR | 9704106 | 2018-01-02T00:00:00.000000Z 至 2026-09-30T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, winner_rate:double precision, weight_avg:double precision … |
| 核心候选 | `daily` | TABLE | trade_date / YEAR | 9943738 | 2018-01-02T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, open:double precision, high:double precision … |
| 核心候选 | `daily_basic` | TABLE | trade_date / YEAR | 10108196 | 2010-01-29T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, close:double precision, turnover_rate:double precision … |
| 扩展 | `daily_stock_analysis` | TABLE | updated_at / MONTH | 5399 | 2026-04-10T23:32:16.852378Z 至 2026-04-15T18:01:12.814883Z | 0 | ts_code:varchar, analysis_date:timestamp, content:varchar, model_name:varchar … |
| 扩展 | `dc_index` | TABLE | trade_date / YEAR | 186622 | 2026-01-05T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, name:varchar, leading:varchar … |
| 扩展 | `disclosure_date` | TABLE | ann_date / YEAR | 326396 | 2010-03-10T00:00:00.000000Z 至 2026-09-24T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, end_date:varchar, pre_date:varchar … |
| 扩展 | `dividend` | TABLE | ann_date / YEAR | 115186 | 1991-03-17T00:00:00.000000Z 至 2026-09-05T00:00:00.000000Z | 0 | ts_code:varchar, end_date:varchar, ann_date:timestamp, div_proc:varchar … |
| 扩展 | `eco_cal` | TABLE | date / YEAR | 248673 | 2010-01-01T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | date:timestamp, time:varchar, currency:varchar, country:varchar … |
| 扩展 | `equity_style_monthly` | TABLE | month / YEAR | 198 | 2010-01-01T00:00:00.000000Z 至 2026-08-01T00:00:00.000000Z | 0 | month:timestamp, hs300_ret_1m:double precision, zz500_ret_1m:double precision, all_a_ret_1m:double precision … |
| 核心候选 | `etf_adj` | TABLE | timestamp / YEAR | 1637673 | 2018-01-02T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | ts_code:varchar, adj_factor:double precision, timestamp:timestamp |
| 核心候选 | `etf_basic` | TABLE | timestamp / YEAR | 2958 | 1970-01-01T00:00:00.000000Z 至 1970-01-01T00:00:00.000000Z | 0 | ts_code:varchar, name:varchar, management:varchar, custodian:varchar … |
| 核心候选 | `etf_daily` | TABLE | timestamp / YEAR | 2187104 | 2018-01-02T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | ts_code:varchar, timestamp:timestamp, pre_close:double precision, open:double precision … |
| 扩展 | `etf_portfolio` | TABLE | end_date / YEAR | 6543358 | 2021-12-30T00:00:00.000000Z 至 2026-09-30T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, end_date:timestamp, symbol:varchar … |
| 扩展 | `etf_share` | TABLE | timestamp / YEAR | 326396 | 2018-01-02T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | ts_code:varchar, timestamp:timestamp, fd_share:double precision, fund_type:varchar … |
| 核心候选 | `exchange_calendar` | TABLE | cal_date / YEAR | 26668 | 1990-12-19T00:00:00.000000Z 至 2027-09-27T00:00:00.000000Z | 0 | exchange:varchar, cal_date:timestamp, is_open:integer, pretrade_date:varchar |
| 扩展 | `express` | TABLE | ann_date / YEAR | 14205 | 2018-04-03T00:00:00.000000Z 至 2026-08-25T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, end_date:varchar, revenue:double precision … |
| 扩展 | `fina_audit` | TABLE | ann_date / YEAR | 77060 | 2010-01-05T00:00:00.000000Z 至 2026-05-29T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, end_date:varchar, audit_result:varchar … |
| 扩展 | `fina_indicator` | TABLE | ann_date / YEAR | 197174 | 2018-04-04T00:00:00.000000Z 至 2026-09-23T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, end_date:varchar, eps:double precision … |
| 扩展 | `fina_mainbz` | TABLE | end_date / YEAR | 364757 | 2018-03-31T00:00:00.000000Z 至 2026-06-30T00:00:00.000000Z | 0 | ts_code:varchar, end_date:timestamp, bz_item:varchar, bz_sales:double precision … |
| 扩展 | `forecast` | TABLE | ann_date / YEAR | 57417 | 2018-01-15T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, end_date:varchar, type:varchar … |
| 扩展 | `ft_limit` | TABLE | trade_date / YEAR | 2128 | 2026-03-12T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | trade_date:timestamp, ts_code:varchar, name:varchar, up_limit:double precision … |
| 扩展 | `fut_basic` | TABLE | timestamp / YEAR | 720 | 1970-01-01T00:00:00.000000Z 至 1970-01-01T00:00:00.000000Z | 0 | ts_code:varchar, symbol:varchar, exchange:varchar, name:varchar … |
| 扩展 | `fut_daily` | TABLE | trade_date / YEAR | 4712 | 2026-03-12T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, pre_close:double precision, pre_settle:double precision … |
| 扩展 | `fut_holding` | TABLE | trade_date / MONTH | 56692 | 2026-03-12T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | trade_date:timestamp, symbol:varchar, broker:varchar, vol:bigint … |
| 扩展 | `fut_index_conclusion_daily` | TABLE | trade_date / MONTH | 528 | 2026-03-12T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | trade_date:timestamp, fut_code:varchar, main_ts_code:varchar, mapping_ts_code:varchar … |
| 扩展 | `fut_index_daily_snapshot` | TABLE | trade_date / MONTH | 528 | 2026-03-12T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | trade_date:timestamp, fut_code:varchar, main_ts_code:varchar, mapping_ts_code:varchar … |
| 扩展 | `fut_index_signal_daily` | TABLE | trade_date / MONTH | 528 | 2026-03-12T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | trade_date:timestamp, fut_code:varchar, main_ts_code:varchar, mapping_ts_code:varchar … |
| 扩展 | `fut_mapping` | TABLE | trade_date / YEAR | 532 | 2026-03-12T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, mapping_ts_code:varchar, update_time:timestamp |
| 扩展 | `fut_settle` | TABLE | trade_date / YEAR | 2000 | 2026-03-24T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, settle:double precision, trading_fee_rate:double precision … |
| 扩展 | `hibor` | TABLE | timestamp / YEAR | 2138 | 2018-01-02T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | timestamp:timestamp, on:double precision, 1w:double precision, 2w:double precision … |
| 扩展 | `income` | TABLE | ann_date / YEAR | 177762 | 2018-04-04T00:00:00.000000Z 至 2026-08-29T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, f_ann_date:varchar, end_date:varchar … |
| 扩展 | `index` | TABLE | import_time / MONTH | 2274 | 2026-04-02T13:14:45.221299Z 至 2026-04-02T13:14:45.221299Z | 0 | index_code:varchar, index_short_name:varchar, index_full_name:varchar, base_date:varchar … |
| 扩展 | `index_daily_basic` | TABLE | trade_date / YEAR | 42588 | 2004-01-02T00:00:00.000000Z 至 2026-08-03T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, total_mv:double precision, float_mv:double precision … |
| 扩展 | `index_daily_market` | TABLE | trade_date / YEAR | 234292 | 2010-01-04T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, close:double precision, open:double precision … |
| 扩展 | `index_member` | TABLE | update_time / YEAR | 5902 | 2026-09-11T19:54:48.297652Z 至 2026-09-11T19:54:57.559719Z | 0 | index_code:varchar, ts_code:varchar, update_time:timestamp, index_name:varchar … |
| 扩展 | `index_monthly` | TABLE | trade_date / YEAR | 6506 | 2010-01-29T00:00:00.000000Z 至 2026-08-31T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, close:double precision, open:double precision … |
| 扩展 | `index_weight` | TABLE | trade_date / YEAR | 261221 | 2018-01-31T00:00:00.000000Z 至 2026-09-30T00:00:00.000000Z | 0 | index_code:varchar, con_code:varchar, trade_date:timestamp, index_name:varchar … |
| 扩展 | `industry_intrinsic_valuation_state` | TABLE | valuation_date / MONTH | 114101 | 2023-01-03T00:00:00.000000Z 至 2026-08-07T00:00:00.000000Z | 0 | valuation_date:timestamp, industry_l2:varchar, route_id:varchar, industry_intrinsic_upside:double precision … |
| 扩展 | `industry_valuation_materialization_run` | TABLE | created_at / MONTH | 91 | 2026-08-08T13:36:06.138634Z 至 2026-08-08T14:21:43.516195Z | 0 | created_at:timestamp, run_id:varchar, status:varchar, start_date:timestamp … |
| 扩展 | `industry_valuation_membership_conflict` | TABLE | valuation_date / MONTH | 2428 | 2026-01-30T00:00:00.000000Z 至 2026-08-07T00:00:00.000000Z | 0 | valuation_date:timestamp, ts_code:varchar, active_industries:integer, route_version:varchar … |
| 扩展 | `industry_valuation_route_assignment` | TABLE | effective_from / MONTH | 465 | 2023-01-01T00:00:00.000000Z 至 2023-01-01T00:00:00.000000Z | 0 | effective_from:timestamp, industry_l2:varchar, route_id:varchar, forecast_style:varchar … |
| 备份/临时 | `java_d027_moneyflow_hsgt_backup_171e433d9eec41e08fdd24fad13ecf6c` | TABLE | trade_date / DAY | 447 | 2024-11-22T00:00:00.000000Z 至 2026-10-16T00:00:00.000000Z | 0 | trade_date:timestamp, ggt_ss:double precision, ggt_sz:double precision, hgt:double precision … |
| 备份/临时 | `java_d027_moneyflow_hsgt_backup_c5a901007c5f4259991930142b3ecf08` | TABLE | trade_date / DAY | 442 | 2024-11-22T00:00:00.000000Z 至 2026-10-09T00:00:00.000000Z | 0 | trade_date:timestamp, ggt_ss:double precision, ggt_sz:double precision, hgt:double precision … |
| 备份/临时 | `java_d027_moneyflow_hsgt_backup_f27d9242bd3445f5b21ad28799f5679b` | TABLE | trade_date / DAY | 461 | 2024-11-22T00:00:00.000000Z 至 2026-11-06T00:00:00.000000Z | 0 | trade_date:timestamp, ggt_ss:double precision, ggt_sz:double precision, hgt:double precision … |
| 备份/临时 | `java_d121_market_sentiment_daily_backup_0b2e74a364174a6e9720f64e685aff6f` | TABLE | trade_date / MONTH | 309 | 2025-07-01T00:00:00.000000Z 至 2026-10-09T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, sentiment_score:double precision, sentiment_score_core:double precision … |
| 备份/临时 | `java_d121_market_sentiment_daily_backup_546ce4c8b7474719a87d8850d3730caf` | TABLE | trade_date / MONTH | 106 | 2026-05-06T00:00:00.000000Z 至 2026-10-09T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, sentiment_score:double precision, sentiment_score_core:double precision … |
| 备份/临时 | `java_d121_market_sentiment_daily_backup_7a27f32538cf48f8842e60f15f82be51` | TABLE | trade_date / MONTH | 329 | 2025-07-01T00:00:00.000000Z 至 2026-11-06T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, sentiment_score:double precision, sentiment_score_core:double precision … |
| 备份/临时 | `java_d121_market_sentiment_daily_backup_8a4e77b8c45e4e9e8a71772960c39e27` | TABLE | trade_date / MONTH | 314 | 2025-07-01T00:00:00.000000Z 至 2026-10-16T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, sentiment_score:double precision, sentiment_score_core:double precision … |
| 备份/临时 | `java_d121_market_sentiment_daily_backup_c63004257211492ea21309821bd448ce` | TABLE | trade_date / MONTH | 314 | 2025-07-01T00:00:00.000000Z 至 2026-10-16T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, sentiment_score:double precision, sentiment_score_core:double precision … |
| 备份/临时 | `java_d121_market_sentiment_daily_backup_cd15e52f428a489ba563859205ff0504` | TABLE | trade_date / MONTH | 314 | 2025-07-01T00:00:00.000000Z 至 2026-10-16T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, sentiment_score:double precision, sentiment_score_core:double precision … |
| 备份/临时 | `java_regime_features_monitor_daily_backup_33c268e276274f6f905f2321afcf68f3` | TABLE | trade_date / MONTH | 673 | 2024-01-02T00:00:00.000000Z 至 2026-10-16T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, hs300_ret_mtd:double precision, zz500_ret_mtd:double precision … |
| 备份/临时 | `java_regime_features_monitor_daily_backup_5cdacca2f0084a3195ae54a33ae4e3bb` | TABLE | trade_date / MONTH | 688 | 2024-01-02T00:00:00.000000Z 至 2026-11-06T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, hs300_ret_mtd:double precision, zz500_ret_mtd:double precision … |
| 备份/临时 | `java_regime_features_monitor_daily_backup_60087d60fd17437f93d75bcd3baa4f2c` | TABLE | trade_date / MONTH | 687 | 2024-01-02T00:00:00.000000Z 至 2026-11-06T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, hs300_ret_mtd:double precision, zz500_ret_mtd:double precision … |
| 备份/临时 | `java_regime_features_monitor_daily_backup_619dcb393c3640bba1ec8f09d582afce` | TABLE | trade_date / MONTH | 673 | 2024-01-02T00:00:00.000000Z 至 2026-10-16T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, hs300_ret_mtd:double precision, zz500_ret_mtd:double precision … |
| 备份/临时 | `java_regime_features_monitor_daily_backup_6a89cf7c843d464f9613f6fc4878b9cd` | TABLE | trade_date / MONTH | 678 | 2024-01-02T00:00:00.000000Z 至 2026-11-06T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, hs300_ret_mtd:double precision, zz500_ret_mtd:double precision … |
| 备份/临时 | `java_regime_features_monitor_daily_backup_9d105f4864fe4a27a726cd311ecdbcb9` | TABLE | trade_date / MONTH | 673 | 2024-01-02T00:00:00.000000Z 至 2026-10-16T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, hs300_ret_mtd:double precision, zz500_ret_mtd:double precision … |
| 备份/临时 | `java_regime_features_monitor_daily_backup_dad4af28f32d48a5a1c408ec156be54e` | TABLE | trade_date / MONTH | 668 | 2024-01-02T00:00:00.000000Z 至 2026-10-09T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, hs300_ret_mtd:double precision, zz500_ret_mtd:double precision … |
| 备份/临时 | `java_stk_suspend_backup_1f4f2e04f7b24b5a81b1afa24234754c` | TABLE | timestamp / DAY | 128616 | 2010-01-29T00:00:00.000000Z 至 2026-11-06T00:00:00.000000Z | 0 | ts_code:varchar, is_suspended:bigint, timestamp:timestamp |
| 备份/临时 | `java_stk_suspend_backup_49f8a3b468c34e82b2e650454e12508b` | TABLE | timestamp / DAY | 128596 | 2010-01-29T00:00:00.000000Z 至 2026-11-06T00:00:00.000000Z | 0 | ts_code:varchar, is_suspended:bigint, timestamp:timestamp |
| 备份/临时 | `java_stk_suspend_backup_80dc8be12ad74de7b1dcad43d9e64d40` | TABLE | timestamp / DAY | 128556 | 2010-01-29T00:00:00.000000Z 至 2026-11-06T00:00:00.000000Z | 0 | ts_code:varchar, is_suspended:bigint, timestamp:timestamp |
| 备份/临时 | `java_stock_detail_backup_5a591717ea0646aea2c5abff0d62defd` | TABLE |  / NONE | 5912 | — | 0 | ts_code:varchar, update_time:timestamp, symbol:varchar, name:varchar … |
| 扩展 | `macro_core_monthly` | TABLE | month / YEAR | 200 | 2010-01-01T00:00:00.000000Z 至 2026-08-01T00:00:00.000000Z | 0 | month:timestamp, cpi_yoy:double precision, ppi_yoy:double precision, pmi_mfg:double precision … |
| 扩展 | `macro_liquidity_credit_monthly` | TABLE | month / YEAR | 201 | 2010-01-01T00:00:00.000000Z 至 2026-09-01T00:00:00.000000Z | 0 | month:timestamp, rmb_index_month_end:double precision, rmb_index_ret_1m:double precision, shibor_on_month_avg:double precision … |
| 扩展 | `margin_all` | TABLE | trade_date / YEAR | 4722 | 2023-01-03T00:00:00.000000Z 至 2026-03-19T00:00:00.000000Z | 0 | trade_date:timestamp, exchange_id:varchar, rzye:double precision, rzmre:double precision … |
| 扩展 | `margin_detail` | TABLE | trade_date / YEAR | 3693244 | 2023-01-03T00:00:00.000000Z 至 2026-11-09T00:00:00.000000Z | 0 | trade_date:timestamp, ts_code:varchar, name:varchar, rzye:double precision … |
| 扩展 | `margin_secs` | TABLE | trade_date / YEAR | 1618079 | 2025-03-03T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | trade_date:timestamp, ts_code:varchar, name:varchar, exchange:varchar |
| 扩展 | `margin_trading` | TABLE | trade_date / YEAR | 181140 | 2026-01-05T00:00:00.000000Z 至 2026-03-11T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, rzye:double precision, rzmre:double precision … |
| 扩展 | `margin_zrz` | TABLE | trade_date / YEAR | 1238 | 2023-01-03T00:00:00.000000Z 至 2025-07-25T00:00:00.000000Z | 0 | trade_date:timestamp, ob:double precision, auc_amount:double precision, repo_amount:double precision … |
| 扩展 | `market_breadth_monthly` | TABLE | month / YEAR | 201 | 2010-01-01T00:00:00.000000Z 至 2026-09-01T00:00:00.000000Z | 0 | month:timestamp, avg_up_count:double precision, avg_down_count:double precision, avg_flat_count:double precision … |
| 扩展 | `market_sentiment_daily` | TABLE | trade_date / MONTH | 331 | 2025-07-01T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, sentiment_score:double precision, sentiment_score_core:double precision … |
| 扩展 | `moneyflow` | TABLE | trade_date / YEAR | 4765098 | 2023-01-03T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, buy_sm_vol:bigint, buy_sm_amount:double precision … |
| 扩展 | `moneyflow_dc` | TABLE | trade_date / YEAR | 3478841 | 2023-09-11T00:00:00.000000Z 至 2026-03-20T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, name:varchar, pct_change:double precision … |
| 扩展 | `moneyflow_hsgt` | TABLE | trade_date / DAY | 463 | 2024-11-22T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | trade_date:timestamp, ggt_ss:double precision, ggt_sz:double precision, hgt:double precision … |
| 扩展 | `moneyflow_ths` | TABLE | trade_date / YEAR | 2136439 | 2024-12-24T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, name:varchar, pct_change:double precision … |
| 扩展 | `mv_backtest_daily` | MATERIALIZED VIEW | trade_date / MONTH | 10534344 | 2010-01-29T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | trade_date:timestamp, ts_code:varchar, open:double precision, high:double precision … |
| 扩展 | `mv_etf_market_overview_daily` | MATERIALIZED VIEW | trade_date / MONTH | 2117 | 2018-01-02T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | trade_date:timestamp, etf_count:bigint, total_share:double precision, total_size_yi:double precision |
| 扩展 | `mv_market_breadth_daily` | MATERIALIZED VIEW | trade_date / MONTH | 2243 | 2010-01-29T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | trade_date:timestamp, stock_count:bigint, up_count:bigint, down_count:bigint … |
| 扩展 | `mv_retail_sentiment_daily` | MATERIALIZED VIEW | trade_date / MONTH | 929 | 2023-01-03T00:00:00.000000Z 至 2026-11-06T00:00:00.000000Z | 0 | trade_date:timestamp, avg_retail_ratio:double precision, avg_retail_entropy:double precision, total_retail_amount_yi:double precision … |
| 扩展 | `pledge_stat` | TABLE | end_date / YEAR | 1328794 | 2018-01-05T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | ts_code:varchar, end_date:timestamp, pledge_count:bigint, unrest_pledge:double precision … |
| 扩展 | `prediction_definition_v1` | TABLE | registered_at / YEAR | 8 | 2026-07-30T00:00:00.000000Z 至 2026-07-30T00:00:00.000000Z | 0 | registered_at:timestamp, prediction_id:varchar, definition_version:varchar, name_zh:varchar … |
| 扩展 | `qmt_1m_bars` | TABLE | bar_time / DAY | 4873 | 2026-03-27T10:08:00.000000Z 至 2026-07-06T09:46:00.000000Z | 0 | ts_code:varchar, bar_time:timestamp, period:varchar, open:double precision … |
| 扩展 | `regime_display_materialization_run` | TABLE | started_at / MONTH | 16 | 2026-08-04T03:44:13.000000Z 至 2026-08-04T03:45:36.000000Z | 0 | started_at:timestamp, run_id:varchar, metric_id:varchar, mode:varchar … |
| 扩展 | `regime_erp_source_status_daily` | TABLE | evaluation_date / YEAR | 1 | 2026-08-04T00:00:00.000000Z 至 2026-08-04T00:00:00.000000Z | 0 | evaluation_date:timestamp, evaluated_at:timestamp, source_id:varchar, index_id:varchar … |
| 扩展 | `regime_features_monitor_daily` | TABLE | trade_date / MONTH | 690 | 2024-01-02T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | trade_date:timestamp, month:varchar, hs300_ret_mtd:double precision, zz500_ret_mtd:double precision … |
| 扩展 | `regime_features_monthly` | TABLE | month / YEAR | 201 | 2010-01-01T00:00:00.000000Z 至 2026-09-01T00:00:00.000000Z | 0 | month:timestamp, hs300_ret_1m:double precision, zz500_ret_1m:double precision, all_a_ret_1m:double precision … |
| 扩展 | `regime_margin_leverage_daily` | TABLE | trade_date / YEAR | 866 | 2023-01-03T00:00:00.000000Z 至 2026-07-31T00:00:00.000000Z | 0 | trade_date:timestamp, margin_balance:double precision, free_float_market_cap:double precision, margin_ratio:double precision … |
| 扩展 | `regime_market_monthly` | TABLE | month / YEAR | 201 | 2010-01-01T00:00:00.000000Z 至 2026-09-01T00:00:00.000000Z | 0 | month:timestamp, northbound_net_buy_1m:double precision, margin_balance_month_end:double precision, margin_balance_change_1m:double precision … |
| 扩展 | `regime_stock_return_distribution_daily` | TABLE | as_of / YEAR | 14 | 2026-08-03T00:00:00.000000Z 至 2026-08-03T00:00:00.000000Z | 0 | as_of:timestamp, window:varchar, window_start_as_of:timestamp, bucket_order:integer … |
| 扩展 | `repurchase` | TABLE | ann_date / YEAR | 64498 | 2018-01-03T00:00:00.000000Z 至 2026-09-19T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, end_date:varchar, proc:varchar … |
| 扩展 | `rmb_index_daily` | TABLE | trade_date / YEAR | 4413 | 2010-01-04T00:00:00.000000Z 至 2026-09-22T00:00:00.000000Z | 0 | trade_date:timestamp, usd_per_cny:double precision, eur_per_cny:double precision, jpy_per_cny:double precision … |
| 扩展 | `sf_month` | TABLE | month / YEAR | 200 | 2010-01-01T00:00:00.000000Z 至 2026-08-01T00:00:00.000000Z | 0 | month:timestamp, inc_month:double precision, inc_cumval:double precision, stk_endval:double precision |
| 扩展 | `sge_daily` | TABLE | trade_date / YEAR | 177640 | 2026-01-15T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, close:double precision, open:double precision … |
| 扩展 | `share_float` | TABLE | float_date / YEAR | 5203572 | 2007-05-23T00:00:00.000000Z 至 2035-10-29T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:varchar, float_date:timestamp, float_share:double precision … |
| 扩展 | `shibor` | TABLE | timestamp / YEAR | 4119 | 2010-02-23T00:00:00.000000Z 至 2026-09-21T00:00:00.000000Z | 0 | timestamp:timestamp, on:double precision, 1w:double precision, 2w:double precision … |
| 扩展 | `shibor_lpr` | TABLE | date / YEAR | 1532 | 2013-10-25T00:00:00.000000Z 至 2026-08-20T00:00:00.000000Z | 0 | date:timestamp, 1y:double precision, 5y:double precision |
| 扩展 | `stk_alert` | TABLE | start_date / YEAR | 233 | 2025-07-14T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | ts_code:varchar, name:varchar, start_date:timestamp, end_date:varchar … |
| 扩展 | `stk_high_shock` | TABLE | trade_date / YEAR | 109 | 2026-02-09T00:00:00.000000Z 至 2026-09-22T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, name:varchar, trade_market:varchar … |
| 扩展 | `stk_holdernumber` | TABLE | ann_date / YEAR | 365062 | 2018-01-01T00:00:00.000000Z 至 2026-09-20T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, end_date:varchar, holder_num:bigint |
| 扩展 | `stk_holdertrade` | TABLE | ann_date / YEAR | 83397 | 2018-01-02T00:00:00.000000Z 至 2026-09-19T00:00:00.000000Z | 0 | ts_code:varchar, ann_date:timestamp, holder_name:varchar, holder_type:varchar … |
| 核心候选 | `stk_limit` | TABLE | trade_date / YEAR | 12491354 | 2010-01-29T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, up_limit:double precision, down_limit:double precision |
| 扩展 | `stk_shock` | TABLE | trade_date / YEAR | 2757 | 2026-03-03T00:00:00.000000Z 至 2026-09-18T00:00:00.000000Z | 0 | ts_code:varchar, trade_date:timestamp, name:varchar, trade_market:varchar … |
| 核心候选 | `stk_st_daily` | TABLE | timestamp / YEAR | 837062 | 2010-01-27T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | ts_code:varchar, is_st:integer, timestamp:timestamp |
| 核心候选 | `stk_suspend` | TABLE | timestamp / DAY | 128648 | 2010-01-29T00:00:00.000000Z 至 2026-11-10T00:00:00.000000Z | 0 | ts_code:varchar, is_suspended:bigint, timestamp:timestamp |
| 扩展 | `stock_detail_info` | TABLE |  / NONE | 5914 | — | 0 | ts_code:varchar, update_time:timestamp, symbol:varchar, name:varchar … |
| 扩展 | `stock_minute_bars` | TABLE | bar_time / YEAR | 543683520 | 2025-01-02T01:31:00.000000Z 至 2026-09-11T07:00:00.000000Z | 0 | ts_code:varchar, bar_time:timestamp, source_row_index:integer, open:double precision … |
| 扩展 | `ths_index` | TABLE | update_time / MONTH | 2517 | 2026-09-11T18:20:59.807013Z 至 2026-09-11T18:20:59.807013Z | 0 | ts_code:varchar, name:varchar, count:integer, exchange:varchar … |
| 扩展 | `ths_member` | TABLE | update_time / MONTH | 416612 | 2026-09-15T16:09:12.595230Z 至 2026-09-15T16:09:12.595230Z | 0 | ts_code:varchar, con_code:varchar, con_name:varchar, weight:double precision … |

## 完整结构复现

```sql
SELECT table_name, column_name, ordinal_position, data_type
FROM information_schema.columns
ORDER BY table_name, ordinal_position;

SHOW COLUMNS FROM <table_name>;
```

等级应与主说明中的准入门槛一起使用；`SHOW COLUMNS` 还列出 indexed、designated、upsertKey。
