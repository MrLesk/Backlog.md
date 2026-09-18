---
id: BACK-687
title: Page long CLI lists with grep-style options
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:43'
updated_date: '2026-09-18 18:11'
labels: []
dependencies: []
modified_files:
  - src/utils/list-window.ts
  - src/formatters/json-output.ts
  - src/cli.ts
  - src/file-system/operations.ts
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-creation.md
  - CLI-INSTRUCTIONS.md
  - src/test/list-window.test.ts
  - src/test/cli-list-window.test.ts
type: enhancement
ordinal: 318000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents read Backlog.md lists through the CLI. `backlog task list`, `backlog search` and `backlog doc search` accept `--limit`, which cuts the result after sorting without saying that items were left out, and no option reaches the following items. An agent therefore either reads a very long list or acts on a silently incomplete one. Agents already know grep's `-m`/`--max-count` and `-c`/`--count`, and `git log --max-count --skip`, so reusing those names avoids a new vocabulary. Groma adopts the same options for its plain-text lists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Plain output that is cut ends with the item range, the total and the exact command that prints the next items; complete output has no footer.
- [x] #2 JSON output reports the total and the next skip value when items are cut, and the existing `--limit` option keeps its documented behavior.
- [x] #3 CLI help, agent instructions and tests cover the options, the footer and window boundaries.
- [x] #4 Every CLI command that lists tasks, documents, decisions, drafts, milestones or search results accepts `--max-count <n>` and `--skip <n>`, applied after filtering and sorting, with stable order so consecutive windows neither overlap nor skip items. No short flags are added because `-m` already means `--milestone`.
- [x] #5 `--count` prints only the number of matching items.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one shared list window module (src/utils/list-window.ts): registers --max-count <n>, --skip <n> and --count; validates them with the shared positive-integer parser (also used by --limit), a non-negative skip, and --count rejected with --json; selects the window; formats the footer (range, total, and the typed command with --skip replaced).
2. Route every listing command (task list, search, draft list, milestone list, doc list, doc search, decision list) through one cli.ts helper, resolveListOutput, which resolves the output mode, parses the window with the typed arguments, and prints text instead of an interactive view when window or count options are given.
3. Window each list after filtering, sorting and --limit, in its printed order: task list grouped by status unless --sort priority, plain search grouped as tasks, documents, decisions; JSON keeps its own order. --count prints the number of items the same command would list.
4. JSON (task list, search, decision list): add total and nextSkip only when the window cuts the list.
5. Stable order: break equal document titles by path in listDocuments.
6. Document the options in CLI help, the shipped CLI instruction guides and CLI-INSTRUCTIONS.md.
7. Tests: unit tests for windows, footer, quoting and validation; CLI tests that follow the printed Next commands and join grouped windows into the complete output.
8. Run bunx tsc --noEmit, bun run check ., bun test.

Review round (Codex and Grok cold reviews):
9. Next command: walk the typed arguments with the running command's value-taking options, so an option value that reads --skip or -- is kept, only real --skip options are replaced, and the new --skip goes before a -- separator.
10. --count: print the number as a string so Bun never colors it.
11. milestone list: a cut window prints only the sections it has milestones from; uncut output is unchanged.
12. Docs: state that task list --json windows its flat tasks array in sort order, not status groups.
13. Regression tests for each fix; run bunx tsc --noEmit, bun run check . and bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared window module (src/utils/list-window.ts) used by task list, search, draft list, milestone list, doc list, doc search and decision list. Each command validates --max-count (1+), --skip (0+) and --count (rejected with --json) before reading the backlog, then windows its already filtered, sorted and --limit-shortened list. printListWindow prints --count as a bare number, prints the items, and appends 'Showing <first>-<last> of <total> items. Next: backlog ... --skip <n>' only when the window leaves items out; the next command is the typed arguments with --skip replaced and shell-quoted. The last window has no Next part and a skip past the end prints 'Showing 0 of <total> items.'. JSON envelopes for task list, search and decision list gain total and nextSkip only when cut, so uncut output is unchanged (including task list --json --watch). Window and count options print text instead of opening the TUI. --count counts what the same command would print, like grep -c -m and git rev-list --count. Milestone list windows active milestones, then completed ones with --show-completed; section headings keep their full counts. Documents with equal titles are now ordered by path so windows cannot overlap; tasks, drafts and decisions already break ties by ID and search by score then corpus order. The search JSON readiness projection moved into projectSearchTaskRows so it runs on the window only. Docs: help schemas and examples, overview and task-creation guides, CLI-INSTRUCTIONS.md (paging section, JSON fields, examples). Tests: src/test/list-window.test.ts (window coverage, boundaries, footer, quoting, validation) and src/test/cli-list-window.test.ts (every command, following real Next commands, JSON fields, --limit unchanged, --count, invalid values, equal-title documents, help and instructions).

