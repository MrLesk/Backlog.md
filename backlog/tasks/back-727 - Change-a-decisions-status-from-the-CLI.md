---
id: BACK-727
title: Change a decision's status from the CLI
status: Done
assignee:
  - '@codex-727'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-16 06:18'
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
1. Keep backlog decision edit <decisionId> -s/--status <free-form status>, its required non-empty status, --plain output, documented help, and the Decisions table example.
2. Merge current main into the existing PR ancestry, preserving every unrelated command and guide. Resolve the decision once through Core.getDecision across active and archived records; reject archived decisions with ContentRecordArchivedError.
3. Pass the resolved active Decision to FileSystem.updateDecisionStatus. Derive its path through contentRecordFilePath, read UTF-8 bytes, replace only the plain status entry, and compare frontmatter before writing. Preserve the original helper, refusal boundary, direct write, symbolic links, and scoped auto-commit behavior.
4. Verify the existing status tests and two archive integration tests; run related decision/storage/identity/commit tests, current type and formatting checks, build, and compiled CLI byte-preservation, refusal, listing, and linked-file commit smoke. Review subtraction and exact hashes.
5. After coordinator review KEEP, record AC/DoD proof and Done, make one scoped final commit, verify hooks preserve reviewed bytes, and push only the existing PR branch with its old remote head protected. Return the shared checkout to clean main.
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

Current-main integration proof (2026-10-16):
- Merged main a854082e6607a802aa4a02349429c3916c435781 into original PR head 0d65e2768dacc36bd2a671b0d35e1e228729f726 without rewriting either ancestry. Kept decision archive/restore/delete commands and documentation.
- Added two focused cases before the repair. They reproduced an archived ID incorrectly reporting not found and an active/archive duplicate being edited. Core now resolves once through getDecision, raises ContentRecordArchivedError, and passes that resolved record to the status writer. Storage uses contentRecordFilePath and returns only the written path.
- Existing status replacement helper and CLI adapter are byte-identical to the original PR. Existing missing-ID wording, free-form status, UTF-8/plain-entry refusal boundary, direct write, and link behavior stay as accepted. No new locking or recovery guarantee.
- 20 focused status cases passed. Seven focused/related files passed 127 tests; filesystem.test.ts passed all 53 cases on an isolated allowed-access rerun. The initial sandboxed run had five unrelated draft-promotion timeouts; direct diagnosis showed EPERM at .git/backlog.md/locks/create. No source change was needed for that environment failure.
- bun run check:types passed (564 files); bun run check . passed (459 files); bun run build passed. A formatter line-wrap failure was fixed before the clean check.
- Compiled dist/backlog smoke passed status update/listing, BOM and CRLF preservation with unknown frontmatter and nested/body sections, missing ID/status, archived read-only and restore-then-edit, active/archive ambiguity, missing plain entry, invalid UTF-8, and help. The unchanged bytes outside the status entry had SHA-256 87725db3869e2d98075f2e9e08fb5d75fc1d6d09df9ca66582b7eb56470172f8 before and after. An initial incompatible init flag combination was corrected in the smoke invocation only.
- Compiled linked-file smoke kept the symbolic link, committed only notes/decision.md after status editing through it, and left unrelated.txt staged.
- Subtraction review: only the five expected source/test/docs paths and this task differ from main. Original status helper and CLI text are unchanged; no extra abstraction is needed. Both PR and current main remain ancestors. Stable review diff is /private/tmp/back-727-reviewed.diff (SHA-256 4b271f181a50e3f0b261facc1c4134d967ad65f056aefea3808fa1f59e4b620b). Waiting for coordinator architecture review before finalization or push.

Final review: coordinator returned KEEP on exact reviewed source/test/docs hashes with no new recommendation or product decision. All tool subprocesses completed and the allocator lock was released. AC evidence: #1 source and compiled CLI help plus shipped Decisions table; #2 exact bytes in 20 focused cases and compiled BOM/CRLF fixture with unchanged outside-status hash; #3 focused and compiled issue scenario lists decision-1 as superseded and decision-2 as accepted; #4 focused and compiled missing-ID cases exit 1 without changes. DoD evidence: current canonical bun run check:types passed, bun run check . passed, 180 distinct focused/related cases passed after the diagnosed sandbox-only filesystem rerun. Build and both compiled smokes passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prepared PR #1088 against current main while keeping backlog decision edit <id> -s/--status <free-form status>. The command changes only the status entry and keeps unknown frontmatter, body sections, BOM, and line endings. Missing, ambiguous, and unrepresentable inputs fail before writing.

The integration repair uses current core identity resolution across active and archived decisions. Archived decisions receive the shared read-only message; active/archive duplicates fail closed. Storage receives the resolved record, uses the shared guarded path, and returns only that path. The original replacement helper, CLI adapter, refusal wording, direct write, and scoped commit path are preserved.

Verification: 20 status tests and 160 related cases passed (filesystem fixtures required an allowed-access rerun after a diagnosed .git allocator-lock permission error). Current type checks, Biome, build, compiled status/listing/byte/refusal smoke, and compiled linked-file commit smoke passed. Full-context review returned KEEP on exact hashes. No new locks, recovery guarantees, decision relationships, configuration, content editing, MCP tools, or web changes.
<!-- SECTION:FINAL_SUMMARY:END -->
