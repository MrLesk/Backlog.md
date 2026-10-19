---
id: BACK-782
title: Write generated timestamps with explicit UTC
status: Done
assignee:
  - '@codex-1123'
created_date: '2026-10-19 13:50'
updated_date: '2026-10-19T14:57:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1123'
  - src/core/backlog.ts
  - src/cli.ts
  - src/markdown/frontmatter.ts
  - src/markdown/parser.ts
  - src/web/utils/date-display.ts
  - src/utils/utc-timestamp.ts
  - src/test/markdown.test.ts
  - src/test/cli-timestamps.test.ts
  - src/web/utils/date-display.test.ts
  - ADVANCED-CONFIG.md
  - src/board.ts
  - src/core/statistics.ts
  - src/core/task-loader.ts
  - src/core/task-identity-index.ts
  - src/core/content-store.ts
  - src/core/duplicate-task-repair.ts
  - src/web/lib/lanes.ts
  - src/web/components/TaskList.tsx
  - src/web/components/TaskColumn.tsx
  - src/test/board.test.ts
  - src/test/statistics.test.ts
  - src/test/shared-branch-task-loader.test.ts
  - src/web/lib/lanes.test.ts
  - src/test/content-frontmatter-preservation.test.ts
  - src/test/cleanup.test.ts
  - src/test/reorder-utils.test.ts
  - src/test/cli-task-view-edit.test.ts
  - src/formatters/json-output.ts
  - src/utils/utc-date-display.ts
modified_files:
  - src/utils/utc-timestamp.ts
  - src/core/backlog.ts
  - src/cli.ts
  - src/markdown/frontmatter.ts
  - src/markdown/parser.ts
  - src/web/utils/date-display.ts
  - src/web/components/TaskList.tsx
  - src/web/components/TaskColumn.tsx
  - src/test/board.test.ts
  - src/test/statistics.test.ts
  - src/test/shared-branch-task-loader.test.ts
  - src/web/lib/lanes.test.ts
  - src/board.ts
  - src/core/task-loader.ts
  - src/core/statistics.ts
  - src/core/task-identity-index.ts
  - src/core/content-store.ts
  - src/core/duplicate-task-repair.ts
  - src/web/lib/lanes.ts
  - src/test/cli-timestamps.test.ts
  - src/web/utils/date-display.test.ts
  - src/test/markdown.test.ts
  - ADVANCED-CONFIG.md
  - src/test/content-frontmatter-preservation.test.ts
  - src/test/cleanup.test.ts
  - src/test/reorder-utils.test.ts
  - src/test/cli-task-view-edit.test.ts
  - src/utils/utc-date-display.ts
  - src/formatters/json-output.ts
type: bug
ordinal: 392000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1123 reports that raw frontmatter timestamps contain UTC clock values without a timezone marker. Hand-editors and external tools cannot see that contract. Alex approved explicit UTC for newly generated creation and update timestamps while keeping legacy timezone-less values as UTC, preserving unchanged historical creation values, and leaving date-only fields and due dates unchanged. No migration or timezone configuration is included.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Newly generated task, draft, document, decision and comment timestamps explicitly carry UTC as YYYY-MM-DDTHH:mm:00Z, preserving minute precision.
- [x] #2 Legacy timezone-less timestamps still mean UTC regardless of host timezone; date-only values remain dates, including at UTC midnight.
- [x] #3 Editing an existing record preserves its unchanged historical creation value; no read or unrelated edit bulk-migrates historical timestamps or opaque unknown frontmatter.
- [x] #4 CLI and browser displays and public JSON retain the same instant and date-only due dates remain YYYY-MM-DD without timezone conversion.
- [x] #5 Documentation describes explicit UTC writes and legacy UTC reads, and focused tests plus the required checks prove the storage and read-edit behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Use one shared minute-precision UTC formatter for generated timestamps in Core and CLI decision creation. Keep existing user-supplied and historical timestamps unchanged.
2. Preserve owned date scalar source through the existing YAML listener. Keep the innermost Date scalar so outer wrappers cannot add preceding comments; keep opaque unknown metadata on normal YAML handling.
3. Move the existing UTC reader to the shared timestamp utility and use it for mixed-format ordering, branch hydration checks, statistics, cleanup and identity fallback timestamps. Preserve existing missing/invalid fallbacks and date-only due-date behavior.
4. Keep display and public JSON responsibilities in their existing modules. Align their accepted-YAML timestamp spelling with the preserved source values, including lowercase t and separation whitespace.
5. Verify real CLI storage and historical read-edit behavior, UTC midnight, comments, document opaque metadata, due dates and mixed-format instant consistency using focused regressions. Update date storage documentation.
6. Keep the reviewed architecture, apply the approved scalar correction, and run canonical checks plus a clean immutable full CI profile before finalizing the evidence and task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approved contract: generated date-times use YYYY-MM-DDTHH:mm:00Z with minute precision. Legacy timezone-less values remain UTC, historical creation values are preserved on edits, and date-only entries and due dates keep their existing meaning. No bulk migration or timezone configuration was added.

One formatter replaces all generated timestamp expressions in Core and CLI decision creation. The existing UTC reader moved to a shared utility for mixed-format ordering, branch hydration, statistics, cleanup and identity fallback timestamps. Git epoch/mtime readers, due-date normalization and public JSON schemas remain unchanged. Display and JSON formatting keep their existing responsibilities.

Owned date fields retain their YAML scalar text through the existing listener; unknown metadata retains normal YAML handling. The listener keeps the first/innermost Date scalar so outer wrappers cannot add preceding comments. Tests cover quoted/unquoted timestamps, anchors, tags, UTC midnight, accepted lowercase-t/whitespace spellings, and opaque document metadata. Contextual architecture review and the final narrow correction review both returned KEEP; no further simplification was needed.

Regression proof: four mixed-format sorting/branch/age tests failed against unchanged consumers before the shared-reader changes, then passed under Asia/Taipei. The commented timestamp CLI regression failed before the first-write guard, then passed for midnight and 01:23 with read bytes unchanged and creation values preserved after edit. Published 1.54 and the final compiled CLI were compared in isolated projects; the final binary writes explicit Z timestamps and keeps due_date as YYYY-MM-DD. This task also preserves its legacy created_date while the verified built CLI writes its final updated_date with Z.

Final validation on merged base 0367215d48e5e8f899398d5b0c73e16c8cd6e137: bun run check:types, bun run check ., bun run build and git diff --check pass. Final focused CLI/Markdown/browser run: 58 pass, 0 fail, 276 assertions. One clean immutable full CI profile (TERM=xterm-256color bun scripts/run-ci-tests.ts --profile=full --parallel=4 --isolate --timeout=10000 --max-concurrency=4): non-DOM 3171 pass, 13 skip, 0 fail; DOM 399 pass, 0 fail, for 3570 passing tests. Existing interactive TUI script: 11 pass, 0 fail. All 30 reviewed files stayed byte-identical through the final full profile. The duplicate-data repair was included by safe fast-forward without overlap or stash.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Newly generated timestamps now show UTC explicitly, for example 2026-10-19T11:48:00Z, while preserving minute precision. Legacy timestamps still mean UTC; unchanged creation values, date-only entries and due dates are preserved. Shared UTC reading keeps old and new values consistent in sorting and task-age calculations. Owned YAML timestamps survive read/edit cycles, including midnight and comments before values, without changing opaque document metadata. Types, Biome, build, focused regressions, the full profile (3570 pass, 13 skip) and interactive TUI checks (11 pass) all pass. Contextual review accepted the final implementation.
<!-- SECTION:FINAL_SUMMARY:END -->
