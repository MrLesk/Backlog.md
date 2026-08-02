---
id: BACK-562
title: Honor BROWSER for devcontainer browser launch
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-02 16:09'
updated_date: '2026-08-02 16:13'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/815'
  - 'https://github.com/MrLesk/Backlog.md/pull/817'
modified_files:
  - src/utils/browser-launch.ts
  - src/cli.ts
  - src/server/index.ts
  - src/test/server-browser-open.test.ts
type: bug
ordinal: 206000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make backlog browser honor a non-empty BROWSER executable when opening the web UI, so VS Code devcontainers can forward the URL to the host browser while platform fallbacks remain intact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When BROWSER is non-empty, backlog browser launches that executable with the web UI URL as a separate argument.
- [ ] #2 When BROWSER is unset or empty, macOS, Windows, and Linux use their existing platform browser-launch fallbacks.
- [ ] #3 If automatic opening fails, browser output still gives users a URL and clear manual-open guidance.
- [ ] #4 Focused browser-launch tests cover the override and fallback behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review the merged browser-launch flow and focused tests. 2. Preserve the contributor fix while adapting it to current main and add only necessary behavior coverage. 3. Validate focused tests, repository checks, build, and the current-suite baseline before PR review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged current origin/main, replaced the duplicate BACK-555 task record with this CLI-allocated task, and verified focused browser tests, typecheck, Biome, build, plus CI-equivalent isolated full suites on origin/main and this branch.

Updated PR #817 to BACK-562 and pushed the current-main merge plus identity repair. GitHub accepted the fast-forward branch update but rejected fork branch renaming because maintainer permissions do not grant that operation.
<!-- SECTION:NOTES:END -->
