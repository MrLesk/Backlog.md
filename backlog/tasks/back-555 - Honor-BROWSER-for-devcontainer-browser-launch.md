---
id: BACK-555
title: Honor BROWSER for devcontainer browser launch
status: Done
assignee:
  - '@shixi-li'
created_date: '2026-07-25 07:17'
updated_date: '2026-07-25 07:17'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/815'
modified_files:
  - src/cli.ts
  - src/server/index.ts
  - src/utils/browser-launch.ts
  - src/test/server-browser-open.test.ts
priority: medium
type: bug
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the browser UI honor the conventional BROWSER environment override so Linux devcontainers can forward the local URL to the host browser without xdg-open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A non-empty BROWSER value is invoked as one executable with the browser URL as a separate argument before platform defaults.
- [x] #2 Unset and whitespace-only BROWSER values preserve the existing macOS, Windows, and Linux opener commands.
- [x] #3 Browser launch values are not shell-split or evaluated, and launch failures retain manual-open guidance.
- [x] #4 Focused browser tests, type checking, formatting checks, and the build pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Centralize browser command resolution. 2. Route server and CLI browser launches through the shared helper. 3. Add override, fallback, argument-boundary, and failure regressions. 4. Run focused and repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a shared browser launch resolver used by both the browser server and CLI URL helper. BROWSER is trimmed and treated as a single executable, the URL remains a separate argument, and whitespace falls back to the existing platform opener. Added real helper execution plus resolver and failure coverage.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added safe BROWSER override support for devcontainers without shell parsing, preserved platform fallbacks and manual failure guidance, and covered override, whitespace, argv-boundary, and error cases. Focused tests, type checking, full Biome check, build, and diff integrity passed; full-suite limitations are recorded separately.
<!-- SECTION:FINAL_SUMMARY:END -->
