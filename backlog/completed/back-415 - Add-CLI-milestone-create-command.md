---
id: BACK-415
title: Add CLI milestone create command
status: Done
assignee:
  - '@claude'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-04 14:11'
labels:
  - cli
  - milestones
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/232'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #232: provide a public CLI path for creating milestones, using the current milestone file storage model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A CLI milestone create command creates a milestone using the current milestone storage model.
- [x] #2 Duplicate milestone names or IDs are rejected with a clear error.
- [x] #3 Created milestones appear in milestone list and existing milestone-aware views.
- [x] #4 Tests cover successful creation and duplicate validation.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Already implemented on main as of commit d0f3cff; closing with evidence instead of re-implementing. Evidence: 'backlog milestone add <name>' with -d/--description exists in src/cli.ts (~line 3261, with help schema and examples) and creates a milestone markdown file in the active milestones directory via the shared MilestoneHandlers.addMilestone (src/mcp/tools/milestones/handlers.ts ~line 343), which rejects duplicate names/alias conflicts with a clear error ('Milestone alias conflict: ...', ~line 358). Created milestones use the current milestone file storage model and appear in 'backlog milestone list' and milestone-aware views. Documented in CLI-INSTRUCTIONS.md milestone table. Tests: src/test/cli-milestone-management.test.ts covers 'adds milestone files with descriptions and rejects duplicate aliases', auto-commit behavior, and CLI/MCP handler parity. DoD: no code touched for this closure; tsc/biome/tests verified passing on main during triage.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
No code change needed: 'backlog milestone add' already exists with duplicate/alias validation, milestone-file storage, list integration, and test coverage. Closed as already implemented on main (d0f3cff). Tracks GitHub issue #232.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
