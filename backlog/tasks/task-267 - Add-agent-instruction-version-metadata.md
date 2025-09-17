---
id: task-267
title: Add agent instruction version metadata
status: To Do
assignee:
  - '@codex'
created_date: '2025-09-17 19:19'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Embed a manually maintained version identifier in each agent instruction file that we ship, so users can tell which revision they have locally. Update the guideline embedding pipeline to preserve the version marker when the single-file binary is built.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Version header or comment exists in every bundled agent instruction file
- [ ] #2 Backlog init writes the version marker when generating agent instruction files
- [ ] #3 backlog agents --update-instructions preserves/updates the version marker
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decide version marker format (e.g., YAML frontmatter, HTML comment, or heading).
2. Update source instruction files under src/guidelines to include the marker.
3. Adjust embedding/append logic so the marker is written when generating user files.
4. Ensure unit tests cover init/update flows with new metadata.
<!-- SECTION:PLAN:END -->
