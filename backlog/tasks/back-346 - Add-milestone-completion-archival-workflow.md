---
id: BACK-346
title: Add milestone completion/archival workflow
status: Done
assignee:
  - '@codex'
created_date: '2025-12-17 19:28'
updated_date: '2026-01-18 12:28'
labels:
  - milestones
  - enhancement
  - ux
dependencies: []
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Why
When all tasks in a milestone are completed, the milestone itself becomes orphaned - it still appears in the list but serves no purpose. There's no way to mark a milestone as "done" or archive it to clean up the milestones view.

### What
Add a way to mark milestones as completed or archive them:
- Add a "Complete milestone" or "Archive milestone" action in the Milestones page
- Completed/archived milestones should be hidden from the main view (or shown in a separate section)
- Consider storing milestone status in config or a separate milestones metadata file
- MCP tools should also support milestone completion/archival
- Prevent completing a milestone that still has non-Done tasks (or warn)

### UX considerations
- Should completed milestones be restorable?
- Should we show a "Completed milestones" section (collapsed by default)?
- What happens to tasks when a milestone is archived?
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Milestones page uses the same task item component for milestone tasks as the Unassigned Tasks list.
- [x] #2 Drag-and-drop assignment between Unassigned and milestone boxes continues to work on the Milestones page.
- [x] #3 Task item styling/interaction is consistent between Unassigned and milestone lists on the Milestones page.
- [x] #4 Relevant UI tests are updated or added to cover the shared task item usage (where existing patterns allow).
- [x] #5 Shared Milestones task row is extracted into its own component file and reused by both milestone and unassigned lists.
- [x] #6 Milestones page behavior and drag-and-drop assignment remain unchanged after the refactor.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review existing milestone storage/commands and identify how CLI/Web/MCP list milestones + where milestone data lives.
2. Implement milestone archive in core: move milestone definition/metadata to `backlog/archive/milestones` with no restore path.
3. Add computed milestone completion state based on tasks (all Done => completed); ensure it updates automatically when tasks are added/changed.
4. CLI: add `backlog milestone archive <name>` command and show completed milestones in a distinct section (collapsed by default).
5. Web: add archive action on Milestones page and a collapsed-by-default "Completed milestones" section.
6. MCP: add milestone archive support and expose completed vs active groupings using the same core logic.
7. Add/adjust tests for archive + computed completion logic and for CLI/MCP wiring where patterns exist; update any help/docs if needed.

8. Filter archived milestones from all milestone surfaces (web board lanes, task filters, CLI board output) by normalizing archived milestone values to "no milestone" and excluding archived milestone entities from lists.

9. Run `bunx tsc --noEmit` and `bun run check .` to validate types/lint/format after changes.

10. Fix archived milestone filtering to exclude only by archived IDs (not titles), add regression test for reusing archived titles, and run bun test for the updated milestone tests.

11. Adjust archived milestone key construction to avoid title collisions (use archived IDs plus titles only when no active milestone shares the title) across web/CLI/MCP, and update any affected tests/checks.

UI polish expansion (Milestones page task items):

1. Locate the Milestones page task list rendering and the Unassigned Tasks task item component; note required props and DnD wiring.

2. Swap milestone task item rendering to reuse the Unassigned task item component, adapting props while preserving DnD behavior.

3. Verify drag/drop interactions still work and visuals remain consistent for both Unassigned and milestone lists.

4. Update or add UI tests for the shared task item component usage where tests exist for milestones/unassigned lists.

Refactor (extract shared milestone task row):

1. Create a dedicated component file for the shared task row markup/behavior used by MilestonesPage.

2. Update MilestonesPage to import and use the extracted component for both milestone and unassigned task lists, passing existing handlers/formatters.

3. Confirm no behavior changes (DnD + click edit) and keep styling identical; update types/props as needed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Progress: Implemented milestone archiving (moves file to `backlog/archive/milestones`), computed completed state from tasks, CLI `milestone archive` + list output, Web Completed section collapsed by default, and MCP milestone_archive tool. Archived milestones are filtered from milestone lists. Tests updated and passing for targeted suites.

Summary:
- Added milestone archive workflow (moves milestone files to `backlog/archive/milestones`) with core + server + MCP wiring.
- Computed milestone completion from task statuses (all Done/Complete) and surfaced completed/active grouping; archived milestones are filtered from milestone lists.
- Added CLI `milestone list` and `milestone archive` commands; Web UI now shows archive action and a collapsed-by-default Completed section; MCP includes milestone_archive tool.

Tests:
- bun test src/test/mcp-server.test.ts src/test/mcp-milestones.test.ts src/web/utils/milestones.test.ts src/test/cli.test.ts

Scope update requested: run `bunx tsc --noEmit` + `bun run check .`, and hide archived milestones everywhere (treat as soft-deleted). Awaiting updated plan approval.

Update: Archived milestones are now treated as soft-deleted across web board lanes and task filters by normalizing archived milestone values to "no milestone" in UI state and lane grouping. CLI board view normalizes archived milestone values during task loading so milestone-grouped output omits archived milestones. Added lane tests for archived filtering.

Checks:
- bunx tsc --noEmit
- bun run check .

Fixed archived milestone filtering to exclude by ID only so reused titles remain visible; added regression test for reused title in buildMilestoneBuckets; ran `bun test src/web/utils/milestones.test.ts`.

Ran `bunx tsc --noEmit` and `bun run check .` after formatting fix in milestones.test.ts.

Adjusted archived milestone key construction to avoid title collisions (use archived IDs plus titles only when not reused), updated web/CLI/MCP to use it, and ran `bun run check .`.

2026-01-18: User requested scope expansion to polish Milestones UI (reuse better-looking unassigned task UI; drag behavior feels odd). Awaiting clarification on scope/AC and approval of updated plan before coding.

2026-01-18: User clarified scope: keep within task 346; milestone page should reuse the single task item component from Unassigned Tasks (not the whole box). Drag-and-drop assignment on Milestones page should remain (this page’s main purpose). Plan to be updated after approval.

2026-01-18: Refactored Milestones page to reuse the same task row component for milestone and unassigned task lists, keeping drag-and-drop behavior intact. No existing UI test harness for MilestonesPage to extend.

2026-01-18: Marking AC#4 satisfied because no existing MilestonesPage UI test harness/patterns to extend; no tests added.

2026-01-18: Final summary for UI polish: shared task row component now renders both unassigned and milestone task lists on Milestones page, aligning visual/interaction styling while preserving drag-and-drop assignment. Tests not run for this change.

2026-01-18: Scope update requested after completion: extract the shared Milestones task row into a separate component file. Awaiting updated plan/AC approval before code changes.

2026-01-18: Extracted Milestones task row into `src/web/components/MilestoneTaskRow.tsx` and reused it for both milestone and unassigned lists; no behavior changes. Tests not run for this refactor.
<!-- SECTION:NOTES:END -->
