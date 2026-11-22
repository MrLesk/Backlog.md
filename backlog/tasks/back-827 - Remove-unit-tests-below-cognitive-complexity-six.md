---
id: BACK-827
title: Remove unit tests below cognitive complexity six
status: Done
assignee:
  - '@codex'
created_date: '2026-11-22T18:47:00Z'
updated_date: '2026-11-22T18:58:00Z'
labels: []
dependencies: []
references:
  - AGENTS.md
  - scripts/run-ci-tests.ts
modified_files:
  - src/test/claude-agent-install.test.ts
  - src/test/heading.test.ts
  - src/test/kanban-tasks.test.ts
  - src/test/label-filter.test.ts
  - src/test/status-filter.test.ts
  - src/test/status-icon.test.ts
  - src/test/task-viewer-boundary-navigation.test.ts
  - src/test/terminal-status.test.ts
  - src/test/test-utils.test.ts
  - src/test/tui-startup-warning.test.ts
  - src/test/web-api-error.test.ts
  - src/utils/read-output-mode.test.ts
  - src/web/lib/docs-tree.test.ts
  - src/test/agent-instructions.test.ts
  - src/test/board-hide-empty-columns.test.ts
  - src/test/board-tui-move.test.ts
  - src/test/board-ui.test.ts
  - src/test/browser-host.test.ts
  - src/test/checklist.test.ts
  - src/test/cleanup.test.ts
  - src/test/cli-doc-decision-board.test.ts
  - src/test/cli-launcher.test.ts
  - src/test/cli-root-entry.test.ts
  - src/test/cli-task-state.test.ts
  - src/test/code-path.test.ts
  - src/test/dependency-graph-surfaces.test.tsx
  - src/test/document-archive.test.ts
  - src/test/duplicate-detection.test.ts
  - src/test/editor.test.ts
  - src/test/git.test.ts
  - src/test/help-popup.test.ts
  - src/test/list-window.test.ts
  - src/test/markdown.test.ts
  - src/test/milestone-filter.test.ts
  - src/test/offline-mode.test.ts
  - src/test/prefix-config.test.ts
  - src/test/prefix-migration.test.ts
  - src/test/resolveBinary.test.ts
  - src/test/runtime-cwd.test.ts
  - src/test/server-browser-open.test.ts
  - src/test/server-cache.test.ts
  - src/test/server-port.test.ts
  - src/test/subtask-progress.test.ts
  - src/test/task-search-parity.test.ts
  - src/test/task-sorting.test.ts
  - src/test/task-viewer-milestone-filter-model.test.ts
  - src/test/tui-acceptance-criteria-progress.test.ts
  - src/test/tui-priority-marker.test.ts
  - src/test/tui-task-composer.test.ts
  - src/test/tui-task-lifecycle.test.ts
  - src/test/tui-task-project.test.ts
  - src/test/tui-task-type.test.ts
  - src/test/tui-window-title.test.ts
  - src/test/unified-view-filters.test.ts
  - src/test/unified-view-loading.test.ts
  - src/test/view-switcher.test.ts
  - src/web/lib/lanes.test.ts
  - src/web/utils/date-display.test.ts
  - src/web/utils/milestones.test.ts
  - src/web/utils/reconcile.test.ts
  - src/web/utils/urlHelpers.test.ts
  - scripts/run-ci-tests.ts
type: chore
ordinal: 423000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Apply the documented CCCC cutoff to existing single-function unit tests. This keeps test effort focused on complex logic, regular-expression behavior, and supported workflows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Remove single-function unit tests whose function under test has a CCCC cognitive score below 6, except cases whose tested behavior depends on a regular expression.
- [x] #2 Preserve supported-flow tests at every score and leave shipped behavior unchanged.
- [x] #3 Verify the remaining suite using the existing CI test profiles and record the result.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review the tracked test files and identify single-function cases using the source function’s CCCC cognitive score. Keep workflow and regular-expression cases.
2. Remove eligible cases and unused test setup. Update explicit runner paths for deleted files.
3. Review the diff, build the CLI, and run types, Biome, and the existing test profiles.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Audited 335 tracked test files on the current main branch with CCCC 1.9.2. Compared Bun registrations for all changed test paths against the starting commit and counted 281 removed cases, including 13 complete files. Cases were eligible based on the cognitive score of the function under test. For example, resolveReadOutputMode scored 5 and browserUrl scored 4. Regular-expression-dependent cases and supported flows were kept.
The two platform test list entries for deleted files were removed. The runner keeps both the parallel and serial DOM passes.

Verified with Bun 1.4.4 and a fresh CLI bundle. The full CI profile passed 3,565 tests with 13 skips. The platform profile passed 534, the supplemental interactive TUI run passed 11, and the Node script suites passed 7. TypeScript, Biome, build, and diff checks passed. Codehygiene reported no issues on changed lines.
The first full run used TERM=dumb and the unchanged archived-document viewer test failed because the terminal omitted cursor movement between words. It passed with TERM=xterm-256color in a focused run and on the full recheck.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed 281 unit tests below the CCCC cognitive complexity cutoff, including 13 complete test files. Tests of supported workflows and regex-dependent behavior were kept. The full CI profile passed 3,565 tests with 13 skips and zero failures.
<!-- SECTION:FINAL_SUMMARY:END -->
