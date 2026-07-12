---
id: BACK-507.3
title: Text input schemas in public command help
status: Done
assignee:
  - '@codex'
created_date: '2026-06-13 14:13'
updated_date: '2026-06-13 20:37'
labels: []
milestone: m-7
dependencies: []
parent_task_id: BACK-507
priority: high
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve the existing CLI help so humans and agents can inspect command inputs without a separate agent-only command surface. Help text should clearly state required fields, optional fields, accepted values, examples, output shape, and whether the command reads or writes project state.

The schema format should be text-only, not JSON. Example style: `Required fields: title: String`, `Optional fields: description: Markdown`, `ordinal: Integer`, `status: Status name from project config`. Use local Commander patterns and avoid broad rewrites beyond what is needed for consistent help rendering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Public command help includes text schema sections for required and optional inputs on key task, document, milestone, search, config, init, and cleanup commands.
- [x] #2 Help identifies read-only versus state-changing commands in plain text.
- [x] #3 Help uses project terminology consistently: Markdown, Integer, Boolean, Status, Task ID, docs-relative path, project-root-relative path.
- [x] #4 The implementation reuses a shared helper or metadata pattern rather than duplicating large help blocks by hand.
- [x] #5 Tests or snapshots cover representative help output for high-use commands.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Implementation Plan

1. Add a small shared helper for rendering text input schemas into Commander `--help` output.
2. Apply it to high-use public commands: init, task create/list/edit/view/archive, search, doc create/update/list/view, milestone list/archive, config get/set/list, cleanup, and instructions.
3. Keep schema text concise and human-readable: Required fields, Optional fields, Reads/Writes, Output, and Examples where useful.
4. Add focused help-output tests for representative commands across the affected groups.
5. Run targeted help tests and TypeScript before moving to error handling.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added shared `addHelpSchema` renderer and applied text input schema sections to key public commands: init, instructions, search, task create/list/edit/view/archive, doc create/update/list/view, milestone list/archive, config/get/set/list, and cleanup. Help now includes field types, read/write behavior, output, and examples where useful. Focused verification passed: `bun test src/test/cli.test.ts --test-name-pattern "command help input schemas"` and `bunx tsc --noEmit`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added shared help-schema rendering and applied it to high-use public CLI commands so humans and agents can inspect fields, reads/writes, output, and examples from `--help`.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
