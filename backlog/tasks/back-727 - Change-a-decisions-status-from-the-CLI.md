---
id: BACK-727
title: Change a decision's status from the CLI
status: Done
assignee:
  - '@codex-727'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-16 06:29'
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
1. Keep backlog decision edit <id> -s/--status <free-form status>, its required non-empty value, --plain output, help, and shipped example.
2. Preserve the merged current-main ancestry and shared Core.getDecision identity/archive authority, ContentRecordArchivedError, guarded contentRecordFilePath, direct byte write, and scoped auto-commit.
3. Replace only the already-supported plain status value and its continuations/comments. Preserve the original key/separator prefix, unknown frontmatter, other body content, BOM, and line endings; retain semantic frontmatter read-back, UTF-8 and plain-entry refusal boundaries and all current failure wording.
4. Prove the separator regression red/green, retain the focused status/archive/ambiguity/refusal/link cases, and run proportionate archive/identity checks, current type checks, Biome, build, and compiled byte/listing/refusal/archive/link smoke. Keep this round and previous-round test counts separate.
5. After contextual review KEEP on exact hashes, finalize task proof and Done, make one scoped commit, verify hooks preserve reviewed bytes, and push only the existing PR branch while requiring its exact current remote head. Return the shared checkout to clean main. Stop further patch rounds unless a verified pre-change regression remains.
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

Second-round baseline at a743fcb: valid status : accepted and status:   accepted both succeeded and listed superseded but rewrote the prefix as status: . Exact expected bytes failed in both cases. Coordinator accepted a narrow correction to preserve the already-supported key/separator prefix. No broader YAML formats, locks, APIs, or core/CLI changes are part of this correction.

Second-round proof (2026-10-16):
- Before the writer correction, the 20 existing status tests passed and the two new key/separator-spacing cases failed exact-byte comparisons. Both supported inputs already listed the new status correctly; the defect was loss of prefix bytes.
- The writer now captures the original plain status key/separator prefix, including spaces/tabs after the colon, and substitutes it for the serializer-produced prefix. Existing entry selection, continuation replacement, full-entry comment replacement, UTF-8 check, semantic frontmatter read-back, refusal text, Core authority, and path guard remain unchanged. No new helper, YAML format, or source API was introduced.
- This round: 45 tests passed across three files = 22 focused status cases + 10 decision archive cases + 13 identity cases. The prior round had 180 distinct passing tests = 20 focused + 160 related; those earlier counts do not claim the new cases were run then.
- Current type checks passed for 564 files; Biome passed for 459 files; build passed.
- Compiled affected smoke passed three exact-byte fixtures: spaced key, extra separator spaces with BOM/CRLF and a replaced entry comment, and a spaced-key folded status. Every byte outside the replaced value/continuations stayed equal. Corresponding outside-status SHA-256 values: cc764ac4acfa950166478ae8335d3c6d23f4241bd61cd5203b39c527faa12a73, b2174c074d699471ab78704f7aba9a219448ceea4eac010e637c4094c0ebc472, a473ff11b25950d6dac9a92c0bafd526f6dd94833f4da3fc948c2a23255b24ac. Listing, long folded output, missing ID/status, archive refusal, active/archive ambiguity, restore, missing plain entry and invalid UTF-8 also passed.
- Compiled linked-file smoke preserved status :   spacing and the link, committed only notes/decision.md, and left unrelated.txt staged.
- Subtraction review: only operations.ts, cli-decision-status.test.ts, and this task changed from published a743fcb. Core, CLI and shipped documentation are byte-identical to the reviewed published head. Full reviewed diff: /private/tmp/back-727-round2-reviewed.diff SHA-256 d4329834dd42e5975e4692ca338aea8bb70ad90d15e50fc2f23ead42866d4f50. Correction-only diff: /private/tmp/back-727-round2-correction.diff SHA-256 e5ef029bcd1f10173315dc00551c7a7726c7af85e7bd11438987784999d32a1f. Waiting for contextual review and authorization before finalization or push.

Second contextual review returned KEEP on exact round-two source/test/docs hashes with no new product choice or source recommendation. Both compiled smokes passed, all subprocesses completed, and temporary smoke projects were cleaned up. AC #2 now also has red/green proof for the existing spaced separator forms and compiled equality outside the intended value/continuation replacement; AC #1/#3/#4 remain proven by the focused help/list/missing-ID cases and compiled smoke. This round is 45 passing cases (22 status + 23 archive/identity), separate from the earlier 180 distinct integration cases; counts are not summed across overlapping rounds. Finalization and protected push were authorized against a743fcb52933329665d64a0f80b65a1eeba69c29.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prepared PR #1088 against current main and repaired the verified separator-byte regression. backlog decision edit <id> -s/--status <free-form status> now keeps an existing status key/separator prefix, including valid spacing before and after the colon, while replacing the status value and its existing entry continuations/comments. Unknown frontmatter, other body content, BOM, and line endings stay unchanged.

Current identity/archive checks, shared guarded path, semantic frontmatter read-back, UTF-8/plain-entry refusals, failure wording, direct writes, symbolic links, and scoped commit behavior are preserved. No new YAML formats, locks, APIs, configuration, content editing, MCP tools, or web changes were added.

Second-round verification: the two new separator cases failed before the correction; 22 status and 23 archive/identity cases passed after it. Current type checks, Biome, build, compiled byte/listing/refusal/archive smoke, and compiled linked-file scoped-commit smoke passed. Three compiled fixtures preserved all bytes outside the intended replacement. Earlier integration proof covered 180 distinct cases and is recorded separately. Both contextual reviews returned KEEP on their exact reviewed hashes.
<!-- SECTION:FINAL_SUMMARY:END -->
