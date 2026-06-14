---
id: BACK-507
title: CLI workflow guidance for agents and humans
status: Done
assignee:
  - '@codex'
created_date: '2026-06-13 14:12'
updated_date: '2026-06-14 14:58'
labels: []
milestone: m-7
dependencies: []
references:
  - README.md
  - CLI-INSTRUCTIONS.md
  - AGENTS.md
documentation:
  - src/guidelines/agent-guidelines.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/task-creation.md
  - src/guidelines/mcp/task-execution.md
  - src/guidelines/mcp/task-finalization.md
  - src/mcp/workflow-guides.ts
modified_files:
  - src/cli.ts
  - src/ui/root-entry.ts
  - src/ui/terminal.ts
  - src/guidelines/agent-guidelines.md
  - src/guidelines/agent-instructions.ts
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/cli-instructions/task-finalization.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/task-creation.md
  - src/guidelines/mcp/task-execution.md
  - src/guidelines/mcp/task-finalization.md
  - src/guidelines/mcp/resources.ts
  - src/guidelines/shared.ts
  - src/commands/help-schema.ts
  - src/agent-instructions.ts
  - src/index.ts
  - src/test/cli.test.ts
  - src/test/cli-root-entry.test.ts
  - src/test/cli-milestone-management.test.ts
  - src/test/agent-instructions.test.ts
  - src/test/help-schema.test.ts
  - README.md
  - CLI-INSTRUCTIONS.md
  - AGENTS.md
priority: high
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the `backlog` command the default entry point for both humans and agents. Generated instruction files should stay short and point agents to current CLI guidance, workflow guides should be available through public CLI commands, command help should include clear input schemas, and MCP should remain available as an optional connector.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog init` recommends CLI instructions for AI integration while preserving explicit MCP and no-AI choices.
- [x] #2 Generated agent instruction files use a short, idempotent CLI nudge that points to the CLI guidance entry point and preserves existing user content.
- [x] #3 Workflow guidance is readable through public CLI commands that are useful to humans and agents.
- [x] #4 Public command help includes text input schemas for required and optional fields without introducing a separate agent-only namespace.
- [x] #5 Errors for common invalid commands, options, fields, and values help agents self-correct by pointing to relevant help or accepted values.
- [x] #6 Existing MCP integration remains available and continues to expose the workflow guides.
- [x] #7 Documentation and tests describe CLI instructions as the default AI workflow and MCP as optional.
- [x] #8 `backlog instructions` output is CLI-specific and does not tell CLI-only agents to use MCP tools or `backlog://workflow/...` resources.
- [x] #9 New source and guide files required by tracked imports are included in the branch diff instead of remaining invisible as untracked files.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Approved Implementation Plan

## Direction

CLI instructions are the default AI integration path. MCP stays supported as an optional connector. Human and agent interactions should use the same public commands; do not add an agent-only namespace.

## Task Breakdown

1. BACK-507.1 - Shared workflow instruction registry and CLI access.
2. BACK-507.2 - Short agent nudge and init default migration.
3. BACK-507.3 - Text input schemas in public command help.
4. BACK-507.4 - Self-correcting CLI errors for agents and humans.
5. BACK-507.5 - Documentation and MCP compatibility updates.
6. BACK-507.6 - Root command local instruction hub.

## Implementation Principles

- Use Backlog MCP tools for task management; do not edit backlog markdown files directly.
- Reuse the existing workflow guide registry where possible instead of duplicating instruction content.
- Use Commander v14 already in the project; do not introduce a new CLI framework.
- Keep output per command rather than introducing a universal JSON envelope.
- Use text-only input schema help with fields such as String, Markdown, Integer, Boolean, Status, Task ID, docs-relative path, and project-root-relative path.
- Preserve existing user content and marker-based idempotency for generated instruction files.

## Verification

Run targeted tests for touched areas first, then `bunx tsc --noEmit`, `bun run check .`, and broader `bun test` when shared CLI behavior changes.

PR comment cleanup plan for review on commit 792883c:

