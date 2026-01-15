---
id: task-358
title: Add cross-reference from execution guide to completion guide
status: To Do
assignee: []
created_date: '2026-01-04 22:48'
labels:
  - documentation
  - workflow
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context
The task execution guide ends without mentioning the completion workflow. When an agent finishes implementing a task, there's no explicit handoff telling them to follow the completion guide.

## Problem
- Execution guide covers planning → execution → scope changes → subtasks
- Completion guide covers verification → DoD checklist → status update → next steps
- No link between them - agents may skip completion steps

## Fix
Add a brief section or line at the end of the execution guide pointing to the completion workflow, e.g.:
> "When implementation is complete, follow the Task Completion Guide to finalize the task."
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Execution guide ends with a reference to the completion guide
- [ ] #2 The handoff is clear and actionable
<!-- AC:END -->
