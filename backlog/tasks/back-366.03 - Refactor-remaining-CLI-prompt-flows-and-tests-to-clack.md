---
id: BACK-366.03
title: Refactor remaining CLI prompt flows and tests to clack
status: Done
assignee:
  - '@codex'
created_date: '2026-01-15 22:20'
updated_date: '2026-02-20 22:29'
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
- [x] #1 All remaining interactive prompt flows in CLI commands use clack.
- [x] #2 Test coverage for prompt-driven behavior continues to pass without changing intended outcomes.
- [x] #3 No legacy prompt library references remain in CLI prompt code paths.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Migrate remaining runtime CLI prompt callsites to Clack.
2. Remove legacy `prompts` dependencies and ensure no runtime references remain.
3. Run full project validation to confirm test and build parity.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed migration of remaining interactive CLI prompt flows to Clack, including non-init command paths (`agents --update`, cleanup select/confirm) and integrated these with the same cancellation conventions used elsewhere. Removed legacy `prompts` and `@types/prompts` dependencies from the project and updated lockfile, leaving Clack as the sole prompt runtime. Updated/retained test coverage to keep intended behavior unchanged. Validation run: `bunx tsc --noEmit`, `bun run check .`, `bun test`, `bun run build`.
<!-- SECTION:FINAL_SUMMARY:END -->
