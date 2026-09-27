---
id: BACK-633
title: Show and edit modified files in the web task modal
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-15 13:12'
updated_date: '2026-08-15 13:26'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/913'
type: feature
ordinal: 269000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `modifiedFiles` field shipped in BACK-412 (#607) and is wired through the markdown parser/serializer, `backlog task edit --modified-files`, plain and JSON output, the TUI task viewer, the MCP tools, and web search. The web task details modal is the one surface that never adopted it: a task found in the browser by a `modifiedfiles:` search query opened with no trace of the files that matched it, and there was no way to add or remove a path from the browser.

Closing this parity gap means the browser shows the same task model the CLI and TUI already show, and edits go through the existing `PUT /api/tasks/:id` path that already accepts `modifiedFiles`.

The section must stay usable for real-world task sizes. A completed task can list well over a hundred paths, and paths can be long enough to overflow their row, so an unbounded list would push the rest of the modal (documentation, acceptance criteria, plan, notes, comments) out of reach and risk horizontal overflow.

Contributed by @ivan812205 in PR #913.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The web task details modal shows a Modified files section listing the task's modified file paths
- [x] #2 A path can be added and removed from the modal, and the change persists through the existing task update API
- [x] #3 The section stays usable with 100+ paths: its list is height-bounded and scrolls internally instead of pushing later modal sections out of reach
- [x] #4 Long paths wrap within their row so neither the modal nor the page scrolls horizontally
- [x] #5 Read-only cross-branch tasks show the paths without add or remove controls
- [x] #6 A web test covers rendering a task with many long modified file paths
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep @ivan812205's Modified files section (state wiring, refresh preservation, inline add/remove) as the base; it already matches the References pattern and the server already accepts modifiedFiles on PUT /api/tasks/:id.
2. Bound the list so 100+ paths cannot push the rest of the modal out of reach: apply the repo's existing max-h-64 overflow-y-auto pattern (CleanupModal, DuplicateIdRepairModal) to the paths list, with overscroll-contain so the inner scroll does not chain to the modal.
3. Show the path count in the section heading, following the existing Comments (n) SectionHeader precedent, so a long list announces its size without helper text.
4. Keep break-all wrapping from the References section so long paths wrap in place and never cause horizontal overflow; align the remove control to the first line so multi-line paths keep a predictable hit target.
5. Add hasCreateModeEntries parity for modifiedFiles alongside references.
6. Add src/test/web-task-details-modal-modified-files.test.tsx following web-task-details-modal-documentation.test.tsx: render a task with many long paths and assert every path renders inside a bounded scrolling list, plus cross-branch read-only behavior.
7. Verify visually against a throwaway project seeded with 120+ long paths; run tsc, biome, full test suite, and build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Took over @ivan812205's PR #913 and kept their commit as the base. Their diff was already correct on the parts that are easy to get wrong: the state hook, the form-state snapshot, the dirty-preserving refresh, the task-switch reset, the external-update sync, and routing both mutations through handleInlineMetaUpdate. No server change was needed - PUT /api/tasks/:id already applies modifiedFiles (src/server/index.ts) and core normalizes it (src/core/backlog.ts resolveModifiedFiles). handleSave deliberately does not send modifiedFiles, exactly like references, so a Save in edit mode cannot clobber inline edits.

Hardening added on top, for the many-files case:
- The paths list is capped at max-h-64 with overflow-y-auto and overscroll-contain, following the CleanupModal/DuplicateIdRepairModal bounded-list pattern. Measured against a seeded task with 130 long paths: the list content is 10392px but renders in a 256px box, so the section is 372px instead of 10508px and the modal is 1339px instead of 11475px (8.6x). Every path stays in the DOM and the last one is reachable by scrolling; overscroll-contain keeps the inner wheel from scrolling the modal behind it. The cap is inert for ordinary tasks: a 3-path task measures an 88px list with no scrollbar.
- The heading carries the count ("Modified files (130)"), matching the existing Comments (n) SectionHeader precedent, so a collapsed list still announces its size without helper text.
- Rows switched from items-center to items-start with mt-0.5 on the remove button, so on a path that wraps to 3 lines the control sits within 3px of the first line instead of floating in the middle of a 72px row.
- hasCreateModeEntries now counts modifiedFiles alongside references.

Long paths keep the References break-all wrapping rather than truncating, so nothing is hidden. Verified no horizontal overflow at 1280px and at 375px (mobile: paths wrap to 6 lines, section still 372px, documentElement.scrollWidth == clientWidth on both).

Edit path verified end to end in a throwaway project, not just in tests: adding a path from the modal wrote it into the task markdown and CLI task view --json reported 131; removing it from the modal brought both back to 130.

Known pre-existing behavior, not introduced here: pressing Enter in the add input did not submit under CDP-synthesized keys. The References add form behaves identically, so this is shipped parity rather than a regression; the Add button works in both.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the Modified files section to the web task details modal, closing the last surface gap for the modifiedFiles field shipped in BACK-412: the browser now shows the paths a task touched and lets them be added or removed inline, through the PUT /api/tasks/:id path that already accepted the field. Built on @ivan812205's PR #913, whose state wiring and refresh-preservation already matched the sibling References section.

Hardened for real task sizes: the paths list is height-bounded and scrolls internally, the heading carries the count, and rows align their remove control to the first line of a wrapped path. Measured on a seeded 130-path task with long paths: the section renders at 372px instead of 10508px and the modal at 1339px instead of 11475px, with all 130 paths still present and reachable, no horizontal overflow at 1280px or 375px, and no visible change for ordinary short lists (88px, no scrollbar).

Verified with a new SSR test (src/test/web-task-details-modal-modified-files.test.tsx, 5 cases including a 120-path long-path case and cross-branch read-only, confirmed to fail when the height cap is removed) and a live browser round-trip in a throwaway project where a path added from the modal appeared in the task markdown and in CLI task view --json, then disappeared from both when removed. Gates: bunx tsc --noEmit clean, bun run check . clean, bun run test 2250 pass / 6 skip / 0 fail, bun run build succeeds.
<!-- SECTION:FINAL_SUMMARY:END -->
