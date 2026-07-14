---
id: BACK-507.12
title: Use required overview nudge and configured prefixes in CLI guidance
status: Done
assignee:
  - '@codex'
created_date: '2026-06-13 22:32'
updated_date: '2026-06-13 22:37'
labels: []
dependencies: []
modified_files:
  - src/guidelines/cli-agent-nudge.md
  - src/commands/help-schema.ts
  - src/commands/instructions.ts
  - src/mcp/workflow-guides.ts
  - src/cli.ts
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/cli-instructions/task-finalization.md
  - src/test/cli.test.ts
parent_task_id: BACK-507
priority: high
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the CLI agent nudge and shipped instruction/helper examples so external agents reliably load the workflow overview before deciding how to handle any user request, including informational task-status questions. Replace hardcoded task IDs in generated guidance/help examples with the current project task prefix so examples match each initialized project.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The CLI agent nudge tells agents to run `backlog instructions overview` before acting on any user request, not only before creating or working on tasks.
- [x] #2 Generated CLI instruction guides and public help examples use the current configured task prefix instead of hardcoded `TASK-` or `BACK-` task IDs where the example refers to local task IDs.
- [x] #3 Tests cover the strengthened nudge wording and configured-prefix example rendering.
- [x] #4 No unrelated workflow copy or command behavior changes are introduced.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the CLI nudge, instruction guide registry/rendering, and command help schema paths to find where hardcoded task IDs are emitted.
2. Add a small prefix-aware rendering helper that reads the configured task prefix for the current project and substitutes example IDs in shipped CLI guidance/help output.
3. Strengthen the agent nudge so every user request starts by running `backlog instructions overview` before deciding whether to inspect/search/create/update tasks.
4. Update focused tests for nudge wording and configured-prefix examples, then run scoped tests plus type-check and Biome.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Strengthened the CLI agent nudge so agents run `backlog instructions overview` before answering or acting on every user request, then use the overview to decide whether to search/read/create/update Backlog tasks. Removed the redundant `backlog instructions` list-guides bullet. Added prefix-aware rendering for task ID examples in CLI instruction guides and command help, using the configured `task_prefix` at runtime. Verified a temporary project with `task_prefix: "feat"` renders FEAT IDs in both `backlog instructions overview` and `backlog task create --help`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated the CLI agent nudge and runtime instruction/help rendering.

Changes:
- The generated nudge now requires `backlog instructions overview` before answering or taking action on every user request.
- Removed the redundant `backlog instructions` list-guides bullet from the nudge.
- `backlog instructions` index now describes the overview as the required first read before answering any user request.
- CLI instruction guides and command help examples now render task IDs with the current configured task prefix. The source uses neutral task-ID placeholders, and runtime output expands them, for example to `BACK-123` in this repo or `FEAT-123` in a project configured with `task_prefix: "feat"`.

Verification:
- `bun test src/test/cli.test.ts --test-name-pattern "backlog instructions command|command help input schemas|CLI instructions"`
- `bun test src/test/agent-instructions.test.ts`
- `bunx tsc --noEmit`
- `bun run check .`
- Manual temp-project check for `task_prefix: "feat"` instruction and help output.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
