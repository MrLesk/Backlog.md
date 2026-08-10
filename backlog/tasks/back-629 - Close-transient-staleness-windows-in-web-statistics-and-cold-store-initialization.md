---
id: BACK-629
title: >-
  Close transient staleness windows in web statistics and cold store
  initialization
status: To Do
assignee: []
created_date: '2026-08-10 07:04'
labels: []
dependencies: []
priority: low
ordinal: 265000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two single-request staleness windows flagged by Codex on PR #899 (BACK-624), verified plausible on code read; both self-heal on the next request, so they were deferred from the v1.50.1 hotfix. (1) src/server/index.ts handleGetStatistics: priorities prefer the config loaded before refreshTasksForTaskRead (currentConfig) while statuses prefer the post-refresh corpus config, so a config change landing mid-request can pair refreshed tasks/statuses with stale priority buckets for one response; derive both from the refreshed corpus or reload config after the refresh. (2) src/core/backlog.ts getTask: storeAlreadyReady is captured before getContentStore(), so the read that performs cold initialization skips the reconciliation pass warm reads get; a task file changed after the initial corpus read but before watchers bind can be served stale once. Run a local-corpus reconciliation after joining cold initialization without repeating the cross-branch scan.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Statistics responses derive statuses and priorities from the same config generation as the tasks they count
- [ ] #2 The first read after cold store initialization reconciles the local corpus before responding
- [ ] #3 Regression tests cover both windows
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
