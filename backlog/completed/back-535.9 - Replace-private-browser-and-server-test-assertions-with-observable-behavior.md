---
id: BACK-535.9
title: Replace private browser and server test assertions with observable behavior
status: Done
assignee:
  - '@back5359-publish-finalize'
created_date: '2026-07-11 17:10'
updated_date: '2026-07-11 23:16'
labels: []
dependencies: []
modified_files:
  - bunfig.toml
  - src/test/react-dom-preload.ts
  - src/test/react-dom-preload.test.ts
  - src/test/web-task-types.test.tsx
  - src/test/web-task-detail-deeplink.test.tsx
  - src/test/web-task-details-modal-final-summary.test.tsx
  - src/test/server-duplicate-repair.test.ts
parent_task_id: BACK-535
priority: low
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace browser tests that invoke React private mounted props and a server test that asserts private service object identity with tests of user-visible DOM interactions and public HTTP behavior. Keep the existing browser form/navigation and duplicate-repair concurrency contracts without production changes or changes to desktop-first/best-effort-mobile product behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Browser tests drive form and navigation state through public DOM events without reading React private props
- [x] #2 Duplicate-repair concurrency coverage verifies config, search, task, and repair behavior through HTTP without private server getters or object identity assertions
- [x] #3 Each removed implementation-detail assertion has an explicit observable replacement and retained coverage mapping
- [x] #4 Only test code/configuration changes, and focused stress plus full test, type, lint, and build checks pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Snapshot exact window, document, and navigator descriptors before installing the temporary JSDOM test environment.
2. Restore exact descriptors in a nested finally, delete only originally absent globals, and close JSDOM even when the React DOM loader rejects.
3. Add deterministic regression coverage for Bun navigator restoration and loader-rejection cleanup.
4. Re-run focused stress, the full suite, static/build gates, and final diff review; update the task evidence and return it to Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Inventory and retained contracts:
- web-task-types.test.tsx: removed __reactProps$ onChange invocation; retained create submission, validation-error selection, update/rollback, and in-flight locking assertions through DOM events.
- web-task-detail-deeplink.test.tsx: removed __reactProps$ invocation; retained sidebar search result, route query, open, and close behavior through DOM events.
- web-task-details-modal-final-summary.test.tsx: removed __reactProps$ invocation and private prop types; retained comment submission plus dirty existing/create field preservation across refreshed props through DOM events.
- server-duplicate-repair.test.ts: removed private content/search service getters and object identity assertions; retained overlap coverage and added public GET /api/task and GET /api/search assertions after repair/config publication, plus empty duplicate groups.

Harness decision: plain DOM events initially failed the five dependent interactions (39 pass, 5 fail), proving React DOM had initialized before JSDOM. bunfig now preloads a temporary JSDOM, imports React DOM, closes the window, and removes globals before tests execute. No legacy propertychange bridge or React-owned fields remain.

Validation: final focused browser/server plus non-React control 60/60 pass; earlier 10-run focused stress passed 440/440; bun test 1653 pass, 2 intentional skips, 0 fail; bunx tsc --noEmit pass; bun run check . pass (324 files); bun run build pass; git diff --check pass.

Fix cycle 2 harness correction:
- Fail-first evidence: Bun owns a configurable navigator descriptor (`writable: true`, `enumerable: true`, `configurable: true`); the initial preload replaced it and deleted it during cleanup.
- The preload now snapshots exact own descriptors for window, document, and navigator; a nested finally always closes JSDOM and restores exact descriptors, deleting only globals that were originally absent.
- Deterministic regression coverage injects a sentinel non-writable/non-enumerable navigator descriptor and verifies exact descriptor/value restoration. A rejecting loader regression verifies error propagation, restoration of all three globals, and that the captured temporary JSDOM window is closed.
- Naming note: initializeReactDomForTests is a no-analog test-harness seam introduced solely to inject loader success/failure into the same preload path.

Cycle 2 validation: focused browser/server/preload plus non-React control 62/62 pass; 10-run focused stress 460/460 pass; full suite 1655 pass, 2 intentional skips, 0 fail; bunx tsc --noEmit pass; bun run check . pass (325 files); bun run build pass; git diff --check pass; a fresh Bun process retains its original navigator descriptor.

