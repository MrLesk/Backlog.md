---
id: BACK-354.01
title: 'Core: Definition of Done defaults and persistence'
status: Done
assignee:
  - '@codex'
created_date: '2025-12-28 20:34'
updated_date: '2026-01-17 21:58'
labels: []
dependencies: []
parent_task_id: BACK-354
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add core support for a per-project Definition of Done checklist that is inherited by new tasks and stored as a distinct, checkable section.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog/config.yml` supports a `definition_of_done` array (like `statuses`) and config load/save preserves it.
- [x] #2 Core applies DoD defaults to new tasks as a distinct `Definition of Done` checklist section with unchecked items by default.
- [x] #3 Task creation supports defaults/replace/append/disable behavior for DoD items.
- [x] #4 DoD checklist items persist with checked state separate from acceptance criteria; tasks without DoD remain unchanged on load/save.
- [x] #5 Core update operations support setting/adding/removing/checking/unchecking DoD items, mirroring acceptance criteria semantics.

- [x] #6 Automated tests cover config parsing/serialization plus default/override persistence and update behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan:
1) Add `definition_of_done` to config parse/serialize and `BacklogConfig` type.
2) Implement DoD markdown persistence using AC-style markers (`<!-- DOD:BEGIN/END -->`) and parser/serializer hooks; ensure tasks without DoD unchanged.
3) Add DoD fields to task domain + inputs, apply defaults on create, and support add/remove/check/uncheck in `updateTaskFromInput` (no replace).
4) Add core tests for config + create defaults + update operations.
<!-- SECTION:PLAN:END -->