Validation: bunx tsc --noEmit passes; bun run check . passes; bun test src/test/list-window.test.ts src/test/cli-list-window.test.ts src/test/cli-guidance.test.ts: 31 pass; related CLI suites (json output, json watch, doc search, search, task list, doc/decision/board, milestone management, plain output, docs recursive): 121 pass. Full bun run test: 2885 pass, 8 skip, 2 fail. Both failures are timing races in src/test/board-tui-move.test.ts (TUI board multi-select mover) under full-suite load, together with an unhandled async web App error from another test file; that file passes 8 of 8 runs alone, and this change touches no board, TUI or web code. Manual smoke in a scratch project covered every command, following Next commands, --count, JSON total/nextSkip, invalid values, and --json --watch with a window.

Cold review applied: windows now follow the printed order (task list groups by status before cutting, plain search orders tasks, documents, decisions before cutting; groupTasksByStatus serves both ordering and printing). All seven commands start from resolveListOutput, which replaces textOutputForWindow and the inline plain checks and passes process.argv from cli.ts into the window. parsePositiveIntegerOption moved to list-window.ts and serves --limit and --max-count. ListWindow.requested is now forcesText. Shell quoting no longer leaves = or % unquoted. draft list handles the empty case like doc list; its --sort validation now runs before reading drafts, so an invalid sort also fails when there are no drafts. Tests join consecutive grouped windows into the complete output for task list and mixed-type search (both fail on the previous ordering), and guidance checks only the option names. Validation: bunx tsc --noEmit and bun run check . pass; 16 related CLI suites: 172 pass; full bun run test: 2886 pass, 8 skip, 2 fail, the same two src/test/board-tui-move.test.ts timing races as before (the file passes alone; this change touches no board or TUI code).

