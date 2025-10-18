---
id: task-302
title: Support flexible ID formats for tasks and docs
status: To Do
assignee:
  - '@codex'
created_date: '2025-10-17 22:09'
updated_date: '2025-10-18 19:23'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Align ID parsing with Issue #404 requirements so CLI, MCP, and APIs accept variations. Implement parsing normalization once in shared utilities and ensure both task and document lookups use it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task lookup accepts TASK-<id>, task-<id>, bare numeric id, and zero-padded variants.
- [ ] #2 Document lookup accepts DOC-<id>, doc-<id>, bare numeric id, and zero-padded variants.
- [ ] #3 Tests cover new parsing helper for both tasks and documents.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add shared ID normalization helpers that handle prefix casing and numeric padding.
2. Refactor task/document lookup paths (CLI, core, filesystem, MCP, server) to use the helpers.
3. Expand unit and integration tests to cover uppercase/padded inputs across tasks and documents.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Task comparisons rely on the updated helpers in src/utils/task-path.ts and src/utils/document-id.ts.
- FileSystem.saveDocument now canonicalizes IDs and cleans up existing files using padding-insensitive comparison.
- CLI dependency normalization resolves against known IDs to avoid creating padded variants.

- Pending: coordinate with Claude for an additional review as requested.
<!-- SECTION:NOTES:END -->
