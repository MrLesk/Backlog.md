---
id: BACK-645
title: Move multiple selected tasks between statuses in one action
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-29 18:57'
updated_date: '2026-08-30 00:15'
labels:
  - cli
  - tui
  - web
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/945'
ordinal: 279000
---
## Description

Let users select several tasks and change their status in one action across surfaces, layered per the manifesto: canonical CLI first (`task edit` accepts multiple task IDs and loops the existing single-task edit path, with flags that cannot apply per-task across a batch rejected), and web board plus TUI batch selection as views over one shared core method (`moveTasksToStatus`) with partial-failure per-task error reporting. Implemented by contributor PR #945 (janosmiko); we are taking that PR over in place to preserve credit. Known defects fixed during takeover: the interactive wizard silently dropped extra IDs when `task edit` was called with multiple IDs and no flags; batch drag in the milestone board view changed status but ignored milestone lanes; ~45 lines of id-resolution/branch-guard logic were duplicated between reorderTask and moveTasksToStatus. Browser QA follow-ups fixed on the branch: a no-op batch drop fired a real move plus a full data reload, and the multi-select drag ghost showed only one card.

Note: this record was restored after the original file was lost while uncommitted; the task was created 2026-08-29 and the ID is kept because the PR branch's commit messages reference BACK-645.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI `task edit` with multiple IDs and a status flag updates every listed task via the existing single-task edit path, reporting per-task failures without aborting the batch
- [ ] #2 CLI `task edit` with multiple IDs and no batch-applicable flags fails with a clear error instead of silently opening the wizard for only the first ID
- [ ] #3 Web board and TUI batch moves route through one shared core method; batch drag in the milestone view applies the same milestone semantics as single-task drag
- [ ] #4 Ambiguous or unresolvable task IDs in a batch fail closed as per-task errors; no task is guessed
- [ ] #5 Id-resolution and cross-branch guard logic is shared between reorderTask and moveTasksToStatus rather than duplicated
- [ ] #6 Unrelated formatting churn is removed from the diff
- [ ] #7 Automated tests cover CLI batch edit, per-task failure reporting, web and TUI batch moves, and the milestone-lane case
<!-- AC:END -->
