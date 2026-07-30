---
id: BACK-557
title: Treat same-path cross-branch task versions as one identity
status: To Do
assignee: []
created_date: '2026-07-30 17:11'
labels:
  - browser
  - git
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/818'
  - 'https://github.com/MrLesk/Backlog.md/issues/783'
type: bug
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser single-task reads currently return 409 when one canonical task ID exists at the same project-relative active-task path across refs but the file bytes differ. This includes normal browser saves, dirty working-copy edits, and branches carrying newer versions of the same task. Treat content as version state rather than identity, preserve the current working copy as authoritative, and retain ambiguity protection for distinct task locations and canonical ID collisions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With checkActiveBranches enabled, saving a task through the browser and immediately reopening it succeeds when active refs contain the same ID at the same project-relative task path; the local working-copy content is returned.
- [ ] #2 Divergent versions of the same canonical ID at the same task path across active local or remote refs resolve as one task, while branch-only cross-branch visibility remains intact.
- [ ] #3 The same normalized ID at distinct active task paths, or multiple matching local active or completed files, still fails closed with 409.
- [ ] #4 Incremental task allocation and archive-as-soft-delete semantics remain unchanged; archived IDs remain reusable.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
