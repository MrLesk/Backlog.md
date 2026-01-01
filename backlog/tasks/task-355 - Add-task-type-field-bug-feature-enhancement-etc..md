---
id: task-355
title: 'Add task type field (bug, feature, enhancement, etc.)'
status: To Do
assignee: []
created_date: '2026-01-01 23:37'
labels:
  - enhancement
  - core
  - cli
  - mcp
  - web
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a mutually exclusive 'type' field to tasks that categorizes them semantically. Unlike labels (which are additive tags), type is exclusive - each task has exactly one type. This enables clearer task categorization, better reporting and metrics (e.g., bug count vs feature count), and supports type-specific workflows. Aligns with industry-standard issue trackers (GitHub, Jira, Linear).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task domain model includes optional type field with values: bug, feature, enhancement, task (default), chore, docs, spike
- [ ] #2 Task types are configurable per-project in config.yml with sensible defaults
- [ ] #3 CLI task create and task edit commands support --type flag
- [ ] #4 MCP task_create and task_edit tools include type parameter
- [ ] #5 TUI board displays task type with visual distinction (icon or badge)
- [ ] #6 Web UI displays task type in task cards and detail view
- [ ] #7 Task list and search support type-based filtering (--type flag)
- [ ] #8 Existing tasks without type field default to 'task' type
- [ ] #9 Type validation ensures value is one of the configured types
- [ ] #10 Type field persists in task markdown YAML frontmatter
<!-- AC:END -->
