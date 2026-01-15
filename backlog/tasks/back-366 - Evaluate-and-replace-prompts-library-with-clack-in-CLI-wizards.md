---
id: BACK-366
title: Evaluate and replace prompts library with clack in CLI wizards
status: To Do
assignee:
  - '@codex'
created_date: '2026-01-15 22:19'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: improve CLI prompt experience and align with the preferred library while keeping Backlog.md’s interactive flows maintainable.
What: plan and execute the library switch for CLI prompts, covering all user-facing interactive flows and their tests, without changing user-visible outcomes unless explicitly required by the new library.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All interactive CLI prompt flows in scope use the new prompts library consistently.
- [ ] #2 User-facing behavior remains equivalent to current flows (same questions/options/validation) unless explicitly documented as a change.
- [ ] #3 Automated tests covering prompt-driven flows are updated to pass.
- [ ] #4 The old prompts dependency is fully removed from the project.
<!-- AC:END -->
