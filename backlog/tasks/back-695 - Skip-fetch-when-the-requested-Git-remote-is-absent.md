---
id: BACK-695
title: Skip fetch when the requested Git remote is absent
status: Done
assignee:
  - '@codex-1023'
created_date: '2026-09-27 22:14'
updated_date: '2026-10-19T16:42:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/1023'
  - 'https://github.com/MrLesk/Backlog.md/issues/1020'
  - src/git/operations.ts
  - src/test/git.test.ts
  - src/test/no-remote-preflight.test.ts
  - src/test/offline-mode.test.ts
modified_files:
  - src/git/operations.ts
  - src/test/no-remote-preflight.test.ts
  - src/test/git.test.ts
  - src/test/offline-mode.test.ts
priority: medium
type: bug
ordinal: 325000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Repositories with only a differently named remote can produce repeated Git errors during task reads because the preflight checks for any remote, then attempts to fetch origin. Contributor PR #1023 fixes the requested-remote preflight through the existing Git primitive and adds a real upstream-only repository regression for issue #1020.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A fetch request for an absent remote returns without attempting that fetch, including a repository whose only remote is upstream.
- [x] #2 Existing fetch behavior for a configured requested remote and disabled remote operations stays intact.
- [x] #3 The contributor fix and its Git regressions pass review and remain attributed in the existing PR, with this task identity and matching title.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Recheck PR #1023 and issue #1020, trace the requested-remote fetch gate, and prove the contributor upstream-only regression fails on main 6615b0cd7e08b4bbcb3bc5018abe7b485c817999.
2. Preserve both existing PR commits and merge current main on a feature branch. Keep the existing hasRemote(remote) implementation, timeout, network handling, disabled-remote gate, and shared fetch promises; repair only proven integration defects.
3. Record changed-file links in first-change order. Verify the regression and public compiled CLI search/task reads in an upstream-only repository, then run focused Git/remote/offline/corpus tests and canonical type, Biome, and build checks.
4. Review the diff for simplification and freeze main-relative source/test bytes, hashes, and proof for the parent architecture review. Run the established full CI test profile on those unchanged bytes.
5. After architecture review authorizes finalization, verify AC and DoD through the CLI and create one normal-hook local final commit with the PR head and current main as ancestors. Leave publication and final contributor approval to the parent.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Original implementation and regression tests are by Lingikaushikreddy (Kaushikreddy Lingi) in PR #1023, commit cc187d43b37b475fe1ff905c39d2b25b7f988af3. The contributor commit and all production/test blobs are preserved.

Read-only review: fetchRemote now asks the existing hasRemote(remote) helper whether the requested name exists. The helper reads configured remote names and compares the exact requested name. The remoteOperations=false gate remains before this check. The fetch command, timeout, network-error handling, and concurrent-fetch behavior are unchanged. The added regression creates a repository whose only remote is upstream and expects the default-origin fetch to return successfully. Existing fetch and offline-mode mocks are adjusted to the helper that is now called. No concrete source defect or source repair was identified in this review.

This record is the only addition prepared here. No runtime or CI result is claimed by this review; the PR head still requires exact-head CI evidence. Acceptance criteria and Definition of Done remain unchecked.

2026-10-19 merge-readiness work: PR head rechecked as 1ed54f62629ca979701177243a699d260f98cdca with maintainerCanModify=true. The exact contributor upstream-only regression was copied to a temporary external harness with absolute imports and failed on clean main 6615b0cd7e08b4bbcb3bc5018abe7b485c817999 (0 pass, 1 fail). No TUI corruption reproduction is claimed.

Integrated current main 6615b0cd7e08b4bbcb3bc5018abe7b485c817999 with --no-commit on a feature branch rooted at PR head 1ed54f62629ca979701177243a699d260f98cdca. Merge applied cleanly and needed no manual source or test repairs. The main-relative implementation is exactly the existing contributor patch. The temporary copied upstream-only regression passes after integration (1 pass, 0 fail). Public compiled CLI proof in the same upstream-only fixture: main search returns TASK-1 with 4449 bytes of Git-error stderr; integrated search, task list, and task view all return TASK-1 with empty stderr. No TUI corruption reproduction is claimed. Canonical bun run check:types (569 files), bun run check . (464 files), bun run build, and the task legacy bunx tsc --noEmit check pass. Focused tests initially had 50 pass and one watched-deletion timeout in the unchanged corpus regression, whose fixture has remoteOperations=false; an isolated restricted-sandbox retry also timed out (9 pass, 1 fail). The normal full CI profile is running with local server/watcher access. Subtraction review found no new helpers, public surface, layers, or removable extra coverage; the existing requested-remote helper and contributor regression provide the bounded fix.

Final verification on unchanged reviewed source: the full-context architecture review returned KEEP with no blocker or simplification. Source SHA256 values match the frozen review manifest. The valid full CI profile used TERM=xterm-256color BACKLOG_TEST_CLI_BUNDLE=/private/tmp/pr1023-proof/js-bundle/cli.js bun scripts/run-ci-tests.ts --profile=full --parallel=4 --isolate --timeout=10000 --max-concurrency=4: non-DOM pass 3172 passed, 13 skipped, 0 failed across 281 files (116.51s); DOM pass 399 passed, 0 failed across 39 files (11.48s). Focused elevated verification passed all 51 tests with 132 assertions (7.21s). The two earlier watched-deletion timeouts remain recorded; their cause is unproven. The affected corpus regression and watcher implementation are unchanged from main, and its disabled-remote fixture cannot reach the changed fetch method. The first full-suite launch incorrectly supplied a native executable as a JavaScript bundle; it was stopped and its results are excluded.
AC evidence: #1 exact real upstream-only regression fails on main and passes integrated, and compiled search no longer prints the missing-origin Git error; #2 focused tests verify no-remotes, configured origin, disabled remote operations, timeout handling, and shared fetch work; #3 contributor commit cc187d43b37b475fe1ff905c39d2b25b7f988af3 and existing PR head 1ed54f62629ca979701177243a699d260f98cdca are preserved, the source review passed, and BACK-695 identity/title are unchanged. DoD evidence: legacy bunx tsc --noEmit, canonical types/Biome/build, focused tests, and the valid full profile all pass. No public GitHub changes or push were made during this local preparation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fetch now uses the existing requested-remote check, so repositories with only upstream skip a missing-origin fetch quietly. Preserved contributor commits and regression coverage while integrating current main without source repairs. The real regression fails on main and passes integrated; compiled search/list/view return the fixture task with empty stderr. Focused tests pass 51/51; the full profile passes 3571 tests with 13 skips and no failures. Types, Biome, native and JavaScript builds, and legacy tsc pass. Architecture review found no blocker. Direct TUI corruption was not reproduced; publication and remote gates remain separate maintainer steps.
<!-- SECTION:FINAL_SUMMARY:END -->
