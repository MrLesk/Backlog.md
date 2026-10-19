---
id: BACK-592
title: Make TUI text field insertion Unicode-safe
status: Done
assignee:
  - '@codex'
created_date: '2026-08-07 20:48'
updated_date: '2026-08-10 05:37'
labels:
  - tui
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/833'
priority: low
type: bug
ordinal: 232000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from Codex review of PR #833 (BACK-565, TUI task composer and board). This is pre-existing behavior in the vendored widget fork, not a regression introduced by that PR.

The vendored widget insertion path computes the caret offset by display width but slices the JavaScript string by UTF-16 index. Those two disagree as soon as an astral character is present, so typing before one splits its surrogate pair: with `A😀B` in a field, pressing Left and typing `X` lands the insert inside the emoji, and the broken halves are written out as replacement characters that persist in the saved task file.

The composer deletion path added in PR #833 already handles this correctly via `deletionStart`/`deletionEnd` in src/ui/components/task-composer.ts. The natural fix shape is to own insertion the same way, or to map the cursor to a code-point/grapheme boundary before forwarding to the widget.

Users hit this with any emoji, CJK-adjacent astral character, or flag sequence in a title or description, and the corruption is silent and persisted.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Typing adjacent to an astral character in the Title field never splits its surrogate pair; the saved task file contains the original character with no replacement characters
- [x] #2 The same holds for the Description field, including when the astral character sits mid-field rather than at an edge
- [x] #3 The caret lands where the user aimed after such an insertion, never inside a surrogate pair
- [x] #4 A regression test exercises insertion next to an astral character placed mid-field and asserts on the persisted file content
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Make the composer's caret conversion map terminal display columns onto safe UTF-16 code-point boundaries, ignoring the widget's internal wide-character placeholders.
2. Own printable insertion for both Title and Description and reuse one mutation/caret-repositioning path with the existing deletion behavior.
3. Add deterministic model and end-to-end composer regressions for mid-field wide astral insertion, including canonical persisted task bytes, then run focused and repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one display-width-aware caret conversion for the composer, stripping Blessed's internal wide-character placeholder and snapping ambiguous display cells to a complete code-point boundary. Title and Description now own printable insertion and reuse the same mutation/caret-restoration path as deletion. Added model coverage plus a real composer-to-canonical-file regression for a mid-field double-width astral character in both fields.

Validation so far: the 61 relevant composer tests pass with the unrelated pre-existing watcher test excluded; `bunx tsc --noEmit`, `bun run check .`, `bun run build`, and `git diff --check` pass. The excluded watcher test also fails unchanged on clean main.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made TUI Title and Description insertion Unicode-safe by translating display-cell cursor positions to complete UTF-16 code-point boundaries and owning insertion through the composer's shared mutation path. Verified a mid-field double-width astral character through the real composer into canonical task bytes and reload, including exact caret placement; 61 relevant composer tests, TypeScript, Biome, build, and diff checks pass.
<!-- SECTION:FINAL_SUMMARY:END -->
