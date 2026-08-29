---
id: BACK-648
title: Fall back to a placeholder filename for punctuation-only titles
status: Done
assignee:
  - '@claude'
created_date: '2026-08-29 21:04'
updated_date: '2026-08-29 21:19'
labels:
  - cli
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/897'
ordinal: 281000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
backlog task create '!!!' produces a file named 'task-42 - .md' because sanitizeFilename strips all punctuation. The empty segment is cosmetic (it round-trips through every parser), but contributor PR #897's id-only-filename fix breaks three subsystems that require the ' - ' segment (task watcher, doc save dedup, duplicate repair). Take over PR #897 rewritten to the invariant-preserving fix: sanitizeFilename falls back to a placeholder (e.g. untitled) when the sanitized result is empty, fixing all call sites in one place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A punctuation-only title produces a filename with a non-empty title segment (e.g. 'task-42 - untitled.md')
- [x] #2 Filenames keep the 'id - title.md' shape; no id-only filenames are introduced
- [x] #3 Tests cover punctuation-only titles for tasks, docs, and decisions
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Revert the contributor's three call-site branches in src/file-system/operations.ts (resolveTaskWriteTarget, saveDecision, saveDocument) that drop the ' - ' separator and emit an id-only filename.
2. Add the placeholder inside sanitizeFilename itself: when the sanitized result is empty, return 'untitled' so every generated filename keeps the '<id> - <title>.md' shape from one owner.
3. Add tests for punctuation-only titles covering tasks, drafts, documents, and decisions, asserting the filename shape and that the id-parsing readers still work.
4. Verify with bunx tsc --noEmit, bun run check ., and the scoped test files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Took over contributor PR #897 (pxmpsdev) in place and replaced its approach.

The contributor fixed the dangling separator by dropping it: when the sanitized title was empty, each of the three call sites emitted an id-only filename ('back-42.md' instead of 'back-42 - .md'). That special-cased the same condition in three places and broke the '<id> - <title>.md' shape that three readers depend on:
- src/core/content-store.ts createTaskWatcher recovers the task id with file.split(' ')[0], which yields 'back-42.md' for an id-only filename;
- src/file-system/operations.ts saveDocument dedup matches an existing document by base.split(' - ')[0], which never matches an id-only filename, so a resave leaves a duplicate behind;
- src/core/duplicate-task-repair.ts buildTargetPath returns null when the filename has no ' - ' separator, so an id-only task file can never be repaired.

Reverted all three call sites to their original single-expression form and put the fallback in sanitizeFilename instead: a title that sanitizes to nothing now yields 'untitled'. Every generated filename keeps the '<id> - <title>.md' shape and the fix has one owner. The title itself is untouched in frontmatter; only the filename uses the placeholder. Net source diff is one function.

Confirmed the new tests are not vacuous: stashing the fix and running them against the contributor's version fails 5/5, observing 'decision-punct.md' and 'doc-punct.md' instead of the placeholder form.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made sanitizeFilename fall back to 'untitled' when a title sanitizes to an empty string, so a punctuation-only title such as '!!!' yields 'task-1 - untitled.md' instead of 'task-1 - .md'. The fallback lives in the one function that owns filename sanitization, so tasks, drafts, documents, and decisions are all fixed without any call site special-casing the empty-title condition.

This replaces contributor PR #897's approach, which dropped the ' - ' separator and emitted id-only filenames. That would have broken three readers that require the '<id> - <title>.md' shape: the content-store task watcher (file.split(' ')[0]), document save dedup (base.split(' - ')[0]), and duplicate-task repair's buildTargetPath, which returns null without the separator. Net source change is one function; the contributor's call-site edits were reverted.

Verified: 5 new tests in src/test/filesystem.test.ts cover punctuation-only titles for tasks, drafts, documents, and decisions, assert the id stays recoverable by both the space-split and ' - '-split readers, and assert a document resave still dedupes to a single file. Reverting the fix fails all 5 (observing 'decision-punct.md' and 'doc-punct.md'), so they are not vacuous. End-to-end CLI check in a scratch project produced 'task-1 - untitled.md', 'doc-1 - untitled.md', and 'decision-1 - untitled.md' with the '!!!' title preserved in frontmatter and rendered by task list. bunx tsc --noEmit clean, bun run check . clean (389 files), full bun run test 2467 pass / 0 fail / 7 skip across 248 files.
<!-- SECTION:FINAL_SUMMARY:END -->
