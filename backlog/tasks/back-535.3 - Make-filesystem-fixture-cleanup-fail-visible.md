---
id: BACK-535.3
title: Make filesystem fixture cleanup fail visible
status: In Progress
assignee:
  - '@test-hygiene-filesystem'
created_date: '2026-07-11 09:21'
updated_date: '2026-07-11 11:50'
labels: []
dependencies: []
parent_task_id: BACK-535
priority: medium
ordinal: 174000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mechanically repair the exact filesystem-only cleanup sites from the complete catch inventory after BACK-535.2 establishes the lifecycle rules.

Owned redundant pre-clean sites (37): src/test/task-edit-preservation.test.ts:15, src/test/config-commands.test.ts:18, src/test/cli-task-type.test.ts:15, src/test/definition-of-done-cli.test.ts:14, src/test/task-path.test.ts:22, src/test/claude-agent-install.test.ts:14, src/test/acceptance-criteria.test.ts:15 and :471, src/test/definition-of-done.test.ts:23, src/test/cli-commit-behaviour.test.ts:23 and :104, src/test/references.test.ts:14, src/test/tab-switching.test.ts:15, src/test/documentation.test.ts:14, src/test/start-id.test.ts:20, src/test/cli-auto-plain-non-tty.test.ts:17, src/test/cli-agents.test.ts:15 and :99, src/test/agent-instructions.test.ts:19, src/test/cli-task-wizard.test.ts:14, src/test/auto-commit.test.ts:16, src/test/append-implementation-notes.test.ts:15, src/test/cli-incrementing-ids.test.ts:18, src/test/view-switcher.test.ts:14, src/test/cli-plain-output.test.ts:18, src/test/description-newlines.test.ts:17, src/test/draft-create-consistency.test.ts:16, src/test/cli-milestone-filter.test.ts:17, src/test/acceptance-criteria-structured.test.ts:12, src/test/cli-refs-docs.test.ts:17, src/test/cleanup.test.ts:30, src/test/desc-alias.test.ts:17, src/test/cli-plain-create-edit.test.ts:17, src/test/cli-task-milestone.test.ts:17, src/test/cli-parent-filter.test.ts:17, src/test/cli.test.ts:22, and src/test/cli-zero-padded-ids.test.ts:17.

Owned swallowed filesystem teardown sites (59): src/test/task-edit-preservation.test.ts:31, src/test/comments.test.ts:27, src/test/dependency.test.ts:28, src/test/config-commands.test.ts:193, src/test/prefix-migration.test.ts:24, src/test/core.test.ts:31, src/test/implementation-plan.test.ts:26, src/test/cli-task-type.test.ts:30, src/test/board-loading.test.ts:29, src/test/description-newlines.test.ts:31, src/test/remote-id-conflict.test.ts:57, src/test/task-type.test.ts:28, src/test/definition-of-done-cli.test.ts:32, src/test/draft-create-consistency.test.ts:32, src/test/task-path.test.ts:46, src/test/implementation-notes-append.test.ts:26, src/test/status-callback.test.ts:106, src/test/final-summary.test.ts:24, src/test/cli-root-entry.test.ts:19, src/test/cli-final-summary.test.ts:26, src/test/cli-milestone-filter.test.ts:123, src/test/claude-agent-install.test.ts:19, src/test/acceptance-criteria.test.ts:28 and :484, src/test/enhanced-init.test.ts:18, src/test/acceptance-criteria-structured.test.ts:19, src/test/filesystem.test.ts:24, src/test/cli-refs-docs.test.ts:31, src/test/editor.test.ts:129, src/test/cli-commit-behaviour.test.ts:54 and :133, src/test/references.test.ts:28, src/test/cli-init-no-git.test.ts:39, src/test/tab-switching.test.ts:49, src/test/documentation.test.ts:28, src/test/start-id.test.ts:30, src/test/cli-auto-plain-non-tty.test.ts:43, src/test/cli-agents.test.ts:31 and :114, src/test/find-backlog-root.test.ts:21, src/test/cleanup.test.ts:48, src/test/agent-instructions.test.ts:26, src/test/implementation-notes.test.ts:39, src/test/cli-task-wizard.test.ts:27, src/test/desc-alias.test.ts:35, src/test/cli-plain-create-edit.test.ts:33, src/test/cli-task-milestone.test.ts:33, src/test/auto-commit.test.ts:31, src/test/append-implementation-notes.test.ts:29, src/test/cli-parent-filter.test.ts:96, src/test/cli-incrementing-ids.test.ts:32, src/test/parent-id-normalization.test.ts:28, src/test/id-generation.test.ts:24, src/test/view-switcher.test.ts:36, src/test/cli.test.ts:31, src/test/cli-zero-padded-ids.test.ts:42, src/test/unified-view-loading.test.ts:21, src/test/definition-of-done.test.ts:36, and src/test/cli-plain-output.test.ts:95.

