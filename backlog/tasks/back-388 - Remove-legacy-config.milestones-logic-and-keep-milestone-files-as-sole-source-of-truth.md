---
id: BACK-388
title: >-
  Remove legacy config.milestones logic and keep milestone files as sole source
  of truth
status: Done
assignee:
  - '@codex'
created_date: '2026-02-17 20:42'
updated_date: '2026-02-17 20:47'
labels: []
dependencies: []
references:
  - src/file-system/operations.ts
  - src/core/config-migration.ts
  - src/core/init.ts
  - src/core/milestones.ts
  - src/cli.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Clean up remaining legacy milestone-list config logic so milestone state is derived only from milestone files. Remove stale config field handling and legacy helper paths that still imply config-backed milestone sources.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Runtime milestone behavior does not read milestone values from config and continues to use milestone files.
- [x] #2 Legacy config.milestones parse/serialize/migration/default wiring is removed or neutralized so it no longer drives behavior.
- [x] #3 Legacy config-based milestone helper paths are removed when unused.
- [x] #4 CLI config output/help no longer advertises milestones as an active config key.
- [x] #5 Relevant tests are updated and pass for milestone + config flows.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed remaining legacy config-backed milestone logic and aligned milestone handling to milestone files as the sole runtime source.

Implemented cleanup:
- Removed legacy config milestone parse/serialize wiring from filesystem config handling.
- Removed milestone defaults/migration/init wiring in core config code paths.
- Removed deprecated config-based milestone helper functions (`collectMilestones`, `buildMilestoneBucketsFromConfig`) and corresponding re-exports.
- Updated CLI `config` surfaces to stop exposing `milestones` as an active config key in `get`/`list` output and key help text.
- Updated milestone utility + config tests to cover file/entity-based behavior and new config expectations.

Validation:
- `bunx tsc --noEmit`
- `bun run check .`
- `bun test src/web/utils/milestones.test.ts src/test/filesystem.test.ts src/test/enhanced-init.test.ts src/test/config-commands.test.ts`
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
