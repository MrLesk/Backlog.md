---
id: BACK-273.04
title: '273.04: CLI & TUI search integration'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-19 18:33'
updated_date: '2025-09-21 17:46'
labels:
  - cli
  - tui
  - search
dependencies: []
parent_task_id: task-273
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Route the CLI and TUI experiences through the new content store/search service. Replace direct filesystem filters, add a backlog search command (plain output + interactive prefilled view), and surface status/priority dropdowns alongside the new search box in the TUI task list.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog task list and unified view fetch tasks via the content store/search service (no ad-hoc filtering).
- [x] #2 New backlog search command accepts a query, supports --plain output, and opens the interactive task list with the search field populated when run without --plain.
- [x] #3 TUI task list header renders search input plus status/priority dropdowns backed by the shared filter API.
- [x] #4 bun run check ., bunx tsc --noEmit, and bun test cover CLI command + TUI integration.
- [x] #5 Search scores are intuitive (higher score = better match, not Fuse.js default)
- [x] #6 Status and priority filters are case-insensitive
- [x] #7 Filter state persists when switching between task list and kanban views
- [x] #8 Search input gets focus when launched with query parameters
- [x] #9 Tab key navigates between filters without inserting tab characters in search input
- [x] #10 Backspace and delete keys work correctly in search input
- [x] #11 TUI shows consistent footer styling between task list and kanban views
- [x] #12 Escape key behavior: cancels filters when in filter mode, quits when in task list
- [x] #13 Search command shows TUI even when initial search has no task results (shows all tasks)
- [x] #14 Initial filters are applied immediately when TUI opens with search parameters
<!-- AC:END -->


## Implementation Notes

Implemented comprehensive CLI & TUI search integration:


## CLI Search Command
- Added `backlog search` command with query, --type, --status, --priority filters
- Supports --plain output for scripts/AI with inverted scores (higher = better match)
- Launches interactive TUI when run without --plain flag
- Made status and priority filters case-insensitive

## TUI Search Interface
- Added interactive search box with live filtering (no Enter needed)
- Added status and priority dropdown filters with live updates
- Implemented Tab key navigation between search, status, priority filters
- Fixed Tab key insertion issue by configuring neo-neo-blessed textbox with ignoreKeys
- Fixed backspace/delete key handling in search input
- Maintains filter state when switching between task list and kanban views
- Shows filtered task count in pane label
- Proper focus management: search gets focus when launched with query, task list otherwise

## neo-neo-blessed Library Enhancements
- Made textbox component configurable with ignoreKeys option
- Fixed single-line textbox backspace/delete handling
- Updated TypeScript definitions

## Documentation
- Added search command documentation to agent-guidelines.md for AI agents
- Added user-friendly search documentation to README.md
- Placed search section after Definition of Done in guidelines

## Quality
- All TypeScript compilation checks pass (bunx tsc --noEmit)
- Biome formatting and linting pass (bun run check .)
- Tests cover search service integration
