---
id: BACK-353
title: Add documentation field to task domain object
status: To Do
assignee: []
created_date: '2025-12-26 17:39'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a new `documentation` field to the task domain object that stores an array of strings. Each entry can be:
- External URLs (e.g., design docs, API specs, service manuals)
- Local file paths relative to the repo root (e.g., `src/core/auth.ts`, `docs/architecture.md`)

This field helps AI agents (who have no prior context) quickly access relevant reference materials when picking up a task. It supports the "swarm of agents" execution model where each task must be self-contained.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task type includes optional `documentation: string[]` field
- [ ] #2 CLI supports --doc flag for task create/edit (can be used multiple times)
- [ ] #3 MCP task_create and task_edit schemas include documentation field
- [ ] #4 task_view output displays documentation links
- [ ] #5 Documentation persists in task markdown files
- [ ] #6 Unit tests cover CRUD operations for documentation field
<!-- AC:END -->
