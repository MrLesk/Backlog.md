---
id: task-270
title: Prevent command substitution in task creation inputs
status: Done
assignee:
  - '@codex'
created_date: '2025-09-17 21:20'
updated_date: '2025-09-18 21:01'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When creating tasks via the CLI we attempted to reference `backlog init` inside acceptance criteria text. The shell treated the backticks as command substitution and executed `backlog init`, injecting its prompt output into the saved task. We need a safer flow (guidance, escaping utilities, or CLI handling) so users can include literal backticks without corrupting task content.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Document safe quoting patterns for including literal backticks in CLI task commands.
- [ ] #2 Evaluate updating CLI helpers so they escape backticks before submission or offer a flag to bypass shell parsing.
- [ ] #3 Verify existing tasks are not affected by stray `backlog init` prompt text and repair any impacted files.
<!-- AC:END -->
