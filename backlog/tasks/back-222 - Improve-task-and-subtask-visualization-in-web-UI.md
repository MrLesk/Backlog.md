---
id: BACK-222
title: Improve task and subtask visualization in web UI
status: Done
assignee: []
created_date: '2025-08-03'
updated_date: '2026-05-17 20:20'
labels: []
milestone: m-8
dependencies: []
ordinal: 159000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current web UI doesn't effectively visualize the parent-child relationship between tasks and subtasks. While the data model supports hierarchical tasks through parentTaskId and subtasks fields, the UI presents all tasks at the same level without clear visual hierarchy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

- [ ] Parent tasks visually indicate they have subtasks (badge or icon)
- [ ] Subtasks are displayed with visual hierarchy (indentation or nesting)
- [ ] Users can expand/collapse subtask groups in the board view
- [ ] Parent task cards show subtask completion progress (e.g. "3/5 complete")
- [ ] Subtasks can be created directly from parent task cards
- [ ] Task hierarchy is preserved when dragging tasks between columns
- [ ] Board view has toggle option to show/hide subtasks
- [ ] Parent-child relationships are clear and intuitive to users
- [ ] Agent instructions improved to reflect usage of subtasks

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Predecessor to BACK-493. This ticket's ACs were carried forward and expanded into the 493 subtask cluster.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed as superseded by BACK-493 (Web UI: subtask visibility) and its subtask cluster BACK-493.1–493.5. Every acceptance criterion from this ticket is covered in more detail by the 493 group — badge (493.3), indentation/collapse/grouping (493.4), list indentation (493.5), detail modal (493.2), API enrichment (493.1). No separate implementation needed.
<!-- SECTION:FINAL_SUMMARY:END -->
