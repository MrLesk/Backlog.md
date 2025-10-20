---
id: task-302
title: Support flexible ID formats for tasks and docs
status: Done
assignee:
  - '@codex'
created_date: '2025-10-17 22:09'
updated_date: '2025-10-18 20:30'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Align ID parsing with Issue #404 requirements so CLI, MCP, and APIs accept variations. Implement parsing normalization once in shared utilities and ensure both task and document lookups use it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task lookup accepts TASK-<id>, task-<id>, bare numeric id, and zero-padded variants.
- [x] #2 Document lookup accepts DOC-<id>, doc-<id>, bare numeric id, and zero-padded variants.
- [x] #3 Tests cover new parsing helper for both tasks and documents.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add shared ID normalization helpers that handle prefix casing and numeric padding.
2. Refactor task/document lookup paths (CLI, core, filesystem, MCP, server) to use the helpers.
3. Expand unit and integration tests to cover uppercase/padded inputs across tasks and documents.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Task and document comparisons now rely on dedicated helpers (`src/utils/task-path.ts` and `src/utils/document-id.ts`) so every caller works through a single normalization/equality path.
- CLI commands use `Core.getDocumentContent`/`Core.loadTaskById` to avoid touching the filesystem directly; `loadTaskById` exists specifically to bypass long-lived watchers so short-lived CLI processes (and Windows CI) exit cleanly.
- ID normalization is applied at construction-time (task creation, document saves) and whenever dependencies/parents are parsed, preventing accidental mixed-prefix storage.
- Added MCP/server bindings to those helpers, so task/document tools accept case-insensitive and zero-padded IDs without duplicating logic.
- Pending: coordinate with Claude for an additional review as requested.

- Verified flexible ID handling for CLI, MCP, server, and filesystem pathways.
<!-- SECTION:NOTES:END -->
