---
id: BACK-366.01
title: Refactor init wizard prompts to clack
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
Why: keep the initialization experience consistent with the new prompt library.
What: migrate the init wizard’s interactive prompt flow to clack while preserving the same choices, messaging, and validation outcomes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Init wizard prompts use clack for all interactive questions.
- [ ] #2 The wizard presents the same options and guidance as before (no content loss).
- [ ] #3 Cancellation paths behave equivalently to current flow.
<!-- AC:END -->
