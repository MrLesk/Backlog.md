---
id: BACK-702
title: Reject malformed Definition of Done indices in task updates
status: Done
assignee:
  - '@codex-http-dod-validation'
created_date: '2026-09-27 22:54'
updated_date: '2026-09-27 22:58'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1011'
type: bug
ordinal: 332000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an HTTP task update supplies malformed values for the recognized definitionOfDoneCheck, definitionOfDoneUncheck, or definitionOfDoneRemove fields, return a useful client error before any task change rather than filtering those values out and reporting success. Preserve valid numeric index operations and limit this fix to the confirmed typed-input defect in issue #1011.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each recognized Definition of Done index field rejects wrong-typed entries with HTTP 400 and a useful field-specific error.
- [x] #2 An invalid request leaves the complete task file unchanged, including when the same payload also requests another valid edit.
- [x] #3 Valid index operations keep their existing behavior and use the shared task mutation semantics.
- [x] #4 The fix adds no ordinal endpoint behavior, blanket unknown-field policy, or new public HTTP contract.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep this as the narrow typed-input fix from issue #1011. In src/server/index.ts, handleUpdateTask owns conversion from HTTP JSON to TaskUpdateInput. Its three Definition of Done filters currently discard malformed entries and can report success. Core in src/core/backlog.ts already owns numeric index lookup, operation order, and task writes; do not add or duplicate those domain rules.
2. Before changing source, reproduce the failure through an actual BacklogServer listening on an ephemeral localhost port with an isolated temporary project. Send string indices to definitionOfDoneCheck, definitionOfDoneUncheck, and definitionOfDoneRemove; capture the false-success HTTP 200 behavior. Include a payload containing a valid edit plus malformed input and record the resulting partial update. Use numeric requests as controls.
3. In src/server/index.ts, replace the three lossy filters with one local tuple loop in handleUpdateTask, before any field processing that can resolve a milestone or reach Core. For every present recognized Definition of Done index field, require an array whose entries are finite numbers. Reject the whole request with HTTP 400 and a message that names the exact field and expected array shape. Map validated arrays unchanged to the existing TaskUpdateInput properties. Omitted fields remain omitted and empty arrays remain valid. Do not coerce strings, add exported helpers, or introduce a validation framework.
4. Keep HTTP shape checks distinct from domain semantics: no new integer, positivity, range, duplicate, or mixed-missing-index rules. Existing finite numeric input continues through updateTaskFromInput or editTaskOrDraft. Preserve unknown-field handling, existing ordinal API behavior, and all unrelated request fields. The task addresses only the verified malformed Definition of Done input defect; it does not close the broader issue #1011.
5. Add src/test/server-definition-of-done-endpoint.test.ts using the real HTTP harness pattern from src/test/server-demote-endpoint.test.ts (server.start(0, false), getPort, fetch, shutdown, isolated temporary project). Cover all three recognized fields with strings and mixed numeric/string entries, plus wrong array shapes and non-number entries. For invalid payloads, compare complete task file bytes before and after, including when title or another valid Definition of Done operation is in the same payload. Cover valid check/uncheck/remove requests, index renumbering after removal, empty arrays, and useful existing Core errors for a missing numeric index. Keep tests focused on behavior.
6. Re-run the real HTTP reproduction and capture the change from false-success 200 to useful 400 with no bytes changed. Run the new HTTP suite plus src/test/definition-of-done.test.ts, src/test/server-due-date-endpoint.test.ts, src/test/server-task-project-endpoint.test.ts, and src/test/server-drafts-endpoint.test.ts; then bunx tsc --noEmit and bun run check . Review the final diff for simpler code, correct ownership, and scope. Read task-finalization before any acceptance checks or final status. Do not change source until the parent releases this plan for implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Planning research complete. Existing owner: src/server/index.ts handleUpdateTask is the adapter that currently filters all three index arrays (lines 1178-1194 at research time). Adjacent parseDueDatePayload and document payload checks establish local HTTP shape-validation patterns. src/core/backlog.ts owns Definition of Done lookup/toggle/removal semantics and writes after mutation succeeds; no Core edit is planned. Existing coverage: src/test/definition-of-done.test.ts verifies shared valid DoD operations; src/test/server-demote-endpoint.test.ts provides the real HTTP server pattern. Planned source/test paths: src/server/index.ts and new src/test/server-definition-of-done-endpoint.test.ts only. Behavior decisions for review: present non-array fields are malformed; empty arrays remain accepted; finite numbers reach Core unchanged, including its existing treatment of missing numeric indices. Working tree already contains other task work in Core/core.test.ts; those files remain untouched. PLAN ONLY; waiting for implementation release.

