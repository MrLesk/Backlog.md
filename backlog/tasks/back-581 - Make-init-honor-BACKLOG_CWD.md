---
id: BACK-581
title: Make init honor BACKLOG_CWD
status: To Do
assignee: []
created_date: '2026-08-07 17:25'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/854'
priority: high
type: bug
ordinal: 222000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #854. `backlog init` reads `process.cwd()` directly (src/cli.ts:740-742) instead of going through resolveRuntimeCwd (src/utils/runtime-cwd.ts), which every other command honors. With BACKLOG_CWD pinned to one project and a different project in the process directory, init silently re-initializes the wrong live board and exits 0. This was reported as a real incident in which another board config was rewritten.

Maintainer decision (confirmed): init follows the same resolveRuntimeCwd flow as every other command. init is idempotent, so no additional guard or confirmation prompt is expected.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With BACKLOG_CWD set, `backlog init` targets the pinned directory rather than the process directory
- [ ] #2 Without BACKLOG_CWD set, init behavior is unchanged
- [ ] #3 Test coverage mirrors the approach used in src/test/runtime-cwd.test.ts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
