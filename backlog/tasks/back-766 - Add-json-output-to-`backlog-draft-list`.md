---
id: BACK-766
title: Add --json output to `backlog draft list`
status: Done
assignee:
  - '@codex-766'
created_date: '2026-10-14 18:17'
updated_date: '2026-10-19 09:47'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1100'
  - src/cli.ts
  - src/formatters/json-output.ts
  - src/utils/list-window.ts
  - src/test/cli-json-output.test.ts
  - src/test/cli-list-window.test.ts
  - 'https://github.com/MrLesk/Backlog.md/pull/1104'
modified_files:
  - CLI-INSTRUCTIONS.md
  - README.md
  - backlog/tasks/back-766 - Add-json-output-to-`backlog-draft-list`.md
  - src/cli.ts
  - src/formatters/json-output.ts
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/test/cli-json-output.test.ts
  - src/test/cli-list-window.test.ts
  - src/test/cli-decision-archive.test.ts
  - src/test/cli-doc-restore-delete.test.ts
  - src/test/cli-missing-storage-directories.test.ts
  - src/test/cli-refs-docs.test.ts
  - src/test/cli-released-id-draft-links.test.ts
  - src/test/linked-record-commit.test.ts
  - src/test/malformed-task-dependencies.test.ts
  - src/test/mcp-document-restore-delete.test.ts
  - src/test/vacated-task-references.test.ts
ordinal: 386000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scripts and agents that triage drafts must parse `draft list --plain` text, because `draft list --json` fails with "unknown option" while `task list --json`, `search` and `decision list` return versioned JSON. Issue #1100 tracks the request; every other list command already has the paging options, so JSON is the remaining gap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog draft list --json` prints a versioned JSON envelope of drafts, ordered like the plain output
- [x] #2 `--sort`, `--max-count` and `--skip` apply to the JSON output, which adds total and nextSkip only when the list is cut
- [x] #3 `--count` is rejected together with `--json`, and an empty draft list prints an empty JSON list
- [x] #4 Help schema, CLI-INSTRUCTIONS.md and shipped instruction guides document the option
- [x] #5 CLI tests cover JSON output, sorting, windows, the empty case and invalid combinations
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check . passes when formatting/linting touched
- [x] #2 bun test (or scoped test) passes
- [x] #3 bun run check:types passes when TypeScript touched
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify PR #1104 against the accepted issue #1100 contract and existing task/decision JSON formatting, list windows, and draft loading.
2. Restore the saved static cleanup and integrate main at d63c722d08ad12eee6aec21805431c377bdcc077 while preserving contributor ancestry and the protected BACK-767 branch. Keep the nine unrelated test files identical to current main.
3. Reuse the compact projection, draft-list envelope, list-window helper, and existing draft-folder behavior. Repair only concrete task-scoped defects; keep the ordered modified-file list current.
4. With Alex's approval to run contributor code, run focused JSON/list/paging regressions, bun run check:types, Biome, build, relevant broader tests, and built CLI proof. Record actual results.
5. Pause for the coordinator's full-context architecture and complexity review before finalization. Apply only agreed findings, finalize the task record, and prepare a final reviewed commit without merging.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Accepted issue #1100 contract: draft list --json emits schemaVersion 1, kind draft-list, and drafts. Entries share the compact task projection and omit isReady, body fields, and internal data. The existing draft loader, sortTasks, resolveListOutput, selectListWindow, and cutListJson remain the owners of loading, ordering, option validation, paging, and cut metadata. Plain and JSON use the same storage behavior.

Maintainer repair preserved contributor a5d2ec4877c5a017888a30946e8477786c72d45a and integrated main through merges 4b836a99 and b0ed4377 (main d63c722d08ad12eee6aec21805431c377bdcc077). Nine unrelated formatting-only test diffs were restored byte-for-byte to current main. The net feature diff is nine source, test, documentation, and task paths. The saved takeover stash eb7845189d824553879190516afe030ebde9bf8c is retained. BACK-767 and unrelated stashes were left unchanged. The task was reopened before this verification; earlier contributor completion claims were not treated as current evidence.

Alex explicitly approved local contributor code execution and CI on 2026-10-19. Focused validation passed: bun test --timeout=10000 src/test/cli-json-output.test.ts src/test/cli-list-window.test.ts (35 tests, 285 assertions). Canonical checks passed: bun run check:types (567 files), bun run check . (462 files, no fixes), and bun run build.

Full CI-profile verification used the built CLI bundle with --profile=full --parallel=2 --isolate --timeout=10000 --max-concurrency=2. With TERM=xterm-256color, the non-DOM pass returned 3159 pass, 13 skip, 0 fail across 280 files; the DOM pass returned 399 pass, 0 fail across 39 files. Total: 3558 pass, 13 skip, 0 fail. Log: /private/tmp/back-766-full-tests-terminal.log. The recently merged #1050 acceptance-check and #1091 frontmatter-preservation regressions passed. No source or test changes occurred between contextual review and verification.

The initial full run under inherited TERM=dumb had one archived-document PTY assertion failure. The exact test failed identically against published v1.54.0, and passed when TERM=xterm-256color was supplied. Logs: /private/tmp/back-766-pty-current.log, /private/tmp/back-766-pty-published.log, and /private/tmp/back-766-pty-terminal.log. The corrected full run changed only TERM; no unrelated code or test repair was made.

Compiled CLI proof passed 78 commands in /private/tmp/back-766-built-proof.json. It verifies the exact compact fields and defaults; omitted readiness/body/internal fields; default, priority, ID, and ordinal sorting; first, last, past-end, and uncut windows; conditional total/nextSkip; invalid output/sort/window flags; help schema; and unreadable draft-storage parity. Twenty plain-output cases match published v1.54.0 byte-for-byte.

Acceptance evidence: AC1 is covered by the versioned envelope/default order/plain parity tests and compiled proof. AC2 is covered by sorting/window regressions and the compiled paging matrix. AC3 is covered by empty envelopes and conflicting count/JSON tests. AC4 is covered by CLI help tests and the reviewed CLI reference, README, and shipped guides. AC5 is covered by the passing JSON/list-window suites. All three Definition of Done items are supported by the passing canonical checks and test results above.

Subtraction and contextual architecture review: KEEP, no findings or change recommendations. The common compact projection prevents duplication; task summaries add isReady in their existing wrapper; the draft envelope maps directly. Nine unrelated diffs were removed. No services, configuration, new loading policy, or broader JSON surface were introduced. The coordinator accepted the six-question owner/reuse, removal, coherent design, junior safety, justified complexity, and remaining simplification evidence. No further task-scoped simplification was found. Final PR push, current-head CI/review gates, and merge remain with the coordinator; this task does not authorize a merge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added versioned JSON output to backlog draft list with shared compact fields, draft-specific omission of isReady, existing sort/paging behavior, and clear flag validation. Preserved contributor history, integrated current main, and removed nine unrelated formatting diffs. Verified 35 focused tests, the full CI profile (3558 pass, 13 skip, 0 fail under a normal terminal setting), canonical type/Biome/build checks, and 78 compiled CLI probes. Contextual architecture review returned KEEP. Final PR checks and merge remain with the maintainer.
<!-- SECTION:FINAL_SUMMARY:END -->
