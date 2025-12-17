---
id: task-346
title: Add milestone completion/archival workflow
status: To Do
assignee: []
created_date: '2025-12-17 19:28'
updated_date: '2025-12-17 22:11'
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