Review round (Codex and Grok cold reviews), each finding reproduced first in a scratch project:
- Next command: 'doc list --max-count 1 --' printed 'Next: ... -- --skip 1', which fails with too many arguments, and 'task list --search --skip --max-count 1' printed 'Next: backlog task list --search 1 --plain --skip 1', which changed the search and dropped the page size. parseListWindow now takes the running Commander command, derives the help hint and the flags that read a value (required options of the command and its parents), and nextPageCommand keeps those values as typed, drops only real --skip options, and inserts the new --skip before a -- separator. resolveListOutput passes the command instead of a help string; draft list gained a draftListCommand variable like the other list commands.
- --count: Bun colors a logged number when FORCE_COLOR is set (bytes ESC[0mESC[33m5ESC[0m), so the count is now logged as a string.
- milestone list: a cut window printed both section headings with full counts and empty bodies. A cut window now prints only the sections it lists milestones from (headings keep their full counts); uncut output is unchanged, so consecutive windows join into the complete output.
- Docs: CLI-INSTRUCTIONS.md implied task list --json windows follow status groups; it now says task list --json windows its flat tasks array in sort order and search --json in relevance order, so all windows of a list are read in one output mode. Code unchanged; the overview already says windows follow the printed order.
Regression tests: list-window.test.ts (option values that read --skip or --, the -- separator, value flags and help hint from a Commander command); cli-list-window.test.ts (following Next commands for task list --search --skip and doc list --, --count under FORCE_COLOR=1, milestone windows joining into the complete output, JSON task windows as slices of the flat array). Against the unfixed code the CLI tests fail for the next command, --count and milestones; the JSON order test pins the documented behavior and passes on both.
Validation: bunx tsc --noEmit and bun run check . pass; paging and guidance suites pass; full bun run test twice: 2888 pass/4 fail, then 2891 pass/1 fail. The failures were src/test/board-tui-move.test.ts timing races and two content-store.test.ts tests that received an unhandled async web App.tsx error from another file; both files pass alone (20/20, 67/67), and this change touches no board, TUI, web or content store code.

Cold review follow-up: without --show-completed, cut milestone windows had lost the collapsed Completed section, so windows no longer joined into the complete output (a regression from the milestone fix). printListWindow now passes the page to printItems; milestone list uses page.cut, prints a section that lists no milestones where it falls (Active with (none) in the first window, Completed with (none) or the collapsed note in the last), and builds both sections' rows the same way. The valueFlags comment names the unhandled case of a parent flag (such as --plain of task) typed between a value flag and its value; operands became afterSeparator; the unit test command declares --search alone. The milestone CLI test now also joins the windows of milestone list without --show-completed (fails without the fix).
Validation: bunx tsc --noEmit and bun run check . pass; list-window and cli-list-window suites pass (20 tests); full bun run test: 2887 pass, 8 skip, 5 fail, all in src/test/board-tui-move.test.ts. Under the current machine load (load average about 75) that file fails 4 to 7 of 20 tests alone both on this branch and on unmodified origin/main; earlier in this round it passed 20/20 alone. No board or TUI code changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added grep and git log style paging to every CLI listing command: task list, search, draft list, milestone list, doc list, doc search and decision list accept --max-count <n>, --skip <n> and --count (long options only). Windows apply after filtering, sorting and --limit, in the order the output prints, so consecutive windows join into the complete output. Cut plain output ends with 'Showing <first>-<last> of <total> items. Next: backlog ... --skip <n>'; complete output is unchanged. JSON for task list, search and decision list adds total and nextSkip only when cut. --count prints the number of items the command would list and rejects --json. Window and count options print text instead of opening the TUI. Documents with equal titles are ordered by path. One shared module (src/utils/list-window.ts) and one cli.ts entry helper (resolveListOutput) serve all seven commands; help schemas, the overview and task-creation guides and CLI-INSTRUCTIONS.md document the options. Verified with bunx tsc --noEmit, bun run check ., new unit and CLI tests (including following real Next commands across grouped task and mixed search output), 172 passing related CLI tests, and a full bun run test (2886 pass; the only 2 failures are existing board-tui-move timing races that pass alone).

Review round (Codex, Grok and a follow-up cold review): the Next command now keeps option values that read --skip or -- and puts the new --skip before a -- separator, using the value-taking options of the running command and its parents; --count prints a plain integer even when color is forced; a cut milestone window prints the sections it lists milestones from, and a section without listed milestones (none, or collapsed without --show-completed) prints where it falls, Active in the first window and Completed in the last, so windows join into the complete output; CLI-INSTRUCTIONS.md now states that task list --json windows its flat tasks array rather than status groups. Verified with regression tests that fail on the unfixed code (except the JSON order test, which pins the documented behavior), bunx tsc --noEmit, bun run check . and full bun run test runs whose only failures were board-tui-move timing races (also failing on unmodified origin/main under the same machine load) and, in one run, a leaked web App error in content-store tests that pass alone.
<!-- SECTION:FINAL_SUMMARY:END -->
