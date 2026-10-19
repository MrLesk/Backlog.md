---
id: BACK-568
title: Preserve genuine task publications during duplicate preview refresh
status: Done
assignee:
  - '@Codex'
created_date: '2026-08-02 22:49'
updated_date: '2026-08-02 23:02'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/834'
  - 'https://github.com/MrLesk/Backlog.md/pull/835#discussion_r3700491950'
priority: high
type: bug
ordinal: 211000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The v1.49.2 hotfix in PR #835 stopped the idle duplicate-preview feedback loop by suppressing all local-corpus refresh publication, but a preview that first observes a genuine filesystem edit can install it before queued watcher reconciliation and cause SearchService/WebSocket subscribers to miss the change. Preserve the loop fix while publishing genuine semantic or identity changes exactly once.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An unchanged duplicate-task preview publishes no tasks-updated event
- [x] #2 A duplicate preview that first observes a genuine semantic or identity task change publishes that change exactly once
- [x] #3 Queued watcher reconciliation after the preview cannot consume or duplicate the genuine publication
- [x] #4 Search and WebSocket subscribers observe the genuine task change
- [x] #5 Regression tests cover unchanged, genuine-change, and watcher-race paths
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace preview-wide publication suppression with a stable local-corpus change comparison that ignores transient runtime metadata but retains semantic task and identity changes.
2. Extend regression coverage so unchanged preview stays silent, a real duplicate edit publishes once, and the subsequent queued watcher reconciliation neither loses nor duplicates SearchService/WebSocket delivery.
3. Run focused duplicate-repair, ContentStore, SearchService, and server publication suites plus TypeScript, Biome, build, and diff checks; finalize the new bug task and open a ready follow-up PR against current main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Correction complete: task equality now ignores only lastModified and source runtime metadata, while path, branch, identity, and semantic content still trigger publication. The regression proves an unchanged preview is silent, a genuine edit first observed by preview updates SearchService and emits one tasks-updated frame, and subsequent queued full reconciliation emits no duplicate. Focused duplicate repair, ContentStore, SearchService, server duplicate repair, and server reorder suites pass 88/88 with 381 assertions. TypeScript, Biome across 350 files, production build, and diff-check pass.

Automatic review cycle 2 identified an older in-flight full refresh could publish stale state after preview. Corrected by routing local-corpus refresh through the existing root queue. The server regression now holds an old loader after capturing stale tasks, starts preview over a newer edit, releases the old load, and proves final search remains new with exactly one WebSocket publication. Reverified focused suites 88/88 with 381 assertions plus TypeScript, Biome, build, and diff-check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preserved the idle-loop fix by filtering only transient task metadata from task equality and serializing preview corpus refresh through the existing root queue. Genuine edits update search and WebSocket subscribers exactly once, and overlapping older reloads cannot roll state back. Verified with the held-loader race regression, 88 focused tests, TypeScript, Biome, build, and diff hygiene.
<!-- SECTION:FINAL_SUMMARY:END -->
