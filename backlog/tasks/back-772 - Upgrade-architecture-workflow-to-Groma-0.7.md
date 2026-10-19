---
id: BACK-772
title: Upgrade architecture workflow to Groma 0.7
status: Done
assignee:
  - '@codex'
created_date: '2026-10-19 11:39'
updated_date: '2026-10-19 11:40'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/1054#issuecomment-6248574719'
  - .github/workflows/architecture.yml
modified_files:
  - groma/scanners.json
  - groma/config.json
  - .github/workflows/architecture.yml
type: bug
ordinal: 391000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Architecture builds fail because the workflow pins Groma 0.6.6 while the current action reads groma/config.json before invoking project commands. The maintainer recommends Groma 0.7 for migration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both architecture workflow jobs use Groma 0.7.
- [x] #2 The action preparation step succeeds and existing scanner settings are preserved.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Upgrade both pins to 0.7.0, commit the CLI-generated config migration, and reproduce action preparation with preserved scanner settings.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Groma 0.7.0 scanner check generated config.json and removed scanners.json. All existing JSON fields and scanner settings are preserved; the migration additionally registered the Backlog work source. The exact groma.md-action@v1 prepare.mjs succeeded against an isolated copy of the migrated configuration and emitted scanner-key and config-file outputs. Scanner check reports uncached scanner packages locally; a full scan/export was not run. No TypeScript or runtime code changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pinned both architecture jobs to Groma 0.7.0 and committed its configuration migration. Verified the previously failing action preparation script succeeds and existing scanner settings are preserved.
<!-- SECTION:FINAL_SUMMARY:END -->
