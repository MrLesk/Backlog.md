---
id: BACK-366.02
title: Refactor advanced config wizard prompts to clack
status: To Do
assignee:
  - '@codex'
created_date: '2026-01-15 22:19'
labels: []
dependencies: []
parent_task_id: BACK-366
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: keep configuration workflows consistent with the new prompt library.
What: migrate advanced config and config update prompts to clack while preserving the same questions, validation, and resulting configuration values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Advanced config wizard prompts use clack for all interactive questions.
- [ ] #2 Prompt validation behavior matches current expectations (e.g., numeric bounds and required fields).
- [ ] #3 Configuration outputs match current behavior for the same inputs.
<!-- AC:END -->