1. CLI behavior worker: fix `src/cli.ts` task-list `--limit` semantics so limit is applied to the globally sorted/filtered list before status regrouping, and preserve `backlog --plain` root output. Add/adjust CLI tests for both regressions.
2. Help schema worker: stop advertising synthetic `Draft` where command status values reject it, while preserving `Draft` for task creation help. Add/adjust help-schema or CLI help tests.
3. Finalization instructions worker: update CLI finalization guide so it does not hard-code `Done`; it must point agents to configured statuses / configured terminal status and remain useful in rendered instruction output. Add/adjust instruction rendering tests if needed.
4. Coordinator: integrate subagent patches, run focused tests, then `bunx tsc --noEmit`, `bun run check .`, `bun run build`, and full `bun test`; push if clean.

Latest Codex review cleanup plan for commit 7f72eb3:

1. Preserve deterministic plain root output by passing an explicit color override to `printRootEntry` when root is invoked as `backlog --plain`; add/adjust a root-entry CLI test.
2. Update CLI task-execution guidance so it does not hard-code `In Progress`; instruct agents to inspect accepted statuses and use the configured active/in-progress status. Update rendered instruction tests.
3. Split the slow milestone removal CLI test into separate clear, keep, and reassign scenarios so `bun test src/test/cli-milestone-management.test.ts` stays under Bun's default per-test timeout.
4. Run focused tests, typecheck/check/build as needed, push, then verify/resolve all Codex review threads so PR #686 has no unresolved Codex comments.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the CLI instructions workflow and review fixes. `backlog instructions` serves CLI-specific guide content from `src/guidelines/cli-instructions`, while MCP resources/tools continue using the MCP guide files. Generated agent files use a short CLI nudge, `backlog init` defaults to CLI instructions while preserving MCP/no-AI choices, command help includes text input schemas, and common CLI errors point users toward help or accepted values.

Follow-up BACK-507.6 is complete. The root command now prints a plain local documentation entry point with the text logo restored, and `backlog instructions` prints a plain guide index by default. Guide-specific commands print guide markdown directly. A copy audit cleaned command output, generated nudges, guide markdown, README, CLI-INSTRUCTIONS, and task copy.

Reopened for latest PR review feedback. Four unresolved review threads found on the latest Codex review: task-list limit ordering, command-specific status help, configured terminal status wording in finalization instructions, and preserving `backlog --plain` root output. Fixes are being delegated to subagents with non-overlapping write ownership where possible.

PR #686 status-help review fix: split CLI status help so task create advertises Draft while task edit/list/search use exact configured active statuses. Verified with bun test src/test/cli.test.ts, bunx tsc --noEmit, bun run check ., and rendered help sanity checks.

Addressed PR #686 finalization-guide feedback: CLI finalization instructions now use the configured terminal status instead of a hard-coded Done command, with rendered-output assertions updated. Validation: bun test src/test/cli.test.ts -t "backlog instructions command" passes; bunx tsc --noEmit passes; focused Biome check on touched instruction files passes. Full bun run check . is currently blocked by a parallel formatting change in src/cli.ts.

Latest PR review cleanup complete. Helmholtz fixed root `--plain` and task-list limit behavior; Zeno fixed command-specific status help; Hegel fixed finalization guide wording. Coordinator normalized status values, reviewed the integrated diff, and validated with focused CLI tests, typecheck, build, Biome, diff check, and full test suite.

Reopened for the latest Codex review on commit 7f72eb3. Current actionable threads: root `--plain` should suppress color in TTY, task-execution guide should avoid hard-coded `In Progress`, and the slow milestone removal test should be split. User explicitly requested no remaining unresolved Codex comments, so after code fixes and push the review threads will be verified and resolved if still open.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the CLI-first workflow guidance surface for agents and humans while preserving MCP as an optional integration. The branch adds embedded CLI instruction guides, short generated agent nudges, public command help schemas, improved self-correcting CLI errors, root-command local guidance, CLI parity for milestone/document/task-list operations, and configured-prefix/status-aware examples.

Addressed PR #686 review feedback across multiple rounds: bare `backlog --plain` now remains deterministic and color-free in TTYs, task-list limits apply after global sorting/filtering before regrouping, command-specific status help no longer advertises invalid `Draft` values, finalization/execution guides avoid hard-coded statuses, milestone add honors auto-commit, generated instruction blocks migrate from old markers, label filtering is case-insensitive, and the slow milestone removal test was split into focused cases.

Validation passed: focused CLI/root/milestone tests, `bunx tsc --noEmit`, `bun run check .`, `bun run build`, `git diff --check`, and full `bun test`.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
