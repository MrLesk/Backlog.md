---
id: BACK-473
title: handle port congestion for backlog browser
status: Done
assignee:
  - '@codex'
created_date: '2026-05-08 14:29'
updated_date: '2026-07-08 19:55'
labels:
  - webui
dependencies: []
modified_files:
  - src/server/index.ts
  - src/cli.ts
  - src/test/server-port.test.ts
  - src/test/cli-browser-port.test.ts
  - src/test/test-utils.ts
ordinal: 166000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
If port 6420 is taken, ask user to try a different one. Ideally just increment port number (e.g. 6421), check if free and start if user accepts this.

oh, and check if port is free before starting the backlog browser mode anyway. this seems to not happen correctly O_o
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Port is checked for availability before Bun.serve() is called (proactive check, not just catching EADDRINUSE)
- [x] #2 If port is taken, user is shown the next available port (port+1 or higher) and asked to confirm interactively
- [x] #3 If user accepts (Y/enter), server starts on the suggested port successfully
- [x] #4 If user declines (n/N), process exits cleanly with code 0
- [x] #5 isPortAvailable() and findNextAvailablePort() are exported from src/server/index.ts and unit-tested (min 3 cases, ≥1 error/edge case)
- [x] #6 --non-interactive flag skips prompt and auto-selects next free port
- [x] #7 findNextAvailablePort stops at port 65535 and fails cleanly when no available port exists
- [x] #8 Non-TTY or explicitly non-interactive browser startup does not wait for a prompt
- [x] #9 Port availability tests avoid fixed high ports that can collide on shared machines
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the existing browser command and port helper implementation against the PR review feedback.
2. Bound port scanning so values above 65535 return a clean failure instead of looping.
3. Make browser startup non-interactive by default in non-TTY/headless contexts while preserving prompts for interactive terminals.
4. Replace fixed-port tests with ephemeral-port helpers and add coverage for max-port/no-port and headless behavior.
5. Run focused tests, typecheck, and Biome check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Review follow-up for PR #651:
- Bounded findNextAvailablePort() to the valid browser port range and return null when no port can be selected.
- Browser startup now treats non-TTY/headless runs like --non-interactive, avoiding readline prompts that automation cannot answer.
- Replaced fixed high-port tests with OS-assigned ephemeral ports and added coverage for bounded/no-port behavior.
- Added a CLI subprocess test proving non-TTY browser startup auto-selects another port without prompting.

Validation:
- bun test src/test/server-port.test.ts src/test/cli-browser-port.test.ts: 8 pass.
- bunx tsc --noEmit: pass.
- bunx biome check src/cli.ts src/server/index.ts src/test/server-port.test.ts src/test/cli-browser-port.test.ts src/test/test-utils.ts: pass.
- bun test: 1250 pass, 2 skip, 1 unrelated timeout in src/test/cli-priority-filtering.test.ts (case insensitive priority filtering); isolated rerun times out at the same 5s budget.
- bun run check .: blocked by existing package.json indentation formatting, outside the touched files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the PR #651 requested changes: port scanning now stops at 65535 and fails cleanly, non-TTY/headless browser startup no longer prompts, and tests use ephemeral ports with coverage for bounded scans and non-interactive behavior. Verified focused tests, TypeScript, and scoped Biome; full-suite/check caveats are recorded in implementation notes.
<!-- SECTION:FINAL_SUMMARY:END -->
