---
id: BACK-567
title: Stop idle browser refresh loop from duplicate task preview
status: Done
assignee:
  - '@Codex'
created_date: '2026-08-02 22:21'
updated_date: '2026-08-02 22:37'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/834'
priority: high
type: bug
ordinal: 210000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md v1.49.0 and v1.49.1 can enter a browser/server feedback loop while idle: duplicate-task preview refreshes the local identity corpus, publishes tasks-updated despite unchanged files, and triggers another full UI reload. Stop the spurious publication without changing duplicate detection or repair behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An unchanged duplicate-task preview does not publish a tasks-updated event
- [x] #2 The browser remains idle after its initial duplicate-task preview when repository task files do not change
- [x] #3 Duplicate-task preview still observes real task corpus changes
- [x] #4 Regression tests cover the event-publication boundary
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a focused regression that initializes the Core-owned ContentStore, repeats duplicate-task preview without filesystem changes, and asserts no task publication after the initial snapshot while a real corpus change still publishes.
2. Narrow the ContentStore local-corpus publication gate so semantic task and identity equality suppresses unchanged previews without altering duplicate detection, repair, watcher, or browser behavior.
3. Run focused duplicate-repair/ContentStore/server tests, TypeScript, Biome, build, full relevant tests, and diff review; then finalize BACK-567 and publish a ready PR linked to issue #834.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fail-first evidence: the initialized Core preview emitted one tasks event for an unchanged corpus, reproducing the WebSocket feedback trigger. The fix refreshes the active/completed identity snapshot for duplicate preview without publishing the read back to task listeners; adding a real duplicate between previews is still detected. Focused duplicate repair, ContentStore, and server duplicate-repair suites pass 79/79 with 348 assertions. TypeScript, Biome across 350 files, production build, and diff-check pass. The initial full bun test run encountered one unrelated default-timeout failure in task-type filtering documentation after 6.46s; the impacted suites in that run passed and the full run continued while the ready hotfix PR was prepared.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Stopped duplicate-task preview from publishing its own local-corpus refresh back through tasks-updated while preserving refreshed duplicate detection. Verified the exact unchanged-preview event regression, real duplicate observation, 79 focused tests, TypeScript, Biome, build, and diff hygiene.
<!-- SECTION:FINAL_SUMMARY:END -->
