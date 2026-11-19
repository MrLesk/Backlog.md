---
id: BACK-809
title: Make long documents scroll in the terminal viewer
status: Done
assignee:
  - '@codex'
created_date: '2026-11-18T23:11:00Z'
updated_date: '2026-11-18T23:21:00Z'
labels:
  - tui
  - cli
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1198
  - src/ui/tui.ts
  - src/test/cli-doc-view.test.ts
modified_files:
  - src/test/cli-doc-view.test.ts
  - src/ui/tui.ts
  - src/test/test-utils.ts
type: bug
ordinal: 409000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The interactive document viewer stops at the first screen of a long document. People using the CLI cannot read the remaining lines from the viewer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Readers can reach later lines and return to the start of a long document using the viewer’s line, page, Home and End keys.
- [x] #2 The mouse wheel scrolls the document on a mouse-enabled terminal, and the existing quit keys still close the viewer.
- [x] #3 Plain and noninteractive document output continue to include the entire document.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the failure in the real CLI viewer and extend the existing document-view coverage.
2. Use the terminal library’s existing scrollable text widget for the document body and retain its existing navigation and quit controls.
3. Verify keys and mouse in a real terminal, complete the relevant CLI and interactive checks, then review Codex’s findings on the PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The document test failed with the plain box. Using scrollable text fixed End, but a real mouse-wheel event still did nothing until the screen registered its quit keys before the widget. Separate terminal tests now cover both cases. In an 80-column, 20-row terminal, the compiled CLI reached line 80 and returned to the start using keys and the wheel. q and Escape closed the viewer. Plain and piped output included all 80 lines. All 54 focused tests and 11 interactive tests passed on macOS, together with TypeScript and Biome.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Long documents now scroll with arrow keys, j/k, page keys, Home, End, and the mouse wheel. The viewer uses bblessed’s existing scrollable text widget. Registering the quit keys first enables the wheel in bblessed 1.0.10. The terminal regressions cover End and wheel input.
<!-- SECTION:FINAL_SUMMARY:END -->
