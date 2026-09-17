---
id: BACK-687
title: Page long CLI lists with grep-style options
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:43'
updated_date: '2026-09-17 06:45'
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
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared window module (src/utils/list-window.ts) used by task list, search, draft list, milestone list, doc list, doc search and decision list. Each command validates --max-count (1+), --skip (0+) and --count (rejected with --json) before reading the backlog, then windows its already filtered, sorted and --limit-shortened list. printListWindow prints --count as a bare number, prints the items, and appends 'Showing <first>-<last> of <total> items. Next: backlog ... --skip <n>' only when the window leaves items out; the next command is the typed arguments with --skip replaced and shell-quoted. The last window has no Next part and a skip past the end prints 'Showing 0 of <total> items.'. JSON envelopes for task list, search and decision list gain total and nextSkip only when cut, so uncut output is unchanged (including task list --json --watch). Window and count options print text instead of opening the TUI. --count counts what the same command would print, like grep -c -m and git rev-list --count. Milestone list windows active milestones, then completed ones with --show-completed; section headings keep their full counts. Documents with equal titles are now ordered by path so windows cannot overlap; tasks, drafts and decisions already break ties by ID and search by score then corpus order. The search JSON readiness projection moved into projectSearchTaskRows so it runs on the window only. Docs: help schemas and examples, overview and task-creation guides, CLI-INSTRUCTIONS.md (paging section, JSON fields, examples). Tests: src/test/list-window.test.ts (window coverage, boundaries, footer, quoting, validation) and src/test/cli-list-window.test.ts (every command, following real Next commands, JSON fields, --limit unchanged, --count, invalid values, equal-title documents, help and instructions).

Validation: bunx tsc --noEmit passes; bun run check . passes; bun test src/test/list-window.test.ts src/test/cli-list-window.test.ts src/test/cli-guidance.test.ts: 31 pass; related CLI suites (json output, json watch, doc search, search, task list, doc/decision/board, milestone management, plain output, docs recursive): 121 pass. Full bun run test: 2885 pass, 8 skip, 2 fail. Both failures are timing races in src/test/board-tui-move.test.ts (TUI board multi-select mover) under full-suite load, together with an unhandled async web App error from another test file; that file passes 8 of 8 runs alone, and this change touches no board, TUI or web code. Manual smoke in a scratch project covered every command, following Next commands, --count, JSON total/nextSkip, invalid values, and --json --watch with a window.

Cold review applied: windows now follow the printed order (task list groups by status before cutting, plain search orders tasks, documents, decisions before cutting; groupTasksByStatus serves both ordering and printing). All seven commands start from resolveListOutput, which replaces textOutputForWindow and the inline plain checks and passes process.argv from cli.ts into the window. parsePositiveIntegerOption moved to list-window.ts and serves --limit and --max-count. ListWindow.requested is now forcesText. Shell quoting no longer leaves = or % unquoted. draft list handles the empty case like doc list; its --sort validation now runs before reading drafts, so an invalid sort also fails when there are no drafts. Tests join consecutive grouped windows into the complete output for task list and mixed-type search (both fail on the previous ordering), and guidance checks only the option names. Validation: bunx tsc --noEmit and bun run check . pass; 16 related CLI suites: 172 pass; full bun run test: 2886 pass, 8 skip, 2 fail, the same two src/test/board-tui-move.test.ts timing races as before (the file passes alone; this change touches no board or TUI code).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added grep and git log style paging to every CLI listing command: task list, search, draft list, milestone list, doc list, doc search and decision list accept --max-count <n>, --skip <n> and --count (long options only). Windows apply after filtering, sorting and --limit, in the order the output prints, so consecutive windows join into the complete output. Cut plain output ends with 'Showing <first>-<last> of <total> items. Next: backlog ... --skip <n>'; complete output is unchanged. JSON for task list, search and decision list adds total and nextSkip only when cut. --count prints the number of items the command would list and rejects --json. Window and count options print text instead of opening the TUI. Documents with equal titles are ordered by path. One shared module (src/utils/list-window.ts) and one cli.ts entry helper (resolveListOutput) serve all seven commands; help schemas, the overview and task-creation guides and CLI-INSTRUCTIONS.md document the options. Verified with bunx tsc --noEmit, bun run check ., new unit and CLI tests (including following real Next commands across grouped task and mixed search output), 172 passing related CLI tests, and a full bun run test (2886 pass; the only 2 failures are existing board-tui-move timing races that pass alone).
<!-- SECTION:FINAL_SUMMARY:END -->
