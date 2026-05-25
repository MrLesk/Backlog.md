---
id: BACK-415
title: Catalog UI component color usage
status: Done
assignee:
  - '@antigravity'
created_date: '2026-05-25 13:09'
updated_date: '2026-05-25 13:58'
labels:
  - ui
  - colors
  - design-system
  - audit
dependencies: []
documentation:
  - doc-4
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Sweep the terminal and web UI components to catalog current color usage and document the gray/neutral/stone inconsistencies so a later implementation can standardize cards, panels, forms, and focus states.

The audit document is doc-4: UI Component Color Catalog.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Storybook or other existing color-definition surfaces are investigated and documented.
- [x] #2 Terminal UI components in src/ui/components are cataloged by component and color usage.
- [x] #3 Web UI components are cataloged by component, neutral family, semantic colors, and notable inconsistencies.
- [x] #4 The document captures recommended palette decisions and a candidate fix order.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect AGENTS.md workflow requirements and Backlog CLI command surface.
2. Search for existing Storybook, Tailwind, theme, and color documentation.
3. Inventory src/ui/components terminal colors and src/web/components Tailwind color families.
4. Create the UI Component Color Catalog document and verify it through Backlog search/file presence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created the color audit as Backlog document doc-4 using the Backlog document pipeline, then switched to the local Backlog CLI per user request to track the work. Existing unrelated worktree changes were left untouched.

Verification: `bun test` completed with exit code 0. TypeScript and formatting/linting were not touched by this docs-only audit task; existing unrelated worktree changes were not modified intentionally.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created `doc-4 - UI Component Color Catalog` under `backlog/docs/ui/component-color-catalog/` and tracked the audit as BACK-415 via the local Backlog CLI per AGENTS.md workflow.

The document records that no Storybook setup or existing palette contract was found, catalogs the terminal UI components in `src/ui/components`, catalogs the React web components by gray/neutral/stone and semantic color usage, and identifies the main inconsistency hotspots plus a candidate fix order.

Verification: `bun run cli search "Catalog UI component color usage" --plain` finds BACK-415 and doc-4; `bun run cli doc list` includes doc-4; `bun test` completed with exit code 0. No TypeScript or formatting/linting code was intentionally changed for this docs-only task.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