Every site is identified by the current-main line captured in the audit; implementation must re-locate the stated expression after edits rather than treating the line number as a permanent API. The 24 resource-owning cleanup sites are explicitly excluded and owned by BACK-535.4. The remaining distribution is 22 legitimate expected-error/fallback sites recorded in BACK-535.2 and four vacuous assertion sites assigned to BACK-535.5; src/test/test-utils.ts:65 remains one of the legitimate fallbacks because bounded retry captures the last error and rethrows after exhaustion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Focused stress and the full local gate pass, and the exact PR head passes the actual GitHub Actions Windows test matrix; Windows-equivalent local evidence is insufficient
- [x] #2 All 37 enumerated redundant pre-clean sites are removed from unique fixture paths
- [x] #3 All 59 enumerated filesystem-only teardown failures are fail-visible without changing test behavior
- [x] #4 No BACK-535.4 resource-owning site, BACK-535.5 vacuous assertion site, or legitimate explicit catch site is changed
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove the 37 enumerated redundant pre-clean sites only.
2. Convert the 59 enumerated filesystem-only teardown sites to direct fail-visible cleanup, using framework hooks.
3. Confirm no BACK-535.4 resource-owning site and no justified/expected catch site changed.
4. Run repeated focused batches locally, full static/build/test gates, then obtain successful GitHub Actions evidence from the actual Windows test matrix.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context Hunter L2 brief: this is a wide mechanical test-only slice spanning 59 teardown and 37 redundant pre-clean sites. Follow the direct afterEach safeCleanup/rm pattern established by BACK-535.2; remove pre-clean only when createUniqueTestDir or mkdtemp already guarantees uniqueness; preserve primary errors for any in-test resource via a hook or drained finally. Reuse safeCleanup, remove only imports made unused, and do not touch BACK-535.4 resource files, BACK-535.5 vacuous sites, production code, or legitimate catches. Primary risks are overlapping setup/teardown edits, stale line numbers after rewrites, Windows file-handle cleanup, and accidentally changing fixture behavior.

Implemented all 96 owned sites across 56 test files: removed 37 redundant unique-path pre-clean catches and made 59 filesystem teardowns fail-visible. The A-L delegated batch repaired 78 sites and passed 512 focused tests; the M-Z batch repaired 18 sites and passed 105 focused tests. Integrated scan fell from 146 to exactly 50 remaining catches, matching 24 BACK-535.4 resource sites, 22 legitimate sites, and 4 BACK-535.5 sites; no excluded file changed. Moved cli-agents auxiliary directory cleanup into afterEach so assertion failures cannot skip it. Two integrated changed-suite runs each passed 617 tests across 56 files with 2,257 assertions and 0 failures in 95.89s and 91.73s. Full suite passed 1,666 with 2 intentional interactive-TUI skips, 0 failures, and 6,804 assertions across 189 files in 174.59s. bunx tsc --noEmit, Biome over 323 files, bun run build, and diff checks passed. Actual Windows CI remains required before AC1 and finalization.

Specification review found acceptance-criteria-structured retained a fixed, unused repository temp directory after its catch removal. Removed the dead TEMP_DIR constant, beforeAll/afterAll hooks, and fs/path imports rather than replacing an unused fixture. Focused test passed 1/1; the integrated changed-suite rerun passed 617 tests across 56 files with 2,257 assertions and 0 failures in 89.18s. TypeScript, Biome over 323 files, build, diff checks, and the exact remaining-catch count of 50 passed.

Independent specification review approved the corrected exact diff after removal of the unused fixed TEMP_DIR fixture. Fresh quality review approved with no actionable findings after independently reconciling 146 baseline catches minus 96 owned removals to 50 documented exclusions, running the changed suite 617/617, and verifying TypeScript/Biome. AC1 remains intentionally unchecked until the published exact head passes the real GitHub Actions Windows matrix.

First exact-head Windows CI exposed two failures. Shard 2 produced an unhandled ViewSwitcher BackgroundLoader error after afterEach removed its Git working directory; two updateState tests started background loads without awaiting them. Attached to each existing load, drained it with Promise.allSettled in finally so assertion failures remain primary, and asserted successful completion afterward. No production change, sleep, or timeout increase. ViewSwitcher passed 50/50 stress. The first full rerun hit an unrelated unchanged server SPA 5-second timeout; that exact test passed 10/10 in isolation, and a captured full rerun then passed 1,666 tests with 2 intentional skips, 0 failures, and 6,806 assertions across 189 files in 169.45s. TypeScript, Biome over 323 files, build, diff checks, and catch count 50 pass. Windows shard 1 also timed out in excluded build.test at its existing 30-second limit; no change is justified without recurrence after the actionable fix.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
