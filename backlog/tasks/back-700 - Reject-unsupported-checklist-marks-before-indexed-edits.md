---
id: BACK-700
title: Reject unsupported checklist marks before indexed edits
status: Done
assignee:
  - '@codex-checklist-validation'
created_date: '2026-09-27 22:46'
updated_date: '2026-09-27 23:03'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1033'
priority: high
type: bug
ordinal: 330000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a task contains an unsupported checkbox mark such as [~] inside an acceptance-criteria or Definition of Done checklist, an indexed edit must report the malformed row and leave the file unchanged instead of checking the wrong item or renumbering the remaining rows. Keep the existing two-state checklist model and ordinary Markdown prose.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An indexed acceptance-criteria edit on the reported mixed-mark checklist exits nonzero, identifies the invalid checklist row, and leaves the complete source file unchanged.
- [x] #2 The same shared rule protects equivalent Definition of Done indexed edits and every caller using the shared mutation path.
- [x] #3 Valid checked/unchecked checklist edits continue to use existing indices and preserve surrounding prose and unrelated sections.
- [x] #4 No additional checkbox state, progress meaning, or automatic repair is introduced.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. After the source-writer handoff, reproduce issue #1033 with the real CLI in an isolated temporary project: an AC body containing - [~] alpha, - [ ] #2 bravo, and - [ ] #3 charlie, followed by --check-ac 2. Capture exit status, diagnostic, and complete source bytes before/after.
2. Add one narrow validator in src/markdown/structured-sections.ts using the existing AC/DoD section definitions and range/masking rules. Detect unsupported single-character marks only in the existing top-level checkbox row shape of the relevant structured checklist. Report the checklist family and offending row, retain [ ]/[x] as the only supported states, and leave ordinary prose, inline examples, fenced code, foreign sentinel blocks, and other sections outside this validation.
3. Reuse that validator at the existing indexed check/uncheck/remove mutation boundaries for both manager primitives and Core.applyTaskUpdateInput, before any field changes or persistence. Validate explicit AC replacement input there as well: current browser AC toggles send replacement arrays, and rewriting that parsed array has the same skipped-row/renumbering risk. Cover the existing legacy Core AC indexed helpers if they remain current internal mutation entry points.
4. Keep read parsing, additions, serializer behavior, and unrelated metadata edits unchanged. Do not add unconditional updateContent validation: serializeTask invokes it for empty parsed checklists even during unrelated edits, which would broaden the failure to all-invalid checklists on title/label changes. Do not redesign browser transport, accept new checkbox states, repair malformed content, or expand multiline Markdown semantics.
5. Add focused shared-manager and integration regressions for AC/DoD indexed check, uncheck, and removal, including an already-satisfied no-op request; current browser AC replacement and MCP/CLI paths; valid two-state controls; family-specific and surrounding-prose preservation. Prove rejected real CLI edits leave the complete source byte-for-byte unchanged, including CRLF input, and keep unsupported examples outside the target checklist from causing new failures.
6. Run focused regression and existing checklist/preservation tests, bunx tsc --noEmit, and bun run check .; review the final diff for simpler shared code and scope. Record objective evidence before finalization. Preserve all other agents' changes. This plan is recorded before source edits; production edits remain paused until the source-writer release.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research: parseAllChecklistItems currently skips unsupported marks and assigns new sequential indices to the remaining rows. CLI and MCP share Core.applyTaskUpdateInput; browser DoD also uses indexed fields, while browser AC toggles send acceptanceCriteria replacement arrays. Parent reviewed this boundary and chose one shared validator at explicit mutation entry points, avoiding unconditional serializer validation. No source files have been edited for BACK-700.

Implementation ready for review; source edits are frozen. Changed only src/core/backlog.ts, src/markdown/structured-sections.ts, and new src/test/malformed-checklist-marks.test.ts.

One assertValidChecklistMarks validator uses existing checklist section ranges, foreign sentinel masks, and fence/HTML helpers. Explicit Core AC/DoD indexed requests, Core AC replacement input used by browser toggles, indexed manager methods, and legacy Core indexed AC helpers reuse it. Reads, parser semantics, additions, serializer, and generic updateContent are unchanged.

Real CLI reproduction before the fix (temporary project back700-repro-before-yPrLHf): task edit TASK-1 --check-ac 2 exited 0, renumbered bravo to #1, and checked charlie as #2. After the fix (back700-repro-after-MJqzxP), the same command exited 1 with: Invalid Acceptance Criteria checkbox mark in row "- [~] alpha". Use [ ] or [x]. Complete source bytes were identical.

Validation on /tmp/back694-ci-runtime/bun 1.3.14: focused run of malformed-checklist-marks, acceptance-criteria-manager, acceptance-criteria, acceptance-criteria-structured, definition-of-done, definition-of-done-cli, task-edit-preservation, and cli-draft-edit passed: 132 pass, 1 existing interactive test skip, 0 fail, 778 assertions. The new test file covers AC/DoD check/uncheck/remove, no-op edits, LF/CRLF byte preservation, combined-edit rejection, MCP, current browser replacement/indexed payloads, valid controls, foreign/prose/fenced content, and unaffected metadata edits.

Subtraction pass: retained one validator and the existing parsers; removed temporary array/callback allocation from the Core operation predicates in favor of direct optional-length checks. No adapter or serializer layer added. After that simplification, the new regression file passed again (21 tests), TypeScript passed via bun x --bun tsc --noEmit, repository Biome passed via bun run check ., and git diff --check passed. Reviewed against HEAD 4efbfa45; no commit, staging, push, or changes to other agents' files performed.

Finalization: all four acceptance criteria and all three Definition of Done items have objective evidence recorded above. Architecture review returned keep unchanged for all six questions, with no blockers or further simplifications. The implemented boundaries match the recorded plan; no documentation or configuration change is required. The task is approved for scoped publication to main.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Indexed AC and Definition of Done edits now reject unsupported single-character checkbox marks before changing the task. The same shared validator protects browser AC replacement payloads. The error names the invalid row; the original task bytes remain unchanged. Existing two-state behavior, ordinary reads, surrounding prose, foreign sections, fenced examples, and unrelated metadata edits are preserved.

Verified with the real issue #1033 CLI reproduction: before, --check-ac 2 checked charlie and renumbered rows; after, it exited 1 identifying - [~] alpha and preserved the complete file byte-for-byte. The focused suite passed 132 tests with one existing interactive skip; the final regression rerun passed all 21 tests. TypeScript, repository Biome, and diff checks passed on Bun 1.3.14. Architecture review approved the unchanged implementation. No new checkbox states, automatic repair, or multiline checklist behavior was introduced.
<!-- SECTION:FINAL_SUMMARY:END -->
