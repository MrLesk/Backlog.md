---
id: BACK-772
title: Repair duplicate task IDs
status: Done
assignee:
  - '@codex'
created_date: '2026-10-19 13:14'
updated_date: '2026-10-19 13:18'
labels: []
dependencies: []
references:
  - backlog/completed/back-41 - cli-migrate-terminal-ui-to-bblessed.md
  - backlog/completed/back-773 - add-implementation-plan-section.md
  - backlog/archive/tasks/back-774 - test-mixed-case-filename.md
  - backlog/archive/tasks/back-775 - UPDATED-Title-With-CAPS.md
  - backlog/archive/tasks/back-776 - Test-AC-Feature.md
  - backlog/archive/tasks/back-777 - Test-AC-Feature-2.md
  - backlog/archive/tasks/back-778 - Test-Full-Flag.md
  - backlog/archive/tasks/back-779 - Test-notes-functionality.md
  - >-
    backlog/archive/tasks/back-780 -
    Show-all-configured-status-columns-in-TUI-kanban-board.md
  - >-
    backlog/archive/tasks/back-781 -
    Make-browser-task-loading-asynchronous-and-idle-stable.md
  - >-
    backlog/completed/back-570 -
    Make-browser-task-loading-asynchronous-and-idle-stable.md
modified_files:
  - backlog/completed/back-76 - add-implementation-plan-section.md
  - backlog/completed/back-773 - add-implementation-plan-section.md
  - backlog/archive/tasks/back-81 - test-mixed-case-filename.md
  - backlog/archive/tasks/back-774 - test-mixed-case-filename.md
  - backlog/archive/tasks/back-82 - UPDATED-Title-With-CAPS.md
  - backlog/archive/tasks/back-775 - UPDATED-Title-With-CAPS.md
  - backlog/archive/tasks/back-88 - Test-AC-Feature.md
  - backlog/archive/tasks/back-776 - Test-AC-Feature.md
  - backlog/archive/tasks/back-89 - Test-AC-Feature-2.md
  - backlog/archive/tasks/back-777 - Test-AC-Feature-2.md
  - backlog/archive/tasks/back-90 - Test-Full-Flag.md
  - backlog/archive/tasks/back-778 - Test-Full-Flag.md
  - backlog/archive/tasks/back-168 - Test-notes-functionality.md
  - backlog/archive/tasks/back-779 - Test-notes-functionality.md
  - >-
    backlog/archive/tasks/back-275 -
    Show-all-configured-status-columns-in-TUI-kanban-board.md
  - >-
    backlog/archive/tasks/back-780 -
    Show-all-configured-status-columns-in-TUI-kanban-board.md
  - >-
    backlog/archive/tasks/back-569 -
    Make-browser-task-loading-asynchronous-and-idle-stable.md
  - >-
    backlog/archive/tasks/back-781 -
    Make-browser-task-loading-asynchronous-and-idle-stable.md
  - backlog/archive/tasks/back-41 - cli-migrate-terminal-ui-to-bblessed.md
  - >-
    backlog/completed/back-570 -
    Make-browser-task-loading-asynchronous-and-idle-stable.md
type: chore
ordinal: 392000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Repair the ten historical duplicate task ID groups that block aggregate CLI task loading and Groma work-source loading. Preserve distinct historical records, their task families and references; remove only the stale copy of the same completed task. Alex explicitly approved manual filename and frontmatter edits for this data repair.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every task record has an unambiguous ID that matches its filename.
- [x] #2 Distinct historical tasks and their references are preserved, including the original BACK-76 subtask family and the authoritative BACK-570 implementation record.
- [x] #3 Published Backlog CLI task list --json succeeds and Groma can load task context from the repaired repository.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Inspect duplicate pairs, history and references. Keep the completed BACK-41 record and remove its stale earlier copy. Keep BACK-76 with its six existing children; give the unrelated completed task a new unique ID. Rename the other colliding archived records and update the BACK-570 reference to its predecessor. Record every changed path immediately. Verify one-to-one filenames/IDs, preserved content and references, and published CLI/Groma task loading. This is a data-only repair: use direct supported CLI verification, with no new source-code tests or behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Historical review: BACK-41 is an earlier draft of the same completed task, not a separate task; keep the completed record and its children. BACK-76 in archive owns six existing subtasks; preserve that family and give the unrelated completed implementation-plan task BACK-773. Renumber the eight other colliding archived records to BACK-774 through BACK-781. BACK-570 explicitly replaced the archived browser-loading record: update that reference to BACK-781 and preserve its former branch-local BACK-569 in prose. BACK-585 refers to the Windows CI work and keeps BACK-569. All existing status, ownership, dates, task bodies and task locations otherwise stay unchanged. No application source or new automated test is required for this record-only repair. Direct CLI and live Groma work-source checks will detect the reproduced aggregate-loading failure.

Data verification passed: all 785 task records have unique IDs matching their filename prefixes; all nine renamed records are byte-identical except their frontmatter ID; 812 other Markdown records are byte-identical. The removed BACK-41 draft contains no unique task content; its completed record and five children are unchanged. Published Backlog.md 1.54.0 task list --json now exits 0, returns 151 tasks, and writes no stderr. Doctor reports no local duplicate ID group; remaining diagnostics concern old Git branches and existing completed-folder placement, neither of which is changed in this repair. Remote branch task numbers were checked before assigning replacement IDs.

Live verification passed with the published Groma 0.7.0 binary and Backlog.md 1.54.0 in an isolated checkout: /world.json contains 151 work items with unique IDs and 50 pins; /task.json opens BACK-772 successfully. The temporary server was stopped cleanly. Implementer specification and quality review: all three acceptance criteria are met; the diff is limited to historical record identity repair, one predecessor reference, and this task. A reader can follow every old-to-new ID using the modified-file list and rename diff. Simplicity review: no source code, helper, schema, migration, test file or architecture change is needed. TypeScript and formatting/lint conditional DoD checks are not applicable because no code or linted files changed; direct CLI/data/live-Groma checks provide the scoped verification. git diff --check passed. Contributor-fork PR identity issues are outside this current-main repair and remain for their own PR review.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Resolved all ten historical duplicate ID groups. Kept completed BACK-41 and removed its stale earlier copy; preserved the archived BACK-76 subtask family; renamed nine distinct records to BACK-773 through BACK-781 with matching frontmatter; clarified BACK-570’s predecessor reference. Published CLI task listing and Groma live task loading now succeed. All other historical content remains unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
