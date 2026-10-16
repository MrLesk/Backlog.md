---
id: BACK-723
title: Say that nothing was applied when task edit rejects a batch
status: Done
assignee:
  - '@codex-723'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-16 06:03'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1061'
  - src/cli.ts
modified_files:
  - src/cli.ts
  - src/test/acceptance-criteria.test.ts
  - src/test/cli-edit-not-applied.test.ts
type: bug
ordinal: 341000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task edit` applies all field changes in one invocation together. When one part is invalid, for example an out-of-range `--check-dod` index, the whole edit is rejected and nothing is written, but the output only names the invalid part. The only sign that the other fields were discarded is the missing `Updated task <id>` line, which is easy to miss, so a caller can believe that notes, a final summary, and checklist ticks were recorded when the task is unchanged (issue #1061, reported on 1.51.0). The issue reports the same shape for an unknown option and for a comment body that contains a reserved delimiter line.

Edits stay all-or-nothing. Applying the valid parts of a rejected edit, and a `--check-dod all` style convenience, are not part of this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When any part of a `backlog task edit` invocation is rejected, the error output names what was rejected and states explicitly that no changes were applied to the task.
- [x] #2 The command exits non-zero in that case.
- [x] #3 The task is unchanged after a rejected edit: edits stay all-or-nothing.
- [x] #4 The statement is printed whichever part of the edit was rejected, not only for checklist index errors.
- [x] #5 The output of a successful edit is unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Merge current origin/main into the existing PR ancestry and preserve task identity, locks, archived records, and marked Markdown sections.
2. Keep one shared task/draft edit rejection wrapper and parser error output. Retain CLI-only byte comparison and preserve Core, MCP, and HTTP failure messages.
3. Verify all-or-nothing rejections, unchanged success output, task saves and draft renames followed by commit failure, and both orders of partial multi-ID success.
4. Run related CLI, lock, identity and lifecycle tests; type checks; Biome; build; and compiled CLI smoke. Compare the final diff with main and simplify comments.
5. Complete contextual architecture review on stable source/test hashes, record proof, and publish the reviewed existing PR head.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PR #1086 was integrated with origin/main 71f7d3e through merge ec7badec, preserving the original PR head bf3dfe65 as a parent. The existing registered worktree and its local branch remain unchanged.

Implementation: one shared CLI wrapper prints No changes were applied. once after a rejected task or draft edit when no update took effect. Shared parser output covers errors before the action runs. A successful update or changed file suppresses the sentence, including an edit saved before its commit fails. The edit body moved into performEdit is byte-identical to current main (SHA256 3348993a8d9e30268dcd481cd1ac154764233a5afdab87eabd8626c50ceed09c). Core, MCP and HTTP error behavior is unchanged.

Proof for AC 1-4: 16 task rejection and 3 draft rejection cases assert the reason, the sentence exactly once, nonzero exit, empty stdout, and identical bytes for every task and draft file. Cases include invalid checklist indexes, reserved comment delimiters, unknown or missing options, invalid configured fields, conflicting flags, missing IDs, and batch-wide failures. The existing malformed-marker suite also passes.
Proof for AC 5: task and draft success output matches the previous exact output; plain output has no rejection sentence. Partial multi-ID success has the existing per-task output in both ID orders. Saved task changes and saved draft rename remain on disk after a failed commit and never receive the sentence.

Verification: 26 focused tests pass. Related suite: 307 pass, 1 existing skip, 0 fail across 20 files. Combined: 333 pass, 1 skip, 0 fail. The related suite required local server access; a sandbox port-0 bind failed, the same bind passed with that access, and the full related suite then passed. bun run check:types (563 files), bunx tsc --noEmit, bun run check . (458 files), and bun run build pass. The compiled CLI passed 10 smoke checks for task/draft rejection and success, archived read-only behavior, partial multi-ID success, and saved changes with failed commits.

Simplification review shortened the original wrapper comments without adding a new layer or shared error framework. Full-context architecture review returned KEEP on the stable source/test hashes with no material recommendation.

Limits: the byte reads run outside core locks and can conservatively suppress the sentence if another process changes the same file. No-project failure still exits before the edit begins. The default task-edit status list does not accept Draft, so no unsupported demotion flow was added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task edit and draft edit now say No changes were applied. exactly once when an edit is rejected before any change. Successful output and all-or-nothing edits are preserved. The sentence is suppressed after a saved change with failed commit and after partial multi-ID success. Current main is merged without changing the shared edit body. Verification: 333 tests pass, 1 existing skip, type checks, Biome, build, and 10 compiled CLI smoke checks pass. Contextual architecture review kept the existing CLI-only design.
<!-- SECTION:FINAL_SUMMARY:END -->
