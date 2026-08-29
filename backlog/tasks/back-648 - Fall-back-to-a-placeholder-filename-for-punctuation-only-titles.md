---
id: BACK-648
title: Fall back to a placeholder filename for punctuation-only titles
status: To Do
assignee: []
created_date: '2026-08-29 21:04'
labels:
  - cli
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/897'
ordinal: 281000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
backlog task create '!!!' produces a file named 'task-42 - .md' because sanitizeFilename strips all punctuation. The empty segment is cosmetic (it round-trips through every parser), but contributor PR #897's id-only-filename fix breaks three subsystems that require the ' - ' segment (task watcher, doc save dedup, duplicate repair). Take over PR #897 rewritten to the invariant-preserving fix: sanitizeFilename falls back to a placeholder (e.g. untitled) when the sanitized result is empty, fixing all call sites in one place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A punctuation-only title produces a filename with a non-empty title segment (e.g. 'task-42 - untitled.md')
- [ ] #2 Filenames keep the 'id - title.md' shape; no id-only filenames are introduced
- [ ] #3 Tests cover punctuation-only titles for tasks, docs, and decisions
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
