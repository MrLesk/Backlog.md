---
id: task-237
title: Fix invalid git ref 'origin/origin' during remote task loading
status: To Do
assignee:
  - '@codex'
created_date: '2025-08-17 16:42'
labels:
  - git
  - bug
  - remote
dependencies: []
priority: high
---

## Description

While running `backlog browser`, a warning can appear:

Skipping branch origin: Error: Git command failed (exit code 128): git ls-tree -r --name-only -z origin/origin -- backlog/tasks

Root cause (likely): our remote task indexing builds refs as `origin/${branch}` (see buildRemoteTaskIndex). If `branch` is already `origin/<name>` (or an invalid entry like `origin`/`origin/HEAD`), we end up with an invalid ref (e.g., `origin/origin`, `origin/origin/HEAD`).

Fix scope:
- Sanitize branch inputs accepted by the remote indexer to a single canonical form: `origin/<branch>`
- Accept and normalize: `main`, `origin/main`, `refs/remotes/origin/main`
- Filter out non-branch entries: bare `origin`, `origin/HEAD`, and `HEAD`
- Add tests for normalization and for skipping invalid entries
- Verify the warning disappears when running `backlog browser`.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Normalize remote branch inputs to canonical ref: origin/<branch>, without double-prefix
- [ ] #2 Filter out invalid refs: HEAD, origin, origin/HEAD; do not query Git for these
- [ ] #3 Accept inputs in any of: main | origin/main | refs/remotes/origin/main and normalize identically
- [ ] #4 Add tests for buildRemoteTaskIndex branch normalization and invalid-ref filtering
- [ ] #5 Manual verification: run backlog browser; the previous warning does not appear anymore
<!-- AC:END -->
