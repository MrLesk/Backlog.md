---
id: task-250
title: 'Docs: fix subpath documents listing/view + unique IDs'
status: In Progress
assignee:
  - '@codex'
created_date: '2025-09-04 19:18'
updated_date: '2025-09-04 20:19'
labels:
  - docs
  - bug
  - cli
dependencies: []
priority: medium
---

## Description

Follow-up to GitHub issue #318. Documents created under subdirectories of backlog/docs are not included in `backlog doc list`, and `backlog doc view` cannot open them. Also, when remote operations are disabled or there is no git remote history, ID generation ignores subdirectories and may create duplicate doc IDs.

Goal: Support documents stored in subdirectories end-to-end (list, view, ID generation) with global, sequential IDs across the entire docs tree, both online and offline.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog doc list --plain includes documents from all subdirectories under backlog/docs (recursive) and lists them consistently.
- [ ] #2 backlog doc view (by ID) opens a document correctly even when it resides in a subdirectory.
- [ ] #3 Creating docs with backlog doc create -p <path> produces globally unique, sequential IDs across the entire docs tree, including when remoteOperations=false/offline.
- [ ] #4 Use recursive traversal for docs in: filesystem listDocuments, CLI doc list (interactive and plain), and CLI doc view.
- [ ] #5 Add tests covering: (a) recursive listing with subdirectories, (b) ID generation offline with subdir docs present, (c) view by id for a subdir doc.
- [ ] #6 Update docs explaining that document IDs are global across subdirectories and provide examples with -p and nested paths.
<!-- AC:END -->

## Implementation Plan

1. Make filesystem.listDocuments recursive and stable
2. Update CLI doc list/view to use recursive search by ID
3. Ensure generateNextDocId sees all local docs (offline)
4. Add tests for recursive listing, offline ID generation, view by id
5. Update docs to note global IDs across subpaths
