---
id: BACK-498
title: >-
  Forge Integration Analysis: Research Forgejo unit mutual exclusion — can
  TypeBacklogIssues coexist with TypeIssues?
status: To Do
assignee: []
created_date: '2026-05-17 19:53'
updated_date: '2026-05-17 19:58'
labels:
  - forge-integration
  - forgejo
  - analysis
  - go
  - research
milestone: m-7
dependencies: []
references:
  - >-
    backlog/docs/doc-5 -
    Forge-Integration-Feasibility-Study-—-Backlog.md-↔-Forgejo-GitHub-GitLab.md
  - /home/jo/kit/forgejo/models/unit/unit.go
priority: high
ordinal: 184000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Critical analysis task for Forge Integration Phase 2. Before building a new `TypeBacklogIssues` Forgejo unit type, we must understand the exact constraints and all code paths that enforce or assume mutual exclusion between `TypeIssues` and `TypeExternalTracker`.

**Known starting point:**
- `models/unit/unit.go:242`: `addMutuallyExclusiveGroup(TypeIssues, TypeExternalTracker)`
- This is the ONLY place where mutual exclusion is registered — but code across the codebase may ALSO assume only one issue-like unit exists

**Research questions:**
1. Is `addMutuallyExclusiveGroup` the only enforcement, or are there other `if TypeIssues || TypeExternalTracker` checks elsewhere?
2. How does `services/context/repo.go` determine which issue unit is active? Would it need changes?
3. Are there any templates that assume `TypeIssues` is the only issues-like unit?
4. Can `TypeBacklogIssues` be added OUTSIDE the mutual exclusion group, giving it its own tab without interfering with TypeIssues?
5. What happens to navigation/routing if both TypeIssues and TypeBacklogIssues are enabled simultaneously?

**Files to read in Forgejo:**
- `models/unit/unit.go` (full)
- `services/context/repo.go` — how active units are determined
- `routers/web/repo/issue.go` — how the issues router gates on unit type
- Any template using `HasIssues` or `UnitTypeIssues`
- `routers/web/routes.go` or similar — route registration

**Deliverable:** Implementation notes on this ticket describing: (a) all enforcement points, (b) required code changes to allow TypeBacklogIssues alongside TypeIssues, (c) risk assessment, (d) recommendation on whether to implement or find a workaround.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All code paths enforcing TypeIssues/TypeExternalTracker mutual exclusion are identified and listed
- [ ] #2 A concrete plan for adding TypeBacklogIssues as non-exclusive unit is drafted in Implementation Notes
- [ ] #3 Risk of breaking existing functionality is assessed (high/medium/low with reasons)
- [ ] #4 Recommendation: proceed with TypeBacklogIssues, use workaround, or pivot to different option
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
