---
id: BACK-686
title: Watch task lists with the existing JSON output
status: Done
assignee:
  - '@codex'
created_date: '2026-09-12 11:22'
updated_date: '2026-09-12 11:29'
labels: []
dependencies: []
references:
  - json-output-json-output
  - cli-cli
modified_files:
  - src/formatters/json-output.ts
  - src/cli.ts
  - src/commands/watch-json.ts
  - src/test/cli-json-watch.test.ts
  - src/test/watch-json.test.ts
  - CLI-INSTRUCTIONS.md
  - src/guidelines/cli-instructions/overview.md
  - README.md
type: feature
ordinal: 317000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subscribers need a complete initial task list and refreshed full lists when local task state changes. Add task list --json --watch using exactly the existing JSON schema, fields, formatting, filters, sorting and limits. The agreed scope is a current-state stream, without event wrappers, cursors or individual change events.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One-shot --json behavior remains unchanged; every watch response uses its exact existing serialization
- [x] #2 Watch emits the complete initial matching list including an empty list, then changed full results
- [x] #3 Local edits, creates, removals, dependency and configuration changes update filtered and sorted results without permanent missed changes
- [x] #4 Watch requires --json; stdout stays JSON-only; shutdown and slow consumers are handled with bounded resources
- [x] #5 Public help and instructions explain watch framing, scope and replacement behavior; targeted tests and project checks pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the canonical task-list action and serializer for one-shot and repeated reads, including fresh validation and local-only semantics. 2. Add a bounded watch loop: attach directory notifications before the first read, serialize refreshed full responses, suppress unchanged bytes, reconcile periodically, and clean up signals/output failures. 3. Document the existing pretty-printed JSON framing and replacement semantics. 4. Test byte equality, changes and filters, readiness, invalid input, empty lists, slow output and termination; run type, lint and relevant test checks; review for simplification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation reuses the existing task-list action, including option validation on each read, with only an injected JSON output callback. Shared formatJson preserves existing indentation and trailing newline. Directory notifications trigger refreshes, and a one-second reconciliation pass recovers missed events without cross-branch loading. The stream serializes writes and retains only a pending-refresh flag. Reviewed for simplification: no new store, event schema, or task projection was needed.

Validation: 71 tests passed across cli-json-output, cli-json-watch, watch-json, cli-task-list, cli-task-list-ordinal-sort, and agent-instructions. Type check, Biome check, build and diff whitespace checks passed. Compiled binary tested for byte-identical initial JSON and termination. Lifecycle tests include startup races, missed notifications, slow writers, EPIPE, read failures, listener cleanup and termination with an unread 2 MB response. Bun retains some native blocked stdout writes after destroy, so the CLI exits after watch cleanup on explicit SIGINT/SIGTERM.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added task list --json --watch with an initial full response and changed full replacements using the exact existing JSON contract and formatting. Existing list behavior, filters and local scope are shared unchanged. Added public documentation and 12 watch tests; all 71 targeted regression tests, type checking, linting and build passed.
<!-- SECTION:FINAL_SUMMARY:END -->
