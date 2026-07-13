---
id: BACK-544
title: Add structured TUI task editing with a raw Markdown power path
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-07-12 22:11'
labels:
  - tui
  - enhancement
milestone: m-8
dependencies:
  - BACK-543
priority: medium
type: enhancement
ordinal: 191000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reuse the TUI composer as a structured editing model from board, list, and detail contexts while preserving raw Markdown editing as a separate power-user path. Exact shortcut mapping and lifecycle-field grouping require Alex plan review before implementation; this task intentionally does not choose them in advance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Structured editing is available from the TUI board, list, and detail contexts and reuses the composer field model instead of introducing a separate form model.
- [ ] #2 The editor prefills the selected record accurately, preserves untouched content, and saves only fields the user changed.
- [ ] #3 Cancel and an unchanged submission perform no write, with clear no-change feedback.
- [ ] #4 Validation or persistence failure performs no partial write and preserves the edited values for correction or retry.
- [ ] #5 Status changes and task-to-Draft or Draft-to-task transitions use the canonical status, demotion, and promotion paths, including any resulting task ID change, without duplicating transition semantics in the TUI.
- [ ] #6 Lifecycle fields are available through staged editing when relevant, while creation continues to omit plan, implementation notes, and final summary without guessing which custom status names represent lifecycle stages.
- [ ] #7 Raw Markdown editing remains a separate, discoverable power-user action and returns to the same refreshed TUI context after the external editor exits.
- [ ] #8 A successful change refreshes the view exactly once and communicates changed, unchanged, transition, and error outcomes honestly, preserving or relocating focus when an ID changes.
- [ ] #9 Automated tests cover prefill, untouched-content preservation, changed-field saves, cancellation, no-change handling, validation and persistence errors, status and Draft transitions, ID changes, external-editor return, and single-refresh behavior.
- [ ] #10 Rendered keyboard QA covers structured editing and raw Markdown discovery, focus, scrolling, cancellation, transitions, and feedback at normal and narrow terminal sizes.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
