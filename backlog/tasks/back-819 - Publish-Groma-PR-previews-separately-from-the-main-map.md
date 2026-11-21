---
id: BACK-819
title: Publish Groma PR previews separately from the main map
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-21T15:31:00Z'
updated_date: '2026-11-21T15:35:00Z'
labels: []
dependencies: []
references:
  - .github/workflows/architecture.yml
  - https://github.com/MrLesk/groma.md-action/pull/13
modified_files:
  - .github/workflows/architecture.yml
type: bug
ordinal: 417000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md loses already-built PR comparisons when its shared Pages job fails to prepare the default-branch map. Switch to the released publisher without breaking existing architecture links.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Default-branch updates publish committed architecture at /architecture/auto/.
- [ ] #2 A same-repository or manually reviewed PR can publish at /comparison/pr-N/auto/ independently of the default-branch map.
- [ ] #3 Existing live site paths are preserved during the publisher migration and a PR preview is verified on live Pages.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Release and verify the Action with the shared publisher.
2. Capture and seed the complete existing Pages site. Replace the legacy workflow with separate committed-map and PR comparison publication paths.
3. Verify CI, cut over the workflow, and publish and verify an actual PR preview and the retained live URLs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Workflow YAML and Bash parsed. The separate map and comparison publishers share the Pages queue and retain the existing path layout. The last successful Pages deployment archived 23 files. All 23 were downloaded, checked against the original archive listing, and used to prepare the ownership seed.
<!-- SECTION:NOTES:END -->
