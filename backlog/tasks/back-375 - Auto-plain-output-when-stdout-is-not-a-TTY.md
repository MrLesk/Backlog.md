---
id: BACK-375
title: Auto-plain output when stdout is not a TTY
status: Done
assignee: []
created_date: '2026-01-26 14:01'
updated_date: '2026-01-26 14:01'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor plain-mode detection to automatically use plain text output in non-interactive environments (piped, CI, scripts, AI agents) instead of launching TUI which causes hangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Define isNonInteractive constant once at startup
- [x] #2 Use consistent usePlainOutput pattern in all command handlers
- [x] #3 Commands affected: task create/list/edit/view, draft list/view, doc list, sequence list, search
- [x] #4 TUI still works when stdout is a TTY
- [x] #5 --plain flag still works explicitly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add isNonInteractive const after Windows color fix section
2. Replace all isPlainFlag definitions with usePlainOutput = options.plain || isNonInteractive
3. Update comments from "AI agents" to "non-interactive environments"
4. Test with piped output and direct TTY
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added isNonInteractive = !process.stdout.isTTY || process.argv.includes("--plain") at line 200
- Updated 11 command handlers to use consistent usePlainOutput pattern
- Removed duplicated process.argv.includes("--plain") checks
- Comments updated to be more generic (non-interactive vs AI agents)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
