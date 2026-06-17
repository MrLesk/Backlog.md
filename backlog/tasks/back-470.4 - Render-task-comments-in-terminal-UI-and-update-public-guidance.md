---
id: BACK-470.4
title: Render task comments in terminal UI and update public guidance
status: Done
assignee:
  - '@codex'
created_date: '2026-05-31 17:32'
updated_date: '2026-05-31 17:59'
labels:
  - comments
  - tui
  - docs
dependencies:
  - BACK-470.1
  - BACK-470.2
  - BACK-470.3
documentation:
  - src/ui/task-viewer-with-search.ts
  - src/formatters/task-plain-text.ts
  - README.md
  - CLI-INSTRUCTIONS.md
  - src/guidelines/agent-guidelines.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/task-execution.md
  - src/guidelines/mcp/task-finalization.md
  - src/mcp/resources/workflow/index.ts
  - src/test/tui-final-summary.test.ts
  - src/test/agent-instructions.test.ts
parent_task_id: BACK-470
priority: medium
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Finish comment support across the remaining public surfaces and documentation. Terminal task views should show comments using the same order as other task views, and public guidance should explain how comments differ from implementation notes and final summaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Terminal task detail and popup views render comments in the same section order as plain output and Web UI.
- [x] #2 Task section navigation and content-view assumptions remain compatible with a Comments section.
- [x] #3 README, CLI instructions, agent guidelines, and MCP workflow guidance document how to add/view comments and when to use comments versus Implementation Notes or Final Summary.
- [x] #4 Documentation examples use only public CLI/MCP surfaces, not source-level APIs.
- [x] #5 Scoped tests cover terminal/plain rendering and any updated guidance snapshots or generated instruction output.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Render comments in TUI task detail/popup using the same section placement as plain/Web views.
2. Add Comments to structured section titles so future section navigation and full-content tasks can treat it as a stable section.
3. Update README, CLI instructions, agent guidelines, and MCP workflow guidance with comment usage and the difference from Implementation Notes and Final Summary.
4. Add scoped tests for rendering/guidance where practical and run the project verification commands.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rendered comments in terminal/plain views, added Comments to structured section titles, rebuilt generated Tailwind CSS, and updated README, CLI instructions, agent guidelines, and MCP workflow guidance with public comment usage guidance.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Terminal and plain task views now render the Comments section in the same order as Web and markdown persistence. Public docs and MCP/agent guidance explain when to use comments versus Implementation Notes and Final Summary.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
