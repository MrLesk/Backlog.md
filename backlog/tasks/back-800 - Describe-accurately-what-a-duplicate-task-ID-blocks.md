---
id: BACK-800
title: Describe accurately what a duplicate task ID blocks
status: Done
assignee:
  - '@claude'
created_date: '2026-11-10T07:23:00Z'
updated_date: '2026-11-10T07:28:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1146'
  - src/utils/duplicate-detection.ts
modified_files:
  - src/utils/duplicate-detection.ts
priority: low
type: bug
ordinal: 406000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When two task files claim one ID, the warning says: "Some task views may hide files and ID-based commands are blocked until the collision is repaired." Measured on main at e1a67143 with one duplicate pair and one clean task, that is the wrong way round. `backlog task list` and `backlog search` exit 1 with nothing on stdout. `backlog task view` and `backlog task edit` on the clean task succeed. Only a command that names the duplicated ID is refused, with its own ambiguity message. A person or script reading the warning looks for the problem in the wrong place (issue #1146). This task corrects the description only. Stopping list and search while a duplicate exists is existing, tested behavior and stays as it is; whether it should change is a separate product question.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With a duplicate task ID in the store, the warning says what actually happens: task list and search stop until the collision is repaired, a command that names the duplicated ID is refused as ambiguous, and commands that name any other ID keep working.
- [x] #2 Every place that prints this warning shows the same corrected text from one shared source.
- [x] #3 CLI help and shipped instructions that describe the duplicate-ID state agree with the corrected text.
- [x] #4 Which commands succeed and which fail while a duplicate exists is unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce in a scratch project (two tasks, first copied into backlog/archive/tasks) and record exit status/stdout for task list, search, board export, doctor, and task view/edit on the clean and duplicated IDs.
2. Rewrite the explanation in formatDuplicateTaskIdWarning (src/utils/duplicate-detection.ts), the single source used by CLI task list, search, board export, doctor and the MCP task_list result, so it matches the measured behavior.
3. Check CLI help and src/guidelines for text describing the duplicate-ID state; change only text that disagrees.
4. Update only tests that pin the old wording (none found by search; existing tests assert paths, doctor hint, and absence of agent/prompt wording).
5. Run bun run check:types, bun run check, and focused duplicate-detection, cli-doctor and mcp-tasks tests; re-run the scratch reproduction to confirm unchanged exit codes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured in a scratch project with the source CLI, before and after the change (identical exit codes), with TASK-1 in backlog/tasks and a copy in backlog/archive/tasks, plus a clean TASK-2:
- task list --plain: exit 1, rows printed. task list --json: exit 1, empty stdout.
- search --plain: exit 1, results printed; with two active files sharing one ID, search shows only one of them. search --json: exit 1, empty stdout.
- board export: exit 1, no file written. doctor: exit 1, repair preview printed.
- task view/edit TASK-2: exit 0. task view/edit TASK-1: exit 1, 'Task ID TASK-1 is ambiguous'.
So list and search do not print nothing in every mode, as the description says; only --json output is empty. The new text says they exit with an error and their output may be incomplete, which holds for both modes. It also names board export because that command prints the same warning and stops.
The warning comes from formatDuplicateTaskIdWarning only (CLI list, search, board export on stderr; doctor on stdout; MCP task_list result). CLI help and src/guidelines contain no text describing what duplicates block; the existing 'ambiguous task ID ... run backlog doctor' guidance already agrees. No test pinned the old sentence, so no test changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected the duplicate task ID warning in formatDuplicateTaskIdWarning, its single source. It used to say ID-based commands are blocked; it now says that until the duplicates are repaired 'backlog task list', 'backlog search' and 'backlog board export' exit with an error and their output may be incomplete, that a command naming a listed ID is refused as ambiguous, and that commands naming other task IDs keep working. CLI list, search, board export, doctor and the MCP task_list result all print this one text. CLI help and shipped instructions needed no change.

Verification: scratch-project reproduction before and after the change gives identical exit codes (list/search/board export/doctor 1, view/edit of the clean ID 0, view/edit of the duplicated ID 1 with the ambiguity message). bun run check:types and bun run check pass; duplicate-detection, cli-doctor, mcp-tasks and tui-startup-warning tests pass (93 tests).

Not changed: whether list and search fail while a duplicate exists, and the empty --json stdout; both remain the separate product question from issue #1146.
<!-- SECTION:FINAL_SUMMARY:END -->
