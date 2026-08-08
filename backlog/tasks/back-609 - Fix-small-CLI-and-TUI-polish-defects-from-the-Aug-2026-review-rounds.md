---
id: BACK-609
title: Fix small CLI and TUI polish defects from the Aug 2026 review rounds
status: To Do
assignee: []
created_date: '2026-08-08 15:56'
labels: []
dependencies: []
ordinal: 248000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Batch of small confirmed defects surfaced during the Aug 2026 reviews, approved by Alex on 2026-08-08: (1) doc create --plain errors instead of printing plain output; (2) doc list breaks on the older docs output path; (3) the TUI does not restore the previous terminal title on exit; (4) piped backlog board output prints a hardcoded "Project: Project" header instead of the real project name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 doc create --plain succeeds and prints plain output
- [ ] #2 doc list works on projects using the older docs output path
- [ ] #3 The TUI restores the previous terminal title on exit
- [ ] #4 Piped board output shows the real project name in the header
- [ ] #5 Tests cover the doc command and board header fixes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
