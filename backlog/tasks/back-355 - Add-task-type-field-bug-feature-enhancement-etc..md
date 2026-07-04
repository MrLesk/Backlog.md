---
id: BACK-355
title: 'Add task type field (bug, feature, enhancement, etc.)'
status: To Do
assignee: []
created_date: '2026-01-01 23:37'
updated_date: '2026-07-04 17:50'
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
- [ ] #1 Task types are configurable per-project in config.yml with sensible defaults
- [ ] #2 CLI task create and task edit commands support --type flag
- [ ] #3 MCP task_create and task_edit tools include type parameter
- [ ] #4 TUI board displays task type with visual distinction (icon or badge)
- [ ] #5 Web UI displays task type in task cards and detail view
- [ ] #6 Task list and search support type-based filtering (--type flag)
- [ ] #7 Type validation ensures value is one of the configured types
- [ ] #8 Type field persists in task markdown YAML frontmatter
- [ ] #9 Task domain model includes an optional 'type' field; default allowed set: bug, feature, enhancement, task, chore, docs, spike (project-overridable via the 'types' config key)
- [ ] #10 Existing tasks without a 'type' field stay untyped: the parser leaves type undefined, display surfaces show no type badge/value for them, and there is no retroactive defaulting or migration
<!-- AC:END -->
