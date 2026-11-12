---
id: TASK-1
title: QuestDB 本地数据现状、质量与同步机制说明
status: Done
assignee: []
created_date: '2026-11-12T13:37:00Z'
updated_date: '2026-11-12T13:48:00Z'
labels:
  - questdb
  - data-governance
dependencies: []
documentation:
  - docs\questdb-本地数据现状与同步说明.md\doc-2 - QuestDB-本地数据现状与同步说明.md
  - docs\questdb-目录\doc-3 - QuestDB-运行态目录：A股、宏观与技术对象.md
  - docs\questdb-目录\doc-4 - QuestDB-运行态目录：美股与BTC对象.md
  - docs\questdb-目录\doc-5 - QuestDB-运行态目录：因子、回测与L2对象.md
type: docs
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
需要为本地 QuestDB 建立一份面向量化系统维护者的现状说明。文档应以运行中实例的只读盘点为准，并对照 F:\repo\engine\data 与 F:\repo\engine\back-monitor 中的数据定义、同步实现和注释，说明数据资产、表结构、质量证据、同步责任和已知限制；不能将历史文档或代码定义误表述为当前数据。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 文档列出当前本地 QuestDB 中可读取的对象，并按领域说明用途、行数、时间范围和关键表结构
- [x] #2 文档将每个已识别数据域关联到可验证的定义或同步实现，并区分已运行、代码定义和未知状态
- [x] #3 文档记录数据质量检查结果、覆盖缺口和证据采集时间
- [x] #4 文档说明同步入口、调度或运行方式、目标表及可观测性边界
- [x] #5 文档经只读核验后可由新维护者据此定位数据与同步责任
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
读取本地 QuestDB 的系统目录和代表性样本；在相邻工程中追溯表定义、同步脚本与调度配置；以证据等级写入 Backlog 文档，并在完成后复核任务验收条件。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
已完成只读运行态盘点：QuestDB HTTP 可用，tables() 返回 165 个对象，information_schema.columns 返回 3,440 条字段记录。主说明与三份分域目录已写入 Backlog 文档；未启动采集或进行任何写入。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
已完成本地 QuestDB 只读盘点与同步说明。主文档说明 165 个对象、3,440 条字段目录记录、数据质量边界和各域入口；三份目录附录逐对象列出类型、时间列/分区、行数、时间范围、WAL 待应用数及字段摘要，并提供完整结构复现 SQL。未启动采集、写入或修改 QuestDB/WAL；未把表存在或最新时间误称为完整同步。
<!-- SECTION:FINAL_SUMMARY:END -->
