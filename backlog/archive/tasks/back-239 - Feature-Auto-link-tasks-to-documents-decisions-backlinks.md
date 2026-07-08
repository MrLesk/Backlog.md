---
id: BACK-239
title: 'Feature: Auto-link tasks to documents/decisions + backlinks'
status: To Do
assignee:
  - '@codex'
created_date: '2025-08-17 16:54'
updated_date: '2025-12-17 22:11'
labels:
  - web
  - enhancement
  - docs
dependencies: []
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add first-class linking between tasks and documents/decisions (from issue #271).

Goal:
- Let users reference documents/decisions directly in task content (e.g., "Documented in doc-12" or "See decision-3").
- In the web UI, references render as clickable links to the target doc/decision.
- On a document/decision page, show a "Referenced by" list of tasks that mention it (computed dynamically; no file mutation).

Scope (MVP):
- Recognize references in task body using simple, unambiguous patterns: `doc-<id>` and `decision-<id>` (optionally prefixed with `#`).
- Don't render links inside code blocks.
- No rich previews; plain links with title when available.
- Backlinks computed client-side (or server-side) by scanning tasks for references; do not write backlinks into files.

Notes:
- Extend later to support linking from docs -> tasks, and to other entities if needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Web: task detail/body renders doc-<id> and decision-<id> as links to their pages; not inside code blocks
- [ ] #2 Web: document/decision pages show a Referenced by list of tasks that mention the ID
- [ ] #3 Support patterns: `doc-<n>`, `decision-<n>`, with or without a leading `#` (e.g., #doc-1)
- [ ] #4 Links include the target title when available; otherwise show the ID
- [ ] #5 No file mutation for backlinks; computed at render time
- [ ] #6 Add short docs: how to reference docs/decisions from tasks (examples)
<!-- AC:END -->
