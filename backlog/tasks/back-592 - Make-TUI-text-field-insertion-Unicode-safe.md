---
id: BACK-592
title: Make TUI text field insertion Unicode-safe
status: To Do
assignee: []
created_date: '2026-08-07 20:48'
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
- [ ] #1 Typing adjacent to an astral character in the Title field never splits its surrogate pair; the saved task file contains the original character with no replacement characters
- [ ] #2 The same holds for the Description field, including when the astral character sits mid-field rather than at an edge
- [ ] #3 The caret lands where the user aimed after such an insertion, never inside a surrogate pair
- [ ] #4 A regression test exercises insertion next to an astral character placed mid-field and asserts on the persisted file content
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
