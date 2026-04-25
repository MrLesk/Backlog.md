---
id: BACK-429
title: Preserve unsaved Web drafts across file refreshes
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - web-ui
  - state
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/578'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #578: unsaved Web UI form state should not reset when task files change while the browser UI is open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Unsaved task create/edit fields survive external task file refreshes.
- [ ] #2 Saved external changes still appear after refresh when they do not conflict with local unsaved form state.
- [ ] #3 A regression test or browser automation covers unsaved edits plus an external file watcher update.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
