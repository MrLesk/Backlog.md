---
id: BACK-354.01
title: 'Core: Definition of Done defaults and persistence'
status: To Do
assignee:
  - '@codex'
created_date: '2025-12-28 20:34'
updated_date: '2025-12-28 20:40'
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
- [ ] #1 `backlog/config.yml` supports a `definition_of_done` array (like `statuses`) and config load/save preserves it.
- [ ] #2 Core applies DoD defaults to new tasks as a distinct `Definition of Done` checklist section with unchecked items by default.
- [ ] #3 Task creation supports defaults/replace/append/disable behavior for DoD items.
- [ ] #4 DoD checklist items persist with checked state separate from acceptance criteria; tasks without DoD remain unchanged on load/save.
- [ ] #5 Core update operations support setting/adding/removing/checking/unchecking DoD items, mirroring acceptance criteria semantics.

- [ ] #6 Automated tests cover config parsing/serialization plus default/override persistence and update behavior.
<!-- AC:END -->
