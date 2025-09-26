---
id: task-265.57.02
title: Update draft management tools to use formatTaskPlainText
status: Done
assignee: []
created_date: '2025-09-26 16:07'
updated_date: '2025-09-26 16:37'
labels: []
dependencies: []
parent_task_id: task-265.57
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update draft_create, draft_promote, draft_archive, draft_view, draft_list to return formatted markdown by reusing formatTaskPlainText (since drafts are tasks)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 draft_create, draft_promote, draft_archive, draft_view, draft_list return formatted markdown
- [x] #2 Reuse formatTaskPlainText (drafts are tasks)
- [x] #3 Consistent with task formatting
- [x] #4 Draft operations show rich formatted output
<!-- AC:END -->
