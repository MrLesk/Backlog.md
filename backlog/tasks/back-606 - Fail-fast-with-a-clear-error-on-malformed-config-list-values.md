---
id: BACK-606
title: Fail fast with a clear error on malformed config list values
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-08 15:56'
updated_date: '2026-08-08 21:13'
labels: []
dependencies: []
ordinal: 245000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Config list keys are parsed textually and silently accept malformed YAML, for example statuses: ["To Do] with a missing closing quote; only default_assignee received the strict YAML-based parsing during BACK-583. Approved direction from Alex (2026-08-08): align all list config keys on the same strict parser and fail fast at startup with a very clear error in the shape "Backlog could not start because ..." naming the config file and the offending key, instead of silently proceeding with a misparsed value.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All list config keys are parsed with the same strict YAML-based parser as default_assignee
- [x] #2 A malformed list value aborts startup with a clear error naming the config file and the offending key
- [x] #3 The error message starts with "Backlog could not start because"
- [x] #4 Tests cover malformed values for each list config key
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the per-key list parsing in src/file-system/operations.ts with one shared strict helper: extract each list key's own YAML block (generalized from extractDefinitionOfDoneYaml) and parse it with Bun.YAML, the same parser default_assignee got in BACK-583. Per-key blocks mean one malformed key can no longer silently change how another key parses.
2. Delete the textual fallback parseInlineConfigList and the whole-document matter() list parse; keep the accepted shapes exactly as today (inline array, block sequence, empty value, number coercion, quoted commas) so every currently-valid config parses to identical values.
3. Throw a single clear error when YAML rejects a list key's block: 'Backlog could not start because <config path> has an invalid value for "<key>": <yaml reason>. Edit that key so its value is valid YAML, then run the command again.'
4. Restructure FileSystem.loadConfig so I/O failures still return null but parse errors propagate instead of being swallowed by the catch-all.
5. Fold parseAssigneeConfigValue into the shared helper and drop the now-redundant default_assignee check in src/utils/config-watcher.ts (parseConfig already rejects malformed values, so the watcher keeps the last good config).
6. Verify each entry point surfaces the message rather than a raw stack: CLI (non-zero exit), TUI/board, web server, MCP start; fix only the presentation sites that dump the error object.
7. Tests: malformed value per list key (statuses, labels, types, priorities, default_assignee) asserting the message and named key, cross-key isolation, valid round-trips (inline, block, empty, quoted commas), plus a CLI end-to-end non-zero exit check.
8. Deliberately out of scope, to flag for Alex: values that are valid YAML but not a list (e.g. 'statuses: To Do') keep today's silent fallback to defaults rather than becoming a hard error.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: src/file-system/operations.ts now parses every list config key through one shared strict helper. extractConfigKeyYaml() pulls out just that key's YAML block (its key: line plus continuation lines, stopping at the next key at the same or lower indent) and parseConfigListValue() parses that block with Bun.YAML, the same parser default_assignee got in BACK-583. Deleted parseInlineConfigList (the textual comma/quote split) and the whole-document matter() list parse; parseAssigneeConfigValue is folded into the shared helper. Because each key is parsed in isolation, one malformed key can no longer silently downgrade another key's parse. extractDefinitionOfDoneYaml was replaced by the shared extractor, removing the duplicated block-extraction loop.

On a value YAML rejects, configValueError() throws: 'Backlog could not start because <config path> has an invalid value for "<key>": <yaml reason>. Edit that key so its value is valid YAML, then run the command again.' FileSystem.loadConfig was restructured so I/O failures still return null but parse errors propagate instead of being swallowed by the old catch-all. cli.ts gained reportCommandFailure(), replacing nine duplicated console.error(summary, err) + process.exitCode = 1 pairs; it prints a config error as written (via the new isConfigValueError predicate) and keeps the stack for genuinely unexpected errors.

Backward compatibility evidence: a 38-case parse matrix (inline arrays, block sequences, bare keys, empty arrays, quoted commas, unquoted scalars in arrays, numbers, trailing comments, CRLF, tab indentation, comments inside blocks, duplicate keys, legacy definition_of_done backslashes) produced byte-identical results before and after; the only diffs are the malformed cases, which now fail fast. 'backlog config list' output against this repo's own config.yml is byte-identical before and after.

Entry points verified live in a scratch project with statuses: ["To Do, "In Progress", "Done"]: task list, task <id>, task edit, search, board, config get/set/list, overview, cleanup, agents, browser (web server) and mcp start all exit non-zero and print the single clear message with no stack trace. --version, --help and instructions still work, since they do not read config. The config watcher keeps the last good config instead of publishing a rejected one (covered by existing watcher and server tests).

Deliberate scope decision to flag: a list key holding valid YAML that is not a list (for example 'statuses: To Do') keeps today's behavior of leaving the key unset and falling back to defaults, rather than becoming a hard error. Making that an error would change behavior for configs that parse successfully today, so it is left for an explicit product decision.

Two existing tests wrapped filesystem.parseConfig and counted attempts after calling through; they now count before, because a rejected value throws instead of returning (src/test/config-watcher.test.ts, src/test/server-tasks-spa-fallback.test.ts).

Validation: bunx tsc --noEmit clean, bun run check . clean, bun run test 2062 pass / 6 skip / 0 fail.

Review round on PR #877 (head 3ac4b1c1) returned one blocking finding, fixed in a follow-up commit on the same branch.

Blocking finding: extractConfigKeyYaml matched the key with a leading-whitespace-tolerant pattern and took the last match, so a look-alike line nested inside ANOTHER key's value silently outranked the real top-level key. Two reproductions on fully valid YAML that main parses correctly: 'statuses: [top]' followed by 'meta_thing:\n  statuses: [nested1, nested2]' returned the nested values, and 'statuses: [real]' followed by 'notes_thing: |\n  statuses: [fake]' let the line inside the literal block scalar win. Both were silent wrong values on currently-valid configs, violating the backward-compat invariant.

Fix: a config key belongs at column 0, so an unindented match now always outranks an indented look-alike; the last column-0 match wins, and indented matches are used only when the key appears nowhere at column 0. That fallback keeps a key that exists only as an indented line (tab- or space-indented) readable, which is how it parses on main.

Evidence: the parse matrix was extended to 51 cases with the two reproductions plus deep-nested, folded-scalar, block-sequence-top-key, malformed-nested-look-alike, and tab/space-indented-key-only controls, and captured against origin/main and this branch. Pre-fix the branch regressed six valid-config rows (both reproductions, the folded-scalar variant, block-sequence top key, default_assignee nested look-alike, and a valid top-level key made unreadable by a malformed nested look-alike). Post-fix all six match origin/main exactly. The remaining matrix diffs are only the intended fail-fast rows plus one accepted strictness row: a key present ONLY as an indented look-alike now reads its value as YAML instead of a comma split, so 'something:\n  labels: ["a, b"]' yields ["a, b"] rather than ["a", "b"].

New regression test 'reads the config key at column 0, not an indented look-alike inside another key's value' in src/test/config-commands.test.ts covers both reproductions, the block-sequence and malformed-look-alike variants, and the tab/space-indented controls. Confirmed non-vacuous: reverting only the column-0 rule fails it (received ["nested1","nested2"] instead of ["top"]); restoring turns it green.

Also rebased onto origin/main after #875 (shared no-cache parseFrontmatter wrapper) and #876 merged. One conflict, in src/file-system/operations.ts: #875 had migrated the old whole-document parseConfigListValues to parseFrontmatter, and this task deletes that method outright, so the deletion stands; the surviving definition_of_done parse uses parseFrontmatter, and no module outside src/markdown/frontmatter.ts imports gray-matter.

Validation on the final head: bunx tsc --noEmit clean, bun run check . clean (369 files), bun run test 2076 pass / 6 skip / 0 fail across 223 files. The earlier note's 2062 figure predates the rebase; upstream test additions account for the difference.

Second review cycle (Codex, 8 P2 threads on PR #877). Triaged each against origin/main before believing it.

Fixed (5) MCP startup prefix: src/commands/mcp.ts printed 'Failed to start MCP server: Backlog could not start because ...', so the required phrase was not at the start. Config value errors are now printed as written.

Fixed (6) MCP fallback root: upgradeToProject loaded the config after reinitializing to a candidate root, so a rejected value escaped, aborted the whole roots loop at the outer catch, and left the server pointed at the bad root with fallback registrations. It now restores the previous root, logs the skip, and continues with the remaining roots, exactly like the existing no-config branch. New test in src/test/mcp-roots-discovery.test.ts; confirmed non-vacuous (without the fix the client sees tools: []).

Fixed (7) bare CLI: bare 'backlog' and 'backlog --plain' caught the error in the pre-dispatch probe and printed 'This directory is not initialized for Backlog.md.' with exit 0, actively misdiagnosing an initialized project. Config value errors now print and exit non-zero.

Fixed (8) Core.ensureConfigLoaded: it suppressed the error, so 'draft list --plain' with no drafts took its empty-list fast path and exited 0 with 'No drafts found.'. It now rethrows config value errors and still suppresses the recoverable git-configuration failures it exists for.

Fixed (1) YAML aliases: a valid config that defines an anchor under one key and aliases it from another ('statuses: &workflow [To Do, Done]' with 'labels: *workflow') aborted every command with 'Unresolved alias', because an alias only resolves against the whole document. When a key's own block is rejected, the value is now read once more in document context before it counts as broken; the document is never read first, so cross-key isolation is preserved and genuinely malformed values still fail fast. Verified against origin/main: the alias shapes now match it exactly.

Refuted (2) quoted keys: origin/main also ignores '"statuses": [...]'. Its whole-document parse did contain the key, but parseConfig's switch is driven by the raw line key ('"statuses"' including quotes), which matches no case, so the value was never assigned. Probed both heads: main and this branch both fall back to default statuses for quoted, single-quoted, and malformed-quoted keys. No behavior change, nothing to fix.

Mostly refuted (3) key-like text in scalars: four of the five shapes probed (inline DoD item text, indented literal block scalar, block sequence item text, onStatusChange block scalar) behave identically on both heads, because the column-0 rule from the previous round already outranks indented look-alikes. One exotic shape does diverge: a multi-line double-quoted flow scalar whose continuation sits at column 0 and begins with a list-key name ('definition_of_done: ["run' / 'statuses: fake"]') lets that line hijack the real key, so statuses falls back to defaults where main returned the configured list. Not patched: distinguishing a column-0 line inside another key's multi-line scalar requires tracking YAML scalar state, i.e. growing the line extractor into a YAML parser. The alternative is a document-parse-first design with per-key isolation only on document failure, which would fix this and honor quoted keys but changes several other shapes; escalated as a design decision rather than patched.

Reported, not decided (4) watcher wrong-type shapes: measured both heads with a live watcher. On origin/main, 'default_assignee: {name: "@alice"}' and 'default_assignee: 42' publish nothing and the cached ['@alice'] is retained. On this branch the candidate is published with defaultAssignee undefined, so the configured assignee is silently dropped at runtime. This is the direct effect of removing the watcher's per-line assignee shape check; it belongs to the wrong-typed-config question already escalated to the owner. Restoring the two-line check would return exact main parity at the cost of duplicating the rule.

Rebased onto origin/main again (BACK-603 #878) with no conflicts. The 51-case parse matrix is unchanged by this round; against main the only remaining diffs are the intended fail-fast rows plus the two documented strictness rows.

Coordinator dispositions applied.

Finding (4) watcher wrong-type: restored exact main parity. Rather than reinstating the deleted value-level YAML shape parser, the check now uses the declared-but-unset idiom the neighbouring definition_of_done check in the same function already uses: 'if (key === "default_assignee" && config.defaultAssignee === undefined) return false'. That is one line, no duplicated parsing, and equivalent to main by construction — a value YAML rejects never reaches the check because parseConfig throws first, and a value YAML reads but the key cannot hold leaves the key unset, which is precisely the set main rejected. Comment marks it as pending the owner's wrong-type decision so it is easy to remove. Verified with a live watcher on both heads: 'default_assignee: {name: "@alice"}' and 'default_assignee: 42' publish nothing and retain the cached ['@alice']. The existing config-watcher test covering malformed inline assignee edits was extended with both wrong-typed shapes and renamed; confirmed non-vacuous, since reverting the one line makes it time out waiting for re-read attempts because the candidate is published on the first parse.

Finding (3) exotic shape: accepted as a documented limitation, no code change. The PR body now names it precisely (a column-0 continuation line of a multi-line quoted flow scalar beginning with a list-key name), bounds it (only quoted multi-line flow values; indented look-alikes, literal and folded block scalars, block sequence items and nested mappings are all handled), and states why it is out: separating a real top-level key from a column-0 line inside another key's multi-line scalar needs YAML scalar-state tracking, i.e. growing the extractor into a YAML parser, which the project's simplicity rules reject for a shape saveConfig never writes.

Validation: bunx tsc --noEmit clean, bun run check . clean, 51-case parse matrix unchanged, targeted batch of the ten touched test files 154 pass / 0 fail. Local full-suite runs remain unreliable on this machine because concurrent agent suites saturate it and starve the filesystem-watcher tests; CI's clean-runner full suite across Linux, macOS and Windows is the authoritative signal.

Final authorized patch round: block-boundary detection.

Regression fixed: extractConfigKeyYaml only recognized identifier-character key lines as block boundaries, so a top-level key whose name uses other characters did not end the previous key's block. A config like 'statuses: [Queued, Done]' followed by 'custom-setting: ["bad]' folded the malformed line into the statuses block, and startup aborted blaming statuses — a valid key the user cannot fix by editing it. Reproduced on both heads before changing anything: origin/main tolerated all these configs (its line fallback ignored the unknown key) while the branch threw for hyphenated, dotted, quoted and digit-leading key names.

Fix: broadened only the boundary pattern to /^\s*(?!-\s)[^\s#][^:]*:/ so any mapping key line ends the previous block regardless of the characters in its name. Key selection still targets only the five list keys, so the malformed unknown key is simply ignored exactly as main ignores it — confirmed, those configs now load with statuses correct. The negative lookahead matters: a sequence item is not a key even when its text contains a colon, and without it a same-indent item such as '- "a: b"' would have cut the block short.

Interaction with the round-2 document-context retry confirmed: after the fix the isolated statuses parse succeeds, so the retry is not reached and no error is raised for the unrelated key. A genuinely malformed statuses value beside a malformed unknown key still fails fast naming statuses.

Verification: a 14-case risk probe covering same-indent and indented sequence items with colons, definition_of_done items containing colons, indented flow continuations, comment and blank lines inside blocks, colon-bearing onStatusChange and date_format values, block-sequence default_assignee, and nested mappings under unknown keys — all 14 match origin/main except the already-documented multi-line-quoted-scalar shape, which is unchanged. The 51-case parse matrix is unchanged, the findings 1-3 shapes probe is unchanged, and the unindented-continuation strictness is unchanged.

Two differences from main worth recording, both in already-accepted families: with a malformed unknown key present, quoted commas in another list key are now read as YAML rather than comma-split (['a, b'] instead of ['a','b']), and where the affected key used a block sequence main silently fell back to default statuses while the branch now returns the configured value.

New regression test 'does not blame a valid list key for a malformed value under a key Backlog does not read' covers four unread key spellings, the block-sequence variant, the still-fails-fast case, and the colon-bearing sequence item. Confirmed non-vacuous: reverting only the pattern reproduces the reported ConfigValueError blaming statuses.

Validation: bunx tsc --noEmit clean, bun run check . clean, targeted batch of the ten touched test files 155 pass / 0 fail.

Fourth review round: config-error propagation class sweep.

Findings 13 and 14 reproduced exactly. 'draft promote draft-1' exited 0 printing 'Draft draft-1 not found.' while the draft was still on disk, because promoteDraft's catch converted the propagated ConfigValueError to false. 'draft archive draft-1' printed the right message and exited 1 but had already moved the file: backlog/drafts lost the draft and backlog/archive/drafts gained it, so a retry would report it missing.

Finding 12 refuted per the stated criterion. For the compound shape (statuses anchor + labels alias + malformed custom-setting) origin/main produced statuses=default and labels=[], silently discarding both configured values rather than handling it correctly end to end. The coordinator's hypothesis of a literal '*workflow' string was not what happened: main's line fallback rejects both '&workflow [...]' and '*workflow' because neither starts with a bracket, so both keys were simply lost. The branch fails fast with a clear error whose named key can be the alias rather than the true offender, which is the already-accepted compound-diagnostics limitation.

Class sweep instead of static analysis. A hand-rolled enclosing-try analyzer proved unreliable (it missed promoteDraft's known catch), so the class was closed empirically: a runtime sweep runs every config-reading CLI surface against a malformed config, rebuilding a pristine fixture before each command and comparing a file-tree snapshot before and after, so both swallowing and mutate-then-validate ordering are visible. 40 surfaces covered across two passes.

The sweep found two members Codex had not reported: 'milestone add' created the milestone file before the config read, and 'milestone archive' moved the file before it. Both mutated then failed.

Four fixes, all minimal: promoteDraft now rethrows ConfigValueError alongside the existing create-lock rethrow; Core.archiveDraft and Core.archiveMilestone hoist the shouldAutoCommit config read above their file move; MilestoneHandlers.addMilestone calls ensureConfigLoaded before creating the file. Fixing archiveMilestone in Core rather than the handler covers the CLI and MCP surfaces in one place.

Verified safe without changes, from sweep evidence rather than reasoning: milestone rename and remove, task archive, task demote, task edit (status, title, ordinal, milestone), task create, draft create, doc create, decision create, doctor --fix, cleanup, config set, agents --update-instructions, and every read surface. 'doc list' and 'decision list' still exit 0 on a malformed config because they never read config at all; nothing is swallowed there, and adding a config read purely to make them fail would be scope creep, so they are recorded as out of class.

New regression test asserts all four fixed commands exit non-zero, carry the clear message, never say 'not found', and leave the backlog file tree byte-identical. Confirmed non-vacuous: reverting the core and handler changes fails it.

Validation: bunx tsc --noEmit clean, bun run check . clean, 51-case parse matrix unchanged, targeted batch 189 pass / 0 fail across 11 files plus 65 pass / 0 fail across the six milestone and draft lifecycle files, and both sweep passes now report PASS with no mutation for every config-reading surface.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All list config keys (statuses, labels, types, priorities, default_assignee) now parse through one shared strict YAML helper that reads each key's own block with Bun.YAML, replacing the textual comma/quote split and the whole-document parse whose failure silently degraded every list key. A value YAML rejects aborts with 'Backlog could not start because <config path> has an invalid value for "<key>": ...' instead of proceeding with a guessed value; loadConfig propagates it and cli.ts prints it without a stack trace. Verified with a 38-case parse matrix that is byte-identical for every valid config, identical 'config list' output against this repo's config, live checks that CLI, TUI, web server and MCP entry points all exit non-zero with the same message, new tests covering a malformed value for each of the five list keys plus cross-key isolation and a CLI exit-code check, and bun run test 2062 pass / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
