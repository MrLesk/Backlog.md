---
id: BACK-583
title: Implement defaultAssignee
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 23:16'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/849'
priority: medium
type: bug
ordinal: 224000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #849. ADVANCED-CONFIG.md line 23 documents a `defaultAssignee` setting, but `config get` and `config set` reject it as an unknown key (src/cli.ts:4417-4420 and src/cli.ts:4630-4633) and no non-test code reads it. The setting is documented but entirely inert.

Most of the plumbing already exists: the type (src/types/index.ts:300), YAML parse and serialize (src/file-system/operations.ts:1504-1505 and src/file-system/operations.ts:1622), and the watcher key (src/utils/config-watcher.ts:33).

Maintainer decision: this is a bug in the implementation, not in the documentation. Implement the documented behavior rather than deleting the doc entry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog config get defaultAssignee` returns the configured value
- [x] #2 `backlog config set defaultAssignee <value>` stores the value
- [x] #3 `backlog config list` includes defaultAssignee
- [x] #4 `backlog task create` with no -a applies the configured defaultAssignee
- [x] #5 An explicit -a on `task create` overrides the configured defaultAssignee
- [x] #6 ADVANCED-CONFIG.md accurately describes the shipped behavior
- [x] #7 Tests cover both the apply and the override paths
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Make `defaultAssignee` a string list (`string[]`) in BacklogConfig, matching the documented `[]` default and the multi-assignee task model from BACK-576. Parse accepts a legacy scalar (`default_assignee: "@alex"`), inline arrays, and block YAML sequences; serialize writes an inline list and omits the key when empty.
2. Wire config get/set/list: add defaultAssignee to CONFIG_GET_KEYS, CONFIG_SET_KEYS, CONFIG_AVAILABLE_KEYS; get prints comma-joined values; set parses with the shared parseDelimitedStringList (comma-separated), storing undefined for an empty value so the key is removed; list prints the bracketed list.
3. Apply the default in core createTaskFromInput (same layer as defaultStatus and definitionOfDone defaults), not in the CLI: every create surface (task create, draft create, creation wizard, TUI composer, web POST /api/tasks, MCP task_create) already funnels through it, so one change gives uniform behavior. Empty/absent assignee input applies the default; any explicit assignee replaces it entirely (no merging).
4. Update ADVANCED-CONFIG.md so the row describes the shipped list behavior and add the set example.
5. Tests: config get/set/list round-trip, YAML scalar/list parse compatibility, create-with-default and explicit-override across CLI task create, draft create, and core; update the two existing tests that typed defaultAssignee as a string.
6. Verify: bunx tsc --noEmit, bun run check ., scoped test files, then full bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Placed the create-time default in core `createTaskFromInput` (src/core/backlog.ts), the same layer that already applies `defaultStatus` and the Definition of Done defaults. Every create surface funnels through that method — CLI `task create` and `draft create`, the creation wizard, the TUI composer (src/ui/board.ts, src/ui/unified-view.ts), the Web POST /api/tasks handler (src/server/index.ts), and MCP `task_create` (src/mcp/tools/tasks/handlers.ts) — so one change gives uniform behavior instead of per-surface wiring. Drafts get the default too: unlike status (forced to "Draft"), assignee has no draft-specific meaning.

Shape decision: `defaultAssignee` is now `string[]` rather than a single string. The doc already advertised `[]`, task assignees are a list, and keeping it a scalar would have re-created the BACK-576 defect where "@a,@b" is stored as one literal assignee. `parseConfig` still accepts the legacy scalar form (`default_assignee: "@alex"` becomes `["@alex"]`) plus inline arrays and block YAML sequences; `serializeConfig` writes an inline array and omits the key entirely when the list is empty.

Empty vs absent: at the CLI, `-a` is parsed by `parseDelimitedStringList`, so both an omitted flag and `-a ""` yield undefined and the default applies (same as labels). Any `-a` with real values replaces the default entirely — no merging. `config set defaultAssignee ""` stores undefined, which drops the key from config.yml, so new tasks start unassigned; this is documented in ADVANCED-CONFIG.md.

No change was needed in src/utils/config-watcher.ts: `default_assignee` is already a recognized key and is deliberately left out of ARRAY_CONFIG_KEYS so configs still using the legacy scalar form keep publishing live updates.

Also fixed a stale expectation in src/test/cli-guidance.test.ts, which asserts the literal `config set` key list in help output.

PR #867 review (Codex), three accepted findings fixed:

1. P1 instruction surface — with a configured defaultAssignee, omitting the flag now changes ownership, so agent-facing create surfaces say so. One clause each: the CLI task-creation guide (src/guidelines/cli-instructions/task-creation.md, Step 4 'Include' list), the `task create` help schema assignee entry (src/cli.ts), and the MCP `task_create` assignee property description (src/mcp/utils/schema-generators.ts). ADVANCED-CONFIG.md already documented it; these are the surfaces agents actually read.

2. P2 YAML escaping — serializing an assignee containing a double quote or backslash emitted invalid YAML. Now uses `JSON.stringify` per item, the same escape mechanism serializeConfig already uses for definition_of_done, rather than a bespoke one. Verified: `config set defaultAssignee '@a"b'` writes `default_assignee: ["@a\\"b"]` and round-trips through parse and task create.

3. P2 fail closed on malformed arrays — when both the YAML parser and parseInlineConfigList fail on a truncated array like `default_assignee: ["@a`, the legacy-scalar fallback used to reinterpret the raw text as a bracket-shaped assignee. Values starting with `[` are now rejected and the key is left unset, matching how the other list keys silently ignore malformed values; new tasks are created unassigned.

Tests added in src/test/config-commands.test.ts (escaped-assignee round trip through set/parse/create; malformed array yields undefined config and an unassigned task) and src/test/cli-guidance.test.ts (task-creation guide clause; the create help-schema assertion moved to the whitespace-normalized text so the longer description survives help wrapping).

Re-verified: bunx tsc --noEmit, bun run check ., config-commands + cli-guidance + mcp-server scoped runs, full bun run test (1955 pass, 5 skip, 0 fail).

PR #867 review round 2 (Codex), one accepted P2 fixed: the config watcher published a truncated inline `default_assignee` edit instead of retaining the last valid config, so a live half-written edit replaced a cached default with undefined. `default_assignee` stays out of ARRAY_CONFIG_KEYS (that check requires brackets unconditionally and would break legacy scalars and block sequences); instead `hasValidExplicitValues` now rejects only values that look like an inline array but do not parse as one.

The rule is shared, not duplicated: `parseInlineConfigList` moved from a private FileSystem method to a module-level export in src/file-system/operations.ts, and src/utils/config-watcher.ts imports it, so the watcher and the parser apply the identical 'starts with [ but malformed -> invalid' test. No import cycle: operations.ts imports neither config-watcher nor content-store.

Test added in src/test/config-watcher.test.ts covering all three paths through watchConfigFile: a truncated inline edit publishes nothing and leaves the cached defaultAssignee intact (proven by waiting for the read attempts to be exhausted, the same instrumentation the existing last-good-config test uses), then a legacy scalar edit reloads, then a valid inline array edit reloads. Confirmed the test fails on the unfixed watcher (the truncated content is published immediately and the attempt wait times out).

Re-verified: bunx tsc --noEmit, bun run check ., config-watcher + config-commands + filesystem scoped runs, full bun run test (1956 pass, 5 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the documented `defaultAssignee` setting work end to end. `config get/set/list` now accept it (added to CONFIG_GET_KEYS, CONFIG_SET_KEYS and the available-keys message), and the config value is a string list parsed with the shared `parseDelimitedStringList`, so `backlog config set defaultAssignee "@alice,@bob"` stores both names instead of one literal "@a,@b" assignee. The default is applied in core `createTaskFromInput`, the single create path shared by CLI task/draft create, the creation wizard, the TUI, the Web API and MCP, so every surface behaves the same: no assignee input applies the default, any explicit assignee replaces it entirely, an empty configured list leaves tasks unassigned. `BacklogConfig.defaultAssignee` changed from `string` to `string[]`; config parsing still accepts the legacy scalar form as well as inline arrays and block YAML sequences, and serialization omits the key when the list is empty. ADVANCED-CONFIG.md now describes the shipped list behavior and the override/clear semantics.

Verified with live CLI runs of all five behavior criteria in a scratch project (get/set/list, create with and without -a, draft create, legacy scalar and block-sequence configs), new tests in config-commands, core, cli-init-create and draft-create-consistency, plus bunx tsc --noEmit, bun run check ., and two full `bun run test` runs (1953 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
