---
id: BACK-366.02
title: Refactor advanced config wizard prompts to clack
status: Done
assignee:
  - '@codex'
created_date: '2026-01-15 22:19'
updated_date: '2026-02-20 22:29'
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
- [x] #1 Advanced config wizard prompts use clack for all interactive questions.
- [x] #2 Prompt validation behavior matches current expectations (e.g., numeric bounds and required fields).
- [x] #3 Configuration outputs match current behavior for the same inputs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace advanced config wizard prompt plumbing with a Clack-backed runner while preserving existing PromptRunner injection for tests.
2. Keep validation and output semantics aligned with previous behavior (number bounds, required/optional handling, config merge behavior).
3. Add/adjust regression coverage for re-init and config preservation edge cases.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refactored advanced configuration prompts to run on Clack across confirm/text/number/select/multiselect flows while keeping existing command wiring and test stubs intact. Fixed key behavior gaps: numeric/text defaults now use `initialValue`, Enter preserves existing numeric values, editor default fallback chain includes config/`EDITOR`/`VISUAL`/platform default, and cancel behavior supports step-back navigation for zero-padding and web UI sections. Also fixed array-prompt cancellation so subsequent prompts do not render after `Esc`. Ensured config outputs remain stable, including idempotent re-init behavior that preserves non-init-managed fields. Validation run: `bunx tsc --noEmit`, `bun run check .`, `bun test`, `bun run build`.
<!-- SECTION:FINAL_SUMMARY:END -->
