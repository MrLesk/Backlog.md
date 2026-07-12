---
id: BACK-423
title: Add folder grouping for docs in Web UI
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-04 14:10'
labels:
  - web-ui
  - docs
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/488'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #488: make documentation easier to navigate when docs are organized into folders or path groups.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Documentation list groups documents by folder or comparable path/type grouping.
- [x] #2 Users can expand and collapse groups without losing access to flat docs.
- [x] #3 Existing document create/view/edit behavior continues to work for ungrouped docs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebase PR #674 onto latest origin/main (done, clean).
2. Revert generated src/web/styles/style.css to main (no source.css change needed; file is built via build:css).
3. Rewrite docs-tree.ts without non-null assertions and simplify tree construction (single pass, no empty-folder cleanup needed).
4. Extract shared DocLink helper in SideNavigation to remove three duplicated document NavLink render paths; slim FolderNode props; truncate long folder labels with title tooltip and concise aria-label + aria-expanded.
5. Run bunx tsc --noEmit, bun run check ., bun test; push to contributor branch or fallback PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Took over PR #674 (contributor zhuohoudeputao) per review feedback; rebased onto latest origin/main (clean) and added fix commits on top of the contributor's commits:
- Reverted generated src/web/styles/style.css to main (file is built by build:css from source.css; no source change was needed, so the minified churn was unrelated).
- Rewrote buildDocsTree as a single-pass builder keyed by folder path: no non-null assertions (fixes Biome noNonNullAssertion warnings), no per-iteration child-map rebuilding, and no separate empty-folder cleanup (empty folders can never be created). All 8 existing docs-tree tests pass unchanged.
- Extracted a shared DocLink component in SideNavigation and reused it for search results, folder tree docs, and ungrouped docs (was 3 duplicated NavLink blocks). Slimmed FolderNode props to node/depth/folderExpanded/onToggleFolder (stripIdPrefix/sanitizeUrlTitle are module-level; state setter replaced by a stable toggleFolder callback). Folder labels now truncate with a title tooltip; concise aria-label (folder name) with state conveyed via aria-expanded.
Validation: bunx tsc --noEmit passes; bun run check . passes (308 files, run from a git-archive copy because this worktree lives under .claude/ which the repo's biome/gitignore config excludes); bun test src/web/lib/docs-tree.test.ts 8/8 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed contributor PR #674 (zhuohoudeputao) with the requested rework, preserving the contributor's four commits and authorship. Rebased onto latest main, then added three fix commits: (1) restored generated src/web/styles/style.css byte-identical to main since no source.css change was involved; (2) rewrote buildDocsTree as a simpler single-pass builder with no non-null assertions, fixing the Biome warnings while keeping all 8 unit tests green; (3) extracted a shared DocLink component to replace three duplicated document NavLink render paths in SideNavigation, slimmed FolderNode props with a stable toggleFolder callback, and made long folder labels truncate with a title tooltip plus concise aria-label and aria-expanded. Verified with bunx tsc --noEmit (pass), bun run check . (pass, 308 files), and bun test (only pre-existing flaky cli-priority-filtering timeout fails at default 5s; passes 11/11 with --timeout 20000; unrelated to this change).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
