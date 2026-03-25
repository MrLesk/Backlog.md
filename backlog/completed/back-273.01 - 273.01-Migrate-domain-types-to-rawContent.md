---
id: BACK-273.01
title: '273.01: Migrate domain types to rawContent'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-19 18:33'
updated_date: '2025-09-19 19:47'
labels:
  - core
  - types
  - search
dependencies: []
parent_task_id: task-273
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rename legacy markdown fields across Task/Document/Decision to use rawContent and remove the remaining acceptanceCriteria string arrays. Update parsing, serialization, file-system loaders, and every consumer (CLI, TUI, web, tests) so the new shape is the single source of truth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task, Document, and Decision types expose rawContent instead of body and no longer expose legacy acceptanceCriteria arrays.
- [x] #2 Markdown parser and serializer round-trip rawContent and structured sections without regressions.
- [x] #3 All references compile after the rename (bunx tsc --noEmit) and lint/format pass (bun run check .).
- [x] #4 Existing tests updated to target rawContent (bun test target for affected suites).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Replaced body fields with rawContent on Task/Document/Decision types and removed legacy acceptanceCriteria arrays.
- Updated parser/serializer, filesystem loaders, and all CLI/TUI/web/server consumers to the new structure.
- CLI now mutates acceptanceCriteriaItems directly instead of re-parsing markdown.
- Tests: bun run check ., bunx tsc --noEmit, bun test.
<!-- SECTION:NOTES:END -->
