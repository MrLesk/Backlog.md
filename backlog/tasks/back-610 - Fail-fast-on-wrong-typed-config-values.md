---
id: BACK-610
title: Fail fast on wrong-typed config values
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-08 21:52'
updated_date: '2026-08-08 22:23'
labels: []
dependencies: []
ordinal: 249000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to BACK-606 by owner decision (Alex, 2026-08-08: "strict"). Wrong-typed but syntactically valid YAML config values, for example statuses: To Do (a scalar where a list belongs) or default_assignee: {name: "@alice"}, are currently silently ignored with defaults applied. They must instead abort startup with the same clear error shape BACK-606 established ("Backlog could not start because <file> has an invalid value for <key>: ..."). BACK-606 left two hooks for this: the return-undefined branches in parseConfigListValue in src/file-system/operations.ts become throws, and the interim parity check in src/utils/config-watcher.ts (marked with a pending-owner-decision comment) becomes removable because the parser then rejects wrong types for every surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A wrong-typed value for any list config key aborts startup with the "Backlog could not start because" error naming the key
- [x] #2 The config watcher rejects wrong-typed edits via the shared parser; the interim per-key parity check is removed
- [x] #3 Valid configs and the malformed-YAML error paths from BACK-606 are unchanged
- [x] #4 Tests cover a wrong-typed value per list key at startup and via the watcher
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In src/file-system/operations.ts, split the error builder so it can state a type problem as well as a YAML syntax problem: configValueError keeps the established 'Backlog could not start because <file> has an invalid value for "<key>": <problem>. <remedy>' shape, with the remedy matching the problem (valid YAML vs a YAML list).
2. Convert the return-undefined branches of parseConfigListValue into a throw naming the type: a scalar, number, boolean or mapping where a list belongs. Keep the two branches that are not wrong types: an explicit empty value (key: with no value) still leaves the key unset, and default_assignee still accepts a single scalar name.
3. Remove the interim parity check in src/utils/config-watcher.ts marked pending the owner decision, keeping the comment that explains why default_assignee is not in ARRAY_CONFIG_KEYS. The shared parser now rejects wrong types before the watcher's usability check, so the last good config is still retained.
4. Verify the 51-case parse matrix: byte-identical for every valid shape, with changes confined to the wrong-typed rows that are the point of this task. Report any other row that moves.
5. Spot-check entry points from the BACK-606 sweep table (a read, a mutation, bare CLI, mcp start) for the same prefix and non-zero exit on a wrong-typed value.
6. Tests: a wrong-typed value per list key at startup asserting the message names the key and the type problem, the default_assignee scalar and empty-value shapes still accepted, and a watcher test that a wrong-typed edit keeps the last good config through the shared parser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: the two hooks BACK-606 left, nothing else.

src/file-system/operations.ts. The error builder now takes a problem and a remedy so a type failure reads as sensibly as a syntax failure, with the same 'Backlog could not start because <file> has an invalid value for "<key>": <problem>. <remedy>' shape. configSyntaxError keeps the YAML wording ('Edit that key so its value is valid YAML'); configTypeError states the mismatch ('expected a list, got a scalar') and a matching remedy ('Edit that key so its value is a list'). default_assignee says 'a list or a single name' because a single name is its legacy spelling. The return-undefined branches of parseConfigListValue are now a single throw at the end, so the function returns undefined only for a key that is absent or explicitly empty.

Two branches deliberately kept, since they are valid rather than wrong-typed: 'key:' with no value still leaves the key unset (bare 'statuses:' still falls back to defaults, 'default_assignee:' still clears), and default_assignee still accepts a single scalar name. Numbers inside a list are still coerced to their written form rather than rejected.

src/utils/config-watcher.ts. The interim per-key parity check is removed along with its pending-decision comment; the comment explaining why default_assignee is not in ARRAY_CONFIG_KEYS is kept and updated. Proved the removal is safe rather than assumed: with the check removed the watcher test still passes, and with the parser change reverted while the check stays removed the same test fails ('Timed out waiting for invalid default_assignee read attempts'), so the shared parser is what now rejects wrong-typed edits and the last good config is still retained.

Matrix: the 51-case parse matrix moved on exactly three rows, all wrong-typed and all the point of this task — 'statuses: To Do', 'statuses: "To Do"' and 'statuses: {a: 1}'. The other 48 rows, valid and malformed-YAML alike, are byte-identical. The boundary, boundary-risk, compound and unindented-continuation probes from BACK-606 are unchanged except one row: the documented multi-line-quoted-scalar limitation now fails fast instead of silently falling back to defaults, because the hijacked line reads as a scalar. That is the strict ruling applied consistently, and it is a move from silent default to visible error.

Wrong-type coverage verified per key: scalar, mapping, number and boolean rejected for statuses, labels, types and priorities; mapping, number and boolean rejected for default_assignee, which still accepts a scalar.

Entry points spot-checked with a wrong-typed value ('statuses: To Do') against the BACK-606 sweep table: task list, board, config list, task create, draft promote, draft archive, bare backlog --plain and mcp start all exit non-zero, lead with the established prefix, carry the 'expected a list, got a scalar' detail, and leave the backlog file tree unchanged.

Validation: bunx tsc --noEmit clean, bun run check . clean, targeted batch 174 pass / 0 fail across 12 files.

Review disposition: Codex proposed rejecting explicit null (statuses: null / ~). Declined as reasoned no-change: null is the YAML spelling of absence, all no-value spellings stay uniformly valid-unset, matching main. Strictness applies to type confusion only.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wrong-typed but syntactically valid list config values now abort startup with the BACK-606 error shape instead of being silently ignored: parseConfigListValue's return-undefined branches became a single throw that names the mismatch ('expected a list, got a scalar'), and the interim per-key parity check in the config watcher was removed because the shared parser now rejects wrong types for every surface. Explicitly empty values and default_assignee's legacy single name stay valid. Verified with per-key wrong-type coverage at startup and through the watcher, a non-vacuity check proving the parser rather than the removed check does the rejecting, a 51-case matrix that moved on exactly the three wrong-typed rows and is byte-identical on the other 48, an eight-surface entry-point spot check confirming prefix, exit code and no mutation, and targeted tests 174 pass / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