Controller review/fix evidence: removing the three __reactProps$ fallbacks with plain DOM events failed first at 39/44; the first cross-file full run failed 5 tests because react-dom/client had cached pre-DOM feature detection. An IE-style propertychange/attachEvent shim was rejected in harness-quality cycle 1. Spec cycle 1 then found Bun navigator was not restored and import failure cleanup was unsafe; fix cycle 2 added exact descriptor snapshot/restore in nested finally plus success/rejection regressions. Spec cycle 2 APPROVED and quality review APPROVED with no remaining findings. Harness concern closed at 2/3 without tripping the circuit breaker; unrelated matrix reds are 0/2. Final evidence: focused 62/62, cycle-2 stress 460/460, changed-test quality stress 138/138, full 1,655 pass plus 2 intentional skips and 0 failures, TypeScript, Biome over 325 files, build, diff check, and fresh-Bun navigator restoration all pass.

Local rebase/integration evidence (2026-07-11): rebased PR #772 head 54404b2 onto origin/main d00ffe07 containing merged BACK-535.13/#775 with zero conflicts. Pre-review range-diff reported the approved BACK-535.9 patch unchanged; BACK-535.13 remains the direct parent. Focused affected run passed 46/46; 20-run high-stress passed 920/920; full bun test --isolate --timeout=10000 --max-concurrency=4 passed 1,655 with 2 intentional interactive-TUI skips and 0 failures across 193 files; bunx tsc --noEmit, Biome over 330 files, build, and diff checks passed. Task remains In Progress with no final summary pending independent specification and quality delta reviews; no push or remote action performed.

Final publish delta reviews (cycle 1): specification APPROVED; independent specification affected run 46/46 passed. Quality APPROVED with no findings; quality evidence 920/920 stress plus 23/23 targeted checks and fresh-process navigator restoration passed. Final validation evidence: focused 966/966; full 1,655 pass plus 2 intentional skips and 0 failures, 6,796 assertions across 193 files in 196.89s; bunx tsc --noEmit passed; Biome passed over 330 files; bun run build passed; git diff --check passed. Final-head unrelated-red circuit: 0/2; circuit breaker not tripped.

Final local rebase after BACK-535.14 (2026-07-12): fetched origin/main 5029860 and PR #772 old head 1c78006; rebased the single BACK-535.9 commit with one conflict in web-task-detail-deeplink.test.tsx setInputValue. Resolution preserves BACK-535.14's FetchOperation/runOperation expectations and all cause-scoped fetch/body, socket, timer, history, teardown, and race tracking while applying BACK-535.9's native bubbling input event and removing the __reactProps fallback. Range-diff maps the patch 1:1; the only expected context delta is that BACK-535.14's outer runOperation supplies the microtask flush previously inside setInputValue. No BACK-535.9 or BACK-535.14 hunk was lost; no product, production, or mobile file changed. Validation: affected 46/46; mixed affected 20x stress 920/920 with 6,020 assertions; exact whole deep-link 50x stress 1,050/1,050 with 8,350 assertions. Exact full isolate passed 1,656 with 2 intentional skips and had one unrelated server-assets image test failure; the out-of-scope four-test file then passed twice, 4/4 each run. bunx tsc --noEmit passed; Biome passed over 330 files; build and diff checks passed. Task remains In Progress with no final summary pending independent specification and quality delta reviews; no push or remote mutation performed.

Evidence clarification: the exact full-isolate command did not pass overall; its terminal result was 1,656 pass, 2 intentional skips, and 1 out-of-scope server-assets failure. The failing four-test file passed 4/4 on each of two immediate isolated reruns.

Final publish evidence (2026-07-12): candidate a60c61168e2a013f055f454bd5962f1604e6c9cc is the single BACK-535.9 commit rebased onto exact origin/main 5029860610434fd38d333d33e72bd57d1e359df2; the approved patch remains confined to the task record and seven test/config files, with no product or mobile files. Terminal independent full run executed exactly once on this candidate: 1,657 pass, 2 intentional skips, 0 fail, 6,900 assertions across 193 files in 217.51s; all four server-assets tests pass. Final specification delta APPROVED with no findings; final quality delta APPROVED with no findings. Final-head unrelated remote-red circuit state: 0; circuit breaker not tripped. Earlier focused, stress, TypeScript, Biome, build, and diff/status validation remained green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced private React mounted-prop and server service-identity assertions with observable DOM-event and public HTTP contracts. Added a deterministic React DOM preload harness with exact global descriptor restoration and rejection cleanup coverage. Verified by the terminal independent full run (1,657 pass, 2 intentional skips, 0 fail, 6,900 assertions, 193 files), all four server-assets tests, and approved specification and quality delta reviews; no product or mobile code changed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
