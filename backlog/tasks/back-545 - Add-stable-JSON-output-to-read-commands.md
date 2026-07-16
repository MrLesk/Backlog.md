---
id: BACK-545
title: Add stable JSON output to read commands
status: Done
assignee:
  - '@back545-agent'
created_date: '2026-07-13 16:06'
updated_date: '2026-07-15 17:55'
labels:
  - cli
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/784'
modified_files:
  - src/cli.ts
  - src/formatters/json-output.ts
  - src/utils/read-output-mode.ts
  - src/utils/read-output-mode.test.ts
  - src/test/cli-json-output.test.ts
  - README.md
  - CLI-INSTRUCTIONS.md
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-execution.md
type: enhancement
ordinal: 192000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide a documented, curated public JSON surface for task list, task view, and heterogeneous search without exposing internal TypeScript objects. The CLI remains the canonical interface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An explicit --json option is available on task list, task view, and search
- [x] #2 Successful JSON mode writes valid JSON only to stdout; errors use stderr and a nonzero exit code
- [x] #3 Plan review defines the stable public fields, envelope, and heterogeneous result discrimination before implementation
- [x] #4 Precedence with --plain, interactive behavior, and non-TTY behavior is documented and deterministic
- [x] #5 Output represents documented public semantics only and does not expose internal TypeScript objects
- [x] #6 Tests cover empty, single, multiple, heterogeneous, error, and shell-piping cases
- [x] #7 CLI help and user documentation describe the JSON contract and examples
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Approved public JSON contract:
1. Add --json to task list, task view, the task <id> shorthand, and heterogeneous search. Successful output is one pretty-printed JSON document plus a trailing newline on stdout.
2. Use schemaVersion 1 and command-specific envelopes with kind discriminators: task-list with tasks, task-view with task, and search with results. Backward-compatible fields may be added within version 1; breaking contract changes require a schemaVersion increment.
3. Use a fixed compact task summary projection for list and task search data. Task view extends it with curated task content. Fixed absent scalars serialize as null and absent collections as []. Do not expose internal TypeScript objects or internal-only fields.
4. Expose project-relative paths only. Normalize documented public dates, preserve Markdown body strings, and serialize checklist indexes, ordinals, and checked states with stable JSON types.
5. Search results discriminate task, document, and decision data and preserve rank order. Do not expose search scores in version 1.
6. Reject --json with --plain on stderr with exit code 1. Explicit --json is always noninteractive and bypasses TTY auto-plain behavior. Existing behavior remains unchanged when --json is absent.
7. In JSON mode, successful output is JSON only on stdout. Any validation, lookup, ambiguity, or runtime error leaves stdout empty, emits a concise human-readable message on stderr, and exits nonzero. There is no JSON error envelope in version 1.
8. Implement one minimal shared formatter and one shared output-mode resolver. Route existing list, view, shorthand, and search results through curated projections only in JSON mode. Do not add JSON to other commands or MCP.
9. Add focused tests for empty, single, multiple, heterogeneous, error, conflicting flags, non-TTY, deterministic ordering, shell piping, stdout/stderr separation, stable null and array semantics, and absence of internal fields.
10. Update CLI help and public user documentation with the contract, mode behavior, examples, and piping usage. Run focused tests, typecheck, Biome, full suite, and final diff simplification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex approved the version 1 JSON contract on 2026-07-15, including named envelopes, curated compact and full projections, fixed null and array semantics, project-relative paths, no public search score, strict output flag exclusivity, JSON-only stdout, and human-readable stderr errors.

Implemented the approved version 1 CLI JSON contract for task list, task view, task shorthand, and search. Added curated compact and full projections, project-relative task paths, stable null and array semantics, RFC 3339 UTC date-time normalization, heterogeneous search discrimination without scores, one shared output-mode resolver, JSON-only stdout, and nonzero stderr errors. Updated CLI help, README, CLI reference, and canonical agent guidance. Validation: 12 focused JSON/output-mode tests passed; 79 related CLI and regression tests passed; full suite passed with 1706 tests and 2 interactive TUI skips; bunx tsc --noEmit passed; bun run check . passed; git diff --check passed.

Post-rebase validation on origin/main at 9c29c4c9: 12 focused JSON/output-mode tests passed; full suite passed with 1717 tests and 4 interactive TUI skips; bunx tsc --noEmit passed; bun run check . passed.

Addressed specification review findings. Empty parsed descriptions now serialize as null while nonempty Markdown remains verbatim. Task-level --json is rejected before unsupported subcommand handlers, while list, view, and shorthand retain JSON support. Read output modes now use Commander-parsed options so tokens after -- remain literal search queries. Validation: 15 focused JSON/output-mode tests passed; 44 related CLI regression tests passed; full suite passed with 1720 tests and 4 interactive TUI skips; bunx tsc --noEmit passed; bun run check . passed; git diff --check passed.

Corrected heterogeneous search document paths to include the configured project-relative docs directory. Added default and custom backlog directory coverage. Validation: 16 focused JSON and output-mode tests passed; 30 adjacent CLI tests passed; full suite passed with 1721 tests and 4 interactive TUI skips; bunx tsc --noEmit passed; bun run check . passed; git diff --check passed.

Finalization validation on 2026-07-15: 16 focused JSON/output-mode tests passed, covering list, view, shorthand, empty results, heterogeneous search, conflicting flags, TTY behavior, unsupported commands, errors, shell piping, help, null semantics, Markdown preservation, and project-relative paths. bunx tsc --noEmit passed. bun run check . passed across 336 files. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a versioned, curated JSON output contract for task list, task view, task shorthand, and search. The implementation keeps the CLI canonical, avoids internal object exposure, documents deterministic output and error behavior, and is verified by 16 focused tests, the full 1721-test suite from the implementation pass, TypeScript, Biome, and diff checks.
<!-- SECTION:FINAL_SUMMARY:END -->
