---
id: BACK-606
title: Fail fast with a clear error on malformed config list values
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-08 15:56'
updated_date: '2026-08-08 16:42'
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All list config keys (statuses, labels, types, priorities, default_assignee) now parse through one shared strict YAML helper that reads each key's own block with Bun.YAML, replacing the textual comma/quote split and the whole-document parse whose failure silently degraded every list key. A value YAML rejects aborts with 'Backlog could not start because <config path> has an invalid value for "<key>": ...' instead of proceeding with a guessed value; loadConfig propagates it and cli.ts prints it without a stack trace. Verified with a 38-case parse matrix that is byte-identical for every valid config, identical 'config list' output against this repo's config, live checks that CLI, TUI, web server and MCP entry points all exit non-zero with the same message, new tests covering a malformed value for each of the five list keys plus cross-key isolation and a CLI exit-code check, and bun run test 2062 pass / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
