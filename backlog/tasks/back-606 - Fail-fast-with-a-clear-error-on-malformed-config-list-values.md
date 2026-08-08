---
id: BACK-606
title: Fail fast with a clear error on malformed config list values
status: To Do
assignee: []
created_date: '2026-08-08 15:56'
labels: []
dependencies: []
ordinal: 245000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Config list keys are parsed textually and silently accept malformed YAML, for example statuses: ["To Do] with a missing closing quote; only default_assignee received the strict YAML-based parsing during BACK-583. Approved direction from Alex (2026-08-08): align all list config keys on the same strict parser and fail fast at startup with a very clear error in the shape "Backlog could not start because ..." naming the config file and the offending key, instead of silently proceeding with a misparsed value.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All list config keys are parsed with the same strict YAML-based parser as default_assignee
- [ ] #2 A malformed list value aborts startup with a clear error naming the config file and the offending key
- [ ] #3 The error message starts with "Backlog could not start because"
- [ ] #4 Tests cover malformed values for each list config key
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
