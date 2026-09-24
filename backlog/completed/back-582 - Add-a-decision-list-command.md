---
id: BACK-582
title: Add a decision list command
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 23:00'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/845'
priority: medium
type: enhancement
ordinal: 223000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #845. `backlog decision` exposes only `create` (src/cli.ts:4132-4155), so decisions can be written and searched but never enumerated. There is no way to answer "what decisions exist" from the CLI. `decision create --plain` also errors, even though the shipped agent guidance tells agents to always use --plain.

Maintainer direction to respect: bring docs and decisions operations toward task parity carefully and CLI-first. Do NOT add new MCP tools for this - MCP tools consume agent context windows - unless a tool is truly trivial.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog decision list` enumerates decisions
- [x] #2 `backlog decision list --plain` produces AI-friendly text output
- [x] #3 `backlog decision list --json` produces stable JSON output
- [x] #4 Listed output shows at least id, title, and status for each decision
- [x] #5 The new command is described in the CLI help schema
- [x] #6 Tests cover the new command
- [x] #7 Scope stays limited to list; a -d/--description option on `decision create` may ride along only if it is trivial
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add decisionListJson() to src/formatters/json-output.ts reusing the existing toDecisionSummaryJson helper, emitting { schemaVersion: 1, kind: "decision-list", decisions: [...] } to match taskListJson/searchJson envelopes.
2. Add a 'decision list' subcommand in src/cli.ts next to 'decision create': addHelpSchema with reads/optional(plain,json)/output/examples, --plain and --json options, and getReadOutputMode() so --json and --plain conflict is rejected the same way task list rejects it.
3. Output: JSON prints the versioned envelope (empty array when there are no decisions); text prints one row per decision as 'decision-1 - Title (status)' mirroring doc list rows plus task list's status suffix; empty text output prints 'No decisions found.' like doc list's 'No docs found.'. Statuses print as stored because decisions are free-form.
4. Load via core.filesystem.listDecisions() only; no identity/duplicate changes (BACK-580 owns fail-closed identity for docs/decisions).
5. Scope guards: no new MCP tools, no --status filter, no -d/--description on create (Decision has no description field; it would need a section mapping, so it is not trivial).
6. Tests: CLI plain/empty/status coverage in src/test/cli-doc-decision-board.test.ts and a versioned JSON envelope + --json/--plain conflict test in src/test/cli-json-output.test.ts.
7. Verify with bunx tsc --noEmit, bun run check ., scoped tests, then the full bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added `backlog decision list` in src/cli.ts next to `decision create`, plus `decisionListJson()` in src/formatters/json-output.ts.

Design choices:
- JSON reuses the existing `toDecisionSummaryJson` helper already used by `search --json`, so a decision has one public JSON shape (id, title, status, date) across commands. Envelope is { schemaVersion: 1, kind: "decision-list", decisions: [...] }, matching taskListJson/searchJson.
- Output mode goes through the shared `getReadOutputMode()`/`resolveReadOutputMode()` path, so `--json --plain` is rejected with the same message and exit code as task list/view and search.
- Text rows are 'decision-1 - Title (status)': doc list's 'id - title' row plus task list's '(status)' suffix. Statuses print exactly as stored because decisions accept free-form status values (parseDecision casts any string to the union type).
- Empty log prints 'No decisions found.' in text mode (mirroring doc list's 'No docs found.') and an empty decisions array in JSON mode (mirroring the empty task-list/search envelopes).
- No interactive picker: unlike doc list there is no `decision view` command to open, so an interactive select would be a dead end and would need its own decision-file lookup. Text output therefore covers both --plain and TTY runs; --plain is still accepted so agent guidance that always passes --plain works.

Scope guards honored:
- No new MCP tools.
- No --status filter (not required; decisions are few and statuses are free-form, so a filter would add surface without a proven need).
- No -d/--description on create: Decision has no description field, only Context/Decision/Consequences/Alternatives sections, so mapping a description would require picking a section - not trivial, so it was left out per AC #7.
- No identity/duplicate-ID changes; listing uses core.filesystem.listDecisions() as-is, so duplicate decision IDs surface as separate rows rather than being silently collapsed. BACK-580 still owns fail-closed identity for docs/decisions.

Left unchanged: `decision create --plain` still errors on the unknown option. That is outside this task's acceptance criteria (scope is list).

Follow-up accepted by the coordinator as AC-adjacent in-scope work (issue #845 reported it as the sharp edge): `backlog decision create` now accepts `--plain` instead of failing with "error: unknown option '--plain'". Shipped agent guidance tells agents to always pass --plain, so the error was a guidance/CLI contradiction.

- Mirrors the `task create --plain` shape: a plain output-mode flag on the create command, declared with `.option("--plain", ...)` and listed in the command's help schema.
- Behavior is accept-and-proceed rather than a second output format. `decision create` already prints one plain line ('Created decision decision-1') with no color or interactive UI, and there is no `decision view`/`formatDecisionPlainText` to render a created record with, so inventing a decision detail format here would have added surface the task did not ask for. A code comment records why the flag is accepted.
- `decision create` also gained the help schema and descriptions it never had (title, status, plain, writes, output, example); previously `backlog decision create --help` showed a bare undescribed `-s, --status`.

Test added in src/test/cli-doc-decision-board.test.ts: create with --plain exits 0, writes no stderr, prints exactly 'Created decision decision-1' with no ANSI escapes, and the decision is persisted.

Re-verified after this change: bunx tsc --noEmit clean, bun run check . clean, cli-doc-decision-board + cli-guidance + cli-json-output green (47 pass), full bun run test 1972 pass / 5 skip / 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `backlog decision list` so decisions are enumerable from the CLI, not just writable and searchable, and made `backlog decision create` accept `--plain` instead of erroring on it (issue #845's sharp edge, accepted by the coordinator as AC-adjacent).

decision list: text mode prints 'decision-1 - Title (status)' rows (doc list row shape plus task list's status suffix, statuses shown exactly as stored since decisions are free-form) and 'No decisions found.' when empty; --json prints { schemaVersion: 1, kind: "decision-list", decisions: [...] } built from the same toDecisionSummaryJson helper that search --json already uses. Output mode resolution reuses getReadOutputMode, so --json --plain is rejected identically to task list/view and search. decision create: --plain is accepted as an output-mode flag mirroring task create; create output was already a single plain line, so the flag ends the guidance/CLI contradiction without inventing a decision detail format. Both commands are now described in the CLI help schema. Scope stayed on list plus that accepted create fix: no MCP tools, no status filter, no identity changes (BACK-580 owns that).

Verified with bunx tsc --noEmit, bun run check ., and bun run test (1972 pass / 5 skip / 0 fail), including new coverage in src/test/cli-doc-decision-board.test.ts (create --plain, plain rows, non-TTY default, empty log in both modes) and src/test/cli-json-output.test.ts (versioned envelope, --json/--plain conflict, help documents --json).
<!-- SECTION:FINAL_SUMMARY:END -->
