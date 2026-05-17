---
id: BACK-507
title: Feature Parity Matrix — CLI / TUI / WebUI / MCP
status: Done
assignee:
  - claude-sonnet-4-6
created_date: '2026-05-17 21:14'
updated_date: '2026-05-17 21:20'
labels:
  - research
  - engineering-consistency
milestone: m-13
dependencies: []
modified_files:
  - backlog/docs/doc-005 - Feature-Parity-Matrix.md
priority: medium
ordinal: 198000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md exposes four access modalities: CLI (commander), TUI (blessed terminal UI), WebUI (Bun HTTP server + React SPA), and MCP (model context protocol tools). There is a stated goal of feature parity across modalities for new features, but no audit of what gaps exist in existing features.

This task produces a backlog document (doc-005) with a complete feature × modality matrix, color-coded ✅ / ⚠️ / ❌, covering all significant user-facing operations across the four modalities. The matrix becomes the reference for prioritizing parity work.

**No code changes in this task.** Research and documentation only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog/docs/doc-005 created with a feature x modality matrix table (CLI / TUI / WebUI / MCP columns)
- [ ] #2 Matrix covers all major feature domains: tasks, drafts, milestones, documents, decisions, sequences, search, config, statistics, board view
- [ ] #3 Each cell is ✅ (full support) / ⚠️ (partial/limited) / ❌ (missing) with a brief note where non-obvious
- [ ] #4 At least 5 ❌ or ⚠️ parity gaps identified with file-level evidence
- [ ] #5 Follow-up stub tasks proposed for the highest-impact gaps
- [ ] #6 No code changes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spawned an Explore subagent to inventory all CLI commands (src/cli.ts), TUI screens (src/ui/), REST routes (src/server/index.ts), and MCP tool handlers (src/mcp/tools/*/handlers.ts). Cross-referenced 9 feature domains. Key gaps: decision domain missing from CLI and MCP; task-complete missing from CLI; statistics missing from CLI; document archive/delete missing from all modalities; board missing from CLI and MCP.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created doc-005 (backlog/docs/doc-005 - Feature-Parity-Matrix.md) with a full ✅/⚠️/❌ matrix across CLI, TUI, WebUI, and MCP for 9 domains: Tasks, Drafts, Milestones, Documents, Decisions, Board/Kanban, Sequences, Configuration, and Statistics. Identified 8 top gaps and 5 follow-up stubs (STUB-P1 through STUB-P5). Committed in 41941cb alongside BACK-492 subtasks .1–.7.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
