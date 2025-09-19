---
id: task-273
title: 'Core: Centralize search and type cleanup'
status: To Do
assignee:
  - '@codex'
created_date: '2025-09-19 18:09'
updated_date: '2025-09-19 18:09'
labels:
  - core
  - search
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor types and search to use a single Fuse-based core search that feeds all entry points (CLI, TUI, web). Replace legacy fields (e.g., body, acceptanceCriteria) with new names like rawContent and ensure every consumer goes through the shared store and search service. Add CLI search command with plain output and pre-filled interactive view support.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task, document, and decision types use rawContent instead of body and remove deprecated fields.
- [ ] #2 Core search module returns SearchResult with tasks/documents/decisions using Fuse in memory (no fs access).
- [ ] #3 Shared local data store loads all content once and exposes unified search/filter API for browser, board, and task list.
- [ ] #4 Task list UI uses new search+filter API with search input + status/priority dropdowns.
- [ ] #5 CLI search command supports --plain for text output and opens task list with pre-filled search/filter when interactive.
<!-- AC:END -->
