---
id: BACK-510
title: Fix repeated task edit label flags
status: Done
assignee:
  - '@codex'
created_date: '2026-06-18 16:47'
updated_date: '2026-06-18 17:26'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/692'
priority: medium
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make task edit label flags consistent and explicit. Repeated --add-label should collect all values, repeated --label should collect a full replacement label set, and mixed replacement/mutation modes should avoid silent data loss. Update agent-facing help/schema so the behavior is clear to external agents using only the public CLI surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task edit --add-label accepts repeated flags and comma-separated values, adding every requested label without replacing existing labels
- [x] #2 task edit --label accepts repeated flags and comma-separated values, replacing the full label set with every requested label
- [x] #3 Combining --label with --add-label or --remove-label fails with a clear error instead of silently applying precedence
- [x] #4 task edit --help input schema and option descriptions document label replacement, additive/removal behavior, repeatability, and comma-separated values
- [x] #5 Tests cover repeated label flags, mixed-mode rejection, and relevant help/schema text
- [x] #6 task edit --clear-labels intentionally clears all labels and rejects combination with other label flags
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Register task edit --label, --add-label, and --remove-label with the existing repeatable option accumulator so parseDelimitedStringList receives every flag occurrence.
2. Add --clear-labels as an explicit replacement mode for intentionally empty labels.
3. Reject mixed label replacement/clear/mutation modes with direct error messages before any task update is built.
4. Update task edit help schema and option text to describe replacement, add/remove, clear, repeatability, comma-separated values, and conflict behavior for agents.
5. Add CLI-level tests for repeated label replacement, addition/removal, clear-labels, mixed-mode rejection, and help/schema text.
6. Run focused CLI tests plus full validation before finalizing BACK-510.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented repeatable task edit label parsing for --label, --add-label, and --remove-label using the existing accumulator and parser. Added --clear-labels as an explicit empty replacement mode, preserved empty label replacements through buildTaskUpdateInput, and rejected mixed replacement/clear/mutation label modes before mutation. Validation passed: bun test src/test/cli.test.ts; bunx tsc --noEmit; bun run check .; bun run build; git diff --check; full bun test (1340 pass, 2 skip, 0 fail).

Reopened to address PR #693 review feedback: blank-only label arrays must not be interpreted as explicit label clearing; clearing remains reserved for explicit empty arrays / --clear-labels.

Addressed PR #693 review thread PRRT_kwDOO2LIE86Kn8VH by preserving labels on blank-only task_edit label arrays while retaining explicit labels: [] clearing. Validation passed: bun test src/test/mcp-tasks.test.ts; bun test src/test/cli.test.ts; bunx tsc --noEmit; bun run check .; bun run build; git diff --check. Local full bun test hit an unrelated existing timeout in CLI Priority Filtering > case insensitive priority filtering at 5s; the targeted behavior passed with bun test --timeout 15000 src/test/cli-priority-filtering.test.ts -t 'case insensitive priority filtering'.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented repeatable task edit label flags, explicit label clearing, agent-facing help/schema updates, and the PR review fix ensuring blank-only label arrays do not clear labels. Verified with focused MCP/CLI tests, typecheck, Biome, build, diff check, and a targeted timeout-adjusted rerun of the unrelated priority-filter case.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
