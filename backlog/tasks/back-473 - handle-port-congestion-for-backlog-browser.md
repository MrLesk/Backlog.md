---
id: BACK-473
title: handle port congestion for backlog browser
status: To Do
assignee:
  - '@lenucksi'
created_date: '2026-05-08 14:29'
updated_date: '2026-05-13 09:52'
labels:
  - webui
dependencies: []
ordinal: 166000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
If port 6420 is taken, ask user to try a different one. Ideally just increment port number (e.g. 6421), check if free and start if user accepts this.

oh, and check if port is free before starting the backlog browser mode anyway. this seems to not happen correctly O_o
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
