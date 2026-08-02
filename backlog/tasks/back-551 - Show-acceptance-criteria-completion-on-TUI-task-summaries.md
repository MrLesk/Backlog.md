---
id: BACK-551
title: Show acceptance criteria completion on TUI task summaries
status: To Do
assignee: []
created_date: '2026-07-17 21:36'
labels:
  - tui
dependencies: []
type: feature
ordinal: 195000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Help people understand how much accepted task scope has been verified while scanning in-progress work in the TUI. In-progress task summaries and cards should show a compact completion bar followed by the exact checked/total acceptance-criteria fraction. This is a TUI presentation feature only; it does not change task state or CLI and MCP output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In-progress task summaries and cards in the TUI show a compact completion bar followed by the exact checked/total fraction, for example [██████░░░░] 4/7.
- [ ] #2 The visible indicator has no AC label and no percentage.
- [ ] #3 The completion value is derived live from checked and total acceptance criteria and is not persisted as separate progress state.
- [ ] #4 The bar uses 10 cells when available terminal width permits and 5 cells in constrained layouts.
- [ ] #5 A task with no acceptance criteria does not display 0% or otherwise imply measurable completion.
- [ ] #6 A task with every acceptance criterion checked still retains and clearly presents its actual In Progress status rather than implying that the task is Done.
- [ ] #7 Colors are theme-safe, and the bar plus exact fraction remain understandable when color is unavailable.
- [ ] #8 CLI and MCP output remain unchanged.
- [ ] #9 TUI rendering tests cover partial completion, no acceptance criteria, all criteria checked while still In Progress, and both supported bar widths.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
