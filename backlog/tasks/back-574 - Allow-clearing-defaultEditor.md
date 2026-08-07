---
id: BACK-574
title: Allow clearing defaultEditor
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 17:50'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/844'
priority: medium
type: bug
ordinal: 215000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #844. There is no supported way to clear a configured defaultEditor. `config set defaultEditor ""` is rejected because the value is validated as an executable before it is stored (src/cli.ts:4452-4462), and `init --default-editor ""` is silently discarded by truthiness fallbacks (src/cli.ts:827 and src/cli.ts:1032). The only workaround today is hand-editing config.yml.

This matters because the shipped default `code --wait` blocks until the editor window closes, which can hang unattended agent processes. Users need a supported way to turn the editor off.

Reference fix: a fork by iRonin has a clean, tested fix in commit 4541e71 on branch fix/allow-empty-default-editor of iRonin/Backlog.md (from withdrawn PR #850), and it cherry-picks cleanly onto main. If that commit is used, preserve the original commit authorship.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Setting an empty value via `config set defaultEditor ""` clears the key from config.yml
- [x] #2 `init --default-editor ""` clears a previously configured editor
- [x] #3 Non-empty defaultEditor values are still validated before being stored
- [x] #4 Tests cover both clear paths (config set and init)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse iRonin's existing fix from commit 4541e71 (branch fix/allow-empty-default-editor on iRonin/Backlog.md), cherry-picked with authorship preserved.
2. config set defaultEditor: skip the isEditorAvailable executable check when the value is empty, so an empty string is stored; config serialization (src/file-system/operations.ts) already omits default_editor when falsy, which clears the key from config.yml.
3. init --default-editor: change the isNonInteractive check from truthiness to 'options.defaultEditor !== undefined' and the fallback chain in applyAdvancedOptionOverrides from || to ??, so an explicitly empty flag is treated as provided rather than falling through to existingConfig/EDITOR/VISUAL. The existing clear-on-empty logic in src/core/init.ts (hasDefaultEditorOverride + delete config.defaultEditor) then removes the key.
4. Keep validation for non-empty values unchanged.
5. Verify the commit still applies to current main and re-check the touched sites for drift.
6. Tests: 3 cases in src/test/config-commands.test.ts covering config set clear, init --default-editor "" with sentinel EDITOR/VISUAL, and re-init clearing a previously configured editor.
7. Verify with bunx tsc --noEmit, bun run check ., scoped config tests, and the full suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reused iRonin's fix: cherry-picked commit 4541e71 (from withdrawn PR #850) with original authorship preserved (CK @ iRonin.IT). The cherry-pick applied cleanly onto current origin/main (5088d9ee) with no conflicts and no adaptation; its parent (fad58c9a) is only a few commits behind main, so the touched sites had not drifted. Verified both pre-images matched current main byte-for-byte before applying.

Changes (src/cli.ts):
- config set defaultEditor now runs the isEditorAvailable executable check only for non-empty values; an empty value is stored as "" and the config serializer (src/file-system/operations.ts:1636) omits default_editor when falsy, so the key disappears from config.yml.
- init: the isNonInteractive guard uses options.defaultEditor !== undefined instead of truthiness, and the fallback chain uses ?? so an explicitly empty --default-editor is treated as provided rather than falling through to existingConfig/EDITOR/VISUAL. The pre-existing clear-on-empty logic in src/core/init.ts (hasDefaultEditorOverride + delete config.defaultEditor) then removes the key. --default-editor has no default value, so the !== undefined guard cannot spuriously force non-interactive mode.

No new abstraction was needed: both clear paths reuse behavior that already existed (falsy-omitting serialization and the init override-clearing logic); only the two guards that discarded the empty value changed.

Verification evidence:
- AC1: scripted repro in a temp git project. After init with --default-editor "code --wait", config.yml line 7 read default_editor: "code --wait"; after 'config set defaultEditor ""' the line is gone and 'config get defaultEditor' prints 'defaultEditor is not set'.
- AC2: scripted repro with EDITOR/VISUAL=sentinel-editor. First init (no flag) wrote default_editor: "sentinel-editor"; re-init with --default-editor "" removed the line; re-init with --default-editor "cat" wrote default_editor: "cat", so the env fallback and non-empty flag still work.
- AC3: 'config set defaultEditor definitely-not-a-real-editor-xyz' still exits 1 with 'Editor command not found' and does not write the value; 'config set defaultEditor cat' exits 0 and stores it.
- AC4: 3 new tests in src/test/config-commands.test.ts. Confirmed load-bearing: with src/cli.ts reverted to 5088d9ee all 3 fail (init cases receive 'backlog-sentinel-editor' instead of undefined), and all 16 tests in the file pass with the fix.
- DoD1: bunx tsc --noEmit clean.
- DoD2: biome check clean over 357 files. Note: 'bun run check' reports 0 files when run from a worktree under .claude/ because biome.json excludes '!**/.claude' and matches the absolute path; verified by temporarily removing that one pattern, then restoring biome.json unchanged.
- DoD3: full 'bun run test' green: 1892 pass, 5 skip, 0 fail, 8023 expect() calls across 213 files.

Observation left for review, not changed: 'config set defaultEditor ""' prints 'Set defaultEditor = ' with a trailing blank. That message is shared by every config key, so making it clearer for empty values would be a generic change outside this task's scope.

Post-review finalization: rebased onto origin/main at b79fa3a3 (picked up 1034279f biome .claude anchor fix, 5088d9ee docs, and BACK-585). Rebase was clean with no conflicts and no task-file collisions; iRonin's authorship is preserved on the cherry-picked commit. Re-verified after the rebase: bunx tsc --noEmit clean; 'bun run check' now works natively in agent worktrees thanks to 1034279f and reports 357 files checked with no fixes; src/test/config-commands.test.ts 16/16 pass; full 'bun run test' green at 1892 pass, 5 skip, 0 fail across 213 files. Review returned approve with zero blocking findings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Allowed an explicitly empty defaultEditor to mean 'no editor' in both CLI paths, by cherry-picking iRonin's fix (commit 4541e71, authorship preserved). 'config set defaultEditor ""' now skips the executable check and clears default_editor from config.yml; 'init --default-editor ""' is treated as provided (!== undefined / ??) instead of falling through to the existing config or EDITOR/VISUAL, so the pre-existing clear-on-empty logic in src/core/init.ts removes the key. Non-empty values are still validated and rejected when the executable is missing. Verified with 3 new tests in src/test/config-commands.test.ts (confirmed failing against pre-fix src/cli.ts), scripted end-to-end repros of all three issue #844 cases, clean bunx tsc --noEmit and biome check, and a full green bun run test (1892 pass, 5 skip, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
