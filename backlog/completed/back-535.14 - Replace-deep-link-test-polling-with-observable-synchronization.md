---
id: BACK-535.14
title: Replace deep-link test polling with observable synchronization
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 21:34'
updated_date: '2026-07-11 22:38'
labels: []
dependencies: []
modified_files:
  - src/test/web-task-detail-deeplink.test.tsx
parent_task_id: BACK-535
priority: high
ordinal: 184000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The shared deep-link browser test helper still uses fixed 50 x 5 ms attempt polling, which fails under CI load. Audit every remaining caller in src/test/web-task-detail-deeplink.test.tsx and replace the polling class comprehensively with deterministic observable synchronization while preserving diagnostics, semantics, and the global 10-second test timeout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every remaining shared waitFor caller is classified by its observable event or state transition
- [x] #2 Fixed-attempt polling is replaced with deterministic observable synchronization and explicit lifecycle cleanup, using case-specific signals when DOM mutation is insufficient
- [x] #3 No timeout inflation or product, mobile, or production-code changes are introduced
- [x] #4 Targeted stress, whole-file, full-isolate, typecheck, Biome, build, and diff verification pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit all 45 shared polling callers and classify their causal operation. 2. Replace universal polling with labeled fetch operations that settle through response body readers, manual response gates for intentional races, synchronous WebSocket delivery, one-shot history signals, and a controlled verified product timer. 3. Verify every operation is drained during teardown and keep assertions synchronous after act returns. 4. Run fixed 50x stress, the whole file, exact full isolate, typecheck, Biome, build, and diff checks; then simplify.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Concern cycle 1/3: CI #772 final-head Ubuntu job 86585523928 failed nine times at shared waitFor line 239 (callers 493, 535, 555, 651 x4, 679, 693, 712). The #775 overlap caller is already fixed and excluded. Main design concern: MutationObserver is only truthful for predicates whose satisfaction is accompanied by DOM mutation; non-DOM state requires an explicit deferred/event signal.

Concern architecture reset: rejected universal-predicate synchronization experiments are preserved as evidence, not final design. MutationObserver awaited inside act deadlocked and produced unchanged 5-second runner timeouts; outside act it passed 21/21 but emitted widespread unwrapped React update warnings. A generic mocked response-body event likewise deadlocked inside act and warned outside act. Temporarily suppressing IS_REACT_ACT_ENVIRONMENT made focused 1/1 and whole-file 21/21 clean, with Biome/typecheck/diff passing, but was rejected because it hides harness evidence. The attempted 50x stress run was aborted immediately on rejection. Final architecture must use labeled operation-scoped fetch calls tracked through deepest json/text body reads with settle/manual respond, synchronous socket delivery inside act, immediate history assertions, and fail-visible afterEach verification. Prohibited synchronization mechanisms for this task are universal predicate waits, MutationObserver, generic act flush loops, act-environment suppression, polling, timeout changes, and private-field probes introduced for synchronization.

Concern cycle 2/3 - architecture reset implemented. Complete 45-site map: board/direct/filter route lifecycle 10; overlap WebSocket readiness 1; sidebar search/open/close 4; legacy-highlight open/close 2; stable list open/Back/Forward/close 5; scenario-loop initial/fallback/Back 3 static callers (each exercised for missing, ambiguous, and active-branch collision); direct collision alert 1; cross-prefix and legacy list/route/direct/missing 6; archive navigation/open/close 3; stale-route list/pending/newer/close 4; duplicate-plan socket/newer-load 2; custom-prefix direct/open-close 2; malformed route fallbacks 2. Render callers now settle initial status, search, and routed task phases. Click/socket callers settle labeled body readers; close/history callers await the relevant popstate or assert immediately; archive settles the response-only DELETE plus refresh search; intentional overlap, route, and duplicate races use manual respond gates. Sidebar search relies on its real 200ms debounce before the labeled search starts. Legacy highlight uses a controlled real 100ms timer advanced inside act and models clearTimeout so StrictMode runs only the live callback. No universal wait, MutationObserver, act-environment suppression, synchronization polling, or timeout change remains. BACK-535.14 adds no new private-field probe and does not use private fields for synchronization. The pre-existing setInputValue `__reactProps$` fallback remains unchanged from current main; BACK-535.9/PR #772 explicitly owns its removal, and it must remain on this prerequisite branch so #772 can later rebase and remove it without duplicating scope. Validation: unchanged polling baseline 420/420 locally; external Ubuntu #772/all-18 failures remain red evidence. Cause-scoped implementation passed 21/21 whole file; fixed 50x whole-file stress 1050/1050 with 8150 assertions in 70.68s; exact full isolate passed 1653 with 2 intentional skips and 0 failures across 192 files in 235.63s; tsc, Biome over 328 files, build, and diff-check pass. Teardown verifies named missing/pending fetch calls with URL and body-reader depth, resolves manual gates inside act, removes history listeners, restores timer/fetch/globals, and fails visibly after cleanup.

