---
id: TASK-2
title: 标记 QuestDB 核心数据并定义优先保障准入
status: Done
assignee: []
created_date: '2026-11-12T13:49:00Z'
updated_date: '2026-11-12T13:53:00Z'
labels:
  - questdb
  - data-governance
  - core-data
dependencies: []
documentation:
  - docs/questdb-本地数据现状与同步说明.md/doc-2 - QuestDB-本地数据现状与同步说明.md
type: docs
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
维护者需要先识别会阻断主策略、市场基础行情或正式因子链路的数据，并把其余对象与高频、派生、备份/临时对象区分。当前目录仅证明对象存在，不能证明核心数据完整、正确或自动同步可靠；本任务记录可执行的分级和验收门槛，为后续按优先级核验与自动化接管提供统一标准。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 现有 QuestDB 目录中的对象被标为核心、扩展、派生、高频或备份/临时，并说明分级依据
- [x] #2 主说明明确核心数据的完整性、正确性和自动同步三类独立验收条件
- [x] #3 核心数据清单区分运行态已证实、代码定义和待确认项，不将目录存在当作达标
- [x] #4 文档给出按优先级的核验顺序和自动同步接管前的证据要求
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 以运行态目录为准为每个对象赋予核心、扩展、派生/编译、高频或备份/临时标签。2. 用正式同步与市场数据文档验证核心候选的责任归属，明确运行态可见不等于达标。3. 为核心候选写出完整性、正确性和自动同步的独立准入门槛及核验顺序。4. 复核文档结构和任务验收条件。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
已用运行态目录为 165 个对象标注维护等级，并用正式同步、策略来源、美股与 BTC 文档核对核心候选。运行态复核显示 A股日线主干至 2026-11-10，美股日线至 2026-11-11，BTC 现货日线至 2026-11-08；这些为快照，不替代三道准入门。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
已为本地 QuestDB 目录增加核心候选、扩展、派生/编译、高频、备份/临时五级标记，并在主说明中定义第一阶段核心候选、完整性/正确性/自动同步三道准入门和核验顺序。自动同步尚未启用或验收；必须逐对象取得来源范围、值回读、账本、锁和 WAL 证据后才可提升为核心可用。
<!-- SECTION:FINAL_SUMMARY:END -->
