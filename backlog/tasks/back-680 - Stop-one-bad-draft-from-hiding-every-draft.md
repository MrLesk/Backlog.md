---
id: BACK-680
title: Stop one bad draft from hiding every draft
status: To Do
assignee: []
created_date: '2026-09-02 20:31'
labels: []
dependencies: []
ordinal: 312000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
listDrafts returns an empty list for ALL drafts when a single draft file fails to parse (src/file-system/operations.ts around line 1309), so one malformed file makes the entire drafts view look empty rather than showing the rest. Tasks and milestones already do the safer thing and skip only the offending file (around lines 925 and 1794), so drafts are the outlier.

Found while auditing the due-date model, but nothing about it is due-date specific: any parse failure in any draft triggers it. A user in this state sees no drafts at all and has no indication that a file is at fault, which reads as data loss rather than as a broken file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A draft that fails to parse is skipped without affecting the drafts returned alongside it
- [ ] #2 Drafts match the behavior tasks and milestones already have for unparseable files
- [ ] #3 The user can tell that a file was skipped rather than silently seeing a shorter list
- [ ] #4 A test covers a directory containing one unparseable draft and several valid ones
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
