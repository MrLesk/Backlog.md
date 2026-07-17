---
id: BACK-355
title: 'Add task type field (bug, feature, enhancement, etc.)'
status: Done
assignee:
  - '@codex'
created_date: '2026-01-01 23:37'
updated_date: '2026-07-17 00:01'
labels:
  - enhancement
  - core
  - cli
  - mcp
  - web
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a mutually exclusive 'type' field to tasks that categorizes them semantically. Unlike labels (which are additive tags), type is exclusive - each task has exactly one type. This enables clearer task categorization, better reporting and metrics (e.g., bug count vs feature count), and supports type-specific workflows. Aligns with industry-standard issue trackers (GitHub, Jira, Linear).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task types are configurable per-project in config.yml with sensible defaults
- [x] #2 CLI task create and task edit commands support --type flag
- [x] #3 MCP task_create and task_edit tools include type parameter
- [x] #4 TUI board displays task type with visual distinction (icon or badge)
- [x] #5 Web UI displays task type in task cards and detail view
- [x] #6 Task list and search support type-based filtering (--type flag)
- [x] #7 Type validation ensures value is one of the configured types
- [x] #8 Type field persists in task markdown YAML frontmatter
- [x] #9 Task domain model includes an optional 'type' field; default allowed set: bug, feature, enhancement, task, chore, docs, spike (project-overridable via the 'types' config key)
- [x] #10 Existing tasks without a 'type' field stay untyped: the parser leaves type undefined, display surfaces show no type badge/value for them, and there is no retroactive defaulting or migration
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify the six completed child records and merged behavior cover every parent acceptance criterion.
2. Run focused current tests for core/config persistence, CLI, MCP, filtering, TUI, and Web behavior.
3. Reconcile only the parent task with checked evidence, validation notes, final summary, and terminal status.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Final reconciliation on origin/main 22a091b5. Focused verification passed 103/103 tests with 691 assertions across 10 files. Evidence mapping: AC #1, #7, #9: task-type config, core, CLI, MCP, and server validation tests; AC #2: CLI create/edit/help/completion tests; AC #3: MCP create/edit/schema/output tests; AC #4: TUI board badge and detail tests; AC #5: Web badge, create/edit/clear, and error-recovery tests; AC #6: Core/store/CLI/MCP OR filtering plus Web board URL filtering tests; AC #8: YAML frontmatter CRUD round-trip tests; AC #10: parser, CLI, TUI, and Web untyped behavior tests. bunx tsc --noEmit, bun run check . (336 files), and bun run build passed. All six child records remain Done; no product code changed. The parent defines no Definition of Done items.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the parent task after all six task-type children landed. Backlog.md now supports project-configured optional task types with validated YAML persistence, CLI and MCP create/edit/output, list and search filtering, and distinct TUI and Web display/edit flows while existing tasks remain untyped. Verified on origin/main 22a091b5 with 103 focused tests, 0 failures, typecheck, Biome, and build.
<!-- SECTION:FINAL_SUMMARY:END -->
