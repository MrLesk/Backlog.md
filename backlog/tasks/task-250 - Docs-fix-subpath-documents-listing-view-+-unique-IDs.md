---
id: task-250
title: 'Docs: fix subpath documents listing/view + unique IDs'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-04 19:18'
updated_date: '2025-09-06 14:07'
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
- [x] #1 backlog doc list --plain includes documents from all subdirectories under backlog/docs (recursive) and lists them consistently.
- [x] #2 backlog doc view (by ID) opens a document correctly even when it resides in a subdirectory.
- [x] #3 Creating docs with backlog doc create -p <path> produces globally unique, sequential IDs across the entire docs tree, including when remoteOperations=false/offline.
- [x] #4 Use recursive traversal for docs in: filesystem listDocuments, CLI doc list (interactive and plain), and CLI doc view.
- [x] #5 Add tests covering: (a) recursive listing with subdirectories, (b) ID generation offline with subdir docs present, (c) view by id for a subdir doc.
- [x] #6 Update docs explaining that document IDs are global across subdirectories and provide examples with -p and nested paths.
<!-- AC:END -->


## Implementation Plan

1. Make filesystem.listDocuments recursive and stable
2. Update CLI doc list/view to use recursive search by ID
3. Ensure generateNextDocId sees all local docs (offline)
4. Add tests for recursive listing, offline ID generation, view by id
5. Update docs to note global IDs across subpaths


## Implementation Notes

Support docs in subdirectories end-to-end (list, view, IDs).

- Recursive listing: FileSystem.listDocuments uses **/*.md under backlog/docs, excluding README; CLI doc list uses it for both plain and interactive.
- View by ID in subpaths: CLI doc view scans recursively and matches ID-based filenames; test covers viewing a subdir doc by id.
- Global unique IDs: generateNextDocId aggregates IDs from all branches (when remote ops enabled) and from local listDocuments for offline, ensuring monotonic doc-<n> IDs across subdirectories.
- Tests: src/test/docs-recursive.test.ts verifies recursive list, view by id, and offline ID generation with subpaths.
- Docs: README explains that document IDs are global across subdirectories and shows -p examples.
