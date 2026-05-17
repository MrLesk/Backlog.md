---
id: BACK-507
title: Feature Parity Matrix — CLI / TUI / WebUI / MCP
status: To Do
assignee: []
created_date: '2026-05-17 21:14'
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
