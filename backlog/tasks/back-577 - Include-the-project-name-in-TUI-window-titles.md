---
id: BACK-577
title: Include the project name in TUI window titles
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 20:34'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/853'
priority: low
type: bug
ordinal: 218000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #853. TUI window titles do not identify which project is open, so users running several boards in parallel terminals cannot tell the windows apart. The board hardcodes "Backlog Board" (src/ui/board.ts:304) and the task viewer defaults to "Backlog Tasks" (src/ui/task-viewer-with-search.ts:321 and src/ui/task-viewer-with-search.ts:1014), while the overview TUI already renders `${projectName} - Overview` (src/ui/overview-tui.ts:39). The fix is to extend the existing overview pattern to the other two surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The board TUI title includes the project name, following the overview TUI pattern
- [x] #2 The task viewer TUI title includes the project name, following the same pattern
- [x] #3 Titles fall back to a sensible default when the project name is empty
- [x] #4 The readyPattern "Backlog Board" in src/test/tui-interactive-editor-handoff.test.ts:409 is updated to match
- [x] #5 Restoring the previous terminal title on exit is either included as a small addition or explicitly recorded as out of scope
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a shared formatTuiTitle(view, projectName) helper in src/ui/tui.ts: returns `${projectName} - ${view}` when the configured name is usable, otherwise `Backlog ${view}` (blank/whitespace and the placeholder 'Untitled Project' both count as unusable).
2. Board (src/ui/board.ts): add an optional projectName to renderBoardTui options (same shape as dateFormat) and title the screen with formatTuiTitle('Board', projectName). Pass config?.projectName from the board callers (unified-view, simple-unified-view, enhanced-views) that already load config.
3. Task viewer (src/ui/task-viewer-with-search.ts): capture projectName from the config it already loads and apply formatTuiTitle to all three screen.title assignments (initial, no-results, selected task) so the project stays visible while a task is open.
4. Overview (src/ui/overview-tui.ts): route its screen title through the same helper so the three surfaces share one rule.
5. Tests: update the 'Backlog Board' readyPattern in src/test/tui-interactive-editor-handoff.test.ts and add unit coverage for formatTuiTitle (named project, blank, whitespace, Untitled Project).
6. Verify titles end-to-end via the interactive expect PTY suite (RUN_INTERACTIVE_TUI_TESTS=1) plus bunx tsc --noEmit, bun run check ., and a full bun test.
7. Terminal-title restore on exit: assess blessed's capability; include only if trivially small, otherwise record it as out of scope in the notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a shared `formatTuiTitle(view, projectName)` helper in src/ui/tui.ts and routed every TUI screen title through it: board ("<project> - Board"), task viewer ("<project> - Tasks", the caller-supplied title such as "Search: foo"/"Drafts", and the selected-task title "<project> - Task BACK-1 - ..."), and overview ("<project> - Overview", unchanged behavior for a named project).

Fallback rule: a blank/whitespace name and the `Untitled Project` placeholder (the config-migration default, also used by the web server) both fall back to "Backlog <view>", which preserves the previous "Backlog Board"/"Backlog Tasks" strings instead of showing a blank or meaningless project name.

The board is a pure render function, so it takes the name through a new optional `projectName` option alongside the existing `dateFormat` option; all three callers (unified-view, simple-unified-view, enhanced-views) already load config and pass `config?.projectName`. The task viewer already loads config itself, so it reads `config?.projectName` directly and needs no new option.

The selected-task title is included deliberately: it overwrites the initial title as soon as a task is open, so titling only the initial screen would have left the tab unidentified in normal use.

Out of scope (AC #5): restoring the previous terminal title on exit, including Ctrl-C. neo-neo-bblessed never captures the original title (the restore branch in Program's exit handler is commented out), so this needs XTerm title-stack escapes (\x1b[22;2t / \x1b[23;2t) pushed per screen and popped on every teardown path, plus a process-level exit hook for hard exits. createScreen is used by every screen (loading screens, popups, tests), so unbalanced push/pop would restore the wrong title and the extra escapes would reach terminals that may not support the stack. That is a separate, riskier change than a title string.

Also not included: the issue also asks for the project name inside the board Filters view; that is not part of this task's acceptance criteria.

Verification: RUN_INTERACTIVE_TUI_TESTS=1 bun test src/test/tui-interactive-editor-handoff.test.ts (4 pass) drives the real CLI through an expect PTY; the captured transcripts contain the actual OSC title writes `\x1b]0;Interactive board - Board\x07` and `\x1b]0;Interactive task-list - Tasks\x07` followed by `\x1b]0;Interactive task-list - Task TASK-1 - Task list interactive editor task\x07`.

Follow-up (PR #863 review, P1 accepted): formatTuiTitle now strips control characters. The title is emitted as `ESC ] 0 ; <title> BEL` by the fork's Program.setTitle with no escaping, so a project name from a cloned repo's backlog/config.yml containing BEL or ESC could close the OSC sequence and inject arbitrary escape codes into the user's terminal. A single stripControlCharacters helper in src/ui/tui.ts removes C0 controls, DEL, and C1 controls (0x00-0x1f, 0x7f, 0x80-0x9f) from the composed title, so the caller-supplied view strings (search queries, task titles read from task markdown, which are equally attacker-controlled) are covered by the same strip point; the project name is also cleaned before the blank/'Untitled Project' fallback check so a name made only of control characters still falls back instead of producing ' - Board'. Implemented as a code-point filter rather than a regex because Biome's noControlCharactersInRegex forbids control escapes in regular expressions.

Verification: src/test/tui-window-title.test.ts covers a crafted project name (Acme+BEL+ESC]0;pwned), a crafted view/task title, a C1 character, a control-only name falling back to 'Backlog Board', and the emitted screen.title being control-character free (7 pass). Re-ran RUN_INTERACTIVE_TUI_TESTS=1 PTY suite (4 pass), bunx tsc --noEmit, bun run check ., and bun run test (1916 pass, 5 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TUI window titles now identify the open project. A single formatTuiTitle(view, projectName) helper in src/ui/tui.ts renders "<project> - <view>" and falls back to "Backlog <view>" for a blank name or the "Untitled Project" placeholder; the board, the task viewer (initial, no-results, and selected-task titles) and the overview all use it, with the board receiving the name through a new optional projectName option passed by its existing callers. Verified by driving the real CLI through an expect PTY (RUN_INTERACTIVE_TUI_TESTS=1, 4 pass), whose transcripts show the OSC titles "Interactive board - Board", "Interactive task-list - Tasks" and "Interactive task-list - Task TASK-1 - ..."; fallbacks covered by new unit tests in src/test/tui-window-title.test.ts. bunx tsc --noEmit, bun run check . and bun test (1913 pass, 5 skip, 0 fail) are clean. Restoring the previous terminal title on exit is recorded as out of scope in the notes.
<!-- SECTION:FINAL_SUMMARY:END -->
