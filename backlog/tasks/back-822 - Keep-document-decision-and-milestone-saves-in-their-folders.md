---
id: BACK-822
title: Keep document, decision, and milestone saves in their folders
status: Done
assignee:
  - '@codex'
created_date: '2026-11-21T17:47:00Z'
updated_date: '2026-11-21T17:50:00Z'
labels: []
dependencies: []
references:
  - src/file-system/operations.ts
  - src/test/filesystem.test.ts
modified_files:
  - src/test/filesystem.test.ts
  - src/file-system/operations.ts
type: bug
ordinal: 419000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Record IDs form part of generated filenames. When an ID contains a directory separator, a save or rename can put the record in the wrong folder.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Documents, decisions, and milestones with IDs that would generate a path fail to save or rename before moving or creating any files.
- [x] #2 Normal saves, supported document subfolders, and existing linked-file behavior continue to work.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add focused cases for rejected record filenames. 2. Reuse the existing single-filename check before joining document, decision, and milestone filenames to their destination folders. 3. Run the focused file, CLI, and linked-folder checks.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reused the existing single-filename check for document, decision, and milestone saves. IDs with folder separators are refused before any file is moved or written. The five focused cases failed before the fix and pass now. All 109 scoped tests passed, including nested documents and linked folders. Types, Biome, cccc, and codehygiene passed.
<!-- SECTION:FINAL_SUMMARY:END -->
