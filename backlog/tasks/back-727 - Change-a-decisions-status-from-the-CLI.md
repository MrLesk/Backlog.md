---
id: BACK-727
title: Change a decision's status from the CLI
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-11 11:39'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1068'
  - src/cli.ts
  - src/core/backlog.ts
  - src/file-system/operations.ts
modified_files:
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/cli.ts
  - CLI-INSTRUCTIONS.md
  - src/test/cli-decision-status.test.ts
type: enhancement
ordinal: 345000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decisions can be created and listed from the CLI, but their status cannot be changed afterwards. When a decision is replaced by a newer one, the old one keeps listing as accepted, so `backlog decision list` reports two contradictory decisions as both in force (issue #1068). The shipped guidance says never to edit decision files by hand, which leaves no supported way to retire a replaced decision. The issue also notes that the browser's decision save can set a status but rewrites the whole record, so it is not a safe way to change one field.

A decision's content stays immutable; only its status changes. The exact command name and flags are settled during plan review. Not part of this task: a superseded-by link between decisions, editing decision content, MCP decision tools, and web changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A documented `backlog decision` command, listed in `backlog decision --help` with its own help text, changes the status of an existing decision.
- [x] #2 The command changes only the status in the decision's frontmatter; the rest of the file is byte-for-byte unchanged.
- [x] #3 After the change, `backlog decision list --plain` shows the decision with its new status, so a replaced decision no longer lists as accepted.
- [x] #4 Running the command for a decision that does not exist exits non-zero with a clear message and changes no file.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Command shape (accepted in review; the final call belongs to the maintainer, on the PR)

Chosen: `backlog decision edit <decisionId> -s, --status <status>`
- `edit <id> -s <status>` is how a status already changes on tasks and drafts (`task edit BACK-1 -s "Done"`, `draft edit`), and `-s, --status` is the flag `decision create` and `task create` already use, so there is no new verb and no new flag style. It is also what the reporter of #1068 typed first.
- The status is required and free-form, exactly as `decision create -s` takes it: no vocabulary, no validation. An empty value counts as not given, as `-s ""` already does on `task edit` and `decision create`, so it is refused instead of writing an empty status.
- `--plain` is accepted like on `decision create` and `decision list`; output is one plain line, `Updated decision <id>`.

Rejected:
- `decision status <id> <status>` (the proposal in the issue): a verb no other record has, and a positional status where every other command passes it with `-s`.
- `decision update <id> -s <status>`: `update` is the document verb and documents have no status; the status idiom users and the shipped guides already know is `edit -s`.
- `decision supersede <old> --by <new>` and `--superseded-by`: a relationship between decisions, which is a non-goal.
- A positional status on `edit`: would stop `edit` from ever taking a second field.

The shape lives in one place: the command registration in src/cli.ts (name, flag, help, the missing-status message). Core and storage names and error messages do not mention the command or flag. Tests spell the command and flag in two constants.

Implementation

1. src/file-system/operations.ts, next to saveDecision/loadDecision: `FileSystem.updateDecisionStatus(decisionId, status)`.
   - Resolves the record with the existing `loadDecision` (frontmatter identity; fails closed with AmbiguousIdError when several files claim the ID) and returns null when no decision has the ID. It writes to the file it read, never to a path rebuilt from the ID and title.
   - Reads the file as bytes and refuses it when the bytes do not round-trip as UTF-8. `Bun.file().text()` is not used because it drops a byte-order mark.
   - Never parses and re-serializes: `serializeDecision` writes only the keys and sections it knows and drops everything else (#1008, #1010, #1065). The module-private helper `replaceDecisionStatus` works in six steps: split the text keeping each line break; find the closing `---` line the way the reader does; find the plain `status:` line and refuse when there is none; take its indented continuation lines (a long status is stored folded over several lines); splice in the new entry, spelled by the serializer `decision create` uses and ended with the newline style of the file; read the result back with `parseMarkdown` and require its frontmatter to equal the old one apart from the status.
   - The whole status entry is replaced, so a comment on the status line goes with it. A decision without a plain `status:` line is refused and left unchanged; no entry is appended.
   - Any refusal throws one message that names the file and asks for UTF-8 text with one plain `status: value` line; nothing is written.
   - Locking and write: same as the other decision, document and milestone writes: no per-record lock and a plain `Bun.write` (only tasks and drafts lock). The write goes through a symlink instead of replacing it.
2. src/core/backlog.ts: `Core.updateDecisionStatus(decisionId, status, autoCommit?)` calls the storage method, throws `Decision <id> not found` on null, passes on the ambiguity and refusal errors, and auto-commits just that file like `createDecision` does (`backlog: Update decision <id>`). Placed after `createDecisionWithTitle` to stay clear of contributor PR #1018, which edits `updateDecisionFromContent`; the web save path is not touched.
3. src/cli.ts: thin `decision edit` adapter with the same help schema structure as `decision create`. Its `Writes:` line says the status line is replaced. Errors reach the top-level handler, which prints the message and exits 1.
4. CLI-INSTRUCTIONS.md: one row in the Decisions table. The CLI instruction guides under src/guidelines list no decision commands, so they stay as they are.
5. Tests, all through the CLI, in src/test/cli-decision-status.test.ts: the #1068 scenario in `decision list --plain`; byte-for-byte preservation of a file with an unrecognised section, a nested heading and an extra frontmatter key; one `it.each` over files whose status line is replaced with every other byte kept (CRLF with a byte-order mark and no final newline, a multi-line status, a trailing comment, look-alike status lines); one `it.each` over refused files that stay unchanged (no status line, a quoted key, flow-style frontmatter, a blank line inside the value, invalid UTF-8); free-form and long statuses; unknown and ambiguous ID; missing status; symlinked file; auto-commit scope; help output. Dates come from the run clock.
6. Verify: `bun test --timeout=10000 src/test/cli-decision-status.test.ts`, `bunx tsc --noEmit`, `bun run check .`.

Out of scope: superseded-by links, editing title or content, MCP tools, web UI and HTTP API, and the existing web save path.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented `backlog decision edit <decisionId> -s <status>` on branch tasks/back-727-decision-status: one storage operation (`FileSystem.updateDecisionStatus` with the private text helper `replaceDecisionStatus`), one core operation (`Core.updateDecisionStatus`, which adds the not-found error and the auto-commit), and a thin CLI adapter. No new exports, config keys or dependencies.

Research findings that shaped it:
- Reproduced #1068 on origin/main: `decision edit` is an unknown command and both decisions list as accepted.
- Re-serializing a decision that has an extra frontmatter key and a `## Revisit trigger` section drops both, so the status is replaced as text.
- `Bun.file().text()` strips a UTF-8 byte-order mark, so the file is read as bytes; text that does not encode back to the same bytes is refused.
- The frontmatter serializer folds a status longer than about 80 characters over several lines, so `decision create -s "<long status>"` already produces multi-line entries; the indented continuation lines are replaced with the entry.
- Thrown errors reach the top-level handler in src/cli.ts, which prints the message and exits 1, so the adapter does not catch them.

The helper after the maintainability review (30 lines): split the text keeping line breaks, find the closing `---` line, find the plain `status:` line and refuse when there is none, take its indented continuation lines, splice in the new entry with the newline style of the file, read the result back and require the frontmatter to be equal apart from the status. The first version also kept a comment written after the status and appended a status entry to a decision that had none; the review removed both. The whole status line is now replaced, and a decision without a plain `status:` line is refused and left unchanged, which also keeps a second key from appearing next to a hand-written `Status:`.

What is refused, each with exit 1 and no file changed:
- unknown ID: `Decision <id> not found`
- an ID several files claim: the existing ambiguous-ID message listing the files
- no plain `status:` line, a quoted "status" key, flow-style frontmatter, a status value with a blank line inside it, text that is not valid UTF-8: `Cannot change the status of <id> without changing other content in <file>. Make sure the file is UTF-8 text and its frontmatter has one plain "status: value" line, then try again.`
- no status or an empty one: `Status is required. ...`

Verification: `bun test --timeout=10000 src/test/cli-decision-status.test.ts` 18 pass, 0 fail. `bunx tsc --noEmit` clean. `bun run check .` clean (432 files). The read-back comparison, the byte-order-mark-safe read and the UTF-8 check were each broken on purpose to confirm a named test fails.

Open choices for review on the PR:
1. No per-record lock and a non-atomic write, matching decision create, the web decision save, `doc update` and `milestone rename`. Only tasks and drafts lock. A temp-file-and-rename write would also replace a symlinked decision file with a regular file.
2. The refusal message asks for a hand edit, which the shipped guidance otherwise forbids for decision files.
3. An indented line directly under the status line counts as part of the status entry, so an indented comment placed there is replaced with it.
4. A malformed decision file is skipped by the existing listing, so its ID reports as not found here too.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `backlog decision edit <decisionId> -s <status>`, so a decision that has been replaced can be marked superseded from the CLI and no longer lists as accepted (issue #1068).

What changed
- src/cli.ts: the `decision edit` command with the same help structure as `decision create`. The status is required and free-form; `--plain` is accepted.
- src/core/backlog.ts: `Core.updateDecisionStatus` reports an unknown ID, passes on storage errors and auto-commits only the decision file when auto-commit is on.
- src/file-system/operations.ts: `FileSystem.updateDecisionStatus` and the private helper `replaceDecisionStatus`. The status line is replaced as text, because the decision serializer writes only the keys and sections it knows and would drop the rest. The edited text is read back and the write is refused unless the frontmatter is unchanged apart from the status. The file is read as bytes, so a byte-order mark and line endings are kept and text that is not valid UTF-8 is refused.
- CLI-INSTRUCTIONS.md: one row in the Decisions table.
- src/test/cli-decision-status.test.ts: 18 tests through the CLI.

Behavior
- Only the status line changes. On a decision with extra frontmatter keys, a nested heading and an unrecognised section, the diff is the status line alone and every other byte is identical.
- Unknown ID, an ID several files claim, a file without one plain `status: value` line, and a missing status all exit 1 with a message and change no file.

Verification
- `bun test --timeout=10000 src/test/cli-decision-status.test.ts`: 18 pass, 0 fail.
- `bunx tsc --noEmit`: clean. `bun run check .`: clean.
- Issue scenario by hand: before, `decision edit` was an unknown command and both decisions listed as accepted; after, decision-1 lists as superseded.

Choices left for the maintainer to confirm on the pull request
- The command shape `decision edit -s`; it is registered in one place, so a rename is a one-place change.
- A comment on the status line, or an indented comment directly under it, is replaced along with the entry.
- A file without one plain `status: value` line is refused, and the message asks for a hand fix.
- No lock and a direct write, as decision create, the web decision save, document update and milestone rename do today.
- Setting the status a decision already has still rewrites the entry.

Not included: a superseded-by link, editing decision content or title, MCP tools, web changes.
<!-- SECTION:FINAL_SUMMARY:END -->
