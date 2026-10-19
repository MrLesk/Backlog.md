---
id: BACK-692
title: Preserve complete CLI output when a pipe reader is slow
status: Done
assignee:
  - '@codex-stdout'
created_date: '2026-09-27 21:57'
updated_date: '2026-09-27 22:06'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1041'
modified_files:
  - src/cli.ts
  - src/utils/list-window.ts
  - src/test/cli-pipe-output.test.ts
  - scripts/run-ci-tests.ts
priority: high
type: bug
ordinal: 322000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A supported task list sent to a slow pipe can exit successfully after writing only part of its output. Issue #1041 was reproduced on current source: a 75,794-byte list became 65,532 bytes when the reader waited six seconds. Natural process exit follows console output before all bytes reach the pipe. Scripts need complete finite output without changing watch cancellation behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Finite task-list plain output reaches a delayed pipe reader byte-for-byte before the command reports successful completion.
- [x] #2 Use the existing shared finite output path so equivalent list output does not depend on reader speed; keep output text and JSON contracts unchanged.
- [x] #3 CLI resources still close and task-list watch cancellation still ends promptly even when its output pipe is unread.
- [x] #4 A real delayed-reader process regression fails on the previous behavior and passes with the fix; relevant existing CLI and watch checks pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce missing finite task-list bytes with a real CLI process and delayed pipe reader.
2. Use process.stdout.write, already used for finite JSON, for grouped and priority-sorted plain task lists and the existing shared list-window count/footer. Preserve formatting, resource disposal, and watch cancellation.
3. Keep two delayed-reader regressions: grouped plain output with its window footer, and the separate flat priority path. Compare full bytes with direct file output and clean up children on timeout.
4. Run list/plain/window/JSON and watch checks, TypeScript, Biome, the existing bundled CLI path, and a compiled-binary delayed-reader probe. Record evidence and request contextual review before committing or marking Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Preparation: read MANIFESTO.md, AGENTS.md, task-execution instructions, and context-hunter. Finite JSON already uses process.stdout.write in printJson. Plain grouped and priority-sorted task lists use console.log; count/footer emissions live in printListWindow. runTaskList disposes search/content resources before natural command return. JSON watch owns cancellation and its explicit termination exit; preserve this boundary. Waiting for the coordinator shared-writer release before production/test edits.

Implementation uses the existing process.stdout.write primitive. No new output abstraction, global console override, process-exit hook, resource-drain layer, or watch changes. Plain task-list rows/headings/empty output and list-window count/footer keep the same text. Added the process regression to the existing platform stdio test list; no CI topology change.
Reproduction on Bun 1.4.2 macOS: a 1,000-task source CLI fixture produced 67,794 bytes for a fast reader but 65,480 bytes after six seconds without reading, already exited 0 with empty stderr. The current grouped/window-footer regression was then run against HEAD implementations and failed: expected 2,400,514 bytes, received 2,106,856 with exit 0. No test asserts a truncation size. Restored the fix immediately after the red run.
The initial five-case source and bundled probes all passed (grouped, automatic plain, flat priority, windowed plain, JSON parseability). Subtraction removed redundant delayed auto/JSON/plain cases, keeping grouped+footer and flat-priority coverage. Existing tests retain automatic plain, count, JSON, validation errors, and watch contracts.
Validation so far: TypeScript, Biome, and git diff --check pass. Focused list/plain/window/JSON/watch selection: 83 pass, one unrelated existing guide assertion failed because the BACK-691 overview omitted paging options. Coordinator routed that narrow guide repair to the lifecycle implementer. Source and bundled JSON watch suites pass, including unread-pipe cancellation. Standalone compiled binary probe with the 1,000-task fixture: all 67,794 bytes match a fast reader, exit 0, empty stderr, and process remains alive until the delayed reader starts. Waiting for final reduced-regression results and contextual review; no commit or Done status yet.

Final reduced regression passes on both source and the existing CLI bundle: 2/2 cases each, 15 assertions each. Current grouped/window-footer test was demonstrated red on the prior implementation before restoring the fix. Final TypeScript, repository Biome, and whitespace checks pass. The implementation is ready for architecture/context review; acceptance checks, final summary, terminal status, and commit are left for the review/finalization step.

Contextual architecture review approved the implementation as written with no blockers or advisory changes. The separate paging-guide omission is fixed in c7f9452a, and its targeted guide checks passed. Review authorized finalization and a scoped commit/push on shared main. No further implementation changes were needed.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex-stdout
created: 2026-09-27 22:05
---
Ready for contextual review. The fix stays at finite task-list writes and the shared list-window footer/count; watch disposal and termination are unchanged. Exact-byte delayed-reader tests pass on source and bundle, and a standalone compiled-binary probe also matches. The separate overview paging assertion is being repaired under BACK-691.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Finite plain task lists now use the same stdout stream primitive as JSON so slow pipe readers receive every byte before successful process exit. The shared paging count/footer follows that stream, preserving output text and watch cancellation. Two exact-byte delayed-reader regressions pass on source and bundle; the grouped/footer case was proven to fail on the old implementation. A compiled-binary probe preserves all 67,794 bytes. Relevant list, JSON, watch, and guide checks pass, including unread-pipe watch termination; TypeScript, Biome, and whitespace checks pass. Contextual architecture review approved the final scope.
<!-- SECTION:FINAL_SUMMARY:END -->
