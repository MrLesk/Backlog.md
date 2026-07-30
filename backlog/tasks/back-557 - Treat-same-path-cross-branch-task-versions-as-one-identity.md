---
id: BACK-557
title: Treat same-path cross-branch task versions as one identity
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-30 17:11'
updated_date: '2026-07-30 17:28'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update server regressions first: same-ID same-path numeric and legacy variants must reopen the current working copy, and a browser save on a task inherited by an active branch must remain readable; keep padded/different-path collisions and branch-only visibility coverage fail-closed.
2. Replace blob-content comparison in active-branch collision detection with normalized project-relative active-task path comparison, preserving multiple-local-file guards and the server’s current-worktree-authoritative response.
3. Run focused server tests plus duplicate-repair, ID-generation, remote-conflict, and worktree-allocation coverage; run type-check, Biome, diff checks, and the full test suite, then simplify only if it reduces now-unused collision machinery without widening behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented path-based cross-branch task identity: matching canonical IDs at the same normalized project-relative active-task path now resolve to the current working-copy task regardless of content differences. Distinct active paths and multiple local matches remain ambiguous.

Removed blob/tree metadata collection and the now-unused Git tree-entry API; branch scans still pin refs to commits and the ref-move retry coverage remains intact.

Regression proof: the new server expectations failed with 409 before the implementation for divergent numeric same-path, divergent legacy same-path, and browser save then reopen on an inherited branch task. After the change, same-path reads return 200 with local content while the padded different-path fixture remains 409.

Verification: bunx tsc --noEmit; bun run check .; focused 44-test loader/server/Git suite; adjacent 38-test duplicate/ID/archive/worktree/remote suite; full bun test (1778 pass, 4 skip, 0 fail across 199 files).
<!-- SECTION:NOTES:END -->
