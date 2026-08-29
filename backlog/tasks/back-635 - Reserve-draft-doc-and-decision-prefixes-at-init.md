---
id: BACK-635
title: 'Reserve draft, doc, and decision prefixes at init'
status: Done
assignee:
  - '@grok'
  - '@claude'
created_date: '2026-08-15 14:00'
updated_date: '2026-08-29 18:07'
labels: []
dependencies: []
priority: medium
ordinal: 270000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the PR #916 (BACK-634) review and a matching Codex finding. backlog init --task-prefix accepts letters-only values including 'draft', 'doc', and 'decision', which collide with the hard-coded system prefixes (DRAFT- for drafts in backlog/drafts/, doc-/decision- for documents and decisions). A project initialized with --task-prefix draft stores regular tasks as DRAFT-n: the web server's prefix-routed draft handling (and MCP task_edit, which has preferred the draft store for DRAFT- ids since #430) then misroutes those tasks, and creating one real draft guarantees ID collisions across tasks/ and drafts/. Task prefix is init-only, so validation at init is sufficient: reject the reserved prefixes (case-insensitive) with a clear error. Verified empirically during the #916 review: such a project loses web GET on its tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog init rejects draft, doc, and decision (case-insensitive) as --task-prefix and wizard values with a clear error
- [x] #2 Existing projects with a reserved prefix are unaffected at runtime (no new failures beyond current behavior); doctor mentions the misconfiguration
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep a single reserved-prefix check in src/utils/prefix-config.ts (draft, doc, decision; case-insensitive) and reuse it from the init wizard, --task-prefix flag, and initializeProject so CLI and browser init fail the same way.
2. Do not fail existing reserved-prefix projects at runtime. Re-init keeps existing prefixes. Doctor reports the collision and refuses --fix so duplicate repair cannot allocate into the colliding draft/doc/decision store.
3. Document reserved names in public init help (commander option plus input schema). Replace doctor copy that tells users to re-init or otherwise do something that cannot work.
4. Add/keep tests for: flag rejection (case-insensitive), shared initializeProject rejection, doctor mention, doctor --fix no-op, runtime commands still working on a reserved-prefix project, init --help listing reserved names.
5. Rebase onto current main so cli.ts picks up BACK-626/BACK-638 without changing reserved-prefix behavior. Run tsc, biome on touched files, and scoped tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC1: added isReservedTaskPrefix()/RESERVED_TASK_PREFIXES to src/utils/prefix-config.ts (also extracted DOC_PREFIX/DECISION_PREFIX constants, reused by getPrefixForType). Applied the check case-insensitively in both --task-prefix flag validation and the interactive init wizard's clack.text validate callback in src/cli.ts, with a clear error naming the reserved-for reason. No dedicated PTY test exists for the pre-existing letters-only wizard validation either, so wizard coverage relies on the shared, unit-tested isReservedTaskPrefix() helper plus code inspection rather than a new PTY harness - consistent with existing test-suite scope for this interactive prompt.

AC2: doctor now loads config.prefixes.task and, if it collides with a reserved prefix, prints a clear warning and sets exitCode 1 (independent of duplicate-ID findings); "No duplicate task, document, or decision IDs found." is suppressed in that case so the warning isn't masked. No other runtime behavior was touched for existing reserved-prefix projects - misrouting stays exactly as before, per AC2's "no new failures beyond current behavior."

Verification:
- New tests: src/test/prefix-config.test.ts (isReservedTaskPrefix unit tests), src/test/cli-init-create.test.ts (6 cases: draft/DRAFT/doc/Doc/decision/DECISION rejected via --task-prefix, config.yml not created), src/test/cli-doctor.test.ts (doctor mentions the reserved-prefix collision).
- git-stash fail/pass: stashing src/cli.ts + src/utils/prefix-config.ts reproduces the exact pre-fix failure (8 fail, including a module-load error for the missing isReservedTaskPrefix export); popping the stash makes all pass again.
- bunx tsc --noEmit: clean.
- bunx biome check on all touched files: clean. bun run check . reports 6 pre-existing errors in unrelated files (src/server/index.ts, src/ui/board.ts, src/ui/components/task-composer.ts) - confirmed present on unmodified main via git stash, untouched.
- Full suite: bun test --timeout=10000 -> 2348 pass / 6 skip / 1 fail / 243 files. The sole fail (Config commands > reads the config key at column 0...) is the same pre-existing, unrelated YAML-parsing flake in config-commands.test.ts confirmed in the prior BACK-630 session.

