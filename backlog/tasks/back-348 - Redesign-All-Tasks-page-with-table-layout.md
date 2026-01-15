---
id: BACK-348
title: Redesign All Tasks page with table layout
status: To Do
assignee: []
created_date: '2025-12-17 19:32'
updated_date: '2025-12-17 22:11'
labels:
  - web-ui
  - design
  - enhancement
  - ux
dependencies: []
priority: medium
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Why
The new task table in the Milestones page looks clean, scannable, and professional. The current All Tasks page uses a card-based layout that takes more vertical space and is harder to scan when you have many tasks. Adopting the table pattern would create visual consistency and improve the UX.

### Design Vision
Use the Milestones task table as a foundation, but enrich it for the All Tasks context where users need more information at a glance.

#### Columns to include
| Column | Notes |
|--------|-------|
| ID | Monospace, left-aligned (like Milestones) |
| Title | Truncate with ellipsis, flex-grow |
| Status | Badge/pill |
| Priority | Badge/pill (or dash if none) |
| Labels | Compact chips, show first 2 + "+N" overflow |
| Assignee | Avatar or initials, or chips |
| Milestone | Text or badge |
| Created | Relative date ("2d ago") or short date |

#### Enhanced features (beyond Milestones table)
- **Sortable columns**: Click column header to sort (toggle asc/desc), show sort indicator
- **Sticky header**: Keep column headers visible when scrolling long lists
- **Cross-branch styling**: Subtle row background tint instead of banner (more compact)
- **Column density**: Consider compact row height for power users
- **Responsive behavior**: Horizontal scroll on narrow screens, or priority columns only

#### Keep existing functionality
- All filter controls (search, status, priority, milestone, labels)
- Filter count display
- Click row to open task details
- Clean up button for Done tasks
- Empty state messaging

### Out of scope (for this task)
- Drag-and-drop (not needed here)
- Column visibility toggle (future enhancement)
- Bulk selection/actions (future enhancement)

### Related
- Reuse table styling from `MilestonesPage.tsx` (grid layout, header row, row hover states)
- Keep filter bar implementation from current `TaskList.tsx`
<!-- SECTION:DESCRIPTION:END -->
