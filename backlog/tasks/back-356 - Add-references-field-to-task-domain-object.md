---
id: BACK-356
title: Add references field to task domain object
status: To Do
assignee: []
created_date: '2026-01-01 23:39'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a new `references` field to the task domain object that stores an array of strings. Each entry can be:
- External URLs (e.g., related GitHub issues, Stack Overflow answers, blog posts)
- Local file paths relative to the repo root (e.g., `src/components/Button.tsx`, `tests/auth.test.ts`)

This field allows tasks to link to relevant code files, external resources, or related issues. Unlike the `documentation` field (which points to reference materials for understanding), `references` tracks files and URLs that are directly relevant to the task's implementation or context.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task type includes optional `references: string[]` field
- [ ] #2 CLI supports --ref flag for task create/edit (can be used multiple times)
- [ ] #3 MCP task_create and task_edit schemas include references field
- [ ] #4 task_view output displays reference links
- [ ] #5 References persist in task markdown files
- [ ] #6 Unit tests cover CRUD operations for references field
<!-- AC:END -->