Implementation released by the parent after plan review and completed within the two planned source/test paths. Replaced three lossy filters with one inline field-to-input loop at the start of handleUpdateTask. Present malformed arrays or entries now return HTTP 400 naming the field; valid finite numeric arrays pass unchanged to the existing Core mutation. No helper export, Core edit, integer/range/duplicate policy, ordinal behavior, or unknown-field policy was added.
Verification with Bun 1.3.14 (/tmp/back694-ci-runtime/bun): real HTTP reproduction in /tmp/back702-http-repro.ts used an ephemeral server and separate temporary project. /tmp/back702-http-before.json records all three string-only inputs returning 200 and all three mixed valid/invalid payloads partially writing title plus valid numeric changes. /tmp/back702-http-after.json records all six malformed cases returning field-specific 400 with complete task bytes unchanged, while each numeric control still returns 200 and performs check/uncheck/remove correctly.
Regression tests were run before the source fix: 5 pass and 7 fail, showing the expected false-success failures. After the fix, 35 tests pass, 0 fail, across src/test/server-definition-of-done-endpoint.test.ts, src/test/definition-of-done.test.ts, src/test/server-due-date-endpoint.test.ts, src/test/server-task-project-endpoint.test.ts, and src/test/server-drafts-endpoint.test.ts. Evidence: /tmp/back702-test-before.log and /tmp/back702-focused.log. The new real HTTP tests cover all three fields, strings, numeric/string mixtures, scalar/wrong shapes, other non-number entries, overflowing JSON numbers, full-file byte preservation, valid title/DoD-add edits mixed with malformed indices, numeric operations and renumbering, empty arrays, unknown fields, and existing Core missing-index errors.
Type check passed via bun x tsc --noEmit (/tmp/back702-tsc.log); full Biome passed via bun run check . with 436 files checked (/tmp/back702-biome.log). Simplicity review retained a single local loop and removed the repeated filters; no additional abstraction was needed. Source and test are frozen for independent architecture review. Acceptance criteria and DoD remain unchecked, and status remains In Progress pending parent finalization.

Final review approved the existing HTTP-boundary ownership and retained the implementation unchanged; no additional layer or simplification was needed. AC #1 is proven by the real HTTP tests for all three recognized fields and their field-specific 400 responses. AC #2 is proven by complete file-byte comparisons for malformed-only and mixed title/Definition of Done payloads. AC #3 is proven by valid check/uncheck/remove controls, post-removal renumbering, and preserved shared missing-index errors. AC #4 is proven by the scoped server diff and unknown-field regression. The 35-test run across five files, TypeScript pass, and full Biome pass recorded above cover all DoD items. Source hashes still match the reviewed freeze. Finalized without source changes or broader issue closure.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
HTTP task updates now reject malformed definitionOfDoneCheck, definitionOfDoneUncheck, and definitionOfDoneRemove input with a field-specific 400 response before saving any task change. One local validation loop replaces the lossy filters; valid numeric arrays still use the existing shared mutation behavior. Bun 1.3.14 verification passed: 35 tests across five focused suites, TypeScript, and full Biome. Real HTTP before/after checks show all three string-only and mixed valid/invalid payloads changed from false-success 200 to 400 with complete task files unchanged; numeric controls remain successful. Architecture review approved the implementation unchanged. This resolves the confirmed typed-input defect only; the wider requests in issue #1011 remain outside this fix.
<!-- SECTION:FINAL_SUMMARY:END -->
