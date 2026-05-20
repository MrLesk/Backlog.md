---
description: >-
  Create a new Backlog.md task with the correct structure. Use when adding a
  new task to the backlog.
---

Use the MCP tool or CLI to create tasks — never write task markdown files directly.

## Basic create

**Claude Code:** `mcp__backlog__task_create(title="My Task Title", description="...", priority="medium")`
**OpenCode:** `backlog_task_create(title="My Task Title", description="...", priority="medium")`
**CLI:** `backlog task create "My Task Title" -d "..." --priority medium`

## Creating subtasks

**Claude Code:** `mcp__backlog__task_create(title="Subtask", parentTaskId="BACK-123")`
**OpenCode:** `backlog_task_create(title="Subtask", parentTaskId="BACK-123")`

## With labels

**Both:** `task_create(title="Bug: login fails", labels: ["bug", "auth"], priority: "high")`

## With assignee

**Both:** `task_create(title="Setup CI", assignee: ["@username"])`

## Full example

```text
mcp__backlog__task_create(
  title="Add dark mode toggle",
  description="Users should be able to switch between light and dark themes.",
  priority: "medium",
  labels: ["feature", "ui"],
  acceptanceCriteria: [
    "Toggle appears in settings page",
    "Theme persists across sessions"
  ]
)

# Or for OpenCode:
backlog_task_create(
  title="Add dark mode toggle",
  ...
)
```
