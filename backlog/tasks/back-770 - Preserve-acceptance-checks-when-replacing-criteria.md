---
id: BACK-770
title: Preserve acceptance checks when replacing criteria
status: Done
assignee:
  - '@codex-1050'
created_date: '2026-10-18 08:05'
updated_date: '2026-10-18 08:10'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1050'
  - src/core/backlog.ts
  - src/utils/task-edit-builder.ts
  - src/cli.ts
  - src/mcp/utils/schema-generators.ts
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/mcp/task-execution.md
  - src/test/acceptance-criteria.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/server-acceptance-criteria.test.ts
modified_files:
  - src/test/acceptance-criteria.test.ts
  - src/core/backlog.ts
  - src/utils/task-edit-builder.ts
  - src/test/mcp-tasks.test.ts
  - src/test/server-acceptance-criteria.test.ts
  - src/cli.ts
  - src/mcp/utils/schema-generators.ts
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/mcp/task-execution.md
priority: medium
type: bug
ordinal: 390000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replacing a full acceptance-criteria list currently resets completed checks even when its text is unchanged. Issue #1050 reproduces this through the published CLI. Preserve completion by matching trimmed criterion text, including reordering and ordered duplicate matching. Alex approved unchecked defaults for reworded or removed checked entries without an override.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI full-list replacement preserves check states for matching trimmed text after unchanged or reordered submissions; duplicate matches consume old entries in order at most once.
- [x] #2 Unmatched or reworded replacement entries start unchecked, and explicit true or false values supplied by browser edits take priority.
- [x] #3 MCP acceptanceCriteriaSet shares the CLI replacement semantics, with focused regression coverage and public help or instructions describing the behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the existing shared mutation owner in Core.applyTaskUpdateInput; text-only CLI/MCP replacement entries omit checked so the core can preserve matching trimmed text from the current task under its existing lock. Consume matching old entries in order, including when a replacement supplies an explicit check value; unmatched entries default unchecked.
2. Keep browser explicit checked booleans authoritative and leave all incremental edit, clear, locking, and persistence behavior in the existing paths.
3. Extend focused CLI and MCP integration coverage for unchanged text, reordering, rewording, duplicates, and replacement composition; add focused browser API coverage for explicit true/false.
4. Describe full-list replacement in CLI help, MCP schema, and shipped execution guides: trimmed text matches retain checks, duplicate matches pair in order, reworded/new entries start unchecked, and omitted entries are removed.
5. Run focused tests, Bun 1.4.3 typecheck, Biome and build; reproduce the before/after with the actual changed CLI build in a temporary project. Inspect the final diff and simplify if useful.
6. Complete the required full-context architecture review, record its KEEP result, finalize proven task criteria, and commit the task-scoped files on the feature branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation is ready for coordinator architecture review; task remains In Progress and no commit has been made.

The shared core replacement path now consumes matching old entries by trimmed text in order, applies explicit checked booleans first, and defaults unmatched entries to unchecked. The CLI/MCP builder no longer supplies synthetic false check values or redundant indices. Existing browser, incremental editing, locking, and persistence paths stay in use. Public CLI help, MCP field schema, and shipped execution guides describe replacement behavior.

Validation (Bun 1.4.3): the new CLI regression first failed on unchanged-text replacement against the original code, then passed with this change. Focused suite passed: 130 tests, 0 failures, 828 assertions across acceptance-criteria, mcp-tasks, server-acceptance-criteria, atomic-task-edit, task-edit-preservation, mcp-server, and agent-instructions. bun run check:types passed for 566 files. bun run check . passed for 461 files with no fixes. bun run build and git diff --check passed. The initial browser-test attempt could not bind a local socket under the sandbox; the same suite passed with test socket access.

Compiled CLI evidence: /private/tmp/back-770-cli-evidence.json records dist/backlog preserving [true,true,false,true,true] through identical trimmed replacement, then producing [true,true,false,false,false] after reordering, one extra duplicate, rewording, and omission. Every edit exited 0 with empty stderr. /private/tmp/back-770-cli-evidence-published.json records the same commands against the installed published v1.54.0 binary: unchanged replacement resets all five checks. The proof uses CLI init/create/edit/view only, in separate temporary projects.

Simplification review: one existing shared mutation owner is sufficient; no new helper, layer, API, flag, or policy is needed. Full-context architecture review and final task/commit handling remain pending. The unrelated tasks/back-767-parallel-workflows ref still points to a017677fbb65daf954f9453b1320926d70604a25.

Full-context architecture review returned KEEP with no defects, advisory changes, or worthwhile task-scoped simplification. The coordinator presented this result to Alex and authorized finalization and the feature-branch commit. No source changes followed validation.

Acceptance evidence: AC1 is proven by the CLI regression for unchanged/reordered trimmed text and ordered duplicate consumption, plus compiled-binary proof. AC2 is proven by the same rewording/extra-duplicate CLI case, the mixed explicit-value duplicate test, and the browser PUT integration test showing explicit false clears an old true and explicit true checks an old false or new entry. AC3 is proven by the MCP task-edit integration test preserving the reordered Plan documented check and leaving New requirement unchecked, together with shipped CLI/MCP guidance and field help. All three DoD items are supported by the recorded passing typecheck, Biome check, and 130-test focused suite; the build also passed.

No further code changes or task-scoped follow-ups were required by review. Final task metadata is recorded before the commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed issue #1050: full acceptance-criteria replacements retain checks for matching trimmed text, including reordering and ordered duplicate matching. New or reworded entries start unchecked; explicit browser true/false values keep priority. CLI and MCP share the existing core behavior, documented in help and shipped guides. Verified with 130 focused tests, Bun 1.4.3 typecheck, Biome, build, and compiled CLI comparison against published v1.54.0. Full-context architecture review returned KEEP with no defects or worthwhile simplification.
<!-- SECTION:FINAL_SUMMARY:END -->