Specification review cycle 1: CHANGES REQUIRED (concern 1/3). Finding: the task record incorrectly claimed that private fields/private-field probes were absent, although the pre-existing setInputValue `__reactProps$` fallback intentionally remains unchanged. Correction: narrowed the claim to this task's synchronization scope and recorded BACK-535.9/PR #772 ownership. Pending specification re-review; quality review has not started.

Quality review cycle 1: CHANGES REQUIRED (socket concern 1/3), pending quality re-review; no quality approval has been granted. Finding: the removed activeWebSocket variable selected the latest constructed fake socket, so the delayed 100ms health-check socket could shadow the actual App data socket and silently receive config/tasks delivery through optional chaining. Fix: select the App data socket fail-visibly from FakeWebSocket.instances using readyState OPEN plus a non-null data onmessage handler, with per-instance diagnostics when none qualifies. Both socket-driven tests now advance the controlled real 100ms health timer, prove multiple sockets exist, prove the newest health socket has no data handler and is not selected, then deliver through the selected App data socket. No private fields are inspected. Validation for this correction: focused overlap plus stale-duplicate tests passed 400/400 across 200 repeated file runs with 3400 assertions in 11.48s; full file passed 21/21 with 167 assertions; bunx tsc --noEmit, Biome over 328 files, and git diff --check pass.

Quality review cycle 2: APPROVED. The socket concern from quality cycle 1 is resolved; the live OPEN App data socket with installed onmessage is selected fail-visibly, and the delayed 100ms health socket is directly proven not to be selected. Final socket-fixed terminal verification: exact full isolate `bun test --isolate --timeout=10000 --max-concurrency=4` passed 1653 tests with 2 intentional interactive-TUI skips, 0 failures, and 6843 assertions across 192 files in 180.36s; `bun run build` passed; `git diff --check` passed. Final diff/status remains limited to modified src/test/web-task-detail-deeplink.test.tsx plus the CLI-created BACK-535.14 task record. Task remains In Progress pending remaining specification/final reviews and explicit finalization; this approval does not mark the task Done.

Specification review cycle 2: APPROVED. The cycle-1 wording concern was corrected by explicitly distinguishing this task's synchronization scope from the pre-existing setInputValue private-field fallback owned by BACK-535.9/PR #772. Independent specification review passed 21/21.

Final review disposition: specification APPROVED and quality APPROVED. Concern circuits did not trigger: specification wording concern reached 1/3 and was resolved; quality socket selection concern was resolved on cycle 2. No further concern remains.

Final post-rebase validation on origin/main 26b7f9b: focused overlap 1/1; whole deep-link file 21/21 with 167 assertions; bunx tsc --noEmit passed; Biome checked 328 files; build passed; exact full isolate passed 1655 tests with 2 intentional interactive-TUI skips, 0 failures, and 6890 assertions across 192 files in 175.26s; git diff --check passed. Previously approved reliability evidence remains fixed 50x whole-file stress 1050/1050 and pre-rebase full-isolate 1653 pass, 2 skip, 0 fail with 6843 assertions across 192 files in 180.36s.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced all 45 fixed-attempt deep-link polling sites with cause-scoped deterministic synchronization: phased fetch-body settlement, manual race responses, synchronous socket delivery, one-shot history signals, and a controlled verified product timer. Assertions now run synchronously after triggering act completes, and teardown reports and drains labeled pending work. No production/mobile code, timeout, or polling behavior changed. Independent specification and quality reviews approved the final implementation; all acceptance criteria and Definition of Done items are satisfied. Verified after rebasing onto origin/main 26b7f9b with the 21/21 file suite, TypeScript, Biome, build, diff check, and the exact isolated suite at 1655 pass, 2 intentional skips, 0 failures.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
