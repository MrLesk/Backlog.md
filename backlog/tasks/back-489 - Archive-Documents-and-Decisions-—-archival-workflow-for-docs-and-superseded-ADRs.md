---
id: BACK-489
title: >-
  Archive Documents and Decisions — archival workflow for docs and superseded
  ADRs
status: To Do
assignee: []
created_date: '2026-05-13 10:14'
updated_date: '2026-05-17 20:27'
labels:
  - documents
  - decisions
  - web-ui
  - tui
  - cli
  - mcp
  - archive
milestone: m-13
dependencies: []
priority: medium
ordinal: 176000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
> **Upstream constraint**: This task must be implemented on a clean branch from `upstream-master`. It must be self-contained and mergeable as a single standalone PR with no cross-task code dependencies. If a dependency on another task is unavoidable, it is listed explicitly in the Dependencies section.

Task archiving is well-implemented (moves files to `backlog/archive/tasks/`, sanitizes references, supports git auto-commit). Documents and Decisions have no equivalent. This task adds the same workflow for both, plus a "superseded" concept specific to ADRs/decisions.

**Archive paths** (mirroring task convention):
- Documents: `backlog/docs/` → `backlog/archive/docs/`
- Decisions: `backlog/decisions/` → `backlog/archive/decisions/`

**Superseded decisions**: A decision can be marked "superseded by" another decision (still readable, not physically moved, but clearly marked). This is distinct from archiving — a superseded ADR stays visible in the decisions list under a "Superseded" collapsible section.

**Referential integrity**: Archiving a document must remove its references from tasks, other docs, and decisions — consistent with `src/core/backlog.ts:archiveTask()` pattern. Undo is not required (consistent with task archiving).

**Git integration**: Respects `auto_commit` config setting, consistent with task archiving.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI: `backlog doc archive <id>` moves doc file to `backlog/archive/docs/` and sanitizes references in other files
- [ ] #2 CLI: `backlog decision archive <id>` moves decision file to `backlog/archive/decisions/` and sanitizes references
- [ ] #3 CLI: `backlog decision supersede <id> --superseded-by <other-id>` marks a decision as superseded (adds `superseded_by` frontmatter field) without moving the file
- [ ] #4 WebUI: 'Archive' button in doc full view; archived docs appear in a collapsible 'Archived' section in the docs list
- [ ] #5 WebUI: 'Archive' button in decision full view; 'Supersede' action prompts for the superseding decision ID; superseded decisions appear in a separate collapsible 'Superseded' section
- [ ] #6 TUI: keyboard shortcut to archive a doc/decision consistent with the existing task archive shortcut
- [ ] #7 MCP: `document_archive` tool added; `document_list` accepts `includeArchived: boolean` parameter; equivalent tools/params for decisions
- [ ] #8 REST: archive endpoints added consistent with existing task archive patterns
- [ ] #9 Referential integrity: archiving removes the doc/decision ID from `references`, `documentation`, and `dependencies` fields in all active tasks and docs
- [ ] #10 Git auto-commit behavior respects `auto_commit` config setting, consistent with task archiving
- [ ] #11 All 5 modalities (CLI, TUI, WebUI, MCP, REST) covered or explicitly marked N/A with justification in implementation notes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
