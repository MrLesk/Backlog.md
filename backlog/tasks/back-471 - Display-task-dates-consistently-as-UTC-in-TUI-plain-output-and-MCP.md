---
id: BACK-471
title: 'Display task dates consistently as UTC in TUI, plain output, and MCP'
status: Done
assignee:
  - '@codex'
created_date: '2026-06-07 22:01'
updated_date: '2026-06-07 22:07'
labels: []
dependencies: []
modified_files:
  - src/utils/utc-date-display.ts
  - src/formatters/task-plain-text.ts
  - src/ui/task-viewer-with-search.ts
  - src/mcp/utils/document-response.ts
  - src/mcp/tools/documents/handlers.ts
  - src/test/utc-date-display.test.ts
  - src/test/cli-plain-output.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/mcp-documents.test.ts
priority: medium
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog-generated task timestamps are stored as UTC strings without an explicit timezone suffix. Update display-only formatting so terminal UI surfaces render task and comment dates consistently as UTC, and machine-readable text surfaces for CLI --plain and MCP include an explicit `(UTC)` suffix after displayed task dates. Do not change stored task markdown/frontmatter values or Web local-time rendering behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Terminal UI task detail, task list/card, overview, and comment date displays use a shared UTC date formatter instead of relying on raw or local Date rendering.
- [x] #2 CLI plain task output appends `(UTC)` to displayed task and comment dates while preserving the existing stored task file values.
- [x] #3 MCP task/document response text appends `(UTC)` to displayed date fields where dates are shown to agents.
- [x] #4 Date-only values remain date-only but are still identified as UTC where the plain/MCP display includes a suffix.
- [x] #5 Tests cover UTC formatting for TUI/plain/MCP paths and verify stored markdown dates are not rewritten just for display.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add or reuse a shared UTC display formatter for task/document text surfaces, preserving stored markdown/frontmatter values.
2. Route TUI task detail, list/overview, and comment metadata through UTC formatting without changing Web local-time rendering.
3. Route CLI --plain and MCP response date fields through the same formatter with an explicit `(UTC)` suffix.
4. Add focused tests for UTC datetime/date-only formatting and plain/MCP output expectations, then run type-check, Biome, and targeted tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a shared UTC display formatter that preserves Backlog's timezone-less UTC storage text, normalizes explicit timezone inputs to UTC, and appends `(UTC)` for plain/MCP text surfaces.

Updated task plain output, MCP task responses via the plain formatter, MCP document response/list metadata, and TUI task detail comment dates to use the shared formatter. Terminal task detail Created/Updated already flowed through the same formatter; terminal boards/lists/overview do not display dates.

Verified display-only behavior by reading the task markdown after `task view --plain` and asserting `(UTC)` was not written to storage.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented display-only UTC date formatting for terminal/plain/MCP date surfaces. Added a shared UTC display helper, routed task plain output/comment headers and TUI task detail comments through it, and suffixed MCP document/task response dates with `(UTC)` where dates are shown. Verified stored markdown dates remain unchanged by plain output.

Verification:
- `bunx tsc --noEmit`
- `bun run check .`
- `bun test src/test/utc-date-display.test.ts src/test/cli-plain-output.test.ts src/test/mcp-tasks.test.ts src/test/mcp-documents.test.ts`
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
