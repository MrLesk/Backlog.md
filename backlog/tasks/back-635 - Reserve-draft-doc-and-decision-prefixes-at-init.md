---
id: BACK-635
title: 'Reserve draft, doc, and decision prefixes at init'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-15 14:00'
updated_date: '2026-08-20 22:44'
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
1. Add RESERVED_TASK_PREFIXES (draft, doc, decision) and isReservedTaskPrefix() to src/utils/prefix-config.ts; extract DOC_PREFIX/DECISION_PREFIX constants used by getPrefixForType.
2. Reject reserved prefixes (case-insensitive) in src/cli.ts: the --task-prefix flag validation and the interactive init wizard's clack.text validate callback, with a clear error message.
3. Add a doctor check: load config.prefixes.task and warn (clear message, exitCode 1) when it collides with a reserved prefix, without altering any other runtime behavior for existing projects.
4. Add regression tests: CLI test for init rejecting draft/doc/decision (case-insensitive) via --task-prefix, and a cli-doctor test asserting the new warning for an existing reserved-prefix project.
5. Run bunx tsc --noEmit, bun run check ., and the scoped/full test suite; finalize the task.
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
backlog init now rejects draft, doc, and decision (case-insensitive) as --task-prefix, both via the CLI flag and the interactive wizard prompt, using a new shared isReservedTaskPrefix() helper in src/utils/prefix-config.ts. Existing projects that already have a reserved prefix are untouched at runtime; backlog doctor now detects and clearly reports the misconfiguration (exitCode 1) instead of staying silent. Verified with new unit/CLI tests (prefix-config.test.ts, cli-init-create.test.ts, cli-doctor.test.ts), git-stash fail/pass confirmation, clean tsc/biome on touched files, and a full suite run (2348 pass, 1 pre-existing unrelated flake in config-commands.test.ts).
<!-- SECTION:FINAL_SUMMARY:END -->
