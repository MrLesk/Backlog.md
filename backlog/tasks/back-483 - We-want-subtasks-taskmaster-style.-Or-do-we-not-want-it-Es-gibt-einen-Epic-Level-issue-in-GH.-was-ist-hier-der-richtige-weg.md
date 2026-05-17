---
id: BACK-483
title: >-
  We want subtasks taskmaster style. Or do we not want it? Es gibt einen
  Epic-Level issue in GH. was ist hier der richtige weg?
status: Done
assignee:
  - '@lenucksi'
created_date: '2026-05-12 16:13'
updated_date: '2026-05-17 20:20'
labels:
  - duplicate
milestone: m-10
dependencies:
  - BACK-493
priority: low
ordinal: 170000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Gibts schon im Wiring. UI Umsetzung im TUI, Fehlend in CLI + WebUI. 

Tasks + Subtasks in BACK-493 als Parent um es umzusetzen
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed as duplicate of BACK-493. The subtask visibility work is fully covered by BACK-493 and its subtask cluster (BACK-493.1–BACK-493.5). Self-labeled duplicate; no implementation required here.
<!-- SECTION:FINAL_SUMMARY:END -->
