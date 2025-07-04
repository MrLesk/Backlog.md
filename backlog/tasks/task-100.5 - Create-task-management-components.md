---
id: task-100.5
title: Create task management components
status: To Do
assignee: []
created_date: '2025-06-22'
labels: []
dependencies:
  - task-100.1
  - task-100.3
parent_task_id: task-100
---

## Description

Build TaskList, TaskDetail, and TaskForm components. These components will provide alternative views and interaction methods for managing tasks beyond the Kanban board.

## Components Overview

### 1. TaskList Component Requirements

**Component Interface:**

- Display tasks in table/list format
- Support task interaction (click, edit, archive)
- Handle filtering and search functionality

**Features:**

- Table view with sortable columns
- Search bar with real-time filtering
- Filter dropdowns for status, assignee, labels
- Bulk actions (archive multiple, change status)
- Pagination for large task lists
- Export to CSV functionality

**UI Elements (shadcn/ui):**

- `Table` - Main list display
- `Input` - Search field
- `Select` - Filter dropdowns
- `Checkbox` - Bulk selection
- `Button` - Action buttons
- `DropdownMenu` - Context menus

### 2. TaskDetail Component Requirements

**Component Interface:**

- Display complete task information
- Show rendered markdown content
- Provide edit and close actions
- Integrate with Board component for task card clicks

**Features:**

- Full-screen modal or side panel view
- Markdown preview with syntax highlighting
- Task metadata display (dates, assignee, labels)
- Dependency visualization
- Subtask hierarchy view
- Activity history (if available)
- Quick edit actions

**UI Elements (shadcn/ui):**

- `Dialog` or `Sheet` - Container
- `Tabs` - Preview/Edit/History views
- `Badge` - Labels and status
- `Separator` - Section dividers
- `ScrollArea` - Content scrolling

### 3. TaskForm Component Requirements

**Component Interface:**

- Support both create and edit modes
- Handle task data submission
- Provide cancel functionality

**Features:**

- Create and edit modes
- Rich markdown editor with preview
- Acceptance criteria builder
- Dependency selector with search
- Label management (add/remove)
- Priority selector
- Parent task selector for subtasks
- Form validation with Zod schemas and error messages

**UI Elements (shadcn/ui):**

- `Form` - Form container with validation
- `Input` - Title field
- `Textarea` - Description editor
- `Select` - Status, priority dropdowns
- `MultiSelect` - Labels, dependencies
- `Button` - Submit/Cancel actions
- `Alert` - Validation errors

## Shared Features

### Markdown Support

- Use `react-markdown` for rendering
- Code syntax highlighting with `react-syntax-highlighter`
- Support for task-specific markdown extensions (checklists, etc.)

### Data Integration Requirements

**Task Data Fetching:**

- Create custom hooks for task data management
- Support filtering by status, assignee, labels
- Handle loading, error, and success states
- Implement data refetching capabilities

**Task Mutations:**

- Provide functions for creating, updating, and archiving tasks
- Handle form validation using Zod schemas
- Implement proper error handling and user feedback
- Ensure type safety with validated data

### Board Integration Requirements

**TaskDetail Modal Integration:**

- Connect TaskDetail modal with Board component task card clicks
- Handle modal state management (open/close/selected task)
- Provide smooth user experience with proper focus management
- Ensure task updates from modal reflect immediately on board
- Handle loading states when fetching task details

### Error Handling

- Toast notifications for success/error states using shadcn/ui Toast component
- Inline validation messages
- Network error recovery with manual retry buttons
- Optimistic updates with automatic rollback on failure

## Acceptance Criteria

- [ ] TaskList shows filterable list of tasks
- [ ] TaskDetail displays full task information with markdown
- [ ] TaskDetail integrates with Board component (clicking task cards opens modal)
- [ ] TaskForm handles create/edit operations with Zod validation
- [ ] All forms validate input properly using Zod schemas
- [ ] Clear validation error messages displayed for invalid input
- [ ] Form submission only occurs with valid data
- [ ] Components use shadcn/ui consistently
- [ ] Type safety maintained between forms and API
- [ ] Modal state management works properly (open/close/focus)
- [ ] Task updates from modal reflect on board immediately
