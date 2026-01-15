---
id: BACK-366.03
title: Refactor remaining CLI prompt flows and tests to clack
status: To Do
assignee:
  - '@codex'
created_date: '2026-01-15 22:20'
labels: []
dependencies: []
parent_task_id: BACK-366
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: ensure all interactive CLI touchpoints align with the new prompt library and remain covered by tests.
What: migrate remaining prompt-driven commands to clack and update associated tests to reflect the new prompt integration without changing expected outcomes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All remaining interactive prompt flows in CLI commands use clack.
- [ ] #2 Test coverage for prompt-driven behavior continues to pass without changing intended outcomes.
- [ ] #3 No legacy prompt library references remain in CLI prompt code paths.
<!-- AC:END -->
