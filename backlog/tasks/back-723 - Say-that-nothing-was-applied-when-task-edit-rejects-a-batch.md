---
id: BACK-723
title: Say that nothing was applied when task edit rejects a batch
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-11 11:25'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1061'
  - src/cli.ts
modified_files:
  - src/cli.ts
  - src/test/acceptance-criteria.test.ts
  - src/test/cli-edit-not-applied.test.ts
type: bug
ordinal: 341000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task edit` applies all field changes in one invocation together. When one part is invalid, for example an out-of-range `--check-dod` index, the whole edit is rejected and nothing is written, but the output only names the invalid part. The only sign that the other fields were discarded is the missing `Updated task <id>` line, which is easy to miss, so a caller can believe that notes, a final summary, and checklist ticks were recorded when the task is unchanged (issue #1061, reported on 1.51.0). The issue reports the same shape for an unknown option and for a comment body that contains a reserved delimiter line.

Edits stay all-or-nothing. Applying the valid parts of a rejected edit, and a `--check-dod all` style convenience, are not part of this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When any part of a `backlog task edit` invocation is rejected, the error output names what was rejected and states explicitly that no changes were applied to the task.
- [x] #2 The command exits non-zero in that case.
- [x] #3 The task is unchanged after a rejected edit: edits stay all-or-nothing.
- [x] #4 The statement is printed whichever part of the edit was rejected, not only for checklist index errors.
- [x] #5 The output of a successful edit is unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce issue #1061 on origin/main through the CLI for each kind of rejection (out-of-range --check-ac and --check-dod, unknown option, comment with a reserved delimiter line, invalid status, conflicting flags, unknown task ID). Confirmed before coding: every case already exits 1 and leaves the task file byte-identical, but nothing in the output says so.
2. Print one sentence, 'No changes were applied.', from one place: runEditCommand in src/cli.ts, which task edit and draft edit share for one or several IDs. The current body moves unchanged into an inner function; the wrapper prints the sentence after the reason when the command ended with a failing exit code and no file was changed. A validation added later only has to fail the way the existing ones do.
3. Keep the sentence true. Research showed an edit can fail after its file was saved (auto-commit on and the commit fails: exit 1, file changed). The wrapper therefore routes every update through one tracked call that compares the file bytes before and after, and stays silent whenever a file changed or a listed task was updated.
4. Commander rejects an unknown option or a missing option value before the action runs. Give the two edit commands the same sentence through their Commander error output, set where their shared options are added, and report the parent-level 'task --json edit' rejection through the subcommand so it takes the same path.
5. Remove the per-message 'The edit was not applied.' wording from the malformed-marker error, which the shared sentence makes redundant, and update its test.
6. Tests through the public CLI in a new src/test/cli-edit-not-applied.test.ts: exit code, output, and a byte-identical file for each rejection kind on task edit and draft edit; a successful edit prints exactly what it printed before; an edit saved but not committed does not print the sentence; a multi-ID edit with one failing ID keeps today's output.
7. Run the scoped edit test files, bunx tsc --noEmit and bun run check .; simplify; record notes.
Not decided here, to be reported: what a multi-ID edit should print when some IDs are updated and others fail. That output is left as it is.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch tasks/back-723-edit-nothing-applied.

What changed
- src/cli.ts: runEditCommand (shared by task edit and draft edit, one or several IDs, flags or wizard) now wraps the unchanged edit logic, which moved to performEdit. After the reason for a failure it prints 'No changes were applied.' when the command ended with a failing exit code and no update took effect. Errors thrown by the edit are reported there too, with the same text as before.
- The sentence is checked: every update goes through one tracked call that compares the file bytes before and after a failed update, and a successful update or a changed file suppresses the sentence.
- Two rules keep it true and are stated on runEditCommand: a failure inside performEdit sets process.exitCode or throws and never calls process.exit(), and target.update is the only way performEdit writes.
- Whatever Commander rejects before the action runs (unknown option, option without its value, excess arguments) gets the sentence through the edit commands' error output. addEditFieldOptions was renamed configureEditCommand because it now sets that output as well as the shared options. The 'task --json edit' rejection is raised on the subcommand so it takes the same path; its text is unchanged for every other subcommand.
- Removed 'The edit was not applied.' from the malformed-marker message, now covered by the shared sentence; src/test/acceptance-criteria.test.ts expects the shared sentence.
- New src/test/cli-edit-not-applied.test.ts: 24 tests through the CLI.

Findings
- Before the change every rejection already exited 1 and left the task file byte-identical; only the statement was missing.
- An edit can fail after its file was saved: with auto-commit on and a commit that fails (pre-commit hook), task edit exits 1 with the notes already on disk. The sentence is not printed there, and a test pins it. The command still gives no hint that the file was saved; that is existing behavior and outside this task.
- draft edit shares the whole path and behaves the same.
- Several IDs: a rejection before any task is updated, and a run where every listed task fails, print the sentence once at the end. A run where some IDs are updated and others fail prints exactly what it printed before.
- MCP has its own error reporting and is untouched.
- 'No Backlog.md project found' exits from a shared helper before the edit starts and does not get the sentence.

Verification
- AC 1 and 4: 16 task edit and 3 draft edit rejections each print their reason and the sentence exactly once (out-of-range and non-numeric checklist indexes, reserved delimiter line in a comment, unknown option, option without its value, --json on the parent command, invalid status, priority and type, conflicting flags, unknown and missing task ID, several IDs). 19 of the new tests fail on the previous CLI.
- AC 2 and 3: the same tests assert a non-zero exit code, empty stdout, and that every task and draft file has the same bytes as before.
- AC 5: a successful task edit prints exactly 'Updated task TASK-1' and a successful draft edit 'Updated draft DRAFT-1', with empty stderr; these tests pass on the previous CLI too.
- bun test --timeout=10000 src/test/cli-edit-not-applied.test.ts: 24 pass. Scoped edit test files: 203 pass with 1 existing skip across 13 files, and 254 pass across 23 files. bunx tsc --noEmit and bun run check . pass.
- The thrown-error path is reachable only with a terminal attached (wizard with an ambiguous ID) and was checked by hand through a pseudo-terminal.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The task edit and draft edit commands now end a failed edit with 'No changes were applied.' whenever nothing was written, so a caller no longer has to notice that the 'Updated task <id>' line is missing (issue #1061). Edits stay all-or-nothing. Exit codes and file contents were already correct and are unchanged; only the message is new.

How: runEditCommand in src/cli.ts wraps the edit (performEdit) and prints the sentence after the reason when the command fails and no update took effect. Whatever Commander rejects before the edit runs (unknown option, missing value, excess arguments) gets the same sentence through the edit commands' error output in configureEditCommand. The sentence is withheld when a failure happens after the file was saved, for example auto-commit with a failing hook; that is detected by comparing the file bytes around a failed update.

Verification: new src/test/cli-edit-not-applied.test.ts with 24 tests through the CLI (exit code, output and byte-identical files for 16 task edit and 3 draft edit rejections, unchanged success output, the saved-but-not-committed case, mixed multi-ID output). The scoped edit test files, bunx tsc --noEmit and bun run check . pass.

Choices to confirm in review: with several task IDs the sentence is printed once when every ID fails, and the output is unchanged when some succeed and some fail; the wording has no 'to the task' so it stays accurate for drafts, several IDs and parser errors; 'No Backlog.md project found' exits before the edit starts and does not get the sentence.

Possible follow-up, not started: an edit whose file was saved but whose auto-commit failed still reports only the commit failure.
<!-- SECTION:FINAL_SUMMARY:END -->