Addressed Codex PR review (PR #928): moved reserved-prefix validation into initializeProject so the browser init path is covered too; documented reserved names in --task-prefix help; fixed doctor's impossible re-init recovery text; blocked 'doctor --fix --yes' automatic repair when the prefix is reserved.

Follow-up on PR #928 after rebase onto current main:
- Shared getTaskPrefixError() across the init wizard, --task-prefix flag, and initializeProject (CLI + browser).
- Documented reserved names in the init help schema as well as the commander option.
- Doctor copy no longer suggests re-init; doctor --fix --yes returns without renaming files. task list still succeeds on an existing reserved-prefix project.
- Scoped tests: prefix-config, cli-init-create, cli-doctor, enhanced-init, server-init. bunx tsc --noEmit and biome on touched files passed.

Maintainer takeover of PR #928 (contributor jafigueroam94), rebase check + review pass on top of main @ 40482ca0:
- prefix-config.ts: kept isReservedTaskPrefix/getTaskPrefixError as the single source of truth, but un-exported RESERVED_TASK_PREFIXES, DOC_PREFIX, and DECISION_PREFIX (no external consumers) and trimmed the JSDoc, per the minimal-API rule.
- init.ts: dropped the '!isReInitialization' guard so an explicitly requested taskPrefix is always validated. Previously a project whose config predates the prefixes field could be re-initialized with --task-prefix draft and have the reserved prefix written; existing prefixes are still preserved untouched because re-init never feeds them back through advancedConfig.
- server/index.ts: reserved prefixes now fail the browser init endpoint with 400 in the input-validation block instead of falling through to a 500 from the initializeProject throw. Web wizard surfaces the message either way.
- InitializationScreen.tsx: existing task-prefix hint now names the reserved values, matching 'init --help'.
- cli.ts: simplified the redundant flag-validation ternary and split the doctor warning into two readable lines.
- Tests: fixed a doctor assertion that checked a stale message string ('No duplicate task, document, or decision IDs found.' -> the current '... decision, or draft IDs found.'), tightened the server test to assert 400, and added re-init rejection coverage in enhanced-init.

End-to-end verification in a temp git project (bun src/cli.ts):
- init --defaults --task-prefix draft/doc/DECISION -> exit 1, clear error, no backlog/config.yml written.
- init --task-prefix JIRA -> succeeds, task_prefix: "JIRA", tasks created as jira-1.
- Re-init without the flag preserves JIRA; re-init with --task-prefix draft exits 1 and leaves the config untouched.
- Legacy project simulated with task_prefix: "draft": task list and task create still succeed (exit 0), doctor prints the collision warning and exits 1, doctor --fix --yes refuses without renaming files, re-init preserves the reserved prefix.
- init --help lists 'draft, doc, and decision are reserved' in both the commander option and the help schema.

Full-suite result on the final head (bun test): 2427 pass / 7 skip / 1 fail across 247 files.

The single failure is 'Config commands > reads the config key at column 0, not an indented look-alike inside another key's value'. It is NOT caused by this PR and is NOT a flake (the earlier note calling it an intermittent YAML flake was wrong - it reproduces deterministically when the file is run alone). Proof it is unrelated:
- Both the test (src/test/config-commands.test.ts) and the code it exercises (src/file-system/operations.ts, parseConfigListValue/parseConfig) are byte-identical to origin/main; 'git diff origin/main' on those two paths is empty.
- Nothing in this PR touches config parsing.
- Root cause is a Bun version difference, not a code regression: operations.ts parses config with Bun.YAML.parse, CI pins BUN_VERSION 1.3.14, and this machine runs bun 1.4.0. Bun 1.4 rejects tab-indented YAML ('Tab characters cannot be used as indentation'), so the test's tab-indentation control assertion fails. CI on main is green.

Separately, 'bun run check .' reports one formatter-only error in src/ui/components/task-composer.ts. That file is also byte-identical to origin/main and is outside CI's gate (CI runs 'bun run lint' = biome lint, not biome check). Left untouched to keep the diff scoped. Biome is clean on every file this PR touches, and 'bun run lint' is clean repo-wide.

Verification on the final head: bunx tsc --noEmit clean; bun run lint clean; scoped suites green (prefix-config, enhanced-init, server-init, cli-doctor, cli-init-create = 170 tests, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
backlog init now rejects draft, doc, and decision (case-insensitive) as a task prefix, so a project can no longer be created in the state where regular tasks are stored as DRAFT-/doc-/decision- IDs and are then misrouted by the web server and MCP as drafts, documents, or decisions.

One validator, getTaskPrefixError() in src/utils/prefix-config.ts, backs every entry point: the --task-prefix flag, the interactive init wizard prompt, the browser init endpoint (400), and initializeProject() itself, which enforces it for any caller. Reserved names are documented in both the commander option and the init help schema, and in the web wizard's task-prefix hint.

Existing projects that already carry a reserved prefix are left working exactly as before - task list, task create, and re-init all still succeed - because the prefix is only validated when it is explicitly requested and existing config prefixes are preserved untouched. backlog doctor reports the collision with a human-readable explanation and no false promise of an automated migration, exits 1, and refuses --fix so duplicate-ID repair cannot allocate an ID into the colliding draft/doc/decision store.

Verified end to end in a temp git project: reserved values rejected at exit 1 with no config.yml written; JIRA accepted and tasks created as jira-1; re-init preserves the prefix and rejects a reserved one; a simulated legacy task_prefix draft project still lists and creates tasks at exit 0 while doctor warns, exits 1, and --fix --yes renames nothing. Backed by unit and integration tests across prefix-config, enhanced-init, server-init, cli-doctor, and cli-init-create.
<!-- SECTION:FINAL_SUMMARY:END -->
