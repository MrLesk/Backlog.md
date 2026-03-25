---
id: BACK-390
title: Add Kiro support in initialization flow and documentation
status: Done
assignee:
  - '@codex'
created_date: '2026-02-17 21:57'
updated_date: '2026-02-17 21:58'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tracking task for a PR that introduced Kiro support across CLI and core initialization, plus related documentation updates. The work has been implemented and validated in the PR flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI initialization includes Kiro as a supported option in the relevant setup flow.
- [x] #2 Core initialization logic handles and persists the Kiro-related configuration needed by the CLI.
- [x] #3 Project documentation is updated to reflect Kiro support and the expected initialization behavior.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Kiro support in initialization paths spanning CLI and core setup, and updated documentation to describe the new supported flow. Validation in PR context reported passing checks for touched paths, including tests/type checks.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
