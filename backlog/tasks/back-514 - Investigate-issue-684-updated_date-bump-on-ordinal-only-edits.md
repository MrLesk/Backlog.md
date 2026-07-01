---
id: BACK-514
title: 'Investigate issue #684 updated_date bump on ordinal-only edits'
status: Done
assignee:
  - '@codex'
created_date: '2026-07-01 17:57'
updated_date: '2026-07-01 18:11'
labels:
  - bug
  - github
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/684'
modified_files:
  - src/core/backlog.ts
  - src/test/core.test.ts
  - src/test/reorder-utils.test.ts
  - src/test/cli-plain-create-edit.test.ts
priority: medium
ordinal: 110000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Determine whether ordinal-only updated_date changes are a bug under shipped CLI/MCP behavior or require owner product input.
- [x] #2 If a narrow fix preserves current temporal fields, implement it with focused tests.
- [x] #3 If no narrow fix is appropriate, document the tradeoff on issue #684 and leave follow-up state clear.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Treat issue #684 as a narrow bug: public CLI/MCP describe ordinal as ordering metadata, and no shipped docs promise ordinal edits refresh updated_date.
2. Add an internal save option so existing update paths keep the default updated_date stamp, but callers can preserve it for ordinal-only writes.
3. Detect ordinal-only changes by comparing the original task to the candidate task while ignoring ordinal, updatedDate, and filePath.
4. Apply preservation in task edit and board reorder paths; keep status/milestone/content edits stamping updated_date.
5. Add focused core and reorder tests, then run targeted tests plus type/check as appropriate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Discovery: updateTaskFromInput detects mutation, but updateTask always overwrites updatedDate. reorderTask filters ordinal/status/milestone changes, then saves via updateTasksBulk -> updateTask. Public CLI/MCP only describe ordinal as ordering metadata. Narrow fix can preserve updatedDate for ordinal-only writes without adding temporal fields.

Validation: bun test src/test/core.test.ts src/test/reorder-utils.test.ts passed; bunx tsc --noEmit passed; bun run check . passed. Full bun test completed with three unrelated CLI timeout failures under full-suite load; reran src/test/cli-priority-filtering.test.ts and the timed-out cli.test case in isolation and both passed.

Added a CLI-level regression for the public issue repro: task edit --ordinal on a fresh task keeps updated_date absent and omits Updated from --plain output.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Classified issue #684 as a narrow current-behavior bug: ordinal is public ordering metadata, not a task content timestamp signal. Added internal save options so ordinal-only task edits and board reorders preserve existing updated_date or leave it absent, while mixed content/status/milestone edits still refresh updated_date. Added core, reorder, and CLI regression tests.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
