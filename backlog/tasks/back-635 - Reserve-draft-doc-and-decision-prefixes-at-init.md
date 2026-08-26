---
id: BACK-635
title: 'Reserve draft, doc, and decision prefixes at init'
status: In Progress
assignee:
  - '@grok'
created_date: '2026-08-15 14:00'
updated_date: '2026-08-26 21:39'
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
- [ ] #1 backlog init rejects draft, doc, and decision (case-insensitive) as --task-prefix and wizard values with a clear error
- [ ] #2 Existing projects with a reserved prefix are unaffected at runtime (no new failures beyond current behavior); doctor mentions the misconfiguration
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
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
<!-- SECTION:NOTES:END -->
