---
id: BACK-557
title: Treat same-path cross-branch task versions as one identity
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 17:11'
updated_date: '2026-07-30 18:28'
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
- [x] #1 With checkActiveBranches enabled, saving a task through the browser and immediately reopening it succeeds when active refs contain the same ID at the same project-relative task path; the local working-copy content is returned.
- [x] #2 Divergent versions of the same canonical ID at the same task path across active local or remote refs resolve as one task, while branch-only cross-branch visibility remains intact.
- [x] #3 The same normalized ID at distinct active task paths, or multiple matching local active or completed files, still fails closed with 409.
- [x] #4 Incremental task allocation and archive-as-soft-delete semantics remain unchanged; archived IDs remain reusable.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update server regressions first: same-ID same-path numeric and legacy variants must reopen the current working copy, and a browser save on a task inherited by an active branch must remain readable; keep padded/different-path collisions and branch-only visibility coverage fail-closed.
2. Replace blob-content comparison in active-branch collision detection with normalized project-relative active-task path comparison, preserving multiple-local-file guards and the server’s current-worktree-authoritative response.
3. Run focused server tests plus duplicate-repair, ID-generation, remote-conflict, and worktree-allocation coverage; run type-check, Biome, diff checks, and the full test suite, then simplify only if it reduces now-unused collision machinery without widening behavior.

4. Review correction cycle 1: add endpoint regressions for a same-path padded ID variant and a distinct-path origin/main version; canonicalize cross-branch merge keys before store resolution, preserve full remote ref identity in branch state, and verify focused plus full coverage.

5. Review correction cycle 2: reproduce the Core/MCP failure when most-progressed selects a same-path padded ID variant, add Core.getTask and task_archive regressions, then make the local/store identity comparison canonical and keep the current working copy authoritative before running focused and full verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented path-based cross-branch task identity: matching canonical IDs at the same normalized project-relative active-task path now resolve to the current working-copy task regardless of content differences. Distinct active paths and multiple local matches remain ambiguous.

Removed blob/tree metadata collection and the now-unused Git tree-entry API; branch scans still pin refs to commits and the ref-move retry coverage remains intact.

Regression proof: the new server expectations failed with 409 before the implementation for divergent numeric same-path, divergent legacy same-path, and browser save then reopen on an inherited branch task. After the change, same-path reads return 200 with local content while the padded different-path fixture remains 409.

Verification: bunx tsc --noEmit; bun run check .; focused 44-test loader/server/Git suite; adjacent 38-test duplicate/ID/archive/worktree/remote suite; full bun test (1778 pass, 4 skip, 0 fail across 199 files).

Review correction cycle 1:
- Reproduced both reviewer findings against commit 8bb86f71 through the real task endpoint: a local BACK-1 plus active-branch BACK-001 at the same normalized project-relative path returned 409, while a local main task plus active origin/main task with the same ID at a distinct path returned the local task.
- Canonicalized task IDs before cross-branch store merging and used normalized ID comparison when matching the local task to the store result, so same-path normalized-ID variants resolve to the local task.
- Preserved full active remote ref identity (for example origin/main) in branch state while leaving hydrated task display branches unchanged, so a distinct-path origin/main collision remains fail-closed with 409.
- Added endpoint regressions first and observed both fail before implementation; both pass after the fixes.
- Verification: manual endpoint reproduction returned 200/local for the same-path variant and 409 for the distinct-path origin/main collision; focused branch/server suite 40 pass, 0 fail; broader duplicate/core/statistics suite 151 pass, 0 fail; full suite 1780 pass, 4 skip, 0 fail; bunx tsc --noEmit passed; bun run check . passed.

Review correction cycle 2:
- Reproduced against 73b442d1: with local BACK-1 in To Do and same-path active-branch BACK-001 in Done under most_progressed resolution, the merged store selected BACK-001 and Core.getTask("BACK-1") threw AmbiguousTaskIdError.
- Added Core and MCP archive regressions first; both failed before production changes. Core now compares local/store identities with taskIdsEqual, reuses the existing active-branch path collision check, and returns the authoritative local task only when the canonical identity and normalized path agree.
- Added a protective Core regression proving that the same padded identity at a distinct active path still throws; it failed before the path guard and passes afterward. MCP task_archive now mutates the local To Do task in the same-path case without weakening distinct-path or duplicate ambiguity handling.
- Verification: standalone reproduction resolves BACK-1 to the local version; new Core/MCP regressions pass; server identity suite 21 pass, 0 fail; Core/MCP/identity/remote suite 99 pass, 0 fail; full suite 1783 pass, 4 skip, 0 fail across 199 files; bunx tsc --noEmit passed; bun run check . passed; git diff --check passed.

Origin integration before final re-review:
- Fetched and rebased the three unpushed BACK-557 commits onto origin/main fef6e763 (BACK-560 loopback binding). The rebase completed without conflicts or manual executable-code resolution.
- Confirmed BACK-560 remains intact: the server binds/displays 127.0.0.1 and BACK-557 changes only the task identity comparison in the overlapping server file.
- Rebased verification: new Core/MCP regressions 3 pass; server identity suite 21 pass; Core/MCP/identity/remote suite 99 pass; BACK-560 hostname/port suite 12 pass; TypeScript, Biome, and diff checks passed. The full suite was not rerun because the rebase had no conflict resolution or manual executable changes.

Finalization validation on rebased origin/main tree bec40718: bun test completed with 1786 pass, 4 skip, 0 fail across 200 files; bunx tsc --noEmit passed; bun run check . passed. Focused evidence also covered browser save/reopen, same-path local and remote variants, distinct-path and duplicate ambiguity, Core and MCP mutation behavior, ID allocation, and archive soft-delete behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Changed active-branch task identity to use the canonical task ID together with the normalized project-relative task path. Same-path versions now reopen and mutate the current working-copy task, while genuinely different paths and duplicate local files still fail closed. Verified with focused browser, Core, MCP, branch, remote, allocation, and archive tests plus the full suite (1786 pass, 4 skip, 0 fail), TypeScript, and Biome.
<!-- SECTION:FINAL_SUMMARY:END -->
