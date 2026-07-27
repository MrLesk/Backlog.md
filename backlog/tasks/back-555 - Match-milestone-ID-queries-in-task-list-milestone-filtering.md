---
id: BACK-555
title: Match milestone ID queries in task list milestone filtering
status: To Do
assignee: []
created_date: '2026-07-27 20:27'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/819'
  - .local/triage/milestone-parse.md
priority: medium
type: bug
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `--milestone` filter on task listing only matches milestones by title. Querying by milestone ID returns no results, including the exact ID string that the write path canonicalized and stored on the task.

`backlog task list --help` documents the flag as "Milestone ID or title - Closest case-insensitive match". The write path honors that contract (`task create -m 0` resolves and stores `milestone: m-0`), but the read path cannot find what the write path just wrote, so the two surfaces disagree about what a milestone reference is.

Reported upstream as MrLesk/Backlog.md#819.

Cause: the milestone query value is passed raw into the fuzzy matcher while the candidate list is resolved to titles, so the ID-to-title resolver only ever runs on one side of the comparison. The same resolve/match/filter block is duplicated across the CLI list path, the interactive TUI path, and the MCP draft list path, and all three share the asymmetry. The resolver itself already supports ID aliases and is unit tested for it; it is simply never applied to the query.

The browser is not affected: it filters from a milestone picker rather than free text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Listing tasks filtered by a numeric milestone ID (for example 0) returns the tasks assigned to that milestone
- [ ] #2 Listing tasks filtered by the stored milestone ID form (for example m-0) returns the same tasks, case-insensitively
- [ ] #3 Filtering by milestone title continues to work, including partial and typo inputs that rely on closest-match behavior
- [ ] #4 A milestone query that matches no known milestone returns no tasks rather than unrelated ones
- [ ] #5 The interactive TUI task list resolves milestone ID queries the same way as the plain and JSON output paths
- [ ] #6 MCP task listing and draft listing resolve milestone ID queries the same way as the CLI
- [ ] #7 Tests cover ID-form milestone queries at both the unit level and the CLI integration level
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
